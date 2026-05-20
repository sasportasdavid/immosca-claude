// scripts/seed-stripe.ts
//
// One-shot setup : crée les 6 produits ImmoScan + 12 prix dans Stripe,
// puis affiche les `STRIPE_PRICE_*` à set en secret Supabase.
//
// Usage :
//   STRIPE_SECRET_KEY=sk_test_xxx pnpm tsx scripts/seed-stripe.ts
//   # Pour la prod :
//   STRIPE_SECRET_KEY=sk_live_xxx pnpm tsx scripts/seed-stripe.ts
//
// **À tourner UNE SEULE FOIS par environnement** (sandbox vs prod).
// Pour ajuster un prix : passer par le Dashboard Stripe, ce script ne
// fait que de la création initiale.

import Stripe from "stripe";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error("STRIPE_SECRET_KEY env var required");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
});

interface ProductSpec {
  productName: string;
  productMetadataSku: string;
  description: string;
  prices: Array<{
    skuKey: string; // utilisé pour le nom du secret final (STRIPE_PRICE_<UPPER>)
    amount: number; // en centimes
    interval?: "month" | "year";
    oneTime?: boolean;
  }>;
}

const SPECS: ProductSpec[] = [
  {
    productName: "ImmoScan Pro",
    productMetadataSku: "pro",
    description: "10 analyses/mois, 3 veilles 3×/sem, Top 10 Sonnet",
    prices: [
      { skuKey: "pro_monthly", amount: 3900, interval: "month" },
      { skuKey: "pro_yearly", amount: 39000, interval: "year" },
    ],
  },
  {
    productName: "ImmoScan Pro+",
    productMetadataSku: "pro_plus",
    description: "25 analyses/mois, 6 veilles, Top 20 (Opus Top 5)",
    prices: [
      { skuKey: "pro_plus_monthly", amount: 9900, interval: "month" },
      { skuKey: "pro_plus_yearly", amount: 99000, interval: "year" },
    ],
  },
  {
    productName: "ImmoScan Business",
    productMetadataSku: "business",
    description: "80 analyses/mois, 15 veilles daily, Opus partout",
    prices: [
      { skuKey: "business_monthly", amount: 44900, interval: "month" },
      { skuKey: "business_yearly", amount: 449000, interval: "year" },
    ],
  },
  {
    productName: "Analyse à l'unité (PPU)",
    productMetadataSku: "ppu_analysis",
    description: "1 analyse one-shot + bonus veille 30j débloquée",
    prices: [{ skuKey: "ppu_analysis", amount: 1490, oneTime: true }],
  },
  {
    productName: "Add-on Veille",
    productMetadataSku: "addon_watch",
    description: "Veilles supplémentaires (3×/sem ou daily)",
    prices: [
      { skuKey: "addon_watch_unit", amount: 700, interval: "month" },
      { skuKey: "addon_watch_pack3", amount: 1900, interval: "month" },
      { skuKey: "addon_watch_daily", amount: 1900, interval: "month" },
      { skuKey: "addon_watch_pack3_daily", amount: 4900, interval: "month" },
    ],
  },
  {
    productName: "Seat supplémentaire (Business)",
    productMetadataSku: "addon_seat",
    description: "Utilisateur additionnel sur compte Business",
    prices: [{ skuKey: "addon_seat", amount: 3000, interval: "month" }],
  },
];

async function ensureProduct(spec: ProductSpec): Promise<string> {
  // Cherche un produit existant via metadata
  const products = await stripe.products.search({
    query: `metadata['immoscan_sku']:'${spec.productMetadataSku}'`,
    limit: 1,
  });
  if (products.data.length > 0 && products.data[0]) {
    console.log(`✓ Product "${spec.productName}" already exists: ${products.data[0].id}`);
    return products.data[0].id;
  }
  const created = await stripe.products.create({
    name: spec.productName,
    description: spec.description,
    metadata: { immoscan_sku: spec.productMetadataSku },
  });
  console.log(`+ Created product "${spec.productName}": ${created.id}`);
  return created.id;
}

async function ensurePrice(
  productId: string,
  priceSpec: ProductSpec["prices"][number],
): Promise<{ priceId: string; secretName: string }> {
  // Cherche un price existant via metadata
  const search = await stripe.prices.search({
    query: `product:'${productId}' AND metadata['immoscan_sku_key']:'${priceSpec.skuKey}'`,
    limit: 1,
  });
  if (search.data.length > 0 && search.data[0]) {
    const p = search.data[0];
    console.log(`  ✓ Price ${priceSpec.skuKey} already exists: ${p.id}`);
    return { priceId: p.id, secretName: `STRIPE_PRICE_${priceSpec.skuKey.toUpperCase()}` };
  }
  const params: Stripe.PriceCreateParams = {
    product: productId,
    currency: "eur",
    unit_amount: priceSpec.amount,
    metadata: { immoscan_sku_key: priceSpec.skuKey },
  };
  if (priceSpec.interval) {
    params.recurring = { interval: priceSpec.interval };
  }
  const created = await stripe.prices.create(params);
  console.log(`  + Created price ${priceSpec.skuKey}: ${created.id}`);
  return { priceId: created.id, secretName: `STRIPE_PRICE_${priceSpec.skuKey.toUpperCase()}` };
}

async function main() {
  console.log("🚀 Seeding Stripe products + prices for ImmoScan...\n");
  const secrets: Array<{ name: string; value: string }> = [];

  for (const spec of SPECS) {
    const productId = await ensureProduct(spec);
    for (const priceSpec of spec.prices) {
      const { priceId, secretName } = await ensurePrice(productId, priceSpec);
      secrets.push({ name: secretName, value: priceId });
    }
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("✅ Done. Now set these secrets in Supabase :\n");
  for (const s of secrets) {
    console.log(`supabase secrets set ${s.name}=${s.value}`);
  }
  console.log("\n──────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
