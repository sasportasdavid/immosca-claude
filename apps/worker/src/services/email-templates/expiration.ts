// Templates email expiration veille — 3 variantes :
//   1. free-warn (J-10, J-3) : ta veille gratuite expire bientôt
//   2. ppu-warn  (J-7, J-2)  : ta veille PPU bonus expire bientôt
//   3. suspended (J0)        : ta veille vient d'être suspendue
//
// Mécanique de conversion (BM §4.2 + §5.1/§5.2) :
//   - Free → poussée Pro 7j gratuits
//   - PPU  → poussée Pro pour fixer la veille à vie
//   - Suspended → réactivation 1-clic via upgrade

const APP_URL = process.env.APP_URL ?? "https://app.immoscan.fr";

function withUtm(url: string, campaign: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=immoscan_email&utm_medium=email&utm_campaign=${campaign}`;
}

const MUTED = "#737373";
const FG = "#0a0a0a";
const BG = "#fafafa";
const CARD_BG = "#ffffff";
const BORDER = "#e5e5e5";
const PRIMARY = "#0070f3";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BaseTemplateInput {
  profileFirstName: string | null;
  watchName: string;
}

function wrapHtml(args: { subject: string; body: string; campaign: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(args.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${FG}">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${FG}">ImmoScan</div>
    </div>
    ${args.body}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid ${BORDER};text-align:center;font-size:11px;color:${MUTED};line-height:1.6">
      <div>
        <a href="${withUtm(`${APP_URL}/app/veilles`, args.campaign)}" style="color:${MUTED}">Mes veilles</a>
        ·
        <a href="${withUtm(`${APP_URL}/app/billing`, args.campaign)}" style="color:${MUTED}">Plan & facturation</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────
// 1) Free expiration warning (J-10, J-3)
// ──────────────────────────────────────────────────────────────────

export interface FreeWarnInput extends BaseTemplateInput {
  daysLeft: number;
  /** Compteur global d'opportunités trouvées sur cette veille. */
  totalOpportunities: number;
  /** Nombre de biens score ≥70 floutés faute d'abonnement Pro. */
  maskedHighScoreCount: number;
}

export function buildFreeExpirationWarnEmail(input: FreeWarnInput): {
  subject: string;
  html: string;
  text: string;
} {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";
  const subject =
    input.daysLeft <= 3
      ? `⏳ Ta veille expire dans ${input.daysLeft} jour${input.daysLeft > 1 ? "s" : ""}`
      : `Ta veille ImmoScan expire dans ${input.daysLeft} jours`;

  const teasingBlock =
    input.maskedHighScoreCount > 0
      ? `
    <div style="margin:16px 0;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
      <div style="font-size:13px;color:#92400e;font-weight:600">
        🔒 ${input.maskedHighScoreCount} bien${input.maskedHighScoreCount > 1 ? "s" : ""} score ≥ 70 ${input.maskedHighScoreCount > 1 ? "sont masqués" : "est masqué"} sur ta veille
      </div>
      <div style="margin-top:4px;font-size:12px;color:#92400e">
        Passe Pro pour débloquer leur prix, leur adresse et la thèse Claude.
      </div>
    </div>
  `
      : "";

  const body = `
    <h1 style="font-size:20px;font-weight:600;color:${FG};margin:0 0 16px">
      ${input.daysLeft <= 3 ? "⏳ " : ""}Ta veille expire dans ${input.daysLeft} jour${input.daysLeft > 1 ? "s" : ""}
    </h1>
    <p style="font-size:14px;color:${FG};margin:0 0 12px">${hello}</p>
    <p style="font-size:14px;color:${FG};line-height:1.6;margin:0 0 16px">
      Ta veille gratuite <strong>${escapeHtml(input.watchName)}</strong> arrive bientôt à sa fin.
      Depuis sa création, elle a scouté <strong>${input.totalOpportunities} bien${input.totalOpportunities > 1 ? "s" : ""}</strong> sur ta zone.
    </p>
    ${teasingBlock}
    <div style="margin:24px 0;padding:20px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px">
      <div style="font-size:15px;font-weight:600;color:${FG};margin-bottom:12px">
        ✨ Passe Pro et garde ta veille à vie
      </div>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;color:${FG};line-height:1.8">
        <li>10 analyses/mois (vs 1 en Free)</li>
        <li>3 veilles 3×/sem (vs 1)</li>
        <li>Top 10 débloqué, plus de floutage</li>
        <li>Pipeline kanban illimité</li>
      </ul>
      <a href="${withUtm(`${APP_URL}/app/billing`, "watch_expiration_warn")}"
         style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
        Passer Pro — 7 jours gratuits sans CB
      </a>
      <div style="margin-top:8px;font-size:12px;color:${MUTED}">
        Annulation libre en 1 clic depuis ton compte.
      </div>
    </div>
    <p style="font-size:13px;color:${MUTED};margin:0">
      Sinon, ta veille sera <strong>suspendue</strong> (pas supprimée) à expiration.
      Tu pourras la réactiver plus tard en passant Pro.
    </p>
  `;

  const text = `${hello}

Ta veille gratuite "${input.watchName}" expire dans ${input.daysLeft} jours.

Elle a scouté ${input.totalOpportunities} biens depuis sa création.
${input.maskedHighScoreCount > 0 ? `\n${input.maskedHighScoreCount} bien(s) score ≥ 70 sont masqués — débloquables avec Pro.\n` : ""}
Passe Pro (7 jours gratuits sans CB) : ${APP_URL}/app/billing
- 10 analyses/mois
- 3 veilles 3×/sem
- Top 10 débloqué

À expiration, la veille sera suspendue. Tu peux la réactiver plus tard en passant Pro.`;

  return { subject, html: wrapHtml({ subject, body, campaign: "watch_expiration_warn" }), text };
}

// ──────────────────────────────────────────────────────────────────
// 2) PPU expiration warning (J-7, J-2)
// ──────────────────────────────────────────────────────────────────

export interface PpuWarnInput extends BaseTemplateInput {
  daysLeft: number;
  totalOpportunities: number;
}

export function buildPpuExpirationWarnEmail(input: PpuWarnInput): {
  subject: string;
  html: string;
  text: string;
} {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";
  const subject =
    input.daysLeft <= 2
      ? `⏳ Ta veille bonus PPU expire dans ${input.daysLeft} jour${input.daysLeft > 1 ? "s" : ""}`
      : `Ta veille bonus PPU expire dans ${input.daysLeft} jours`;

  const body = `
    <h1 style="font-size:20px;font-weight:600;color:${FG};margin:0 0 16px">
      ${input.daysLeft <= 2 ? "⏳ " : ""}Ton bonus veille PPU expire dans ${input.daysLeft} jour${input.daysLeft > 1 ? "s" : ""}
    </h1>
    <p style="font-size:14px;color:${FG};margin:0 0 12px">${hello}</p>
    <p style="font-size:14px;color:${FG};line-height:1.6;margin:0 0 16px">
      Tu as utilisé ton analyse à 14,90 € qui débloque une veille de 30 jours sur <strong>${escapeHtml(input.watchName)}</strong>.
      Depuis, on a scouté <strong>${input.totalOpportunities} bien${input.totalOpportunities > 1 ? "s" : ""}</strong> pour toi.
    </p>
    <div style="margin:24px 0;padding:20px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px">
      <div style="font-size:15px;font-weight:600;color:${FG};margin-bottom:12px">
        🎯 Fixe cette veille à vie avec Pro
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:${FG};line-height:1.6">
        Tu connais déjà la valeur. Pour <strong>39€/mois</strong> tu gardes ta veille active +
        2 veilles supplémentaires + 10 analyses incluses.
      </p>
      <a href="${withUtm(`${APP_URL}/app/billing`, "watch_expiration_warn")}"
         style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
        Passer Pro maintenant
      </a>
      <div style="margin-top:12px;font-size:12px;color:${MUTED}">
        Tu peux aussi reprendre une analyse PPU pour relancer 30j de veille (14,90€).
      </div>
    </div>
    <p style="font-size:13px;color:${MUTED};margin:0">
      Sans action, ta veille sera <strong>suspendue</strong> à expiration. Elle reste réactivable.
    </p>
  `;

  const text = `${hello}

Ton bonus veille PPU "${input.watchName}" expire dans ${input.daysLeft} jours.

Cette veille a scouté ${input.totalOpportunities} biens pendant sa période active.

Passe Pro à 39€/mois pour la fixer à vie : ${APP_URL}/app/billing
- 10 analyses/mois
- 3 veilles 3×/sem (cette veille + 2 autres)

Sans action, la veille sera suspendue (réactivable).`;

  return { subject, html: wrapHtml({ subject, body, campaign: "watch_expiration_warn" }), text };
}

// ──────────────────────────────────────────────────────────────────
// 3) Suspended notification (J0)
// ──────────────────────────────────────────────────────────────────

export interface SuspendedInput extends BaseTemplateInput {
  origin: "free" | "ppu";
}

export function buildSuspendedEmail(input: SuspendedInput): {
  subject: string;
  html: string;
  text: string;
} {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";
  const subject = `Ta veille ImmoScan a été suspendue`;

  const upsellText =
    input.origin === "free"
      ? "Ta période gratuite de 60 jours est terminée. Passe Pro (7 jours gratuits) pour la réactiver en 1 clic et garder 3 veilles 3×/sem."
      : "Ton bonus PPU de 30 jours est terminé. Passe Pro pour la réactiver et garder ta veille à vie.";

  const body = `
    <h1 style="font-size:20px;font-weight:600;color:${FG};margin:0 0 16px">
      Ta veille a été suspendue
    </h1>
    <p style="font-size:14px;color:${FG};margin:0 0 12px">${hello}</p>
    <p style="font-size:14px;color:${FG};line-height:1.6;margin:0 0 16px">
      La veille <strong>${escapeHtml(input.watchName)}</strong> vient d'être suspendue.
      Elle n'est pas supprimée — tes données et son historique restent accessibles, et tu peux la réactiver à tout moment.
    </p>
    <p style="font-size:14px;color:${FG};line-height:1.6;margin:0 0 16px">${upsellText}</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${withUtm(`${APP_URL}/app/billing`, "watch_suspended")}"
         style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
        Réactiver via Pro
      </a>
    </div>
    <div style="margin-top:16px;padding:14px;background:#f3f4f6;border-radius:8px;font-size:12px;color:${MUTED};line-height:1.6">
      ${
        input.origin === "ppu"
          ? `Tu peux aussi reprendre une analyse à 14,90€ pour relancer une veille de 30 jours.`
          : `Tu peux aussi consulter ta veille en lecture seule depuis ton compte.`
      }
    </div>
  `;

  const text = `${hello}

Ta veille "${input.watchName}" a été suspendue (mais pas supprimée).

${upsellText}

Réactiver : ${APP_URL}/app/billing`;

  return { subject, html: wrapHtml({ subject, body, campaign: "watch_suspended" }), text };
}

// ──────────────────────────────────────────────────────────────────
// Milestone resolver
// ──────────────────────────────────────────────────────────────────

export type ExpirationMilestone =
  | "free_warn_J10"
  | "free_warn_J3"
  | "free_suspended_J0"
  | "ppu_warn_J7"
  | "ppu_warn_J2"
  | "ppu_suspended_J0";

/**
 * Détermine le milestone à envoyer (ou null si rien aujourd'hui).
 * `daysLeft` : jours entiers jusqu'à expiration (peut être négatif si déjà passé).
 * `origin` : "free" ou "ppu" — distingué côté caller via entitlements.
 */
export function resolveMilestone(
  daysLeft: number,
  origin: "free" | "ppu",
): ExpirationMilestone | null {
  if (origin === "free") {
    if (daysLeft === 10) return "free_warn_J10";
    if (daysLeft === 3) return "free_warn_J3";
    if (daysLeft <= 0) return "free_suspended_J0";
  } else {
    if (daysLeft === 7) return "ppu_warn_J7";
    if (daysLeft === 2) return "ppu_warn_J2";
    if (daysLeft <= 0) return "ppu_suspended_J0";
  }
  return null;
}
