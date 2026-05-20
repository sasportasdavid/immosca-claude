// PostHog init + helpers pour ImmoValue.
//
// V1 : version minimale alignée sur apps/web/src/lib/posthog.ts.
// Le project PostHog ImmoValue séparé arrive en V2 — pour l'instant on
// peut soit pointer sur le même projet qu'ImmoScan, soit no-op.
//
// No-op si VITE_POSTHOG_KEY est absente (cas par défaut V1).
// Politique PII : userId UUID uniquement.

import { useRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect } from "react";

let initialized = false;

/**
 * Initialise PostHog pour ImmoValue. No-op si VITE_POSTHOG_KEY absente.
 * Idempotent.
 */
export function initPostHog(): void {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.posthog.com",
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
    respect_dnt: true,
    secure_cookie: true,
    ip: false,
  });
  initialized = true;
}

/**
 * Identifie l'utilisateur courant pour PostHog. UserId UUID uniquement.
 */
export function identifyUser(
  userId: string,
  personProperties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.identify(userId, personProperties);
}

/**
 * Met à jour les person properties PostHog sans changer l'identifiant.
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.setPersonProperties(properties);
}

/**
 * Reset PostHog à la déconnexion.
 */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

/**
 * Capture un pageview PostHog.
 */
export function capturePageview(pathname: string, searchStr?: string): void {
  if (!initialized) return;
  const search = searchStr && searchStr.length > 0 ? `?${searchStr}` : "";
  const fullUrl = `${window.location.origin}${pathname}${search}`;
  posthog.capture("$pageview", {
    $current_url: fullUrl,
    $pathname: pathname,
  });
}

/**
 * Hook React qui s'abonne au TanStack Router et déclenche un pageview
 * PostHog à chaque navigation résolue. À monter UNE FOIS dans __root.tsx.
 */
export function usePostHogPageTracking(): void {
  const router = useRouter();

  useEffect(() => {
    const initial = router.state.location;
    capturePageview(initial.pathname, initial.searchStr);

    const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
      capturePageview(toLocation.pathname, toLocation.searchStr);
    });

    return () => unsubscribe();
  }, [router]);
}
