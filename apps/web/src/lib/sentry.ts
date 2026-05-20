// Sentry init + beforeSend / beforeBreadcrumb avec scrub PII complet.
//
// Politique de confidentialité :
// - event.user : on garde uniquement `id`. JAMAIS email / username /
//   ip_address (Sentry les remplit automatiquement via sendDefaultPii,
//   désactivé ici).
// - event.request.{query_string, data, headers, url} : toutes les clés
//   matchant un pattern PII (cf pii-scrub.ts) sont remplacées par
//   '[Filtered]'. URLs : query string scrubbée, path préservé.
// - event.breadcrumbs (fetch/xhr) : data scrubbé + URL query string
//   scrubbée. Les breadcrumbs autres catégories (ui.click, navigation,
//   console) sont préservés tels quels.
//
// Deux filets de sécurité :
// 1. `beforeBreadcrumb` filtre AVANT que le breadcrumb soit ajouté à la
//    queue. C'est l'angle préventif.
// 2. `beforeSend` filtre l'event entier juste avant envoi. C'est le filet
//    de dernier recours, qui couvre aussi `event.user/request` (pas juste
//    breadcrumbs).

import * as Sentry from "@sentry/react";
import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/react";

import {
  scrubBreadcrumbData,
  scrubObject,
  scrubQueryString,
  scrubUrl,
} from "./pii-scrub";

/**
 * Scrub d'un breadcrumb. Seuls `fetch` et `xhr` ont des `data` susceptibles
 * de contenir de la PII (URL, headers, body). Les autres catégories
 * (navigation, ui.click, console, etc.) sont préservées.
 */
export function piiBeforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category !== "fetch" && breadcrumb.category !== "xhr") {
    return breadcrumb;
  }
  if (!breadcrumb.data) return breadcrumb;
  return {
    ...breadcrumb,
    data: scrubBreadcrumbData(breadcrumb.data) as Breadcrumb["data"],
  };
}

/**
 * Scrub d'un event complet juste avant envoi à Sentry.
 *
 * Couvre : user, request.{query_string, data, headers, url}, breadcrumbs.
 *
 * Note : si l'event a été modifié par `beforeBreadcrumb` à la collecte,
 * cette passe sera idempotente sur les breadcrumbs (re-scrub sans effet).
 */
export function piiBeforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  // — event.user — garde uniquement l'id
  if (event.user) {
    const id = event.user.id;
    event.user = id !== undefined ? { id: String(id) } : {};
  }

  // — event.request — query_string / data / headers / url
  if (event.request) {
    if (event.request.query_string) {
      const qs =
        typeof event.request.query_string === "string"
          ? event.request.query_string
          : // Cas tableau de tuples : on reconstruit en URLSearchParams safe.
            new URLSearchParams(
              event.request.query_string as unknown as string[][],
            ).toString();
      event.request.query_string = scrubQueryString(qs);
    }
    if (event.request.data !== undefined) {
      event.request.data = scrubObject(event.request.data) as typeof event.request.data;
    }
    if (event.request.headers) {
      event.request.headers = scrubObject(
        event.request.headers,
      ) as Record<string, string>;
    }
    if (typeof event.request.url === "string") {
      event.request.url = scrubUrl(event.request.url);
    }
  }

  // — event.breadcrumbs — re-passe par beforeBreadcrumb (idempotent)
  if (event.breadcrumbs && event.breadcrumbs.length > 0) {
    event.breadcrumbs = event.breadcrumbs
      .map((b) => piiBeforeBreadcrumb(b))
      .filter((b): b is Breadcrumb => b !== null);
  }

  return event;
}

/**
 * Initialise Sentry pour l'app web.
 *
 * No-op si VITE_SENTRY_DSN_WEB est absente (dev sans Sentry configuré).
 * Idempotent : si déjà initialisée, Sentry.init() écrase la config.
 */
/**
 * Identifie l'utilisateur courant pour Sentry.
 *
 * Politique PII (cf piiBeforeSend) : on passe UNIQUEMENT le `userId`.
 * Sentry stocke `event.user.id` mais jamais email/username/ip_address
 * (filtrés par notre beforeSend de toute façon).
 *
 * À appeler depuis le listener `supabase.auth.onAuthStateChange` sur
 * l'événement SIGNED_IN. No-op si Sentry non initialisé.
 */
export function setSentryUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/**
 * Reset Sentry user à la déconnexion. Les événements ultérieurs
 * n'auront plus de `user.id` rattaché.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN_WEB;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Désactive l'envoi automatique d'IP / cookies / user agent par Sentry.
    // On gère explicitement event.user dans beforeSend.
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend: piiBeforeSend,
    beforeBreadcrumb: piiBeforeBreadcrumb,
  });
}
