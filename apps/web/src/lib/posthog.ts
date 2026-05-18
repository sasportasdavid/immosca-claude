// PostHog init + page tracking pilotés depuis le routeur.
//
// Politique de confidentialité (cohérente avec Sentry beforeSend) :
// - `capture_pageview: false` : on capture manuellement via le hook
//   `usePostHogPageTracking()`, pour pouvoir scrub les query strings PII
//   dans l'URL avant envoi.
// - `person_profiles: 'identified_only'` : pas de profil créé pour les
//   visiteurs anonymes (signed-out). On enrichit via `posthog.identify()`
//   après login (cf hook useAuth en commit séparé).
// - `autocapture: false` : pas de capture automatique des clicks DOM /
//   inputs / form submits. Trop de risque de leak (text inputs visibles).
//   On capture explicitement les events business via posthog.capture().
// - `disable_session_recording: true` : pas de session replay PR1.
// - `respect_dnt: true` : respecte le header Do-Not-Track navigateur.
// - `secure_cookie: true` : cookies HTTPS only.
// - `ip: false` : ne demande pas à PostHog d'enrichir l'event avec
//   géolocalisation IP côté serveur.

import { useRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect } from "react";

import { scrubUrl } from "./pii-scrub";

// Flag interne pour éviter les init multiples et savoir si on peut
// capturer. On évite `posthog.__loaded` qui est un internal SDK non
// stable dans les types publics.
let initialized = false;

/**
 * Initialise PostHog pour l'app web.
 *
 * No-op si VITE_POSTHOG_KEY est absente. Idempotent.
 */
export function initPostHog(): void {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.posthog.com",
    capture_pageview: false, // manuel via usePostHogPageTracking
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
 * Identifie l'utilisateur courant pour PostHog.
 *
 * Politique PII : on passe UNIQUEMENT le `userId` (UUID Supabase),
 * jamais l'email/le nom. Les person properties optionnelles peuvent
 * contenir le plan, mais PAS de PII (email, adresse, téléphone).
 *
 * À appeler depuis le listener `supabase.auth.onAuthStateChange` sur
 * l'événement SIGNED_IN. No-op si PostHog non initialisé.
 */
export function identifyUser(
  userId: string,
  personProperties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.identify(userId, personProperties);
}

/**
 * Met à jour les person properties PostHog (`$set`) sans changer
 * l'identifiant. Typique : update du plan après upgrade Stripe.
 *
 * Même politique PII : pas d'email, pas d'adresse, etc.
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.setPersonProperties(properties);
}

/**
 * Reset PostHog à la déconnexion : oublie le distinct_id user et
 * regénère un anonyme. À appeler sur SIGNED_OUT.
 */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

/**
 * Capture un pageview PostHog avec scrub PII sur l'URL.
 *
 * Construit `$current_url` à partir de pathname + searchStr (si fourni),
 * passe par `scrubUrl` pour neutraliser toute query string PII
 * (`?email=foo@bar.com` → `?email=%5BFiltered%5D`).
 *
 * Pas d'effet si PostHog non initialisé (VITE_POSTHOG_KEY absente).
 */
export function capturePageview(pathname: string, searchStr?: string): void {
  if (!initialized) return;
  const search = searchStr && searchStr.length > 0 ? `?${searchStr}` : "";
  const fullUrl = `${window.location.origin}${pathname}${search}`;
  posthog.capture("$pageview", {
    $current_url: scrubUrl(fullUrl),
    $pathname: pathname,
  });
}

/**
 * Hook React qui s'abonne au TanStack Router et déclenche un pageview
 * PostHog à chaque navigation résolue.
 *
 * À monter UNE FOIS dans le composant racine (`routes/__root.tsx`).
 *
 * Le pageview initial (au mount) est aussi capturé pour ne pas rater la
 * landing au cold start.
 */
export function usePostHogPageTracking(): void {
  const router = useRouter();

  useEffect(() => {
    // Initial pageview (au mount)
    const initial = router.state.location;
    capturePageview(initial.pathname, initial.searchStr);

    // Pageviews sur navigation
    const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
      capturePageview(toLocation.pathname, toLocation.searchStr);
    });

    return () => unsubscribe();
  }, [router]);
}
