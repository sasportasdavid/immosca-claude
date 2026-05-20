# Runbook — Imports bulk données immoscan-data

> Quand la valorisation ImmoValue est cassée à cause de données manquantes
> hors Gagny, c'est ici que ça se règle.

## Pré-requis (à faire une fois)

1. **Worker Trigger.dev** déployé : `cd apps/worker && npx trigger.dev@latest deploy --env prod`
2. **Env vars** dans Trigger.dev cloud → Project Settings → Environment variables :
   ```
   SUPABASE_DATA_URL=https://riihwfenotjdnwrimlet.supabase.co
   SUPABASE_DATA_SERVICE_ROLE_KEY=eyJ...   # ⚠️ service_role, pas anon
   APIFY_TOKEN=apify_api_...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. **Trigger CLI** authentifié localement : `npx trigger.dev@latest login`

## Lancer les imports manuellement

Chaque commande est indépendante. Ordre conseillé pour ne pas charger
trop la DB en même temps : DVF → Filosofi → IRIS → OLL → Géorisques →
Education.

### 1. DVF+ France (~1.5M lignes / millésime, ~10 min)

```bash
# Année courante (millésime annuel) — relancer chaque trimestre
npx trigger.dev@latest trigger \
  --task imports.dvf \
  --env prod \
  --payload '{"millesime": 2024}'

# Si tu veux 5 ans d'historique, relance pour 2020-2023 :
for y in 2020 2021 2022 2023; do
  npx trigger.dev@latest trigger --task imports.dvf --env prod \
    --payload "{\"millesime\": $y}"
done
```

### 2. INSEE IRIS géoms (~50k IRIS, ~5 min)

```bash
npx trigger.dev@latest trigger \
  --task imports.insee_iris \
  --env prod \
  --payload '{"geojsonUrl": "https://files.opendatarchives.fr/professionnels.ign.fr/contoursiris/contours-iris-2024.geojson", "millesime": 2024}'
```

### 3. INSEE Filosofi par IRIS (~50k rows, ~3 min)

```bash
npx trigger.dev@latest trigger \
  --task imports.insee_filosofi \
  --env prod \
  --payload '{"csvUrl": "https://www.insee.fr/fr/statistiques/fichier/<id>/filosofi_iris.csv", "millesime": 2024}'
```

> ⚠️ URL Filosofi à vérifier — INSEE change parfois le path. Aller sur
> https://www.insee.fr/fr/statistiques/series/103296051 pour la dernière
> publication.

### 4. OLL loyers signés (~10k rows, ~2 min)

```bash
npx trigger.dev@latest trigger \
  --task imports.oll_loyers \
  --env prod \
  --payload '{"csvUrl": "https://www.data.gouv.fr/fr/datasets/r/<resource-id>", "millesime": 2024}'
```

> URL exacte à récupérer ici :
> https://www.data.gouv.fr/fr/datasets/resultats-de-lobservation-des-loyers-2024/

### 5. Géorisques (par commune — N=35k communes France, ~30 min)

```bash
# Import toutes les communes (long mais une seule fois par an)
npx trigger.dev@latest trigger \
  --task imports.georisques.all \
  --env prod

# OU import 1 seule commune (test ou patch ponctuel)
npx trigger.dev@latest trigger \
  --task imports.georisques.commune \
  --env prod \
  --payload '{"codeCommune": "93032"}'
```

### 6. Annuaire éducation + IPS (~70k établissements, ~10 min)

```bash
# Étape A : Annuaire (référentiel des écoles/collèges/lycées avec coords)
npx trigger.dev@latest trigger \
  --task imports.education_annuaire \
  --env prod \
  --payload '{"csvUrl": "https://www.data.gouv.fr/fr/datasets/r/b22f04bf-64a8-495d-b8bb-d84dbc4c7983"}'

# Étape B : IPS (patche les rows existantes avec l'indice de position sociale)
npx trigger.dev@latest trigger \
  --task imports.education_ips \
  --env prod \
  --payload '{"csvUrl": "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-ips-ecoles-ap2023/exports/csv", "millesime": 2023}'
```

## Crons (automatiques après deploy worker)

| Task | Cron | Fréquence |
|---|---|---|
| `imports.dvf.scheduled` | `0 3 1 */3 *` | Trimestriel — 1er du trimestre 3h UTC |
| `imports.oll_loyers.scheduled` | `0 4 15 12 *` | Annuel — 15 décembre 4h UTC |
| `imports.education.scheduled` | `0 4 1 10 *` | Annuel — 1er octobre 4h UTC |
| `imports.banque_de_france.reminder` | `0 9 5 * *` | Mensuel — 5 du mois 9h UTC |
| `compute-market-stats` | `0 4 5 * *` | Mensuel — 5 du mois 4h UTC |

## Vérification post-import

Une fois les imports terminés, vérifier le nombre de lignes par table via MCP Supabase ou SQL :

```sql
-- Sur projet immoscan-data (riihwfenotjdnwrimlet)
select 'dvf_mutations' as tbl, count(*) from public.dvf_mutations
union all select 'insee_iris', count(*) from public.insee_iris
union all select 'insee_filosofi', count(*) from public.insee_filosofi
union all select 'oll_loyers_medians', count(*) from public.oll_loyers_medians
union all select 'georisques_communes', count(*) from public.georisques_communes
union all select 'education_etablissements', count(*) from public.education_etablissements
union all select 'ademe_dpe', count(*) from public.ademe_dpe;

-- Volumes attendus France entière (après tous imports) :
-- dvf_mutations           : 1.5M+ (par millésime)
-- insee_iris              : ~50k
-- insee_filosofi          : ~50k
-- oll_loyers_medians      : ~10k (50 territoires × N variantes)
-- georisques_communes     : ~35k
-- education_etablissements: ~70k
-- ademe_dpe               : remplie à la volée par bien analysé (cache 30j)
```

## Refresh des materialized views (après gros imports DVF)

```sql
refresh materialized view concurrently public.dvf_medians_commune;
refresh materialized view concurrently public.dvf_medians_iris;
```

Ou via la task scheduled `compute-market-stats` qui s'en charge tous les 5 du mois.

## Diagnostic : pourquoi mon estimation est-elle vide / imprécise ?

1. **Pas de DVF** sur la commune → `score_prix = null`. Solution : run `imports.dvf` sur le millésime courant.
2. **Pas de Filosofi** sur l'IRIS → contexte socio-économique vide. Solution : run `imports.insee_filosofi`.
3. **Pas d'OLL** sur la commune → rendement locatif faux. Solution : si la commune n'est pas couverte par les OLL (~50 territoires), pas de fix possible. Fallback : `apifyActiveComparables` scrape SeLoger Louer pour estimer.
4. **DPE non trouvé** → `dpe_secteur` null. Solution : c'est attendu si peu de DPEs ADEME sur le secteur, le worker utilise les annonces actives comme fallback.

## Coût indicatif

- Trigger.dev : tier gratuit couvre 10k run-min/mois. Un cycle complet d'imports = ~50 min, soit 0.5 % du quota.
- Apify : tier gratuit 5$/mois. Pas utilisé pour les imports bulk (uniquement pour `value-apify-user-comparables` et `apifyActiveComparables`).
- Bandwidth Supabase : ~3 GB de DVF + ~500 MB d'autres → tier gratuit Supabase couvre 5 GB egress/mois.
