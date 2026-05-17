-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — Migration 0001 : Foundation schema for immoscan-app
-- ────────────────────────────────────────────────────────────────────
-- Projet Supabase eu-west-3 (Paris)
-- Tables transactionnelles : users, params, analyses, listings, scores,
-- watches, pipeline, subscriptions.
-- Toutes les tables sont sous RLS. Le freemium teasing est implémenté
-- côté serveur via la vue `listings_freemium_view`.
-- ────────────────────────────────────────────────────────────────────

-- ─── Extensions ───
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Enums ───
create type subscription_plan as enum ('free', 'pro', 'pro_plus');

create type subscription_status as enum (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid'
);

create type strategy_type as enum (
  'locatif_nu',
  'lmnp_meuble',
  'mixte',
  'colocation',
  'courte_duree'
);

create type travaux_tolerance as enum ('aucun', 'leger', 'moyen', 'lourd');

create type analysis_status as enum (
  'pending',
  'scraping',
  'enriching',
  'scoring',
  'generating',
  'done',
  'failed'
);

create type listing_source as enum ('seloger', 'leboncoin', 'bienici', 'pap', 'logic_immo');

create type bien_type as enum ('appartement', 'maison', 'terrain', 'immeuble', 'autre');

create type verdict_type as enum ('a_visiter', 'sous_reserve', 'no_go');

create type pipeline_stage as enum (
  'a_visiter',
  'visite',
  'offre',
  'compromis',
  'signe'
);

create type watch_frequency as enum ('daily', 'three_days', 'weekly');

-- ─── Helper functions ───

-- updated_at automatic
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Table : profiles ───
-- 1-1 avec auth.users. Créé via trigger on auth.users.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  subscription_plan subscription_plan not null default 'free',
  subscription_status subscription_status not null default 'active',
  trial_ends_at timestamptz,
  stripe_customer_id text unique,
  -- Préférences UX
  preferred_locale text default 'fr-FR',
  marketing_emails_opt_in boolean not null default false,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create index profiles_stripe_customer_id_idx on profiles(stripe_customer_id);

-- Trigger pour créer le profile à l'inscription
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── Fonctions helper RLS ───
-- DOIVENT être déclarées APRÈS la création de profiles : LANGUAGE SQL
-- valide les références à la création, contrairement à plpgsql.
-- Ces fonctions sont utilisées par la vue listings_freemium_view.

-- Récupère le plan du user courant (auth.uid())
-- Utilisé partout dans les RLS et la vue freemium.
create or replace function current_user_plan()
returns subscription_plan
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select subscription_plan from profiles where id = auth.uid()),
    'free'::subscription_plan
  );
$$;

-- True si le user a un plan payant
create or replace function is_user_paid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_plan() <> 'free'::subscription_plan;
$$;

-- ─── Table : user_params ───
-- Paramètres d'investissement, une ligne par user, mis à jour à l'onboarding.
create table user_params (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  strategy strategy_type not null default 'locatif_nu',
  budget_max numeric(12, 2),
  apport numeric(12, 2) not null default 0,
  taux_credit_pct numeric(5, 2) not null default 3.00,
  duree_credit_ans int not null default 25 check (duree_credit_ans between 5 and 30),
  tmi_pct numeric(5, 2) not null default 30.00 check (tmi_pct between 0 and 50),
  rendement_min_pct numeric(5, 2) not null default 5.00,
  tolerance_travaux travaux_tolerance not null default 'leger',
  -- Pondération scoring custom (optionnel, Business uniquement)
  scoring_weights jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_params_updated_at before update on user_params
  for each row execute function set_updated_at();

alter table user_params enable row level security;

create policy "user_params_select_own" on user_params
  for select using (auth.uid() = profile_id);

create policy "user_params_insert_own" on user_params
  for insert with check (auth.uid() = profile_id);

create policy "user_params_update_own" on user_params
  for update using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ─── Table : analyses ───
-- Un run d'analyse pour une URL donnée.
create table analyses (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  source_url text not null,
  source_site listing_source not null,
  ville text,
  code_postal text,
  status analysis_status not null default 'pending',
  -- Snapshot des paramètres au moment du run (immutable)
  params_snapshot jsonb not null,
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  error_message text,
  -- IDs externes
  apify_run_id text,
  trigger_run_id text,
  -- Stats
  total_listings_raw int default 0,
  total_listings_filtered int default 0,
  median_price_per_sqm numeric(10, 2),
  median_score int,
  -- Timestamps
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create trigger analyses_updated_at before update on analyses
  for each row execute function set_updated_at();

create index analyses_profile_id_created_idx on analyses(profile_id, created_at desc);
create index analyses_status_idx on analyses(status) where status in ('pending', 'scraping', 'enriching', 'scoring', 'generating');

alter table analyses enable row level security;

create policy "analyses_select_own" on analyses
  for select using (auth.uid() = profile_id);

create policy "analyses_insert_own" on analyses
  for insert with check (auth.uid() = profile_id);

create policy "analyses_update_own" on analyses
  for update using (auth.uid() = profile_id);

create policy "analyses_delete_own" on analyses
  for delete using (auth.uid() = profile_id);

-- ─── Table : listings ───
-- Un bien scrapé, lié à une analyse.
-- LECTURE INTERDITE EN DIRECT — passe toujours par listings_freemium_view.
create table listings (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  -- Identité source
  external_id text not null,
  source_site listing_source not null,
  source_url text not null,
  -- Descriptif
  title text,
  description text,
  type bien_type not null,
  prix numeric(12, 2) not null,
  surface numeric(8, 2),
  pieces int,
  chambres int,
  -- Adresse
  ville text,
  code_postal text,
  adresse_raw text,
  adresse_geocoded text,
  code_insee text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  -- DPE
  dpe text check (dpe in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  ges text check (ges in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  -- Détails
  etage int,
  balcon boolean default false,
  terrasse boolean default false,
  parking boolean default false,
  cave boolean default false,
  ascenseur boolean default false,
  charges_copro_annuelles numeric(10, 2),
  taxe_fonciere numeric(10, 2),
  annee_construction int,
  photos_urls text[],
  -- Métadonnées
  is_exclusive boolean default false,
  is_new_construction boolean default false,
  published_at timestamptz,
  scraped_at timestamptz not null default now(),
  unique(analysis_id, external_id, source_site)
);

create index listings_analysis_id_idx on listings(analysis_id);
create index listings_code_postal_idx on listings(code_postal);
create index listings_prix_idx on listings(prix);

alter table listings enable row level security;

-- Lecture interdite en direct : tout passe par la vue
create policy "listings_no_direct_read" on listings
  for select using (false);

-- Le worker (service_role) écrit
-- (service_role bypasse RLS, donc pas besoin de policy explicite)

-- ─── Table : listing_scores ───
-- Score /100 + sous-scores + analyse Claude.
-- LECTURE INTERDITE EN DIRECT — passe par listings_freemium_view.
create table listing_scores (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null unique references listings(id) on delete cascade,
  analysis_id uuid not null references analyses(id) on delete cascade,
  -- Score global et sous-scores (0-100)
  score_total int not null check (score_total between 0 and 100),
  score_prix int not null check (score_prix between 0 and 100),
  score_rendement int not null check (score_rendement between 0 and 100),
  score_cashflow int not null check (score_cashflow between 0 and 100),
  score_dpe int not null check (score_dpe between 0 and 100),
  score_quartier int not null check (score_quartier between 0 and 100),
  score_risques int not null check (score_risques between 0 and 100),
  -- Indicateurs financiers
  prix_marche_estime numeric(12, 2),
  ecart_prix_pct numeric(6, 2),
  loyer_estime numeric(10, 2),
  loyer_m2_estime numeric(8, 2),
  rendement_brut_pct numeric(6, 2),
  rendement_net_pct numeric(6, 2),
  rendement_net_net_pct numeric(6, 2),
  cashflow_mensuel numeric(10, 2),
  mensualite_credit numeric(10, 2),
  frais_notaire numeric(10, 2),
  cout_total_acquisition numeric(12, 2),
  -- Risques
  is_passoire_dpe boolean default false,
  risque_climat_2025 boolean default false,
  risque_climat_2028 boolean default false,
  risque_climat_2034 boolean default false,
  -- Contenu Claude (premium uniquement)
  these_claude text,
  financement_claude text,
  negociation_claude text,
  prix_negociation_cible numeric(12, 2),
  verdict verdict_type,
  -- Métadonnées
  scoring_version text not null default 'v1.0',
  claude_model text,
  claude_tokens_used int,
  created_at timestamptz not null default now()
);

create index listing_scores_analysis_id_score_idx on listing_scores(analysis_id, score_total desc);

alter table listing_scores enable row level security;

create policy "listing_scores_no_direct_read" on listing_scores
  for select using (false);

-- ─── VUE FREEMIUM ───
-- C'est ICI que le teasing est implémenté côté serveur.
-- Le frontend interroge UNIQUEMENT cette vue, jamais listings ni listing_scores.
-- Free user : adresses, liens, lat/lng, prix exact et thèse masqués pour biens >70.
create or replace view listings_freemium_view
with (security_invoker = true)
as
select
  l.id,
  l.analysis_id,
  l.external_id,
  l.source_site,
  l.title,
  l.description,
  l.type,
  l.surface,
  l.pieces,
  l.chambres,
  l.code_postal,
  l.ville,
  l.dpe,
  l.ges,
  l.etage,
  l.balcon,
  l.terrasse,
  l.parking,
  l.cave,
  l.ascenseur,
  l.charges_copro_annuelles,
  l.taxe_fonciere,
  l.annee_construction,
  l.is_exclusive,
  l.is_new_construction,
  l.published_at,
  l.scraped_at,
  -- Score toujours visible (c'est le teasing)
  ls.score_total,
  ls.score_prix,
  ls.score_rendement,
  ls.score_cashflow,
  ls.score_dpe,
  ls.score_quartier,
  ls.score_risques,
  ls.is_passoire_dpe,
  ls.verdict,
  -- Champs FLOUTÉS si user free ET score > 70
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.prix else null end as prix,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.adresse_raw else null end as adresse_raw,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.adresse_geocoded else null end as adresse_geocoded,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.source_url else null end as source_url,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.lat else null end as lat,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.lng else null end as lng,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then l.photos_urls else null end as photos_urls,
  -- Indicateurs financiers : visibles pour <=70, masqués sinon
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then ls.prix_marche_estime else null end as prix_marche_estime,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then ls.ecart_prix_pct else null end as ecart_prix_pct,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then ls.loyer_estime else null end as loyer_estime,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then ls.rendement_brut_pct else null end as rendement_brut_pct,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then ls.rendement_net_pct else null end as rendement_net_pct,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70
       then ls.cashflow_mensuel else null end as cashflow_mensuel,
  -- Contenu Claude : premium uniquement (toujours masqué pour free, même si <=70 c'est bonus)
  case when is_user_paid() then ls.these_claude else null end as these_claude,
  case when is_user_paid() then ls.financement_claude else null end as financement_claude,
  case when is_user_paid() then ls.negociation_claude else null end as negociation_claude,
  case when is_user_paid() then ls.prix_negociation_cible else null end as prix_negociation_cible,
  -- Flag pour le frontend (afficher CTA upgrade ou pas)
  (not is_user_paid() and coalesce(ls.score_total, 0) > 70) as is_masked
from listings l
left join listing_scores ls on ls.listing_id = l.id
where exists (
  -- L'utilisateur ne voit que les listings de SES analyses
  select 1 from analyses a
  where a.id = l.analysis_id and a.profile_id = auth.uid()
);

comment on view listings_freemium_view is
  'Vue avec freemium teasing côté serveur. Le frontend ne doit JAMAIS interroger listings ou listing_scores directement.';

-- ─── Table : watches ───
-- Recherches sauvegardées avec alertes.
create table watches (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  source_url text not null,
  source_site listing_source not null,
  frequency watch_frequency not null default 'weekly',
  score_threshold int not null default 70 check (score_threshold between 0 and 100),
  is_active boolean not null default true,
  -- Notifs
  notify_email boolean not null default true,
  notify_push boolean not null default false,
  notify_telegram boolean not null default false,
  -- Cron state
  last_run_at timestamptz,
  next_run_at timestamptz not null default now(),
  last_analysis_id uuid references analyses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger watches_updated_at before update on watches
  for each row execute function set_updated_at();

create index watches_next_run_idx on watches(next_run_at) where is_active = true;
create index watches_profile_id_idx on watches(profile_id);

alter table watches enable row level security;

create policy "watches_select_own" on watches
  for select using (auth.uid() = profile_id);

create policy "watches_insert_own" on watches
  for insert with check (auth.uid() = profile_id);

create policy "watches_update_own" on watches
  for update using (auth.uid() = profile_id);

create policy "watches_delete_own" on watches
  for delete using (auth.uid() = profile_id);

-- ─── Table : pipeline_items ───
-- Kanban personnel : à visiter / visité / offre / compromis / signé.
create table pipeline_items (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  -- Snapshot des données du listing au moment de l'épinglage
  -- (au cas où le bien serait retiré)
  listing_snapshot jsonb not null,
  stage pipeline_stage not null default 'a_visiter',
  position int not null default 0,
  notes text,
  -- Visite et offre
  visite_date date,
  offre_price numeric(12, 2),
  compromis_date date,
  signe_date date,
  -- Photos perso
  photos text[],
  -- Paramètres ajustés post-visite (re-simulation)
  adjusted_params jsonb,
  -- Si bien retiré
  delisted_at timestamptz,
  delisted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pipeline_items_updated_at before update on pipeline_items
  for each row execute function set_updated_at();

create index pipeline_items_profile_stage_idx on pipeline_items(profile_id, stage, position);

alter table pipeline_items enable row level security;

create policy "pipeline_items_select_own" on pipeline_items
  for select using (auth.uid() = profile_id);

create policy "pipeline_items_insert_own" on pipeline_items
  for insert with check (auth.uid() = profile_id);

create policy "pipeline_items_update_own" on pipeline_items
  for update using (auth.uid() = profile_id);

create policy "pipeline_items_delete_own" on pipeline_items
  for delete using (auth.uid() = profile_id);

-- ─── Table : subscriptions ───
-- Miroir des abonnements Stripe. Écrit par le webhook Stripe (service_role).
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan subscription_plan not null,
  status subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create index subscriptions_profile_id_idx on subscriptions(profile_id);
create index subscriptions_status_idx on subscriptions(status) where status in ('active', 'trialing');

alter table subscriptions enable row level security;

create policy "subscriptions_select_own" on subscriptions
  for select using (auth.uid() = profile_id);

-- Pas d'insert/update/delete côté client — uniquement via webhook Stripe (service_role)

-- ─── Quotas mensuels (consultation rapide) ───
-- Compte les analyses du mois courant pour faire respecter les plafonds plan.
create or replace function current_month_analyses_count(p_profile_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from analyses
  where profile_id = p_profile_id
    and created_at >= date_trunc('month', now())
    and status not in ('failed');
$$;

-- ────────────────────────────────────────────────────────────────────
-- ROLLBACK (à appliquer manuellement en cas de besoin)
-- ────────────────────────────────────────────────────────────────────
-- drop function if exists current_month_analyses_count(uuid);
-- drop table if exists subscriptions cascade;
-- drop table if exists pipeline_items cascade;
-- drop table if exists watches cascade;
-- drop view if exists listings_freemium_view cascade;
-- drop table if exists listing_scores cascade;
-- drop table if exists listings cascade;
-- drop table if exists analyses cascade;
-- drop table if exists user_params cascade;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists handle_new_user();
-- drop table if exists profiles cascade;
-- drop function if exists is_user_paid();
-- drop function if exists current_user_plan();
-- drop function if exists set_updated_at();
-- drop type if exists watch_frequency;
-- drop type if exists pipeline_stage;
-- drop type if exists verdict_type;
-- drop type if exists bien_type;
-- drop type if exists listing_source;
-- drop type if exists analysis_status;
-- drop type if exists travaux_tolerance;
-- drop type if exists strategy_type;
-- drop type if exists subscription_status;
-- drop type if exists subscription_plan;
