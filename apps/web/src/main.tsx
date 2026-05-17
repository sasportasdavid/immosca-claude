import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { initPostHog } from "./lib/posthog";
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
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min
      gcTime: 5 * 60 * 1000, // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
