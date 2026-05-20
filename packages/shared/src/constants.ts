// Constantes ImmoScan
// Toute valeur "magique" qui sert dans le scoring, le pricing ou le rendu
// doit être ici, pas inline dans le code applicatif.
//
// Source de vérité business : `docs/business-model-immoscan.md` (verrouillé mai 2026).
// Source de vérité veille : `docs/module-veille-immoscan.md`.
// Tout changement ici DOIT être répercuté dans la fonction SQL `plan_limits()`
// (migration 20260520100200_quota_rpcs.sql).

import type { StrategyType } from "./schemas/user.js";

// ──────────────────────────────────────────────────────────────────
// Plans d'abonnement (recurring)
// ──────────────────────────────────────────────────────────────────
//
// 4 paliers recurring : Free / Pro / Pro+ / Business.
// PPU 14,90€ n'est PAS un plan : c'est un entitlement one-shot (voir
// `PAY_PER_USE` et la table `entitlements` côté DB).

export type PlanId = "free" | "pro" | "pro_plus" | "business";

/** Modèles Claude utilisés pour les thèses Top N. */
export const CLAUDE_MODEL_SONNET = "claude-sonnet-4-6" as const;
export const CLAUDE_MODEL_OPUS = "claude-opus-4-7" as const;
export type ClaudeModel = typeof CLAUDE_MODEL_SONNET | typeof CLAUDE_MODEL_OPUS;
export const CLAUDE_MODEL_DEFAULT: ClaudeModel = CLAUDE_MODEL_SONNET;

/** Fréquence des veilles selon palier (spec BM). Distinct du Zod
 * `WatchFrequency` (schemas/watch.ts) qui mappe sur l'enum SQL legacy
 * `('daily','three_days','weekly')`. PR-D alignera les deux. */
export type WatchScheduleFrequency = "thrice_weekly" | "daily";

/**
 * Définition complète d'un palier. Doit refléter la grille tarifaire
 * de `business-model-immoscan.md` §2.1 et matcher la fonction SQL
 * `plan_limits()`.
 */
export interface PlanDefinition {
  id: PlanId;
  name: string;
  // Pricing
  monthlyPriceEur: number;
  yearlyPriceEur: number; // -17% vs ×12 mensuel
  // Quotas analyses
  analysesPerMonth: number; // hard cap (Free=1, Pro=10, Pro+=25, Business=80)
  itemsMaxPerAnalysis: number;
  pasteUrlsMax: number | null; // null = illimité (Business)
  concurrentAnalysesMax: number;
  surplusAnalysisPriceEur: number | null; // overage Pro/Pro+/Business
  // Quotas veilles
  watchesIncluded: number;
  watchTotalCap: number; // incluses + add-on max
  itemsMaxPerWatchRun: number;
  watchFrequency: WatchScheduleFrequency;
  watchSources: number | "all"; // 1 / 2 / all
  watchTeasingActive: boolean; // true = floutage scores >=70 (Free uniquement)
  // Top N et modèles Claude
  topN: number;
  claudeModelTop5: ClaudeModel; // pour les 5 premiers du Top N
  claudeModelRest: ClaudeModel; // pour le reste (Top 6→N)
  // Exports + UX
  exportPdf: boolean;
  exportCsv: boolean;
  exportWhiteLabel: boolean;
  publicShare: boolean;
  // Historique
  historyDays: number | null; // null = illimité
  watchEvolutionsDays: number | null; // tab "Évolutions" depth
  // Multi-users (V1.5)
  seats: number;
  // Trial
  trialDays: number;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    analysesPerMonth: 1,
    itemsMaxPerAnalysis: 50,
    pasteUrlsMax: 5,
    concurrentAnalysesMax: 1,
    surplusAnalysisPriceEur: null,
    watchesIncluded: 1,
    watchTotalCap: 1,
    itemsMaxPerWatchRun: 50,
    watchFrequency: "thrice_weekly",
    watchSources: 1,
    watchTeasingActive: true,
    topN: 5,
    claudeModelTop5: CLAUDE_MODEL_SONNET,
    claudeModelRest: CLAUDE_MODEL_SONNET,
    exportPdf: false,
    exportCsv: false,
    exportWhiteLabel: false,
    publicShare: false,
    historyDays: 30,
    watchEvolutionsDays: null, // pas de tab Évolutions pour Free
    seats: 1,
    trialDays: 0,
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPriceEur: 39,
    yearlyPriceEur: 390,
    analysesPerMonth: 10,
    itemsMaxPerAnalysis: 300,
    pasteUrlsMax: 30,
    concurrentAnalysesMax: 1,
    surplusAnalysisPriceEur: 5,
    watchesIncluded: 3,
    watchTotalCap: 8,
    itemsMaxPerWatchRun: 100,
    watchFrequency: "thrice_weekly",
    watchSources: "all",
    watchTeasingActive: false,
    topN: 10,
    claudeModelTop5: CLAUDE_MODEL_SONNET,
    claudeModelRest: CLAUDE_MODEL_SONNET,
    exportPdf: true,
    exportCsv: false,
    exportWhiteLabel: false,
    publicShare: true,
    historyDays: 180, // 6 mois
    watchEvolutionsDays: 7,
    seats: 1,
    trialDays: 7,
  },
  pro_plus: {
    id: "pro_plus",
    name: "Pro+",
    monthlyPriceEur: 99,
    yearlyPriceEur: 990,
    analysesPerMonth: 25,
    itemsMaxPerAnalysis: 500,
    pasteUrlsMax: 100,
    concurrentAnalysesMax: 2,
    surplusAnalysisPriceEur: 4,
    watchesIncluded: 6,
    watchTotalCap: 16,
    itemsMaxPerWatchRun: 200,
    watchFrequency: "thrice_weekly",
    watchSources: "all",
    watchTeasingActive: false,
    topN: 20,
    claudeModelTop5: CLAUDE_MODEL_OPUS, // Opus uniquement sur les 5 premiers
    claudeModelRest: CLAUDE_MODEL_SONNET, // Top 6-20 restent Sonnet
    exportPdf: true,
    exportCsv: true,
    exportWhiteLabel: false,
    publicShare: true,
    historyDays: null, // illimité
    watchEvolutionsDays: 90,
    seats: 1,
    trialDays: 7,
  },
  business: {
    id: "business",
    name: "Business",
    monthlyPriceEur: 449,
    yearlyPriceEur: 4490,
    analysesPerMonth: 80,
    itemsMaxPerAnalysis: 1000,
    pasteUrlsMax: null, // illimité
    concurrentAnalysesMax: 3,
    surplusAnalysisPriceEur: 3,
    watchesIncluded: 15,
    watchTotalCap: 30,
    itemsMaxPerWatchRun: 300,
    watchFrequency: "daily",
    watchSources: "all",
    watchTeasingActive: false,
    topN: 30,
    claudeModelTop5: CLAUDE_MODEL_OPUS,
    claudeModelRest: CLAUDE_MODEL_OPUS, // Business = Opus partout
    exportPdf: true,
    exportCsv: true,
    exportWhiteLabel: true,
    publicShare: true,
    historyDays: null,
    watchEvolutionsDays: null, // illimité
    seats: 1, // V1 hard cap. Multi-seats prévu V1.5 (entitlement addon_seat).
    trialDays: 0, // demo personnalisée, pas de trial self-serve
  },
} as const satisfies Record<PlanId, PlanDefinition>;

/** Plans qui supportent le trial 7j sans CB. */
export const TRIAL_PLANS: readonly PlanId[] = ["pro", "pro_plus"] as const;
export const TRIAL_DAYS_PRO = PLANS.pro.trialDays;
export const TRIAL_DAYS_PRO_PLUS = PLANS.pro_plus.trialDays;

// ──────────────────────────────────────────────────────────────────
// Pay-per-use — analyse one-shot 14,90€
// ──────────────────────────────────────────────────────────────────
//
// Modélisé en table `entitlements` (type='ppu_analysis', status='pending'
// → 'consumed' à utilisation). Chaque PPU déclenche aussi un bonus veille
// 30j débloquée (entitlement type='ppu_watch_bonus').

export const PAY_PER_USE = {
  analysis: {
    sku: "ppu_analysis" as const,
    priceEur: 14.9,
    itemsMaxPerAnalysis: 300,
    watchBonusDays: 30,
    watchBonusItemsMax: 100,
    watchBonusSources: 2,
    historyDays: 90, // lecture seule post-consommation
  },
} as const;

export type PayPerUseSku = (typeof PAY_PER_USE)[keyof typeof PAY_PER_USE]["sku"];

// ──────────────────────────────────────────────────────────────────
// Add-ons recurring (veilles supplémentaires, seats)
// ──────────────────────────────────────────────────────────────────
//
// Chaque add-on actif est représenté par un entitlement de type
// matching, status='active', source_subscription_item_id renseigné.

export const ADDONS = {
  watch_unit: {
    sku: "addon_watch_unit" as const,
    label: "Veille additionnelle 3×/sem",
    priceEur: 7,
    availableFor: ["pro", "pro_plus"] as readonly PlanId[],
    watchesGranted: 1,
    frequency: "thrice_weekly" as WatchScheduleFrequency,
  },
  watch_pack3: {
    sku: "addon_watch_pack3" as const,
    label: "Pack 3 veilles 3×/sem",
    priceEur: 19,
    availableFor: ["pro", "pro_plus"] as readonly PlanId[],
    watchesGranted: 3,
    frequency: "thrice_weekly" as WatchScheduleFrequency,
  },
  watch_daily: {
    sku: "addon_watch_daily" as const,
    label: "Veille additionnelle daily",
    priceEur: 19,
    availableFor: ["business"] as readonly PlanId[],
    watchesGranted: 1,
    frequency: "daily" as WatchScheduleFrequency,
  },
  watch_pack3_daily: {
    sku: "addon_watch_pack3_daily" as const,
    label: "Pack 3 veilles daily",
    priceEur: 49,
    availableFor: ["business"] as readonly PlanId[],
    watchesGranted: 3,
    frequency: "daily" as WatchScheduleFrequency,
  },
  seat: {
    sku: "addon_seat" as const,
    label: "Seat supplémentaire",
    priceEur: 30,
    availableFor: ["business"] as readonly PlanId[],
    watchesGranted: 0,
    frequency: null,
  },
} as const;

export type AddonSku = (typeof ADDONS)[keyof typeof ADDONS]["sku"];

// ──────────────────────────────────────────────────────────────────
// Entitlement types / statuses
// ──────────────────────────────────────────────────────────────────
// Listes runtime des valeurs (utiles pour itérer, builder des forms,
// switch exhaustif). Les **types** sont définis dans
// schemas/entitlement.ts (Zod = source of truth). Importez-les depuis là.

export const ENTITLEMENT_TYPES = [
  "ppu_analysis",
  "ppu_watch_bonus",
  "addon_watch_unit",
  "addon_watch_pack3",
  "addon_watch_daily",
  "addon_watch_pack3_daily",
  "addon_seat",
] as const;

export const ENTITLEMENT_STATUSES = [
  "pending",
  "active",
  "consumed",
  "expired",
  "refunded",
] as const;

// ──────────────────────────────────────────────────────────────────
// Mécaniques d'expiration veilles (cf BM §2.2)
// ──────────────────────────────────────────────────────────────────

export const WATCH_EXPIRATION = {
  free: {
    durationDays: 60,
    reminderEmailsDaysBefore: [10, 3] as const, // J-10, J-3
  },
  ppu: {
    durationDays: 30,
    reminderEmailsDaysBefore: [7, 2] as const, // J-7, J-2
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// Freemium teasing
// ──────────────────────────────────────────────────────────────────

/** Score à partir duquel les biens sont floutés pour les users Free. */
export const FREEMIUM_MASK_THRESHOLD = 70;

/** Rang à partir duquel on switch du modèle top5 au modèle rest (Pro+). */
export const CLAUDE_TOP5_RANK_CUTOFF = 5;

// ──────────────────────────────────────────────────────────────────
// Helpers Claude
// ──────────────────────────────────────────────────────────────────

/**
 * Retourne le modèle Claude à utiliser pour générer la thèse d'un listing.
 * - Pro+ : Opus pour les rangs 1-5, Sonnet pour 6-20
 * - Business : Opus partout
 * - Free / Pro : Sonnet partout
 *
 * Le `rank` est l'index (1-based) du listing dans le Top N de l'analyse,
 * trié par score décroissant. Si omis, on retourne le model du Top 5
 * (cas par défaut pour les digests de veille où on prend le meilleur).
 */
export function claudeModelForPlan(
  plan: PlanId,
  rank?: number,
): ClaudeModel {
  const def = PLANS[plan];
  if (rank == null || rank <= CLAUDE_TOP5_RANK_CUTOFF) {
    return def.claudeModelTop5;
  }
  return def.claudeModelRest;
}

// ──────────────────────────────────────────────────────────────────
// Helpers caps (mirror SQL plan_limits, sans appeler la DB)
// ──────────────────────────────────────────────────────────────────

/** Caps applicables au plan, version TS. À garder en sync avec SQL plan_limits(). */
export function planLimits(plan: PlanId): {
  analyses_per_month: number;
  items_max_per_analysis: number;
  watches_included: number;
  watch_total_cap: number;
  items_max_per_watch_run: number;
  paste_urls_max: number | null;
  concurrent_analyses_max: number;
  top_n: number;
  claude_model_top5: ClaudeModel;
  claude_model_rest: ClaudeModel;
} {
  const p = PLANS[plan];
  return {
    analyses_per_month: p.analysesPerMonth,
    items_max_per_analysis: p.itemsMaxPerAnalysis,
    watches_included: p.watchesIncluded,
    watch_total_cap: p.watchTotalCap,
    items_max_per_watch_run: p.itemsMaxPerWatchRun,
    paste_urls_max: p.pasteUrlsMax,
    concurrent_analyses_max: p.concurrentAnalysesMax,
    top_n: p.topN,
    claude_model_top5: p.claudeModelTop5,
    claude_model_rest: p.claudeModelRest,
  };
}

// ──────────────────────────────────────────────────────────────────
// Frais d'acquisition
// ──────────────────────────────────────────────────────────────────

export const NOTAIRE_FEES_ANCIEN_PCT = 0.08;
export const NOTAIRE_FEES_NEUF_PCT = 0.03;

// ──────────────────────────────────────────────────────────────────
// Scoring weights — pondération par défaut du score /100
// ──────────────────────────────────────────────────────────────────

export const SCORING_WEIGHTS_DEFAULT = {
  prix: 25,
  rendement: 25,
  cashflow: 15,
  dpe: 10,
  quartier: 15,
  risques: 10,
} as const;

const _totalWeights = Object.values(SCORING_WEIGHTS_DEFAULT).reduce((a, b) => a + b, 0);
if (_totalWeights !== 100) {
  throw new Error(`SCORING_WEIGHTS_DEFAULT must sum to 100, got ${_totalWeights}`);
}

// ──────────────────────────────────────────────────────────────────
// Loi Climat
// ──────────────────────────────────────────────────────────────────

export const LOI_CLIMAT_CALENDAR = {
  G: 2025,
  F: 2028,
  E: 2034,
} as const;

// ──────────────────────────────────────────────────────────────────
// Zonage A/B1/B2/C
// ──────────────────────────────────────────────────────────────────

export type ZoneAbc = "A_bis" | "A" | "B1" | "B2" | "C";

// ──────────────────────────────────────────────────────────────────
// Cache TTL
// ──────────────────────────────────────────────────────────────────

export const CACHE_TTL = {
  apifyUrlSearch: 24 * 60 * 60 * 1000,
  apifyListing: 7 * 24 * 60 * 60 * 1000,
  banGeocode: 90 * 24 * 60 * 60 * 1000,
  ademeDpe: 30 * 24 * 60 * 60 * 1000,
  claudeThesis: 30 * 24 * 60 * 60 * 1000,
  marketStatsDvf: 30 * 24 * 60 * 60 * 1000, // PR-E
} as const;

// ──────────────────────────────────────────────────────────────────
// Limites techniques globales
// ──────────────────────────────────────────────────────────────────

/** Hard cap absolu, indépendant du plan. Sécurité. */
export const MAX_LISTINGS_PER_ANALYSIS = 1000;
export const APIFY_MAX_PAGES_PER_RUN = 50;
export const ANTHROPIC_MAX_OUTPUT_TOKENS = 8192;

// ──────────────────────────────────────────────────────────────────
// Détection d'anomalies de marché (BM §5.2, Veille §6)
// ──────────────────────────────────────────────────────────────────

/** Seuils de "décote potentielle à vérifier" selon la sensibilité veille. */
export const SIGNAL_TO_VERIFY_THRESHOLDS = {
  strict: -0.2, // -20% vs médian DVF du bin
  moderate: -0.15, // -15% (défaut)
  permissive: -0.1, // -10%
} as const;
export type SignalSensitivity = keyof typeof SIGNAL_TO_VERIFY_THRESHOLDS;

/** Bins DPE pour segmentation des médians DVF. */
export const DPE_BINS = {
  A_C: ["A", "B", "C"] as const,
  D_E: ["D", "E"] as const,
  F_G: ["F", "G"] as const,
} as const;
export type DpeBin = keyof typeof DPE_BINS;

/** Nombre minimal de transactions DVF pour calculer un médian fiable. */
export const SIGNAL_MIN_TRANSACTIONS = 15;

/** Seuil de baisse de prix pour déclencher event price_drop. */
export const PRICE_DROP_THRESHOLD_PCT = 0.03; // -3%

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
