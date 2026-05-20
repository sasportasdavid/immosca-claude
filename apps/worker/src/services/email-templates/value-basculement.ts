// Template email ImmoValue — basculement bien discret → public.
//
// Déclenché par le worker `value-notify-public-switch` quand un
// propriétaire fait passer son bien en vente publique. Tous les
// favoris en discret reçoivent un mail pour les inviter à contacter
// le vendeur.
//
// L'email affiche le rang du destinataire dans la file (ordre
// d'ajout aux favoris en discret) — narrative "tu es Xe à savoir".

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
const ACCENT = "#9333ea";

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

export interface BasculementPublicInput {
  profileFirstName: string | null;
  bienAddressDisplay: string;
  bienId: string;
  bienSlug: string | null;
  prixAffiche: number | null;
  rangFile: number;
  totalFile: number;
  /** Délai écoulé depuis l'ajout aux favoris (humanisé). */
  ancienneteFavoriHumain: string;
}

export interface BasculementPublicEmailOutput {
  subject: string;
  html: string;
  text: string;
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
        <a href="${withUtm(`${APP_URL}/mon-compte/favoris`, args.campaign)}" style="color:${MUTED}">Mes favoris</a>
        ·
        <a href="${withUtm(`${APP_URL}/mon-compte/alertes`, args.campaign)}" style="color:${MUTED}">Préférences alertes</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildBasculementPublicEmail(
  input: BasculementPublicInput,
): BasculementPublicEmailOutput {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";
  const subject = `🔓 Le bien que tu suis est maintenant en vente`;

  const annonceUrl = withUtm(
    `${APP_URL}/value/annonces/${input.bienSlug ?? input.bienId}`,
    "value_basculement",
  );

  const rangBlock =
    input.totalFile > 1
      ? `
    <div style="margin:16px 0;padding:14px;background:#f5f3ff;border:1px solid #e0e7ff;border-radius:8px">
      <div style="font-size:13px;color:${ACCENT};font-weight:600">
        Tu es <strong>${input.rangFile}ᵉ</strong> sur ${input.totalFile} acheteurs à suivre ce bien
      </div>
      <div style="margin-top:4px;font-size:12px;color:${MUTED}">
        Tu l'as ajouté à tes favoris ${escapeHtml(input.ancienneteFavoriHumain)} — tu es donc parmi les premiers informés.
      </div>
    </div>
  `
      : "";

  const prixBlock = input.prixAffiche
    ? `
    <div style="margin:16px 0;padding:16px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px">
      <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em">Prix de vente annoncé</div>
      <div style="font-size:24px;font-weight:700;color:${FG}">${formatEur(input.prixAffiche)}</div>
    </div>
  `
    : "";

  const body = `
    <h1 style="font-size:22px;font-weight:600;color:${FG};margin:0 0 16px">
      🔓 Un bien que tu suis vient de passer en vente
    </h1>
    <p style="font-size:14px;color:${FG};margin:0 0 12px">${hello}</p>
    <p style="font-size:14px;color:${FG};line-height:1.6;margin:0 0 16px">
      Le bien situé à <strong>${escapeHtml(input.bienAddressDisplay)}</strong> que tu avais ajouté à tes favoris
      en mode <em>discret</em> est désormais en <strong>vente publique</strong>.
      Tu peux maintenant contacter le vendeur, voir l'adresse complète et toutes les photos.
    </p>

    ${rangBlock}
    ${prixBlock}

    <div style="text-align:center;margin:24px 0">
      <a href="${annonceUrl}"
         style="display:inline-block;background:${PRIMARY};color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
        Voir l'annonce complète
      </a>
    </div>

    <p style="font-size:13px;color:${MUTED};margin:16px 0 0;line-height:1.6">
      Tu reçois cet email parce que tu as ajouté ce bien à tes favoris.
      Si tu n'es plus intéressé, retire-le depuis tes <a href="${withUtm(`${APP_URL}/mon-compte/favoris`, "value_basculement")}" style="color:${PRIMARY}">favoris</a>.
    </p>
  `;

  const text = `${hello}

Le bien situé à ${input.bienAddressDisplay} que tu suivais en discret est maintenant en vente publique.

${input.totalFile > 1 ? `Tu es ${input.rangFile}ᵉ sur ${input.totalFile} acheteurs à suivre ce bien.` : ""}
${input.prixAffiche ? `Prix annoncé : ${formatEur(input.prixAffiche)}` : ""}

Voir l'annonce : ${annonceUrl}
`;

  return {
    subject,
    html: wrapHtml({ subject, body, campaign: "value_basculement" }),
    text,
  };
}

/**
 * Humanise une date d'ajout aux favoris (ex: "il y a 3 semaines").
 * Approximation grossière en jours, semaines, mois.
 */
export function humanizeFavoriAge(addedAtIso: string, now: Date = new Date()): string {
  const added = new Date(addedAtIso).getTime();
  const diffMs = Math.max(0, now.getTime() - added);
  const day = 86_400_000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "aujourd'hui";
  if (days === 1) return "il y a 1 jour";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "il y a 1 semaine" : `il y a ${weeks} semaines`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "il y a 1 an" : `il y a ${years} ans`;
}
