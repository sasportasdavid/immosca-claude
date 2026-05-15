import type { DpeClass } from "../schemas/listing.js";
import type { StrategyType, TravauxTolerance } from "../schemas/user.js";

// ──────────────────────────────────────────────────────────────────
// Inputs du scoring
// ──────────────────────────────────────────────────────────────────

export interface ScoringInput {
  // Bien
  prix: number;
  surface: number;
  type: "appartement" | "maison" | "terrain" | "immeuble" | "autre";
  dpe: DpeClass | null;
  etage: number | null;
  balcon: boolean;
  terrasse: boolean;
  parking: boolean;
  is_new_construction: boolean;

  // Référentiels marché (alimentés depuis immoscan-data)
  prix_m2_median_commune: number | null;
  prix_m2_median_iris: number | null;
  loyer_m2_median_zone: number | null;

  // Paramètres user
  strategy: StrategyType;
  apport: number;
  taux_credit_pct: number;
  duree_credit_ans: number;
  tmi_pct: number;
  rendement_min_pct: number;
  tolerance_travaux: TravauxTolerance;

  // Risques (Géorisques)
  has_ppri: boolean;
  retrait_argile_niveau: "nul" | "faible" | "moyen" | "fort" | null;
  sismicite: number | null;
  radon: number | null;
}

// ──────────────────────────────────────────────────────────────────
// Outputs intermédiaires
// ──────────────────────────────────────────────────────────────────

export interface FinancialResult {
  prix_marche_estime: number | null;
  ecart_prix_pct: number | null;
  loyer_estime: number | null;
  loyer_m2_estime: number | null;
  rendement_brut_pct: number | null;
  rendement_net_pct: number | null;
  rendement_net_net_pct: number | null;
  mensualite_credit: number;
  frais_notaire: number;
  cout_total_acquisition: number;
  cashflow_mensuel: number | null;
}

export interface SubScoresResult {
  prix: number;
  rendement: number;
  cashflow: number;
  dpe: number;
  quartier: number;
  risques: number;
}

export interface ScoringResult {
  score_total: number;
  sub_scores: SubScoresResult;
  financial: FinancialResult;
  climate: {
    is_passoire_dpe: boolean;
    risque_climat_2025: boolean;
    risque_climat_2028: boolean;
    risque_climat_2034: boolean;
  };
}
