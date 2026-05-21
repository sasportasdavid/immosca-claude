#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# run-all-imports.sh
# ───────────────────────────────────────────────────────────────────────
# Lance la chaîne complète d'imports bulk pour peupler immoscan-data
# avec les datasets publics nécessaires à la valorisation ImmoValue.
#
# Les triggers passent par l'API REST Trigger.dev (pas la CLI qui n'a
# pas de subcommand `trigger` en v4). Auth via le secret key
# TRIGGER_API_KEY (tr_prod_...) que tu peux trouver dans Trigger.dev
# Dashboard → Project Settings → API Keys → "PROD: secret key".
#
# Pré-requis (cf docs/imports-data-runbook.md) :
#   1. Worker Trigger.dev déployé en prod (toutes les tasks disponibles)
#   2. Env vars dans Trigger.dev cloud :
#        SUPABASE_DATA_URL, SUPABASE_DATA_SERVICE_ROLE_KEY,
#        APIFY_TOKEN, ANTHROPIC_API_KEY
#   3. TRIGGER_API_KEY exporté localement OU dans apps/worker/.env.local
#      OU passé en argument --api-key
#
# Usage :
#   export TRIGGER_API_KEY=tr_prod_xxx
#   ./scripts/imports/run-all-imports.sh                 # défaut prod
#   ./scripts/imports/run-all-imports.sh --api-key tr_prod_xxx --env prod
#   ./scripts/imports/run-all-imports.sh --skip dvf,oll  # saute certains
#   ./scripts/imports/run-all-imports.sh --dry-run       # affiche sans exécuter
#
# Durée totale estimée : 45-60 min (DVF dominant ~30 min).
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Defaults ──────────────────────────────────────────────────────────

ENV="prod"
SKIP=""
DRY_RUN=0
MILLESIME_DVF=$(date +%Y)
MILLESIME_FILOSOFI=$(($(date +%Y) - 1))
MILLESIME_OLL=$(($(date +%Y) - 1))
MILLESIME_IPS=$(($(date +%Y) - 1))
API_KEY="${TRIGGER_API_KEY:-}"
TRIGGER_API_URL="${TRIGGER_API_URL:-https://api.trigger.dev}"

# URLs sources (à vérifier dans docs/imports-data-runbook.md si une casse)
URL_IRIS_GEOJSON="https://files.opendatarchives.fr/professionnels.ign.fr/contoursiris/contours-iris-${MILLESIME_DVF}.geojson"
URL_FILOSOFI_CSV="https://www.insee.fr/fr/statistiques/fichier/8229323/BASE_TD_FILO_DEC_IRIS_${MILLESIME_FILOSOFI}.csv"
URL_OLL_CSV="https://static.data.gouv.fr/resources/observatoires-locaux-des-loyers-resultats/oll-${MILLESIME_OLL}.csv"
URL_EDUCATION_ANNUAIRE="https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/exports/csv"
URL_EDUCATION_IPS="https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-ips-ecoles-ap2023/exports/csv"

# ─── Parse args ────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)         ENV="$2"; shift 2 ;;
    --skip)        SKIP="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    --api-key)     API_KEY="$2"; shift 2 ;;
    --dvf)         MILLESIME_DVF="$2"; shift 2 ;;
    --filosofi)    MILLESIME_FILOSOFI="$2"; shift 2 ;;
    --oll)         MILLESIME_OLL="$2"; shift 2 ;;
    --ips)         MILLESIME_IPS="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^# ═*$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "❌ Argument inconnu : $1" >&2
      exit 1
      ;;
  esac
done

# Tente de charger TRIGGER_API_KEY depuis apps/worker/.env.local si pas
# encore défini. Pratique pour ne pas avoir à l'exporter à chaque shell.
if [[ -z "$API_KEY" ]]; then
  for envfile in "apps/worker/.env.local" "apps/worker/.env" ".env.local" ".env"; do
    if [[ -f "$envfile" ]] && grep -q "^TRIGGER_API_KEY=" "$envfile"; then
      API_KEY=$(grep "^TRIGGER_API_KEY=" "$envfile" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
      echo "ℹ️  TRIGGER_API_KEY chargé depuis $envfile"
      break
    fi
  done
fi

if [[ -z "$API_KEY" && $DRY_RUN -eq 0 ]]; then
  cat >&2 <<'ERREUR'
❌ TRIGGER_API_KEY manquant.

Récupère-le dans Trigger.dev Dashboard → Project Settings → API Keys
→ copie la valeur "PROD: secret key" (tr_prod_xxx) et exporte-la :

  export TRIGGER_API_KEY=tr_prod_xxxxxxxxxxxxxxxx
  ./scripts/imports/run-all-imports.sh

Ou ajoute-le dans apps/worker/.env.local :

  echo 'TRIGGER_API_KEY=tr_prod_xxxxxxxxxxxxxxxx' >> apps/worker/.env.local

Ou passe-le directement :

  ./scripts/imports/run-all-imports.sh --api-key tr_prod_xxx
ERREUR
  exit 1
fi

# ─── Helpers ───────────────────────────────────────────────────────────

is_skipped() {
  [[ ",$SKIP," == *",$1,"* ]]
}

run_task() {
  local task_id="$1"
  local payload="$2"
  local label="$3"

  echo ""
  echo "━━━ $label ━━━"
  echo "  task    : $task_id"
  echo "  env     : $ENV"
  echo "  payload : $payload"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  [DRY-RUN] commande non exécutée"
    return 0
  fi

  local start_ts=$(date +%s)
  # API REST Trigger.dev v3/v4 :
  #   POST {TRIGGER_API_URL}/api/v1/tasks/{taskId}/trigger
  #   Authorization: Bearer <secret_key>
  #   Body: { "payload": { ... } }
  local body
  body=$(printf '{"payload":%s}' "$payload")
  local http_response
  http_response=$(curl -sS -w "\n%{http_code}" -X POST \
    "${TRIGGER_API_URL}/api/v1/tasks/${task_id}/trigger" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body" 2>&1)
  local http_code
  http_code=$(printf '%s' "$http_response" | tail -1)
  local http_body
  http_body=$(printf '%s' "$http_response" | sed '$d')
  local elapsed=$(($(date +%s) - start_ts))

  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    local run_id
    run_id=$(printf '%s' "$http_body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  ✅ déclenché en ${elapsed}s (run id : ${run_id:-?})"
  else
    echo "  ❌ ÉCHEC HTTP $http_code en ${elapsed}s"
    echo "     body: $http_body"
    return 1
  fi
}

# ─── Pré-flight ─────────────────────────────────────────────────────────

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Imports bulk immoscan-data                             ║"
echo "║         Env: $ENV  ·  Skip: ${SKIP:-aucun}  ·  Dry-run: $DRY_RUN              ║"
echo "╚════════════════════════════════════════════════════════════════╝"

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ curl introuvable" >&2
  exit 1
fi

# Validation rapide du format de l'API key
if [[ $DRY_RUN -eq 0 && -n "$API_KEY" && ! "$API_KEY" =~ ^tr_(prod|dev|stg)_ ]]; then
  echo "⚠️  Format de TRIGGER_API_KEY inattendu (devrait commencer par tr_prod_/tr_dev_/tr_stg_)" >&2
fi

# ─── 1. DVF+ (millésime courant) ────────────────────────────────────────

if is_skipped "dvf"; then
  echo "⏭  DVF — sauté (--skip dvf)"
else
  run_task "imports.dvf" \
    "{\"millesime\": $MILLESIME_DVF}" \
    "1/7 · DVF+ Cerema  ($MILLESIME_DVF, ~1.5M lignes, ~30 min)"
fi

# ─── 2. INSEE IRIS géométries ───────────────────────────────────────────

if is_skipped "iris"; then
  echo "⏭  IRIS — sauté (--skip iris)"
else
  run_task "imports.insee_iris" \
    "{\"geojsonUrl\": \"$URL_IRIS_GEOJSON\", \"millesime\": $MILLESIME_DVF}" \
    "2/7 · INSEE IRIS  (~50k IRIS, ~5 min)"
fi

# ─── 3. INSEE Filosofi par IRIS ─────────────────────────────────────────

if is_skipped "filosofi"; then
  echo "⏭  Filosofi — sauté (--skip filosofi)"
else
  run_task "imports.insee_filosofi" \
    "{\"csvUrl\": \"$URL_FILOSOFI_CSV\", \"millesime\": $MILLESIME_FILOSOFI}" \
    "3/7 · INSEE Filosofi  ($MILLESIME_FILOSOFI, ~50k IRIS, ~3 min)"
fi

# ─── 4. OLL loyers signés ───────────────────────────────────────────────

if is_skipped "oll"; then
  echo "⏭  OLL — sauté (--skip oll)"
else
  run_task "imports.oll_loyers" \
    "{\"csvUrl\": \"$URL_OLL_CSV\", \"millesime\": $MILLESIME_OLL}" \
    "4/7 · OLL loyers  ($MILLESIME_OLL, ~10k lignes, ~2 min)"
fi

# ─── 5. Géorisques (toutes communes) ────────────────────────────────────

if is_skipped "georisques"; then
  echo "⏭  Géorisques — sauté (--skip georisques)"
else
  run_task "imports.georisques.all" \
    "{}" \
    "5/7 · Géorisques  (~35k communes, ~30 min — fan-out par task individuelle)"
fi

# ─── 6. Education — Annuaire ────────────────────────────────────────────

if is_skipped "education"; then
  echo "⏭  Education — sauté (--skip education)"
else
  run_task "imports.education_annuaire" \
    "{\"csvUrl\": \"$URL_EDUCATION_ANNUAIRE\"}" \
    "6/7 · Education Annuaire  (~70k établissements, ~10 min)"

  # IPS doit être lancé APRÈS l'annuaire (UPDATE sur rows existantes)
  echo ""
  echo "⏳ Attente 30s avant IPS pour laisser l'annuaire commencer à remplir…"
  if [[ $DRY_RUN -eq 0 ]]; then sleep 30; fi

  run_task "imports.education_ips" \
    "{\"csvUrl\": \"$URL_EDUCATION_IPS\", \"millesime\": $MILLESIME_IPS}" \
    "7/7 · Education IPS  ($MILLESIME_IPS, update par UAI, ~5 min)"
fi

# ─── Bilan ──────────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         ✅ Tous les triggers ont été émis                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Les tasks tournent maintenant en async côté Trigger.dev cloud."
echo "Suivre l'avancement : https://cloud.trigger.dev/orgs/<org>/projects/<proj>/runs"
echo ""
echo "Vérification volumétrique après run (SQL sur immoscan-data) :"
echo ""
echo "  select 'dvf_mutations' as tbl, count(*) from public.dvf_mutations"
echo "  union all select 'insee_iris', count(*) from public.insee_iris"
echo "  union all select 'insee_filosofi', count(*) from public.insee_filosofi"
echo "  union all select 'oll_loyers_medians', count(*) from public.oll_loyers_medians"
echo "  union all select 'georisques_communes', count(*) from public.georisques_communes"
echo "  union all select 'education_etablissements', count(*) from public.education_etablissements;"
echo ""
echo "Refresh des materialized views DVF (après run DVF terminé) :"
echo ""
echo "  refresh materialized view concurrently public.dvf_medians_commune;"
echo "  refresh materialized view concurrently public.dvf_medians_iris;"
echo ""
