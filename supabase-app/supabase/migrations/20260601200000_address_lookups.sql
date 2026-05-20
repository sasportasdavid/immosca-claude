-- Module "Adresse à partir d'un lien" — table de stockage des résolutions
-- d'adresses à partir d'URLs d'annonces (LBC/PAP/SeLoger/Bien'ici).
--
-- Workflow :
--   1. User colle une URL → edge fn `resolve-address` check cache
--   2. Si miss : insert row pending, trigger worker task resolveAddress
--   3. Worker scrape l'URL, query ADEME + BAN, met à jour la row
--   4. Frontend poll la row, affiche le résultat
--
-- Le `url_hash` (SHA-256 hex) sert d'index de cache. On retrouve les
-- résolutions précédentes en <1ms si elles ne sont pas expirées.

CREATE TABLE IF NOT EXISTS public.address_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Input
  url text NOT NULL,
  -- SHA-256 hex de l'URL normalisée (lowercase, trim trailing slash)
  -- pour matcher le cache même si l'user retape l'URL légèrement différemment.
  url_hash text NOT NULL,
  source_site listing_source,

  -- Workflow status
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed')),

  -- Résultat enrichi
  address text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  city text,
  postal_code text,
  -- Source de la résolution : 'ademe' | 'ban_reverse' | 'scraped' | 'none'
  resolution_source text,
  -- 0-1 (score_ban d'ADEME quand applicable, sinon heuristique)
  confidence numeric(3, 2),

  -- Métadonnées listing (utile pour afficher des infos contextuelles)
  listing_title text,
  listing_price numeric,
  listing_surface numeric,
  listing_dpe text CHECK (listing_dpe IS NULL OR listing_dpe IN ('A','B','C','D','E','F','G')),

  -- Plomberie
  trigger_run_id text,
  apify_run_id text,
  error_message text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  -- Cache TTL : 7 jours par défaut
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Index pour cache hit rapide (par url_hash, sur les rows pas expirées)
CREATE INDEX address_lookups_url_hash_idx
  ON public.address_lookups (url_hash)
  WHERE status = 'done';

-- Index pour la liste user (historique perso)
CREATE INDEX address_lookups_profile_created_idx
  ON public.address_lookups (profile_id, created_at DESC);

-- Index pour le rate limit (count par jour par user)
CREATE INDEX address_lookups_profile_day_idx
  ON public.address_lookups (profile_id, created_at);

-- RLS — chaque user voit/insère ses propres rows
ALTER TABLE public.address_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY address_lookups_select_own ON public.address_lookups
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY address_lookups_insert_own ON public.address_lookups
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- service_role bypass RLS automatiquement (utilisé par le worker pour
-- update les rows en cours de traitement).

GRANT SELECT, INSERT ON public.address_lookups TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- RPC `can_lookup_address` : vérifie le rate limit avant d'autoriser
-- une nouvelle résolution.
--
-- Plan Free : 5 lookups/jour glissant (24h)
-- Plan Pro / Pro+ / Business : illimité
--
-- Retourne { allowed: bool, remaining: int|null, reason: text|null }
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_lookup_address(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan subscription_plan;
  v_count int;
  v_limit_free constant int := 5;
BEGIN
  SELECT subscription_plan INTO v_plan
  FROM profiles WHERE id = p_profile_id;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reason', 'profil inconnu'
    );
  END IF;

  -- Plans payants : illimité
  IF v_plan <> 'free' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', NULL,
      'reason', NULL
    );
  END IF;

  -- Free : compte des lookups des dernières 24h (toutes status,
  -- même failed, pour éviter de farmer en faisant échouer exprès)
  SELECT COUNT(*) INTO v_count
  FROM address_lookups
  WHERE profile_id = p_profile_id
    AND created_at > now() - interval '24 hours';

  IF v_count >= v_limit_free THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reason', format('limite Free %s/jour atteinte', v_limit_free)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_limit_free - v_count,
    'reason', NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_lookup_address(uuid) TO authenticated, service_role;

-- rollback:
-- DROP FUNCTION IF EXISTS public.can_lookup_address(uuid);
-- DROP TABLE IF EXISTS public.address_lookups CASCADE;
