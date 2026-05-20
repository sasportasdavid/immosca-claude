-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — Migration 0002 : Cache Apify 2 niveaux
-- ────────────────────────────────────────────────────────────────────
-- PR3 ingestion. Évite de re-scraper systématiquement les mêmes URLs.
-- Niveau 1 : URL de recherche (TTL 24h) — pour qu'un user qui relance
--   sa propre analyse récupère le cache si <24h.
-- Niveau 2 : annonce individuelle (TTL 7j, invalidé si prix change) —
--   pour les veilles qui scannent N URLs au quotidien.
-- ────────────────────────────────────────────────────────────────────

-- ─── Cache URL de recherche ───
create table apify_url_cache (
  url_hash text primary key,             -- sha-like de l'URL normalisée
  source_url text not null,
  source_site listing_source not null,
  apify_run_id text not null,
  total_listings int not null default 0,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index apify_url_cache_expires_idx on apify_url_cache(expires_at);

comment on table apify_url_cache is
  'Cache des résultats de recherche Apify. TTL 24h. Clé = hash(url normalisée).';

-- ─── Cache annonce individuelle ───
create table apify_listing_cache (
  external_id_site text primary key,     -- "seloger:123456" ou "leboncoin:abcdef"
  external_id text not null,
  source_site listing_source not null,
  raw_data jsonb not null,
  prix_at_cache numeric(12, 2) not null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index apify_listing_cache_expires_idx on apify_listing_cache(expires_at);

comment on table apify_listing_cache is
  'Cache des annonces individuelles Apify. TTL 7j, à invalider si prix change.';

-- Pas de RLS : ces 2 tables sont accédées uniquement par le service_role
-- (worker), jamais par les users authentifiés. RLS par défaut deny.
alter table apify_url_cache enable row level security;
alter table apify_listing_cache enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (en commentaire — Bug 0 reminder)
-- ────────────────────────────────────────────────────────────────────
-- drop table if exists apify_listing_cache;
-- drop table if exists apify_url_cache;
