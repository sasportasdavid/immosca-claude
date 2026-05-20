// Orchestrateur de scoring.
// Entrée : ScoringInput. Sortie : ScoringResult avec score global /100 et sous-scores.
//
// Chaque sous-score est sur 100. Le score global est la moyenne pondérée
// selon les poids (SCORING_WEIGHTS_DEFAULT ou custom plan Business).

import { SCORING_WEIGHTS_DEFAULT } from "../constants.js";
import type { DpeClass } from "../schemas/listing.js";

import {
  cashflowMensuel,
  coutTotalAcquisition,
  ecartPrixPct,
  fraisNotaire,
  loyerEstime,
  mensualiteCredit,
  prixM2Reference,
  rendementBrutPct,
  rendementNetNetPct,
  rendementNetPct,
} from "./financial.js";
import type {
  FinancialResult,
  ScoringInput,
  ScoringResult,
  SubScoresResult,
} from "./types.js";

/**
 * Calcule tous les indicateurs financiers d'un bien.
 */
export function computeFinancials(input: ScoringInput): FinancialResult {
  const prixM2Demande = input.prix / input.surface;
  const prixM2Ref = prixM2Reference(input.prix_m2_median_iris, input.prix_m2_median_commune);
  const ecart = ecartPrixPct(prixM2Demande, prixM2Ref);

  const isNeuf = input.is_new_construction;
  const coutTotal = coutTotalAcquisition(
    input.prix,
    input.surface,
    isNeuf,
    input.tolerance_travaux,
  );
  const notaire = fraisNotaire(input.prix, isNeuf);

  const capital = Math.max(0, coutTotal - input.apport);
  const mensualite = mensualiteCredit(capital, input.taux_credit_pct, input.duree_credit_ans);

  const loyer = loyerEstime(
    input.surface,
    input.loyer_m2_median_zone,
    input.dpe,
    input.etage,
    input.balcon,
    input.terrasse,
  );
  const loyerM2 = loyer && input.surface > 0 ? loyer / input.surface : null;

  const isLmnp = input.strategy === "lmnp_meuble" || input.strategy === "mixte";

  // Estimation grossière charges + taxe foncière si pas dispo (à raffiner)
  const chargesAnnuellesEstim = input.surface * 30; // 30€/m²/an
  const taxeFonciereEstim = input.prix * 0.005; // 0.5% du prix

  let rendementBrut: number | null = null;
  let rendementNet: number | null = null;
  let rendementNetNet: number | null = null;
  let cashflow: number | null = null;

  if (loyer !== null) {
    rendementBrut = rendementBrutPct(loyer, input.prix);
    rendementNet = rendementNetPct(loyer, coutTotal, chargesAnnuellesEstim, taxeFonciereEstim);
    rendementNetNet = rendementNetNetPct(
      loyer,
      coutTotal,
      chargesAnnuellesEstim,
      taxeFonciereEstim,
      input.tmi_pct,
      isLmnp,
    );
    cashflow = cashflowMensuel(
      loyer,
      mensualite,
      chargesAnnuellesEstim / 12,
      taxeFonciereEstim / 12,
    );
  }

  return {
    prix_marche_estime: prixM2Ref ? prixM2Ref * input.surface : null,
    ecart_prix_pct: ecart,
    loyer_estime: loyer,
    loyer_m2_estime: loyerM2,
    rendement_brut_pct: rendementBrut,
    rendement_net_pct: rendementNet,
    rendement_net_net_pct: rendementNetNet,
    mensualite_credit: mensualite,
    frais_notaire: notaire,
    cout_total_acquisition: coutTotal,
    cashflow_mensuel: cashflow,
  };
}

// ──────────────────────────────────────────────────────────────────
// Sous-scores
// ──────────────────────────────────────────────────────────────────

/**
 * Score prix : 100 si -20% sous le marché, 0 si +20% au-dessus.
 */
export function scorePrix(ecartPct: number | null): number {
  if (ecartPct === null) return 50;
  // -20% → 100, 0% → 50, +20% → 0
  const raw = 50 - ecartPct * 2.5;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Score rendement : 100 si >= 10% brut, 0 si <= 2%.
 */
export function scoreRendement(rendementBrutPct: number | null, rendementMinUser: number): number {
  if (rendementBrutPct === null) return 50;
  // En-dessous du rendement min user : score < 50, sinon ramping vers 100
  if (rendementBrutPct >= 10) return 100;
  if (rendementBrutPct <= 2) return 0;
  // Linéaire entre 2 et 10
  const raw = ((rendementBrutPct - 2) / 8) * 100;
  // Bonus/malus si au-dessus/en-dessous du min user
  const bonus = rendementBrutPct >= rendementMinUser ? 0 : -15;
  return Math.max(0, Math.min(100, Math.round(raw + bonus)));
}

/**
 * Score cashflow : 100 si cashflow > 200€/mois, 0 si < -300€/mois.
 */
export function scoreCashflow(cashflow: number | null): number {
  if (cashflow === null) return 50;
  if (cashflow >= 200) return 100;
  if (cashflow <= -300) return 0;
  const raw = ((cashflow + 300) / 500) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Score DPE : 100 pour A, 0 pour G (passoire interdite 2025).
 */
export function scoreDpe(dpe: DpeClass | null): number {
  if (!dpe) return 40;
  const scores: Record<DpeClass, number> = {
    A: 100,
    B: 90,
    C: 75,
    D: 60,
    E: 40, // sera interdit en 2034
    F: 15, // sera interdit en 2028
    G: 0, // déjà interdit en 2025
  };
  return scores[dpe];
}

/**
 * Score quartier : pondéré sur revenu médian IRIS, transports, écoles.
 * MVP : placeholder 50 si on n'a pas de data, à enrichir en PR5.
 */
export function scoreQuartier(_input: ScoringInput): number {
  // TODO PR5 : enrichir avec INSEE Filosofi, transports, écoles IPS
  return 50;
}

/**
 * Score risques : 100 si aucun risque, 0 si cumul PPRI + argile fort + sismicité 4-5.
 */
export function scoreRisques(input: ScoringInput): number {
  let score = 100;
  if (input.has_ppri) score -= 30;
  if (input.retrait_argile_niveau === "fort") score -= 25;
  else if (input.retrait_argile_niveau === "moyen") score -= 10;
  if (input.sismicite !== null && input.sismicite >= 4) score -= 20;
  if (input.radon !== null && input.radon >= 3) score -= 10;
  return Math.max(0, Math.min(100, score));
}

// ──────────────────────────────────────────────────────────────────
// Risques climat (loi Climat)
// ──────────────────────────────────────────────────────────────────

export function computeClimateRisks(dpe: DpeClass | null) {
  return {
    is_passoire_dpe: dpe === "F" || dpe === "G",
    risque_climat_2025: dpe === "G",
    risque_climat_2028: dpe === "F" || dpe === "G",
    risque_climat_2034: dpe === "E" || dpe === "F" || dpe === "G",
  };
}

// ──────────────────────────────────────────────────────────────────
// Score global (orchestrateur)
// ──────────────────────────────────────────────────────────────────

export function computeScore(
  input: ScoringInput,
  weights: typeof SCORING_WEIGHTS_DEFAULT = SCORING_WEIGHTS_DEFAULT,
): ScoringResult {
  const financial = computeFinancials(input);

  const subScores: SubScoresResult = {
    prix: scorePrix(financial.ecart_prix_pct),
    rendement: scoreRendement(financial.rendement_brut_pct, input.rendement_min_pct),
    cashflow: scoreCashflow(financial.cashflow_mensuel),
    dpe: scoreDpe(input.dpe),
    quartier: scoreQuartier(input),
    risques: scoreRisques(input),
  };

  const weightedSum =
    (subScores.prix * weights.prix +
      subScores.rendement * weights.rendement +
      subScores.cashflow * weights.cashflow +
      subScores.dpe * weights.dpe +
      subScores.quartier * weights.quartier +
      subScores.risques * weights.risques) /
    100;

  const score_total = Math.max(0, Math.min(100, Math.round(weightedSum)));

  const climate = computeClimateRisks(input.dpe);

  return {
    score_total,
    sub_scores: subScores,
    financial,
    climate,
  };
}

/**
 * Détermine le verdict à partir du score total.
 */
export function verdictFromScore(score: number): "a_visiter" | "sous_reserve" | "no_go" {
  if (score >= 75) return "a_visiter";
  if (score >= 50) return "sous_reserve";
  return "no_go";
}
