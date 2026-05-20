-- Seed PR5 100% : mutations DVF synthétiques pour Gagny (93032).
--
-- 30 appartements + 30 maisons calibrés sur les médianes connues
-- (4192 €/m² appart, 3407 €/m² maison — CLAUDE.md §9). Permet à la
-- materialized view `dvf_medians_commune` de retourner des valeurs
-- pour Gagny et débloque le score_prix dans le worker scoring.
--
-- À remplacer par un vrai import bulk DVF France entière en PR5.1
-- (task `imports.dvf` existante). Ce seed est un fallback test
-- garantissant que le pipeline scoring complet (DVF + OLL + Géorisques)
-- tourne dès qu'on déploie sans dépendre de l'import bulk asynchrone.

INSERT INTO public.dvf_mutations
  (id_mutation, date_mutation, nature_mutation, valeur_fonciere, code_postal,
   code_commune, nom_commune, code_departement, type_local, surface_reelle_bati,
   nombre_pieces_principales, millesime_dvf)
SELECT
  'seed-gagny-app-' || i,
  ('2024-' || LPAD((1 + (i % 12))::text, 2, '0') || '-15')::date,
  'Vente',
  ROUND(surface * (4192 + ((i * 137) % 1200 - 600))),
  '93220', '93032', 'Gagny', '93', 'Appartement',
  surface,
  CASE WHEN surface < 35 THEN 1
       WHEN surface < 50 THEN 2
       WHEN surface < 75 THEN 3
       ELSE 4 END,
  '2024'
FROM generate_series(1, 30) AS i,
     LATERAL (SELECT (25 + (i * 7) % 75)::numeric AS surface) s
ON CONFLICT (id_mutation) DO NOTHING;

INSERT INTO public.dvf_mutations
  (id_mutation, date_mutation, nature_mutation, valeur_fonciere, code_postal,
   code_commune, nom_commune, code_departement, type_local, surface_reelle_bati,
   nombre_pieces_principales, surface_terrain, millesime_dvf)
SELECT
  'seed-gagny-maison-' || i,
  ('2024-' || LPAD((1 + (i % 12))::text, 2, '0') || '-15')::date,
  'Vente',
  ROUND(surface * (3407 + ((i * 211) % 1000 - 500))),
  '93220', '93032', 'Gagny', '93', 'Maison',
  surface,
  CASE WHEN surface < 90 THEN 3
       WHEN surface < 130 THEN 4
       WHEN surface < 170 THEN 5
       ELSE 6 END,
  (200 + (i * 17) % 400)::numeric,
  '2024'
FROM generate_series(1, 30) AS i,
     LATERAL (SELECT (65 + (i * 13) % 130)::numeric AS surface) s
ON CONFLICT (id_mutation) DO NOTHING;

-- Refresh les materialized views pour que dvf_medians_commune voie les seeds.
-- Pas CONCURRENTLY ici parce qu'il faut faire un premier refresh sans
-- l'index unique (qui est nécessaire pour CONCURRENTLY après).
REFRESH MATERIALIZED VIEW public.dvf_medians_commune;
REFRESH MATERIALIZED VIEW public.dvf_medians_iris;

-- rollback:
-- DELETE FROM public.dvf_mutations WHERE id_mutation LIKE 'seed-gagny-%';
-- REFRESH MATERIALIZED VIEW public.dvf_medians_commune;
