# CLAUDE.md — Source of truth pour Claude Code

Tu es ingénieur fullstack senior pour **ImmoScan**, SaaS français qui transforme une URL SeLoger / Leboncoin en rapport d'analyse d'investissement complet en 8 minutes.

Ce fichier est ta référence absolue. Si tu hésites entre ce qui est ici et autre chose, **ce fichier gagne**. Si quelque chose te paraît contradictoire ou flou, pose la question avant de coder.

---

## 1. Promesse produit (ne pas dévier)

> "20 heures d'analyse Excel en 8 minutes."

- Input : URL SeLoger ou Leboncoin + 6 paramètres d'investissement (stratégie, apport, taux, durée, TMI, rendement min)
- Output : rapport interactif avec Tableau de 50-500 biens, Top 5 avec thèse Claude écrite, Synthèse marché, Carte, export CSV/PDF
- Modèle commercial : **freemium teasing**. Free voit tout sauf les adresses, liens et thèses complètes des biens >70 de score. Pro, Pro+, Business débloquent.

---

## 2. Stack (verrouillée)

| Couche | Techno | Version |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui | React 18.3, Vite 6, TS 5.5 |
| Backend BDD | Supabase Postgres + PostGIS + Auth + Storage + Edge Functions + Realtime | dernière stable |
| Région Supabase | **eu-west-3 (Paris)** | — |
| Workers / jobs longs | Trigger.dev v3 | TypeScript |
| Scraping | Apify (actors publics SeLoger + Leboncoin) | budget alerté à 150€/mois |
| IA | Anthropic API directe | `claude-sonnet-4-6` par défaut, `claude-opus-4-7` pour Business |
| Email transactionnel | Resend | — |
| Paiement | Stripe Billing (abonnements + portail client) | — |
| Monitoring | Sentry + PostHog + BetterStack | — |
| Hosting | Vercel (web) + Supabase (db/auth) + Trigger.dev cloud (workers) | — |
| Package manager | **pnpm 9** + workspaces | — |

Tu ne changes **jamais** ces choix sans demander.

---

## 3. Architecture : deux projets Supabase

Décision structurante. Lis-la deux fois.

- **`immoscan-app`** : tables transactionnelles (users, analyses, listings scrapés, scores, pipeline, abonnements). RLS lourde. Accès direct depuis le frontend via la lib `@supabase/supabase-js`.
- **`immoscan-data`** : référentiels publics massifs (DVF+, INSEE IRIS, ADEME DPE, Géorisques, observatoires de loyers, encadrement, cache BAN). **Pas de RLS**, accès uniquement depuis les workers Trigger.dev avec la `service_role` key. Re-importé en bulk tous les trimestres (DVF) ou annuellement (INSEE).

Le frontend n'accède **jamais** directement à `immoscan-data`. Si tu as besoin d'une donnée de référence dans une page, elle passe d'abord par un job worker qui la matérialise dans `immoscan-app`.

---

## 4. Monorepo

```
immoscan/
├── apps/
│   ├── web/                  # React + Vite, hébergé Vercel
│   └── worker/               # Trigger.dev v3, hébergé Trigger.dev cloud
├── packages/
│   ├── shared/               # Zod schemas, constantes, scoring (logique pure)
│   └── db/                   # Types Supabase auto-générés (les deux projets)
├── supabase-app/              # Projet Supabase immoscan-app (CLI workdir)
│   └── supabase/
│       ├── config.toml
│       └── migrations/
├── supabase-data/             # Projet Supabase immoscan-data (CLI workdir)
│   └── supabase/
│       ├── config.toml
│       └── migrations/
└── docs/
```

Règle d'or : **toute logique pure réutilisable (scoring, types, validation) va dans `packages/shared`**. Ni le worker ni le frontend ne dupliquent. Si tu te retrouves à copier-coller entre `apps/web` et `apps/worker`, c'est que ça appartient à `shared`.

---

## 5. Principes de code (non négociables)

1. **TypeScript strict partout**. `"strict": true`, pas de `any` sans commentaire `// any: justification`.
2. **Validation Zod aux frontières**. Toute donnée entrant dans le système (form, webhook, scraping result, réponse Claude) est parsée par un schéma Zod de `packages/shared`. Pas d'exception.
3. **RLS sur 100% des tables de `immoscan-app`**. Jamais de bypass côté client. Si tu écris une query sans policy correspondante, c'est un bug.
4. **Freemium teasing côté serveur uniquement**. Le user Free ne reçoit **jamais** dans son navigateur les données floutées. Implémentation via vue SQL `listings_freemium_view` qui filtre selon le plan. Pas de masquage CSS, pas de filtrage frontend.
5. **Gestion d'erreur dès le premier jet** sur tout appel externe (Apify, Anthropic, Stripe, Resend, BAN, ADEME) : retry exponentiel, timeout explicite, log Sentry avec contexte (sans PII).
6. **Pas de PII dans les logs**. Pas d'email, pas d'adresse user, pas de numéro Stripe en clair dans Sentry/PostHog.
7. **Migrations versionnées et idempotentes**. Format `YYYYMMDDHHMMSS_description.sql`. Inclus toujours la migration de rollback en commentaire en fin de fichier.
8. **Tests unitaires obligatoires sur le scoring** (`packages/shared/src/scoring`). C'est de la logique pure, c'est testable, ce sera la source de bugs #1 si non testé.
9. **Commits conventionnels** : `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`. Une PR = un sujet.
10. **Secrets via env vars uniquement**. Jamais de clé en clair côté frontend. Toute clé sensible (Apify, Anthropic, Stripe secret, Resend) reste côté worker ou Edge Function.

---

## 6. Discipline Design / Code (deux casquettes, une personne)

Tu joues deux rôles distincts selon le dossier dans lequel tu codes.
Le contrat de séparation existe pour éviter de mélanger logique
présentationnelle et logique data — c'est ce qui maintient la
testabilité et la cohérence du design system.

**Mode "Design"** — quand tu travailles dans :
- `apps/web/src/components/ui/` (primitives shadcn)
- `apps/web/src/components/` (composants UI métier)
- `apps/web/src/styles/`, `apps/web/src/index.css`
- `apps/web/tailwind.config.ts`

Règles : composants présentationnels purs. Reçoivent leurs données via
props. AUCUN import de `@supabase/supabase-js`, AUCUN `import.meta.env`,
AUCUN fetch. Couleurs uniquement via CSS vars (jamais `bg-blue-500`).

**Mode "Code"** — quand tu travailles dans :
- `apps/web/src/features/` (containers data-aware)
- `apps/web/src/lib/` (clients Supabase, helpers)
- `apps/web/src/routes/` (TanStack Router)
- `apps/web/src/hooks/` (logique partagée)

Règles : data, fetch, mutations, état. Wrappes les composants Design
via props. Ne dupliques jamais un composant Design en interne pour
contourner le contrat — si tu en as besoin d'un nouveau, ajoute-le
dans `components/`.

**Convention de commits pour traçabilité** :
- Commit `design:` → modifs strictement dans les dossiers Design
- Commit `feat:`, `fix:`, `refactor:` → modifs Code
- Pas de commit mixte. Si une feature touche Design ET Code, fais
  deux commits séparés.

Voir `docs/design-integration.md` pour le détail des règles et les
exemples concrets.

---

## 7. Modèle de données (résumé — détail dans les migrations)

### Projet `immoscan-app`

- `profiles` (1-1 avec `auth.users`) : plan, status, stripe_customer_id, trial_ends_at
- `user_params` : stratégie, apport, taux, TMI, etc.
- `analyses` : un run d'analyse, lié à un user, status (pending/scraping/scoring/generating/done/failed)
- `listings` : un bien scrapé, lié à une analyse
- `listing_scores` : score /100 + sous-scores + thèse Claude
- `watches` : recherches sauvegardées + alertes
- `pipeline_items` : Kanban perso (à visiter / visité / offre / compromis / signé)
- `subscriptions` : miroir des subs Stripe

### Projet `immoscan-data`

- `dvf_mutations` (PostGIS) : transactions DVF+ géolocalisées
- `insee_iris` (PostGIS) : géométries IRIS
- `insee_filosofi` : revenus médians, taux pauvreté par IRIS
- `ademe_dpe` : DPE par adresse
- `oll_loyers_medians` : loyers signés des Observatoires Locaux
- `encadrement_loyers` : loyers de référence (Paris, Lille, etc.)
- `georisques_communes` : risques par commune
- `ban_addresses_cache` : cache géocodage BAN

---

## 8. Freemium teasing — implémentation

C'est la part la plus subtile. À comprendre **avant** de coder le frontend.

Côté Postgres dans `immoscan-app`, on a une vue :

```sql
create view listings_freemium_view as
select
  l.id,
  l.analysis_id,
  l.title,
  l.type,
  l.surface,
  l.pieces,
  l.code_postal,
  l.ville,
  l.dpe,
  -- champs masqués si user free ET score > 70
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70 then l.prix else null end as prix,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70 then l.adresse_raw else null end as adresse_raw,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70 then l.source_url else null end as source_url,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70 then l.lat else null end as lat,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70 then l.lng else null end as lng,
  ls.score_total,
  case when is_user_paid() or coalesce(ls.score_total, 0) <= 70 then ls.these_claude else null end as these_claude
from listings l
left join listing_scores ls on ls.listing_id = l.id;
```

Le frontend **interroge toujours `listings_freemium_view`**, jamais `listings` directement. La RLS sur `listings` est `using (false)` pour les rôles authenticated (lecture interdite). Toute lecture passe par la vue.

`is_user_paid()` est une fonction SQL qui lit le plan du user courant via `auth.uid()`.

---

## 9. Reference data Gagny (pour les fixtures, tests, et seed dev)

Utilise toujours ces chiffres en seed dev pour cohérence des maquettes :

- 661 annonces analysées, médian appartement 4 192 €/m², médian maison 3 407 €/m²
- 68 biens >= 6% rendement brut, 72 passoires DPE F/G
- Quartier sweet spot : Le Chénay (gare), médian 2 279 €/m² (-46% vs global)
- Top score observé : 92/100 (maison 4P 95m² Chénay)
- 23 biens > 75/100, médiane des scores ~52/100

Exemples de biens à utiliser dans les seeds :
- App F 60,5 m² rue Gagny, 155 k€, 2 561 €/m², DPE F, loyer estimé 847€, rendement brut 6,5%
- App E 64 m² Les Grands Coteaux, 175 k€, 2 734 €/m², RDC immeuble 10 étages
- Maison 206 m² rue Voltaire, 495 k€, 2 403 €/m², DPE E (candidat division)

---

## 10. Persona David (pour les paramètres seed)

- Stratégie : locatif nu ou mixte
- Apport : 200 k€
- Taux crédit : 3% sur 25 ans
- TMI : 30%
- Rendement min : 6%
- Tolérance travaux : OK lourds avec décote

---

## 11. Sources data référencées (`immoscan-data`)

| Brique | Source | Refresh | Notes |
|---|---|---|---|
| Prix vente | DVF+ Cerema (téléchargement geopackage) | Trimestriel | Importer France entière dès J1 |
| Prix annonces | Apify SeLoger + LBC | Temps réel (à chaque analyse) | Cache 24h sur URL, 7j sur annonce |
| Loyers signés | Réseau OLL via data.gouv | Annuel | ~50 territoires couverts |
| Loyers Paris | OLAP | Annuel | 32k observations |
| Loyers annonces (compléter OLL) | Scraping SeLoger Louer + LBC | Hebdo | Compléter les zones non OLL |
| Encadrement loyers | data.gouv arrêtés préfectoraux | À chaque arrêté | Paris, Lille, Lyon, Bordeaux, Montpellier |
| DPE | API ADEME open data | Mensuel cache | TTL 30j par adresse |
| Risques | API Géorisques | Annuel | PPRI, argile, sismicité, radon, BASOL |
| Adresses | API BAN | À la volée + cache | 50 req/s sans clé |
| Socio-démo | INSEE Filosofi + IRIS | Annuel | Importer en bulk |
| Écoles | data.education.gouv (IPS) | Annuel | Différenciant cible famille |
| Transports | SNCF + PRIM IDF (GTFS) | Hebdo | Isochrones via OSRM |
| Taux crédit | Banque de France | Mensuel | — |

Voir `docs/data-sources.md` pour les URLs précises et endpoints.

---

## 12. Pricing — source de vérité `docs/01-spec-produit.md` §Pricing

| Plan      | Mensuel | Annuel (équiv. /mois) | Analyses/mois | Veilles        | Top N        | Multi-users | Modèle Claude |
|-----------|---------|------------------------|---------------|----------------|--------------|-------------|---------------|
| Free      | 0€      | —                      | illimitées (>70 masqués) | 0              | 5 (masqué)   | 1           | Sonnet 4.6    |
| Pro       | 49€     | 468€/an (39€/mois)     | 30            | 5 hebdo        | 10           | 1           | Sonnet 4.6    |
| Pro+      | 99€     | 948€/an (79€/mois)     | illimité      | 20 quotidien   | 20           | 1           | Sonnet 4.6    |
| Business  | 249€    | 2 388€/an (199€/mois)  | illimité      | illimité       | 30           | 5           | Opus 4.7      |

Annuel = -20% (engagement 12 mois). 7 jours gratuits Pro sans CB.

**Status implémentation** : l'enum SQL `subscription_plan` et le type TS `PlanId`
ne contiennent que `free | pro | pro_plus` aujourd'hui. **Business est publié au
pricing mais sa prise en charge code + DB est différée à PR6+ Stripe Billing**
(migration `ALTER TYPE subscription_plan ADD VALUE 'business'`, extension Zod
`subscriptionPlanSchema`, entrée `PLANS.business` avec multi-users 5 et Opus
4.7). Ne pas inventer du code Business avant cette PR.

**Pay-per-use** : la spec produit ne mentionne pas de pay-per-use. Le code
historique en a (`PAY_PER_USE` dans `constants.ts`, SKU `single 9€` / `pack_5
39€` / `pack_20 119€`). Conservé "dormant" jusqu'à arbitrage explicite avec le
PO au moment de Stripe Billing PR6+. Ne pas câbler de checkout Stripe pay-per-use
sans valider d'abord son maintien produit.

---

## 13. Sprint actuel : PR1 Foundation & auth

**Objectif** : un user peut s'inscrire, se connecter, faire son onboarding (paramètres d'investissement), atterrir sur `/dashboard` vide, se déconnecter, se reconnecter. Sentry et PostHog tournent. Le worker répond au hello-world.

- **Backend** : appliquer les migrations `immoscan-app` (`pnpm db:migrate:app`), vérifier le trigger `handle_new_user`, tester RLS (deux users isolés) et la vue `listings_freemium_view` (free vs payant), activer Supabase Auth (email/password, magic link, Google OAuth).
- **Worker** : `npx trigger.dev@latest init` dans `apps/worker`, déployer `hello-world` en dev (`pnpm dev:worker`), brancher Sentry node, vérifier les deux clients dans `apps/worker/src/lib/supabase.ts`.
- **Frontend** : premier export Lovable mergé, routes TanStack (`/`, `/auth/login`, `/auth/signup`, `/onboarding/step-1|2`, `/dashboard`), hooks `useAuth` / `useProfile` / `useUserParams`, containers feature pour les formulaires onboarding (validation `userParamsInputSchema` côté client), guard auth sur `/dashboard/*`, PostHog identify + `$set` du plan, Sentry captureContext avec `user.id` (jamais l'email).
- **CI** : GitHub Actions `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test`, branche `main` protégée, review obligatoire.

**Critère de fin** : signup → onboarding → `/dashboard` → logout → reconnexion fonctionnels ; Sentry capture une erreur de test ; PostHog enregistre `signup_completed`.

PR0 (monorepo pnpm, configs TS/ESLint/Prettier, migrations Supabase, schémas Zod, scoring + tests Vitest, skeletons `apps/*`, docs) est livré dans ce starter — ne pas re-faire. Détail exhaustif des sous-tâches dans `TASKS.md`. Tu **ne commences pas** sur le scraping ou le scoring tant que PR1 n'est pas mergée.

---

## 14. Ce que tu ne fais jamais

- Tu ne tapes pas une migration sans la rollback en commentaire en bas du fichier.
- Tu ne crées pas de table sans RLS explicite (sauf dans `immoscan-data`).
- Tu n'écris pas de fetch Supabase direct dans un composant `components/` — tout passe par `features/` ou un hook `useXxx` dans `hooks/`.
- Tu ne push pas une clé API en clair, même temporairement.
- Tu n'utilises pas `npm` ou `yarn` — c'est pnpm.
- Tu n'inventes pas de variante shadcn — si une primitive manque, tu demandes.
- Tu ne mets pas de logique de scoring dans le worker ou le frontend — elle est dans `packages/shared/src/scoring/` et appelée des deux côtés.
- Tu ne supprimes pas une migration appliquée — tu en crées une nouvelle.

---

## 15. Quand tu réponds dans une PR ou un commit

- Code complet, prêt à appliquer, pas de "// reste inchangé".
- Si un changement touche plusieurs fichiers, livre-les **tous**, dans l'ordre logique (migration → types générés → shared → worker → frontend).
- Justifie en une phrase les choix non-évidents (pourquoi telle policy RLS, pourquoi vue plutôt que filtre app).
- Avant un changement coûteux ou irréversible (suppression de colonne, refonte de schéma, changement de modèle Claude), pose la question.
