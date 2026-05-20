-- ────────────────────────────────────────────────────────────────────
-- ImmoValue — Module estimation, suivi et mise en vente
-- ────────────────────────────────────────────────────────────────────
-- Sous-produit pour propriétaires-vendeurs (vs ImmoScan = investisseurs).
-- Auth unifiée (même base Supabase auth.users). Schéma dédié `value`.
--
-- Le freemium / vitrine PAP / mode discret repose sur le principe
-- ImmoScan : anonymisation et masquages côté SERVEUR uniquement,
-- via la vue `value.biens_publics` + fonctions SECURITY DEFINER.
-- Le frontend public interroge UNIQUEMENT cette vue.
-- ────────────────────────────────────────────────────────────────────

-- ─── Extensions ───
-- postgis n'était pas installé sur immoscan-app jusqu'ici (cf list_extensions).
-- ImmoValue introduit le besoin (colonne geom sur value.biens).
create extension if not exists postgis;
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists citext;

-- ─── Schema ───
create schema if not exists value;

-- Donner aux rôles l'accès au schema (par défaut Postgres restreint USAGE).
grant usage on schema value to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- FONCTIONS HELPERS D'ANONYMISATION (déclarées AVANT les tables/vues)
-- Toutes en SECURITY DEFINER + IMMUTABLE (pas d'accès table, calcul pur).
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- value.extract_commune(p_address) — extrait ville + dept
-- Stub V1 : split sur virgules, retourne le dernier segment non vide
-- avec extraction de code postal s'il est présent.
-- ex: "12 rue Voltaire, 93220 Gagny" → "Gagny (93)"
-- ──────────────────────────────────────────────────────────────────
create or replace function value.extract_commune(p_address text)
returns text
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_segments text[];
  v_last text;
  v_cp text;
  v_dept text;
  v_ville text;
begin
  if p_address is null or length(trim(p_address)) = 0 then
    return null;
  end if;

  v_segments := regexp_split_to_array(p_address, '\s*,\s*');
  v_last := trim(v_segments[array_length(v_segments, 1)]);

  -- Extraction "75019" ou "75019 Paris 19e" ou "Gagny 93220"
  v_cp := substring(v_last from '\m(\d{5})\M');
  if v_cp is not null then
    v_dept := substring(v_cp from 1 for 2);
    -- supprime le code postal du segment
    v_ville := trim(regexp_replace(v_last, '\m\d{5}\M', '', 'g'));
    v_ville := trim(regexp_replace(v_ville, '\s+', ' ', 'g'));
    if v_ville is null or v_ville = '' then
      return v_dept;
    end if;
    return v_ville || ' (' || v_dept || ')';
  end if;

  return v_last;
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.extract_arrondissement(p_address) — Paris/Lyon/Marseille
-- ex: "75019 Paris" → "Paris 19e"
-- ──────────────────────────────────────────────────────────────────
create or replace function value.extract_arrondissement(p_address text)
returns text
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cp text;
  v_num int;
begin
  if p_address is null then return null; end if;
  v_cp := substring(p_address from '\m(\d{5})\M');
  if v_cp is null then return value.extract_commune(p_address); end if;

  -- Paris 75001..75020
  if substring(v_cp from 1 for 3) = '750' or substring(v_cp from 1 for 2) = '75' then
    v_num := (substring(v_cp from 4 for 2))::int;
    if v_num between 1 and 20 then
      return 'Paris ' || v_num::text || 'e';
    end if;
  end if;

  -- Lyon 69001..69009
  if substring(v_cp from 1 for 3) = '690' then
    v_num := (substring(v_cp from 4 for 2))::int;
    if v_num between 1 and 9 then
      return 'Lyon ' || v_num::text || 'e';
    end if;
  end if;

  -- Marseille 13001..13016
  if substring(v_cp from 1 for 3) = '130' or substring(v_cp from 1 for 3) = '131' then
    v_num := (substring(v_cp from 4 for 2))::int;
    if v_num between 1 and 16 then
      return 'Marseille ' || v_num::text || 'e';
    end if;
  end if;

  return value.extract_commune(p_address);
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.format_iris_label(p_address) — étiquette quartier IRIS
-- Stub V1 : retourne la commune. V2 fera un lookup table IRIS
-- pour transformer "12 rue Voltaire, 93220 Gagny" → "Le Chénay, Gagny (93)".
-- ──────────────────────────────────────────────────────────────────
create or replace function value.format_iris_label(p_address text)
returns text
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
begin
  -- V1 stub : équivalent à extract_commune
  -- TODO V2 : joindre sur immoscan-data.insee_iris pour récupérer
  -- le nom du quartier via le code_iris du bien.
  return value.extract_commune(p_address);
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.snap_to_iris_centroid_lat / _lng — arrondir à ~500m
-- V1 : arrondi à 0.005 décimaux (≈ 500-550m de granularité).
-- V2 : lookup table insee_iris.centroid_lat dans immoscan-data.
-- ──────────────────────────────────────────────────────────────────
create or replace function value.snap_to_iris_centroid_lat(
  p_lat numeric,
  p_lng numeric,
  p_code_iris text
) returns numeric
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_lat is null then return null; end if;
  -- arrondi à 0.005 (≈ 500m en France métropolitaine)
  return round(p_lat / 0.005) * 0.005;
end;
$$;

create or replace function value.snap_to_iris_centroid_lng(
  p_lat numeric,
  p_lng numeric,
  p_code_iris text
) returns numeric
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_lng is null then return null; end if;
  return round(p_lng / 0.005) * 0.005;
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.bucket_surface(v_surface) — fourchette de surface
-- 0-30 / 30-40 / 40-50 / 50-60 / 60-70 / ... / 200-300 / >300
-- ──────────────────────────────────────────────────────────────────
create or replace function value.bucket_surface(p_surface numeric)
returns text
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v int;
  v_low int;
  v_high int;
begin
  if p_surface is null then return null; end if;
  v := floor(p_surface)::int;

  if v < 30 then return '<30m²'; end if;
  if v >= 300 then return '>300m²'; end if;

  if v < 100 then
    -- pas de 10 entre 30 et 100
    v_low := (v / 10) * 10;
    v_high := v_low + 10;
  elsif v < 200 then
    -- pas de 20 entre 100 et 200
    v_low := ((v - 100) / 20) * 20 + 100;
    v_high := v_low + 20;
  else
    -- pas de 50 entre 200 et 300
    v_low := ((v - 200) / 50) * 50 + 200;
    v_high := v_low + 50;
  end if;

  return v_low::text || '-' || v_high::text || 'm²';
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.bucket_etage(p_etage) — fourchette d'étage
-- 0 = RDC, 1 = 1er, 2-4 = "2e à 4e", 5-9 = "5e à 9e", >=10 = "≥10e"
-- ──────────────────────────────────────────────────────────────────
create or replace function value.bucket_etage(p_etage int)
returns text
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_etage is null then return null; end if;
  if p_etage <= 0 then return 'RDC'; end if;
  if p_etage = 1 then return '1er'; end if;
  if p_etage between 2 and 4 then return '2e à 4e'; end if;
  if p_etage between 5 and 9 then return '5e à 9e'; end if;
  return '≥10e';
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.anonymize_address — masquage adresse selon prefs
-- ──────────────────────────────────────────────────────────────────
create or replace function value.anonymize_address(
  p_address text,
  p_settings jsonb
) returns text
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_level text;
begin
  v_level := coalesce(p_settings->>'quartier_displayed', 'iris');

  return case v_level
    when 'iris' then value.format_iris_label(p_address)
    when 'commune' then value.extract_commune(p_address)
    when 'arrondissement' then value.extract_arrondissement(p_address)
    else value.extract_commune(p_address)
  end;
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.anonymize_bien_data — masquage surface / étage selon prefs
-- ──────────────────────────────────────────────────────────────────
create or replace function value.anonymize_bien_data(
  p_bien_data jsonb,
  p_status text,
  p_anon_settings jsonb
) returns jsonb
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_surface numeric;
  v_etage int;
begin
  v_result := coalesce(p_bien_data, '{}'::jsonb);

  -- Public : on retourne tel quel
  if p_status = 'public' then
    return v_result;
  end if;

  -- Mode discret : masquage selon prefs
  if coalesce((p_anon_settings->>'masquer_surface_exacte')::boolean, false) then
    v_surface := (p_bien_data->>'surface_carrez')::numeric;
    if v_surface is not null then
      v_result := v_result || jsonb_build_object(
        'surface_carrez_range', value.bucket_surface(v_surface)
      );
      v_result := v_result - 'surface_carrez';
    end if;
  end if;

  if coalesce((p_anon_settings->>'masquer_etage_exact')::boolean, false) then
    v_etage := (p_bien_data->>'etage')::int;
    if v_etage is not null then
      v_result := v_result || jsonb_build_object(
        'etage_range', value.bucket_etage(v_etage)
      );
      v_result := v_result - 'etage';
    end if;
  end if;

  -- En discret on retire toujours les particularités identifiantes
  v_result := v_result - 'particularites_uniques';

  return v_result;
end;
$$;

-- ──────────────────────────────────────────────────────────────────
-- value.format_valorisation_publique — format simplifié pour vitrine
-- Retourne uniquement une fourchette + confiance (jamais le détail).
-- ──────────────────────────────────────────────────────────────────
create or replace function value.format_valorisation_publique(
  p_valo jsonb,
  p_status text
) returns jsonb
language plpgsql immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_min numeric;
  v_max numeric;
  v_central numeric;
  v_confiance numeric;
begin
  if p_valo is null then return null; end if;

  v_min := (p_valo->>'fourchette_min')::numeric;
  v_max := (p_valo->>'fourchette_max')::numeric;
  v_central := (p_valo->>'estimation_centrale')::numeric;
  v_confiance := (p_valo->>'confiance')::numeric;

  -- Public : on expose fourchette + estimation + confiance, pas le détail
  if p_status = 'public' then
    return jsonb_build_object(
      'fourchette_min', v_min,
      'fourchette_max', v_max,
      'estimation_centrale', v_central,
      'confiance', v_confiance
    );
  end if;

  -- Discret : juste la fourchette (pas l'estimation centrale exacte)
  return jsonb_build_object(
    'fourchette_min', v_min,
    'fourchette_max', v_max,
    'confiance', v_confiance
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.biens (objet pivot)
-- ──────────────────────────────────────────────────────────────────
create table value.biens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'suivi'
    check (status in ('suivi', 'discret', 'public', 'vendu', 'retire')),

  -- Localisation
  address text not null,
  address_hash text not null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  geom geometry(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  code_insee text not null,
  code_iris text not null,

  -- Caractéristiques du bien (Zod-validated côté app)
  bien_data jsonb not null,

  -- Médias
  photos_originales_urls text[] not null default '{}',
  photos_floutees_urls text[] default '{}',

  -- Liens fournis par l'user (3 max) ⭐
  user_provided_urls text[] default '{}'
    check (array_length(user_provided_urls, 1) is null or array_length(user_provided_urls, 1) <= 3),

  -- Valorisation IA
  valo_courante jsonb,
  valo_initiale jsonb,
  valo_updated_at timestamptz,
  valo_confiance numeric(3,2),

  -- Prix affiché par le vendeur
  prix_affiche numeric,
  prix_affiche_updated_at timestamptz,
  prix_history jsonb not null default '[]'::jsonb,

  -- Description publique (mode discret/public)
  description_publique text,
  contact_settings jsonb,

  -- Préférences alertes
  alert_threshold_pct numeric(4,2) not null default 3.0,
  alert_frequency text not null default 'monthly'
    check (alert_frequency in ('never', 'weekly', 'monthly', 'quarterly', 'on_significant_change')),

  -- Anonymisation discret
  anon_settings jsonb not null default '{
    "quartier_displayed": "iris",
    "photos_floutees": true,
    "masquer_etage_exact": false,
    "masquer_surface_exacte": false
  }'::jsonb,

  -- Timestamps état
  published_at timestamptz,
  discret_started_at timestamptz,
  sold_at timestamptz,
  withdrawn_at timestamptz,

  -- Stripe paywall public
  stripe_payment_id text,
  paywall_unlocked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index biens_geom_idx on value.biens using gist(geom);
create index biens_status_visibles_idx on value.biens(status, code_iris)
  where status in ('discret', 'public');
create index biens_user_idx on value.biens(user_id);
create index biens_iris_idx on value.biens(code_iris);

-- updated_at trigger (réutilise set_updated_at du schema public)
create trigger biens_set_updated_at
  before update on value.biens
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.valos_historique
-- ──────────────────────────────────────────────────────────────────
create table value.valos_historique (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references value.biens(id) on delete cascade,
  valo jsonb not null,
  delta_pct numeric(5,2),
  trigger text not null
    check (trigger in ('initial', 'weekly_recompute', 'monthly_recompute',
                       'manual_refresh', 'photo_updated', 'bien_data_updated',
                       'user_links_updated')),
  alert_sent boolean not null default false,
  alert_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index valos_historique_bien_idx on value.valos_historique(bien_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.user_provided_comparables ⭐
-- ──────────────────────────────────────────────────────────────────
create table value.user_provided_comparables (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references value.biens(id) on delete cascade,
  url_source text not null,
  marketplace text not null check (marketplace in ('seloger', 'leboncoin')),
  scraped_at timestamptz not null default now(),
  scraped_count integer not null default 0,
  truncated boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  apify_run_id text
);

create index user_provided_comparables_bien_idx
  on value.user_provided_comparables(bien_id);

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.favoris (acheteurs intéressés)
-- ──────────────────────────────────────────────────────────────────
create table value.favoris (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references value.biens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  favori_type text not null default 'discret'
    check (favori_type in ('discret', 'public')),

  notify_on_public boolean not null default true,
  notify_on_price_drop boolean not null default true,
  notify_on_price_drop_threshold_pct numeric not null default 5,

  buyer_profile_snapshot jsonb,

  added_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  notified_at timestamptz,

  unique(bien_id, user_id)
);

create index favoris_bien_idx on value.favoris(bien_id);
create index favoris_user_idx on value.favoris(user_id);

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.consultation_events (events bruts)
-- ──────────────────────────────────────────────────────────────────
create table value.consultation_events (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references value.biens(id) on delete cascade,

  visitor_hash text not null,
  visitor_user_id uuid references auth.users(id),

  event_type text not null
    check (event_type in ('view', 'long_view', 'favorite_add', 'favorite_remove',
                          'share', 'return_visit', 'photo_carousel_open', 'map_zoom',
                          'contact_intent', 'price_history_view')),

  duree_sec integer,
  source text,

  buyer_profile_snapshot jsonb,

  created_at timestamptz not null default now()
);

create index consultation_events_bien_idx
  on value.consultation_events(bien_id, created_at desc);
create index consultation_events_visitor_idx
  on value.consultation_events(visitor_hash, bien_id);

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.bien_stats (agrégats matérialisés)
-- ──────────────────────────────────────────────────────────────────
create table value.bien_stats (
  bien_id uuid primary key references value.biens(id) on delete cascade,

  vues_total integer not null default 0,
  vues_uniques integer not null default 0,
  vues_7j integer not null default 0,
  vues_30j integer not null default 0,

  favoris_actifs integer not null default 0,
  favoris_total_historique integer not null default 0,

  partages_total integer not null default 0,
  retours_visiteurs integer not null default 0,

  duree_consultation_mediane_sec integer,
  taux_long_view numeric(4,2),

  pct_vues_investisseurs numeric(4,2),
  pct_vues_primo numeric(4,2),
  pct_vues_secundo numeric(4,2),
  score_moyen_acheteurs numeric(4,2),

  trend_vues_7j_vs_30j_pct numeric(5,2),
  trend_favoris_7j numeric(5,2),

  vues_vs_mediane_iris_pct numeric(5,2),
  favoris_vs_mediane_iris_pct numeric(5,2),

  computed_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.contacts (acheteur → vendeur, mode public uniquement)
-- ──────────────────────────────────────────────────────────────────
create table value.contacts (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references value.biens(id),
  acheteur_user_id uuid references auth.users(id),
  acheteur_email citext,
  acheteur_telephone text,
  message text not null,
  vendeur_reply text,
  vendeur_replied_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'read', 'replied', 'archived', 'spam')),
  spam_score numeric(3,2),
  created_at timestamptz not null default now()
);

create index contacts_bien_idx on value.contacts(bien_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────
-- TABLE : value.packs_annonces (pack à publier ailleurs, payant)
-- ──────────────────────────────────────────────────────────────────
create table value.packs_annonces (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references value.biens(id),
  user_id uuid not null references auth.users(id),
  targets text[] not null,
  content jsonb not null,
  stripe_payment_id text,
  generated_at timestamptz not null default now(),
  downloaded_at timestamptz
);

create index packs_annonces_user_idx on value.packs_annonces(user_id);
create index packs_annonces_bien_idx on value.packs_annonces(bien_id);

-- ════════════════════════════════════════════════════════════════════
-- VUE : value.biens_publics (vitrine PAP — anonymisation côté SERVEUR)
-- ════════════════════════════════════════════════════════════════════
-- security_invoker = off  (mode DEFINER, cf pattern listings_freemium_view)
-- → la vue tourne avec les droits du créateur (postgres) et bypass RLS
--   sur value.biens, mais le WHERE status in ('discret','public') restreint
--   à ce qui est volontairement publié par le propriétaire.
create or replace view value.biens_publics
with (security_invoker = off)
as
select
  b.id,
  b.status,

  case
    when b.status = 'discret' then value.anonymize_address(b.address, b.anon_settings)
    when b.status = 'public'  then b.address
  end as address_display,

  case
    when b.status = 'discret' then value.snap_to_iris_centroid_lat(b.lat, b.lng, b.code_iris)
    when b.status = 'public'  then b.lat
  end as lat_display,

  case
    when b.status = 'discret' then value.snap_to_iris_centroid_lng(b.lat, b.lng, b.code_iris)
    when b.status = 'public'  then b.lng
  end as lng_display,

  b.code_iris,
  b.code_insee,

  value.anonymize_bien_data(b.bien_data, b.status, b.anon_settings) as bien_data,

  case
    when b.status = 'discret' then b.photos_floutees_urls
    when b.status = 'public'  then b.photos_originales_urls
  end as photos,

  -- prix_affiche en discret est masqué (fourchette de valo à la place)
  case
    when b.status = 'public' then b.prix_affiche
    else null
  end as prix_affiche,

  value.format_valorisation_publique(b.valo_courante, b.status) as valorisation_publique,
  b.description_publique,

  bs.favoris_actifs,
  bs.vues_total,
  bs.vues_7j,

  b.discret_started_at,
  b.published_at
from value.biens b
left join value.bien_stats bs on bs.bien_id = b.id
where b.status in ('discret', 'public');

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════

alter table value.biens enable row level security;
alter table value.valos_historique enable row level security;
alter table value.user_provided_comparables enable row level security;
alter table value.favoris enable row level security;
alter table value.consultation_events enable row level security;
alter table value.bien_stats enable row level security;
alter table value.contacts enable row level security;
alter table value.packs_annonces enable row level security;

-- BIENS : propriétaire CRUD
create policy "biens_owner_all" on value.biens
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- VALOS HISTORIQUE : propriétaire read seulement (worker écrit via service_role)
create policy "valos_historique_owner_read" on value.valos_historique
  for select using (
    bien_id in (select id from value.biens where user_id = auth.uid())
  );

-- USER PROVIDED COMPARABLES : propriétaire read seulement
create policy "user_provided_owner_read" on value.user_provided_comparables
  for select using (
    bien_id in (select id from value.biens where user_id = auth.uid())
  );

-- FAVORIS : utilisateur CRUD ses propres favoris
create policy "favoris_owner_all" on value.favoris
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- BIEN STATS : propriétaire read seulement
create policy "bien_stats_owner_read" on value.bien_stats
  for select using (
    bien_id in (select id from value.biens where user_id = auth.uid())
  );

-- CONSULTATION EVENTS : aucune policy → seul service_role écrit/lit
-- (RLS activée + aucune policy = deny all pour authenticated/anon).

-- CONTACTS : vendeur read+update, acheteur read sur ses propres contacts
create policy "contacts_vendeur_read" on value.contacts
  for select using (
    bien_id in (select id from value.biens where user_id = auth.uid())
  );

create policy "contacts_vendeur_update" on value.contacts
  for update using (
    bien_id in (select id from value.biens where user_id = auth.uid())
  );

create policy "contacts_acheteur_read" on value.contacts
  for select using (acheteur_user_id = auth.uid());

-- PACKS ANNONCES : propriétaire only
create policy "packs_annonces_owner_all" on value.packs_annonces
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- GRANTS EXPLICITES
-- ════════════════════════════════════════════════════════════════════
-- ⚠️ Sans GRANT, même avec RLS en place, authenticated obtient
-- "permission denied for table ..." (cf feedback MEMORY user).
-- service_role a déjà ALL via les defaults Supabase, mais on l'explicite
-- pour les workers Trigger.dev.

grant select, insert, update, delete on value.biens to authenticated;
grant select on value.valos_historique to authenticated;
grant select on value.user_provided_comparables to authenticated;
grant select, insert, update, delete on value.favoris to authenticated;
grant select on value.bien_stats to authenticated;
grant select, update on value.contacts to authenticated;
grant insert on value.contacts to authenticated;
grant select, insert, update, delete on value.packs_annonces to authenticated;

-- Service role : all tables (workers Trigger.dev)
grant all on all tables in schema value to service_role;
grant all on all sequences in schema value to service_role;
grant execute on all functions in schema value to service_role;

-- Anonymous (insert d'event de consultation public via Edge Function
-- avec service_role — on n'autorise PAS de grant direct ici).

-- Vue publique : accessible anon + authenticated
grant select on value.biens_publics to anon, authenticated;

-- Fonctions d'anonymisation : execute pour authenticated + anon (utilisées
-- en cascade par la vue — execute déjà bypass via security definer, mais
-- on les rend appelables si besoin par d'autres vues plus tard).
grant execute on function value.anonymize_address(text, jsonb) to anon, authenticated, service_role;
grant execute on function value.anonymize_bien_data(jsonb, text, jsonb) to anon, authenticated, service_role;
grant execute on function value.format_valorisation_publique(jsonb, text) to anon, authenticated, service_role;
grant execute on function value.format_iris_label(text) to anon, authenticated, service_role;
grant execute on function value.extract_commune(text) to anon, authenticated, service_role;
grant execute on function value.extract_arrondissement(text) to anon, authenticated, service_role;
grant execute on function value.snap_to_iris_centroid_lat(numeric, numeric, text) to anon, authenticated, service_role;
grant execute on function value.snap_to_iris_centroid_lng(numeric, numeric, text) to anon, authenticated, service_role;
grant execute on function value.bucket_surface(numeric) to anon, authenticated, service_role;
grant execute on function value.bucket_etage(int) to anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────
-- DROP SCHEMA value CASCADE;
-- (postgis extension reste installé — ne pas la droper, d'autres tables
--  futures en dépendront)
-- ────────────────────────────────────────────────────────────────────
