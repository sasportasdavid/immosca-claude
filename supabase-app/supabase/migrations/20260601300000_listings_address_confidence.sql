-- Système de score de confiance d'adresse par bien.
-- Permet d'afficher dans le drawer + tableau un badge "Adresse exacte"
-- (vert) vs "Approximation" (orange/rouge) selon comment l'adresse a
-- été obtenue par le pipeline d'enrichissement de analyze.ts.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS resolution_source text
    CHECK (resolution_source IS NULL OR resolution_source IN (
      'ademe',        -- ADEME DPE match → adresse exacte avec numéro
      'ban_forward',  -- BAN forward (adresse scrapée → géocodée)
      'ban_reverse',  -- BAN reverse (GPS scrapé → rue à proximité)
      'scraped',      -- Adresse extraite directement par l'actor (rare)
      'none'          -- Pas d'adresse obtenue, seulement ville+CP
    ));

-- Confiance 0-1 selon source :
--  - ADEME       : 0.85-1.0 (score BAN de l'adresse normalisée)
--  - BAN forward : 0.6-0.95 (depuis le score BAN)
--  - BAN reverse : 0.3-0.7 (rue à proximité, GPS souvent flouté)
--  - Scraped     : 1.0 (l'actor a extrait l'adresse directement)
--  - None        : 0.1 (juste ville+CP)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS address_confidence numeric(3, 2)
    CHECK (address_confidence IS NULL OR (address_confidence >= 0 AND address_confidence <= 1));

-- Recréer la vue freemium en y ajoutant les 2 nouvelles colonnes.
-- On reproduit fidèlement la définition existante (filtre owner via
-- EXISTS, masquage selon plan+score, security_invoker implicite via la
-- jointure auth.uid()).
CREATE OR REPLACE VIEW public.listings_freemium_view AS
SELECT
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
  ls.score_total,
  ls.score_prix,
  ls.score_rendement,
  ls.score_cashflow,
  ls.score_dpe,
  ls.score_quartier,
  ls.score_risques,
  ls.is_passoire_dpe,
  ls.verdict,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.prix ELSE NULL::numeric END AS prix,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.adresse_raw ELSE NULL::text END AS adresse_raw,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.adresse_geocoded ELSE NULL::text END AS adresse_geocoded,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.source_url ELSE NULL::text END AS source_url,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.lat ELSE NULL::numeric END AS lat,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.lng ELSE NULL::numeric END AS lng,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN l.photos_urls ELSE NULL::text[] END AS photos_urls,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN ls.prix_marche_estime ELSE NULL::numeric END AS prix_marche_estime,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN ls.ecart_prix_pct ELSE NULL::numeric END AS ecart_prix_pct,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN ls.loyer_estime ELSE NULL::numeric END AS loyer_estime,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN ls.rendement_brut_pct ELSE NULL::numeric END AS rendement_brut_pct,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN ls.rendement_net_pct ELSE NULL::numeric END AS rendement_net_pct,
  CASE WHEN is_user_paid() OR COALESCE(ls.score_total, 0) <= 70 THEN ls.cashflow_mensuel ELSE NULL::numeric END AS cashflow_mensuel,
  CASE WHEN is_user_paid() THEN ls.these_claude ELSE NULL::text END AS these_claude,
  CASE WHEN is_user_paid() THEN ls.financement_claude ELSE NULL::text END AS financement_claude,
  CASE WHEN is_user_paid() THEN ls.negociation_claude ELSE NULL::text END AS negociation_claude,
  CASE WHEN is_user_paid() THEN ls.prix_negociation_cible ELSE NULL::numeric END AS prix_negociation_cible,
  NOT is_user_paid() AND COALESCE(ls.score_total, 0) > 70 AS is_masked,
  -- Nouveaux : confiance d'adresse (toujours exposés, pas sensibles)
  l.resolution_source,
  l.address_confidence
FROM listings l
LEFT JOIN listing_scores ls ON ls.listing_id = l.id
WHERE EXISTS (
  SELECT 1
  FROM analyses a
  WHERE a.id = l.analysis_id AND a.profile_id = auth.uid()
);

GRANT SELECT ON public.listings_freemium_view TO authenticated;

-- rollback :
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS address_confidence;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS resolution_source;
-- (Puis recréer l'ancienne vue sans ces 2 colonnes.)
