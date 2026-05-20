import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
// PR-DA-U1 — Layer d'unification DA (Immoscan/Immovalue) : doit charger APRÈS
// index.css car elle consomme les tokens (--violet, --terra, --ring-violet…)
// définis dans :root. Paramétrée par data-product sur le <body>/#root.
import "./styles/immoscan-unified.css";
import { initPostHog } from "./lib/posthog";
import { createQueryClient } from "./lib/query-client";
import { initSentry } from "./lib/sentry";
import { routeTree } from "./routeTree.gen";

// ────────── Observability ──────────
// Sentry et PostHog initialisés via modules dédiés dans lib/. Tous deux :
// - centralisent les options conformes à notre politique anti-PII
// - sont idempotents et no-op si la clé d'env correspondante est absente
// Cf lib/sentry.ts et lib/posthog.ts pour le détail des scrubs et configs.
initSentry();
initPostHog();

// ────────── Routing ──────────
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ────────── React Query ──────────
// Defaults centralisés dans lib/query-client.ts. Une factory par instance
// (ici une seule, mais permet d'isoler en tests).
const queryClient = createQueryClient();

// ────────── Mount ──────────
const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {/* showDialog désactivé : le formulaire feedback Sentry collecte email+nom
        et les envoie via /user-feedback, endpoint séparé non couvert par notre
        beforeSend. Si on veut un canal de feedback utilisateur, on construira
        un formulaire ImmoScan qui passe par Supabase (RLS + logs sans PII). */}
    <Sentry.ErrorBoundary fallback={<div>Une erreur est survenue.</div>}>
      <PostHogProvider client={posthog}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
