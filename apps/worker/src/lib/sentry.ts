// Sentry node init pour le worker Trigger.dev.
//
// Politique de confidentialité (cohérente avec apps/web/src/lib/sentry.ts) :
// - sendDefaultPii: false (Sentry n'envoie pas l'IP/user agent auto)
// - Le worker n'a pas de user devant l'écran. Il manipule des données
//   listings et des appels Apify/Anthropic/Stripe. Côté événements, on
//   évite simplement d'attacher des objets `user` ou des PII de listings
//   (adresse précise, téléphone vendeur) — c'est aux tasks de scrub
//   leurs payloads avant captureException si besoin.
// - Pas de browserTracing / replayIntegration (browser-only).
//
// Init au module-load (top-level), idempotent : Sentry.init() est no-op
// si déjà initialisé.

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN_WORKER;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

export { Sentry };
