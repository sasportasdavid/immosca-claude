-- Seed PR5 : données référentielles minimales pour Gagny (93220 / 93032).
--
-- Permet de valider le pipeline scoring + Claude avec des chiffres
-- réalistes sans avoir à attendre l'import bulk DVF/INSEE/OLL.
--
-- Loyers €/m² mensuel basés sur OLL IDF couronne Est 2024.
-- Géorisques basés sur fiche Géorisques Gagny (PPRI Marne, argile moyen).
--
-- En PR5.1 (ou plus tard), un job Trigger.dev déclenchera l'import bulk
-- pour toute la France et écrasera/complétera ces seeds avec les
-- vraies valeurs OLL.

INSERT INTO public.oll_loyers_medians
  (annee, code_zonage_oll, nom_zonage, region, type_logement, nombre_pieces, loyer_m2_median, nb_observations)
VALUES
  (2024, '93032', 'Gagny', 'Ile-de-France', 'appartement', '1', 17.0, 80),
  (2024, '93032', 'Gagny', 'Ile-de-France', 'appartement', '2', 14.5, 150),
  (2024, '93032', 'Gagny', 'Ile-de-France', 'appartement', '3', 13.0, 130),
  (2024, '93032', 'Gagny', 'Ile-de-France', 'appartement', '4_plus', 12.0, 90),
  (2024, '93032', 'Gagny', 'Ile-de-France', 'maison', '3', 13.5, 40),
  (2024, '93032', 'Gagny', 'Ile-de-France', 'maison', '4_plus', 12.0, 60)
ON CONFLICT (annee, code_zonage_oll, type_logement, nombre_pieces, epoque_construction) DO NOTHING;

INSERT INTO public.georisques_communes
  (code_commune, nom_commune, has_ppri, ppri_count, retrait_argile_niveau,
   sismicite, radon, sites_basol_count, sites_basias_count,
   has_ppr_mouvement_terrain, has_ppr_feu_foret, has_ppr_avalanche)
VALUES
  ('93032', 'Gagny', true, 1, 'moyen', 1, 1, 0, 8, false, false, false)
ON CONFLICT (code_commune) DO UPDATE SET
  has_ppri = EXCLUDED.has_ppri,
  retrait_argile_niveau = EXCLUDED.retrait_argile_niveau,
  updated_at = now();

-- rollback:
-- DELETE FROM public.oll_loyers_medians WHERE code_zonage_oll = '93032';
-- DELETE FROM public.georisques_communes WHERE code_commune = '93032';
