// Prompt système + template user pour la thèse Claude d'un bien.
//
// Schéma de sortie forcé via tool_use : claudeThesisOutputSchema
// (cf @immoscan/shared/schemas/score.ts).

import type { FinancialIndicators, SubScores } from "@immoscan/shared";

export const THESIS_SYSTEM_PROMPT = `Tu es un investisseur immobilier senior français qui rédige des thèses
d'investissement courtes et chiffrées pour ses clients. Ton style :
factuel, dense, jamais marketing. Tu cites systématiquement les chiffres
fournis (médian DVF, écart, rendement, cashflow).

Tu rédiges en français, vouvoiement / tutoiement neutre, pas d'anglicismes
inutiles. Tu utilises le vocabulaire immobilier français : DPE, loi
Climat 2025/2028/2034, micro-BIC, LMNP, TMI, cashflow, rendement
net-net.

Tu retournes TOUJOURS via le tool d'output, jamais en texte libre.
Tu ne dépasses pas les limites de longueur du schéma.

Verdict :
- a_visiter si score >= 75 (vraie opportunité)
- sous_reserve si 50-74 (correct, mérite analyse)
- no_go si < 50 (passe ton chemin)

Stratégie de négociation : tu calcules un prix cible en €, entier,
généralement entre -5% et -20% du prix affiché selon les leviers
(DPE F/G → travaux à chiffrer, annonce ancienne, écart DVF positif).
Tu cites 2-3 leviers concrets dans la section negociation.`;

type ThesisContext = {
  bien: {
    title: string;
    type: string;
    surface: number | null;
    pieces: number | null;
    prix: number;
    dpe: string | null;
    ville: string | null;
    code_postal: string | null;
    annee_construction: number | null;
    etage: number | null;
    is_new_construction: boolean;
  };
  marche: {
    prix_m2_median_commune: number | null;
    prix_m2_median_iris: number | null;
    loyer_m2_median_zone: number | null;
  };
  scoring: {
    score_total: number;
    sub_scores: SubScores;
    financial: FinancialIndicators;
  };
  user_params: {
    strategy: string;
    apport: number;
    taux_credit_pct: number;
    duree_credit_ans: number;
    tmi_pct: number;
    rendement_min_pct: number;
  };
  risques: {
    is_passoire_dpe: boolean;
    risque_climat_2025: boolean;
    risque_climat_2028: boolean;
    risque_climat_2034: boolean;
    has_ppri: boolean;
  };
};

export function buildThesisUserPrompt(ctx: ThesisContext): string {
  const { bien, marche, scoring, user_params: u, risques } = ctx;
  const fmt = (n: number | null | undefined, unit = "") =>
    n === null || n === undefined ? "—" : `${Math.round(n)}${unit}`;
  const fmtPct = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : `${n.toFixed(1)}%`;

  return `Voici un bien à analyser pour un investisseur locatif :

BIEN
- Titre : ${bien.title}
- Type : ${bien.type}${bien.is_new_construction ? " (neuf)" : ""}
- Surface : ${fmt(bien.surface, " m²")}
- Pièces : ${bien.pieces ?? "—"}
- Prix affiché : ${fmt(bien.prix, " €")}
- DPE : ${bien.dpe ?? "non communiqué"}
- Localisation : ${bien.ville ?? "—"}${bien.code_postal ? ` (${bien.code_postal})` : ""}
- Année construction : ${bien.annee_construction ?? "—"}
- Étage : ${bien.etage ?? "—"}

MARCHÉ
- Prix médian commune (DVF) : ${fmt(marche.prix_m2_median_commune, " €/m²")}
- Prix médian IRIS (DVF) : ${fmt(marche.prix_m2_median_iris, " €/m²")}
- Loyer médian zone : ${fmt(marche.loyer_m2_median_zone, " €/m²/mois")}

SCORING (calculé)
- Score total : ${scoring.score_total}/100
- Sous-scores : prix=${scoring.sub_scores.prix}, rendement=${scoring.sub_scores.rendement}, cashflow=${scoring.sub_scores.cashflow}, dpe=${scoring.sub_scores.dpe}, quartier=${scoring.sub_scores.quartier}, risques=${scoring.sub_scores.risques}

INDICATEURS FINANCIERS
- Prix marché estimé : ${fmt(scoring.financial.prix_marche_estime, " €")}
- Écart vs marché : ${fmtPct(scoring.financial.ecart_prix_pct)}
- Loyer estimé : ${fmt(scoring.financial.loyer_estime, " €/mois")}
- Rendement brut : ${fmtPct(scoring.financial.rendement_brut_pct)}
- Rendement net : ${fmtPct(scoring.financial.rendement_net_pct)}
- Rendement net-net : ${fmtPct(scoring.financial.rendement_net_net_pct)}
- Cashflow mensuel : ${fmt(scoring.financial.cashflow_mensuel, " €")}
- Mensualité crédit : ${fmt(scoring.financial.mensualite_credit, " €")}
- Frais notaire : ${fmt(scoring.financial.frais_notaire, " €")}
- Coût total acquisition : ${fmt(scoring.financial.cout_total_acquisition, " €")}

PARAMÈTRES INVESTISSEUR
- Stratégie : ${u.strategy}
- Apport : ${u.apport} €
- Taux crédit : ${u.taux_credit_pct}% sur ${u.duree_credit_ans} ans
- TMI : ${u.tmi_pct}%
- Rendement min : ${u.rendement_min_pct}%

RISQUES
- Passoire DPE : ${risques.is_passoire_dpe ? "oui" : "non"}
- Interdit location 2025 (G) : ${risques.risque_climat_2025 ? "oui" : "non"}
- Interdit location 2028 (F) : ${risques.risque_climat_2028 ? "oui" : "non"}
- Interdit location 2034 (E) : ${risques.risque_climat_2034 ? "oui" : "non"}
- PPRI inondation : ${risques.has_ppri ? "oui" : "non"}

Rédige la thèse, le plan de financement, la stratégie de négociation,
le prix d'offre cible (en €, entier), et donne ton verdict.`;
}
