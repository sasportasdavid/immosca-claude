// /app/billing — Page Plan & Facturation.
//
// Affiche :
//   - Plan actuel + cycle + trial end (si applicable)
//   - Compteurs d'usage (analyses du cycle, veilles actives)
//   - Entitlements actifs (PPU pending, add-ons recurring)
//   - Grille tarifaire avec CTA Checkout par SKU
//   - Bouton "Gérer mon abonnement" → Stripe Customer Portal
//
// Toute la logique data passe par useBilling / useStartCheckout / useOpenPortal.
// Les composants visuels viennent de components/ui (primitives shadcn).

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  useBilling,
  useOpenPortal,
  useRefreshBilling,
  useStartCheckout,
} from "@/hooks/use-billing";
import { useProfile } from "@/hooks/use-profile";
import { trackEvent } from "@/lib/posthog";
import {
  BILLING_SKUS,
  type BillingSku,
  PLANS,
  type PlanId,
  PUBLIC_CHECKOUT_SKUS,
} from "@immoscan/shared";

export interface BillingSearchParams {
  status?: "success" | "canceled";
}

export const Route = createFileRoute("/app/billing")({
  validateSearch: (s: Record<string, unknown>): BillingSearchParams => ({
    status: s.status === "success" || s.status === "canceled" ? s.status : undefined,
  }),
  component: BillingPage,
});

function BillingPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/billing" });
  const profileQuery = useProfile();
  const billingQuery = useBilling();
  const refreshBilling = useRefreshBilling();
  const startCheckout = useStartCheckout();
  const openPortal = useOpenPortal();

  // Redirect anonyme → login
  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      navigate({ to: "/auth/login" });
    }
  }, [auth.isLoading, auth.user, navigate]);

  // Gestion des retours Stripe (status=success → toast + invalidate cache)
  useEffect(() => {
    if (search.status === "success") {
      toast.success("Paiement confirmé. Mise à jour de ton compte en cours…");
      refreshBilling();
      // Stripe webhook prend qq secondes — refresh à 3s aussi
      const t = setTimeout(() => refreshBilling(), 3000);
      return () => clearTimeout(t);
    }
    if (search.status === "canceled") {
      toast.info("Paiement annulé. Aucune charge effectuée.");
    }
  }, [search.status, refreshBilling]);

  const currentPlan: PlanId = (profileQuery.data?.subscription_plan ?? "free") as PlanId;
  const planDef = PLANS[currentPlan];
  const isPaying = currentPlan !== "free";

  // PostHog : track post-Stripe success. On compare l'état de profile + billing
  // au mount vs après refresh pour détecter quel SKU vient d'être consommé.
  // Best-effort uniquement — source de vérité = webhooks serveur.
  const trackedPostStripeRef = useRef<{
    planAtMount: PlanId | null;
    ppuCountAtMount: number | null;
    addonCountAtMount: number | null;
  }>({ planAtMount: null, ppuCountAtMount: null, addonCountAtMount: null });

  // Snapshot initial (mount)
  useEffect(() => {
    if (
      trackedPostStripeRef.current.planAtMount === null &&
      profileQuery.data &&
      billingQuery.data
    ) {
      trackedPostStripeRef.current.planAtMount =
        (profileQuery.data.subscription_plan as PlanId) ?? "free";
      trackedPostStripeRef.current.ppuCountAtMount = (billingQuery.data.entitlements ?? []).filter(
        (e) => e.type === "ppu_analysis" && e.status === "pending",
      ).length;
      trackedPostStripeRef.current.addonCountAtMount = (billingQuery.data.entitlements ?? []).filter(
        (e) => e.type.startsWith("addon_") && e.status === "active",
      ).length;
    }
  }, [profileQuery.data, billingQuery.data]);

  // Sur succès retour Stripe, détecte le changement et fire l'event approprié
  const stripeSuccessTrackedRef = useRef(false);
  useEffect(() => {
    if (search.status !== "success") return;
    if (stripeSuccessTrackedRef.current) return;
    const snap = trackedPostStripeRef.current;
    if (snap.planAtMount === null) return;
    if (!profileQuery.data || !billingQuery.data) return;
    const newPlan = (profileQuery.data.subscription_plan as PlanId) ?? "free";
    const newPpu = (billingQuery.data.entitlements ?? []).filter(
      (e) => e.type === "ppu_analysis" && e.status === "pending",
    ).length;
    const newAddon = (billingQuery.data.entitlements ?? []).filter(
      (e) => e.type.startsWith("addon_") && e.status === "active",
    ).length;

    if (newPlan !== snap.planAtMount) {
      stripeSuccessTrackedRef.current = true;
      const planOrder: Record<PlanId, number> = { free: 0, pro: 1, pro_plus: 2, business: 3 };
      const isUpgrade = planOrder[newPlan] > planOrder[snap.planAtMount];
      trackEvent({
        name: isUpgrade ? "plan_upgraded" : "plan_downgraded",
        props: { from_plan: snap.planAtMount, to_plan: newPlan },
      });
    } else if (newPpu > (snap.ppuCountAtMount ?? 0)) {
      stripeSuccessTrackedRef.current = true;
      trackEvent({ name: "ppu_purchased", props: { context: "from_billing" } });
    } else if (newAddon > (snap.addonCountAtMount ?? 0)) {
      // Trouve quel addon vient d'être créé
      const latestAddon = (billingQuery.data.entitlements ?? [])
        .filter((e) => e.type.startsWith("addon_") && e.status === "active")
        .sort(
          (a, b) =>
            new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime(),
        )[0];
      if (latestAddon) {
        stripeSuccessTrackedRef.current = true;
        trackEvent({
          name: "addon_purchased",
          props: { sku: latestAddon.type },
        });
      }
    }
  }, [search.status, profileQuery.data, billingQuery.data]);

  const ppuBalance = useMemo(
    () => (billingQuery.data?.entitlements ?? []).filter((e) => e.type === "ppu_analysis" && e.status === "pending").length,
    [billingQuery.data],
  );

  const activeAddons = useMemo(
    () =>
      (billingQuery.data?.entitlements ?? []).filter(
        (e) => e.type.startsWith("addon_") && e.status === "active",
      ),
    [billingQuery.data],
  );

  const usage = billingQuery.data?.usage;
  const sub = billingQuery.data?.subscription;

  function handleCheckout(sku: BillingSku) {
    startCheckout.mutate(
      { sku },
      {
        onError: (err) => {
          toast.error(`Erreur checkout : ${(err as Error).message}`);
        },
      },
    );
  }

  function handlePortal() {
    openPortal.mutate(undefined, {
      onError: (err) => {
        toast.error(`Erreur portail : ${(err as Error).message}`);
      },
    });
  }

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={currentPlan}
      currentRoute="billing"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan & Facturation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gère ton abonnement, tes crédits et tes add-ons.
          </p>
        </div>

        {/* Plan actuel */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Plan {planDef.name}</CardTitle>
              <CardDescription>
                {isPaying
                  ? `${planDef.monthlyPriceEur}€/mois — ${planDef.analysesPerMonth} analyses incluses`
                  : "Plan gratuit — 1 analyse/mois, scores ≥70 masqués"}
              </CardDescription>
            </div>
            {isPaying && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePortal}
                disabled={openPortal.isPending}
              >
                {openPortal.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                )}
                Gérer mon abonnement
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {sub && (
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Statut</div>
                  <div className="mt-0.5 font-medium">
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cycle en cours</div>
                  <div className="mt-0.5 font-medium">
                    {formatDate(sub.current_period_start)} → {formatDate(sub.current_period_end)}
                  </div>
                </div>
                {sub.trial_end && new Date(sub.trial_end) > new Date() && (
                  <div>
                    <div className="text-xs text-muted-foreground">Fin essai gratuit</div>
                    <div className="mt-0.5 font-medium">{formatDate(sub.trial_end)}</div>
                  </div>
                )}
                {sub.cancel_at_period_end && (
                  <div>
                    <div className="text-xs text-muted-foreground">Annulation</div>
                    <div className="mt-0.5 font-medium text-amber-600">
                      Programmée à fin de cycle
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Usage du cycle */}
            {usage && (
              <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-sm md:grid-cols-3">
                <UsageStat
                  label="Analyses ce cycle"
                  used={usage.analyses_used}
                  limit={planDef.analysesPerMonth}
                />
                <UsageStat
                  label="Crédits PPU restants"
                  used={ppuBalance}
                  limit={null}
                  format={(v) => `${v}`}
                />
                <UsageStat
                  label="Veilles add-on"
                  used={activeAddons.filter((e) => e.type.includes("watch")).length}
                  limit={null}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section : Acheter des crédits ponctuels */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Acheter ponctuellement</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <SkuCard
              sku="ppu_analysis"
              onCheckout={handleCheckout}
              pending={startCheckout.isPending}
              tagline="1 analyse + bonus veille 30j débloquée"
            />
          </div>
        </section>

        {/* Section : Upgrade plan */}
        {!isPaying && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Passer à un plan supérieur</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <SkuCard
                sku="pro_monthly"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="10 analyses/mois · 3 veilles · 7j gratuits"
                highlight="recommended"
              />
              <SkuCard
                sku="pro_plus_monthly"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="25 analyses · 6 veilles · Opus Top 5"
              />
              <SkuCard
                sku="business_monthly"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="80 analyses · 15 veilles daily · Opus partout"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Versions annuelles (-17%) accessibles depuis le portail après une 1ère souscription.
            </p>
          </section>
        )}

        {/* Section : Add-ons */}
        {isPaying && currentPlan !== "business" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Add-ons veille</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <SkuCard
                sku="addon_watch_unit"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="+1 veille 3×/sem"
              />
              <SkuCard
                sku="addon_watch_pack3"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="+3 veilles 3×/sem"
              />
            </div>
          </section>
        )}

        {isPaying && currentPlan === "business" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Add-ons veille (daily)</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <SkuCard
                sku="addon_watch_daily"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="+1 veille daily"
              />
              <SkuCard
                sku="addon_watch_pack3_daily"
                onCheckout={handleCheckout}
                pending={startCheckout.isPending}
                tagline="+3 veilles daily"
              />
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components (présentationnels)
// ──────────────────────────────────────────────────────────────────

function SkuCard({
  sku,
  onCheckout,
  pending,
  tagline,
  highlight,
}: {
  sku: BillingSku;
  onCheckout: (sku: BillingSku) => void;
  pending: boolean;
  tagline: string;
  highlight?: "recommended";
}) {
  const def = BILLING_SKUS[sku];
  return (
    <Card className={highlight === "recommended" ? "border-primary ring-1 ring-primary/30" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{def.label}</CardTitle>
          {highlight === "recommended" && (
            <Badge variant="default">Recommandé</Badge>
          )}
        </div>
        <CardDescription>{tagline}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-2xl font-bold">{def.priceEur}€</span>
            <span className="ml-1 text-xs text-muted-foreground">
              {def.kind === "ppu_oneshot" ? "" : "/mois"}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => onCheckout(sku)}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Acheter"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageStat({
  label,
  used,
  limit,
  format,
}: {
  label: string;
  used: number;
  limit: number | null;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v) => `${v}`);
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">
        {fmt(used)}
        {limit !== null && <span className="text-muted-foreground"> / {limit}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
    case "trialing":
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> {status === "trialing" ? "Essai" : "Actif"}
        </span>
      );
    case "past_due":
      return (
        <span className="inline-flex items-center gap-1 text-amber-600">
          <XCircle className="h-3.5 w-3.5" /> En retard
        </span>
      );
    case "canceled":
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" /> Annulé
        </span>
      );
    default:
      return <span className="text-muted-foreground">{status}</span>;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Re-export public SKUs for tests / future consumers (silencer unused warn)
export { PUBLIC_CHECKOUT_SKUS };
