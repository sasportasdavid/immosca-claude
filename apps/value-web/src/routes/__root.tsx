import { Outlet, createRootRoute } from "@tanstack/react-router";

import { ProductSwitcher } from "@web/components/product-switcher";
import { Toaster } from "@web/components/ui/sonner";
import { useInstallAuthListener } from "@/hooks/use-auth";
import { usePostHogPageTracking } from "@/lib/posthog";

function RootComponent() {
  // Listener Supabase auth (unique) : maintient le cache React Query
  // ["session"] à jour et déclenche identify/reset PostHog + Sentry.
  // Cf hooks/use-auth.ts.
  useInstallAuthListener();
  // Capture les $pageview PostHog à chaque navigation résolue. No-op
  // si VITE_POSTHOG_KEY absente.
  usePostHogPageTracking();
  return (
    <>
      <Outlet />

      {/*
        Product switcher floating top-right : permet de basculer
        ImmoScan ↔ ImmoValue depuis n'importe quel écran. L'auth
        Supabase est partagée (cookie sur domaine racine immoscan.fr)
        donc l'user reste loggé.
      */}
      <div className="fixed right-3 top-3 z-50">
        <ProductSwitcher current="immovalue" variant="default" />
      </div>

      <Toaster />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
