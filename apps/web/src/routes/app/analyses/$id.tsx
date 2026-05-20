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
import { Lock, Pencil, Radar } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnalysisActions } from "@/components/analysis-actions";
import {
  QuotaUpsellBanner,
  TruncateBanner,
  parseQuotaError,
} from "@/components/analysis-banners";
import { trackEvent } from "@/lib/posthog";
import { AnalysisMap } from "@/components/analysis-map";
import { AnalysisProgress } from "@/components/analysis-progress";
import { AppShell } from "@/components/app-shell";
import { HelpDrawer } from "@/components/help-drawer";
import {
  ListingDrawer,
  type ListingDrawerData,
} from "@/components/listing-drawer";
import { MarketSummary } from "@/components/market-summary";
import { RecomputeSheet } from "@/components/recompute-sheet";
import { SearchCriteriaChips } from "@/components/search-criteria-chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfBadge } from "@/components/ui/conf-badge";
import { DpePill } from "@/components/ui/dpe-pill";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { TheseBlock } from "@/components/ui/these-block";
import { VerdictPill } from "@/components/ui/verdict-pill";
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

  // PostHog : track analysis_completed UNE FOIS quand status passe à done.
  // Le ref évite la double émission si la query refetch en background.
  const completedTrackedRef = useRef(false);
  useEffect(() => {
    if (analysis.data?.status === "done" && !completedTrackedRef.current) {
      completedTrackedRef.current = true;
      trackEvent({
        name: "analysis_completed",
        props: {
          analysis_id: id,
          total_listings_raw: analysis.data.total_listings_raw ?? 0,
          total_listings_filtered: analysis.data.total_listings_filtered ?? 0,
          was_truncated: !!analysis.data.was_truncated,
        },
      });
    }
    // Aussi track quota_exceeded si status=failed avec error message parsable
    if (analysis.data?.status === "failed" && analysis.data.error_message) {
      const parsed = parseQuotaError(analysis.data.error_message);
      if (parsed && !completedTrackedRef.current) {
        completedTrackedRef.current = true;
        trackEvent({
          name: "quota_exceeded",
          props: {
            reason: parsed.reason,
            upgrade_to: parsed.upgradeTo,
            used: parsed.used,
            limit: parsed.limit,
          },
        });
      }
    }
  }, [analysis.data?.status, analysis.data?.error_message, analysis.data?.total_listings_raw, analysis.data?.total_listings_filtered, analysis.data?.was_truncated, id]);

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
    >
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Eyebrow variant="accent">
              Analyse · #{id.slice(0, 8)}
            </Eyebrow>
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
            {analysis.data ? (
              <div className="mt-3">
                <SearchCriteriaChips
                  sourceUrl={analysis.data.source_url}
                  sourceSite={analysis.data.source_site}
                  searchFilters={
                    analysis.data.search_filters as
                      | Record<string, unknown>
                      | null
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {analysis.data && analysis.data.status === "done" ? (
              <RecomputeSheet
                analysisId={id}
                apifyRunId={analysis.data.apify_run_id}
                currentParams={{
                  apport:
                    (analysis.data.params_snapshot as { apport?: number })
                      ?.apport ?? 200_000,
                  taux_credit_pct:
                    (analysis.data.params_snapshot as {
                      taux_credit_pct?: number;
                    })?.taux_credit_pct ?? 3,
                  duree_credit_ans:
                    (analysis.data.params_snapshot as {
                      duree_credit_ans?: number;
                    })?.duree_credit_ans ?? 25,
                  tmi_pct:
                    (analysis.data.params_snapshot as { tmi_pct?: number })
                      ?.tmi_pct ?? 30,
                  rendement_min_pct:
                    (analysis.data.params_snapshot as {
                      rendement_min_pct?: number;
                    })?.rendement_min_pct ?? 6,
                }}
                onLaunched={() =>
                  queryClient.invalidateQueries({ queryKey: ["analysis", id] })
                }
              />
            ) : null}
            {analysis.data?.status === "done" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  queryClient
                    .getQueryCache()
                    .findAll({ queryKey: ["watches"] })
                    .forEach((q) => q.invalidate()) ?? undefined
                }
                asChild
              >
                <a href={`/app/veilles/nouvelle?fromAnalysis=${id}`}>
                  <Radar className="mr-1.5 h-3.5 w-3.5" />
                  Mettre en veille
                </a>
              </Button>
            ) : null}
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
          <p className="mt-6 text-[14px] text-muted-ink">
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
              <AnalysisHero data={analysis.data} analysisId={id} />
            ) : (
              <AnalysisProgress
                status={analysis.data.status}
                progressPct={analysis.data.progress_pct}
                totalListings={analysis.data.total_listings_raw}
                onCancel={() => cancelAnalysis.mutate()}
                isCanceling={cancelAnalysis.isPending}
              />
            )}

            {/* Bannière truncate : si l'actor a dépassé le cap du plan */}
            {analysis.data.status === "done" && analysis.data.was_truncated ? (
              <TruncateBanner
                totalListings={analysis.data.total_listings_raw}
                itemsCapApplied={analysis.data.items_cap_applied}
                currentPlan={(profile.data?.subscription_plan ?? "free") as never}
              />
            ) : null}

            {analysis.data.status === "failed" && analysis.data.error_message ? (
              parseQuotaError(analysis.data.error_message) ? (
                <QuotaUpsellBanner
                  errorMessage={analysis.data.error_message}
                  currentPlan={(profile.data?.subscription_plan ?? "free") as never}
                />
              ) : (
                <div className="rounded-r-lg border border-bad/30 bg-destructive-soft p-5 text-[13px] text-destructive-soft-foreground shadow-lvl-1">
                  <div className="font-semibold">Erreur :</div>
                  <div className="mt-1 font-mono text-[12.5px]">{analysis.data.error_message}</div>
                </div>
              )
            ) : null}

            {/* Top N avec thèse Claude (PR4) — visible quand done */}
            {analysis.data.status === "done" ? (
              <TopThesesSection analysisId={id} />
            ) : null}

            {/* Tableau listings : visible dès qu'on a quelque chose */}
            {(analysis.data.total_listings_filtered ?? 0) > 0 ? (
              <ListingsSection
                analysisId={id}
                status={analysis.data.status}
                analysisParams={
                  analysis.data.params_snapshot as {
                    apport: number | null;
                    taux_credit_pct: number | null;
                    duree_credit_ans: number | null;
                    tmi_pct: number | null;
                  } | null
                }
              />
            ) : null}

            <div>
              <Button asChild variant="ghost" size="sm">
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
// AnalysisHero — bloc d'accroche style handoff DA unifiée :
// eyebrow-accent · "Analyse terminée"  +  display-serif "N biens.
// <em>Top à appeler.</em>"  +  rangée stats horizontale + conf-badge.
// Calque sur le mockup `mk-head` / `mk-stats` (handoff §Mockup).
// ──────────────────────────────────────────────────────────────────

function AnalysisHero({
  data,
  analysisId,
}: {
  data: {
    total_listings_raw: number | null;
    total_listings_filtered: number | null;
    median_price_per_sqm: number | string | null;
  };
  analysisId: string;
}) {
  const raw = data.total_listings_raw ?? 0;
  const filtered = data.total_listings_filtered ?? 0;
  // Confiance globale = couverture de notation. Si on a retenu tout ce qui
  // est arrivé, on est très confiant ; sinon on rend visible que des biens
  // ont été exclus (DPE manquant, surface aberrante, etc.).
  const coverage = raw > 0 ? Math.max(0, Math.min(1, filtered / raw)) : 0.85;

  return (
    <section
      className="rounded-r-xl border border-line bg-card p-7 shadow-lvl-1"
      // Surface chaude façon `.mk-head` du handoff (gradient violet subtil).
      style={{
        backgroundImage:
          "linear-gradient(180deg, var(--accent-tint), transparent 70%)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="eyebrow eyebrow-accent">
          Analyse terminée
        </span>
        <Eyebrow>#{analysisId.slice(0, 8)}</Eyebrow>
      </div>

      {/* Titre éditorial — chiffre en bold + verbe en italique serif. */}
      <h2 className="display-serif mt-3 max-w-[28ch] text-[36px] font-semibold leading-[1.06] tracking-[-0.025em] text-ink [text-wrap:balance]">
        {raw > 0 ? raw : "—"}{" "}
        {raw === 1 ? "bien scanné" : "biens scannés"}.{" "}
        <em className="font-serif font-normal italic text-[var(--accent)] tracking-[-0.012em]">
          {filtered > 0 ? "Voici ceux qui valent un appel." : "Synthèse en route."}
        </em>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4 lg:[grid-template-columns:1fr_1fr_1fr_1fr_auto] lg:items-end">
        <HeroStat
          label="Annonces analysées"
          value={raw > 0 ? raw.toLocaleString("fr-FR") : "—"}
        />
        <HeroStat
          label="Retenues pour notation"
          value={filtered > 0 ? filtered.toLocaleString("fr-FR") : "—"}
          hint={
            raw && filtered != null && raw > filtered
              ? `${raw - filtered} exclus`
              : undefined
          }
        />
        <HeroStat
          label="Médian €/m²"
          value={
            data.median_price_per_sqm
              ? Math.round(Number(data.median_price_per_sqm)).toLocaleString(
                  "fr-FR",
                )
              : "—"
          }
          unit="€"
        />
        <HeroStat label="Statut" value="Terminé" tone="accent" />
        <div className="col-span-2 flex md:col-span-4 lg:col-span-1 lg:justify-end">
          <div className="inline-flex flex-col gap-1.5">
            <Eyebrow>Confiance globale</Eyebrow>
            <ConfBadge confidence={coverage} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  tone?: "accent";
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`mt-2 font-mono tnum text-[28px] font-semibold tracking-[-0.025em] ${
          tone === "accent" ? "text-[var(--accent-deep)]" : "text-ink"
        }`}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-[14px] font-normal text-mute-2">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[12px] text-mute-2">{hint}</div>
      ) : null}
    </div>
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
// Tous les champs sont déjà dans `ListingDrawerData` (lat/lng inclus
// pour la mini-carte du drawer). On garde le wrapper pour pouvoir
// l'étendre sans toucher le contrat du drawer.
type ListingRow = ListingDrawerData;

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
  // Confiance d'adresse (drawer affiche un badge selon source)
  "resolution_source",
  "address_confidence",
].join(", ");

const VERDICT_LABEL: Record<
  string,
  {
    label: string;
    /** Variante du shadcn Badge (legacy, Top thèses summary). */
    variant: "success" | "warning" | "danger";
    /** Tone du VerdictPill atomique (handoff DA). */
    tone: "good" | "mid" | "bad";
  }
> = {
  a_visiter: { label: "À visiter", variant: "success", tone: "good" },
  sous_reserve: { label: "Sous réserve", variant: "warning", tone: "mid" },
  no_go: { label: "No-go", variant: "danger", tone: "bad" },
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
  analysisParams,
}: {
  analysisId: string;
  status: string;
  analysisParams: {
    apport: number | null;
    taux_credit_pct: number | null;
    duree_credit_ans: number | null;
    tmi_pct: number | null;
  } | null;
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
      <p className="text-[13px] text-mute-2">Chargement des biens…</p>
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

      {/* Carte : localisation des biens (centroïde commune + jitter).
          NB: MapLibre déjà câblé dans `analysis-map.tsx` — repaint
          déléguée à ce composant, on garde juste le header DA ici. */}
      <section>
        <div className="mb-4">
          <span className="eyebrow eyebrow-accent">Carte du marché</span>
          <h2 className="display-serif mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.025em] text-ink">
            Où{" "}
            <em className="font-serif font-normal italic text-[var(--accent)]">
              ça bouge.
            </em>
          </h2>
          <p className="mt-1 text-[12.5px] text-mute-2">
            Clique sur un point pour ouvrir la fiche du bien. Précision
            adresse quand l'annonce la donne, sinon centroïde commune.
          </p>
        </div>
        <AnalysisMap
          listings={sorted}
          onSelectListing={(id) => setSelectedId(id)}
        />
      </section>

      <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="eyebrow eyebrow-accent">Tableau · vue détaillée</span>
          <h2 className="display-serif mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.025em] text-ink">
            {sorted.length}{" "}
            {sorted.length > 1 ? "biens " : "bien "}
            <em className="font-serif font-normal italic text-[var(--accent)]">
              {filtersActive ? "après tes filtres." : "à comparer."}
            </em>
            {filtersActive ? (
              <span className="ml-2 font-mono tnum text-[12px] font-normal text-mute-2 normal-case tracking-normal">
                sur {listings.data.length} analysés
              </span>
            ) : null}
          </h2>
        </div>
        <Eyebrow>Clique une ligne pour la fiche complète</Eyebrow>
      </div>

      {/* Filter bar : type / verdict / DPE / score min. Côté client. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-r-md border border-line bg-card p-3 text-[12px] shadow-lvl-1">
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
        <div className="flex items-center gap-1.5 border-l border-line pl-3 ml-1">
          <span className="text-mute-2">DPE</span>
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
                className={`transition-opacity ${
                  active ? "" : "opacity-40 hover:opacity-70"
                }`}
                aria-pressed={active}
              >
                <DpePill letter={letter} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-l border-line pl-3 ml-1">
          <span className="text-mute-2">Score ≥</span>
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
            className="h-7 w-16 rounded-r-sm border border-line bg-card px-2 font-mono tnum text-[12px] text-ink focus:outline-none focus-visible:shadow-ring-violet"
          />
        </div>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-[12px] text-violet hover:text-violet-deep hover:underline"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-r-lg border border-line bg-card shadow-lvl-1">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-bg-2">
              <tr>
                <th className="w-16 px-3 py-2.5" />
                <SortableTh
                  label="Score"
                  active={sortKey === "score_total"}
                  dir={sortDir}
                  onClick={() => toggleSort("score_total")}
                />
                <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-mute-2 font-medium">
                  Bien
                </th>
                <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-mute-2 font-medium">
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
                <th className="text-left px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-mute-2 font-medium">
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
                    className="cursor-pointer border-b border-line-soft last:border-0 transition-colors hover:bg-bg-2 focus:bg-bg-2 focus:outline-none"
                  >
                    <td className="px-3 py-2">
                      {l.photos_urls && l.photos_urls[0] && !l.is_masked ? (
                        <img
                          src={l.photos_urls[0]}
                          alt=""
                          loading="lazy"
                          className="h-12 w-16 rounded-r-sm object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-r-sm border border-dashed border-line bg-photo-bg text-mute-2">
                          {l.is_masked ? (
                            <Lock className="h-3.5 w-3.5 text-violet" />
                          ) : (
                            <span className="text-[9px]">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {l.score_total !== null ? (
                        <ScoreBadge value={l.score_total} size="md" />
                      ) : (
                        <span className="text-faint">—</span>
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
                        <div className="font-medium text-ink line-clamp-1">
                          {l.title ?? "Sans titre"}
                        </div>
                        <div className="text-[11px] text-mute-2 line-clamp-1">
                          {l.pieces ? `${l.pieces}P · ` : ""}
                          {l.ville ?? "—"}
                          {l.code_postal ? ` ${l.code_postal}` : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-mute-2 capitalize">
                      {l.type ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tnum text-mute-2">
                      {l.surface ? `${l.surface} m²` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tnum font-medium text-ink">
                      {l.prix !== null && !l.is_masked
                        ? `${Math.round(l.prix).toLocaleString("fr-FR")} €`
                        : null}
                      {l.is_masked ? (
                        <span className="inline-flex items-center gap-1 text-mute-2">
                          <Lock className="h-3 w-3 text-violet" />
                          Pro
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tnum text-mute-2">
                      {p2 !== null && !l.is_masked
                        ? `${Math.round(p2).toLocaleString("fr-FR")}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tnum">
                      {l.rendement_brut_pct !== null && l.rendement_brut_pct !== undefined ? (
                        <span
                          className={
                            l.rendement_brut_pct >= 6
                              ? "font-medium text-sage-2"
                              : "text-mute-2"
                          }
                        >
                          {l.rendement_brut_pct.toFixed(2)} %
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <DpePill letter={l.dpe} />
                    </td>
                    <td className="px-3 py-3">
                      {verdict ? (
                        <VerdictPill verdict={verdict.tone}>
                          {verdict.label}
                        </VerdictPill>
                      ) : (
                        <span className="text-faint">—</span>
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
        <p className="mt-3 text-[12px] text-mute-2">
          <Lock className="mr-1 inline h-3 w-3 text-violet" />
          {maskedCount} bien{maskedCount > 1 ? "s" : ""} à fort score
          masqué{maskedCount > 1 ? "s" : ""} — passe Pro pour les débloquer.
        </p>
      ) : null}

      <ListingDrawer
        listing={selected}
        onClose={() => setSelectedId(null)}
        analysisParams={analysisParams}
        analysisId={analysisId}
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
        className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] transition-colors hover:text-ink ${
          active ? "text-ink" : "text-mute-2"
        }`}
      >
        {label}
        {active ? (
          <span className="text-[10px] leading-none text-violet">
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
//
// PR-DA-U3 — refonte vocabulaire éditorial :
//  - header section : eyebrow-accent + display-serif
//  - chaque carte : KPIs (rank · score · status · verdict · rendement · prix)
//  - body déplié : <TheseBlock attribution="Claude"> = surface chaude
//    accent, eyebrow accent-deep avec glyph, titre serif italique
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

  const n = tops.data.length;
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="eyebrow eyebrow-accent">
            Top du marché · {n} {n > 1 ? "biens scorés" : "bien scoré"}
          </span>
          <h2 className="display-serif mt-2 text-[32px] font-semibold leading-[1.06] tracking-[-0.025em] text-ink [text-wrap:balance]">
            {n === 1 ? "Un bien " : `${n === 5 ? "Cinq" : n} biens `}
            <em className="font-serif font-normal italic text-[var(--accent)] tracking-[-0.012em]">
              valent un appel.
            </em>
          </h2>
        </div>
        <Eyebrow>Argumenté par Claude Sonnet 4.6</Eyebrow>
      </div>
      <div className="space-y-3">
        {tops.data.map((l, idx) => {
          const verdict = l.verdict ? VERDICT_LABEL[l.verdict] : null;
          const isFirst = idx === 0;
          // PR-DA-U3 statut bien : score-driven (Scoré ≥ 70, Nouveau sinon).
          // Comme cette section ne montre que les biens avec thèse Claude,
          // tous sont au minimum dans le Top — on reflète le seuil de
          // "valeur ajoutée" du scoring (75 = seuil opportunité dashboard).
          const status: "score" | "nouveau" =
            (l.score_total ?? 0) >= 75 ? "score" : "nouveau";
          return (
            <details
              key={l.id}
              className={`group rounded-r-lg border bg-card shadow-lvl-1 transition-colors ${
                isFirst
                  ? "[border-color:color-mix(in_oklab,var(--accent)_30%,transparent)] open:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_6%,transparent)]"
                  : "border-line"
              }`}
              open={isFirst}
            >
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 list-none hover:bg-bg-2/60 transition-colors">
                <span
                  className={`font-mono text-[13px] font-semibold tracking-[0.02em] ${
                    isFirst ? "text-[var(--accent)]" : "text-mute-2"
                  }`}
                >
                  #{idx + 1}
                </span>
                {l.score_total !== null ? (
                  <ScoreBadge value={l.score_total} size="lg" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className={l.is_masked ? "blur-sm select-none" : ""}>
                    <div className="text-[13.5px] font-medium tracking-[-0.01em] text-ink line-clamp-1">
                      {l.title ?? "Sans titre"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-mute-2">
                      <span>{l.ville ?? "—"}</span>
                      {l.code_postal ? (
                        <>
                          <span className="text-faint">·</span>
                          <span>{l.code_postal}</span>
                        </>
                      ) : null}
                      {l.surface ? (
                        <>
                          <span className="text-faint">·</span>
                          <span>{l.surface} m²</span>
                        </>
                      ) : null}
                      {l.pieces ? (
                        <>
                          <span className="text-faint">·</span>
                          <span>{l.pieces} pièces</span>
                        </>
                      ) : null}
                      {l.dpe ? (
                        <>
                          <span className="text-faint">·</span>
                          <DpePill letter={l.dpe} className="h-4 w-4 text-[9px]" />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <StatusBadge status={status} />
                {verdict ? (
                  <VerdictPill verdict={verdict.tone}>
                    {verdict.label}
                  </VerdictPill>
                ) : null}
                {l.rendement_brut_pct != null ? (
                  <span
                    className={`font-mono tnum text-[13px] font-semibold ${
                      l.rendement_brut_pct >= 6
                        ? "text-sage-2"
                        : l.rendement_brut_pct >= 4
                          ? "text-warning-soft-foreground"
                          : "text-mute-2"
                    }`}
                  >
                    {l.rendement_brut_pct.toFixed(1).replace(".", ",")} %
                  </span>
                ) : null}
                <span className="font-mono tnum text-[14px] font-semibold text-ink">
                  {l.prix !== null && !l.is_masked
                    ? `${Math.round(l.prix).toLocaleString("fr-FR")} €`
                    : (
                      <span className="inline-flex items-center gap-1 text-mute-2">
                        <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />
                        Pro
                      </span>
                    )}
                </span>
              </summary>
              <div className="border-t border-line px-6 py-6">
                {l.is_masked ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                      <Lock className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.012em] text-ink">
                      Cette opportunité est masquée.
                    </h3>
                    <p className="mx-auto mt-2 max-w-[48ch] text-[13px] leading-[1.55] text-muted-ink">
                      Passe Pro pour lire la thèse Claude complète, le plan
                      de financement et la stratégie de négociation chiffrée.
                    </p>
                    <Button className="mt-4" size="sm">
                      Passer Pro — 7 jours offerts
                    </Button>
                  </div>
                ) : (
                  // Moment "dramatique" du handoff : la thèse en serif
                  // italic, encapsulée dans le bloc accent product-agnostic.
                  <TheseBlock
                    attribution="Claude"
                    title={
                      l.title
                        ? `Pourquoi ${l.title.slice(0, 60)}${l.title.length > 60 ? "…" : ""}`
                        : "Pourquoi ce bien"
                    }
                  >
                    <p className="whitespace-pre-wrap font-serif italic [text-wrap:pretty]">
                      {l.these_claude}
                    </p>
                  </TheseBlock>
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
        className="rounded-r-sm border border-line bg-card px-2 py-1 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink outline-none focus-visible:shadow-ring-violet"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-baseline gap-2 rounded-r-sm px-1 py-0.5 text-left text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink hover:bg-bg-2/70"
      aria-label="Renommer la recherche"
    >
      {display}
      <Pencil className="h-3.5 w-3.5 self-center text-mute-2 opacity-0 transition-opacity group-hover:opacity-100" />
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
      <span className="text-mute-2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-r-sm border border-line bg-card px-2 text-[12px] text-ink focus:outline-none focus-visible:shadow-ring-violet"
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
