# `@immoscan/value-web`

Frontend ImmoValue — estimation immobilière indépendante.

App séparée d'ImmoScan (`apps/web`) mais qui :

- partage le **même projet Supabase `immoscan-app`** (auth unifiée, user
  ImmoScan = user ImmoValue),
- partage la **même DA** (tokens stone warm + violet + terra + sage),
- **réutilise les composants ui d'`apps/web`** via l'alias `@web/*`
  pour rester DRY tant que les deux apps convergent sur la même base
  shadcn re-skinnée (Phase 2).

## Commandes

```bash
# Depuis la racine du repo :
pnpm install                                  # installe les workspaces

pnpm --filter @immoscan/value-web dev         # http://localhost:5174
pnpm --filter @immoscan/value-web build
pnpm --filter @immoscan/value-web typecheck
pnpm --filter @immoscan/value-web routes:generate
```

Port dev : **5174** (apps/web reste sur 5173, exécution parallèle possible).

## Variables d'environnement

Voir `.env.example`. Copier dans `.env.local` à la **racine du repo**
(les deux apps lisent la même source via `envDir: ../..` dans
`vite.config.ts`).

Variables minimum pour booter :

- `VITE_SUPABASE_APP_URL` — URL du projet Supabase immoscan-app
- `VITE_SUPABASE_APP_ANON_KEY` — anon key du même projet

Optionnelles : `VITE_SENTRY_DSN_WEB`, `VITE_POSTHOG_KEY`,
`VITE_POSTHOG_HOST` (no-op si absentes).

## Architecture

```
apps/value-web/
├── package.json
├── tsconfig.json              # alias @/* et @web/*
├── vite.config.ts             # port 5174, envDir ../..
├── tailwind.config.ts         # même tokens qu'apps/web + content @web/*
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx               # bootstrap React + Sentry + PostHog + Router
    ├── index.css              # tokens DA (duplique apps/web/src/index.css)
    ├── env.d.ts
    ├── routes/
    │   ├── __root.tsx         # layout racine avec Toaster + listeners
    │   └── index.tsx          # placeholder landing
    ├── lib/
    │   ├── supabase.ts        # client immoscan-app
    │   ├── value-api.ts       # wrapper Edge Functions ImmoValue
    │   ├── posthog.ts         # init + helpers (no-op si pas de clé)
    │   ├── sentry.ts          # init + helpers (no-op si pas de DSN)
    │   ├── query-client.ts    # factory React Query
    │   └── utils.ts           # cn() helper shadcn
    ├── hooks/
    │   ├── use-auth.ts        # idem apps/web (auth unifiée)
    │   └── use-profile.ts     # idem apps/web
    └── components/
        └── ui/                # vide V1 — voir convention ci-dessous
```

## Convention : composants `ui/` partagés

**V1** : les agents écrans réutilisent directement les primitives
d'`apps/web/src/components/ui/` via l'alias `@web/*` configuré dans
`tsconfig.json` et `vite.config.ts` :

```tsx
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { DpePill } from "@web/components/ui/dpe-pill";
```

C'est DRY tant que les deux apps consomment les mêmes tokens. Si un
composant ImmoValue diverge (variante terra-only par exemple),
l'override va dans `apps/value-web/src/components/ui/<nom>.tsx` et
écrase l'import via l'alias `@/components/ui/...`.

**Alternative** envisagée : `packages/ui/` partagé. Reporté tant que la
divergence ne le justifie pas (refactor lourd pour gain marginal V1).

## Edge Functions consommées

Voir `src/lib/value-api.ts`. Les deux endpoints actuels :

- `value-estimer` — lance une estimation pour un bien (POST body =
  address + bien_data + photos + URLs comparables). Retourne `bien_id`.
- `value-biens-publish/:bien_id` — publie un bien estimé. Retourne
  soit `checkout_url` (paiement requis) soit `payment_required: false`.

## Routes prévues (placeholder pour les 18 écrans à venir)

Phase 3 (agents écrans) — non implémentées dans cet agent :

- `/` — landing publique
- `/auth/login`, `/auth/signup`, `/auth/callback`
- `/estimer/*` — funnel d'estimation (adresse, surface, pièces, DPE, photos…)
- `/biens/:id` — fiche bien (rapport d'estimation)
- `/biens/:id/publier` — checkout + publication
- `/marketplace/*` — recherche/découverte des biens publiés
- `/dashboard` — biens estimés/publiés de l'utilisateur

## Ce qui n'est PAS fait dans ce bootstrap

- Aucune route métier (sauf `/` placeholder)
- Aucun hook métier (`use-bien`, `use-estimation`, etc.)
- Aucun composant ImmoValue spécifique (Phase 2/3)
- Pas de déploiement Vercel
