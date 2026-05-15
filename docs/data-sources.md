# Sources de données ImmoScan

Référence des sources publiques utilisées dans `immoscan-data`. URLs, formats, cadence de refresh, et code d'import.

## Vue d'ensemble

| Source | Volume | Refresh | Méthode | Stockage `immoscan-data` |
|---|---|---|---|---|
| DVF+ Cerema | ~5M lignes France | Trimestriel | Téléchargement geopackage | `dvf_mutations` + 2 vues matérialisées |
| INSEE IRIS géoms | ~50k IRIS | Annuel | Shapefile / GeoJSON | `insee_iris` |
| INSEE Filosofi | ~50k IRIS | Annuel | CSV | `insee_filosofi` |
| ADEME DPE | ~8M logements | Cache à la demande | API HTTP | `ademe_dpe` |
| Réseau OLL (data.gouv) | ~50 territoires | Annuel | CSV par territoire | `oll_loyers_medians` |
| Encadrement loyers | 5-7 villes | À chaque arrêté | data.gouv arrêtés | `encadrement_loyers` |
| Géorisques | 35k communes | Annuel | API HTTP | `georisques_communes` |
| BAN (adresses) | 26M adresses | À la volée + cache | API HTTP | `ban_addresses_cache` |
| Education IPS | ~70k établissements | Annuel | CSV | `education_etablissements` |
| Banque de France | — | Mensuel | Bulletin / API | `credit_rates_history` |

## DVF+ Cerema

**URL de téléchargement** : https://datafoncier.cerema.fr/donnees/dvf-plus-open-data

Le téléchargement se fait via le geopackage France entière, format SQLite spatial. Pour automatiser :

```
# Format de l'URL (à confirmer trimestriel)
https://files.data.gouv.fr/geo-dvf/latest/csv/<annee>/full.csv.gz
```

Alternative open data plus simple : https://files.data.gouv.fr/geo-dvf/latest/csv/

**Mapping vers `dvf_mutations`** : 1-1 sur les champs DVF avec création de `geom` à partir de `longitude/latitude` via `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`.

**Refresh** :
```sql
refresh materialized view concurrently dvf_medians_commune;
refresh materialized view concurrently dvf_medians_iris;
```

Job Trigger.dev : `imports/dvf.ts`, cron `0 3 1 */3 *` (le 1er de chaque trimestre à 3h).

## INSEE IRIS + Filosofi

**IRIS géoms** : https://geoservices.ign.fr/contoursiris (IGN, GeoJSON ou shapefile)

**Filosofi par IRIS** : https://www.insee.fr/fr/statistiques/7233950 (chercher "Filosofi IRIS dispositif")

Variables clés Filosofi à importer :
- `DEC_MED21` : médiane du revenu disponible par UC
- `DEC_TP6021` : taux de pauvreté à 60% du médian
- `DEC_PMENPRO21` : part des ménages locataires du parc social
- `DEC_PMENFISC21` : nombre de ménages fiscaux

## ADEME DPE

**API documentation** : https://data.ademe.fr/datasets/dpe-v2-logements-existants

**Endpoint** :
```
GET https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines
  ?q=<query>
  &geo_distance=<lng,lat,distance>
  &size=20
```

**Stratégie** : pas d'import bulk (8M lignes, trop). On query par adresse géocodée lors d'une analyse, on cache 30 jours dans `ademe_dpe`.

## Réseau OLL

**Catalogue** : https://www.data.gouv.fr/fr/datasets/ — recherche "observatoire loyers"

Chaque territoire OLL publie son fichier annuel. Format CSV, granularité variable selon les obs.

**Stratégie** : un fichier par OLL importé séparément, normalisé via le mapper dans `apps/worker/src/imports/oll.ts`. Refresh annuel manuel au début, à automatiser quand on identifie les flux stables.

**Loyers Paris OLAP** : https://www.observatoire-des-loyers.fr/ — pour les baux signés Paris haute granularité.

## Encadrement loyers

**Paris** : https://www.data.gouv.fr/fr/datasets/encadrement-des-loyers-a-paris/

**Lille, Lyon, Bordeaux, Montpellier, Plaine Commune, Est Ensemble, Pays Basque** : chacun a son jeu de données sur data.gouv.

Format : CSV avec `id_zone`, `secteur_geographique`, `epoque_construction`, `type_location` (meublé/non), `nombre_pieces`, `loyer_reference`, `loyer_reference_majore`, `loyer_reference_minore`. Géométries séparées en GeoJSON.

## Géorisques

**API** : https://georisques.gouv.fr/api/

Endpoints utilisés :
- `GET /api/v1/risques?code_insee=<X>` — synthèse risques commune
- `GET /api/v1/ppr?code_insee=<X>` — PPR en vigueur
- `GET /api/v1/installations_classees?code_insee=<X>` — ICPE/Seveso
- `GET /api/v1/sis?code_insee=<X>` — sites pollués

**Refresh** : annuel par commune touchée par les analyses. Cache dans `georisques_communes`. Bulk import France à faire en PR2 (~35k communes, rate limit raisonnable).

## BAN (Base Adresse Nationale)

**API** : https://adresse.data.gouv.fr/api-doc/adresse

**Endpoints** :
- `GET https://api-adresse.data.gouv.fr/search/?q=<query>&limit=1` — géocodage adresse → coords
- `GET https://api-adresse.data.gouv.fr/reverse/?lat=<X>&lon=<Y>` — reverse geocoding

Pas d'API key. Rate limit 50 req/s. TTL cache 90 jours dans `ban_addresses_cache`.

## Education Nationale — IPS

**URL** : https://data.education.gouv.fr/explore/dataset/fr-en-ips-ecoles-ap2021/
+ collège (`fr-en-ips-colleges-ap2021`) + lycée (`fr-en-ips-lycees-ap2021`)

Variables clés :
- `uai` (identifiant unique établissement)
- `nom_etablissement`
- `code_postal`, `code_commune`
- `ips` (indice de position sociale)
- `coordonnees_xy` ou `latitude`/`longitude`

Refresh annuel.

## Banque de France — taux de crédit

**Bulletin mensuel** : https://www.banque-france.fr/statistiques/credit/credit/credit-aux-particuliers

API webstat : https://webstat.banque-france.fr/

Variables : taux moyen des crédits immobiliers par durée (10, 15, 20, 25 ans). Refresh mensuel.

## Conventions worker

Chaque source a un fichier dans `apps/worker/src/imports/` :

```
apps/worker/src/imports/
├── dvf.ts            # téléchargement + parsing CSV + insertion + refresh des vues
├── insee.ts          # IRIS géoms + Filosofi
├── ademe.ts          # query API + cache à la demande
├── oll.ts            # parse CSV par territoire, normalisation
├── encadrement.ts    # import arrêtés préfectoraux
├── georisques.ts     # crawl API par commune
├── ban.ts            # client geocoding + cache
├── education.ts      # IPS écoles / collèges / lycées
└── banque_de_france.ts # taux mensuels
```

Chaque import écrit dans `import_runs` (status running → success/failed, rows_imported, error_message) pour le suivi.
