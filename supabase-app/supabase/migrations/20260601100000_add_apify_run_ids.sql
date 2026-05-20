-- Multi-URLs : on lance désormais plusieurs runs Apify par analyse (un
-- par URL collée). Pour pouvoir tous les annuler quand l'user click
-- "Arrêter l'analyse", on track l'ensemble dans un tableau.
--
-- `apify_run_id` (text) est conservé pour compat — il pointe sur le
-- premier run (ou l'unique run du flow legacy). `apify_run_ids` (text[])
-- est la source de vérité pour le flow multi-URLs.

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS apify_run_ids text[] NOT NULL DEFAULT '{}';

-- RPC appelée par le worker depuis `onStart` de chaque run pour pousser
-- le runId dans le tableau dès la création du run (avant de polling).
-- Ainsi, même si l'analyse est annulée avant que le run ne se termine,
-- on a déjà son ID pour pouvoir l'abort côté Apify.
CREATE OR REPLACE FUNCTION public.append_apify_run_id(
  p_analysis_id uuid,
  p_run_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.analyses
  SET apify_run_ids = array_append(coalesce(apify_run_ids, '{}'), p_run_id)
  WHERE id = p_analysis_id;
$$;

-- Seul le worker (service_role) appelle cette RPC. Pas de grant
-- authenticated/anon volontairement — c'est un side-channel pour le
-- backend uniquement.
GRANT EXECUTE ON FUNCTION public.append_apify_run_id(uuid, text)
  TO service_role;

-- rollback:
-- DROP FUNCTION IF EXISTS public.append_apify_run_id(uuid, text);
-- ALTER TABLE public.analyses DROP COLUMN IF EXISTS apify_run_ids;
