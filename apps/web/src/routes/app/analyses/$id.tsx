// /app/analyses/$id — page d'une analyse.
//
// PR3 minimal : affiche le status + progression + nombre de listings
// (+ médian €/m² quand done). Polling via React Query refetchInterval
// tant que status != done|failed.
//
// PR3.5 ajoutera :
// - Supabase Realtime subscription (plus efficace que polling)
// - Tableau 14 colonnes des listings (via listings_freemium_view)
// - Filter bar Attio-style
// - Side panel fiche bien
// - Tabs (Tableau / Top 10 / Synthèse / Carte)

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/analyses/$id")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: AnalysisPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  scraping: "Scraping des annonces",
  enriching: "Enrichissement DVF / DPE / Géorisques",
  scoring: "Calcul des scores",
  generating: "Génération de la thèse Claude",
  done: "Terminé",
  failed: "Échec",
};

const STATUS_BADGE: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  pending: "info",
  scraping: "info",
  enriching: "info",
  scoring: "info",
  generating: "info",
  done: "success",
  failed: "danger",
};

function AnalysisPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const profile = useProfile();

  const analysis = useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    // Poll tant que pas done|failed
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && (status === "done" || status === "failed") ? false : 3000;
    },
  });

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
    >
      <div className="mx-auto max-w-[960px] px-6 py-12">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Analyse #{id.slice(0, 8)}
        </span>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">
            {analysis.data?.ville ?? "—"}
            {analysis.data?.code_postal ? ` ${analysis.data.code_postal}` : ""}
          </h1>
          {analysis.data?.status ? (
            <Badge variant={STATUS_BADGE[analysis.data.status] ?? "default"}>
              {STATUS_LABELS[analysis.data.status] ?? analysis.data.status}
            </Badge>
          ) : null}
        </div>

        {analysis.isLoading ? (
          <p className="mt-6 text-[14px] text-muted-foreground">
            Chargement…
          </p>
        ) : null}

        {analysis.data ? (
          <div className="mt-8 space-y-6">
            {/* Progress bar */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
                <span>{STATUS_LABELS[analysis.data.status] ?? analysis.data.status}</span>
                <span className="font-mono tabular-nums">
                  {analysis.data.progress_pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${analysis.data.progress_pct}%` }}
                />
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Annonces scrapées
                </div>
                <div className="mt-2 font-mono text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                  {analysis.data.total_listings_raw ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Normalisées
                </div>
                <div className="mt-2 font-mono text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                  {analysis.data.total_listings_filtered ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Médian €/m²
                </div>
                <div className="mt-2 font-mono text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                  {analysis.data.median_price_per_sqm
                    ? `${Math.round(Number(analysis.data.median_price_per_sqm))}`
                    : "—"}
                </div>
              </div>
            </div>

            {analysis.data.status === "failed" && analysis.data.error_message ? (
              <div className="rounded-lg border border-destructive bg-destructive-soft p-5 text-[13px] text-destructive-soft-foreground">
                <div className="font-medium">Erreur :</div>
                <div className="mt-1 font-mono">{analysis.data.error_message}</div>
              </div>
            ) : null}

            {analysis.data.status === "done" ? (
              <div className="rounded-lg border border-success bg-success-soft p-5 text-[13px] text-success-soft-foreground">
                <div className="font-medium">Analyse terminée.</div>
                <p className="mt-1">
                  La vue rapport complet (tableau 14 colonnes, Top 10,
                  synthèse marché, carte) sera disponible en PR3.5.
                </p>
              </div>
            ) : null}

            <div>
              <Button asChild variant="outline" size="sm">
                <a href="/dashboard">← Retour dashboard</a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
