# DVF — Import + signal de marché

> Source de vérité : `business-model-immoscan.md` §5.2, `module-veille-immoscan.md` §6
> Tables : `immoscan-data.dvf_mutations` + `dvf_medians_commune` (matérialisée) + `immoscan-app.market_stats_cache`

---

## 1. Pipeline complet

```
data.gouv.fr/geo-dvf/<year>/full.csv.gz
        │
        ▼  worker `imports.dvf` (manuel ou cron trimestriel)
        │  - download + gunzip + parse + UPSERT bulk
        │  - call RPC refresh_dvf_medians()
        ▼
immoscan-data.dvf_mutations (5M+ rows France entière, 5 ans)
        │
        ▼  Vue matérialisée (calculée par refresh_dvf_medians)
        │
immoscan-data.dvf_medians_commune (médianes / IRIS / année)
        │
        ▼  worker `compute-market-stats` (cron mensuel le 5 à 4h UTC)
        │  - SELECT médianes commune × type (année la plus récente)
        │  - filtre n_transactions ≥ SIGNAL_MIN_TRANSACTIONS (15)
        │  - UPSERT dans immoscan-app
        ▼
immoscan-app.market_stats_cache (commune_insee, bien_type, dpe_bin='unknown')
        │
        ├─▶ watch-scout `fetchMarketStat` → event signal_to_verify
        └─▶ watch-digest-mailer → section "📊 Signal marché" du digest
```

---

## 2. Bootstrap initial (one-shot, ~2h pour 5 ans)

### 2.1 Importer les millésimes DVF

Depuis le dashboard Trigger.dev (apps/worker → tasks → `imports.dvf`), trigger
1 task par millésime à importer :

```json
{ "millesime": 2025 }
```

Recommandé pour le launch :

| Millésime | Volume | Durée approx | Coût Apify | Priorité |
|---|---|---|---|---|
| 2025 | ~1.5M rows | ~30 min | 0 (data.gouv) | **P0** — le plus utile |
| 2024 | ~1.5M rows | ~30 min | 0 | **P0** |
| 2023 | ~1.5M rows | ~30 min | 0 | P1 (historique) |
| 2022 | ~1.5M rows | ~30 min | 0 | P2 |
| 2021 | ~1.5M rows | ~30 min | 0 | P2 |

L'ordre est inverse-chronologique : 2025 d'abord pour avoir vite quelque chose
d'exploitable. Le filtre `nb_mutations ≥ 15` côté compute fait que tu n'as
besoin que d'un seul millésime pour activer le signal_to_verify (5 ans c'est
mieux statistiquement mais pas bloquant pour launch).

### 2.2 Vérifier l'import

```sql
-- immoscan-data
select code_departement, count(*) as n
from dvf_mutations
group by code_departement
order by code_departement;
```

Doit renvoyer ~95 départements avec quelques milliers à dizaines de milliers
de mutations chacun.

### 2.3 Refresh + compute-market-stats

L'import DVF appelle automatiquement `refresh_dvf_medians()` en fin de run.
Puis trigger une fois `compute-market-stats.manual` depuis le dashboard
Trigger.dev pour populate immédiatement `market_stats_cache` (sans attendre
le prochain cron mensuel).

```sql
-- immoscan-app : vérif que les stats sont peuplées
select count(*) as communes, sum(n_transactions) as tx_total
from market_stats_cache;
```

Attendu : ≥ 5000 communes pour la France entière après le 1er compute.

---

## 3. Scope V1 limitations connues

### 3.1 `dpe_bin = 'unknown'` uniquement

**DVF ne contient pas le DPE.** En V1 on stocke une seule ligne par
(commune_insee, bien_type) avec `dpe_bin='unknown'`. Le watch-scout
fait un fallback sur 'unknown' si le bin exact du listing scrapé
n'existe pas en cache.

Conséquence : la garde "Un DPE G n'est pas comparé à un DPE B" du module-veille
n'est **pas appliquée en V1**. Risque d'augmentation des faux positifs
`signal_to_verify` sur les biens à DPE extrême. Mitigation : on garde
le filtre `n_transactions ≥ 15` qui exclut déjà les communes à échantillon
faible.

Pour passer en V2 (PR-E bis) : croiser DVF × ADEME par géocodage BAN +
calculer 3 bins (A_C, D_E, F_G) côté `compute-market-stats`.

### 3.2 `delta_pct` marché non disponible

Le digest section "📊 Signal marché" affiche `medianEurM2` par ville mais
pas l'évolution N-1 (`deltaPct: null`). Besoin d'un historique versionné de
`market_stats_cache` qui n'existe pas en V1.

Mitigation : la table actuelle est UPSERT-écrasante (1 ligne par PK).
Pour V2, ajouter une colonne `snapshot_month` à la PK et garder l'historique.

### 3.3 Coût Trigger.dev

Chaque `imports.dvf` tourne ~30 min en compute heavy (parse CSV streaming +
batch insert Supabase). Sur le plan Trigger.dev free, 5 millésimes consécutifs
peuvent saturer le quota mensuel. À monitorer pendant le bootstrap initial.

---

## 4. Crons (résumé)

| Cron Trigger.dev | Schedule | Owner |
|---|---|---|
| `imports.dvf.scheduled` | `0 3 1 */3 *` (1er du trimestre à 3h UTC) | refresh DVF |
| `compute-market-stats` | `0 4 5 * *` (5 du mois à 4h UTC) | refresh cache |

L'écart trimestriel/mensuel est volontaire : DVF est publié par data.gouv tous
les ~3 mois, donc inutile de recompute plus souvent.

---

## 5. Troubleshooting

| Problème | Cause probable | Fix |
|---|---|---|
| `dvf_medians_commune` vide après import | Refresh pas exécuté | Appel manuel `select refresh_dvf_medians();` côté immoscan-data |
| `market_stats_cache` vide après compute | DVF pas encore importé OU n_transactions < 15 partout | Vérifier `select count(*) from dvf_mutations;` |
| Worker `imports.dvf` timeout | Volume trop gros sur un millésime | Augmenter `maxDuration` ou split par département (TODO) |
| `signal_to_verify` jamais déclenché malgré DVF en place | listings sans `code_insee` (geocoding BAN raté) | Vérifier `analyze.ts` step BAN ; le `code_insee` est rempli post-scrape |
| RPC `refresh_dvf_medians()` deadlock | Lock concurrent sur la vue matérialisée | C'est `CONCURRENTLY` donc rare ; sinon retry à l'identique |

---

## 6. Métriques à monitorer post-launch

| Métrique | Cible | Action si hors cible |
|---|---|---|
| Couverture `market_stats_cache` | > 80% des INSEE des watches actives | Vérifier que les watches ont bien `code_insee` côté listings |
| Taux de fausses alertes `signal_to_verify` | <30% (mesuré via CTR > pipeline ajout) | Resserrer SIGNAL_TO_VERIFY_THRESHOLDS, ou implémenter bins DPE (V2) |
| Fréquence d'apparition `signal_to_verify` | 1-5 par digest et par user actif | Si <1, élargir les seuils ; si >10, resserrer |
