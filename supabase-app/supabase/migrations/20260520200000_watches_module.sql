-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-D : module veille (watches backend complet)
-- ────────────────────────────────────────────────────────────────────
-- Étend `watches` + crée `watch_runs`, `watch_listings`, `watch_events`,
-- `market_stats_cache`. RLS, indexes, GRANTs.
--
-- Sources :
--   - module-veille-immoscan.md §9 (DB)
--   - business-model-immoscan.md §5.3 (cron)
-- ────────────────────────────────────────────────────────────────────

-- ─── Enums ───

create type watch_event_type as enum (
  'new_match',         -- bien nouveau (jamais vu) avec score >= threshold
  'price_drop',        -- bien tracké, prix baisse >= 3%
  'signal_to_verify',  -- décote potentielle vs DVF (avec garde-fous)
  'relisted',          -- bien réapparaît après removed
  'removed',           -- bien tracké disparu (sur 2 runs consécutifs)
  'price_rise'         -- log analytics interne, pas dans email
);

create type watch_run_status as enum (
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled'
);

create type watch_listing_status as enum (
  'new',       -- jamais notifié
  'tracked',   -- notifié et toujours actif
  'removed',   -- absent du dernier run (en attente confirmation 2e run)
  'gone'       -- confirmé removed sur 2 runs consécutifs
);

create type watch_sensitivity as enum ('strict', 'moderate', 'permissive');
create type dpe_bin_type as enum ('A_C', 'D_E', 'F_G', 'unknown');

-- ─── Extend watches ───

alter table watches
  add column if not exists expires_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists sensitivity watch_sensitivity not null default 'moderate',
  add column if not exists stats_7d jsonb not null default '{}'::jsonb,
  add column if not exists last_run_status watch_run_status,
  add column if not exists consecutive_truncated_runs integer not null default 0;

comment on column watches.expires_at is
  'Pour Free (J+60) et PPU (J+30). Null = abonnement payant non expirant.';
comment on column watches.suspended_at is
  'Set quand expires_at est dépassé. La veille est suspendue (pas supprimée), '
  'réactivable en 1 clic via upgrade Pro/Pro+.';
comment on column watches.consecutive_truncated_runs is
  'Si >=3, déclenche email d''alerte "ta recherche dépasse le cap, affine".';

create index if not exists watches_expires_at_idx
  on watches(expires_at)
  where is_active = true and suspended_at is null;

-- ─── Table : watch_runs ───
-- Log de chaque exécution de scout. Permet :
--  - tab "Historique" UI (transparence + debug)
--  - télémétrie (durée, coût Apify, items scrapés)
--  - idempotence (skip un dispatch si run en cours)

create table watch_runs (
  id uuid primary key default uuid_generate_v4(),
  watch_id uuid not null references watches(id) on delete cascade,
  status watch_run_status not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  -- Compteurs
  items_scraped integer not null default 0,
  new_count integer not null default 0,
  drop_count integer not null default 0,
  signal_count integer not null default 0,
  relisted_count integer not null default 0,
  removed_count integer not null default 0,
  -- Flags
  truncated boolean not null default false,
  -- Coût + trace Apify
  apify_run_ids text[] not null default array[]::text[],
  estimated_cost_eur numeric(10, 4) not null default 0,
  -- Snapshot des stats marché (pour graphe d'évolution sur tab Évolutions)
  market_stats jsonb not null default '{}'::jsonb,
  -- Debug
  error_message text,
  trigger_run_id text,
  created_at timestamptz not null default now()
);

create index watch_runs_watch_started_idx on watch_runs(watch_id, started_at desc);
create index watch_runs_status_idx on watch_runs(status) where status in ('pending', 'running');

alter table watch_runs enable row level security;

-- Un user voit les runs de ses propres watches
create policy "watch_runs_select_own" on watch_runs
  for select to authenticated
  using (
    exists (
      select 1 from watches w
      where w.id = watch_runs.watch_id
        and w.profile_id = auth.uid()
    )
  );

comment on table watch_runs is
  'Log de chaque exécution de scout par watch. Source du tab Historique UI.';

-- ─── Table : watch_listings ───
-- État actuel des biens trackés. Une row par (watch_id, listing_id).
-- Conserve `price_history` JSONB pour calculer les price_drop et afficher
-- la courbe d'évolution sur le tab "Évolutions".

create table watch_listings (
  id uuid primary key default uuid_generate_v4(),
  watch_id uuid not null references watches(id) on delete cascade,
  -- listing_id peut être null si le bien a disparu et qu'on l'a archivé
  listing_id uuid references listings(id) on delete set null,
  -- Snapshot du bien (denormalized pour résister à la disparition du listing)
  external_id text not null,
  source_site listing_source not null,
  source_url text not null,
  title text,
  current_price numeric(12, 2) not null,
  current_surface numeric(8, 2),
  current_dpe text,
  current_score numeric(5, 2),
  current_status watch_listing_status not null default 'new',
  -- Historique des prix : [{date, price, change_pct}]
  price_history jsonb not null default '[]'::jsonb,
  -- Indicateurs pour anti-churn et filter UI
  is_in_pipeline boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_since timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watch_id, external_id)
);

create trigger watch_listings_updated_at before update on watch_listings
  for each row execute function set_updated_at();

create index watch_listings_watch_status_idx
  on watch_listings(watch_id, current_status, last_seen_at desc);
create index watch_listings_purge_idx
  on watch_listings(last_seen_at)
  where is_in_pipeline = false;
create index watch_listings_score_idx
  on watch_listings(watch_id, current_score desc nulls last);

alter table watch_listings enable row level security;

create policy "watch_listings_select_own" on watch_listings
  for select to authenticated
  using (
    exists (
      select 1 from watches w
      where w.id = watch_listings.watch_id
        and w.profile_id = auth.uid()
    )
  );

comment on table watch_listings is
  'État actuel + historique de prix des biens trackés par watch. '
  'Source du tab Opportunités UI. Purge auto > 6 mois si is_in_pipeline=false.';

-- ─── Table : watch_events ───
-- Fil typé des événements notables. C'est ce que le digest email lit pour
-- savoir quoi envoyer, et ce que le tab "Évolutions" UI affiche.

create table watch_events (
  id uuid primary key default uuid_generate_v4(),
  watch_id uuid not null references watches(id) on delete cascade,
  watch_listing_id uuid references watch_listings(id) on delete cascade,
  watch_run_id uuid references watch_runs(id) on delete set null,
  event_type watch_event_type not null,
  -- Payload spécifique au type :
  --   new_match: { score, prix, prix_m2, dpe }
  --   price_drop: { old_price, new_price, delta_pct, delta_eur }
  --   signal_to_verify: { ecart_pct, n_transactions, median_eur_m2, dpe_bin }
  --   relisted: { prev_removed_at, new_price }
  --   removed: { last_known_price, last_seen_at }
  payload jsonb not null default '{}'::jsonb,
  -- Email status
  included_in_digest boolean not null default false,
  digest_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index watch_events_watch_created_idx on watch_events(watch_id, created_at desc);
create index watch_events_undigested_idx
  on watch_events(watch_id, created_at)
  where included_in_digest = false;
create index watch_events_type_idx on watch_events(event_type, created_at desc);

alter table watch_events enable row level security;

create policy "watch_events_select_own" on watch_events
  for select to authenticated
  using (
    exists (
      select 1 from watches w
      where w.id = watch_events.watch_id
        and w.profile_id = auth.uid()
    )
  );

comment on table watch_events is
  'Fil typé des événements détectés par le scout. Base du digest email '
  '(included_in_digest=false → à envoyer) et du tab Évolutions.';

-- ─── Table : market_stats_cache ───
-- Médianes DVF par (commune, type, bin DPE) calculées par un job cron qui
-- lit immoscan-data. Utilisé par le scout pour détecter `signal_to_verify`
-- avec garde-fous (n_transactions >= 15).
--
-- Note : populate de cette table arrive en PR-E (quand DVF importé). En
-- attendant, watch-scout skip les events signal_to_verify si la table
-- est vide (no-op gracieux).

create table market_stats_cache (
  commune_insee text not null,
  bien_type bien_type not null,
  dpe_bin dpe_bin_type not null,
  median_eur_m2 numeric(10, 2) not null,
  p25_eur_m2 numeric(10, 2),
  p75_eur_m2 numeric(10, 2),
  n_transactions integer not null,
  -- Période sur laquelle la médiane a été calculée (12 mois glissants)
  window_start date not null,
  window_end date not null,
  computed_at timestamptz not null default now(),
  primary key (commune_insee, bien_type, dpe_bin)
);

create index market_stats_cache_computed_idx on market_stats_cache(computed_at);

alter table market_stats_cache enable row level security;

-- Pas de policy authenticated : tout passe par RPC controllée.
-- Le worker (service_role) lit directement.

comment on table market_stats_cache is
  'Médianes DVF par (commune, type, bin DPE) — populate par worker job '
  'compute-market-stats (PR-E, cron mensuel). Filtre n_transactions >= 15 '
  'côté lecture pour fiabilité statistique.';

-- ─── RPC : purge_watch_listings ───
-- Supprime les watch_listings qui n'ont pas été vus depuis 6 mois ET ne
-- sont pas dans le pipeline. Appelé par task `watch-purge` cron daily.

create or replace function purge_watch_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from watch_listings
  where last_seen_at < now() - interval '6 months'
    and is_in_pipeline = false;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ─── RPC : suspend_expired_watches ───
-- Marque les watches Free/PPU dont expires_at est dépassé comme suspendues.
-- Appelé par cron daily.

create or replace function suspend_expired_watches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suspended integer;
begin
  update watches
  set is_active = false,
      suspended_at = now()
  where is_active = true
    and suspended_at is null
    and expires_at is not null
    and expires_at < now();
  get diagnostics v_suspended = row_count;
  return v_suspended;
end;
$$;

-- ─── RPC : dispatch_watches_for_scheduler ───
-- Retourne la liste des watch_id à dispatcher selon le scheduler appelé.
-- Filtre selon le plan du user (Business = daily, autres = 3×/sem).

create or replace function watches_to_dispatch(p_schedule text)
returns table (watch_id uuid, profile_id uuid, plan subscription_plan)
language sql
stable
security definer
set search_path = public
as $$
  select w.id as watch_id, w.profile_id, p.subscription_plan as plan
  from watches w
  join profiles p on p.id = w.profile_id
  where w.is_active = true
    and w.suspended_at is null
    and (
      (p_schedule = 'standard' and p.subscription_plan in ('free', 'pro', 'pro_plus'))
      or (p_schedule = 'business' and p.subscription_plan = 'business')
    )
    -- Skip si un run pending/running existe déjà (idempotence)
    and not exists (
      select 1 from watch_runs r
      where r.watch_id = w.id
        and r.status in ('pending', 'running')
    );
$$;

-- ─── Grants ───

grant select on watch_runs to authenticated;
grant select on watch_listings to authenticated;
grant select on watch_events to authenticated;
-- market_stats_cache : pas de select authenticated (service_role only)

grant all on watch_runs to service_role;
grant all on watch_listings to service_role;
grant all on watch_events to service_role;
grant all on market_stats_cache to service_role;

grant execute on function purge_watch_listings() to service_role;
grant execute on function suspend_expired_watches() to service_role;
grant execute on function watches_to_dispatch(text) to service_role;

-- ─── Rollback ───
-- drop function if exists watches_to_dispatch(text);
-- drop function if exists suspend_expired_watches();
-- drop function if exists purge_watch_listings();
-- drop table if exists market_stats_cache cascade;
-- drop table if exists watch_events cascade;
-- drop table if exists watch_listings cascade;
-- drop table if exists watch_runs cascade;
-- alter table watches
--   drop column if exists consecutive_truncated_runs,
--   drop column if exists last_run_status,
--   drop column if exists stats_7d,
--   drop column if exists sensitivity,
--   drop column if exists suspended_at,
--   drop column if exists expires_at;
-- drop type if exists dpe_bin_type;
-- drop type if exists watch_sensitivity;
-- drop type if exists watch_listing_status;
-- drop type if exists watch_run_status;
-- drop type if exists watch_event_type;
