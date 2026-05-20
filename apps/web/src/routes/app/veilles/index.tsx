// /app/veilles — liste des veilles du user.
//
// Comportement par palier (BM §8.1) :
//   - Free / PPU : 1 seule veille active, countdown expiration, bouton + disabled
//   - Pro/Pro+/Business : grid de cards + "+ Nouvelle veille" (modal saturation
//     si cap atteint)
//
// La données vient de `useWatches()`. Le bouton "+ Nouvelle veille" vérifie
// `useBilling().entitlements` pour les add-on slots et `useProfile().subscription_plan`
// pour les caps.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Lock, Plus, Radar } from "lucide-react";
import { useEffect, useMemo } from "react";

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
import { useBilling } from "@/hooks/use-billing";
import { useProfile } from "@/hooks/use-profile";
import { useWatches, type WatchRow } from "@/hooks/use-watches";
import { PLANS, type PlanId } from "@immoscan/shared";

export const Route = createFileRoute("/app/veilles/")({
  component: WatchesListPage,
});

function WatchesListPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = useProfile();
  const billing = useBilling();
  const watches = useWatches({ includeInactive: true });

  // Redirect anonyme → login
  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      navigate({ to: "/auth/login" });
    }
  }, [auth.isLoading, auth.user, navigate]);

  const plan: PlanId = (profile.data?.subscription_plan ?? "free") as PlanId;
  const planDef = PLANS[plan];

  const activeWatches = useMemo(
    () => (watches.data ?? []).filter((w) => w.is_active && !w.suspended_at),
    [watches.data],
  );
  const suspendedWatches = useMemo(
    () => (watches.data ?? []).filter((w) => w.suspended_at != null),
    [watches.data],
  );

  // Compte les add-on slots actifs pour calculer le cap effectif
  const addonWatchSlots = useMemo(() => {
    return (billing.data?.entitlements ?? []).reduce((acc, e) => {
      if (e.status !== "active") return acc;
      if (e.type === "addon_watch_unit" || e.type === "addon_watch_daily") return acc + 1;
      if (e.type === "addon_watch_pack3" || e.type === "addon_watch_pack3_daily") return acc + 3;
      return acc;
    }, 0);
  }, [billing.data]);

  const effectiveLimit = Math.min(
    planDef.watchesIncluded + addonWatchSlots,
    planDef.watchTotalCap,
  );
  const canCreate = activeWatches.length < effectiveLimit;

  const isFreemiumLike = plan === "free";

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={plan}
      currentRoute="veilles"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mes veilles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFreemiumLike
                ? `1 veille active maximum · ${planDef.watchFrequency === "thrice_weekly" ? "3 fois/sem" : "quotidien"}`
                : `${activeWatches.length} / ${effectiveLimit} veille${effectiveLimit > 1 ? "s" : ""} active${effectiveLimit > 1 ? "s" : ""} · ${planDef.watchFrequency === "thrice_weekly" ? "3 fois/sem" : "quotidien"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate ? (
              <Button asChild>
                <Link to="/app/veilles/nouvelle">
                  <Plus className="mr-1.5 h-4 w-4" /> Nouvelle veille
                </Link>
              </Button>
            ) : (
              <Button
                onClick={() => navigate({ to: "/app/billing" })}
                variant="outline"
                disabled={activeWatches.length >= planDef.watchTotalCap}
                title={
                  activeWatches.length >= planDef.watchTotalCap
                    ? "Cap maximum atteint sur ton plan"
                    : "Acheter un add-on +7€/mois"
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {activeWatches.length >= planDef.watchTotalCap
                  ? "Cap atteint"
                  : "Ajouter (+7€/mois)"}
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {watches.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : activeWatches.length === 0 && suspendedWatches.length === 0 ? (
          <EmptyState plan={plan} />
        ) : (
          <>
            {/* Active watches */}
            {activeWatches.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeWatches.map((w) => (
                  <WatchCard key={w.id} watch={w} plan={plan} />
                ))}
              </div>
            )}

            {/* Suspended watches */}
            {suspendedWatches.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-medium text-muted-foreground">
                  Veilles suspendues ({suspendedWatches.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {suspendedWatches.map((w) => (
                    <WatchCard key={w.id} watch={w} plan={plan} suspended />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function EmptyState({ plan }: { plan: PlanId }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-10 text-center">
      <Radar className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 text-base font-medium">Pas encore de veille</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {plan === "free"
          ? "Crée ta veille gratuite (60 jours, 50 items max) pour recevoir un digest 3×/sem des biens qui matchent tes critères."
          : "Crée ta première veille pour recevoir un digest des opportunités sur ta zone."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/app/veilles/nouvelle">
          <Plus className="mr-1.5 h-4 w-4" /> Créer ma première veille
        </Link>
      </Button>
    </div>
  );
}

function WatchCard({
  watch,
  plan,
  suspended,
}: {
  watch: WatchRow;
  plan: PlanId;
  suspended?: boolean;
}) {
  const stats = (watch.stats_7d ?? {}) as {
    new?: number;
    drops?: number;
    signals?: number;
  };
  const daysLeft =
    watch.expires_at && new Date(watch.expires_at) > new Date()
      ? Math.ceil(
          (new Date(watch.expires_at).getTime() - Date.now()) / (24 * 3600 * 1000),
        )
      : null;
  const isUrgent = daysLeft !== null && daysLeft <= 10;

  return (
    <Card className={suspended ? "opacity-70" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-base">{watch.name}</CardTitle>
            <CardDescription className="text-xs">
              {watch.source_site} · score min {watch.score_threshold}
            </CardDescription>
          </div>
          {suspended ? (
            <Badge variant="outline" className="shrink-0">
              <Lock className="mr-1 h-3 w-3" /> Suspendue
            </Badge>
          ) : isUrgent ? (
            <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700">
              <AlertCircle className="mr-1 h-3 w-3" /> {daysLeft}j restants
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <StatBlock label="Nouveaux" value={stats.new ?? 0} accent="emerald" />
          <StatBlock label="Baisses" value={stats.drops ?? 0} accent="blue" />
          <StatBlock label="Décotes" value={stats.signals ?? 0} accent="amber" />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            Dernier scout :{" "}
            {watch.last_run_at
              ? new Date(watch.last_run_at).toLocaleDateString("fr-FR")
              : "—"}
          </span>
          <Link
            to="/app/veilles/$id"
            params={{ id: watch.id }}
            className="font-medium text-primary hover:underline"
          >
            Voir →
          </Link>
        </div>
        {suspended && plan === "free" && (
          <div className="mt-3 rounded border border-primary/30 bg-primary/5 p-2 text-xs">
            <Link to="/app/billing" className="font-medium text-primary hover:underline">
              Réactiver via Pro (7j gratuits)
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "emerald" | "blue" | "amber";
}) {
  const colors = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
  };
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${colors[accent]}`}>
        {value}
      </div>
    </div>
  );
}
