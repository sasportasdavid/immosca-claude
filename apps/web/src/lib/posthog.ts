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

// ──────────────────────────────────────────────────────────────────
// Events métier ImmoScan (typés)
// ──────────────────────────────────────────────────────────────────
//
// Taxonomie centralisée pour PostHog. **Tout nouvel event business
// passe par cette union** : pas de `posthog.capture("custom-event")`
// inline ailleurs. Ça permet de :
//   - retrouver tous les call sites par grep
//   - éviter les typos sur les noms d'events
//   - documenter les properties attendues côté PostHog Insights

export type ImmoscanEvent =
  // Signup / onboarding
  | { name: "signup_completed"; props: { method: "password" | "magic_link" | "google" } }
  | { name: "onboarding_completed"; props: { strategy: string } }

  // Analyses
  | {
      name: "analysis_started";
      props: {
        source_site: string;
        from_url: boolean;
        from_paste_urls: boolean;
      };
    }
  | {
      name: "analysis_completed";
      props: {
        analysis_id: string;
        total_listings_raw: number;
        total_listings_filtered: number;
        was_truncated: boolean;
      };
    }

  // Quotas / upsell
  | {
      name: "quota_exceeded";
      props: {
        reason: string;
        upgrade_to: string | null;
        used?: number;
        limit?: number;
      };
    }
  | {
      name: "quota_modal_shown";
      props: { reason: string; placement: string };
    }

  // Veilles
  | {
      name: "watch_created";
      props: {
        source_site: string;
        sensitivity: string;
        score_threshold: number;
        from_analysis: boolean;
      };
    }
  | { name: "watch_deleted"; props: { watch_id: string } }
  | { name: "watch_reactivated"; props: { watch_id: string } }

  // Billing
  | { name: "checkout_started"; props: { sku: string; context?: string } }
  | { name: "portal_opened"; props: Record<string, never> }
  | {
      name: "plan_upgraded";
      props: { from_plan: string; to_plan: string };
    }
  | {
      name: "plan_downgraded";
      props: { from_plan: string; to_plan: string };
    }
  | { name: "ppu_purchased"; props: { context?: string } }
  | { name: "addon_purchased"; props: { sku: string } }

  // Emails inbound (clics)
  | {
      name: "email_clicked";
      props: {
        source:
          | "watch_digest"
          | "watch_expiration_warn"
          | "watch_suspended"
          | "unknown";
        campaign?: string;
      };
    };

/**
 * Capture un event business typé. No-op si PostHog non initialisé.
 *
 * Exemple :
 *   trackEvent({ name: "watch_created", props: { source_site: "seloger", … } });
 */
export function trackEvent<E extends ImmoscanEvent>(event: E): void {
  if (!initialized) return;
  posthog.capture(event.name, event.props);
}

// ──────────────────────────────────────────────────────────────────
// Pageviews + hook router
// ──────────────────────────────────────────────────────────────────

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

    // Si l'URL contient utm_source=immoscan_email → fire `email_clicked` une
    // seule fois au mount (clic sortant depuis Resend digest/expiration).
    detectEmailClickFromUrl(initial.searchStr);

    // Pageviews sur navigation
    const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
      capturePageview(toLocation.pathname, toLocation.searchStr);
    });

    return () => unsubscribe();
  }, [router]);
}

/**
 * Lit utm_source + utm_campaign et déclenche un event `email_clicked`.
 * Mécanique : nos templates de digest / expiration ajoutent
 *   ?utm_source=immoscan_email&utm_campaign=<source>
 * On capture une seule fois par session : si la query est présente, on
 * stocke un flag sessionStorage pour ne pas re-trigger sur navigations.
 */
function detectEmailClickFromUrl(searchStr: string | undefined): void {
  if (!initialized || !searchStr) return;
  try {
    const params = new URLSearchParams(searchStr);
    const utmSource = params.get("utm_source");
    if (utmSource !== "immoscan_email") return;
    const sessionKey = "ph_email_click_fired";
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    const campaign = params.get("utm_campaign") ?? "unknown";
    const source =
      campaign === "watch_digest"
        ? ("watch_digest" as const)
        : campaign === "watch_expiration_warn"
          ? ("watch_expiration_warn" as const)
          : campaign === "watch_suspended"
            ? ("watch_suspended" as const)
            : ("unknown" as const);
    trackEvent({ name: "email_clicked", props: { source, campaign } });
  } catch {
    // best-effort, on swallow les erreurs URL parsing
  }
}
