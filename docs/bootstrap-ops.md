# Bootstrap Ops — Checklist activation prod

> Doc unique référençant toutes les étapes manuelles à exécuter pour passer
> du code livré (PR-A → PR-I) au launch public d'ImmoScan.
> Estimé : **~1 jour de manipulation**.

---

## 0. Pré-requis

- [ ] Compte Stripe créé + KYC validé (compte Live)
- [ ] Compte Resend créé + domaine `immoscan.fr` ajouté
- [ ] Compte Apify GOLD ou minimum FREE avec budget $50 prêt à débloquer
- [ ] Compte Anthropic API avec budget $100/mois
- [ ] Trigger.dev projet créé en mode production
- [ ] DNS `immoscan.fr` accessible (changements pour Resend + Vercel)
- [ ] Avocat consulté pour relecture des CGU/CGV avant publication
- [ ] Société immatriculée (SIRET, RCS, capital) pour remplir
      `apps/web/src/routes/legal/mentions-legales.tsx`

---

## 1. Import DVF (~1h)

Voir aussi : `docs/dvf-import.md`

1. [ ] Vérifier que les migrations `immoscan-data` sont à jour :
   ```bash
   pnpm db:migrate:data
   # ou via Supabase MCP : confirmer que refresh_dvf_medians existe
   ```
2. [ ] Depuis le dashboard Trigger.dev → tasks → `imports.dvf` :
   - Trigger pour millésime **2025** : payload `{ "millesime": 2025 }`
     → durée ~30min, attendre la fin
   - Trigger pour millésime **2024** : `{ "millesime": 2024 }`
3. [ ] Vérifier côté immoscan-data :
   ```sql
   select count(*) from dvf_mutations;
   -- Doit retourner > 1M
   select count(*) from dvf_medians_commune;
   -- Doit retourner ~30 000 lignes (communes × types × années)
   ```
4. [ ] Trigger manuellement `compute-market-stats.manual` (pour ne pas
       attendre le cron du 5 du mois) :
   ```sql
   -- Vérification post-compute
   select count(*) from market_stats_cache;
   -- Doit retourner > 5000
   ```

---

## 2. Seed Stripe (~30 min)

Voir aussi : `docs/billing.md` §2

1. [ ] **Sandbox d'abord** :
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx pnpm tsx scripts/seed-stripe.ts
   ```
   Le script crée les 6 produits + 12 prix et affiche les commandes
   `supabase secrets set STRIPE_PRICE_*=price_xxx` à copier-coller.

2. [ ] Configurer les secrets Supabase pour le projet `immoscan-app` :
   ```bash
   supabase secrets set --project-ref vztzzysrainmznjnurbl STRIPE_SECRET_KEY=sk_test_xxx
   supabase secrets set --project-ref vztzzysrainmznjnurbl STRIPE_WEBHOOK_SECRET=whsec_xxx
   # + les 12 STRIPE_PRICE_* affichés par le seed
   ```

3. [ ] Dans Stripe Dashboard :
   - **Settings → Billing → Customer Portal** : activer + autoriser
     upgrade/downgrade + factures historiques
   - **Developers → Webhooks → Add endpoint** :
     - URL : `https://vztzzysrainmznjnurbl.supabase.co/functions/v1/stripe-webhook`
     - Events : `checkout.session.completed`, `customer.subscription.created`,
       `customer.subscription.updated`, `customer.subscription.deleted`,
       `invoice.payment_succeeded`, `invoice.payment_failed`
     - Copier le signing secret → `STRIPE_WEBHOOK_SECRET`

4. [ ] **Tester en sandbox** avec Stripe CLI (voir `docs/billing.md` §3) :
   ```bash
   stripe listen --forward-to https://vztzzysrainmznjnurbl.supabase.co/functions/v1/stripe-webhook
   stripe trigger checkout.session.completed
   ```
   Vérifier qu'une row apparaît dans `stripe_webhook_events`.

5. [ ] **Reproduire les 4 étapes en mode LIVE** (`STRIPE_SECRET_KEY=sk_live_xxx`)
   le jour du launch.

---

## 3. Resend (~30 min)

1. [ ] Dashboard Resend → Domains → Add Domain : `immoscan.fr`
2. [ ] Copier les 3 records DNS proposés (SPF, DKIM, MX optionnel) et les
       ajouter chez ton registrar
3. [ ] Attendre la vérification (généralement 5-30 min)
4. [ ] Tester délivrabilité via [mail-tester.com](https://www.mail-tester.com/) :
       envoyer un email test depuis Resend, viser score ≥9/10
5. [ ] Configurer les secrets Supabase + Trigger.dev :
   ```bash
   # Supabase (pour edge functions futures)
   supabase secrets set --project-ref vztzzysrainmznjnurbl RESEND_API_KEY=re_xxx

   # Trigger.dev (pour worker tasks watch-digest-mailer, watch-expiration-mailer)
   # → dashboard Trigger.dev → Environment Variables :
   RESEND_API_KEY=re_xxx
   RESEND_FROM_EMAIL=ImmoScan <hello@immoscan.fr>
   APP_URL=https://app.immoscan.fr
   ```

---

## 4. Déploiement Edge Functions Supabase (~10 min)

```bash
cd supabase-app

# stripe-webhook : no-verify-jwt car Stripe appelle directement
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref vztzzysrainmznjnurbl

# stripe-checkout + stripe-portal : auth user requis
supabase functions deploy stripe-checkout --project-ref vztzzysrainmznjnurbl
supabase functions deploy stripe-portal --project-ref vztzzysrainmznjnurbl

# Fonctions déjà déployées en PR antérieures (pour mémoire) :
# - trigger-analyze (PR3)
# - cancel-analysis (PR3.5)
# - resolve-address (PR enrichissement adresse)
```

Vérifier dans le dashboard Supabase → Edge Functions que les 3 sont en
status « healthy ».

---

## 5. Déploiement Worker Trigger.dev (~10 min)

```bash
cd apps/worker
pnpm trigger.dev deploy
```

Tasks à enregistrer automatiquement :

| Task | Type | Schedule |
|---|---|---|
| `analyze` | manuel | — |
| `imports.dvf` | manuel | — |
| `imports.dvf.scheduled` | cron | `0 3 1 */3 *` trimestriel |
| `imports.banque-de-france` | manuel | — |
| `imports.georisques` | manuel | — |
| `imports.insee` | manuel | — |
| `compute-market-stats` | cron | `0 4 5 * *` mensuel |
| `compute-market-stats.manual` | manuel | — |
| `watch-scout` | manuel + via scheduler | — |
| `watch-scheduler-standard` | cron | `0 7 * * 1,3,5` |
| `watch-scheduler-business` | cron | `0 7 * * *` |
| `watch-digest-mailer-standard` | cron | `0 8 * * 1,3,5` |
| `watch-digest-mailer-business` | cron | `0 8 * * *` |
| `watch-expiration-mailer` | cron | `0 9 * * *` |
| `watch-purge` | cron | `0 3 * * *` |

Vérifier dans le dashboard Trigger.dev que les 15 tasks apparaissent et que
les crons sont en status « scheduled ».

---

## 6. Déploiement Web (Vercel) (~5 min)

```bash
cd apps/web
vercel --prod
```

Vérifier les env vars côté Vercel project settings :

- [ ] `VITE_SUPABASE_URL=https://vztzzysrainmznjnurbl.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY=...`
- [ ] `VITE_POSTHOG_KEY=phc_xxx`
- [ ] `VITE_POSTHOG_HOST=https://eu.posthog.com`
- [ ] `VITE_SENTRY_DSN=...`

Configurer le domaine custom `app.immoscan.fr` sur Vercel → DNS A/CNAME chez
le registrar.

---

## 7. Smoke test E2E (~30 min)

À exécuter manuellement après tous les déploiements, **en sandbox Stripe d'abord** :

### 7.1 Signup + onboarding
- [ ] Créer un nouveau compte sur `app.immoscan.fr`
- [ ] Compléter l'onboarding (paramètres financiers David)
- [ ] Vérifier dans Supabase Auth + tables `profiles` + `user_params` que le row existe
- [ ] PostHog : voir `signup_completed` event

### 7.2 Analyse Free
- [ ] Lancer une analyse SeLoger (Gagny 93220 par exemple)
- [ ] Vérifier que `analyses.status` passe `pending → scraping → enriching → scoring → generating → done`
- [ ] Sur `/app/analyses/$id` : voir le Top 5 dont biens score ≥70 floutés
- [ ] PostHog : voir `analysis_started` puis `analysis_completed`
- [ ] Tenter une 2e analyse dans le même mois → quota_exceeded + banner upsell

### 7.3 Veille Free
- [ ] Sur l'analyse done, cliquer "🔔 Mettre en veille"
- [ ] Compléter le form `/app/veilles/nouvelle` avec préfill → submit
- [ ] Vérifier `watches.expires_at` = J+60
- [ ] Sur `/app/veilles/$id` : tabs Opportunités vide (scout pas encore lancé), Évolutions locked Free, Historique vide

### 7.4 Déclenchement manuel d'un scout
- [ ] Depuis le dashboard Trigger.dev → `watch-scout` → trigger avec
       payload `{ "watchId": "<uuid>" }`
- [ ] Vérifier `watch_runs.status = succeeded` + `items_scraped` > 0
- [ ] Vérifier au moins 1 row dans `watch_listings`
- [ ] Vérifier au moins 1 `watch_events.event_type = new_match` si score ≥ threshold

### 7.5 Digest email
- [ ] Trigger manuellement `watch-digest-mailer-standard`
- [ ] Vérifier réception email avec section "🆕 Nouveaux biens", floutage Free actif
- [ ] Cliquer un lien CTA "Passer Pro" → vérifier que l'URL contient
      `?utm_source=immoscan_email&utm_campaign=watch_digest`
- [ ] PostHog : voir `email_clicked` event avec `source=watch_digest`

### 7.6 Upgrade Pro
- [ ] Sur `/app/billing`, cliquer "Passer Pro mensuel"
- [ ] Stripe Checkout sandbox → utiliser carte test `4242 4242 4242 4242`
- [ ] Retour sur `/app/billing?status=success`
- [ ] Vérifier `profiles.subscription_plan = "pro"` + `subscription_status = "trialing"`
- [ ] Vérifier `watches.expires_at = null` (nullifié par webhook)
- [ ] PostHog : voir `plan_upgraded` event

### 7.7 Quota / PPU
- [ ] Avec un compte Free toujours, acheter un PPU 14,90€
- [ ] Vérifier 2 rows dans `entitlements` (`ppu_analysis` pending + `ppu_watch_bonus` pending)
- [ ] Re-lancer une analyse → consomme le PPU (status `consumed`)

### 7.8 Expiration veille
- [ ] Côté SQL, set manuellement `watches.expires_at = now() + interval '10 days'`
       pour tester le J-10 :
   ```sql
   update watches set expires_at = now() + interval '10 days' where id = '<test_watch>';
   ```
- [ ] Trigger `watch-expiration-mailer`
- [ ] Vérifier réception email + `expiration_emails_sent = ['free_warn_J10']`
- [ ] Re-trigger immédiatement → vérifier idempotence (skip, pas de 2e email)

### 7.9 Pages légales
- [ ] Vérifier accès direct : `/legal/cgu`, `/legal/cgv`, `/legal/confidentialite`, `/legal/mentions-legales`
- [ ] Vérifier footer présent et liens fonctionnels
- [ ] Vérifier signup-form pointe vers `/legal/cgu` (pas `/cgu`)

---

## 8. Monitoring + alerting (~20 min)

- [ ] **Sentry** : vérifier que le worker + frontend envoient bien des events
       de test
- [ ] **PostHog Insights** : créer le funnel `signup → analysis_started → watch_created → plan_upgraded`
- [ ] **BetterStack uptime** : ajouter les 3 endpoints critiques :
   - `https://app.immoscan.fr/` (frontend)
   - `https://vztzzysrainmznjnurbl.supabase.co/functions/v1/trigger-analyze` (HEAD ping)
   - `https://api.trigger.dev/...` (status worker)
- [ ] **Trigger.dev alerts** : configurer notif Slack/email sur task failure

---

## 9. Pré-launch : checklist juridique

- [ ] CGU/CGV/Confidentialité/Mentions Légales relus par avocat
- [ ] Remplir tous les `[à compléter]` dans `mentions-legales.tsx` :
   SIRET, RCS, capital, adresse, directeur de publication, médiateur conso
- [ ] Vérifier que l'adresse email `privacy@immoscan.fr` existe et reçoit les emails
- [ ] CNIL : déclaration faite si requis (généralement pas nécessaire pour
       un SaaS simple, mais à valider avec le DPO/avocat)

---

## 10. Bascule LIVE Stripe (jour J)

Le jour du launch public, refaire les étapes §2 mais avec `sk_live_xxx`
au lieu de `sk_test_xxx`. Garder le mode sandbox actif en parallèle pour
les tests en environnement staging.

---

## 11. Post-launch (J+1 à J+7)

- [ ] Monitorer PostHog quotidiennement : signup → analysis_started → watch_created → plan_upgraded
- [ ] Vérifier les coûts Apify quotidiennement (alerter si > $5/jour)
- [ ] Vérifier les coûts Anthropic quotidiennement
- [ ] Vérifier le taux d'ouverture digest email (cible >40% selon BM §12)
- [ ] Vérifier la délivrabilité Resend (bounces, spam reports)
- [ ] À J+7 : premier point conversion Free → Pro (cible >5% à J+60 selon BM §7)

---

## Récap : 11 étapes, ~1 jour de manip

| Étape | Durée | Bloquante ? |
|---|---|---|
| 0. Pré-requis | dépend du contexte | oui (KYC Stripe, etc.) |
| 1. Import DVF | 1h | non (signal_to_verify dégradé sans) |
| 2. Seed Stripe | 30 min | **oui** |
| 3. Resend + DKIM | 30 min | **oui** (sinon pas d'emails) |
| 4. Deploy Edge Functions | 10 min | **oui** |
| 5. Deploy Worker | 10 min | **oui** |
| 6. Deploy Web | 5 min | **oui** |
| 7. Smoke test E2E | 30 min | **oui** (validation) |
| 8. Monitoring | 20 min | non (peut être J+1) |
| 9. Juridique | dépend de l'avocat | **oui** (relecture CGU) |
| 10. Bascule LIVE Stripe | 30 min | **oui** |
| 11. Post-launch monitoring | continu | non |
