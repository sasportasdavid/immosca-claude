import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { initSentry } from "./lib/sentry";
import { routeTree } from "./routeTree.gen";

// ────────── Observability ──────────
// Sentry init centralisé dans lib/sentry.ts (beforeSend / beforeBreadcrumb
// scrub PII complet). Idempotent et no-op si VITE_SENTRY_DSN_WEB absente.
initSentry();

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.posthog.com",
    capture_pageview: false, // géré par le router
    person_profiles: "identified_only",
  });
}

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
    <Sentry.ErrorBoundary fallback={<div>Une erreur est survenue.</div>} showDialog>
      <PostHogProvider client={posthog}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
