# ImmoScan

SaaS français qui transforme une URL SeLoger / Leboncoin en rapport d'analyse d'investissement immobilier en 8 minutes.

> "20 heures d'analyse Excel en 8 minutes."

## Stack

- **Frontend** : React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend** : Supabase (Postgres + PostGIS + Auth + Storage + Edge Functions)
- **Workers** : Trigger.dev v3
- **Scraping** : Apify (SeLoger + Leboncoin)
- **IA** : Anthropic API (Sonnet 4.6 / Opus 4.7)
- **Paiement** : Stripe Billing
- **Email** : Resend
- **Monitoring** : Sentry + PostHog + BetterStack

## Prérequis

- Node.js 20+
- pnpm 9+
- Supabase CLI 1.190+
- Trigger.dev CLI v3
- Comptes : Supabase (2 projets en eu-west-3), Apify, Anthropic, Stripe, Resend, Sentry, PostHog, BetterStack

## Setup

```bash
# 1. Cloner et installer
pnpm install

# 2. Copier le template d'env
cp .env.example .env.local

# 3. Remplir les variables (voir .env.example)
# 4. Initialiser les 2 projets Supabase
supabase link --project-ref <APP_PROJECT_REF> --workdir supabase-app
supabase link --project-ref <DATA_PROJECT_REF> --workdir supabase-data

# 5. Appliquer les migrations
supabase db push --workdir supabase-app
supabase db push --workdir supabase-data

# 6. Générer les types
pnpm db:types

# 7. Lancer
pnpm dev
```

## Structure du repo

```
immoscan/
├── apps/
│   ├── web/                 # React + Vite, déployé Vercel
│   └── worker/              # Trigger.dev jobs
├── packages/
│   ├── shared/              # Zod schemas, scoring (logique pure)
│   └── db/                  # Types Supabase générés
├── supabase-app/             # Projet Supabase immoscan-app (transactionnel)
│   └── supabase/{config.toml, migrations/}
├── supabase-data/            # Projet Supabase immoscan-data (référentiels publics)
│   └── supabase/{config.toml, migrations/}
└── docs/
```

## Commandes

```bash
pnpm dev              # Frontend en dev
pnpm dev:worker       # Worker en dev
pnpm typecheck        # TS check sur tout le monorepo
pnpm lint             # ESLint
pnpm test             # Vitest (scoring + utils)
pnpm db:types         # Régénère les types Supabase
pnpm db:migrate:app   # Push migrations immoscan-app
pnpm db:migrate:data  # Push migrations immoscan-data
```

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — source de vérité pour Claude Code
- [`TASKS.md`](./TASKS.md) — sprint actuel et roadmap
- [`docs/architecture.md`](./docs/architecture.md) — décisions structurantes
- [`docs/design-integration.md`](./docs/design-integration.md) — workflow design / code
- [`docs/data-sources.md`](./docs/data-sources.md) — sources data avec endpoints
