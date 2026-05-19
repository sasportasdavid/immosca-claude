-- Permet à l'utilisateur d'organiser ses analyses :
-- - is_favorite : étoile, en haut de liste
-- - archived_at : sortir de la vue principale sans supprimer
-- archived_at IS NULL = active, sinon archivée.

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS analyses_profile_archived_idx
  ON public.analyses (profile_id, archived_at, created_at DESC);

-- rollback:
-- DROP INDEX IF EXISTS public.analyses_profile_archived_idx;
-- ALTER TABLE public.analyses DROP COLUMN IF EXISTS is_favorite, DROP COLUMN IF EXISTS archived_at;
