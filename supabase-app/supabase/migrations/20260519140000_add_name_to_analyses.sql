-- Permet à l'utilisateur de nommer sa recherche au lieu de la voir
-- comme "Analyse #5da4484c". Indispensable dès la 3ème analyse pour
-- s'y retrouver. Nullable parce que les anciennes analyses n'ont pas
-- de nom — UI affiche un fallback "Analyse #<short_id>".

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS name text;

-- rollback:
-- ALTER TABLE public.analyses DROP COLUMN IF EXISTS name;
