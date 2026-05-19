// /app/analyses — liste des analyses du user, du plus récent au plus ancien.
//
// PR3.5 : version simple — un tableau de cards rectangulaires avec
// statut, source URL, médian €/m², date. Filtres et cards riches (avec
// mini-map SVG par ville, sparkline activité) sont en backlog PR6+.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/analyses/")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: AnalysesListPage,
});

const STATUS_BADGE: Record<
  string,
  { variant: "success" | "warning" | "danger" | "info" | "default"; label: string }
> = {
  pending: { variant: "info", label: "En attente" },
  scraping: { variant: "info", label: "Collecte" },
  enriching: { variant: "info", label: "Croisement marché" },
  scoring: { variant: "info", label: "Notation" },
  generating: { variant: "info", label: "Analyses Claude" },
  done: { variant: "success", label: "Terminée" },
  failed: { variant: "danger", label: "Échec" },
};

function AnalysesListPage() {
  const auth = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();

  const analyses = useQuery({
    queryKey: ["analyses", auth.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select(
          "id, source_url, source_site, status, total_listings_filtered, median_price_per_sqm, ville, code_postal, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!auth.user,
  });

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="analyses"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Mes analyses
            </span>
            <h1 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">
              {analyses.data?.length ?? 0}{" "}
              {(analyses.data?.length ?? 0) > 1 ? "analyses" : "analyse"}
            </h1>
          </div>
          <Button onClick={() => navigate({ to: "/app/nouvelle-analyse" })}>
            <Plus className="h-4 w-4" />
            Nouvelle analyse
          </Button>
        </div>

        {analyses.isLoading ? (
          <p className="text-[14px] text-muted-foreground">Chargement…</p>
        ) : null}

        {analyses.data && analyses.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
              Aucune analyse pour l'instant.
            </h2>
            <p className="mx-auto mt-2 max-w-[48ch] text-[13px] text-muted-foreground">
              Lance ta première analyse en collant une URL SeLoger ou Leboncoin.
            </p>
            <div className="mt-5">
              <Button onClick={() => navigate({ to: "/app/nouvelle-analyse" })}>
                Lancer une analyse
              </Button>
            </div>
          </div>
        ) : null}

        {analyses.data && analyses.data.length > 0 ? (
          <ul className="space-y-3">
            {analyses.data.map((a) => {
              const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.pending;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/app/analyses/$id",
                        params: { id: a.id },
                      })
                    }
                    className="block w-full rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:shadow-lvl-1"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold">
                            {a.ville ?? "Sans ville"}
                            {a.code_postal ? ` · ${a.code_postal}` : ""}
                          </span>
                          {badge ? (
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          ) : null}
                          <Badge variant="outline">{a.source_site}</Badge>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground line-clamp-1">
                          {a.source_url}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-[12px] text-muted-foreground">
                          {a.total_listings_filtered ?? 0} biens
                        </div>
                        {a.median_price_per_sqm ? (
                          <div className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums">
                            {Math.round(Number(a.median_price_per_sqm))} €/m²
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 font-mono text-[11px] text-tertiary-foreground tabular-nums">
                      {new Date(a.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </AppShell>
  );
}
