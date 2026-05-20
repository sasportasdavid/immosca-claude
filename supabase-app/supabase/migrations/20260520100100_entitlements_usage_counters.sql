-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-A.2 : tables entitlements + usage_counters
-- ────────────────────────────────────────────────────────────────────
-- `entitlements` : crédits one-shot (PPU) ou récurrents (add-ons veille)
--                  attachés à un profile. Permet de stacker PPU + sub.
-- `usage_counters` : compteur mensuel par profile, reset au cycle Stripe
--                    (period_start = anniversaire d'abo, pas calendrier).
-- ────────────────────────────────────────────────────────────────────

-- ─── Enums ───

create type entitlement_type as enum (
  'ppu_analysis',            -- 1 analyse PPU 14,90€ (consommable one-shot)
  'ppu_watch_bonus',         -- bonus veille 30j déclenché par achat PPU
  'addon_watch_unit',        -- veille additionnelle 3×/sem (+7€/mois recurring)
  'addon_watch_pack3',       -- pack 3 veilles 3×/sem (+19€/mois recurring)
  'addon_watch_daily',       -- veille additionnelle daily Business (+19€/mois)
  'addon_watch_pack3_daily', -- pack 3 veilles daily Business (+49€/mois)
  'addon_seat'               -- seat supplémentaire Business (+30€/mois) — V1.5
);

create type entitlement_status as enum (
  'pending',  -- one-shot créé, pas encore consommé (PPU non utilisé)
  'active',   -- recurring add-on en cours, ou one-shot en lecture seule
  'consumed', -- one-shot consommé (PPU utilisé pour une analyse)
  'expired',  -- expiré sans consommation, ou recurring add-on annulé
  'refunded'  -- remboursé via Stripe
);

-- ─── Table : entitlements ───

create table entitlements (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type entitlement_type not null,
  status entitlement_status not null default 'pending',
  -- Source
  source text not null default 'stripe_checkout', -- 'stripe_checkout' | 'stripe_subscription' | 'promo_code' | 'manual_grant'
  source_payment_id text,                          -- Stripe checkout_session_id ou invoice_id
  source_subscription_item_id text,                -- Stripe subscription_item_id pour recurring
  -- Lien optionnel vers la ressource consommée
  consumed_resource_id uuid,                       -- analysis_id / watch_id selon le type
  -- Metadata libre (ex: { "watch_id": "uuid", "analysis_id": "uuid" })
  metadata jsonb not null default '{}'::jsonb,
  -- Timeline
  granted_at timestamptz not null default now(),
  consumed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger entitlements_updated_at before update on entitlements
  for each row execute function set_updated_at();

create index entitlements_profile_status_idx
  on entitlements(profile_id, status);
create index entitlements_profile_type_status_idx
  on entitlements(profile_id, type, status);
create index entitlements_expires_at_idx
  on entitlements(expires_at)
  where status in ('pending', 'active');
create index entitlements_source_payment_idx
  on entitlements(source_payment_id)
  where source_payment_id is not null;

-- RLS : un user lit ses propres entitlements, jamais d'écriture côté client
alter table entitlements enable row level security;

create policy entitlements_select_own on entitlements
  for select to authenticated
  using (profile_id = auth.uid());

-- Aucune policy INSERT/UPDATE/DELETE pour authenticated :
-- toutes les mutations passent par les webhooks Stripe (service_role bypass)
-- ou par les RPCs SECURITY DEFINER (consume_ppu_entitlement, etc.)

comment on table entitlements is
  'Crédits ImmoScan (PPU one-shot et add-ons recurring). Source de vérité '
  'pour les capacités utilisateur qui dépassent le plan d''abonnement.';
comment on column entitlements.consumed_resource_id is
  'analysis_id pour ppu_analysis, watch_id pour ppu_watch_bonus / addon_*';
comment on column entitlements.expires_at is
  'PPU watch bonus = J+30. PPU analysis = J+90 lecture seule. Recurring = null.';

-- ─── Table : usage_counters ───
-- Compteur mensuel, reset au cycle Stripe. Une ligne par (profile, période).

create table usage_counters (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  -- Compteurs
  analyses_used integer not null default 0,
  analyses_concurrent integer not null default 0, -- décrémenté à fin de run
  watch_runs_used integer not null default 0,     -- pour analytics, pas hard cap
  paste_urls_used_today integer not null default 0,
  paste_urls_reset_at date,                       -- pour reset journalier
  -- Timeline
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, period_start)
);

create trigger usage_counters_updated_at before update on usage_counters
  for each row execute function set_updated_at();

create index usage_counters_profile_period_idx
  on usage_counters(profile_id, period_start desc);

alter table usage_counters enable row level security;

create policy usage_counters_select_own on usage_counters
  for select to authenticated
  using (profile_id = auth.uid());

-- Pas d'INSERT/UPDATE côté client : géré par les RPCs SECURITY DEFINER
-- (increment_analysis_counter, decrement_concurrent, etc.) et par
-- le webhook Stripe (reset au cycle).

comment on table usage_counters is
  'Compteurs mensuels d''usage par profile. Reset au cycle Stripe '
  '(period_start = anniversaire d''abonnement, pas calendrier).';

-- ─── Grants explicites (cf MEMORY : MCP migrations exigent GRANT explicite) ───

grant select on entitlements to authenticated;
grant select on usage_counters to authenticated;

-- Service role : tout
grant all on entitlements to service_role;
grant all on usage_counters to service_role;

-- ─── Rollback ───
-- drop table if exists usage_counters cascade;
-- drop table if exists entitlements cascade;
-- drop type if exists entitlement_status;
-- drop type if exists entitlement_type;
