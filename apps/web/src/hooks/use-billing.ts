// useBilling — lit les entitlements + usage_counter + sub courante du user.
// Mode Code (lit Supabase). Les composants Design consomment via props.

import type { Database } from "@immoscan/db/app";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  createCheckoutSession,
  openCustomerPortal,
  type CheckoutContext,
} from "@/lib/billing";
import { trackEvent } from "@/lib/posthog";
import { supabase } from "@/lib/supabase";
import { BILLING_SKUS, type BillingSku } from "@immoscan/shared";

export type EntitlementRow = Database["public"]["Tables"]["entitlements"]["Row"];
export type UsageCounterRow = Database["public"]["Tables"]["usage_counters"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

export interface BillingSummary {
  entitlements: EntitlementRow[];
  usage: UsageCounterRow | null;
  subscription: SubscriptionRow | null;
}

export function useBilling() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["billing", userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<BillingSummary> => {
      if (!userId) throw new Error("not_authenticated");

      const [entRes, usageRes, subRes] = await Promise.all([
        supabase
          .from("entitlements")
          .select("*")
          .eq("profile_id", userId)
          .in("status", ["pending", "active"])
          .order("granted_at", { ascending: false }),
        supabase
          .from("usage_counters")
          .select("*")
          .eq("profile_id", userId)
          .order("period_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("profile_id", userId)
          .order("current_period_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (entRes.error) throw entRes.error;
      if (usageRes.error) throw usageRes.error;
      if (subRes.error) throw subRes.error;

      return {
        entitlements: entRes.data ?? [],
        usage: usageRes.data ?? null,
        subscription: subRes.data ?? null,
      };
    },
  });
}

/** Lance un checkout pour un SKU donné. Redirige vers Stripe au succès. */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (params: { sku: BillingSku; context?: CheckoutContext }) => {
      // PostHog : track BEFORE redirect (sinon on perd l'event)
      trackEvent({
        name: "checkout_started",
        props: {
          sku: params.sku,
          context: params.context?.analysisId
            ? "from_analysis"
            : params.context?.watchId
              ? "from_watch"
              : undefined,
        },
      });
      const res = await createCheckoutSession(params);
      window.location.href = res.url;
      return res;
    },
  });
}

/** Ouvre le Stripe Billing Portal. */
export function useOpenPortal() {
  return useMutation({
    mutationFn: async () => {
      trackEvent({ name: "portal_opened", props: {} });
      const res = await openCustomerPortal();
      window.location.href = res.url;
      return res;
    },
  });
}

/**
 * Tracking post-Stripe : appelé depuis /app/billing quand on revient avec
 * ?status=success. Détecte plan_upgraded / addon_purchased / ppu_purchased
 * en comparant le plan avant/après et les entitlements récents.
 *
 * Note : ces events sont **best-effort frontend** — la source de vérité
 * reste les Stripe webhooks côté serveur. Pour de l'analytics avancé,
 * câbler un POSTHOG_PROJECT_API_KEY côté worker + posthog-node.
 */
export { BILLING_SKUS };

/** Invalide le cache billing après un retour de Stripe (page billing?status=success). */
export function useRefreshBilling() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["billing"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
}
