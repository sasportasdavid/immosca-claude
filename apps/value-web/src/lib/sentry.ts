// Sentry init + helpers identify/clear pour ImmoValue.
//
// V1 : version minimale alignée sur apps/web/src/lib/sentry.ts.
// No-op si VITE_SENTRY_DSN_WEB est absente. Politique PII :
// userId UUID uniquement, jamais email/IP. À enrichir plus tard avec
// les scrubs PII si on monte un projet Sentry séparé pour ImmoValue.

import * as Sentry from "@sentry/react";

/**
 * Identifie l'utilisateur courant pour Sentry. UserId UUID uniquement.
 */
export function setSentryUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/**
 * Reset Sentry user à la déconnexion.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Initialise Sentry pour ImmoValue. No-op si VITE_SENTRY_DSN_WEB absente.
 * Idempotent.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN_WEB;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
