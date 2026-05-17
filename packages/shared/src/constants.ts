// Constantes ImmoScan
// Toute valeur "magique" qui sert dans le scoring, le pricing ou le rendu
// doit être ici, pas inline dans le code applicatif.

import type { StrategyType } from "./schemas/user.js";

// ──────────────────────────────────────────────────────────────────
// Plans et pricing
// ──────────────────────────────────────────────────────────────────

export type PlanId = "free" | "pro" | "pro_plus";
// Note Business : publié au pricing (cf CLAUDE.md §12 et docs/01-spec-produit.md),
// mais code + enum SQL `subscription_plan` ne le contiennent pas encore.
// Ajout différé à PR6+ Stripe Billing : il faudra étendre PlanId, ajouter
// l'entrée PLANS.business (multi-users 5, Opus 4.7, illimité partout), créer
// la migration `ALTER TYPE subscription_plan ADD VALUE 'business'`, et étendre
// subscriptionPlanSchema dans packages/shared/src/schemas/user.ts.

/**
 * Plans récurrents (abonnement). Trois niveaux actuellement implémentés :
 * Free / Pro / Pro+. Le plan Business 249€/mois est publié au pricing
 * mais sa prise en charge code+DB est différée à PR6+ Stripe Billing.
 *
 * Quand un user atteint son plafond mensuel d'analyses :
 * - upgrade vers le plan supérieur, ou
 * - pay-per-use (voir PAY_PER_USE) — actuellement "dormant", maintien
 *   produit à arbitrer avec le PO au moment de Stripe.
 */
export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    analysesPerMonth: null, // illimitées mais floutées (>70 masqués)
    watchesMax: 0,
    pipelineMax: 0,
    topN: 5, // visible mais masqué pour Free
    exportCsv: false,
    exportPdf: false,
    publicShare: false,
    claudeModel: "claude-sonnet-4-6",
    multiUsers: 1,
    showFullAddress: false,
    showThesisFull: false,
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    monthlyPriceEur: 49,
    yearlyPriceEur: 468, // 468€/an, soit 39€/mois facturé annuellement
    analysesPerMonth: 30,
    watchesMax: 5,
    watchFrequency: "weekly",
    pipelineMax: 50,
    topN: 10,
    exportCsv: true,
    exportPdf: true,
    publicShare: true,
    claudeModel: "claude-sonnet-4-6",
    multiUsers: 1,
    showFullAddress: true,
    showThesisFull: true,
  },
  pro_plus: {
    id: "pro_plus" as const,
    name: "Pro+",
    monthlyPriceEur: 99,
    yearlyPriceEur: 948, // 948€/an, soit 79€/mois facturé annuellement
    analysesPerMonth: null, // illimité
    watchesMax: 20,
    watchFrequency: "daily",
    pipelineMax: 200,
    topN: 20,
    exportCsv: true,
    exportPdf: true,
    publicShare: true,
    claudeModel: "claude-sonnet-4-6",
    multiUsers: 1,
    showFullAddress: true,
    showThesisFull: true,
  },
} as const;

export const TRIAL_DAYS_PRO = 7;

// ──────────────────────────────────────────────────────────────────
// Pay-per-use — analyses à l'unité, débloquées à vie
// ──────────────────────────────────────────────────────────────────

/**
 * Analyses achetées hors abonnement. Disponibles tous plans
 * (Free / Pro / Pro+). Une analyse pay-per-use est consommable
 * **à vie** sur le compte du user, indépendamment du plan en
 * cours. Pas de pay-per-use sur les veilles (mécanique récurrente).
 */
export const PAY_PER_USE = {
  single: { quantity: 1, priceEur: 9 },
  pack_5: { quantity: 5, priceEur: 39 },
  pack_20: { quantity: 20, priceEur: 119 },
} as const;
export type PayPerUseSku = keyof typeof PAY_PER_USE;

// ──────────────────────────────────────────────────────────────────
// Freemium teasing seuil
// ──────────────────────────────────────────────────────────────────

/** Score à partir duquel les biens sont floutés pour les users Free. */
export const FREEMIUM_MASK_THRESHOLD = 70;

// ──────────────────────────────────────────────────────────────────
// Claude models
// ──────────────────────────────────────────────────────────────────

export const CLAUDE_MODEL_DEFAULT = "claude-sonnet-4-6" as const;
export type ClaudeModel = typeof CLAUDE_MODEL_DEFAULT;

export function claudeModelForPlan(plan: PlanId): ClaudeModel {
  // Pour l'instant tous les plans utilisent Sonnet. La fonction est
  // conservée pour réintroduire Opus quand le plan Business sera
  // remis en place — ne pas inline cet appel.
  void plan;
  return CLAUDE_MODEL_DEFAULT;
}

// ──────────────────────────────────────────────────────────────────
// Frais d'acquisition
// ──────────────────────────────────────────────────────────────────

/** Frais de notaire dans l'ancien (% du prix). */
export const NOTAIRE_FEES_ANCIEN_PCT = 0.08;
/** Frais de notaire dans le neuf (% du prix). */
export const NOTAIRE_FEES_NEUF_PCT = 0.03;

// ──────────────────────────────────────────────────────────────────
// Scoring weights — pondération par défaut du score /100
// Surcouchée par scoring_weights custom si fournis dans user_params
// ──────────────────────────────────────────────────────────────────

export const SCORING_WEIGHTS_DEFAULT = {
  prix: 25, // écart par rapport au médian DVF
  rendement: 25, // rendement brut/net selon stratégie
  cashflow: 15, // cashflow mensuel
  dpe: 10, // pénalisation passoires (loi Climat)
  quartier: 15, // socio-démo, transports, écoles
  risques: 10, // Géorisques (PPRI, argile, sismicité, radon)
} as const;

// La somme doit valoir 100
const _totalWeights = Object.values(SCORING_WEIGHTS_DEFAULT).reduce((a, b) => a + b, 0);
if (_totalWeights !== 100) {
  throw new Error(`SCORING_WEIGHTS_DEFAULT must sum to 100, got ${_totalWeights}`);
}

// ──────────────────────────────────────────────────────────────────
// Loi Climat — calendrier d'interdiction de location
// ──────────────────────────────────────────────────────────────────

export const LOI_CLIMAT_CALENDAR = {
  G: 2025, // G interdit à la location au 1er janvier 2025
  F: 2028, // F interdit au 1er janvier 2028
  E: 2034, // E interdit au 1er janvier 2034
} as const;

// ──────────────────────────────────────────────────────────────────
// Zonage A/B1/B2/C (Pinel, Censi-Bouvard, etc.)
// ──────────────────────────────────────────────────────────────────

export type ZoneAbc = "A_bis" | "A" | "B1" | "B2" | "C";

// ──────────────────────────────────────────────────────────────────
// Cache TTL
// ──────────────────────────────────────────────────────────────────

export const CACHE_TTL = {
  apifyUrlSearch: 24 * 60 * 60 * 1000, // 24h
  apifyListing: 7 * 24 * 60 * 60 * 1000, // 7j
  banGeocode: 90 * 24 * 60 * 60 * 1000, // 90j
  ademeDpe: 30 * 24 * 60 * 60 * 1000, // 30j
  claudeThesis: 30 * 24 * 60 * 60 * 1000, // 30j
} as const;

// ──────────────────────────────────────────────────────────────────
// Limites techniques
// ──────────────────────────────────────────────────────────────────

export const MAX_LISTINGS_PER_ANALYSIS = 1000;
export const APIFY_MAX_PAGES_PER_RUN = 50;
export const ANTHROPIC_MAX_OUTPUT_TOKENS = 8192;

// ──────────────────────────────────────────────────────────────────
// Strategies
// ──────────────────────────────────────────────────────────────────

export const STRATEGY_LABELS: Record<StrategyType, string> = {
  locatif_nu: "Locatif nu",
  lmnp_meuble: "LMNP meublé",
  mixte: "Mixte (nu + meublé)",
  colocation: "Colocation",
  courte_duree: "Courte durée (Airbnb)",
};
