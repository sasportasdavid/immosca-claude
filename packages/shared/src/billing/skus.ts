// ──────────────────────────────────────────────────────────────────
// Mapping Stripe SKUs ↔ plans / entitlements ImmoScan
// ──────────────────────────────────────────────────────────────────
//
// Single source of truth pour la résolution d'un Stripe price_id vers
// l'action métier à exécuter dans le webhook. Le mapping inverse (SKU →
// price_id) est résolu via les variables d'environnement
// `STRIPE_PRICE_<SKU>` côté Edge Function.
//
// IMPORTANT : Les Edge Functions Supabase tournent en Deno isolé et ne
// peuvent pas importer ce package directement. La duplication
// `supabase-app/supabase/functions/_shared/stripe-skus.ts` doit être
// maintenue en sync (rajouter un commit `chore: sync stripe-skus`).

import type { PlanId } from "../constants.js";

/** Tous les SKUs facturables ImmoScan. */
export type BillingSku =
  // Plans recurring
  | "pro_monthly"
  | "pro_yearly"
  | "pro_plus_monthly"
  | "pro_plus_yearly"
  | "business_monthly"
  | "business_yearly"
  // Pay-per-use one-shot
  | "ppu_analysis"
  // Add-ons recurring (Pro / Pro+)
  | "addon_watch_unit"
  | "addon_watch_pack3"
  // Add-ons recurring (Business)
  | "addon_watch_daily"
  | "addon_watch_pack3_daily"
  | "addon_seat";

/** Type d'effet d'un SKU sur le compte du user. */
export type SkuKind = "plan_subscription" | "ppu_oneshot" | "addon_subscription";

export interface SkuDefinition {
  sku: BillingSku;
  kind: SkuKind;
  /** Pour kind=plan_subscription : le PlanId résultant côté profile. */
  plan?: PlanId;
  /** Pour kind=plan_subscription : période de facturation. */
  billingPeriod?: "monthly" | "yearly";
  /** Type d'entitlement créé (PPU + add-ons). */
  entitlementType?:
    | "ppu_analysis"
    | "ppu_watch_bonus"
    | "addon_watch_unit"
    | "addon_watch_pack3"
    | "addon_watch_daily"
    | "addon_watch_pack3_daily"
    | "addon_seat";
  /** Trial gratuit en jours (0 = no trial). */
  trialDays: number;
  /** Variable d'environnement contenant le `price_id` Stripe. */
  envVarName: string;
  /** Label commercial affiché côté frontend. */
  label: string;
  /** Prix affiché (EUR TTC, indicatif — source de vérité = Stripe). */
  priceEur: number;
}

/**
 * Catalogue complet. Le `envVarName` doit être set en prod via :
 *   stripe products create --name "Pro" --metadata sku=pro
 *   stripe prices create --product prod_xxx --unit-amount 3900 --currency eur \
 *     --recurring interval=month
 *   supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_xxx
 */
export const BILLING_SKUS: Record<BillingSku, SkuDefinition> = {
  pro_monthly: {
    sku: "pro_monthly",
    kind: "plan_subscription",
    plan: "pro",
    billingPeriod: "monthly",
    trialDays: 7,
    envVarName: "STRIPE_PRICE_PRO_MONTHLY",
    label: "Pro · mensuel",
    priceEur: 39,
  },
  pro_yearly: {
    sku: "pro_yearly",
    kind: "plan_subscription",
    plan: "pro",
    billingPeriod: "yearly",
    trialDays: 7,
    envVarName: "STRIPE_PRICE_PRO_YEARLY",
    label: "Pro · annuel",
    priceEur: 390,
  },
  pro_plus_monthly: {
    sku: "pro_plus_monthly",
    kind: "plan_subscription",
    plan: "pro_plus",
    billingPeriod: "monthly",
    trialDays: 7,
    envVarName: "STRIPE_PRICE_PRO_PLUS_MONTHLY",
    label: "Pro+ · mensuel",
    priceEur: 99,
  },
  pro_plus_yearly: {
    sku: "pro_plus_yearly",
    kind: "plan_subscription",
    plan: "pro_plus",
    billingPeriod: "yearly",
    trialDays: 7,
    envVarName: "STRIPE_PRICE_PRO_PLUS_YEARLY",
    label: "Pro+ · annuel",
    priceEur: 990,
  },
  business_monthly: {
    sku: "business_monthly",
    kind: "plan_subscription",
    plan: "business",
    billingPeriod: "monthly",
    trialDays: 0, // pas de trial self-serve, demo personnalisée
    envVarName: "STRIPE_PRICE_BUSINESS_MONTHLY",
    label: "Business · mensuel",
    priceEur: 449,
  },
  business_yearly: {
    sku: "business_yearly",
    kind: "plan_subscription",
    plan: "business",
    billingPeriod: "yearly",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_BUSINESS_YEARLY",
    label: "Business · annuel",
    priceEur: 4490,
  },
  ppu_analysis: {
    sku: "ppu_analysis",
    kind: "ppu_oneshot",
    entitlementType: "ppu_analysis",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_PPU_ANALYSIS",
    label: "Analyse à l'unité",
    priceEur: 14.9,
  },
  addon_watch_unit: {
    sku: "addon_watch_unit",
    kind: "addon_subscription",
    entitlementType: "addon_watch_unit",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_ADDON_WATCH_UNIT",
    label: "Veille additionnelle (3×/sem)",
    priceEur: 7,
  },
  addon_watch_pack3: {
    sku: "addon_watch_pack3",
    kind: "addon_subscription",
    entitlementType: "addon_watch_pack3",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_ADDON_WATCH_PACK3",
    label: "Pack 3 veilles (3×/sem)",
    priceEur: 19,
  },
  addon_watch_daily: {
    sku: "addon_watch_daily",
    kind: "addon_subscription",
    entitlementType: "addon_watch_daily",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_ADDON_WATCH_DAILY",
    label: "Veille additionnelle (daily)",
    priceEur: 19,
  },
  addon_watch_pack3_daily: {
    sku: "addon_watch_pack3_daily",
    kind: "addon_subscription",
    entitlementType: "addon_watch_pack3_daily",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_ADDON_WATCH_PACK3_DAILY",
    label: "Pack 3 veilles (daily)",
    priceEur: 49,
  },
  addon_seat: {
    sku: "addon_seat",
    kind: "addon_subscription",
    entitlementType: "addon_seat",
    trialDays: 0,
    envVarName: "STRIPE_PRICE_ADDON_SEAT",
    label: "Seat supplémentaire",
    priceEur: 30,
  },
};

/** Liste des SKUs achetables depuis le frontend (exclut seats — UI dédiée V1.5). */
export const PUBLIC_CHECKOUT_SKUS: readonly BillingSku[] = [
  "pro_monthly",
  "pro_yearly",
  "pro_plus_monthly",
  "pro_plus_yearly",
  "business_monthly",
  "business_yearly",
  "ppu_analysis",
  "addon_watch_unit",
  "addon_watch_pack3",
  "addon_watch_daily",
  "addon_watch_pack3_daily",
] as const;

/** Helper de résolution inverse : depuis un price_id Stripe, retrouver le SKU. */
export function resolveSkuFromPriceId(
  priceId: string,
  envLookup: (name: string) => string | undefined,
): BillingSku | null {
  for (const sku of Object.keys(BILLING_SKUS) as BillingSku[]) {
    const def = BILLING_SKUS[sku];
    if (envLookup(def.envVarName) === priceId) return sku;
  }
  return null;
}

/** Construit l'objet `metadata` Stripe à attacher aux sessions/subscriptions. */
export function buildStripeMetadata(params: {
  profileId: string;
  sku: BillingSku;
  /** Permet d'identifier l'analyse cible côté webhook si PPU acheté depuis un contexte d'analyse. */
  context?: { analysisId?: string; watchId?: string };
}): Record<string, string> {
  const meta: Record<string, string> = {
    immoscan_profile_id: params.profileId,
    immoscan_sku: params.sku,
  };
  if (params.context?.analysisId) meta.immoscan_analysis_id = params.context.analysisId;
  if (params.context?.watchId) meta.immoscan_watch_id = params.context.watchId;
  return meta;
}
