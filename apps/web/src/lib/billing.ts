// Helpers Billing — invoque les Edge Functions Stripe.
// Mode Code uniquement (lit Supabase). Les composants Design n'importent pas.

import {
  BILLING_SKUS,
  type BillingSku,
} from "@immoscan/shared";

import { supabase } from "@/lib/supabase";

export interface CheckoutContext {
  analysisId?: string;
  watchId?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Crée une session Stripe Checkout et retourne l'URL à ouvrir.
 * Le frontend doit ensuite faire `window.location.href = url`.
 */
export async function createCheckoutSession(params: {
  sku: BillingSku;
  context?: CheckoutContext;
}): Promise<CheckoutResult> {
  const successUrl = `${window.location.origin}/app/billing?status=success`;
  const cancelUrl = `${window.location.origin}/app/billing?status=canceled`;

  const { data, error } = await supabase.functions.invoke<CheckoutResult>(
    "stripe-checkout",
    {
      body: {
        sku: params.sku,
        successUrl,
        cancelUrl,
        context: params.context,
      },
    },
  );

  if (error) throw new Error(`checkout_failed: ${error.message}`);
  if (!data?.url) throw new Error("checkout_no_url");
  return data;
}

/** Ouvre le Stripe Billing Portal dans le navigateur. */
export async function openCustomerPortal(): Promise<{ url: string }> {
  const returnUrl = `${window.location.origin}/app/billing`;
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    "stripe-portal",
    { body: { returnUrl } },
  );
  if (error) throw new Error(`portal_failed: ${error.message}`);
  if (!data?.url) throw new Error("portal_no_url");
  return data;
}

/** Pour l'affichage du panel Billing. */
export function getSkuDefinition(sku: BillingSku) {
  return BILLING_SKUS[sku];
}
