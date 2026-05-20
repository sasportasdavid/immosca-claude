// Helpers communs pour les templates email ImmoValue (basculement + alerte
// valo). Centralise palette, typo, wordmark, boutons, helpers de format pour
// rester aligné avec `value-tokens.css` et la DA ImmoValue (terracotta + Inter
// + Instrument Serif italic + tabular-nums sur les chiffres).
//
// Pas de dep React-Email : on génère du HTML inline pour rester compatible
// Gmail/Outlook + minimiser le bundle worker.

export const APP_URL = process.env.APP_URL ?? "https://app.immoscan.fr";

// ──────────────────────────────────────────────────────────────────
// Palette — alignée sur tokens.css + value-tokens.css
// ──────────────────────────────────────────────────────────────────

export const VALUE_COLORS = {
  // Surfaces stone warm
  bg: "#FAFAF9",
  bg2: "#F5F5F4",
  card: "#FFFFFF",
  ink: "#1C1917",
  ink2: "#292524",
  muted: "#57534E",
  mute2: "#78716C",
  faint: "#A8A29E",
  line: "#E7E5E4",
  line2: "#D6D3D1",
  // Accent ImmoValue
  terra: "#D97757",
  terra2: "#C76544",
  terraDeep: "#A8482A",
  terraSoft: "#FBEDE5",
  terraSoft2: "#F6DFD2",
  // Sage (variation positive douce)
  sage: "#7C9885",
  sage2: "#6A8773",
  sageSoft: "#E8EFE9",
  sageInk: "#2F5340",
  // Cross-promo ImmoScan (violet)
  violet: "#5B47E0",
  violetSoft: "#EEEBFB",
  violetInk: "#4A37C7",
  // Status
  bad: "#DC2626",
  badSoft: "#FEE2E2",
} as const;

// Gradient terracotta — encodé inline car les clients email modernes (Gmail,
// Apple Mail) supportent `background-image: linear-gradient(...)` sur
// `<a>`/`<div>`. Outlook tombe en fallback couleur unie via la propriété
// `background-color`.
export const TERRA_GRAD = "linear-gradient(180deg, #E08767 0%, #D97757 100%)";

// Fallback "system font stack" pour clients sans Google Fonts (Outlook). Inter
// est chargé en `<link>` dans `<head>` côté wrapper HTML — les clients qui
// l'ignorent retombent gracieusement sur `system-ui`.
export const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const FONT_SERIF =
  "'Instrument Serif', 'Times New Roman', Georgia, serif";

// ──────────────────────────────────────────────────────────────────
// Helpers de format — alignés sur le brief (espace insécable +
// virgule décimale, tabular-nums sur les chiffres)
// ──────────────────────────────────────────────────────────────────

const NBSP = " ";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formate un montant en euros avec espace insécable avant le €.
 * Ex: `formatEur(319000)` → "319 000 €" (avec NBSP).
 */
export function formatEur(n: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(n);
  return `${formatted}${NBSP}€`;
}

/**
 * Formate un pourcentage avec virgule décimale française + signe + espace
 * insécable. Ex: `formatPct(4.2)` → "+4,2 %".
 */
export function formatPct(n: number, signed = true): string {
  const sign = signed && n > 0 ? "+" : "";
  const value = n.toFixed(1).replace(".", ",");
  return `${sign}${value}${NBSP}%`;
}

/**
 * Formate une surface en m² avec espace insécable avant l'unité.
 */
export function formatSurface(m2: number): string {
  return `${Math.round(m2)}${NBSP}m²`;
}

/**
 * Formate une date ISO en jolie date française. Ex: "8 mai 2026".
 */
export function formatDateFr(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/**
 * Ajoute les UTM ImmoValue à une URL pour traquer les clics email côté
 * PostHog (`utm_source=immoscan_email&utm_medium=value`).
 *
 * Note : on garde `utm_source=immoscan_email` (et non immovalue_email) car
 * c'est la convention déjà câblée côté frontend dans `lib/posthog.ts` pour
 * détecter les emails au mount et fire `email_clicked` une fois par session.
 * Le `utm_medium=value` distingue les emails ImmoValue des digest ImmoScan.
 */
export function withUtm(url: string, campaign: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=immoscan_email&utm_medium=value&utm_campaign=${campaign}`;
}

// ──────────────────────────────────────────────────────────────────
// Wordmark ImmoValue — terra-grad mark 22×22 + Inter "Immo" +
// Instrument Serif italic terra "value"
// ──────────────────────────────────────────────────────────────────

/**
 * Header logo ImmoValue inline (centré). Le mark est en terra-grad (au lieu
 * du violet-grad utilisé sur le site web) pour différencier visuellement
 * les emails ImmoValue dans la boîte de réception.
 */
export function valueHeader(): string {
  return `
    <div style="text-align:center;margin-bottom:24px">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
        <tr>
          <td style="vertical-align:middle;padding-right:9px">
            <div style="width:22px;height:22px;border-radius:6px;background:${TERRA_GRAD};background-color:${VALUE_COLORS.terra};color:#fff;font-family:${FONT_SANS};font-weight:700;font-size:11px;text-align:center;line-height:22px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25)">I</div>
          </td>
          <td style="vertical-align:middle;font-family:${FONT_SANS};font-size:16px;font-weight:600;letter-spacing:-0.018em;color:${VALUE_COLORS.ink};line-height:22px">
            <span>Immo</span><span style="font-family:${FONT_SERIF};font-style:italic;font-weight:400;color:${VALUE_COLORS.terra};font-size:17px;letter-spacing:-0.012em">value</span>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Boutons
// ──────────────────────────────────────────────────────────────────

export type ButtonVariant = "terra" | "ghost";

/**
 * Bouton HTML inline — variante `terra` (CTA principal, terra-grad) ou
 * `ghost` (CTA secondaire, transparent + border).
 *
 * Émis comme `<a>` plutôt que `<button>` car certains clients email
 * (Outlook) ne rendent pas les boutons ; un `<a>` stylé est universel.
 */
export function valueButton(args: {
  href: string;
  label: string;
  variant?: ButtonVariant;
}): string {
  const variant = args.variant ?? "terra";
  const isTerra = variant === "terra";
  const styles = isTerra
    ? `display:inline-block;background:${TERRA_GRAD};background-color:${VALUE_COLORS.terra};color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-family:${FONT_SANS};font-size:14px;font-weight:600;box-shadow:0 1px 2px rgba(28,25,23,0.08),inset 0 1px 0 rgba(255,255,255,0.18);border:1px solid transparent`
    : `display:inline-block;background:${VALUE_COLORS.card};color:${VALUE_COLORS.ink};padding:12px 26px;border-radius:8px;text-decoration:none;font-family:${FONT_SANS};font-size:14px;font-weight:500;border:1px solid ${VALUE_COLORS.line}`;
  return `<a href="${escapeHtml(args.href)}" style="${styles}">${escapeHtml(args.label)}</a>`;
}

// ──────────────────────────────────────────────────────────────────
// Footer compliance — Resend recommande un lien désabonnement
// + adresse postale fictive (à remplacer en prod).
// ──────────────────────────────────────────────────────────────────

/**
 * Footer ImmoValue : navigation contextuelle + désabonnement +
 * "ImmoValue · un produit ImmoScan".
 */
export function valueFooter(args: {
  unsubscribeUrl?: string;
  campaign: string;
}): string {
  const unsubUrl =
    args.unsubscribeUrl ??
    withUtm(`${APP_URL}/mon-compte/alertes`, args.campaign);
  return `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${VALUE_COLORS.line};text-align:center;font-family:${FONT_SANS};font-size:11px;color:${VALUE_COLORS.mute2};line-height:1.6">
      <div style="margin-bottom:8px;font-weight:500;color:${VALUE_COLORS.muted}">
        <span>Immo</span><span style="font-family:${FONT_SERIF};font-style:italic;color:${VALUE_COLORS.terra}">value</span>
        <span style="color:${VALUE_COLORS.faint}"> · un produit ImmoScan</span>
      </div>
      <div>
        <a href="${escapeHtml(withUtm(`${APP_URL}/value/biens`, args.campaign))}" style="color:${VALUE_COLORS.mute2};text-decoration:none">Mes biens</a>
        <span style="color:${VALUE_COLORS.faint}">·</span>
        <a href="${escapeHtml(unsubUrl)}" style="color:${VALUE_COLORS.mute2};text-decoration:none">Préférences alertes</a>
        <span style="color:${VALUE_COLORS.faint}">·</span>
        <a href="${escapeHtml(unsubUrl)}" style="color:${VALUE_COLORS.mute2};text-decoration:none">Se désabonner</a>
      </div>
      <div style="margin-top:10px;color:${VALUE_COLORS.faint};font-size:10px">
        Tu reçois cet email parce que tu as activé des alertes sur ImmoValue.
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Wrapper HTML — head + body + container 600px
// ──────────────────────────────────────────────────────────────────

/**
 * Enveloppe le corps de l'email dans une structure HTML complète :
 *  - <head> avec charset, viewport, font Google + title
 *  - <body> avec fond `--bg` et container centré max-width 600px
 *  - header logo ImmoValue + body + footer compliance
 */
export function valueWrapHtml(args: {
  subject: string;
  body: string;
  campaign: string;
  preheader?: string;
}): string {
  // Preheader : caché visuellement, lu par les clients email pour aperçu
  // après le sujet. Important pour le CTR.
  const preheader = args.preheader
    ? `<div style="display:none;font-size:1px;color:${VALUE_COLORS.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(args.preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <title>${escapeHtml(args.subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    /* Réinit léger pour clients permissifs (Gmail web). Outlook l'ignore. */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    .tnum { font-variant-numeric: tabular-nums; }
    /* Mobile : on rétrécit padding du container */
    @media only screen and (max-width: 600px) {
      .container { padding: 20px 12px !important; }
      .card { padding: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${VALUE_COLORS.bg};font-family:${FONT_SANS};color:${VALUE_COLORS.ink};font-size:14px;line-height:1.5">
  ${preheader}
  <div class="container" style="max-width:600px;margin:0 auto;padding:32px 16px">
    ${valueHeader()}
    ${args.body}
    ${valueFooter({ campaign: args.campaign })}
  </div>
</body>
</html>`;
}
