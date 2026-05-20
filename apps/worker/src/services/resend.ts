// Service Resend pour les emails transactionnels ImmoScan.
//
// Couvre pour le module veille :
//   - sendDigestEmail (lun/mer/ven 8h + daily 8h Business)
//   - sendWatchExpirationEmail (J-10, J-3, J0 pour Free ; J-7, J-2, J0 pour PPU)
//   - sendTruncateAlertEmail (3 runs consécutifs avec truncate=true)
//
// Toute clé Resend reste côté worker (env RESEND_API_KEY).
// From: `ImmoScan <hello@immoscan.fr>` — domaine à configurer dans Resend
// avec DKIM/SPF (cf docs/billing.md §7).

import { logger } from "@trigger.dev/sdk";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "ImmoScan <hello@immoscan.fr>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Tag analytique Resend (ex: "digest", "expiration", "truncate"). */
  tag?: string;
}

export interface SendEmailResult {
  id: string;
}

/**
 * Wrapper safe : si RESEND_API_KEY absent, on log et on no-op (utile en dev
 * sans configurer Resend). En prod, l'env doit toujours être set.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult | null> {
  if (!resend) {
    logger.warn("Resend skipped (RESEND_API_KEY missing)", {
      to: params.to.slice(0, 3) + "***", // pas de PII en clair dans les logs
      subject: params.subject,
    });
    return null;
  }
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    tags: params.tag ? [{ name: "category", value: params.tag }] : undefined,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message ?? error.name}`);
  }
  if (!data?.id) {
    throw new Error("Resend returned no id");
  }
  return { id: data.id };
}
