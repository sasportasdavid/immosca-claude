import { Outlet, createRootRoute } from "@tanstack/react-router";

import { usePostHogPageTracking } from "@/lib/posthog";

function RootComponent() {
  // Capture les $pageview PostHog à chaque navigation résolue par TanStack
  // Router. URL scrubée des query params PII via scrubUrl. Cf lib/posthog.ts.
  usePostHogPageTracking();
  return <Outlet />;
}

export const Route = createRootRoute({
  component: RootComponent,
});
