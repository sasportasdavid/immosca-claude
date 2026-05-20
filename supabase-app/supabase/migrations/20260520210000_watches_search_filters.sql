-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-J : watches.search_filters (mode form moderne)
-- ────────────────────────────────────────────────────────────────────
-- Permet à une veille d'utiliser le même mode que `analyses.search_filters`
-- (filtres structurés ville/CP/prix/surface/sources multi-actor) au lieu
-- d'une URL unique.
--
-- Quand `search_filters` est set, le worker watch-scout dispatch sur l'actor
-- multi-source `dltik/pige-immo-fr-scraper` (équivalent du mode "filters" de
-- analyze.ts). Sinon, comportement legacy par site via ACTOR_BY_SITE.
--
-- Cas d'usage : créer une veille depuis une analyse existante (bouton
-- "🔔 Mettre en veille") sans redemander l'URL puisque la recherche est
-- déjà parfaitement définie par les filtres de l'analyse.
-- ────────────────────────────────────────────────────────────────────

alter table watches
  add column if not exists search_filters jsonb;

-- Rend source_url nullable : les watches en mode "filters" n'ont pas d'URL unique.
alter table watches
  alter column source_url drop not null;

comment on column watches.search_filters is
  'Filtres structurés (mode form moderne, équivalent analyses.search_filters). '
  'Quand non null, watch-scout dispatch sur l''actor multi-source dltik. '
  'Mutuellement exclusif avec source_url au sens fonctionnel.';

comment on column watches.source_url is
  'URL de recherche source (mode legacy par site). Null si search_filters set.';

-- Contrainte : au moins l'un des deux doit être présent
alter table watches
  add constraint watches_source_or_filters
  check (source_url is not null or search_filters is not null);

-- ─── Rollback ───
-- alter table watches drop constraint if exists watches_source_or_filters;
-- alter table watches drop column if exists search_filters;
-- alter table watches alter column source_url set not null;
