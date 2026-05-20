// ────────────────────────────────────────────────────────────────────
// Edge Function : stripe-webhook
// ────────────────────────────────────────────────────────────────────
// Reçoit les events Stripe et synchronise l'état dans immoscan-app.
// Events handlés :
//   - checkout.session.completed       → crée entitlements (PPU/add-ons)
//                                         ou marque sub active (plans)
//   - customer.subscription.created    → upsert subscriptions + profile.plan
//   - customer.subscription.updated    → idem (changement plan, status)
//   - customer.subscription.deleted    → status='canceled', plan→free
//   - invoice.payment_succeeded        → reset usage_counters cycle
//   - invoice.payment_failed           → status='past_due'
//
// Sécurité :
//   - Signature Stripe vérifiée via STRIPE_WEBHOOK_SECRET
//   - Idempotence via header `stripe-signature` + event.id (Stripe ne renvoie
//     pas le même event.id, mais on traque dans `stripe_webhook_events` (TODO))
//
// Env requises :
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_PRICE_* (tous les SKUs, cf _shared/stripe-skus.ts)
//
// Déploiement :
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   (no-verify-jwt car appelé par Stripe directement, pas par un user)
// ────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import {
  BILLING_SKUS,
  type BillingSku,
  resolveSkuFromPriceId,
} from "../_shared/stripe-skus.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

if (!STRIPE_SECRET) throw new Error("STRIPE_SECRET_KEY not set");
if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not set");

const stripe = new Stripe(STRIPE_SECRET, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const ok = (body: unknown = { received: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const fail = (status: number, msg: string) => {
  console.error(`[stripe-webhook] ${status}: ${msg}`);
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed");

  const sig = req.headers.get("stripe-signature");
  if (!sig) return fail(400, "missing_signature");

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return fail(400, `signature_verification_failed: ${(err as Error).message}`);
  }

  const supabase = createAdminClient();

  // Idempotence : on garde une trace simple via event.id en upsert.
  // En cas d'event déjà traité, on retourne 200 sans rejouer.
  const { data: existing } = await supabase
    .from("stripe_webhook_events" as any)
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (existing) {
    console.log(`[stripe-webhook] event ${event.id} already processed, skip`);
    return ok({ skipped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(supabase, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(supabase, event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
    }

    // Trace l'event traité (idempotence). Si la table n'existe pas encore,
    // on swallow l'erreur — la prochaine migration la créera (PR-B.4).
    await supabase
      .from("stripe_webhook_events" as any)
      .insert({ id: event.id, type: event.type, processed_at: new Date().toISOString() })
      .then((r: any) => {
        if (r.error && r.error.code !== "42P01" /* undefined_table */) {
          console.warn("[stripe-webhook] failed to log event:", r.error.message);
        }
      });

    return ok();
  } catch (err) {
    console.error(`[stripe-webhook] handler error on ${event.type}:`, err);
    return fail(500, `handler_error: ${(err as Error).message}`);
  }
});

// ──────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
) {
  const profileId = session.metadata?.immoscan_profile_id;
  const sku = (session.metadata?.immoscan_sku ?? null) as BillingSku | null;
  if (!profileId) {
    console.warn("[checkout.completed] no immoscan_profile_id in metadata, session=", session.id);
    return;
  }

  // Met à jour stripe_customer_id sur le profile si absent
  if (session.customer) {
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: String(session.customer) })
      .eq("id", profileId);
  }

  if (!sku) {
    console.warn("[checkout.completed] no immoscan_sku in metadata, session=", session.id);
    return;
  }

  const def = BILLING_SKUS[sku];

  if (def.kind === "ppu_oneshot") {
    // PPU 14,90€ : crée 2 entitlements (analysis pending + watch_bonus 30j)
    const now = new Date();
    const watchBonusExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const analysisExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const { error } = await supabase.from("entitlements").insert([
      {
        profile_id: profileId,
        type: "ppu_analysis",
        status: "pending",
        source: "stripe_checkout",
        source_payment_id: session.id,
        expires_at: analysisExpiresAt.toISOString(),
        metadata: session.metadata ?? {},
      },
      {
        profile_id: profileId,
        type: "ppu_watch_bonus",
        status: "pending",
        source: "stripe_checkout",
        source_payment_id: session.id,
        expires_at: watchBonusExpiresAt.toISOString(),
        metadata: session.metadata ?? {},
      },
    ]);
    if (error) throw new Error(`failed to insert ppu entitlements: ${error.message}`);
    console.log(`[checkout.completed] PPU granted for profile=${profileId}`);
    return;
  }

  // Pour les plan_subscription et addon_subscription, le webhook
  // `customer.subscription.created/updated` qui suit s'occupe de
  // synchroniser la table subscriptions + entitlements add-on.
  console.log(
    `[checkout.completed] sku=${sku} (kind=${def.kind}) — sub events will follow for profile=${profileId}`,
  );
}

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  const profileId = sub.metadata?.immoscan_profile_id;
  if (!profileId) {
    console.warn(`[sub.upsert] no immoscan_profile_id, sub=${sub.id}`);
    return;
  }

  // Détermine le plan principal (premier item recurring avec entitlementType=undefined)
  // et les add-ons recurring (items avec entitlementType !== undefined)
  let mainPlanId: "free" | "pro" | "pro_plus" | "business" = "free";
  let mainPriceId: string | null = null;
  const addonItems: { itemId: string; sku: BillingSku }[] = [];

  for (const item of sub.items.data) {
    const priceId = item.price.id;
    const sku = resolveSkuFromPriceId(priceId);
    if (!sku) {
      console.warn(`[sub.upsert] unknown price_id=${priceId}, sub=${sub.id}`);
      continue;
    }
    const def = BILLING_SKUS[sku];
    if (def.kind === "plan_subscription" && def.plan) {
      mainPlanId = def.plan;
      mainPriceId = priceId;
    } else if (def.kind === "addon_subscription") {
      addonItems.push({ itemId: item.id, sku });
    }
  }

  const trialStart = sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const periodStart = new Date(sub.current_period_start * 1000).toISOString();
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

  // Upsert subscriptions row
  if (mainPriceId) {
    const { error: subErr } = await supabase.from("subscriptions").upsert(
      {
        profile_id: profileId,
        stripe_subscription_id: sub.id,
        stripe_price_id: mainPriceId,
        plan: mainPlanId,
        status: sub.status as any,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        trial_start: trialStart,
        trial_end: trialEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      },
      { onConflict: "stripe_subscription_id" },
    );
    if (subErr) throw new Error(`failed to upsert subscription: ${subErr.message}`);
  }

  // Update profile.plan + trial_ends_at
  const profileUpdate: Record<string, unknown> = {
    subscription_plan: mainPlanId,
    subscription_status: sub.status,
    trial_ends_at: trialEnd,
  };
  if (sub.customer) profileUpdate.stripe_customer_id = String(sub.customer);

  const { error: profileErr } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", profileId);
  if (profileErr) throw new Error(`failed to update profile: ${profileErr.message}`);

  // PR-G : upgrade vers un plan payant → nullifie expires_at sur les
  // watches Free (sinon le user verrait un countdown d'expiration alors
  // qu'il a payé). Le worker watch-expiration-mailer fait ce nettoyage
  // au prochain tick 9h UTC, mais on le fait ici aussi pour une UX immédiate.
  if (mainPlanId !== "free") {
    await supabase
      .from("watches")
      .update({ expires_at: null, expiration_emails_sent: [] })
      .eq("profile_id", profileId)
      .not("expires_at", "is", null);
  }

  // Sync add-on entitlements : créer les manquants, expirer les retirés
  await syncAddonEntitlements(supabase, profileId, sub.id, addonItems);

  console.log(
    `[sub.upsert] profile=${profileId} plan=${mainPlanId} status=${sub.status} addons=${addonItems.length}`,
  );
}

async function syncAddonEntitlements(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  subscriptionId: string,
  currentItems: { itemId: string; sku: BillingSku }[],
) {
  // Récupère les entitlements add-on actifs liés à cette sub
  const { data: existing } = await supabase
    .from("entitlements")
    .select("id, source_subscription_item_id, type, status")
    .eq("profile_id", profileId)
    .in("type", [
      "addon_watch_unit",
      "addon_watch_pack3",
      "addon_watch_daily",
      "addon_watch_pack3_daily",
      "addon_seat",
    ])
    .in("status", ["pending", "active"]);

  const existingItemIds = new Set(
    (existing ?? []).map((e: any) => e.source_subscription_item_id).filter(Boolean),
  );
  const currentItemIds = new Set(currentItems.map((i) => i.itemId));

  // Créer les manquants
  const toCreate = currentItems.filter((i) => !existingItemIds.has(i.itemId));
  if (toCreate.length > 0) {
    const rows = toCreate.map((i) => ({
      profile_id: profileId,
      type: BILLING_SKUS[i.sku].entitlementType!,
      status: "active",
      source: "stripe_subscription",
      source_subscription_item_id: i.itemId,
      source_payment_id: subscriptionId,
      metadata: { sub_id: subscriptionId, sku: i.sku },
    }));
    const { error } = await supabase.from("entitlements").insert(rows);
    if (error) console.warn(`[syncAddonEntitlements] insert error: ${error.message}`);
  }

  // Expirer les retirés
  const toExpireIds = (existing ?? [])
    .filter((e: any) => e.source_subscription_item_id && !currentItemIds.has(e.source_subscription_item_id))
    .map((e: any) => e.id);
  if (toExpireIds.length > 0) {
    await supabase
      .from("entitlements")
      .update({ status: "expired" })
      .in("id", toExpireIds);
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  const profileId = sub.metadata?.immoscan_profile_id;
  if (!profileId) return;

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  // Anti-churn : pas de downgrade direct vers Free, on bascule lecture seule PPU
  // (BM §4.3). Pour V1, on simplifie : on downgrade vers free et on laisse les
  // entitlements PPU actifs jouer leur rôle de lecture seule.
  await supabase
    .from("profiles")
    .update({
      subscription_plan: "free",
      subscription_status: "canceled",
      trial_ends_at: null,
    })
    .eq("id", profileId);

  // Expire tous les entitlements add-on liés à cette sub
  await supabase
    .from("entitlements")
    .update({ status: "expired" })
    .eq("profile_id", profileId)
    .eq("source_payment_id", sub.id)
    .in("status", ["pending", "active"]);

  console.log(`[sub.deleted] profile=${profileId} sub=${sub.id} → free`);
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice,
) {
  const subId = invoice.subscription;
  if (!subId) return; // PPU one-shot : géré par checkout.session.completed

  // Retrouve le profile via la sub (à défaut de metadata sur l'invoice)
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("profile_id, current_period_start, current_period_end")
    .eq("stripe_subscription_id", String(subId))
    .maybeSingle();
  if (!sub) {
    console.warn(`[invoice.paid] no sub found for stripe_subscription_id=${subId}`);
    return;
  }

  // Reset du compteur d'usage à chaque nouveau cycle
  // (period_start change → on insère une nouvelle row usage_counters via ensure_usage_counter)
  // Ici on n'a rien à faire activement : la prochaine vérif quota va créer la nouvelle row.
  // On peut juste loguer.
  console.log(`[invoice.paid] profile=${sub.profile_id} period=${sub.current_period_start}→${sub.current_period_end}`);
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice,
) {
  const subId = invoice.subscription;
  if (!subId) return;
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", String(subId));
  await supabase
    .from("profiles")
    .update({ subscription_status: "past_due" })
    .eq("stripe_customer_id", String(invoice.customer));
  console.log(`[invoice.failed] sub=${subId} marked past_due`);
}
