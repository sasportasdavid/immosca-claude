// /app/veilles/$id — détail d'une veille avec 3 tabs.
//
// Tab 1 — Opportunités : liste des watch_listings (filtrable par statut + score)
// Tab 2 — Évolutions : fil typé d'événements (new_match, price_drop, signal, etc.)
//                      avec depth de retention par palier (7j Pro, 90j Pro+, ∞ Business)
// Tab 3 — Historique : table des watch_runs (debug + transparence)
//
// Banner truncate si consecutive_truncated_runs >= 3 (BM §5.5)
// Banner suspended si watch.suspended_at != null (avec CTA réactivation)

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import {
  useWatch,
  useWatchEvents,
  useWatchListings,
  useWatchRuns,
  useReactivateWatch,
  type WatchEventRow,
  type WatchListingRow,
  type WatchRunRow,
} from "@/hooks/use-watches";
import { FREEMIUM_MASK_THRESHOLD, PLANS, type PlanId } from "@immoscan/shared";

export const Route = createFileRoute("/app/veilles/$id")({
  component: WatchDetailPage,
});

function WatchDetailPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = useProfile();
  const watch = useWatch(id);
  const plan: PlanId = (profile.data?.subscription_plan ?? "free") as PlanId;
  const planDef = PLANS[plan];
  const reactivate = useReactivateWatch();

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      navigate({ to: "/auth/login" });
    }
  }, [auth.isLoading, auth.user, navigate]);

  const evolutionsDepthDays = planDef.watchEvolutionsDays;
  const isSuspended = !!watch.data?.suspended_at;

  const daysLeft =
    watch.data?.expires_at && new Date(watch.data.expires_at) > new Date()
      ? Math.ceil(
          (new Date(watch.data.expires_at).getTime() - Date.now()) /
            (24 * 3600 * 1000),
        )
      : null;

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={plan}
      currentRoute="veilles"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => navigate({ to: "/app/veilles" })}
            className="mb-3 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Toutes mes veilles
          </button>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {watch.data?.name ?? "…"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {watch.data?.source_site} · Score min {watch.data?.score_threshold} ·{" "}
                {planDef.watchFrequency === "thrice_weekly"
                  ? "3×/sem"
                  : "Quotidien"}
              </p>
            </div>
            {watch.data?.source_url && (
              <a
                href={watch.data.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-primary hover:underline"
              >
                Voir la recherche source <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Banner suspended */}
        {isSuspended && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 p-4 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-amber-900">
                  Veille suspendue
                </div>
                <p className="text-[13px] text-amber-800">
                  Cette veille a été suspendue car la période gratuite s'est
                  terminée. Passe Pro pour la réactiver et la garder à vie.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/app/billing" })}
                  >
                    Passer Pro (7j gratuits)
                  </Button>
                  {plan !== "free" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reactivate.mutate(id, {
                          onSuccess: () => toast.success("Veille réactivée"),
                          onError: (e) =>
                            toast.error(`Erreur : ${(e as Error).message}`),
                        })
                      }
                      disabled={reactivate.isPending}
                    >
                      Réactiver maintenant
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banner truncate chronique */}
        {watch.data && (watch.data.consecutive_truncated_runs ?? 0) >= 3 && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 p-4 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-amber-900">
                  Ta recherche dépasse le cap depuis {watch.data.consecutive_truncated_runs} runs
                </div>
                <p className="text-[13px] text-amber-800">
                  Affine les filtres (prix max, surface min, type) pour cibler
                  les biens pertinents, ou passe au plan supérieur pour analyser jusqu'à{" "}
                  {plan === "free"
                    ? "100 biens (Pro)"
                    : plan === "pro"
                      ? "200 biens (Pro+)"
                      : "300 biens (Business)"}{" "}
                  par run.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Countdown expiration */}
        {daysLeft !== null && daysLeft <= 10 && !isSuspended && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <span>
                <Clock className="mr-1 inline h-3 w-3" />
                Expire dans <strong>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</strong>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: "/app/billing" })}
              >
                {plan === "free" ? "Passer Pro" : "Renouveler"}
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="opportunities" className="space-y-4">
          <TabsList>
            <TabsTrigger value="opportunities">Opportunités</TabsTrigger>
            <TabsTrigger
              value="evolutions"
              disabled={evolutionsDepthDays == null && plan === "free"}
            >
              Évolutions
              {plan === "free" && (
                <Lock className="ml-1.5 h-3 w-3" />
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities">
            <OpportunitiesTab watchId={id} plan={plan} />
          </TabsContent>

          <TabsContent value="evolutions">
            <EvolutionsTab
              watchId={id}
              depthDays={evolutionsDepthDays}
              plan={plan}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab watchId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab Opportunités
// ──────────────────────────────────────────────────────────────────

function OpportunitiesTab({ watchId, plan }: { watchId: string; plan: PlanId }) {
  const [statusFilter, setStatusFilter] = useState<WatchListingRow["current_status"][]>([
    "new",
    "tracked",
  ]);
  const listings = useWatchListings(watchId, { status: statusFilter });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["new", "tracked", "removed", "gone"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${
              statusFilter.includes(s)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => {
              setStatusFilter((prev) =>
                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
              );
            }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {listings.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (listings.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun bien dans cette catégorie pour l'instant. Le prochain scout pourrait en trouver.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {listings.data!.map((l) => (
            <ListingMiniCard key={l.id} listing={l} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<WatchListingRow["current_status"], string> = {
  new: "Nouveau",
  tracked: "Suivi",
  removed: "Disparu (à confirmer)",
  gone: "Vendu/retiré",
};

function ListingMiniCard({
  listing,
  plan,
}: {
  listing: WatchListingRow;
  plan: PlanId;
}) {
  const isMasked =
    plan === "free" &&
    (listing.current_score ?? 0) >= FREEMIUM_MASK_THRESHOLD;
  const score = listing.current_score ?? 0;

  return (
    <Card>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm font-medium">
            {listing.title ?? "Sans titre"}
          </CardTitle>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              score >= 75
                ? "bg-emerald-500/15 text-emerald-700"
                : score >= 50
                  ? "bg-blue-500/15 text-blue-700"
                  : "bg-amber-500/15 text-amber-700"
            }`}
          >
            {listing.current_score == null ? "—" : score.toFixed(0)}
          </span>
        </div>
        <CardDescription className="text-xs">
          {listing.source_site} · {STATUS_LABEL[listing.current_status]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div>
          {isMasked ? (
            <span className="text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3" />
              Prix masqué — débloquer avec Pro
            </span>
          ) : (
            <strong className="tabular-nums">
              {formatEur(Number(listing.current_price))}
            </strong>
          )}
          {listing.current_surface && !isMasked && (
            <span className="ml-1 text-xs text-muted-foreground">
              · {Math.round(Number(listing.current_price) / Number(listing.current_surface))} €/m²
            </span>
          )}
        </div>
        {listing.current_dpe && (
          <div className="text-xs text-muted-foreground">DPE {listing.current_dpe}</div>
        )}
        {!isMasked && (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-primary hover:underline"
          >
            Voir l'annonce <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab Évolutions
// ──────────────────────────────────────────────────────────────────

function EvolutionsTab({
  watchId,
  depthDays,
  plan,
}: {
  watchId: string;
  depthDays: number | null;
  plan: PlanId;
}) {
  const events = useWatchEvents(watchId, {
    sinceDays: depthDays ?? undefined,
    limit: 200,
  });

  if (plan === "free") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 text-sm font-medium">Tab Évolutions réservé aux abonnés</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Le fil typé des événements (baisses, décotes, relistings) est inclus à partir de Pro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Profondeur d'historique : {depthDays != null ? `${depthDays} derniers jours` : "illimitée"}
      </div>
      {events.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (events.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Pas d'événements sur cette période.
        </div>
      ) : (
        <ul className="space-y-2">
          {events.data!.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({ event }: { event: WatchEventRow }) {
  const payload = event.payload as Record<string, unknown>;
  const { icon, label, body, accent } = describeEvent(event.event_type, payload);
  return (
    <li className={`flex items-start gap-3 rounded-lg border border-border bg-card p-3 ${accent}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(event.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </li>
  );
}

function describeEvent(
  type: WatchEventRow["event_type"],
  payload: Record<string, unknown>,
): { icon: JSX.Element; label: string; body: string; accent: string } {
  switch (type) {
    case "new_match":
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        label: "Nouveau bien retenu",
        body: `Score ${asNumber(payload.score, "?")}/100${payload.prix ? ` · ${formatEur(asNumber(payload.prix, 0))}` : ""}`,
        accent: "",
      };
    case "price_drop":
      return {
        icon: <TrendingDown className="h-4 w-4 text-emerald-600" />,
        label: "Baisse de prix",
        body: `${formatEur(asNumber(payload.old_price, 0))} → ${formatEur(asNumber(payload.new_price, 0))} (${formatPct(asNumber(payload.delta_pct, 0))})`,
        accent: "",
      };
    case "price_rise":
      return {
        icon: <TrendingUp className="h-4 w-4 text-amber-600" />,
        label: "Hausse de prix",
        body: `${formatEur(asNumber(payload.old_price, 0))} → ${formatEur(asNumber(payload.new_price, 0))} (+${formatPct(asNumber(payload.delta_pct, 0))})`,
        accent: "",
      };
    case "signal_to_verify":
      return {
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        label: "Décote potentielle, à vérifier",
        body: `${formatPct(asNumber(payload.ecart_pct, 0))} vs médian DVF (n=${asNumber(payload.n_transactions, 0)} transactions)`,
        accent: "",
      };
    case "relisted":
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-blue-600" />,
        label: "Annonce remise en ligne",
        body: `Nouveau prix : ${formatEur(asNumber(payload.new_price, 0))}`,
        accent: "",
      };
    case "removed":
      return {
        icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
        label: "Bien retiré",
        body: `Dernier prix connu : ${formatEur(asNumber(payload.last_known_price, 0))}`,
        accent: "opacity-70",
      };
    default:
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
        label: type,
        body: "",
        accent: "",
      };
  }
}

// ──────────────────────────────────────────────────────────────────
// Tab Historique
// ──────────────────────────────────────────────────────────────────

function HistoryTab({ watchId }: { watchId: string }) {
  const runs = useWatchRuns(watchId, 30);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Les 30 derniers runs (transparence + debug).
      </div>
      {runs.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (runs.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun run enregistré pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Statut</th>
                <th className="p-3 text-right">Scrapés</th>
                <th className="p-3 text-right">Nouveaux</th>
                <th className="p-3 text-right">Baisses</th>
                <th className="p-3 text-right">Décotes</th>
                <th className="p-3 text-right">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.data!.map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunRow({ run }: { run: WatchRunRow }) {
  return (
    <tr>
      <td className="p-3 text-sm">
        {run.started_at
          ? new Date(run.started_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </td>
      <td className="p-3">
        <RunStatusBadge status={run.status} truncated={run.truncated} />
      </td>
      <td className="p-3 text-right tabular-nums">{run.items_scraped}</td>
      <td className="p-3 text-right tabular-nums">{run.new_count}</td>
      <td className="p-3 text-right tabular-nums">{run.drop_count}</td>
      <td className="p-3 text-right tabular-nums">{run.signal_count}</td>
      <td className="p-3 text-right text-xs text-muted-foreground tabular-nums">
        {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
      </td>
    </tr>
  );
}

function RunStatusBadge({
  status,
  truncated,
}: {
  status: WatchRunRow["status"];
  truncated: boolean;
}) {
  if (status === "succeeded") {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="border-emerald-400 text-emerald-700">
          OK
        </Badge>
        {truncated && (
          <span title="Run tronqué (cap atteint)" className="text-[10px]">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
          </span>
        )}
      </div>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-red-400 text-red-700">
        Échec
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function asNumber(v: unknown, fallback: number | string): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : (typeof fallback === "number" ? fallback : 0);
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1).replace(".", ",")}%`;
}
