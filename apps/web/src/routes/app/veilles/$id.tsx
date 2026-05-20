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
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DpePill, type DpeLetter } from "@/components/ui/dpe-pill";
import { ScoreBadge } from "@/components/ui/score-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerdictPill, type VerdictTone } from "@/components/ui/verdict-pill";
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
            className="mb-3 inline-flex items-center text-xs text-mute-2 hover:text-ink"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Toutes mes veilles
          </button>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {watch.data?.name ?? "…"}
              </h1>
              <p className="mt-1 text-sm text-muted-ink">
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
                className="inline-flex items-center text-xs text-violet hover:underline"
              >
                Voir la recherche source <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Banner suspended — teasing freemium en terra */}
        {isSuspended && (
          <div className="rounded-r-md border border-terra-soft-2 bg-terra-soft p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-terra-deep" />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-terra-deep">
                  Veille suspendue
                </div>
                <p className="text-[13px] text-terra-deep/80">
                  Cette veille a été suspendue car la période gratuite s'est
                  terminée. Passe Pro pour la réactiver et la garder à vie.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="terra"
                    onClick={() => navigate({ to: "/app/billing" })}
                  >
                    Passer Pro (7&nbsp;jours gratuits)
                  </Button>
                  {plan !== "free" && (
                    <Button
                      size="sm"
                      variant="ghost"
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
          <div className="rounded-r-md border border-terra-soft-2 bg-terra-soft p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-terra-deep" />
              <div className="flex-1">
                <div className="text-sm font-medium text-terra-deep">
                  Ta recherche dépasse le cap depuis {watch.data.consecutive_truncated_runs} runs
                </div>
                <p className="text-[13px] text-terra-deep/80">
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
          <div className="rounded-r-md border border-terra-soft-2 bg-terra-soft p-3 text-[13px] text-terra-deep">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Cette veille expire dans{" "}
                <strong className="ml-1 font-mono tnum">
                  {daysLeft}&nbsp;jour{daysLeft > 1 ? "s" : ""}
                </strong>
              </span>
              <Button
                size="sm"
                variant="terra"
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
              {plan === "free" && <Lock className="ml-1.5 h-3 w-3" />}
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
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              statusFilter.includes(s)
                ? "border-violet/30 bg-violet-soft text-violet-deep"
                : "border-line text-mute-2 hover:bg-bg-2"
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
        <div className="rounded-r-lg border border-line bg-card p-6 text-center text-sm text-muted-ink shadow-lvl-1">
          Chargement…
        </div>
      ) : (listings.data ?? []).length === 0 ? (
        <div className="rounded-r-lg border border-line bg-card p-6 text-center text-sm text-muted-ink shadow-lvl-1">
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

// Map status → VerdictPill tone : new=pending (violet), tracked=good (sage),
// removed=mid (terra à vérifier), gone=bad/neutral.
const STATUS_TONE: Record<WatchListingRow["current_status"], VerdictTone> = {
  new: "pending",
  tracked: "good",
  removed: "mid",
  gone: "bad",
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
  const hasScore = listing.current_score != null;

  return (
    <div className="rounded-r-lg border border-line bg-card text-card-foreground shadow-lvl-1">
      <div className="space-y-2 p-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="line-clamp-2 text-sm font-medium text-ink leading-snug">
            {listing.title ?? "Sans titre"}
          </div>
          {hasScore ? (
            <ScoreBadge value={score} size="sm" className="shrink-0" />
          ) : (
            <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-r-sm border border-line bg-bg-2 font-mono text-[11px] font-semibold text-faint">
              —
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-mute-2">{listing.source_site}</span>
          <VerdictPill verdict={STATUS_TONE[listing.current_status]}>
            {STATUS_LABEL[listing.current_status]}
          </VerdictPill>
        </div>
      </div>
      <div className="space-y-2 px-5 pb-5 text-sm">
        <div>
          {isMasked ? (
            <span className="text-mute-2">
              <Lock className="mr-1 inline h-3 w-3" />
              Prix masqué — débloquer avec Pro
            </span>
          ) : (
            <strong className="font-mono tnum text-ink">
              {formatEur(Number(listing.current_price))}
            </strong>
          )}
          {listing.current_surface && !isMasked && (
            <span className="ml-1 text-xs text-mute-2 font-mono tnum">
              · {Math.round(Number(listing.current_price) / Number(listing.current_surface))} €/m²
            </span>
          )}
        </div>
        {listing.current_dpe && (
          <div className="flex items-center gap-2 text-xs text-mute-2">
            <DpePill letter={listing.current_dpe as DpeLetter} />
            <span>DPE</span>
          </div>
        )}
        {!isMasked && (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-violet hover:underline"
          >
            Voir l'annonce <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        )}
      </div>
    </div>
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
      <div className="rounded-r-lg border border-terra-soft-2 bg-terra-soft p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-terra-deep" />
        <h3 className="mt-3 text-sm font-medium text-terra-deep">
          Onglet Évolutions réservé aux abonnés
        </h3>
        <p className="mt-1 text-xs text-terra-deep/80">
          Le fil typé des événements (baisses, décotes, relistings) est inclus à partir de Pro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-mute-2">
        Profondeur d'historique&nbsp;:{" "}
        {depthDays != null ? `${depthDays} derniers jours` : "illimitée"}
      </div>
      {events.isLoading ? (
        <div className="rounded-r-lg border border-line bg-card p-6 text-center text-sm text-muted-ink shadow-lvl-1">
          Chargement…
        </div>
      ) : (events.data ?? []).length === 0 ? (
        <div className="rounded-r-lg border border-line bg-card p-6 text-center text-sm text-muted-ink shadow-lvl-1">
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
  const { icon, label, body, opacity } = describeEvent(event.event_type, payload);
  return (
    <li
      className={`flex items-start gap-3 rounded-r-lg border border-line bg-card p-3 shadow-lvl-1 ${opacity}`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium text-ink">{label}</div>
          <div className="text-xs text-mute-2 font-mono tnum">
            {formatRelativeDate(event.created_at)}
          </div>
        </div>
        <div className="text-xs text-mute-2 font-mono tnum">{body}</div>
      </div>
    </li>
  );
}

// Icône + libellé + body + opacity pour chaque type d'event.
// Couleurs : new_match=violet, price_drop=sage (ok), signal_to_verify=terra,
// relisted=violet (info), removed=faint.
function describeEvent(
  type: WatchEventRow["event_type"],
  payload: Record<string, unknown>,
): { icon: JSX.Element; label: string; body: string; opacity: string } {
  switch (type) {
    case "new_match":
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-violet-soft text-violet">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        ),
        label: "Nouveau bien retenu",
        body: `Score ${asNumber(payload.score, "?")}/100${payload.prix ? ` · ${formatEur(asNumber(payload.prix, 0))}` : ""}`,
        opacity: "",
      };
    case "price_drop":
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-sage-soft text-sage-2">
            <TrendingDown className="h-3.5 w-3.5" />
          </span>
        ),
        label: "Baisse de prix",
        body: `${formatEur(asNumber(payload.old_price, 0))} → ${formatEur(asNumber(payload.new_price, 0))} (${formatPct(asNumber(payload.delta_pct, 0))})`,
        opacity: "",
      };
    case "price_rise":
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-terra-soft text-terra-deep">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
        ),
        label: "Hausse de prix",
        body: `${formatEur(asNumber(payload.old_price, 0))} → ${formatEur(asNumber(payload.new_price, 0))} (+${formatPct(asNumber(payload.delta_pct, 0))})`,
        opacity: "",
      };
    case "signal_to_verify":
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-terra-soft text-terra-deep">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        ),
        label: "Décote potentielle, à vérifier",
        body: `${formatPct(asNumber(payload.ecart_pct, 0))} vs médian DVF (n=${asNumber(payload.n_transactions, 0)} transactions)`,
        opacity: "",
      };
    case "relisted":
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-violet-soft text-violet">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        ),
        label: "Annonce remise en ligne",
        body: `Nouveau prix : ${formatEur(asNumber(payload.new_price, 0))}`,
        opacity: "",
      };
    case "removed":
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-bg-2 text-faint">
            <XCircle className="h-3.5 w-3.5" />
          </span>
        ),
        label: "Bien retiré",
        body: `Dernier prix connu : ${formatEur(asNumber(payload.last_known_price, 0))}`,
        opacity: "opacity-70",
      };
    default:
      return {
        icon: (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-r-sm bg-bg-2 text-mute-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        ),
        label: type,
        body: "",
        opacity: "",
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
      <div className="text-xs text-mute-2">
        Les 30 derniers runs (transparence + debug).
      </div>
      {runs.isLoading ? (
        <div className="rounded-r-lg border border-line bg-card p-6 text-center text-sm text-muted-ink shadow-lvl-1">
          Chargement…
        </div>
      ) : (runs.data ?? []).length === 0 ? (
        <div className="rounded-r-lg border border-line bg-card p-6 text-center text-sm text-muted-ink shadow-lvl-1">
          Aucun run enregistré pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-r-lg border border-line bg-card shadow-lvl-1">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-2 text-[11px] uppercase tracking-[0.06em] text-mute-2">
              <tr>
                <th className="p-3 text-left font-semibold">Date</th>
                <th className="p-3 text-left font-semibold">Statut</th>
                <th className="p-3 text-right font-semibold">Scrapés</th>
                <th className="p-3 text-right font-semibold">Nouveaux</th>
                <th className="p-3 text-right font-semibold">Baisses</th>
                <th className="p-3 text-right font-semibold">Décotes</th>
                <th className="p-3 text-right font-semibold">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
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
    <tr className="hover:bg-bg-2">
      <td className="p-3 text-sm text-ink">
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
      <td className="p-3 text-right font-mono tnum text-ink">{run.items_scraped}</td>
      <td className="p-3 text-right font-mono tnum text-ink">{run.new_count}</td>
      <td className="p-3 text-right font-mono tnum text-ink">{run.drop_count}</td>
      <td className="p-3 text-right font-mono tnum text-ink">{run.signal_count}</td>
      <td className="p-3 text-right text-xs text-mute-2 font-mono tnum">
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
        <Badge variant="sage">OK</Badge>
        {truncated && (
          <span title="Run tronqué (cap atteint)" className="text-terra-deep">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  }
  if (status === "failed") {
    return <Badge variant="danger">Échec</Badge>;
  }
  if (status === "running") {
    return <Badge variant="violet">En cours</Badge>;
  }
  return <Badge variant="default">{status}</Badge>;
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

// Timestamp relatif (today, yesterday, il y a Xj) — fallback date courte.
function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));
  if (diffDays === 0) {
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
