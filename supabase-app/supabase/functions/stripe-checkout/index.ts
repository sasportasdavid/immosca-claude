// ────────────────────────────────────────────────────────────────────
// Edge Function : stripe-checkout
// ────────────────────────────────────────────────────────────────────
// Crée une Checkout Session Stripe pour un SKU donné. Appelée depuis
// le frontend authentifié (user JWT requis).
//
// Body :
//   {
//     "sku": "pro_monthly" | "ppu_analysis" | ...,
//     "successUrl": "https://app.immoscan.fr/app/billing?success=1",
//     "cancelUrl":  "https://app.immoscan.fr/app/billing?canceled=1",
//     "context": { "analysisId"?: string, "watchId"?: string }
//   }
//
// Réponse : { url: "https://checkout.stripe.com/c/pay/cs_..." }
//
// Sécurité :
//   - JWT user obligatoire (Authorization: Bearer)
//   - On résout le profile depuis le JWT, jamais depuis le body
//   - On crée le Stripe customer s'il n'existe pas encore
//
// Déploiement :
//   supabase functions deploy stripe-checkout
// ────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import {
  BILLING_SKUS,
  type BillingSku,
  priceIdForSku,
} from "../_shared/stripe-skus.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
if (!STRIPE_SECRET) throw new Error("STRIPE_SECRET_KEY not set");

const stripe = new Stripe(STRIPE_SECRET, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Auth user
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "missing_auth" });
  const userJwt = authHeader.slice("Bearer ".length);

  const admin = createAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(userJwt);
  if (userErr || !userData?.user) return json(401, { error: "invalid_token" });
  const userId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const sku = body?.sku as BillingSku | undefined;
  if (!sku || !BILLING_SKUS[sku]) return json(400, { error: "invalid_sku", sku });
  const successUrl = body?.successUrl as string | undefined;
  const cancelUrl = body?.cancelUrl as string | undefined;
  if (!successUrl || !cancelUrl) return json(400, { error: "missing_urls" });

  const def = BILLING_SKUS[sku];

  // Récupère ou crée le Stripe customer
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email, full_name, subscription_plan")
    .eq("id", userId)
    .single();
  if (!profile) return json(404, { error: "profile_not_found" });

  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name ?? undefined,
      metadata: { immoscan_profile_id: userId },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  }

  // Vérifications palier : un Free ne peut pas acheter un addon, etc.
  if (def.kind === "addon_subscription") {
    if (profile.subscription_plan === "free") {
      return json(403, {
        error: "addon_requires_paid_plan",
        upgrade_to: "pro",
      });
    }
  }

  // Construction de la session
  let priceId: string;
  try {
    priceId = priceIdForSku(sku);
  } catch (err) {
    return json(500, { error: "price_id_missing", detail: (err as Error).message });
  }

  const metadata = {
    immoscan_profile_id: userId,
    immoscan_sku: sku,
    ...(body?.context?.analysisId ? { immoscan_analysis_id: body.context.analysisId } : {}),
    ...(body?.context?.watchId ? { immoscan_watch_id: body.context.watchId } : {}),
  };

  let session: Stripe.Checkout.Session;
  try {
    if (def.kind === "ppu_oneshot") {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        payment_intent_data: { metadata },
        // Auto-tax / VAT à activer plus tard si besoin EU compliance
      });
    } else {
      // plan_subscription ou addon_subscription
      const subParams: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
        metadata,
      };
      if (def.trialDays > 0) {
        subParams.trial_period_days = def.trialDays;
      }
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        subscription_data: subParams,
        allow_promotion_codes: true,
      });
    }
  } catch (err) {
    console.error("[stripe-checkout] session create failed:", err);
    return json(500, { error: "stripe_error", detail: (err as Error).message });
  }

  return json(200, { url: session.url, sessionId: session.id });
});
