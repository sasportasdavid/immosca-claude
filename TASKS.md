# TASKS.md — Plan de sprint Claude Code

5 PR séquentielles. Une PR = un sujet, une PR mergée avant d'attaquer la suivante. Total ~3 semaines de dev solo.

Lire `CLAUDE.md` avant de commencer chaque PR. En cas d'ambiguïté, demander avant de coder.

---

## PR0 — Bootstrap (déjà fait dans ce starter)

✅ Monorepo pnpm, configs TS/ESLint/Prettier
✅ Migrations Supabase `immoscan-app` et `immoscan-data`
✅ Schémas Zod dans `@immoscan/shared`
✅ Module scoring + tests Vitest
✅ Skeletons `apps/web` et `apps/worker`
✅ Docs architecture + design-integration + data-sources

**Action** : merger ce starter, brancher les comptes (Supabase × 2, Apify, Anthropic, Stripe, Resend, Trigger.dev, Sentry, PostHog, BetterStack), exécuter `pnpm install`, vérifier que `pnpm typecheck` + `pnpm test` passent.

---

## PR1 — Foundation & auth

**Objectif** : un user peut s'inscrire, se connecter, faire son onboarding (paramètres d'investissement). Le frontend a sa coquille routée. Le worker répond au hello-world. Sentry et PostHog tournent.

**Délai estimé** : 2-3 jours

### Backend

- [ ] Appliquer les migrations `immoscan-app` (`pnpm db:migrate:app`)
- [ ] Vérifier que le trigger `handle_new_user` crée bien le profile à l'inscription
- [ ] Tester les RLS via Supabase Dashboard (deux users, un ne voit pas les analyses de l'autre)
- [ ] Tester la vue `listings_freemium_view` avec un user free vs pro
- [ ] Activer Supabase Auth : email + password, magic link, et Google OAuth

### Worker

- [ ] Initialiser Trigger.dev (`npx trigger.dev@latest init` dans `apps/worker`)
- [ ] Déployer la task `hello-world` en dev (`pnpm dev:worker`)
- [ ] Brancher Sentry node dans le worker
- [ ] Vérifier que `apps/worker/src/lib/supabase.ts` instancie correctement les deux clients

### Frontend

- [ ] **Phase Design d'abord** : créer le design system de base
  dans `apps/web/src/index.css` (tokens couleurs ImmoScan, override
  des placeholders neutres actuels) et 3 composants présentationnels
  clés dans `apps/web/src/components/` : `<ScoreBadge />`,
  `<ListingCard />`, `<AppHeader />`. Tous reçoivent par props,
  aucun fetch. Commit `design:`.
- [ ] **Phase Code ensuite** : routes TanStack, hooks, containers,
  guards (cf items ci-dessous).
- [ ] Pages routes via TanStack Router :
  - `/` (landing)
  - `/auth/login`
  - `/auth/signup`
  - `/onboarding/step-1` (stratégie)
  - `/onboarding/step-2` (paramètres financiers)
  - `/dashboard`
- [ ] Hook `useAuth` (état session, sign in/up/out)
- [ ] Hook `useProfile` (lecture du profile via Supabase)
- [ ] Hook `useUserParams` (création + update via `userParamsInputSchema`)
- [ ] Containers feature pour les formulaires d'onboarding (validation Zod côté client)
- [ ] Guard auth sur `/dashboard/*` (redirect `/auth/login` si pas de session)
- [ ] PostHog identify à l'auth, `$set` du plan
- [ ] Sentry captureContext avec `user.id` (pas d'email)

### CI

- [ ] GitHub Actions : `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test`
- [ ] Branche protégée `main`, review obligatoire

**Critère de fin** : je peux m'inscrire, faire l'onboarding, atterrir sur `/dashboard` (page vide pour l'instant), me déconnecter, me reconnecter. Sentry capture une erreur de test, PostHog enregistre l'event `signup_completed`. Les composants Design (ScoreBadge, ListingCard, AppHeader) s'affichent correctement avec des props hardcodées dans une page démo `/dev/components` (à supprimer après PR1).

---

## PR2 — Référentiel data (immoscan-data)

**Objectif** : `immoscan-data` est populé avec les sources critiques pour scorer correctement. Au moins DVF France entière, INSEE IRIS, Géorisques sont prêts.

**Délai estimé** : 3-4 jours

### Setup

- [ ] Appliquer migration `immoscan-data` (`pnpm db:migrate:data`)
- [ ] Activer extension PostGIS dans le dashboard Supabase

### Imports

- [ ] **DVF+** : task `imports/dvf.ts`
  - Téléchargement du CSV trimestriel (France entière)
  - Streaming insert via `COPY` ou batches de 10k lignes
  - Refresh des vues matérialisées `dvf_medians_commune` et `dvf_medians_iris`
  - Cron : `0 3 1 */3 *` (trimestre + 1 jour)
- [ ] **INSEE IRIS géoms** : task `imports/insee_iris.ts`
  - GeoJSON IGN, insertion en `geometry(MultiPolygon, 4326)`
- [ ] **INSEE Filosofi** : task `imports/insee_filosofi.ts`
  - CSV par IRIS, mapping vers `insee_filosofi`
- [ ] **Géorisques** : task `imports/georisques.ts`
  - Crawl par commune (35k communes, respect du rate limit)
  - Stockage des risques synthétisés dans `georisques_communes`
- [ ] **BAN** : client `services/ban.ts` avec cache 90 jours
- [ ] **Banque de France** : task `imports/banque_de_france.ts`, cron mensuel

### Observabilité

- [ ] Chaque task write `import_runs` (started_at, completed_at, rows_imported, status)
- [ ] Heartbeat BetterStack après chaque cron réussi
- [ ] Sentry capture les imports failed

**Critère de fin** : `select count(*) from dvf_mutations` retourne ~5M lignes. `select * from dvf_medians_commune where code_commune = '93031'` retourne les médianes Gagny cohérentes (~4192€/m² appartements). `georisques_communes` couvre les 35k communes.

---

## PR3 — Ingestion scraping (Apify)

**Objectif** : un user lance une analyse depuis une URL SeLoger / Leboncoin, le worker scrape, normalise, et stocke les listings dans `immoscan-app`. Pas encore de scoring.

**Délai estimé** : 4-5 jours

### Services

- [ ] `services/apify.ts` : wrapper Apify avec retry exponentiel, timeout, budget tracking
- [ ] Détection auto du site via `detectSourceFromUrl()` (déjà dans `@immoscan/shared`)
- [ ] Choix actor : actor `compass/seloger-scraper` ou équivalent public pour SeLoger, idem LBC
- [ ] Cache à deux niveaux dans `immoscan-app` :
  - Table `apify_url_cache` (TTL 24h sur l'URL de recherche)
  - Table `apify_listing_cache` (TTL 7j sur chaque annonce, invalidé si prix change)
  - Migration séparée `20260601000000_apify_cache.sql`
- [ ] Normalisation `apifyRawListingSchema` → `listingInputSchema` via mapper par site
- [ ] Géocodage des adresses via BAN, avec fallback graceful si BAN down

### Task d'analyse

- [ ] `trigger/analyze.ts` :
  - Lit l'analyse, met à jour `status` et `progress_pct` à chaque étape
  - Étape 1 : `scraping` (20%) → appel Apify, parsing
  - Étape 2 : `enriching` (50%) → géocodage, DPE ADEME (cache 30j), Géorisques par commune
  - Étape 3 : `done` (100%) → met à jour `total_listings_*`, `median_price_per_sqm`
  - Sur erreur : status `failed`, message dans `error_message`, Sentry capture
- [ ] Limite stricte `MAX_LISTINGS_PER_ANALYSIS = 1000` (déjà dans constants)
- [ ] Budget Apify : avant chaque scrape, query l'usage du mois courant via Apify API, si > 150€ → alerte BetterStack + skip

### Frontend

- [ ] Page `/analyze/new` : formulaire URL (validation `analysisCreateInputSchema`)
- [ ] Création de l'analyse en DB, déclenchement de la task Trigger.dev via Edge Function ou via insert direct (à arbitrer)
- [ ] Page `/analyze/[id]` : suivi temps réel via Supabase Realtime sur la table `analyses`
- [ ] Tableau des listings (via `listings_freemium_view`)
- [ ] Composant `ListingTable` (Claude Design) + `ListingTableContainer` (Claude Code)

### Tests

- [ ] Fixtures dans `apps/worker/src/__fixtures__/apify-seloger-gagny.json`
- [ ] Test du mapper apify→listing avec ces fixtures
- [ ] Test du budget tracking (mock Apify API)

**Critère de fin** : je colle une URL SeLoger Gagny, je clique "Analyser", 30 secondes plus tard je vois ~150 listings dans le tableau (sans scores encore, juste les données brutes normalisées).

---

## PR4 — Scoring + Claude (le cœur produit)

**Objectif** : chaque listing reçoit son score /100, ses sous-scores, ses indicateurs financiers, et le top 5 reçoit en plus une thèse Claude écrite.

**Délai estimé** : 3-4 jours

### Worker — étape scoring

- [ ] Dans `trigger/analyze.ts`, ajouter l'étape `scoring` (70%) après l'enrichissement :
  - Pour chaque listing, enrichir avec :
    - `prix_m2_median_commune` et `prix_m2_median_iris` depuis `dvf_medians_*`
    - `loyer_m2_median_zone` depuis `oll_loyers_medians` (zone OLL ou commune fallback)
    - Risques depuis `georisques_communes`
  - Appel `computeScore()` depuis `@immoscan/shared`
  - Insertion dans `listing_scores`
- [ ] Test : sur les fixtures Gagny, le top score doit être >= 80

### Worker — thèse Claude

- [ ] `services/claude.ts` : helper `callClaudeStructured<T>(model, system, user, schema)` avec tool_use forcé
- [ ] `services/prompts/thesis.ts` : prompt système "tu es un investisseur immobilier sénior" + template user avec tous les chiffres du bien
- [ ] Étape `generating` (90%) dans `analyze.ts` :
  - Top 5 par score : appel Claude Sonnet (Opus si plan Business)
  - Output validé par `claudeThesisOutputSchema`
  - Insertion dans `listing_scores.these_claude / financement_claude / negociation_claude / prix_negociation_cible / verdict`
- [ ] Cache des thèses 30 jours, clé : `hash(listing_id + scoring_version + params_snapshot)`
- [ ] Tracking des tokens : `claude_model`, `claude_tokens_used` dans `listing_scores`

### Worker — synthèse marché

- [ ] `services/prompts/market.ts` : prompt pour la synthèse globale de l'analyse
- [ ] Output validé par `claudeMarketSynthesisSchema`
- [ ] Stocké dans une nouvelle colonne `analyses.market_synthesis jsonb` (migration séparée)

### Frontend

- [ ] Tableau triable par score, filtrable par DPE / surface / rendement
- [ ] Composant `ScoreBadge` (Design) qui utilise les CSS vars `--score-*`
- [ ] Vue détaillée d'un listing avec thèse Claude (`/analyze/[id]/listing/[lid]`)
- [ ] Onglet "Synthèse marché" avec micro-quartiers et recommandations d'affinage
- [ ] Pour le Free : blur + lock icon + CTA upgrade sur tous les biens >70 (le `is_masked` de la vue suffit)

**Critère de fin** : pour l'URL Gagny test, je vois 661 listings scorés, le top 5 a une thèse Claude argumentée, la synthèse marché affiche 3 micro-quartiers (Chénay, centre-ville, autres). En mode Free, les biens >70/100 sont visibles mais flouttés avec CTA upgrade.

---

## PR5 — Loyers + Risques (compléter le modèle)

**Objectif** : combler les zones non-OLL avec du scraping locatif, finaliser le scoring quartier, et brancher l'encadrement de loyer pour les villes concernées.

**Délai estimé** : 3 jours

- [ ] Import OLL pour les ~50 territoires couverts
- [ ] Import encadrement Paris/Lille/Lyon/Bordeaux/Montpellier
- [ ] Scraping SeLoger Louer + LBC Louer pour combler les zones non-OLL (cron hebdo via Trigger.dev)
- [ ] Améliorer `scoreQuartier()` dans `@immoscan/shared/scoring` :
  - Revenu médian IRIS (Filosofi)
  - Densité école IPS dans 1 km
  - Présence transport via GTFS (à brancher en PR6)
- [ ] Tests Vitest sur le nouveau `scoreQuartier`
- [ ] Vérifier que les biens en zone encadrée affichent le loyer de référence et un warning si le loyer estimé le dépasse

**Critère de fin** : pour un bien à Paris 11e, je vois `loyer_estime`, `loyer_reference_majore`, et un indicateur visuel si le loyer est conforme ou non. Le score quartier varie entre 30 et 90 selon les quartiers (avant : toujours 50).

---

## PR6+ (backlog non priorisé)

- Veilles + alertes email (Resend) — pricing-critical pour Pro+
- Pipeline Kanban (drag & drop, photos personnelles, ajustement params post-visite)
- Export CSV + PDF (PDF via puppeteer ou bibliothèque côté worker)
- Stripe Billing : checkout, customer portal, webhook handler.
  - **Price IDs récurrents** (4) : `PRO_MONTHLY`, `PRO_YEARLY`, `PRO_PLUS_MONTHLY`, `PRO_PLUS_YEARLY`.
  - **Price IDs one-shot** (3) : `PAYG_SINGLE`, `PAYG_PACK_5`, `PAYG_PACK_20` (analyses débloquées à vie sur le compte, indépendamment du plan).
  - **Switch mensuel ↔ annuel** : on attend la fin du cycle en cours, pas de pro-rata.
  - **Downgrade Pro+ → Pro** : attente fin de cycle, veilles excédentaires passées en lecture seule (pas supprimées).
  - **Hard cap quota** : pas de soft cap. Quand un user atteint son plafond mensuel d'analyses, il choisit entre upgrade ou achat pay-per-use.
- Mode partage public d'une analyse (URL signée, expiration)
- Storybook pour les composants Design
- Tests E2E Playwright sur les parcours critiques (signup → analyse → upgrade)
- Mode chasseur pour CGP et chasseurs immo (rapport whitelabelé)
- Mode "Marketplace" pour mandats hors-marché (futur, post-PMF)

---

## Conventions de PR

- **Une PR = un sujet**. Pas de "refactor + feature" dans la même PR.
- **Description** : objectif, ce qui change, ce qui ne change pas, comment tester en local.
- **Migrations** : toujours dans leur propre commit en début de PR, avec rollback en commentaire.
- **Tests** : Vitest pour le scoring et les mappers, manuel pour le reste (jusqu'à PR6).
- **Review** : Mounir review chaque PR. Si désaccord sur une décision structurante, on en parle avant.

## Quand est-ce qu'on shippe ?

Vise un MVP testable par 5-10 beta users à la fin de la PR4. Le plan ressemble à :

| Semaine | PR | État produit |
|---|---|---|
| S1 | PR1 | Auth + onboarding fonctionnels, dashboard vide |
| S1-S2 | PR2 | Référentiel data populé, prêt à scorer |
| S2-S3 | PR3 | Une analyse retourne 100-500 listings normalisés |
| S3 | PR4 | **MVP démoable** : scoring + thèse Claude visibles |
| S4 | PR5 | Loyers + risques fiables sur la France entière |
