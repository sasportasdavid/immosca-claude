-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — Migration 0001 : Foundation schema for immoscan-data
-- ────────────────────────────────────────────────────────────────────
-- Projet Supabase eu-west-3 (Paris)
-- Référentiels publics : DVF+, INSEE IRIS + Filosofi, ADEME DPE,
-- OLL loyers, encadrement loyers, Géorisques, cache BAN.
-- PAS DE RLS : accessible uniquement par les workers avec service_role.
-- ────────────────────────────────────────────────────────────────────

-- ─── Extensions ───
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ─── Helper updated_at ───
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────
-- DVF+ (Cerema open data)
-- Téléchargement geopackage France entière, ~5M lignes
-- ────────────────────────────────────────────────────────────────────
create table dvf_mutations (
  id_mutation text primary key,
  date_mutation date not null,
  nature_mutation text not null,
  valeur_fonciere numeric(14, 2),
  -- Localisation
  code_postal text,
  code_commune text not null,
  nom_commune text not null,
  code_departement text not null,
  code_iris text,
  -- Bien
  type_local text,
  surface_reelle_bati numeric(10, 2),
  nombre_pieces_principales int,
  surface_terrain numeric(12, 2),
  -- Géoloc
  longitude numeric(10, 7),
  latitude numeric(10, 7),
  geom geometry(Point, 4326),
  -- Métadonnées d'import
  millesime_dvf text not null,
  imported_at timestamptz not null default now()
);

create index dvf_mutations_geom_idx on dvf_mutations using gist(geom);
create index dvf_mutations_commune_type_date_idx
  on dvf_mutations(code_commune, type_local, date_mutation desc);
create index dvf_mutations_iris_idx on dvf_mutations(code_iris);
create index dvf_mutations_date_idx on dvf_mutations(date_mutation desc);

comment on table dvf_mutations is
  'DVF+ Cerema open data, mutations immobilières géolocalisées. Refresh trimestriel.';

-- Vue matérialisée : prix médians par commune × type × année
-- À rafraîchir après chaque import DVF
create materialized view dvf_medians_commune as
select
  code_commune,
  nom_commune,
  type_local,
  date_part('year', date_mutation)::int as annee,
  count(*) as nb_mutations,
  percentile_cont(0.5) within group (order by valeur_fonciere / nullif(surface_reelle_bati, 0)) as median_prix_m2,
  percentile_cont(0.25) within group (order by valeur_fonciere / nullif(surface_reelle_bati, 0)) as q1_prix_m2,
  percentile_cont(0.75) within group (order by valeur_fonciere / nullif(surface_reelle_bati, 0)) as q3_prix_m2
from dvf_mutations
where surface_reelle_bati > 10
  and valeur_fonciere > 10000
  and type_local in ('Maison', 'Appartement')
  and nature_mutation = 'Vente'
group by code_commune, nom_commune, type_local, date_part('year', date_mutation);

create unique index dvf_medians_commune_uidx
  on dvf_medians_commune(code_commune, type_local, annee);

comment on materialized view dvf_medians_commune is
  'Médianes prix au m² par commune × type × année. Refresh: refresh materialized view concurrently dvf_medians_commune;';

-- Idem par IRIS (granularité plus fine pour les grandes villes)
create materialized view dvf_medians_iris as
select
  code_iris,
  type_local,
  date_part('year', date_mutation)::int as annee,
  count(*) as nb_mutations,
  percentile_cont(0.5) within group (order by valeur_fonciere / nullif(surface_reelle_bati, 0)) as median_prix_m2
from dvf_mutations
where surface_reelle_bati > 10
  and valeur_fonciere > 10000
  and code_iris is not null
  and type_local in ('Maison', 'Appartement')
  and nature_mutation = 'Vente'
group by code_iris, type_local, date_part('year', date_mutation);

create unique index dvf_medians_iris_uidx
  on dvf_medians_iris(code_iris, type_local, annee);

-- ────────────────────────────────────────────────────────────────────
-- INSEE — IRIS (géométries) + Filosofi (revenus)
-- ────────────────────────────────────────────────────────────────────
create table insee_iris (
  code_iris text primary key,
  nom_iris text not null,
  code_commune text not null,
  nom_commune text not null,
  code_departement text not null,
  type_iris text, -- H (Habitat), A (Activité), D (Divers), Z (Non typé)
  geom geometry(MultiPolygon, 4326),
  population int,
  imported_at timestamptz not null default now()
);

create index insee_iris_geom_idx on insee_iris using gist(geom);
create index insee_iris_commune_idx on insee_iris(code_commune);

create table insee_filosofi (
  code_iris text not null references insee_iris(code_iris) on delete cascade,
  annee int not null,
  median_revenu_uc numeric(10, 2),
  taux_pauvrete numeric(5, 2),
  part_menages_locataires numeric(5, 2),
  taux_chomage numeric(5, 2),
  primary key (code_iris, annee)
);

comment on table insee_filosofi is
  'INSEE Filosofi par IRIS, refresh annuel.';

-- ────────────────────────────────────────────────────────────────────
-- ADEME DPE (Diagnostic de Performance Énergétique)
-- ~8M de logements, cache local pour éviter de spammer l'API
-- ────────────────────────────────────────────────────────────────────
create table ademe_dpe (
  id uuid primary key default uuid_generate_v4(),
  numero_dpe text not null unique,
  date_etablissement_dpe date,
  date_visite_diagnostiqueur date,
  -- Adresse
  adresse_complete text,
  code_postal text,
  code_insee_commune text,
  nom_commune text,
  -- Bien
  type_batiment text, -- maison, appartement, immeuble
  surface_habitable_logement numeric(8, 2),
  annee_construction int,
  -- DPE
  classe_dpe text check (classe_dpe in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  classe_ges text check (classe_ges in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  consommation_energie_primaire numeric(10, 2),
  emission_ges numeric(10, 2),
  -- Géoloc
  lat numeric(10, 7),
  lng numeric(10, 7),
  geom geometry(Point, 4326),
  cached_at timestamptz not null default now()
);

create index ademe_dpe_geom_idx on ademe_dpe using gist(geom);
create index ademe_dpe_commune_idx on ademe_dpe(code_insee_commune);
create index ademe_dpe_adresse_trgm_idx on ademe_dpe using gin(adresse_complete gin_trgm_ops);

-- ────────────────────────────────────────────────────────────────────
-- Observatoires Locaux des Loyers (OLL) + OLAP
-- ~50 territoires, baux signés réels
-- ────────────────────────────────────────────────────────────────────
create table oll_loyers_medians (
  id uuid primary key default uuid_generate_v4(),
  annee int not null,
  code_zonage_oll text not null,
  nom_zonage text not null,
  region text,
  type_logement text not null check (type_logement in ('appartement', 'maison')),
  nombre_pieces text not null, -- "1", "2", "3", "4+"
  epoque_construction text, -- "avant 1946", "1946-1970", "1971-1990", "après 1990"
  loyer_m2_median numeric(8, 2) not null,
  loyer_m2_q1 numeric(8, 2),
  loyer_m2_q3 numeric(8, 2),
  nb_observations int,
  geom geometry(MultiPolygon, 4326),
  imported_at timestamptz not null default now(),
  unique (annee, code_zonage_oll, type_logement, nombre_pieces, epoque_construction)
);

create index oll_loyers_geom_idx on oll_loyers_medians using gist(geom);
create index oll_loyers_zonage_idx on oll_loyers_medians(code_zonage_oll, annee);

-- ────────────────────────────────────────────────────────────────────
-- Encadrement des loyers (Paris, Lille, Lyon, Bordeaux, Montpellier...)
-- Arrêtés préfectoraux, refresh à chaque arrêté
-- ────────────────────────────────────────────────────────────────────
create table encadrement_loyers (
  id uuid primary key default uuid_generate_v4(),
  ville text not null,
  annee int not null,
  arrete_date date not null,
  -- Découpage
  id_secteur text not null,
  nom_secteur text,
  geom geometry(MultiPolygon, 4326),
  -- Critères
  type_location text not null check (type_location in ('meuble', 'non_meuble')),
  epoque_construction text not null,
  nombre_pieces text not null,
  -- Loyers
  loyer_reference numeric(8, 2) not null,
  loyer_reference_majore numeric(8, 2) not null,
  loyer_reference_minore numeric(8, 2) not null,
  imported_at timestamptz not null default now(),
  unique (ville, annee, id_secteur, type_location, epoque_construction, nombre_pieces)
);

create index encadrement_geom_idx on encadrement_loyers using gist(geom);
create index encadrement_ville_annee_idx on encadrement_loyers(ville, annee);

-- ────────────────────────────────────────────────────────────────────
-- Géorisques (API gouvernementale)
-- ────────────────────────────────────────────────────────────────────
create table georisques_communes (
  code_commune text primary key,
  nom_commune text not null,
  -- PPRI (Plans de Prévention des Risques d'Inondation)
  has_ppri boolean default false,
  ppri_count int default 0,
  -- Argiles (retrait-gonflement)
  retrait_argile_niveau text check (retrait_argile_niveau in ('nul', 'faible', 'moyen', 'fort')),
  -- Sismicité (1 à 5)
  sismicite int check (sismicite between 1 and 5),
  -- Radon (1 à 3)
  radon int check (radon between 1 and 3),
  -- Sites pollués
  sites_basol_count int default 0,
  sites_basias_count int default 0,
  -- Autres risques
  has_ppr_mouvement_terrain boolean default false,
  has_ppr_feu_foret boolean default false,
  has_ppr_avalanche boolean default false,
  -- Raw JSON pour les détails
  raw_data jsonb,
  updated_at timestamptz not null default now()
);

create trigger georisques_communes_updated_at before update on georisques_communes
  for each row execute function set_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- Cache géocodage BAN (Base Adresse Nationale)
-- ────────────────────────────────────────────────────────────────────
create table ban_addresses_cache (
  adresse_query text primary key,
  result_label text,
  result_score numeric(4, 3),
  housenumber text,
  street text,
  postcode text,
  city text,
  citycode text,
  context text,
  type_result text, -- housenumber, street, locality, municipality
  lat numeric(10, 7),
  lng numeric(10, 7),
  geom geometry(Point, 4326),
  cached_at timestamptz not null default now()
);

create index ban_cache_geom_idx on ban_addresses_cache using gist(geom);
create index ban_cache_postcode_idx on ban_addresses_cache(postcode);
create index ban_cache_cached_at_idx on ban_addresses_cache(cached_at);

-- TTL : on considère un cache valide 90 jours
comment on table ban_addresses_cache is
  'Cache BAN. TTL 90 jours, à purger via cron.';

-- ────────────────────────────────────────────────────────────────────
-- Éducation Nationale — IPS par établissement
-- (data.education.gouv.fr — refresh annuel)
-- ────────────────────────────────────────────────────────────────────
create table education_etablissements (
  id text primary key, -- UAI
  nom_etablissement text not null,
  type_etablissement text not null, -- ecole, college, lycee
  secteur text, -- public, prive
  code_postal text,
  code_commune text,
  adresse text,
  ips numeric(5, 2), -- Indice de Position Sociale
  ips_annee int,
  lat numeric(10, 7),
  lng numeric(10, 7),
  geom geometry(Point, 4326),
  imported_at timestamptz not null default now()
);

create index education_geom_idx on education_etablissements using gist(geom);
create index education_commune_idx on education_etablissements(code_commune);

-- ────────────────────────────────────────────────────────────────────
-- Taux de crédit (Banque de France, refresh mensuel)
-- ────────────────────────────────────────────────────────────────────
create table credit_rates_history (
  id uuid primary key default uuid_generate_v4(),
  date_publication date not null,
  duree_ans int not null,
  taux_moyen_pct numeric(5, 3) not null,
  source text not null default 'banque_de_france',
  imported_at timestamptz not null default now(),
  unique (date_publication, duree_ans, source)
);

create index credit_rates_date_idx on credit_rates_history(date_publication desc);

-- ────────────────────────────────────────────────────────────────────
-- Métadonnées d'import (suivi des refresh)
-- ────────────────────────────────────────────────────────────────────
create table import_runs (
  id uuid primary key default uuid_generate_v4(),
  source text not null, -- dvf, insee_iris, ademe, oll, encadrement, georisques, education, banque_de_france
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_imported int,
  error_message text,
  metadata jsonb
);

create index import_runs_source_started_idx on import_runs(source, started_at desc);

-- ────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────
-- drop table if exists import_runs cascade;
-- drop table if exists credit_rates_history cascade;
-- drop table if exists education_etablissements cascade;
-- drop table if exists ban_addresses_cache cascade;
-- drop table if exists georisques_communes cascade;
-- drop table if exists encadrement_loyers cascade;
-- drop table if exists oll_loyers_medians cascade;
-- drop table if exists ademe_dpe cascade;
-- drop table if exists insee_filosofi cascade;
-- drop table if exists insee_iris cascade;
-- drop materialized view if exists dvf_medians_iris;
-- drop materialized view if exists dvf_medians_commune;
-- drop table if exists dvf_mutations cascade;
-- drop function if exists set_updated_at();
-- drop extension if exists pg_trgm;
-- drop extension if exists postgis;
