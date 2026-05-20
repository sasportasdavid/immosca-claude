# Stripe Billing — Setup, déploiement, tests

> Source de vérité business : `business-model-immoscan.md` §2.1
> Source de vérité tech : `packages/shared/src/billing/skus.ts`
> Edge Functions : `supabase-app/supabase/functions/stripe-{webhook,checkout,portal}`

---

## 1. Architecture

```
┌──────────┐                            ┌──────────────────┐
│ Frontend │  invoke stripe-checkout    │ stripe-checkout  │
│  (web)   ├──────────────────────────► │  Edge Function   │
└──────────┘                            └────────┬─────────┘
     │                                            │ Stripe.checkout.sessions.create
     │                                            ▼
     │                                     ┌──────────────┐
     │ window.location = session.url       │   Stripe     │
     │◄────────────────────────────────────┤              │
     ▼                                     └──────┬───────┘
┌──────────────┐                                  │ POST event
│ Stripe       │                                  ▼
│ Checkout UI  │                          ┌────────────────┐
└──────┬───────┘                          │ stripe-webhook │
       │ Payment OK                       │ Edge Function  │
       └─────────────────────────────────►│  - upsert sub  │
                                          │  - update plan │
                                          │  - mint entitl │
                                          └────────┬───────┘
                                                   │
                                                   ▼
                                          ┌────────────────┐
                                          │  immoscan-app  │
                                          │   Postgres     │
                                          └────────────────┘
```

3 Edge Functions :
- **stripe-checkout** (auth user) — crée une Checkout Session pour un SKU
- **stripe-portal** (auth user) — lien vers le Billing Portal client
- **stripe-webhook** (no-verify-jwt, Stripe Bearer) — réceptionne tous les events

---

## 2. Setup initial (one-shot, ~30 min)

### 2.1 Créer les produits + prix dans Stripe

Tu peux soit utiliser le script `scripts/seed-stripe.ts` (recommandé), soit créer à la main via Dashboard.

```bash
# Pré-requis : avoir installé Stripe CLI
stripe login

# Créer un produit + 2 prix (monthly + yearly) par plan
# Exemple Pro :
stripe products create --name "ImmoScan Pro" --metadata "immoscan_sku=pro"
# → retour : prod_xxxxx

stripe prices create \
  --product prod_xxxxx \
  --unit-amount 3900 \
  --currency eur \
  --recurring "interval=month"
# → retour : price_xxxxx

stripe prices create \
  --product prod_xxxxx \
  --unit-amount 39000 \
  --currency eur \
  --recurring "interval=year"
# → retour : price_yyyyy
```

Répète pour les 5 paliers + PPU + 5 add-ons = **12 prix au total**.

| SKU | Type | Produit | Prix |
|---|---|---|---|
| pro_monthly | recurring | ImmoScan Pro | 39€/mois |
| pro_yearly | recurring | ImmoScan Pro | 390€/an |
| pro_plus_monthly | recurring | ImmoScan Pro+ | 99€/mois |
| pro_plus_yearly | recurring | ImmoScan Pro+ | 990€/an |
| business_monthly | recurring | ImmoScan Business | 449€/mois |
| business_yearly | recurring | ImmoScan Business | 4490€/an |
| ppu_analysis | one_time | Analyse à l'unité | 14,90€ |
| addon_watch_unit | recurring | Veille additionnelle | 7€/mois |
| addon_watch_pack3 | recurring | Pack 3 veilles | 19€/mois |
| addon_watch_daily | recurring | Veille daily (Business) | 19€/mois |
| addon_watch_pack3_daily | recurring | Pack 3 daily (Business) | 49€/mois |
| addon_seat | recurring | Seat supplémentaire | 30€/mois |

### 2.2 Configurer les secrets Supabase

```bash
# Clé Stripe + secret webhook
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# Tous les price_id
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_PRO_YEARLY=price_xxx
supabase secrets set STRIPE_PRICE_PRO_PLUS_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_PRO_PLUS_YEARLY=price_xxx
supabase secrets set STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_BUSINESS_YEARLY=price_xxx
supabase secrets set STRIPE_PRICE_PPU_ANALYSIS=price_xxx
supabase secrets set STRIPE_PRICE_ADDON_WATCH_UNIT=price_xxx
supabase secrets set STRIPE_PRICE_ADDON_WATCH_PACK3=price_xxx
supabase secrets set STRIPE_PRICE_ADDON_WATCH_DAILY=price_xxx
supabase secrets set STRIPE_PRICE_ADDON_WATCH_PACK3_DAILY=price_xxx
supabase secrets set STRIPE_PRICE_ADDON_SEAT=price_xxx
```

### 2.3 Déployer les Edge Functions

```bash
cd supabase-app

# stripe-webhook : no-verify-jwt car Stripe appelle directement (pas un user)
supabase functions deploy stripe-webhook --no-verify-jwt

# stripe-checkout + stripe-portal : verify-jwt par défaut (user auth requis)
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
```

### 2.4 Configurer le webhook Stripe

Dans le Dashboard Stripe → Developers → Webhooks → Add endpoint :

- **URL** : `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- **Events** :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- **Récupère le signing secret** (whsec_xxx) → mets-le dans `STRIPE_WEBHOOK_SECRET`.

### 2.5 Activer le Customer Portal

Dashboard Stripe → Settings → Billing → Customer Portal → activer + configurer :
- Permettre upgrade/downgrade
- Permettre annulation à fin de cycle (pas immédiate)
- Afficher les factures historiques
- Permettre changement de méthode de paiement

---

## 3. Tests avec Stripe CLI

### 3.1 Tester le webhook localement

```bash
# 1) Forward les events Stripe vers ton Edge Function local
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# → affiche le webhook secret de test :
#   > Ready! Your webhook signing secret is whsec_test_xxx

# 2) Set ce secret côté local
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_test_xxx --no-verify-jwt
```

### 3.2 Déclencher chaque event critique

```bash
# Checkout PPU
stripe trigger checkout.session.completed

# Subscription créée (plan recurring)
stripe trigger customer.subscription.created

# Subscription mise à jour (upgrade)
stripe trigger customer.subscription.updated

# Subscription annulée
stripe trigger customer.subscription.deleted

# Paiement réussi (renouvellement)
stripe trigger invoice.payment_succeeded

# Paiement échoué (carte expirée)
stripe trigger invoice.payment_failed
```

### 3.3 Checklist manuelle post-trigger

| Event | Vérif DB |
|---|---|
| `checkout.session.completed` (PPU) | 2 rows `entitlements` (`ppu_analysis` pending + `ppu_watch_bonus` pending) |
| `customer.subscription.created` (pro_monthly) | `profiles.subscription_plan='pro'` + 1 row `subscriptions` |
| `customer.subscription.updated` (pro→pro_plus) | `profiles.subscription_plan='pro_plus'` |
| `customer.subscription.deleted` | `profiles.subscription_plan='free'` + `subscriptions.status='canceled'` + addons expired |
| `invoice.payment_failed` | `profiles.subscription_status='past_due'` |

### 3.4 Vérifier l'idempotence

Rejouer le même event 2 fois doit être no-op (la 2e fois renvoie `{ "skipped": true }`).

```bash
EVENT_ID=$(stripe events list --limit 1 --type checkout.session.completed -q '.data[0].id')
stripe events resend $EVENT_ID
# → Edge Function log devrait afficher "event evt_xxx already processed, skip"
```

---

## 4. Migration utilisateurs bêta (si applicable)

État actuel (mai 2026) : **0 user payant en prod**. Pas de migration grandfather à faire.

Si des Pro/Pro+ apparaissent en bêta payante avant le launch public, créer le script `scripts/grandfather-beta-users.ts` :

```typescript
// Pour chaque user en bêta payante :
// 1) Créer une coupon Stripe "BETA_GRANDFATHER" (-20% lifetime)
// 2) Appliquer le coupon à leur sub existante
// 3) Notifier par email (template Resend dédié)
```

À déclencher en *one-shot* la veille du launch public.

---

## 5. Coûts opérationnels

| Item | Coût estimé |
|---|---|
| Stripe fees | 1,4% + 0,25€ par transaction (Europe), 2,9% + 0,25€ (international) |
| Tax handling (Stripe Tax) | +0,5% par transaction si activé |
| Customer Portal | gratuit (inclus dans Stripe Billing) |
| Webhook | gratuit |

**Marge nette par plan après Stripe** (cf BM §3.1, déjà intégré dans les calculs) :
- Pro 39€ → -0,80€ Stripe = 38,20€ net
- Pro+ 99€ → -1,64€ Stripe = 97,36€ net
- Business 449€ → -6,54€ Stripe = 442,46€ net

---

## 6. Troubleshooting

| Problème | Cause probable | Fix |
|---|---|---|
| `signature_verification_failed` | `STRIPE_WEBHOOK_SECRET` pas synchro entre Stripe Dashboard et Supabase | `supabase secrets list` + comparer |
| `price_id_missing: ...` | Variable `STRIPE_PRICE_*` non set | `supabase secrets set` |
| Checkout OK mais profile.plan reste 'free' | Webhook pas reçu (mauvaise URL) | Vérifier Dashboard Stripe → Webhook → "Recent deliveries" |
| Double entitlement PPU créé | Table `stripe_webhook_events` pas créée | Appliquer migration `20260520100300` |
| Portal renvoie `no_stripe_customer` | User n'a jamais fait d'achat | Normal — affiche un message dans l'UI à la place du bouton |
| Sub Stripe créée mais `subscriptions.row` absente | `metadata.immoscan_profile_id` absent sur la sub Stripe | Vérifier `subscription_data.metadata` dans `stripe-checkout/index.ts` |

---

## 7. Monitoring

À mettre en place post-launch :

- **PostHog event** `plan_upgraded` / `plan_downgraded` / `addon_purchased` (trigger côté frontend après refresh du billing)
- **Sentry alert** sur erreurs `stripe-webhook` (catégorie `billing.webhook`)
- **BetterStack uptime check** sur les 3 Edge Functions
- **Dashboard Stripe** : alertes sur taux de chargeback > 1%, churn > 8%/mois

---

## 8. CGU à actualiser avant launch

Le contrat actuel mentionne un seul pricing. À mettre à jour côté juridique :

1. PPU 14,90€ : mécanique d'expiration veille 30j explicite
2. Add-ons recurring : facturation au cycle, annulation à fin de cycle
3. Trial 7j sans CB : aucun engagement, annulation libre
4. Business : multi-seats arrive Q3 (V1 = 1 seat hard)
5. Mécanique "lecture seule PPU 90j" après cancel d'un abonnement payant
