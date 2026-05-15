# Architecture ImmoScan

Référence des décisions structurantes. Toute question du type "pourquoi a-t-on fait X comme ça ?" doit avoir sa réponse ici.

## Vue d'ensemble

```
                   ┌──────────────────────────────────────────────────┐
                   │                  Vercel CDN                       │
                   │           apps/web (React + Vite)                 │
                   │                                                   │
                   │   ┌─────────────────────────────────────────────┐ │
                   │   │  Lit listings_freemium_view (RLS + masque)  │ │
                   │   └─────────────────────────────────────────────┘ │
                   └────────────────┬─────────────────────────────────┘
                                    │ anon key
                                    ▼
                   ┌──────────────────────────────────────────────────┐
                   │      Supabase IMMOSCAN-APP (eu-west-3 Paris)     │
                   │  profiles, analyses, listings, scores, watches,  │
                   │  pipeline, subscriptions — RLS sur tout          │
                   │  Vue listings_freemium_view (masque côté serveur)│
                   │  Realtime: progress des analyses                 │
                   └────────────────┬─────────────────────────────────┘
                                    │ service_role
                                    ▼
                   ┌──────────────────────────────────────────────────┐
                   │           Trigger.dev v3 cloud workers            │
                   │   apps/worker — orchestration jobs longs          │
                   │   • analyze.run (10 min max)                      │
                   │   • watch.run (cron quotidien/hebdo)              │
                   │   • imports.dvf / .insee / .ademe / .georisques   │
                   │   • stripe.webhook handler                        │
                   └────┬───────────┬──────────────┬───────────────┬───┘
                        │           │              │               │
                        ▼           ▼              ▼               ▼
                  ┌─────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐
                  │ Apify   │ │Anthropic │ │  Supabase    │ │ Stripe   │
                  │ SeLoger │ │ Sonnet/  │ │ IMMOSCAN-    │ │ Resend   │
                  │ + LBC   │ │ Opus     │ │ DATA         │ │ BAN      │
                  │         │ │          │ │ (DVF, INSEE, │ │ ADEME    │
                  │         │ │          │ │  ADEME...)   │ │Géorisques│
                  └─────────┘ └──────────┘ └──────────────┘ └──────────┘
```

## Décisions structurantes

### 1. Deux projets Supabase distincts

**Décision** : `immoscan-app` (transactionnel, RLS) et `immoscan-data` (référentiels publics, no RLS, service_role only). Tous deux en eu-west-3 Paris.

**Pourquoi** :
- DVF+ pèse ~3 Go en Postgres avec index PostGIS et se ré-importe tous les trimestres. Le coller dans la DB applicative, c'est risquer de couper le service pendant les imports et de devoir scaler le compute pour le mauvais usage.
- Coûts : 2× Supabase Pro à ~25€/mois ≪ 1× Team à 599€/mois.
- Backup et restore séparés. Si on corrompt DVF, on ne touche pas aux user data.

**Conséquences** :
- Le frontend n'a **jamais** d'accès direct à `immoscan-data`. Tout passe par un worker qui matérialise dans `immoscan-app`.
- Génération des types : `pnpm db:types:app` et `pnpm db:types:data` séparément, exportés via `@immoscan/db/app` et `@immoscan/db/data`.

### 2. Freemium teasing côté serveur

**Décision** : Le masquage des données premium (prix, adresse, lien, lat/lng, thèse Claude) pour les biens >70/100 chez les users Free est implémenté dans une vue SQL `listings_freemium_view`. Le frontend interroge **toujours** la vue, jamais les tables `listings` ou `listing_scores` directement.

**Pourquoi** :
- Sécurité : impossible pour un user Free d'extraire les données via DevTools. Les données ne quittent jamais Postgres.
- Simplicité frontend : pas de branche conditionnelle "tu es free ou pas". Tu lis, tu affiches `null` → tu affiches CTA upgrade.
- Cohérence : la même vue sert le tableau, la carte, l'export CSV. Pas de duplication de logique.

**Conséquences** :
- RLS sur `listings` et `listing_scores` : `using (false)` pour `authenticated`. Lecture en direct impossible.
- Vue `with (security_invoker = true)` pour respecter les RLS sous-jacentes via `analyses.profile_id = auth.uid()`.
- Le flag `is_masked` exposé par la vue indique au frontend qu'il y a quelque chose de floué (déclenche le CTA upgrade).

### 3. Trigger.dev pour les jobs longs

**Décision** : Tous les jobs > 10 secondes (analyse complète, imports DVF, veilles) tournent dans Trigger.dev v3, pas dans des Edge Functions Supabase.

**Pourquoi** :
- Une analyse complète prend 3-8 min : impossible avec Edge Functions (timeout 50s sur le plan Pro, 150s sur Pro+).
- Retries, observabilité, dashboards, dead letter queue sortent du carton dans Trigger.dev.
- Versioning des tasks et déploiements atomiques (`trigger.dev deploy`).

**Conséquences** :
- L'app web déclenche les jobs via `tasks.trigger("analyze-listing", payload)`.
- Le suivi de progression se fait via Supabase Realtime sur la table `analyses` (le worker UPDATE `progress_pct`).
- Cron jobs (veilles, imports trimestriels) déclarés dans `apps/worker/src/trigger/`.

### 4. Monorepo pnpm avec packages partagés

**Décision** : `apps/web`, `apps/worker`, `packages/shared`, `packages/db` dans le même repo, pnpm workspaces, TypeScript project references.

**Pourquoi** :
- Le scoring est la même logique entre frontend (prévisualisation des paramètres avant de lancer une analyse) et worker (calcul réel). Une seule source de vérité.
- Les schémas Zod valident à la fois les formulaires (frontend) et les payloads jobs (worker). Une rupture de typage casse à la compilation, pas en prod.
- pnpm est strict sur les phantom dependencies, ce qui force à déclarer ce qu'on importe.

**Conséquences** :
- Toute logique partagée va dans `packages/shared`. Si tu copies-colles entre `apps/web` et `apps/worker`, c'est un signal que ça appartient à `shared`.
- Les types Supabase générés sont dans `packages/db` pour éviter de les régénérer dans chaque app.

### 5. Scoring en logique pure

**Décision** : Le calcul du score /100 et des sous-scores vit dans `packages/shared/src/scoring/`, en fonctions pures sans dépendance externe (pas de fetch, pas de Supabase).

**Pourquoi** :
- Testable unitairement avec Vitest. Garanties de non-régression sur le métier.
- Affichable côté frontend pour les recalculs "live" quand le user ajuste ses paramètres dans la page résultats (Pro+).
- Versionnable : chaque score persisté en DB stocke sa `scoring_version`. Si on change la formule, les anciens scores restent reproductibles.

**Conséquences** :
- Le worker enrichit le bien avec les données marché (DVF médian, OLL loyer médian, Géorisques) **avant** d'appeler le scoring. Le scoring ne fetch rien.
- Les tests Vitest sont obligatoires sur tout changement du scoring.

### 6. Cache scraping à deux niveaux

**Décision** : Deux niveaux de cache pour les appels Apify, stockés dans `immoscan-app` :
- URL de recherche : 24h. Si le user relance la même URL, on sert le résultat existant.
- Annonce individuelle : 7 jours, invalidé si le prix bouge ou si le user clique "Re-analyser".

**Pourquoi** : Apify coûte cher. Économie attendue ~60% des appels dès 100 users actifs.

**Conséquences** :
- Avant chaque ingestion, le worker check le cache. Voir `apps/worker/src/services/cache.ts` (à coder en PR3).
- Le cache annonce est utilisé en mode veille : on ne ré-appelle Apify que pour les annonces nouvelles ou modifiées.

### 7. Anthropic API directe, pas via un orchestrateur

**Décision** : Le worker appelle directement l'API Anthropic. Modèle par défaut `claude-sonnet-4-6`, modèle premium `claude-opus-4-7` pour le plan Business.

**Pourquoi** :
- Sonnet fait 95% du job qualitativement à 1/5e du coût.
- Pas besoin d'un LangChain ou autre : 2-3 prompts structurés via tool_use suffisent.
- Output validé par schémas Zod (voir `claudeThesisOutputSchema` dans `packages/shared/src/schemas/score.ts`).

**Conséquences** :
- Une seule helper `callClaude<T>(model, system, user, schema)` dans `apps/worker/src/services/claude.ts` (à coder en PR4).
- Cache des thèses Claude 30 jours par hash `(listing_id, scoring_version, params_snapshot)`.

## Hiérarchie des dossiers

```
apps/web/src/
├── components/           # OWNED BY CLAUDE DESIGN — primitives UI, pas de Supabase
│   └── ui/              # shadcn primitives
├── features/            # OWNED BY CLAUDE CODE — containers data-aware
│   ├── analysis/
│   ├── pipeline/
│   ├── watches/
│   └── billing/
├── lib/                 # OWNED BY CLAUDE CODE — clients, hooks utilitaires
│   ├── supabase.ts
│   └── utils.ts
├── routes/              # OWNED BY CLAUDE CODE — TanStack Router
├── hooks/               # OWNED BY CLAUDE CODE — useAnalyses, usePlan, etc.
└── styles/              # OWNED BY CLAUDE DESIGN — index.css, tokens

apps/worker/src/
├── trigger/             # Tasks Trigger.dev (1 fichier = 1 task)
├── services/            # apify, claude, geocoder, stripe — clients externes
└── lib/                 # supabase clients service_role, utilities
```

Voir `docs/design-integration.md` pour le détail du contrat Claude Design / Claude Code.
