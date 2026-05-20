// ────────────────────────────────────────────────────────────────────
// Edge Function : stripe-portal
// ────────────────────────────────────────────────────────────────────
// Crée un Billing Portal session pour permettre au user de gérer ses
// abonnements (upgrade/downgrade/annulation, méthode de paiement,
// factures historiques).
//
// Body : { "returnUrl": "https://app.immoscan.fr/app/billing" }
// Réponse : { url: "https://billing.stripe.com/p/session/..." }
//
// Auth user JWT obligatoire.
// ────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
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
  const returnUrl = body?.returnUrl as string | undefined;
  if (!returnUrl) return json(400, { error: "missing_return_url" });

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  if (!profile?.stripe_customer_id) {
    return json(404, { error: "no_stripe_customer", hint: "Faire un achat d'abord pour créer le customer." });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });
    return json(200, { url: session.url });
  } catch (err) {
    console.error("[stripe-portal] error:", err);
    return json(500, { error: "stripe_error", detail: (err as Error).message });
  }
});
