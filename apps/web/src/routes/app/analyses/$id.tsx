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
import { Lock } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ScoreBadge } from "@/components/score-badge";
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

            {/* Tableau listings : visible dès qu'on a quelque chose */}
            {(analysis.data.total_listings_filtered ?? 0) > 0 ? (
              <ListingsSection analysisId={id} status={analysis.data.status} />
            ) : null}

            <div>
              <Button asChild variant="outline" size="sm">
                <a href="/app/analyses">← Toutes mes analyses</a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tableau listings (lecture via listings_freemium_view — RLS + masque
// côté serveur, le frontend reçoit déjà du null pour les champs PII
// des biens >70/100 si l'user est Free).
// ──────────────────────────────────────────────────────────────────

type ListingRow = {
  id: string;
  title: string | null;
  type: string;
  surface: number | null;
  pieces: number | null;
  code_postal: string | null;
  ville: string | null;
  dpe: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  prix: number | null;
  adresse_raw: string | null;
  source_url: string | null;
  lat: number | null;
  lng: number | null;
  score_total: number | null;
  these_claude: string | null;
  is_masked: boolean;
};

function ListingsSection({
  analysisId,
  status,
}: {
  analysisId: string;
  status: string;
}) {
  const listings = useQuery({
    queryKey: ["listings", analysisId],
    queryFn: async (): Promise<ListingRow[]> => {
      const { data, error } = await supabase
        .from("listings_freemium_view")
        .select(
          "id, title, type, surface, pieces, code_postal, ville, dpe, prix, adresse_raw, source_url, lat, lng, score_total, these_claude, is_masked",
        )
        .eq("analysis_id", analysisId)
        .order("score_total", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ListingRow[];
    },
    refetchInterval:
      status === "done" || status === "failed" ? false : 5000,
  });

  if (listings.isLoading) {
    return (
      <p className="text-[13px] text-muted-foreground">Chargement des biens…</p>
    );
  }
  if (!listings.data || listings.data.length === 0) {
    return null;
  }

  const maskedCount = listings.data.filter((l) => l.is_masked).length;

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em]">
          Top {listings.data.length}{" "}
          {listings.data.length > 1 ? "biens" : "bien"}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Triés par score
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-secondary/50">
            <tr>
              <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Score
              </th>
              <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Bien
              </th>
              <th className="text-right px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Prix
              </th>
              <th className="text-right px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Surface
              </th>
              <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                DPE
              </th>
              <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                CP
              </th>
            </tr>
          </thead>
          <tbody>
            {listings.data.map((l) => (
              <tr
                key={l.id}
                className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
              >
                <td className="px-3 py-3">
                  {l.score_total !== null ? (
                    <ScoreBadge score={l.score_total} size="md" />
                  ) : (
                    <span className="text-tertiary-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div
                    className={
                      l.is_masked
                        ? "select-none blur-sm pointer-events-none"
                        : ""
                    }
                  >
                    <div className="font-medium line-clamp-1">
                      {l.title ?? "Sans titre"}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {l.pieces ? `${l.pieces}P · ` : ""}
                      {l.ville ?? "—"}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums font-medium">
                  {l.prix !== null && !l.is_masked
                    ? `${Math.round(l.prix).toLocaleString("fr-FR")} €`
                    : null}
                  {l.is_masked ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3 text-primary" />
                      Pro
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                  {l.surface ? `${l.surface} m²` : "—"}
                </td>
                <td className="px-3 py-3">
                  {l.dpe ? (
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold bg-dpe-${l.dpe.toLowerCase()} ${
                        ["A", "B", "F", "G"].includes(l.dpe)
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {l.dpe}
                    </span>
                  ) : (
                    <span className="text-tertiary-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {l.code_postal ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {maskedCount > 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          {maskedCount} bien{maskedCount > 1 ? "s" : ""} à fort score
          masqué{maskedCount > 1 ? "s" : ""} — passe Pro pour les débloquer.
        </p>
      ) : null}
    </section>
  );
}
