// Template HTML du digest veille — généré inline pour éviter une dep
// React-Email supplémentaire. Esthétique simple, lisible sur mobile.
//
// Structure (cf module-veille-immoscan.md §7.2) :
//   Header → 4 sections (new_match, price_drop, signal_to_verify, market) → Footer
//
// Pour les users Free : floutage des biens score ≥ 70 (BM §7.3) + CTA upgrade
// en footer + countdown expiration.

import { FREEMIUM_MASK_THRESHOLD } from "@immoscan/shared";

import type {
  WatchEvent,
  WatchListing,
  PlanId,
} from "@immoscan/shared";

const APP_URL = process.env.APP_URL ?? "https://app.immoscan.fr";

// Helpers UTM pour traquer les clics depuis les emails côté PostHog
// (le frontend détecte utm_source=immoscan_email au mount et fire l'event
// `email_clicked` une fois par session — cf lib/posthog.ts).
function withUtm(url: string, campaign: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=immoscan_email&utm_medium=email&utm_campaign=${campaign}`;
}

export interface DigestData {
  profileFirstName: string | null;
  plan: PlanId;
  /** ID du user pour lien direct vers /app/billing si Free. */
  expiresAt: string | null; // ISO date — expiration veille (Free/PPU)
  /** Map watch_id → label (pour grouper les events) */
  watches: Array<{
    id: string;
    name: string;
    location: string | null;
  }>;
  /** Événements à inclure dans le digest (filtrés sur les 5 plus pertinents par section). */
  newMatches: Array<{
    event: WatchEvent;
    listing: WatchListing;
    watchName: string;
  }>;
  priceDrops: Array<{
    event: WatchEvent;
    listing: WatchListing;
    watchName: string;
  }>;
  signalsToVerify: Array<{
    event: WatchEvent;
    listing: WatchListing;
    watchName: string;
  }>;
  /** Stats marché des zones surveillées (BM §7.2 "Signal marché"). */
  marketStats: Array<{
    city: string;
    medianEurM2: number;
    deltaPct: number | null;
  }>;
  totalScored: number;
  totalRetained: number;
}

const MUTED = "#737373";
const FG = "#0a0a0a";
const BG = "#fafafa";
const CARD_BG = "#ffffff";
const BORDER = "#e5e5e5";
const PRIMARY = "#0070f3";
const SUCCESS = "#16a34a";
const WARN = "#d97706";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function fmtPct(n: number, signed = true): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1).replace(".", ",")} %`;
}

function isMasked(plan: PlanId, score: number | null): boolean {
  if (plan !== "free") return false;
  return (score ?? 0) >= FREEMIUM_MASK_THRESHOLD;
}

function scoreBadgeColor(score: number | null): string {
  if (score == null) return MUTED;
  if (score >= 75) return SUCCESS;
  if (score >= 50) return PRIMARY;
  return WARN;
}

function listingCard(args: {
  listing: WatchListing;
  watchName: string;
  plan: PlanId;
  reasonLine: string;
}): string {
  const { listing, watchName, plan, reasonLine } = args;
  const masked = isMasked(plan, listing.current_score);
  const titleSafe = escapeHtml(listing.title ?? "Sans titre");
  const score = listing.current_score ?? 0;
  const scoreColor = scoreBadgeColor(listing.current_score);
  const priceLine = masked
    ? `<span style="color:${MUTED}">🔒 Prix masqué — débloque avec Pro</span>`
    : `<strong>${fmtEur(listing.current_price)}</strong>${
        listing.current_surface
          ? ` <span style="color:${MUTED}">· ${Math.round(
              listing.current_price / listing.current_surface,
            )} €/m²</span>`
          : ""
      }`;
  const sourceLink = masked
    ? `<span style="color:${MUTED};">🔒</span>`
    : `<a href="${escapeHtml(listing.source_url)}" style="color:${PRIMARY};text-decoration:none">Voir l'annonce →</a>`;
  return `
    <div style="border:1px solid ${BORDER};border-radius:8px;padding:14px;margin:0 0 10px 0;background:${CARD_BG}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div style="font-size:12px;color:${MUTED};margin-bottom:2px">📍 ${escapeHtml(watchName)}</div>
          <div style="font-size:14px;font-weight:600;color:${FG};line-height:1.4">${titleSafe}</div>
        </div>
        <div style="background:${scoreColor};color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;white-space:nowrap">
          ${score.toFixed(0)} / 100
        </div>
      </div>
      <div style="margin-top:6px;font-size:13px;color:${FG}">${priceLine}</div>
      ${listing.current_dpe ? `<div style="margin-top:2px;font-size:12px;color:${MUTED}">DPE ${escapeHtml(listing.current_dpe)}</div>` : ""}
      <div style="margin-top:6px;font-size:12px;color:${MUTED};font-style:italic">${escapeHtml(reasonLine)}</div>
      <div style="margin-top:8px;font-size:12px">${sourceLink}</div>
    </div>
  `;
}

function newMatchCard(item: DigestData["newMatches"][number], plan: PlanId): string {
  const { event, listing, watchName } = item;
  const payload = event.payload as { score?: number; prix_m2?: number | null };
  const reason = payload.prix_m2
    ? `Score ${payload.score?.toFixed(0)} · ${payload.prix_m2.toFixed(0)} €/m²`
    : `Score ${payload.score?.toFixed(0)}`;
  return listingCard({ listing, watchName, plan, reasonLine: reason });
}

function priceDropCard(item: DigestData["priceDrops"][number], plan: PlanId): string {
  const { event, listing, watchName } = item;
  const payload = event.payload as { old_price?: number; new_price?: number; delta_pct?: number };
  const reason =
    payload.old_price != null && payload.new_price != null && payload.delta_pct != null
      ? `Baisse ${fmtPct(payload.delta_pct)} · ${fmtEur(payload.old_price)} → ${fmtEur(payload.new_price)}`
      : "Baisse de prix détectée";
  return listingCard({ listing, watchName, plan, reasonLine: reason });
}

function signalCard(item: DigestData["signalsToVerify"][number], plan: PlanId): string {
  const { event, listing, watchName } = item;
  const payload = event.payload as {
    ecart_pct?: number;
    n_transactions?: number;
    median_eur_m2?: number;
  };
  const reason =
    payload.ecart_pct != null && payload.n_transactions != null
      ? `Décote potentielle ${fmtPct(payload.ecart_pct)} vs médian DVF (n=${payload.n_transactions} transactions, à vérifier sur place)`
      : "Décote potentielle à vérifier";
  return listingCard({ listing, watchName, plan, reasonLine: reason });
}

export function buildDigestHtml(data: DigestData): { html: string; text: string; subject: string } {
  const hello = data.profileFirstName
    ? `Bonjour ${escapeHtml(data.profileFirstName)},`
    : "Bonjour,";

  const totalEvents =
    data.newMatches.length + data.priceDrops.length + data.signalsToVerify.length;

  const subject =
    totalEvents === 0
      ? "ImmoScan — Rien à signaler aujourd'hui"
      : data.newMatches.length > 0
        ? `ImmoScan — ${data.newMatches.length} nouveau${data.newMatches.length > 1 ? "x" : ""} bien${data.newMatches.length > 1 ? "s" : ""} retenu${data.newMatches.length > 1 ? "s" : ""} ce matin`
        : `ImmoScan — ${totalEvents} évolution${totalEvents > 1 ? "s" : ""} sur tes veilles`;

  const newSection =
    data.newMatches.length > 0
      ? `
    <h2 style="margin:24px 0 12px 0;font-size:15px;color:${FG};font-weight:700;text-transform:uppercase;letter-spacing:0.02em">
      🆕 Nouveaux biens (${data.newMatches.length})
    </h2>
    ${data.newMatches.map((m) => newMatchCard(m, data.plan)).join("\n")}
  `
      : "";

  const dropSection =
    data.priceDrops.length > 0
      ? `
    <h2 style="margin:24px 0 12px 0;font-size:15px;color:${FG};font-weight:700;text-transform:uppercase;letter-spacing:0.02em">
      💰 Baisses de prix (${data.priceDrops.length})
    </h2>
    ${data.priceDrops.map((m) => priceDropCard(m, data.plan)).join("\n")}
  `
      : "";

  const signalSection =
    data.signalsToVerify.length > 0
      ? `
    <h2 style="margin:24px 0 12px 0;font-size:15px;color:${FG};font-weight:700;text-transform:uppercase;letter-spacing:0.02em">
      🔍 Décotes à vérifier (${data.signalsToVerify.length})
    </h2>
    ${data.signalsToVerify.map((m) => signalCard(m, data.plan)).join("\n")}
  `
      : "";

  const marketSection =
    data.marketStats.length > 0
      ? `
    <h2 style="margin:24px 0 12px 0;font-size:15px;color:${FG};font-weight:700;text-transform:uppercase;letter-spacing:0.02em">
      📊 Signal marché
    </h2>
    <div style="border:1px solid ${BORDER};border-radius:8px;padding:14px;background:${CARD_BG}">
      <div style="font-size:13px;color:${FG};margin-bottom:6px">Évolution €/m² médian sur tes zones :</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:${FG};line-height:1.7">
        ${data.marketStats
          .map(
            (s) => `
          <li>
            <strong>${escapeHtml(s.city)}</strong> : ${Math.round(s.medianEurM2)} €/m²
            ${
              s.deltaPct != null
                ? `<span style="color:${s.deltaPct > 0 ? SUCCESS : s.deltaPct < 0 ? WARN : MUTED}">
                    (${fmtPct(s.deltaPct)} ${s.deltaPct > 0 ? "↑" : s.deltaPct < 0 ? "↓" : ""})
                  </span>`
                : ""
            }
          </li>`,
          )
          .join("")}
      </ul>
    </div>
  `
      : "";

  // Bandeau spécifique Free : countdown + CTA upgrade
  const freeFooter =
    data.plan === "free" && data.expiresAt
      ? (() => {
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (new Date(data.expiresAt!).getTime() - Date.now()) / (24 * 3600 * 1000),
            ),
          );
          return `
        <div style="margin:24px 0;padding:16px;background:#fef3c7;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#92400e;margin-bottom:8px">
            ⏳ Ta veille gratuite expire dans <strong>${daysLeft} jour${daysLeft > 1 ? "s" : ""}</strong>
          </div>
          <a href="${withUtm(`${APP_URL}/app/billing`, "watch_digest")}"
             style="display:inline-block;background:${PRIMARY};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
            Passer Pro — 7 jours gratuits sans CB
          </a>
        </div>
      `;
        })()
      : "";

  // Bandeau spécifique PPU : countdown
  const ppuFooter =
    data.plan !== "free" && data.expiresAt
      ? (() => {
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (new Date(data.expiresAt!).getTime() - Date.now()) / (24 * 3600 * 1000),
            ),
          );
          return daysLeft <= 10
            ? `
        <div style="margin:24px 0;padding:16px;background:#fef3c7;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#92400e;margin-bottom:8px">
            ⏳ Ta veille PPU expire dans <strong>${daysLeft} jour${daysLeft > 1 ? "s" : ""}</strong>
          </div>
          <a href="${withUtm(`${APP_URL}/app/billing`, "watch_digest")}"
             style="display:inline-block;background:${PRIMARY};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
            Passer Pro pour fixer ta veille à vie
          </a>
        </div>
      `
            : "";
        })()
      : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${FG}">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${FG}">ImmoScan</div>
    </div>

    <p style="margin:0 0 8px 0;font-size:14px;color:${FG}">${hello}</p>
    <p style="margin:0 0 16px 0;font-size:14px;color:${MUTED}">
      ${
        totalEvents === 0
          ? "Aucune évolution notable sur tes veilles ce matin. On surveille toujours."
          : `Voici ce qui mérite ton œil sur tes ${data.watches.length} veille${data.watches.length > 1 ? "s" : ""} ce matin.`
      }
    </p>

    ${newSection}
    ${dropSection}
    ${signalSection}
    ${marketSection}

    <!-- Stats line -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${BORDER};text-align:center;font-size:12px;color:${MUTED}">
      Total scoré aujourd'hui : ${data.totalScored} biens · ${data.totalRetained} retenus pour toi.
    </div>

    <!-- Footers spécifiques palier -->
    ${freeFooter}
    ${ppuFooter}

    <!-- CTA Voir mes veilles -->
    <div style="margin:24px 0;text-align:center">
      <a href="${withUtm(`${APP_URL}/app/veilles`, "watch_digest")}"
         style="color:${PRIMARY};text-decoration:none;font-size:13px;font-weight:500">
        Voir toutes mes veilles sur ImmoScan →
      </a>
    </div>

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid ${BORDER};text-align:center;font-size:11px;color:${MUTED};line-height:1.6">
      <div>Tu reçois ce digest les ${data.plan === "business" ? "matins (Business)" : "lun/mer/ven à 8h"}</div>
      <div style="margin-top:6px">
        <a href="${withUtm(`${APP_URL}/app/veilles`, "watch_digest")}" style="color:${MUTED}">Modifier mes critères</a>
        ·
        <a href="${withUtm(`${APP_URL}/app/billing`, "watch_digest")}" style="color:${MUTED}">Préférences email</a>
      </div>
    </div>

  </div>
</body>
</html>`;

  // Version texte minimaliste pour clients qui n'affichent pas le HTML
  const text = `${hello}

${totalEvents === 0 ? "Aucune évolution notable sur tes veilles ce matin." : `${totalEvents} évolution(s) sur tes veilles :`}

${data.newMatches.length > 0 ? `🆕 ${data.newMatches.length} nouveau(x) bien(s) retenu(s)` : ""}
${data.priceDrops.length > 0 ? `💰 ${data.priceDrops.length} baisse(s) de prix` : ""}
${data.signalsToVerify.length > 0 ? `🔍 ${data.signalsToVerify.length} décote(s) à vérifier` : ""}

Voir le détail : ${APP_URL}/app/veilles

ImmoScan · Tu peux modifier tes critères ou te désinscrire depuis ton compte.`;

  return { subject, html, text };
}
