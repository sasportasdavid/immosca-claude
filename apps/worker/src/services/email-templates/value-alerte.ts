// Template email ImmoValue — alerte variation valorisation (écran 18 du
// brief design).
//
// Déclenché par le worker `value-send-alerte-email` quand la valo
// recalculée s'écarte de plus de `alert_threshold_pct` du dernier
// snapshot (selon préférence user `alert_frequency`).
//
// DA : terracotta + Inter + Instrument Serif italic. La phrase
// "explication marché" est en serif italic pour donner le moment dramatique
// (cf brief §3.2). Voir `value-common.ts` pour les helpers HTML partagés.

import type { ValorisationOutput } from "@immoscan/shared/value";

import {
  APP_URL,
  FONT_SANS,
  FONT_SERIF,
  VALUE_COLORS,
  escapeHtml,
  formatEur,
  formatPct,
  valueButton,
  valueWrapHtml,
  withUtm,
} from "./value-common.js";

export interface AlerteValoInput {
  /** Prénom du destinataire (peut être null). */
  profileFirstName: string | null;
  /** Adresse affichée du bien — ex. "T3 à Gagny". */
  bienAddressDisplay: string;
  bienId: string;
  /** URL photo principale (optionnelle). */
  photoUrl?: string | null;
  /** Variation en % vs estimation précédente — signé. */
  delta_pct: number;
  /** Estimation Claude la plus récente. */
  valoCourante: ValorisationOutput;
  /** Estimation précédente (peut être null si premier snapshot). */
  valoPrecedente: ValorisationOutput | null;
  /**
   * Historique de la valeur centrale sur les N derniers mois, ordre
   * chronologique. Sert au mini-graphe SVG. Si vide ou null, le graphe
   * est skippé.
   */
  serieHistorique?: Array<{ dateIso: string; valeur: number }> | null;
  /**
   * Contexte marché secteur — quartier + nb ventes + delta médian. Si null,
   * on tombe sur un texte générique extrait de la thèse Claude.
   */
  contexteMarche?: {
    quartier: string;
    nbVentesRecentes: number;
    deltaMedianPct: number;
  } | null;
}

export interface AlerteValoEmailOutput {
  subject: string;
  html: string;
  text: string;
}

const CAMPAIGN = "value_alerte";

/**
 * Construit le sujet dynamique selon le sens de la variation.
 * Brief : "📈 La valeur de ton bien a évolué de +X,X %" (espace insécable
 * + virgule décimale).
 */
function buildSubject(delta_pct: number): string {
  if (delta_pct > 0) {
    return `📈 La valeur de ton bien a évolué de ${formatPct(delta_pct)}`;
  }
  if (delta_pct < 0) {
    // formatPct met "-" via signed=true uniquement pour positifs ; on signe à
    // la main pour garder "−" lisible côté Gmail.
    return `📉 La valeur de ton bien a évolué de ${formatPct(delta_pct, false)}`;
  }
  return `Mise à jour de la valeur de ton bien`;
}

/**
 * Mini-graphe SVG de la courbe sur N points. Largeur 520 hauteur 80.
 * On garde un SVG simple <path> compatible Gmail/Outlook (Outlook ignore SVG
 * mais affichera l'`<img alt>` fallback en-dessous — pas critique).
 */
function buildSparkline(
  points: Array<{ dateIso: string; valeur: number }>,
  isUp: boolean,
): string {
  if (points.length < 2) return "";
  const W = 520;
  const H = 80;
  const PAD = 4;
  const values = points.map((p) => p.valeur);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (W - 2 * PAD) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p.valeur - min) / range) * (H - 2 * PAD);
    return { x, y };
  });
  const linePath = coords
    .map((c, i) => (i === 0 ? `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` : `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`))
    .join(" ");
  // Path remplissage sous la courbe — coords est garanti non-vide (length≥2)
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const firstX = first.x.toFixed(1);
  const lastX = last.x.toFixed(1);
  const fillPath = `${linePath} L ${lastX} ${H - PAD} L ${firstX} ${H - PAD} Z`;

  const stroke = isUp ? VALUE_COLORS.sage : VALUE_COLORS.terra;
  const fill = isUp ? VALUE_COLORS.sageSoft : VALUE_COLORS.terraSoft;

  return `
    <div style="margin:8px 0 4px;text-align:center">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;margin:0 auto">
        <path d="${fillPath}" fill="${fill}" opacity="0.55"/>
        <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${coords
          .map(
            (c, i) =>
              i === coords.length - 1
                ? `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="${stroke}"/>`
                : "",
          )
          .join("")}
      </svg>
      <div style="font-family:${FONT_SANS};font-size:11px;color:${VALUE_COLORS.faint};margin-top:2px;letter-spacing:0.04em;text-transform:uppercase">
        6 derniers mois
      </div>
    </div>
  `;
}

export function buildAlerteValoEmail(input: AlerteValoInput): AlerteValoEmailOutput {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";

  const subject = buildSubject(input.delta_pct);
  const isUp = input.delta_pct >= 0;

  const valoCour = input.valoCourante.valorisation.central;
  const valoPrec =
    input.valoPrecedente?.valorisation.central ?? valoCour;

  const preheader = `Avant : ${formatEur(valoPrec)}. Maintenant : ${formatEur(valoCour)}. Delta ${formatPct(input.delta_pct)}.`;

  const bienUrl = withUtm(`${APP_URL}/value/biens/${input.bienId}`, CAMPAIGN);
  const alertesUrl = withUtm(
    `${APP_URL}/value/biens/${input.bienId}?tab=parametres`,
    CAMPAIGN,
  );

  // Badge delta : sage si hausse, terra si baisse
  const deltaBadgeBg = isUp ? VALUE_COLORS.sageSoft : VALUE_COLORS.terraSoft;
  const deltaBadgeFg = isUp ? VALUE_COLORS.sageInk : VALUE_COLORS.terraDeep;
  const deltaBadgeBorder = isUp
    ? "rgba(124,152,133,0.30)"
    : "rgba(217,119,87,0.20)";

  // Photo (optionnelle)
  const photoBlock = input.photoUrl
    ? `<img src="${escapeHtml(input.photoUrl)}" alt="${escapeHtml(input.bienAddressDisplay)}" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border-radius:10px;background:${VALUE_COLORS.terraSoft}" />`
    : "";

  // Bloc avant / maintenant / delta
  const valuesBlock = `
    <div style="margin-top:${input.photoUrl ? "16px" : "0"}">
      <div style="font-family:${FONT_SANS};font-size:16px;font-weight:600;color:${VALUE_COLORS.ink};letter-spacing:-0.01em">
        Ton ${escapeHtml(input.bienAddressDisplay)}
      </div>

      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:14px">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:8px">
            <div style="font-family:${FONT_SANS};font-size:11px;color:${VALUE_COLORS.mute2};text-transform:uppercase;letter-spacing:0.06em;font-weight:500">
              Avant
            </div>
            <div class="tnum" style="margin-top:4px;font-family:${FONT_SANS};font-variant-numeric:tabular-nums;font-size:18px;font-weight:500;color:${VALUE_COLORS.mute2};letter-spacing:-0.01em">
              ${escapeHtml(formatEur(valoPrec))}
            </div>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:8px;border-left:1px solid ${VALUE_COLORS.line}">
            <div style="font-family:${FONT_SANS};font-size:11px;color:${VALUE_COLORS.mute2};text-transform:uppercase;letter-spacing:0.06em;font-weight:500">
              Maintenant
            </div>
            <div class="tnum" style="margin-top:4px;font-family:${FONT_SANS};font-variant-numeric:tabular-nums;font-size:22px;font-weight:700;color:${VALUE_COLORS.ink};letter-spacing:-0.015em">
              ${escapeHtml(formatEur(valoCour))}
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-top:14px">
        <span class="tnum" style="display:inline-block;font-variant-numeric:tabular-nums;background:${deltaBadgeBg};color:${deltaBadgeFg};border:1px solid ${deltaBadgeBorder};border-radius:999px;padding:5px 12px;font-family:${FONT_SANS};font-size:13px;font-weight:600;letter-spacing:-0.005em">
          Delta : ${escapeHtml(formatPct(input.delta_pct))}
        </span>
        <span style="margin-left:8px;font-family:${FONT_SANS};font-size:12px;color:${VALUE_COLORS.faint}">
          fourchette ${escapeHtml(formatEur(input.valoCourante.valorisation.bas))} – ${escapeHtml(formatEur(input.valoCourante.valorisation.haut))}
        </span>
      </div>
    </div>
  `;

  // Sparkline (si série fournie)
  const sparkline = input.serieHistorique && input.serieHistorique.length >= 2
    ? buildSparkline(input.serieHistorique, isUp)
    : "";

  // Section explication marché — phrase en serif italic pour le drama
  const contexte = input.contexteMarche;
  const explainText = contexte
    ? `Le marché de ton secteur (${escapeHtml(contexte.quartier)}) connaît une tension à ${isUp ? "la hausse" : "la baisse"} : ${contexte.nbVentesRecentes} nouvelles ventes en 4 semaines, prix médian ${contexte.deltaMedianPct >= 0 ? "en hausse" : "en baisse"} de ${formatPct(Math.abs(contexte.deltaMedianPct), false)}.`
    : escapeHtml(input.valoCourante.these.slice(0, 320)) +
      (input.valoCourante.these.length > 320 ? "…" : "");

  const explanationBlock = `
    <div style="margin:24px 0;padding:18px 20px;background:${VALUE_COLORS.bg2};border:1px solid ${VALUE_COLORS.line};border-radius:10px">
      <div style="font-family:${FONT_SANS};font-size:11px;color:${VALUE_COLORS.mute2};text-transform:uppercase;letter-spacing:0.08em;font-weight:500;margin-bottom:8px">
        Ce qui a bougé
      </div>
      <p style="margin:0;font-family:${FONT_SERIF};font-style:italic;font-size:16px;color:${VALUE_COLORS.ink2};line-height:1.55;letter-spacing:0.005em">
        ${explainText}
      </p>
    </div>
  `;

  // CTAs
  const ctaBlock = `
    <div style="text-align:center;margin:28px 0 12px">
      ${valueButton({ href: bienUrl, label: "Voir le détail", variant: "terra" })}
    </div>
    <div style="text-align:center;margin:0 0 8px">
      <a href="${escapeHtml(alertesUrl)}" style="font-family:${FONT_SANS};font-size:13px;color:${VALUE_COLORS.muted};text-decoration:underline">
        Modifier mes alertes
      </a>
    </div>
  `;

  const body = `
    <h1 style="font-family:${FONT_SANS};font-size:22px;font-weight:600;color:${VALUE_COLORS.ink};margin:0 0 4px;letter-spacing:-0.01em;line-height:1.3">
      ${hello}
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:14px;color:${VALUE_COLORS.muted};line-height:1.55">
      Notre estimation a recalculé la valeur de ton bien en fonction du marché récent
      <span style="color:${VALUE_COLORS.faint}">— DVF, annonces actives, comparables sectoriels.</span>
    </p>

    <div class="card" style="background:${VALUE_COLORS.card};border:1px solid ${VALUE_COLORS.line};border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(28,25,23,0.04)">
      ${photoBlock}
      ${valuesBlock}
      ${sparkline}
    </div>

    ${explanationBlock}

    ${ctaBlock}
  `;

  const text = `${input.profileFirstName ? `Bonjour ${input.profileFirstName},` : "Bonjour,"}

La valeur de ton bien (${input.bienAddressDisplay}) a évolué de ${formatPct(input.delta_pct)}.

Avant : ${formatEur(valoPrec)}
Maintenant : ${formatEur(valoCour)}
Fourchette : ${formatEur(input.valoCourante.valorisation.bas)} – ${formatEur(input.valoCourante.valorisation.haut)}

${contexte ? `Marché ${contexte.quartier} : ${contexte.nbVentesRecentes} ventes récentes, prix médian ${formatPct(contexte.deltaMedianPct)}.` : input.valoCourante.these.slice(0, 240)}

Voir le détail : ${bienUrl}
Modifier mes alertes : ${alertesUrl}

—
ImmoValue · un produit ImmoScan
`;

  return {
    subject,
    html: valueWrapHtml({ subject, body, campaign: CAMPAIGN, preheader }),
    text,
  };
}

/**
 * Décide si on envoie l'alerte selon la fréquence préférée par l'user.
 * Cf §5.3 + table value.biens.alert_frequency.
 *
 * (Conservée ici car consommée par `value-send-alerte-email.ts`.)
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
