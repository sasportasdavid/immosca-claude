import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { initPostHog } from "./lib/posthog";
import { createQueryClient } from "./lib/query-client";
import { initSentry } from "./lib/sentry";
import { routeTree } from "./routeTree.gen";

// ────────── Observability ──────────
// Sentry et PostHog initialisés via modules dédiés dans lib/.
// Idempotents et no-op si la clé d'env correspondante est absente.
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
const queryClient = createQueryClient();

// ────────── Mount ──────────
const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Une erreur est survenue.</div>}>
      <PostHogProvider client={posthog}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
