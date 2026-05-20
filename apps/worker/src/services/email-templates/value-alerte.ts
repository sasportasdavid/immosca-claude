// Template email ImmoValue — alerte variation valorisation.
//
// Déclenché par le worker `value-send-alerte-email` quand la valo
// recalculée s'écarte de plus de `alert_threshold_pct` du dernier
// snapshot (selon préférence user `alert_frequency`).
//
// Esthétique alignée sur digest.ts / expiration.ts (inline HTML, sans
// dépendance React-Email côté worker).

import type { ValorisationOutput } from "@immoscan/shared/value";

const APP_URL = process.env.APP_URL ?? "https://app.immoscan.fr";

function withUtm(url: string, campaign: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=immovalue_email&utm_medium=email&utm_campaign=${campaign}`;
}

const MUTED = "#737373";
const FG = "#0a0a0a";
const BG = "#fafafa";
const CARD_BG = "#ffffff";
const BORDER = "#e5e5e5";
const PRIMARY = "#0070f3";
const SUCCESS = "#16a34a";
const DANGER = "#dc2626";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export interface AlerteValoInput {
  /** Prénom du destinataire (peut être null). */
  profileFirstName: string | null;
  bienAddressDisplay: string;
  bienId: string;
  delta_pct: number;
  valoCourante: ValorisationOutput;
  valoPrecedente: ValorisationOutput | null;
}

export interface AlerteValoEmailOutput {
  subject: string;
  html: string;
  text: string;
}

/**
 * Construit le sujet selon la magnitude de la variation. Au-delà de
 * ±5% on utilise un emoji de tendance + accroche émotionnelle.
 */
function deltaPctSubject(delta_pct: number, address: string): string {
  const arrow = delta_pct >= 0 ? "↑" : "↓";
  const magnitude = Math.abs(delta_pct);
  const prefix =
    magnitude >= 5
      ? delta_pct > 0
        ? "📈 Bonne nouvelle"
        : "📉 Attention"
      : `${arrow} Mise à jour`;
  return `${prefix} : ${formatPct(delta_pct)} sur ${address}`;
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
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${FG}">ImmoValue</div>
    </div>
    ${args.body}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid ${BORDER};text-align:center;font-size:11px;color:${MUTED};line-height:1.6">
      <div>
        <a href="${withUtm(`${APP_URL}/value/biens`, args.campaign)}" style="color:${MUTED}">Mes biens</a>
        ·
        <a href="${withUtm(`${APP_URL}/mon-compte/alertes`, args.campaign)}" style="color:${MUTED}">Préférences alertes</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildAlerteValoEmail(input: AlerteValoInput): AlerteValoEmailOutput {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";
  const subject = deltaPctSubject(input.delta_pct, input.bienAddressDisplay);
  const isUp = input.delta_pct >= 0;
  const deltaColor = isUp ? SUCCESS : DANGER;
  const deltaLabel = isUp ? "en hausse" : "en baisse";

  const valoPrec =
    input.valoPrecedente?.valorisation.central ?? input.valoCourante.valorisation.central;
  const valoCour = input.valoCourante.valorisation.central;

  const bienUrl = withUtm(
    `${APP_URL}/value/biens/${input.bienId}`,
    "value_alerte",
  );

  const body = `
    <h1 style="font-size:20px;font-weight:600;color:${FG};margin:0 0 16px">
      Ton bien <strong>${escapeHtml(input.bienAddressDisplay)}</strong> est ${deltaLabel}
    </h1>
    <p style="font-size:14px;color:${FG};margin:0 0 12px">${hello}</p>
    <p style="font-size:14px;color:${FG};line-height:1.6;margin:0 0 16px">
      Notre estimation IA a recalculé la valeur de ton bien en fonction du marché récent
      (DVF, annonces actives, comparables sectoriels).
    </p>

    <div style="margin:24px 0;padding:20px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline">
        <div>
          <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em">Estimation précédente</div>
          <div style="font-size:20px;font-weight:600;color:${FG}">${formatEur(valoPrec)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em">Nouvelle estimation</div>
          <div style="font-size:24px;font-weight:700;color:${deltaColor}">${formatEur(valoCour)}</div>
          <div style="font-size:13px;color:${deltaColor};font-weight:600">${formatPct(input.delta_pct)}</div>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED}">
        Fourchette : ${formatEur(input.valoCourante.valorisation.bas)} – ${formatEur(input.valoCourante.valorisation.haut)}
        (confiance ${Math.round(input.valoCourante.valorisation.confiance * 100)}%)
      </div>
    </div>

    <div style="margin:24px 0;padding:16px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px">
      <div style="font-size:13px;font-weight:600;color:${FG};margin-bottom:8px">Pourquoi cette variation</div>
      <p style="margin:0;font-size:13px;color:${FG};line-height:1.6">
        ${escapeHtml(input.valoCourante.these.slice(0, 400))}${input.valoCourante.these.length > 400 ? "..." : ""}
      </p>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${bienUrl}"
         style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
        Voir le dossier complet
      </a>
    </div>

    <p style="font-size:12px;color:${MUTED};margin:16px 0 0;line-height:1.5">
      Tu reçois cet email parce que tu as activé les alertes de valorisation sur ce bien.
      Tu peux changer la fréquence ou désactiver les alertes depuis tes <a href="${withUtm(`${APP_URL}/mon-compte/alertes`, "value_alerte")}" style="color:${PRIMARY}">préférences</a>.
    </p>
  `;

  const text = `${hello}

Ton bien ${input.bienAddressDisplay} est ${deltaLabel} (${formatPct(input.delta_pct)}).

Estimation précédente : ${formatEur(valoPrec)}
Nouvelle estimation : ${formatEur(valoCour)}
Fourchette : ${formatEur(input.valoCourante.valorisation.bas)} – ${formatEur(input.valoCourante.valorisation.haut)}

Voir le dossier complet : ${bienUrl}
`;

  return {
    subject,
    html: wrapHtml({ subject, body, campaign: "value_alerte" }),
    text,
  };
}

/**
 * Décide si on envoie l'alerte selon la fréquence préférée par l'user.
 * Cf §5.3 + table value.biens.alert_frequency.
 */
export function shouldNotify(
  alertFrequency: string,
  alertThresholdPct: number,
  deltaPct: number,
  lastNotifiedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (alertFrequency === "never") return false;
  if (Math.abs(deltaPct) < alertThresholdPct) return false;

  if (alertFrequency === "on_significant_change") return true;

  if (!lastNotifiedAt) return true;
  const last = new Date(lastNotifiedAt).getTime();
  const elapsed = now.getTime() - last;
  const DAY = 86_400_000;
  if (alertFrequency === "weekly") return elapsed >= 7 * DAY;
  if (alertFrequency === "monthly") return elapsed >= 30 * DAY;
  if (alertFrequency === "quarterly") return elapsed >= 90 * DAY;
  return false;
}
