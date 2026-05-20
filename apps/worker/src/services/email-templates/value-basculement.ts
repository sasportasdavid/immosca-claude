// Template email ImmoValue — basculement bien discret → public (écran 17
// du brief design).
//
// Déclenché par le worker `value-notify-public-switch` quand un
// propriétaire fait passer son bien en vente publique. Tous les
// favoris en discret reçoivent un mail pour les inviter à contacter
// le vendeur.
//
// L'email affiche le rang du destinataire dans la file (ordre
// d'ajout aux favoris en discret) — narrative "tu es Xe à savoir".
//
// DA : terracotta + Inter + Instrument Serif italic + tabular-nums sur les
// chiffres. Section conseil ImmoScan en `violet-soft` (cross-promo). Voir
// `value-common.ts` pour les helpers HTML partagés.

import {
  APP_URL,
  FONT_SANS,
  FONT_SERIF,
  VALUE_COLORS,
  escapeHtml,
  formatEur,
  valueButton,
  valueWrapHtml,
  withUtm,
} from "./value-common.js";

export interface BasculementPublicInput {
  /** Prénom (peut être null — fallback "Bonjour,"). */
  profileFirstName: string | null;
  /** Adresse affichée du bien — ex. "T3 62 m² — Le Chénay, Gagny (93)". */
  bienAddressDisplay: string;
  bienId: string;
  bienSlug: string | null;
  /** Prix publié maintenant que le bien est en vente publique. */
  prixAffiche: number | null;
  /** URL photo principale du bien (nullable — fallback placeholder). */
  photoUrl?: string | null;
  /** Rang du destinataire dans la file (1-indexé). */
  rangFile: number;
  /** Total acheteurs en favori discret notifiés. */
  totalFile: number;
  /** Texte humanisé "il y a X semaines" (cf `humanizeFavoriAge`). */
  ancienneteFavoriHumain: string;
  /** Date ISO d'ajout aux favoris — affichée si présente. */
  addedAtIso?: string | null;
}

export interface BasculementPublicEmailOutput {
  subject: string;
  html: string;
  text: string;
}

const CAMPAIGN = "basculement_public";

/**
 * Suffixe ordinal français : 1ᵉʳ, 2ᵉ, 3ᵉ, …
 * On garde "ᵉ" partout sauf pour 1 (1ᵉʳ).
 */
function ordinalFr(n: number): string {
  if (n === 1) return `${n}ᵉʳ`;
  return `${n}ᵉ`;
}

function ordinalFrFeminin(n: number): string {
  // Pour "tu étais Xᵉ" — féminin neutre via "ᵉ" (la file).
  return `${n}ᵉ`;
}

export function buildBasculementPublicEmail(
  input: BasculementPublicInput,
): BasculementPublicEmailOutput {
  const hello = input.profileFirstName
    ? `Bonjour ${escapeHtml(input.profileFirstName)},`
    : "Bonjour,";

  const subject = "🔓 Le bien que tu suis est maintenant en vente";
  const preheader = input.prixAffiche
    ? `Tu étais ${ordinalFrFeminin(input.rangFile)} sur ${input.totalFile} à le suivre. Prix annoncé : ${formatEur(input.prixAffiche)}.`
    : `Tu étais ${ordinalFrFeminin(input.rangFile)} sur ${input.totalFile} à le suivre.`;

  const annonceUrl = withUtm(
    `${APP_URL}/value/annonces/${input.bienSlug ?? input.bienId}`,
    CAMPAIGN,
  );
  const contactUrl = withUtm(
    `${APP_URL}/value/annonces/${input.bienSlug ?? input.bienId}?action=contact`,
    CAMPAIGN,
  );

  // Photo principale du bien — si fournie, on l'affiche. Sinon placeholder
  // chaud (terra-soft) pour ne pas casser le rendu.
  const photoBlock = input.photoUrl
    ? `<img src="${escapeHtml(input.photoUrl)}" alt="${escapeHtml(input.bienAddressDisplay)}" style="display:block;width:100%;height:auto;max-height:280px;object-fit:cover;border-radius:10px;background:${VALUE_COLORS.terraSoft}" />`
    : `<div style="width:100%;height:200px;background:${VALUE_COLORS.terraSoft};border-radius:10px;text-align:center;line-height:200px;font-family:${FONT_SERIF};font-style:italic;color:${VALUE_COLORS.terraDeep};font-size:18px">Photo du bien</div>`;

  // Bloc résumé bien (titre + prix + date)
  const dateLine = input.addedAtIso
    ? `<div style="margin-top:6px;font-size:13px;color:${VALUE_COLORS.mute2}">Bien que tu suivais ${escapeHtml(input.ancienneteFavoriHumain)}.</div>`
    : `<div style="margin-top:6px;font-size:13px;color:${VALUE_COLORS.mute2}">Bien que tu suivais ${escapeHtml(input.ancienneteFavoriHumain)}.</div>`;

  const prixLine = input.prixAffiche
    ? `<div style="margin-top:10px;font-family:${FONT_SANS};font-size:13px;color:${VALUE_COLORS.muted}">
        Prix demandé :
        <span class="tnum" style="font-variant-numeric:tabular-nums;font-weight:700;color:${VALUE_COLORS.ink};font-size:18px;letter-spacing:-0.01em">${escapeHtml(formatEur(input.prixAffiche))}</span>
      </div>`
    : "";

  // Bloc rang dans la file — narrative "tu étais Xᵉ" + N-1 autres notifiés
  const autresFile = Math.max(0, input.totalFile - 1);
  const fileBlock = `
    <div style="margin:24px 0;padding:18px 20px;background:${VALUE_COLORS.terraSoft};border:1px solid rgba(217,119,87,0.18);border-radius:10px">
      <div style="font-family:${FONT_SANS};font-size:14px;color:${VALUE_COLORS.terraDeep};line-height:1.55">
        Le propriétaire vient de passer son annonce en <strong>vente publique</strong>.
      </div>
      <div style="margin-top:8px;font-family:${FONT_SERIF};font-style:italic;font-size:16px;color:${VALUE_COLORS.terraDeep};line-height:1.4">
        Tu étais ${ordinalFrFeminin(input.rangFile)} dans la file d'attente.
      </div>
      ${
        autresFile > 0
          ? `<div style="margin-top:6px;font-family:${FONT_SANS};font-size:12px;color:${VALUE_COLORS.muted}">
              ${autresFile} autre${autresFile > 1 ? "s acheteurs ont" : " acheteur a"} également été notifié${autresFile > 1 ? "s" : ""}.
            </div>`
          : ""
      }
    </div>
  `;

  // CTA double : terra-grad principal + ghost secondaire
  const ctaBlock = `
    <div style="text-align:center;margin:28px 0 8px">
      ${valueButton({ href: annonceUrl, label: "Voir l'annonce complète", variant: "terra" })}
    </div>
    <div style="text-align:center;margin:0 0 24px">
      ${valueButton({ href: contactUrl, label: "Contacter le vendeur", variant: "ghost" })}
    </div>
  `;

  // Cross-promo ImmoScan en violet-soft (cohérent avec marque ImmoScan)
  const crossPromoBlock = `
    <div style="margin:24px 0;padding:16px 18px;background:${VALUE_COLORS.violetSoft};border:1px solid rgba(91,71,224,0.14);border-radius:10px">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="font-size:18px;line-height:1.2">💡</div>
        <div style="flex:1">
          <div style="font-family:${FONT_SANS};font-size:13px;font-weight:600;color:${VALUE_COLORS.violetInk};margin-bottom:4px">
            Conseil ImmoScan
          </div>
          <div style="font-family:${FONT_SANS};font-size:13px;color:${VALUE_COLORS.ink2};line-height:1.55">
            Réponds vite — les vendeurs reçoivent souvent plusieurs propositions
            dans les 48 h après publication.
          </div>
        </div>
      </div>
    </div>
  `;

  // Card centrale photo + résumé
  const body = `
    <h1 style="font-family:${FONT_SANS};font-size:22px;font-weight:600;color:${VALUE_COLORS.ink};margin:0 0 4px;letter-spacing:-0.01em;line-height:1.3">
      ${hello}
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:14px;color:${VALUE_COLORS.muted};line-height:1.55">
      Une bonne nouvelle sur un bien que tu suivais en mode
      <span style="font-family:${FONT_SERIF};font-style:italic;color:${VALUE_COLORS.terra}">discret</span>.
    </p>

    <div class="card" style="background:${VALUE_COLORS.card};border:1px solid ${VALUE_COLORS.line};border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(28,25,23,0.04)">
      ${photoBlock}
      <div style="margin-top:16px;font-family:${FONT_SANS};font-size:16px;font-weight:600;color:${VALUE_COLORS.ink};letter-spacing:-0.01em;line-height:1.35">
        ${escapeHtml(input.bienAddressDisplay)}
      </div>
      ${prixLine}
      ${dateLine}
    </div>

    ${fileBlock}

    ${ctaBlock}

    ${crossPromoBlock}
  `;

  const text = `${input.profileFirstName ? `Bonjour ${input.profileFirstName},` : "Bonjour,"}

Le bien que tu suivais en discret — ${input.bienAddressDisplay} — est maintenant en vente publique.

${input.prixAffiche ? `Prix demandé : ${formatEur(input.prixAffiche)}` : ""}
Tu étais ${ordinalFr(input.rangFile)} sur ${input.totalFile} acheteurs à le suivre.
${autresFile > 0 ? `${autresFile} autre${autresFile > 1 ? "s" : ""} acheteur${autresFile > 1 ? "s" : ""} ${autresFile > 1 ? "ont" : "a"} également été notifié${autresFile > 1 ? "s" : ""}.` : ""}

Voir l'annonce : ${annonceUrl}
Contacter le vendeur : ${contactUrl}

Conseil ImmoScan : réponds vite, les vendeurs reçoivent souvent plusieurs propositions dans les 48h après publication.

—
ImmoValue · un produit ImmoScan
${APP_URL}
`;

  return {
    subject,
    html: valueWrapHtml({ subject, body, campaign: CAMPAIGN, preheader }),
    text,
  };
}

/**
 * Humanise une date d'ajout aux favoris (ex: "il y a 3 semaines"). Conservé
 * ici plutôt qu'en commun car spécifique au narrative "bien suivi depuis…".
 */
export function humanizeFavoriAge(addedAtIso: string, now: Date = new Date()): string {
  const added = new Date(addedAtIso).getTime();
  const diffMs = Math.max(0, now.getTime() - added);
  const day = 86_400_000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "depuis aujourd'hui";
  if (days === 1) return "depuis hier";
  if (days < 7) return `depuis ${days} jours`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "depuis 1 semaine" : `depuis ${weeks} semaines`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "depuis 1 mois" : `depuis ${months} mois`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "depuis 1 an" : `depuis ${years} ans`;
}
