// ────────────────────────────────────────────────────────────────────
// SKU Stripe ImmoValue (à côté des SKU ImmoScan existants).
// ────────────────────────────────────────────────────────────────────
// ImmoValue introduit des paiements one-shot dédiés (pas de plan
// d'abonnement). On les déclare séparément des BILLING_SKUS ImmoScan
// pour éviter d'élargir le type `BillingSku` et de polluer les checks
// faits côté webhook ImmoScan (PPU / plans / addons).
//
// La résolution Stripe priceId → SKU se fait via `resolveValueSku()`,
// utilisée uniquement dans la branche `metadata.product === 'value_*'`
// du webhook Stripe.
//
// **Toute modif ici doit être répercutée dans le package shared
// (`packages/shared/src/billing/value-skus.ts` côté monorepo TS).**
// (commit `chore: sync value-skus`)
// ────────────────────────────────────────────────────────────────────

export type ValueSku = "value_publish" | "value_pack_annonces";

export interface ValueSkuDefinition {
  sku: ValueSku;
  product: "value_publish" | "value_pack_annonces";
  envVarName: string;
  label: string;
  priceEur: number;
  mode: "payment"; // one-shot only
}

export const VALUE_SKUS: Record<ValueSku, ValueSkuDefinition> = {
  value_publish: {
    sku: "value_publish",
    product: "value_publish",
    envVarName: "STRIPE_PRICE_VALUE_PUBLISH",
    label: "Publication vitrine ImmoValue",
    priceEur: 49,
    mode: "payment",
  },
  value_pack_annonces: {
    sku: "value_pack_annonces",
    product: "value_pack_annonces",
    envVarName: "STRIPE_PRICE_VALUE_PACK_ANNONCES",
    label: "Pack annonces SeLoger/LBC",
    priceEur: 39,
    mode: "payment",
  },
};

export function valuePriceIdForSku(sku: ValueSku): string {
  const def = VALUE_SKUS[sku];
  const id = Deno.env.get(def.envVarName);
  if (!id) {
    throw new Error(`Missing env var ${def.envVarName} for SKU ${sku}`);
  }
  return id;
}
