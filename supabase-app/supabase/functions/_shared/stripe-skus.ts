// ────────────────────────────────────────────────────────────────────
// DUPLICATE de `packages/shared/src/billing/skus.ts`
// ────────────────────────────────────────────────────────────────────
// Les Edge Functions Supabase tournent en Deno isolé et ne peuvent pas
// importer directement le monorepo TS.
// **Toute modif ici doit être répercutée dans le package shared.**
// (commit `chore: sync stripe-skus`)
// ────────────────────────────────────────────────────────────────────

export type PlanId = "free" | "pro" | "pro_plus" | "business";

export type BillingSku =
  | "pro_monthly"
  | "pro_yearly"
  | "pro_plus_monthly"
  | "pro_plus_yearly"
  | "business_monthly"
  | "business_yearly"
  | "ppu_analysis"
  | "addon_watch_unit"
  | "addon_watch_pack3"
  | "addon_watch_daily"
  | "addon_watch_pack3_daily"
  | "addon_seat";

export type SkuKind = "plan_subscription" | "ppu_oneshot" | "addon_subscription";

export type EntitlementType =
  | "ppu_analysis"
  | "ppu_watch_bonus"
  | "addon_watch_unit"
  | "addon_watch_pack3"
  | "addon_watch_daily"
  | "addon_watch_pack3_daily"
  | "addon_seat";

export interface SkuDefinition {
  sku: BillingSku;
  kind: SkuKind;
  plan?: PlanId;
  billingPeriod?: "monthly" | "yearly";
  entitlementType?: EntitlementType;
  trialDays: number;
  envVarName: string;
  label: string;
  priceEur: number;
}

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
    trialDays: 0,
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

export function resolveSkuFromPriceId(priceId: string): BillingSku | null {
  for (const sku of Object.keys(BILLING_SKUS) as BillingSku[]) {
    const def = BILLING_SKUS[sku];
    if (Deno.env.get(def.envVarName) === priceId) return sku;
  }
  return null;
}

export function priceIdForSku(sku: BillingSku): string {
  const def = BILLING_SKUS[sku];
  const id = Deno.env.get(def.envVarName);
  if (!id) {
    throw new Error(`Missing env var ${def.envVarName} for SKU ${sku}`);
  }
  return id;
}
