// ────────────────────────────────────────────────────────────────────
// Edge Function : value-biens-publish
// ────────────────────────────────────────────────────────────────────
// POST /functions/v1/value-biens-publish/:bienId
//
// Paywall Stripe pour basculer un bien ImmoValue en visibilité publique
// (vitrine sur value.immoscan.fr).
//
// Comportement (cf. spec §6.2) :
//   - Authentification JWT obligatoire (le propriétaire seul peut publier).
//   - On résout le bien et on vérifie ownership.
//   - Si `paywall_unlocked_at` est déjà set (le propriétaire a déjà payé
//     une fois pour ce bien) : on bascule directement status='public' et
//     on déclenche `value-notify-public-switch`. Pas de nouveau Stripe.
//   - Sinon : on crée une Checkout Session Stripe (mode payment, 49€) et
//     on renvoie l'URL. Le `checkout.session.completed` webhook (cf.
//     stripe-webhook/index.ts → case `value_publish`) finalise la bascule
//     en base + déclenche la task notify.
//
// Body : aucun (tout est dans l'URL + JWT).
// Réponse :
//   - 200 { checkout_url, payment_required: true }                (Stripe needed)
//   - 200 { status: 'published', payment_required: false }        (déjà payé)
//   - 401 / 403 / 404 / 500 selon erreur
//
// Env requises :
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_VALUE_PUBLISH
//   VITE_VALUE_APP_URL  (https://value.immoscan.fr — pour success/cancel URLs)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   TRIGGER_API_URL, TRIGGER_API_KEY
//
// Déploiement :
//   supabase functions deploy value-biens-publish
// ────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { valuePriceIdForSku, VALUE_SKUS } from "../_shared/value-skus.ts";
import { triggerTask } from "../_shared/trigger-dev.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
if (!STRIPE_SECRET) throw new Error("STRIPE_SECRET_KEY not set");

const VALUE_APP_URL =
  Deno.env.get("VITE_VALUE_APP_URL") ??
  Deno.env.get("VALUE_APP_URL") ??
  "https://value.immoscan.fr";

const stripe = new Stripe(STRIPE_SECRET, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

// UUID v4 strict — pour valider le :bienId issu du path.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBienIdFromUrl(req: Request): string | null {
  // Supabase Edge routes : /functions/v1/value-biens-publish/<bienId>
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // On prend le dernier segment non vide.
  const last = segments[segments.length - 1];
  if (!last) return null;
  if (last === "value-biens-publish") return null; // pas d'ID fourni
  return UUID_RE.test(last) ? last : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // 1) Auth JWT (obligatoire — publication = action propriétaire).
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "missing_auth" });
  }
  const jwt = authHeader.slice("Bearer ".length);

  const admin = createAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json(401, { error: "invalid_token" });
  const userId = userData.user.id;

  // 2) bienId from path.
  const bienId = parseBienIdFromUrl(req);
  if (!bienId) return json(400, { error: "invalid_bien_id" });

  // 3) Récupère le bien (vérifie ownership via service_role + filtre user_id).
  const { data: bien, error: bienErr } = await admin
    .schema("value" as any)
    .from("biens")
    .select("id, user_id, status, paywall_unlocked_at")
    .eq("id", bienId)
    .maybeSingle();

  if (bienErr) {
    console.error("[value-biens-publish] select biens failed:", bienErr);
    return json(500, { error: "db_error", detail: bienErr.message });
  }
  if (!bien) return json(404, { error: "not_found" });
  if (bien.user_id !== userId) return json(403, { error: "forbidden" });

  // 4) Cas A — paywall déjà débloqué : bascule directe.
  if (bien.paywall_unlocked_at) {
    const nowIso = new Date().toISOString();
    const { error: updErr } = await admin
      .schema("value" as any)
      .from("biens")
      .update({
        status: "public",
        published_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", bien.id);

    if (updErr) {
      console.error("[value-biens-publish] update→public failed:", updErr);
      return json(500, { error: "publish_failed", detail: updErr.message });
    }

    try {
      await triggerTask("value-notify-public-switch", { bien_id: bien.id });
    } catch (err) {
      console.error("[value-biens-publish] notify task failed:", err);
      // On ne casse pas la requête : la bascule DB est faite.
    }

    return json(200, {
      status: "published",
      payment_required: false,
      bien_id: bien.id,
    });
  }

  // 5) Cas B — premier passage : Stripe Checkout.
  let priceId: string;
  try {
    priceId = valuePriceIdForSku("value_publish");
  } catch (err) {
    return json(500, {
      error: "price_id_missing",
      detail: (err as Error).message,
    });
  }

  // On rattache la session au stripe_customer_id du profile si dispo,
  // sinon Stripe en créera un. (On reste cohérent avec stripe-checkout.)
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId && profile) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name ?? undefined,
      metadata: { immoscan_profile_id: userId },
    });
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  const metadata = {
    product: VALUE_SKUS.value_publish.product, // 'value_publish'
    bien_id: bien.id,
    user_id: userId,
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${VALUE_APP_URL}/value/biens/${bien.id}?published=true`,
      cancel_url: `${VALUE_APP_URL}/value/biens/${bien.id}`,
      metadata,
      payment_intent_data: { metadata },
    });
  } catch (err) {
    console.error("[value-biens-publish] stripe session.create failed:", err);
    return json(500, {
      error: "stripe_error",
      detail: (err as Error).message,
    });
  }

  return json(200, {
    checkout_url: session.url,
    payment_required: true,
    bien_id: bien.id,
  });
});
