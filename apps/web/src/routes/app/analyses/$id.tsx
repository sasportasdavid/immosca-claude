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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnalysisActions } from "@/components/analysis-actions";
import { AnalysisProgress } from "@/components/analysis-progress";
import { AppShell } from "@/components/app-shell";
import { HelpDrawer } from "@/components/help-drawer";
import {
  ListingDrawer,
  type ListingDrawerData,
} from "@/components/listing-drawer";
import { MarketSummary } from "@/components/market-summary";
import { ScoreBadge } from "@/components/score-badge";
import { SearchCriteriaChips } from "@/components/search-criteria-chips";
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
  scraping: "Collecte des annonces en cours",
  enriching: "Croisement avec les données de marché (DVF, DPE, risques)",
  scoring: "Calcul des scores d'opportunité",
  generating: "Rédaction des analyses Claude pour le Top 5",
  done: "Analyse terminée",
  failed: "Échec",
  canceled: "Annulée",
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
  canceled: "default",
};

function AnalysisPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();

  const cancelAnalysis = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("cancel-analysis", {
        body: { analysisId: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", id] });
    },
  });

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
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Analyse #{id.slice(0, 8)}
            </span>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <RenameableTitle
                analysisId={id}
                value={
                  analysis.data?.name ??
                  (analysis.data?.ville
                    ? `${analysis.data.ville}${
                        analysis.data.code_postal
                          ? ` ${analysis.data.code_postal}`
                          : ""
                      }`
                    : null)
                }
              />
              {analysis.data?.status ? (
                <Badge variant={STATUS_BADGE[analysis.data.status] ?? "default"}>
                  {STATUS_LABELS[analysis.data.status] ?? analysis.data.status}
                </Badge>
              ) : null}
            </div>
            {analysis.data?.source_url ? (
              <div className="mt-3">
                <SearchCriteriaChips
                  sourceUrl={analysis.data.source_url}
                  sourceSite={analysis.data.source_site}
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {analysis.data ? (
              <AnalysisActions
                analysisId={id}
                isFavorite={analysis.data.is_favorite}
                archivedAt={analysis.data.archived_at}
              />
            ) : null}
            <HelpDrawer />
          </div>
        </div>

        {analysis.isLoading ? (
          <p className="mt-6 text-[14px] text-muted-foreground">
            Chargement…
          </p>
        ) : null}

        {analysis.data ? (
          <div className="mt-8 space-y-6">
            {/* Si analyse pas terminée : timeline progressive parlante
                (4 étapes : collecte → croisement → notation → analyses Claude).
                Sinon : KPIs résumés. L'état failed affiche l'error_message
                en dessous, peu importe le status visuel. */}
            {analysis.data.status === "done" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Annonces analysées
                  </div>
                  <div className="mt-2 font-mono text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                    {analysis.data.total_listings_raw ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Retenues pour la notation
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
            ) : (
              <AnalysisProgress
                status={analysis.data.status}
                progressPct={analysis.data.progress_pct}
                totalListings={analysis.data.total_listings_raw}
                onCancel={() => cancelAnalysis.mutate()}
                isCanceling={cancelAnalysis.isPending}
              />
            )}

            {analysis.data.status === "failed" && analysis.data.error_message ? (
              <div className="rounded-lg border border-destructive bg-destructive-soft p-5 text-[13px] text-destructive-soft-foreground">
                <div className="font-medium">Erreur :</div>
                <div className="mt-1 font-mono">{analysis.data.error_message}</div>
              </div>
            ) : null}

            {/* Top N avec thèse Claude (PR4) — visible quand done */}
            {analysis.data.status === "done" ? (
              <TopThesesSection analysisId={id} />
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

// `ListingRow` étend `ListingDrawerData` : tous les champs que le tableau
// affiche ou que le drawer affiche au click. La query SELECT doit lister
// tous les champs ci-dessous (cf. `LISTING_FREEMIUM_COLS` plus bas).
type ListingRow = ListingDrawerData & {
  chambres: number | null;
  ges: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  source_url: string | null;
  adresse_raw: string | null;
  lat: number | null;
  lng: number | null;
};

const LISTING_FREEMIUM_COLS = [
  "id",
  "title",
  "type",
  "surface",
  "pieces",
  "chambres",
  "code_postal",
  "ville",
  "dpe",
  "ges",
  "prix",
  "adresse_raw",
  "source_url",
  "lat",
  "lng",
  "description",
  "annee_construction",
  "etage",
  "is_new_construction",
  "ascenseur",
  "balcon",
  "terrasse",
  "parking",
  "cave",
  "photos_urls",
  "score_total",
  "score_prix",
  "score_rendement",
  "score_cashflow",
  "score_dpe",
  "score_quartier",
  "score_risques",
  "verdict",
  "prix_marche_estime",
  "ecart_prix_pct",
  "loyer_estime",
  "rendement_brut_pct",
  "rendement_net_pct",
  "cashflow_mensuel",
  "these_claude",
  "financement_claude",
  "negociation_claude",
  "prix_negociation_cible",
  "is_masked",
].join(", ");

const VERDICT_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  a_visiter: { label: "À visiter", variant: "success" },
  sous_reserve: { label: "Sous réserve", variant: "warning" },
  no_go: { label: "No-go", variant: "danger" },
};

// Configuration des colonnes triables. Mémoise le getter pour pouvoir
// trier la liste sans re-fetch.
type SortKey =
  | "score_total"
  | "prix"
  | "prix_m2"
  | "surface"
  | "rendement_brut_pct"
  | "dpe";

type SortDir = "asc" | "desc";

function prixM2(l: ListingRow): number | null {
  if (l.prix === null || !l.surface || l.surface <= 0) return null;
  return l.prix / l.surface;
}

function getSortValue(l: ListingRow, key: SortKey): number | null {
  switch (key) {
    case "score_total":
      return l.score_total;
    case "prix":
      return l.prix;
    case "prix_m2":
      return prixM2(l);
    case "surface":
      return l.surface;
    case "rendement_brut_pct":
      return l.rendement_brut_pct;
    case "dpe": {
      // A=1, G=7 — plus bas = mieux. On stocke en number pour comparer.
      if (!l.dpe) return null;
      return "ABCDEFG".indexOf(l.dpe);
    }
  }
}

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
        .select(LISTING_FREEMIUM_COLS)
        .eq("analysis_id", analysisId)
        .order("score_total", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ListingRow[];
    },
    refetchInterval:
      status === "done" || status === "failed" ? false : 5000,
  });

  // État du drawer (id du listing sélectionné).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tri local (côté client — on n'a au max ~500 lignes).
  const [sortKey, setSortKey] = useState<SortKey>("score_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filtres locaux (client-side, instantanés).
  const [filterType, setFilterType] = useState<
    "all" | "appartement" | "maison" | "terrain" | "immeuble"
  >("all");
  const [filterVerdict, setFilterVerdict] = useState<
    "all" | "a_visiter" | "sous_reserve" | "no_go"
  >("all");
  const [filterDpe, setFilterDpe] = useState<Set<string>>(new Set());
  const [filterMinScore, setFilterMinScore] = useState<number>(0);

  const filtered = useMemo(() => {
    if (!listings.data) return [];
    return listings.data.filter((l) => {
      if (filterType !== "all" && l.type !== filterType) return false;
      if (filterVerdict !== "all" && l.verdict !== filterVerdict) return false;
      if (filterDpe.size > 0 && (!l.dpe || !filterDpe.has(l.dpe))) return false;
      if (filterMinScore > 0 && (l.score_total ?? 0) < filterMinScore)
        return false;
      return true;
    });
  }, [listings.data, filterType, filterVerdict, filterDpe, filterMinScore]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      // null en dernier
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const filtersActive =
    filterType !== "all" ||
    filterVerdict !== "all" ||
    filterDpe.size > 0 ||
    filterMinScore > 0;
  function clearFilters() {
    setFilterType("all");
    setFilterVerdict("all");
    setFilterDpe(new Set());
    setFilterMinScore(0);
  }

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "dpe" ? "asc" : "desc");
    }
  }

  if (listings.isLoading) {
    return (
      <p className="text-[13px] text-muted-foreground">Chargement des biens…</p>
    );
  }
  if (!listings.data || listings.data.length === 0) {
    return null;
  }

  const maskedCount = listings.data.filter((l) => l.is_masked).length;
  const selected = sorted.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="space-y-8">
      {/* Synthèse marché : compact, calculée côté client */}
      <MarketSummary listings={listings.data} />

      <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em]">
          {sorted.length}{" "}
          {sorted.length > 1 ? "biens" : "bien"}
          {filtersActive ? (
            <span className="ml-2 font-mono text-[12px] font-normal text-muted-foreground">
              · filtrés sur {listings.data.length}
            </span>
          ) : (
            <span className="ml-1 text-[14px] font-normal">analysés</span>
          )}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Clique sur une ligne pour la fiche complète
        </span>
      </div>

      {/* Filter bar : type / verdict / DPE / score min. Côté client. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-[12px]">
        <FilterSelect
          label="Type"
          value={filterType}
          options={[
            { value: "all", label: "Tous" },
            { value: "appartement", label: "Appartement" },
            { value: "maison", label: "Maison" },
            { value: "terrain", label: "Terrain" },
            { value: "immeuble", label: "Immeuble" },
          ]}
          onChange={(v) => setFilterType(v as typeof filterType)}
        />
        <FilterSelect
          label="Verdict"
          value={filterVerdict}
          options={[
            { value: "all", label: "Tous" },
            { value: "a_visiter", label: "À visiter" },
            { value: "sous_reserve", label: "Sous réserve" },
            { value: "no_go", label: "No-go" },
          ]}
          onChange={(v) => setFilterVerdict(v as typeof filterVerdict)}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">DPE</span>
          {(["A", "B", "C", "D", "E", "F", "G"] as const).map((letter) => {
            const active = filterDpe.has(letter);
            return (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  setFilterDpe((s) => {
                    const next = new Set(s);
                    if (next.has(letter)) next.delete(letter);
                    else next.add(letter);
                    return next;
                  });
                }}
                className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold transition-opacity ${
                  active ? "" : "opacity-40 hover:opacity-70"
                } bg-dpe-${letter.toLowerCase()} ${
                  ["A", "B", "F", "G"].includes(letter) ? "text-white" : "text-foreground"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Score ≥</span>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={filterMinScore}
            onChange={(e) =>
              setFilterMinScore(
                Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              )
            }
            className="h-7 w-16 rounded-md border border-border bg-background px-2 font-mono tabular-nums text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-[12px] text-primary hover:underline"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="w-16 px-3 py-2.5" />
                <SortableTh
                  label="Score"
                  active={sortKey === "score_total"}
                  dir={sortDir}
                  onClick={() => toggleSort("score_total")}
                />
                <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Bien
                </th>
                <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                </th>
                <SortableTh
                  label="Surface"
                  active={sortKey === "surface"}
                  dir={sortDir}
                  onClick={() => toggleSort("surface")}
                  align="right"
                />
                <SortableTh
                  label="Prix"
                  active={sortKey === "prix"}
                  dir={sortDir}
                  onClick={() => toggleSort("prix")}
                  align="right"
                />
                <SortableTh
                  label="€/m²"
                  active={sortKey === "prix_m2"}
                  dir={sortDir}
                  onClick={() => toggleSort("prix_m2")}
                  align="right"
                />
                <SortableTh
                  label="Rdt brut"
                  active={sortKey === "rendement_brut_pct"}
                  dir={sortDir}
                  onClick={() => toggleSort("rendement_brut_pct")}
                  align="right"
                />
                <SortableTh
                  label="DPE"
                  active={sortKey === "dpe"}
                  dir={sortDir}
                  onClick={() => toggleSort("dpe")}
                />
                <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Verdict
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const verdict = l.verdict ? VERDICT_LABEL[l.verdict] : null;
                const p2 = prixM2(l);
                return (
                  <tr
                    key={l.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(l.id);
                      }
                    }}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/30 transition-colors focus:bg-secondary/40 focus:outline-none"
                  >
                    <td className="px-3 py-2">
                      {l.photos_urls && l.photos_urls[0] && !l.is_masked ? (
                        <img
                          src={l.photos_urls[0]}
                          alt=""
                          loading="lazy"
                          className="h-12 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 text-tertiary-foreground">
                          {l.is_masked ? (
                            <Lock className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <span className="text-[9px]">—</span>
                          )}
                        </div>
                      )}
                    </td>
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
                          {l.code_postal ? ` ${l.code_postal}` : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground capitalize">
                      {l.type ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                      {l.surface ? `${l.surface} m²` : "—"}
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
                      {p2 !== null && !l.is_masked
                        ? `${Math.round(p2).toLocaleString("fr-FR")}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {l.rendement_brut_pct !== null && l.rendement_brut_pct !== undefined ? (
                        <span
                          className={
                            l.rendement_brut_pct >= 6
                              ? "text-success-foreground font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {l.rendement_brut_pct.toFixed(2)} %
                        </span>
                      ) : (
                        <span className="text-tertiary-foreground">—</span>
                      )}
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
                    <td className="px-3 py-3">
                      {verdict ? (
                        <Badge variant={verdict.variant}>{verdict.label}</Badge>
                      ) : (
                        <span className="text-tertiary-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {maskedCount > 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          {maskedCount} bien{maskedCount > 1 ? "s" : ""} à fort score
          masqué{maskedCount > 1 ? "s" : ""} — passe Pro pour les débloquer.
        </p>
      ) : null}

      <ListingDrawer
        listing={selected}
        onClose={() => setSelectedId(null)}
      />
      </section>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} px-3 py-2.5`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors hover:text-foreground ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
        {active ? (
          <span className="text-[10px] leading-none">
            {dir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

// ──────────────────────────────────────────────────────────────────
// Top N avec thèse Claude (PR4) — affiche les biens qui ont une
// `these_claude` non nulle dans la vue freemium.
// ──────────────────────────────────────────────────────────────────

function TopThesesSection({ analysisId }: { analysisId: string }) {
  const tops = useQuery({
    queryKey: ["listings_with_these", analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings_freemium_view")
        .select(LISTING_FREEMIUM_COLS)
        .eq("analysis_id", analysisId)
        .not("these_claude", "is", null)
        .order("score_total", { ascending: false, nullsFirst: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as ListingRow[];
    },
  });

  if (tops.isLoading || !tops.data || tops.data.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em]">
          Top {tops.data.length} avec thèse Claude
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Analyse argumentée par Claude Sonnet
        </span>
      </div>
      <div className="space-y-4">
        {tops.data.map((l, idx) => {
          const verdict = l.verdict ? VERDICT_LABEL[l.verdict] : null;
          return (
            <details
              key={l.id}
              className="group rounded-lg border border-border bg-card open:shadow-lvl-1"
              open={idx === 0}
            >
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 list-none">
                <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                  #{idx + 1}
                </span>
                {l.score_total !== null ? (
                  <ScoreBadge score={l.score_total} size="md" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className={l.is_masked ? "blur-sm select-none" : ""}>
                    <div className="text-[15px] font-semibold line-clamp-1">
                      {l.title ?? "Sans titre"}
                    </div>
                    <div className="text-[12px] text-muted-foreground line-clamp-1">
                      {l.ville ?? "—"}
                      {l.code_postal ? ` · ${l.code_postal}` : ""}
                      {l.surface ? ` · ${l.surface} m²` : ""}
                      {l.pieces ? ` · ${l.pieces}P` : ""}
                      {l.dpe ? ` · DPE ${l.dpe}` : ""}
                    </div>
                  </div>
                </div>
                {verdict ? (
                  <Badge variant={verdict.variant}>{verdict.label}</Badge>
                ) : null}
                <span className="font-mono tabular-nums text-[14px] font-medium">
                  {l.prix !== null && !l.is_masked
                    ? `${Math.round(l.prix).toLocaleString("fr-FR")} €`
                    : "🔒"}
                </span>
              </summary>
              <div className="border-t border-border px-5 py-5">
                {l.is_masked ? (
                  <div className="text-center py-8">
                    <Lock className="mx-auto h-6 w-6 text-primary" />
                    <p className="mt-3 text-[14px] font-medium">
                      Cette opportunité est masquée.
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Passe Pro pour lire la thèse Claude complète + plan
                      de financement + stratégie de négociation chiffrée.
                    </p>
                    <Button className="mt-4" size="sm">
                      Passer Pro — 7 jours offerts
                    </Button>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-[13.5px] leading-[1.65] text-secondary-foreground whitespace-pre-wrap">
                    {l.these_claude}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}


// ──────────────────────────────────────────────────────────────────
// RenameableTitle — h1 cliquable qui se transforme en input pour
// renommer une recherche. Update direct sur analyses.name côté DB.
// ──────────────────────────────────────────────────────────────────

function RenameableTitle({
  analysisId,
  value,
}: {
  analysisId: string;
  value: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const display = value ?? "Sans nom";

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setEditing(false);
      return;
    }
    const { error } = await supabase
      .from("analyses")
      .update({ name: trimmed })
      .eq("id", analysisId);
    if (error) {
      console.warn("Renommage échoué", error);
      setEditing(false);
      return;
    }
    // Optimistic : on update le cache puis on invalide pour forcer le refetch.
    queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
    queryClient.invalidateQueries({ queryKey: ["analyses"] });
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        maxLength={80}
        className="rounded-md border border-border bg-background px-2 py-1 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] outline-none focus:ring-2 focus:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-baseline gap-2 rounded-md px-1 py-0.5 text-left text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] hover:bg-secondary/50"
      aria-label="Renommer la recherche"
    >
      {display}
      <Pencil className="h-3.5 w-3.5 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-border bg-background px-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
