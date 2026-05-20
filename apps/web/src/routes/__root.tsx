import { Outlet, createRootRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { useInstallAuthListener } from "@/hooks/use-auth";
import { usePostHogPageTracking } from "@/lib/posthog";

function RootComponent() {
  // Listener Supabase auth (unique) : maintient le cache React Query
  // ["session"] à jour et déclenche identify/reset PostHog + Sentry.
  // Cf hooks/use-auth.ts.
  useInstallAuthListener();
  // Capture les $pageview PostHog à chaque navigation résolue par TanStack
  // Router. URL scrubée des query params PII via scrubUrl. Cf lib/posthog.ts.
  usePostHogPageTracking();
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
