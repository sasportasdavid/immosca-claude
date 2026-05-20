// Mapper des erreurs Supabase Auth vers des messages courts en français.
// Les messages anglais par défaut sont peu engageants ("Invalid login
// credentials") et techniques ("AuthApiError: ...").
//
// On match prioritairement sur `error.code` (stable, Supabase v2.x) avec
// fallback sur `error.message`. Si rien ne match, on log à Sentry et on
// retourne un message générique.

import * as Sentry from "@sentry/react";
import { AuthError } from "@supabase/supabase-js";

const GENERIC_MESSAGE =
  "Quelque chose s'est mal passé. Réessaie ou contacte le support si ça persiste.";

const CODE_MESSAGES = {
  // Login
  invalid_credentials: "Email ou mot de passe incorrect.",
  email_not_confirmed:
    "Confirme ton email avant de te connecter (un lien t'a été envoyé).",
  // Signup
  user_already_exists:
    "Un compte existe déjà avec cet email. Connecte-toi plutôt.",
  weak_password:
    "Mot de passe trop faible. Au moins 8 caractères, mélange lettres et chiffres.",
  // Magic link / OTP
  over_email_send_rate_limit:
    "Trop de demandes. Attends quelques minutes avant de réessayer.",
  // Rate limit générique
  over_request_rate_limit: "Trop de tentatives. Réessaie dans une minute.",
  // OAuth
  bad_oauth_state:
    "La connexion Google a expiré. Recommence depuis la page de connexion.",
  // Generic validation
  validation_failed: "Email ou mot de passe invalide.",
} as const satisfies Record<string, string>;

type KnownCode = keyof typeof CODE_MESSAGES;

const MESSAGE_PATTERNS: ReadonlyArray<{ pattern: RegExp; code: KnownCode }> = [
  // Patterns de fallback si le code n'est pas reconnu
  { pattern: /invalid login credentials/i, code: "invalid_credentials" },
  { pattern: /user already registered/i, code: "user_already_exists" },
  { pattern: /password should be/i, code: "weak_password" },
  { pattern: /email rate limit/i, code: "over_email_send_rate_limit" },
  { pattern: /rate limit exceeded/i, code: "over_request_rate_limit" },
];

function lookupCode(code: string | undefined): string | null {
  if (!code) return null;
  // L'access avec une clé `string` peut retourner undefined si la clé
  // n'est pas dans le set des KnownCode — c'est exactement le runtime
  // check qu'on veut.
  const message = (CODE_MESSAGES as Record<string, string>)[code];
  return message ?? null;
}

export function mapAuthError(err: unknown): string {
  if (err instanceof AuthError) {
    const byCode = lookupCode(err.code);
    if (byCode) return byCode;

    for (const { pattern, code } of MESSAGE_PATTERNS) {
      if (pattern.test(err.message)) return CODE_MESSAGES[code];
    }

    // Code/message inconnu : on remonte à Sentry pour étendre le mapper.
    Sentry.captureMessage(
      `Unmapped Supabase AuthError: ${err.code ?? "(no code)"} — ${err.message}`,
      { level: "warning" },
    );
    return GENERIC_MESSAGE;
  }
  if (err instanceof Error) {
    Sentry.captureException(err);
    return GENERIC_MESSAGE;
  }
  Sentry.captureMessage(`Unknown auth error type: ${String(err)}`, {
    level: "warning",
  });
  return GENERIC_MESSAGE;
}
