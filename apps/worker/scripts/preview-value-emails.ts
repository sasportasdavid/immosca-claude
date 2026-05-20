// Script de preview local des templates email ImmoValue.
//
// Génère /tmp/value-basculement.html et /tmp/value-alerte.html avec des
// inputs mockés, à ouvrir dans un navigateur pour valider visuellement.
//
// Usage (depuis apps/worker) :
//   pnpm exec tsx scripts/preview-value-emails.ts
//   open /tmp/value-basculement.html /tmp/value-alerte.html
//
// Ou via Node + ts-node si tsx n'est pas dispo :
//   node --loader ts-node/esm scripts/preview-value-emails.ts

import fs from "node:fs";
import path from "node:path";

import type { ValorisationOutput } from "@immoscan/shared/value";

import { buildAlerteValoEmail } from "../src/services/email-templates/value-alerte.js";
import {
  buildBasculementPublicEmail,
  humanizeFavoriAge,
} from "../src/services/email-templates/value-basculement.js";

// ──────────────────────────────────────────────────────────────────
// Fixture valo Claude (cohérente avec ValorisationOutputSchema)
// ──────────────────────────────────────────────────────────────────

function buildMockValo(central: number): ValorisationOutput {
  return {
    prix_m2_secteur_pondere: Math.round(central / 62),
    valorisation: {
      bas: Math.round(central * 0.93),
      central,
      haut: Math.round(central * 1.07),
      confiance: 0.78,
    },
    ajustements: [
      {
        categorie: "bien",
        critere: "DPE E",
        impact_pct: -3.5,
        impact_eur: -10_500,
        raisonnement:
          "Le DPE E pèse sur la valeur — on ajuste à la baisse vs comparable médian DPE C.",
        sources: ["ADEME DPE"],
      },
    ],
    comparables_retenus: [
      { type: "dvf", ref: "DVF-2024-93-001", poids: 0.5 },
      { type: "actif", ref: "SL-12345", poids: 0.3 },
    ],
    tension_marche: { ratio_actif_vs_dvf_pct: 4.2, interpretation: "vendeur" },
    these:
      "Le marché de ton secteur (Le Chénay, Gagny) connaît une tension à la hausse : 6 nouvelles ventes en 4 semaines, prix médian en hausse de 3,1 %. Ton bien profite directement de cette dynamique micro-locale, en particulier grâce à sa proximité gare (8 minutes à pied) et à son orientation Sud-Est. Le DPE E reste un frein modéré que nous avons intégré.",
    signaux_faibles: ["Forte tension micro-locale", "Saisonnalité printanière"],
    recommandation_prix_vente: Math.round(central * 1.02),
    duree_vente_estimee_jours: 45,
    qualite_dossier: { score: 82, manques: ["Plans cadastraux"] },
  };
}

// ──────────────────────────────────────────────────────────────────
// 1) Basculement public
// ──────────────────────────────────────────────────────────────────

const addedAt = new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString();
const basculement = buildBasculementPublicEmail({
  profileFirstName: "Marie",
  bienAddressDisplay: "T3 62 m² — Le Chénay, Gagny (93)",
  bienId: "00000000-0000-0000-0000-000000000001",
  bienSlug: "t3-62m2-le-chenay-gagny",
  prixAffiche: 319_000,
  photoUrl:
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
  rangFile: 13,
  totalFile: 18,
  ancienneteFavoriHumain: humanizeFavoriAge(addedAt),
  addedAtIso: addedAt,
});

// ──────────────────────────────────────────────────────────────────
// 2) Alerte valo
// ──────────────────────────────────────────────────────────────────

const valoCourante = buildMockValo(312_000);
const valoPrecedente = buildMockValo(299_000);

const series = [
  { dateIso: "2025-12-01", valeur: 295_000 },
  { dateIso: "2026-01-01", valeur: 297_500 },
  { dateIso: "2026-02-01", valeur: 299_000 },
  { dateIso: "2026-03-01", valeur: 302_000 },
  { dateIso: "2026-04-01", valeur: 308_000 },
  { dateIso: "2026-05-01", valeur: 312_000 },
];

const alerte = buildAlerteValoEmail({
  profileFirstName: "Marie",
  bienAddressDisplay: "T3 à Gagny",
  bienId: "00000000-0000-0000-0000-000000000001",
  photoUrl:
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
  delta_pct: 4.2,
  valoCourante,
  valoPrecedente,
  serieHistorique: series,
  contexteMarche: {
    quartier: "Le Chénay",
    nbVentesRecentes: 6,
    deltaMedianPct: 3.1,
  },
});

// Cas de baisse pour vérifier le rendu négatif (terra + 📉)
const alerteBaisse = buildAlerteValoEmail({
  profileFirstName: "Marie",
  bienAddressDisplay: "T3 à Gagny",
  bienId: "00000000-0000-0000-0000-000000000001",
  photoUrl: null,
  delta_pct: -2.7,
  valoCourante: buildMockValo(291_000),
  valoPrecedente: buildMockValo(299_000),
  serieHistorique: [
    { dateIso: "2025-12-01", valeur: 305_000 },
    { dateIso: "2026-01-01", valeur: 302_500 },
    { dateIso: "2026-02-01", valeur: 299_000 },
    { dateIso: "2026-03-01", valeur: 295_500 },
    { dateIso: "2026-04-01", valeur: 293_000 },
    { dateIso: "2026-05-01", valeur: 291_000 },
  ],
  contexteMarche: {
    quartier: "Le Chénay",
    nbVentesRecentes: 2,
    deltaMedianPct: -1.8,
  },
});

// ──────────────────────────────────────────────────────────────────
// Écriture
// ──────────────────────────────────────────────────────────────────

const outDir = process.env.PREVIEW_OUT_DIR ?? "/tmp";
const outBasculement = path.join(outDir, "value-basculement.html");
const outAlerte = path.join(outDir, "value-alerte.html");
const outAlerteBaisse = path.join(outDir, "value-alerte-baisse.html");

fs.writeFileSync(outBasculement, basculement.html, "utf8");
fs.writeFileSync(outAlerte, alerte.html, "utf8");
fs.writeFileSync(outAlerteBaisse, alerteBaisse.html, "utf8");

console.log("Templates ImmoValue générés :");
console.log(`  - Subject basculement : ${basculement.subject}`);
console.log(`  - Subject alerte+    : ${alerte.subject}`);
console.log(`  - Subject alerte−    : ${alerteBaisse.subject}`);
console.log("");
console.log("Fichiers HTML :");
console.log(`  open ${outBasculement}`);
console.log(`  open ${outAlerte}`);
console.log(`  open ${outAlerteBaisse}`);
