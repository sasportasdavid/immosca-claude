// /dashboard — vue d'ensemble pour un investisseur ImmoScan.
//
// 3 questions auxquelles le dashboard répond en 1 coup d'œil :
//   1. Qu'est-ce qui a bougé depuis ma dernière connexion ?
//   2. Quels biens méritent mon œil maintenant ?
//   3. Où en suis-je dans mon pipeline ?
//
// Données : 1 seule RPC SQL `dashboard_summary` (cf use-dashboard.ts).
// Refetch 60s en background pour rester à jour sans bloquer.
//
// Empty state : si pas d'analyse done, on remplace le dashboard par un
// onboarding 4 étapes au lieu de montrer des widgets vides.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Bell,
  ExternalLink,
  Flame,
  KanbanSquare,
  Lock,
  MapPin,
  Plus,
  Radar,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ScoreBadge } from "@/components/ui/score-badge";
import { useAuth } from "@/hooks/use-auth";
import {
  useDashboardSummary,
  type DashboardOpportunity,
  type DashboardSummary,
  type PipelineStage,
} from "@/hooks/use-dashboard";
import { useProfile } from "@/hooks/use-profile";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";
import {
  FREEMIUM_MASK_THRESHOLD,
  PLANS,
  type PlanId,
} from "@immoscan/shared";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: DashboardPage,
});

const STAGE_LABELS: Record<PipelineStage, string> = {
  a_visiter: "À visiter",
  visite: "Visité",
  offre: "Offre",
  compromis: "Compromis",
  signe: "Signé",
};

function DashboardPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = useProfile();
  const summary = useDashboardSummary();

  const plan: PlanId = (profile.data?.subscription_plan ?? "free") as PlanId;
  const firstName = profile.data?.full_name?.split(" ")[0] ?? null;

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={plan}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header — greeting tutoyé, style handoff (serif italic violet sur
            l'accent). PR-DA-U3 : eyebrow-accent + display-serif via classes
            CSS pour cohérence avec le pattern unifié. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow eyebrow-accent">Dashboard</span>
            <h1 className="display-serif mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
              Bonjour{firstName ? `, ${firstName}` : ""},{" "}
              <em className="font-serif font-normal italic text-[var(--accent)] tracking-[-0.012em]">
                prêt à scanner ?
              </em>
            </h1>
            <p className="mt-2.5 max-w-[48ch] text-sm leading-relaxed text-muted-ink">
              {summary.data?.empty_state_hint
                ? "Bienvenue sur ImmoScan."
                : "Voici ce qui mérite ton œil aujourd'hui."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate({ to: "/app/nouvelle-analyse" })}>
              <Plus className="mr-1 h-4 w-4" /> Nouvelle analyse
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/app/veilles/nouvelle" })}
            >
              <Radar className="mr-1 h-4 w-4" /> Nouvelle veille
            </Button>
          </div>
        </div>

        {/* Loading */}
        {summary.isLoading && (
          <div className="rounded-r-lg border border-line bg-card p-12 text-center text-sm text-muted-ink shadow-lvl-1">
            Chargement…
          </div>
        )}

        {/* Empty state intelligent */}
        {summary.data?.empty_state_hint === "first_analysis" && (
          <OnboardingState plan={plan} />
        )}

        {/* Contenu principal — uniquement si au moins 1 analyse done */}
        {summary.data && summary.data.empty_state_hint !== "first_analysis" && (
          <div className="space-y-6">
            {/* Alertes : en haut pour visibilité */}
            {summary.data.alerts.length > 0 && (
              <AlertsSection alerts={summary.data.alerts} />
            )}

            {/* Stats compteurs */}
            <StatsRow data={summary.data} plan={plan} />

            {/* Top opportunités — le killer feature */}
            <OpportunitiesSection
              opportunities={summary.data.top_opportunities}
              plan={plan}
              emptyHint={summary.data.empty_state_hint}
            />

            {/* Activité veilles 7j + Pipeline */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <WatchActivityCard
                activity={summary.data.watch_activity_7d}
              />
              <PipelineCard counts={summary.data.pipeline_counts} />
            </div>

            {/* Signal marché */}
            {summary.data.market_stats.length > 0 && (
              <MarketStatsSection stats={summary.data.market_stats} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Onboarding state (pas encore d'analyse done)
// ──────────────────────────────────────────────────────────────────

function OnboardingState({ plan }: { plan: PlanId }) {
  const planDef = PLANS[plan];
  return (
    <Card className="border-violet/30 bg-gradient-to-br from-violet-soft/40 to-transparent">
      <CardHeader>
        <CardTitle className="text-xl">
          <Sparkles className="mr-1 inline h-5 w-5 text-violet" />4 étapes pour
          commencer à investir mieux
        </CardTitle>
        <CardDescription>
          {plan === "free"
            ? `Plan Free · ${planDef.analysesPerMonth} analyse${planDef.analysesPerMonth > 1 ? "s" : ""} gratuite${planDef.analysesPerMonth > 1 ? "s" : ""} par mois`
            : `Plan ${planDef.name} · ${planDef.analysesPerMonth} analyses/mois`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {[
            {
              n: "①",
              title: "Lance ta 1re analyse",
              hint: "Colle une URL SeLoger ou utilise le form structuré, on scoute 50 à 500 biens en 8 min",
              cta: { label: "Démarrer", to: "/app/nouvelle-analyse" as const },
              active: true,
            },
            {
              n: "②",
              title: "Crée une veille sur ta zone",
              hint: "On scoute 3×/sem et tu reçois un digest email uniquement si quelque chose mérite ton œil",
              cta: { label: "Créer une veille", to: "/app/veilles/nouvelle" as const },
              active: false,
            },
            {
              n: "③",
              title: "Ajoute un bien à ton pipeline",
              hint: "Kanban À visiter → Visité → Offre → Compromis → Signé",
              cta: null,
              active: false,
            },
            {
              n: "④",
              title: "Conclus ton 1er deal",
              hint: "On reste actif sur ta zone pour le suivant",
              cta: null,
              active: false,
            },
          ].map((step) => (
            <li
              key={step.n}
              className={`flex items-start gap-3 rounded-r border p-4 ${
                step.active
                  ? "border-violet/40 bg-card shadow-lvl-1"
                  : "border-line bg-bg-2/50"
              }`}
            >
              <div
                className={`font-mono text-xl font-semibold ${step.active ? "text-violet" : "text-mute-2"}`}
              >
                {step.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink">{step.title}</div>
                <div className="mt-0.5 text-xs text-muted-ink">{step.hint}</div>
              </div>
              {step.cta && step.active && (
                <Button size="sm" asChild>
                  <Link to={step.cta.to}>{step.cta.label}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Alertes
// ──────────────────────────────────────────────────────────────────

function AlertsSection({
  alerts,
}: {
  alerts: DashboardSummary["alerts"];
}) {
  return (
    <div className="rounded-r-lg border border-terra-soft-2 bg-terra-soft/60 p-4 shadow-lvl-1">
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-terra-deep" />
        <Eyebrow variant="terra">
          Alertes & signaux ({alerts.length})
        </Eyebrow>
      </div>
      <ul className="space-y-1.5">
        {alerts.slice(0, 4).map((alert, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-terra-deep">• {alert.label}</span>
            <Link
              to={alert.cta_link as never}
              className="shrink-0 text-xs font-medium text-terra-deep hover:underline"
            >
              {alert.kind === "watch_expiring" ||
              alert.kind === "trial_ending" ||
              alert.kind === "quota_analyses"
                ? "Passer Pro"
                : "Affiner →"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Stats compteurs
// ──────────────────────────────────────────────────────────────────

function StatsRow({
  data,
  plan,
}: {
  data: DashboardSummary;
  plan: PlanId;
}) {
  const planDef = PLANS[plan];
  const analysesPct = data.stats.analyses_limit > 0
    ? (data.stats.analyses_used / data.stats.analyses_limit) * 100
    : 0;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Analyses ce cycle"
        value={`${data.stats.analyses_used} / ${data.stats.analyses_limit}`}
        progress={analysesPct}
        accent="primary"
      />
      <StatCard
        label="Veilles actives"
        value={`${data.stats.watches_active} / ${data.stats.watches_effective_limit}`}
        progress={
          data.stats.watches_effective_limit > 0
            ? (data.stats.watches_active / data.stats.watches_effective_limit) * 100
            : 0
        }
        accent="success"
      />
      <StatCard
        label="Crédits PPU"
        value={String(data.stats.ppu_balance)}
        progress={null}
        accent="amber"
      />
      <StatCard
        label="Plan"
        value={planDef.name}
        progress={null}
        accent="muted"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  progress,
  accent,
}: {
  label: string;
  value: string;
  progress: number | null;
  accent: "primary" | "success" | "amber" | "muted";
}) {
  // Mapping accent → token handoff (plus de couleurs Tailwind brutes).
  // primary→violet (brand), success→sage (positif doux), amber→warning,
  // muted→mute-2.
  const colorMap: Record<typeof accent, string> = {
    primary: "bg-violet",
    success: "bg-sage",
    amber: "bg-warning",
    muted: "bg-mute-2",
  };
  return (
    <div className="rounded-r-lg border border-line bg-card p-4 shadow-lvl-1">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-mono text-[26px] font-semibold tnum tracking-[-0.025em] text-ink">
        {value}
      </div>
      {progress !== null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-2">
          <div
            className={`h-full ${colorMap[accent]} transition-all`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Top opportunités (le killer feature)
// ──────────────────────────────────────────────────────────────────

function OpportunitiesSection({
  opportunities,
  plan,
  emptyHint,
}: {
  opportunities: DashboardOpportunity[];
  plan: PlanId;
  emptyHint: DashboardSummary["empty_state_hint"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Flame className="mr-1.5 inline h-4 w-4 text-violet" />
          Opportunités du moment
        </CardTitle>
        <CardDescription>
          Top 5 biens score ≥ 75 sur tes veilles actives, pas encore dans ton
          pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <div className="rounded-r border border-dashed border-line-2 bg-bg-2/40 p-6 text-center text-sm text-muted-ink">
            {emptyHint === "first_watch"
              ? "Aucune veille active. Crée-en une pour voir tes opportunités."
              : "Pas encore de bien score ≥ 75 sur tes veilles. Le prochain scout pourrait en trouver."}
            {emptyHint === "first_watch" && (
              <div className="mt-3">
                <Button size="sm" asChild>
                  <Link to="/app/veilles/nouvelle">
                    <Radar className="mr-1 h-3.5 w-3.5" /> Créer ma veille
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {opportunities.map((opp) => (
              <OpportunityRow key={opp.watch_listing_id} opp={opp} plan={plan} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OpportunityRow({
  opp,
  plan,
}: {
  opp: DashboardOpportunity;
  plan: PlanId;
}) {
  const masked =
    plan === "free" && (opp.current_score ?? 0) >= FREEMIUM_MASK_THRESHOLD;
  const score = opp.current_score ?? 0;
  return (
    <li className="flex items-center gap-3 py-3">
      {/* ScoreBadge atom remplace le span hardcodé bg-emerald/blue/amber. */}
      <ScoreBadge value={score} size="sm" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium text-ink">
          {opp.title ?? "Sans titre"}
        </div>
        <div className="text-xs text-muted-ink">
          {masked ? (
            <>
              <Lock className="mr-1 inline h-3 w-3" />
              Prix masqué — Pro
            </>
          ) : (
            <span className="font-mono tnum">
              {formatEur(opp.current_price)}
              {opp.current_surface
                ? ` · ${Math.round(opp.current_price / opp.current_surface)} €/m²`
                : ""}
              {opp.current_dpe ? ` · DPE ${opp.current_dpe}` : ""}
            </span>
          )}
          <span className="ml-2 text-mute-2">via {opp.watch_name}</span>
        </div>
      </div>
      {!masked && (
        <a
          href={opp.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-violet hover:underline"
          title="Voir l'annonce"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// Activité veilles 7j
// ──────────────────────────────────────────────────────────────────

function WatchActivityCard({
  activity,
}: {
  activity: DashboardSummary["watch_activity_7d"];
}) {
  const total =
    (activity.new_match ?? 0) +
    (activity.price_drop ?? 0) +
    (activity.signal_to_verify ?? 0) +
    (activity.relisted ?? 0) +
    (activity.removed ?? 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Zap className="mr-1.5 inline h-4 w-4 text-violet" />
          Activité veilles (7 derniers jours)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-sm text-muted-ink">
            Pas d'activité cette semaine sur tes veilles.
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            <ActivityRow
              icon={<Sparkles className="h-3.5 w-3.5 text-violet" />}
              label="Nouveaux biens retenus"
              count={activity.new_match ?? 0}
            />
            <ActivityRow
              icon={<TrendingDown className="h-3.5 w-3.5 text-sage" />}
              label="Baisses de prix"
              count={activity.price_drop ?? 0}
            />
            <ActivityRow
              icon={<AlertCircle className="h-3.5 w-3.5 text-warning" />}
              label="Décotes à vérifier"
              count={activity.signal_to_verify ?? 0}
            />
            <ActivityRow
              icon={<TrendingUp className="h-3.5 w-3.5 text-mute-2" />}
              label="Biens relistés"
              count={activity.relisted ?? 0}
            />
            <ActivityRow
              icon={<ExternalLink className="h-3.5 w-3.5 text-faint" />}
              label="Vendus / retirés"
              count={activity.removed ?? 0}
            />
          </ul>
        )}
        <div className="mt-3 border-t border-line pt-3 text-right">
          <Link
            to="/app/veilles"
            className="text-xs font-medium text-violet hover:underline"
          >
            Voir le détail par veille →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="inline-flex w-5 justify-center">{icon}</span>
        <span className="text-muted-ink">{label}</span>
      </span>
      <span
        className={`font-mono tnum font-medium ${count > 0 ? "text-ink" : "text-faint"}`}
      >
        {count}
      </span>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// Pipeline
// ──────────────────────────────────────────────────────────────────

function PipelineCard({
  counts,
}: {
  counts: DashboardSummary["pipeline_counts"];
}) {
  const stages: PipelineStage[] = [
    "a_visiter",
    "visite",
    "offre",
    "compromis",
    "signe",
  ];
  const total = stages.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <KanbanSquare className="mr-1.5 inline h-4 w-4 text-violet" />
          Pipeline ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-sm text-muted-ink">
            Pas encore de bien dans ton pipeline.
            <div className="mt-2 text-xs text-mute-2">
              Ajoute des biens depuis tes analyses ou tes veilles pour suivre
              leur progression.
            </div>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {stages.map((s) => {
              const n = counts[s] ?? 0;
              return (
                <li
                  key={s}
                  className={`flex items-center justify-between ${n === 0 ? "opacity-50" : ""}`}
                >
                  <span className="text-muted-ink">{STAGE_LABELS[s]}</span>
                  <span
                    className={`font-mono tnum font-medium ${n > 0 ? "text-ink" : "text-faint"}`}
                  >
                    {n}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 border-t border-line pt-3 text-right">
          <Link
            to="/app/pipeline"
            className="text-xs font-medium text-violet hover:underline"
          >
            Ouvrir le pipeline →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Stats marché
// ──────────────────────────────────────────────────────────────────

function MarketStatsSection({
  stats,
}: {
  stats: DashboardSummary["market_stats"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <MapPin className="mr-1.5 inline h-4 w-4 text-violet" />
          Signal marché — tes zones
        </CardTitle>
        <CardDescription>
          Médian €/m² (appartement) sur les communes que tu surveilles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {stats.map((s) => (
            <li
              key={s.city}
              className="flex items-center justify-between gap-2 border-b border-line/60 pb-2 last:border-0"
            >
              <span className="font-medium text-ink">{s.city}</span>
              <span className="font-mono tnum text-muted-ink">
                {Math.round(s.median_eur_m2)} €/m²
                {s.delta_pct !== null && (
                  <span
                    className={`ml-2 ${
                      s.delta_pct > 0
                        ? "text-success"
                        : s.delta_pct < 0
                          ? "text-warning"
                          : ""
                    }`}
                  >
                    {s.delta_pct > 0 ? (
                      <TrendingUp className="inline h-3 w-3" />
                    ) : s.delta_pct < 0 ? (
                      <TrendingDown className="inline h-3 w-3" />
                    ) : null}{" "}
                    {s.delta_pct > 0 ? "+" : ""}
                    {s.delta_pct.toFixed(1)} %
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-[11px] text-mute-2">
          <Bell className="mr-1 inline h-3 w-3" />
          Source : DVF Cerema · évolution N-1 disponible en V2
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}
