# Edge Functions ImmoValue

Trois endpoints Supabase Edge alimentent le flux ImmoValue côté serveur :

| Function                       | Path                                                  | Auth         | Type        |
|--------------------------------|-------------------------------------------------------|--------------|-------------|
| `value-estimer`                | `POST /functions/v1/value-estimer`                    | Bearer (opt) | Création    |
| `value-biens-publish`          | `POST /functions/v1/value-biens-publish/:bienId`      | Bearer       | Paywall     |
| `stripe-webhook` (extension)   | `POST /functions/v1/stripe-webhook`                   | Stripe sig.  | Webhook     |

Les sources sont dans `supabase-app/supabase/functions/`.

---

## 1. `value-estimer`

Crée un bien ImmoValue (`value.biens`) et déclenche le pipeline d'estimation
IA via Trigger.dev (`value-build-estimation` ou, si l'utilisateur a fourni des
URLs SeLoger / LBC, `value-apify-user-comparables` qui chaîne ensuite l'estimation).

### Body

```jsonc
{
  "address": "12 rue de la Gare, 93220 Gagny",
  "bien_data": {
    "typologie": "T3",
    "surface_carrez": 62,
    "pieces": 3,
    "chambres": 2,
    "etage": 3,
    "etage_total": 5,
    "ascenseur": true,
    "exposition": "Sud-Ouest",
    "balcon": true,
    "cave": true,
    "dpe": "E",
    "ges": "E",
    "annee_construction": 1975,
    "etat_general": "bon_etat",
    "particularites": "Vue dégagée sur la gare RER E"
  },
  "photos_urls": [
    "https://value-cdn.immoscan.fr/uploads/abc/photo1.jpg"
  ],
  "user_provided_urls": [
    "https://www.seloger.com/list.htm?ci=930320&zonelat=..."
  ]
}
```

Schéma Zod : `_shared/value-bien-schema.ts` (duplicate Deno-side de
`packages/shared/src/value/bien.ts` côté monorepo TS — à synchroniser
avec `chore: sync value-bien-schema`).

### Réponses

| Code | Payload                                                                   | Sens                                      |
|------|---------------------------------------------------------------------------|-------------------------------------------|
| 200  | `{ "bien_id": "uuid" }`                                                   | Bien créé + task lancée                   |
| 202  | `{ "bien_id": "uuid", "warning": "task_trigger_failed", ... }`            | Bien créé mais Trigger.dev a échoué       |
| 400  | `{ "error": "validation_failed", "issues": [...] }` ou `invalid_json`     | Body Zod invalide                         |
| 401  | `{ "error": "invalid_token" }`                                            | JWT fourni mais invalide                  |
| 429  | `{ "error": "rate_limited", "retry_after_seconds": N }` + `Retry-After`   | Quota IP ou user dépassé                  |
| 500  | `{ "error": "insert_failed", "detail": "..." }`                           | INSERT biens KO (ex. `anonymous_draft` non whitelisté) |

### Rate limit

- 10 req / IP / heure pour les requêtes anonymes
- 50 req / user / heure pour les requêtes authentifiées

Implémentation **best-effort in-memory** (cf. `_shared/rate-limit.ts`).
Chaque instance Deno isolée a sa propre Map → utile pour limiter les
abus évidents, mais pas une vraie protection à l'échelle.

**V2 recommandé** : remplacer par [Upstash Redis](https://upstash.com/docs/redis/quickstarts/supabase-edge-function-rust)
(`@upstash/ratelimit`) avec un store partagé entre instances.

### cURL — anonyme

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/value-estimer" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d @bien-payload.json
```

### cURL — authentifié

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/value-estimer" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -d @bien-payload.json
```

---

## 2. `value-biens-publish`

Bascule un bien ImmoValue en visibilité publique (vitrine). Authentification
JWT obligatoire — seul le propriétaire peut publier son bien.

Deux chemins :

1. **Première publication** : Stripe Checkout (49€ one-shot) → l'URL est
   renvoyée et le frontend redirige. Le bascule DB se fait dans le
   webhook `checkout.session.completed` (case `value_publish`).
2. **Re-publication après vente / retrait** : si `paywall_unlocked_at` est
   déjà set (le propriétaire avait déjà payé), on bascule directement
   `status='public'` sans repasser par Stripe.

### Chemin

```
POST /functions/v1/value-biens-publish/<bienId>
```

`<bienId>` est extrait du dernier segment d'URL (UUID v4 attendu).

### Réponses

| Code | Payload                                                                  | Sens                                     |
|------|--------------------------------------------------------------------------|------------------------------------------|
| 200  | `{ "checkout_url": "https://...", "payment_required": true, "bien_id" }` | Checkout Stripe à suivre                 |
| 200  | `{ "status": "published", "payment_required": false, "bien_id" }`        | Déjà payé → bascule directe              |
| 400  | `{ "error": "invalid_bien_id" }`                                         | Path mal formé / UUID invalide           |
| 401  | `{ "error": "missing_auth" }` / `invalid_token`                          | JWT requis                               |
| 403  | `{ "error": "forbidden" }`                                               | Bien ne t'appartient pas                 |
| 404  | `{ "error": "not_found" }`                                               | Bien inexistant                          |
| 500  | `{ "error": "price_id_missing" }` / `stripe_error` / `publish_failed`    | Stripe / DB KO                           |

### cURL

```bash
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/value-biens-publish/<bienId>" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Réponse type :

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_...",
  "payment_required": true,
  "bien_id": "..."
}
```

---

## 3. Extension du webhook Stripe

`stripe-webhook/index.ts` reconnaît désormais les sessions ImmoValue grâce à
`metadata.product === 'value_publish'` et bascule le bien en `public` +
log `paywall_unlocked_at` + déclenche `value-notify-public-switch`.

La branche ImmoValue est branchée **avant** la logique ImmoScan (qui exige
`metadata.immoscan_profile_id`), donc elle ne dépend pas de la machinerie
abonnement / PPU existante.

L'idempotence repose sur `stripe_webhook_events.id` (mécanisme existant
ImmoScan) + la garde « ne pas écraser `paywall_unlocked_at` s'il est déjà
set » (cas du double webhook après plusieurs sessions Checkout).

---

## 4. Variables d'environnement requises

À ajouter dans les secrets Supabase (`supabase secrets set …`) et dans
`.env.local` pour le dev :

### Stripe

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_VALUE_PUBLISH=price_...     # 49€ one-shot
# (V5) STRIPE_PRICE_VALUE_PACK_ANNONCES=price_...   # 39€ one-shot
```

### Trigger.dev

```bash
TRIGGER_API_URL=https://api.trigger.dev   # default ok
TRIGGER_API_KEY=tr_prod_...               # server token
```

### Supabase (déjà existants)

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Branding ImmoValue

```bash
VITE_VALUE_APP_URL=https://value.immoscan.fr   # success / cancel redirects
```

Pour les déployer en prod :

```bash
supabase secrets set \
  STRIPE_PRICE_VALUE_PUBLISH=price_xxx \
  TRIGGER_API_URL=https://api.trigger.dev \
  TRIGGER_API_KEY=tr_prod_xxx \
  VITE_VALUE_APP_URL=https://value.immoscan.fr
```

---

## 5. Test local

```bash
# Démarre la stack Supabase locale (Postgres + auth + storage)
cd supabase-app
supabase start

# Sers les Edge Functions en local (hot reload)
supabase functions serve --no-verify-jwt --env-file .env.local

# Dans un autre shell : invoque value-estimer
curl -X POST http://127.0.0.1:54321/functions/v1/value-estimer \
  -H "Content-Type: application/json" \
  -d '{
    "address": "12 rue de la Gare, 93220 Gagny",
    "bien_data": {
      "typologie": "T3",
      "surface_carrez": 62,
      "pieces": 3
    },
    "photos_urls": [],
    "user_provided_urls": []
  }'
```

Pour tester le webhook Stripe en local, utilise [`stripe listen`](https://stripe.com/docs/cli/listen) :

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
# puis dans un autre shell :
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.product=value_publish \
  --add checkout_session:metadata.bien_id=<un-uuid-existant> \
  --add checkout_session:metadata.user_id=<auth-user-id>
```

---

## 6. Points de coordination inter-agents

- **Agent Schema** : doit ajouter `'anonymous_draft'` au CHECK constraint
  `value.biens_status_check` et relâcher `user_id` à NULLABLE pour cette
  valeur. Sans ça, `value-estimer` renverra 500 sur tout appel anonyme.
- **Agent Workers** : doit publier les tasks `value-apify-user-comparables`,
  `value-build-estimation`, `value-notify-public-switch` côté Trigger.dev.
  Les Edge Functions appellent les task IDs textuels — toute renommage doit
  être synchronisé.
- **Agent Frontend** : `apps/value-web` doit appeler les endpoints via les
  helpers `supabase.functions.invoke(...)` standards. Les schémas Zod
  publiés dans `packages/shared/src/value/bien.ts` doivent rester en sync
  avec `_shared/value-bien-schema.ts`.

---

## 7. À faire (V2)

- Rate limiter Upstash Redis (cross-instance).
- Idempotence renforcée sur le webhook (lock optimiste sur `bien_id`).
- Géocoding upfront dans `value-estimer` (BAN) plutôt que dans le worker
  — décision à prendre avec l'agent Workers.
- Tests Deno (`deno test`) sur les Edge Functions, en complément des
  tests d'intégration côté worker.
