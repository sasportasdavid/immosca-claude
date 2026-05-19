-- Filtres de recherche structurés (format dltik/pige-immo-fr-scraper).
-- Remplace l'usage de `source_url` pour les nouvelles analyses.
-- `source_url` reste compatible avec les anciennes analyses azzouzana.

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS search_filters jsonb;

ALTER TABLE public.analyses
  ALTER COLUMN source_url DROP NOT NULL;

-- rollback:
-- ALTER TABLE public.analyses ALTER COLUMN source_url SET NOT NULL;
-- ALTER TABLE public.analyses DROP COLUMN IF EXISTS search_filters;
