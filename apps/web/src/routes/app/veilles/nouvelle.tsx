// /app/veilles/nouvelle — formulaire de création d'une veille.
//
// 3 points d'entrée (BM §8.3) :
//   A — Depuis une analyse existante : query param `fromAnalysis=ID`
//       → l'URL ou les filtres de l'analyse sont AUTO-RÉUTILISÉS
//       → form épuré : juste nom + score + sensibilité + canal
//   B — Depuis zéro : URL libre (form complet)
//   C — Conversion auto : redirect avec context (= mode A)
//
// PR-J : quand on vient d'une analyse, on ne redemande PAS l'URL — elle
// est déjà parfaitement définie par l'analyse source. Si l'analyse a été
// créée en mode "filters" (search_filters JSONB), on transfère ces
// filtres dans watches.search_filters. Si elle a un source_url legacy,
// on le copie tel quel.

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Radar, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useCreateWatch } from "@/hooks/use-watches";
import { supabase } from "@/lib/supabase";
import { PLANS, type PlanId, WATCH_EXPIRATION } from "@immoscan/shared";

export interface NouvelleSearch {
  fromAnalysis?: string;
}

export const Route = createFileRoute("/app/veilles/nouvelle")({
  validateSearch: (s: Record<string, unknown>): NouvelleSearch => ({
    fromAnalysis: typeof s.fromAnalysis === "string" ? s.fromAnalysis : undefined,
  }),
  component: NewWatchPage,
});

const SOURCE_OPTIONS = [
  { value: "seloger", label: "SeLoger" },
  { value: "leboncoin", label: "Leboncoin" },
  { value: "pap", label: "PAP" },
  { value: "bienici", label: "Bien'ici" },
] as const;

type SourceSite = (typeof SOURCE_OPTIONS)[number]["value"];

interface AnalysisPrefill {
  /** Mode de l'analyse source. */
  mode: "url" | "filters";
  /** Nom suggéré pour la veille (depuis analyse.name). */
  name: string;
  /** Court résumé humain des filtres / ville. */
  summary: string;
  /** Pour mode url : URL et site source. */
  source_url?: string;
  source_site?: SourceSite;
  /** Pour mode filters : objet search_filters de l'analyse. */
  search_filters?: Record<string, unknown>;
}

function NewWatchPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = useProfile();
  const search = useSearch({ from: "/app/veilles/nouvelle" });
  const createWatch = useCreateWatch();

  const plan: PlanId = (profile.data?.subscription_plan ?? "free") as PlanId;
  const planDef = PLANS[plan];

  // État form complet (mode B "depuis zéro")
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSite, setSourceSite] = useState<SourceSite>("seloger");
  const [scoreThreshold, setScoreThreshold] = useState(70);
  const [sensitivity, setSensitivity] = useState<"strict" | "moderate" | "permissive">(
    "moderate",
  );

  // État spécifique au préfill depuis analyse (mode A)
  const [prefill, setPrefill] = useState<AnalysisPrefill | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      navigate({ to: "/auth/login" });
    }
  }, [auth.isLoading, auth.user, navigate]);

  // Préfill depuis une analyse
  useEffect(() => {
    if (!search.fromAnalysis || !auth.user) return;
    let cancelled = false;
    setPrefillLoading(true);
    (async () => {
      const { data } = await supabase
        .from("analyses")
        .select("name, source_url, source_site, search_filters, ville, code_postal")
        .eq("id", search.fromAnalysis!)
        .single();
      if (cancelled || !data) {
        setPrefillLoading(false);
        return;
      }

      const suggestedName = data.name
        ? `Veille — ${data.name}`
        : data.ville
          ? `Veille ${data.ville}`
          : "Nouvelle veille";

      // Mode "filters" si search_filters set (form moderne)
      // Sinon mode "url" (legacy URL par site)
      if (data.search_filters && typeof data.search_filters === "object") {
        const sf = data.search_filters as Record<string, unknown>;
        const summary = buildFiltersSummary(sf, data.ville, data.code_postal);
        setPrefill({
          mode: "filters",
          name: suggestedName,
          summary,
          search_filters: sf,
        });
      } else if (data.source_url) {
        const site: SourceSite = SOURCE_OPTIONS.some((o) => o.value === data.source_site)
          ? (data.source_site as SourceSite)
          : "seloger";
        const summary = `${data.ville ?? "Recherche"}${data.code_postal ? ` (${data.code_postal})` : ""} · ${SOURCE_OPTIONS.find((o) => o.value === site)?.label ?? site}`;
        setPrefill({
          mode: "url",
          name: suggestedName,
          summary,
          source_url: data.source_url,
          source_site: site,
        });
      }

      setName(suggestedName);
      setPrefillLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [search.fromAnalysis, auth.user]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom de la veille est obligatoire");
      return;
    }

    const expiresAt =
      plan === "free"
        ? new Date(Date.now() + WATCH_EXPIRATION.free.durationDays * 24 * 3600 * 1000).toISOString()
        : null;
    const frequency = planDef.watchFrequency === "daily" ? "daily" : "three_days";

    // Payload : mode prefill (filters ou url) ou mode form complet
    let payload: Parameters<typeof createWatch.mutate>[0];
    if (prefill?.mode === "filters" && prefill.search_filters) {
      payload = {
        name: name.trim(),
        // source_site requis par enum NOT NULL côté DB — valeur arbitraire,
        // le worker dispatch sur dltik multi-source car search_filters set.
        source_site: "seloger",
        search_filters: prefill.search_filters as never,
        score_threshold: scoreThreshold,
        sensitivity,
        notify_email: true,
        expires_at: expiresAt,
        frequency,
        _fromAnalysis: true,
      };
    } else if (prefill?.mode === "url" && prefill.source_url && prefill.source_site) {
      payload = {
        name: name.trim(),
        source_url: prefill.source_url,
        source_site: prefill.source_site,
        score_threshold: scoreThreshold,
        sensitivity,
        notify_email: true,
        expires_at: expiresAt,
        frequency,
        _fromAnalysis: true,
      };
    } else {
      // Mode B : form complet, URL saisie manuellement
      if (!sourceUrl.trim()) {
        toast.error("URL source obligatoire");
        return;
      }
      payload = {
        name: name.trim(),
        source_url: sourceUrl.trim(),
        source_site: sourceSite,
        score_threshold: scoreThreshold,
        sensitivity,
        notify_email: true,
        expires_at: expiresAt,
        frequency,
        _fromAnalysis: false,
      };
    }

    createWatch.mutate(payload, {
      onSuccess: (data) => {
        toast.success("Veille créée — 1er scout au prochain cron.");
        navigate({ to: "/app/veilles/$id", params: { id: data.id } });
      },
      onError: (err) => {
        toast.error(`Erreur création : ${(err as Error).message}`);
      },
    });
  }

  const fromAnalysis = !!search.fromAnalysis;

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={plan}
      currentRoute="veilles"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/app/veilles" })}
          className="inline-flex items-center text-xs text-mute-2 hover:text-ink"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Mes veilles
        </button>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Nouvelle veille</h1>
          <p className="mt-1 text-sm text-muted-ink">
            {plan === "free"
              ? "Ta veille gratuite tournera 3×/semaine pendant 60 jours."
              : `${planDef.watchFrequency === "daily" ? "Scout quotidien" : "Scout 3 fois/sem"} · jusqu'à ${planDef.itemsMaxPerWatchRun} biens par run.`}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Radar className="mr-1.5 inline h-4 w-4" />
              Paramètres
            </CardTitle>
            <CardDescription>
              On scoute ta recherche et on t'envoie un digest email uniquement
              si on trouve quelque chose qui mérite ton œil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mode A : préfill depuis analyse → bloc récapitulatif */}
              {fromAnalysis && prefillLoading && (
                <div className="flex items-center gap-2 rounded-r-md border border-line bg-bg-2/60 p-3 text-sm text-muted-ink">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement de l'analyse source…
                </div>
              )}

              {fromAnalysis && !prefillLoading && prefill && (
                <div className="rounded-r-md border border-violet/20 bg-violet-soft p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium text-violet-deep">
                        Veille basée sur ton analyse
                      </div>
                      <div className="text-xs text-violet-deep/80">
                        {prefill.summary}
                      </div>
                      <div className="text-[11px] text-violet-deep/70 font-mono tnum">
                        {prefill.mode === "filters"
                          ? "Mode multi-source (LBC + SeLoger + PAP + Bien'ici)"
                          : `Source unique : ${SOURCE_OPTIONS.find((o) => o.value === prefill.source_site)?.label ?? prefill.source_site}`}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 border-t border-violet/20 pt-2 text-[11px] text-violet-deep/70">
                    Pour changer les critères, recrée une veille depuis{" "}
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/app/veilles/nouvelle" })}
                      className="font-medium text-violet hover:underline"
                    >
                      ce lien
                    </button>
                    .
                  </p>
                </div>
              )}

              {/* Nom : toujours visible */}
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la veille</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gagny — appartements F3-F4 < 250k€"
                  required
                />
              </div>

              {/* URL + source : visibles uniquement en mode B (pas de préfill) */}
              {!fromAnalysis && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="source_url">URL de recherche</Label>
                    <Input
                      id="source_url"
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://www.seloger.com/list.htm?…"
                      required
                    />
                    <p className="text-[11px] text-mute-2">
                      Colle ici l'URL de ta recherche enregistrée sur SeLoger /
                      LBC / PAP.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Source</Label>
                    <RadioGroup
                      value={sourceSite}
                      onValueChange={(v) => setSourceSite(v as SourceSite)}
                      className="flex flex-wrap gap-3"
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <Label
                          key={opt.value}
                          htmlFor={`src-${opt.value}`}
                          className="flex cursor-pointer items-center gap-1.5 rounded-r-sm border border-line px-3 py-1.5 text-sm hover:bg-bg-2"
                        >
                          <RadioGroupItem id={`src-${opt.value}`} value={opt.value} />
                          {opt.label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                </>
              )}

              {/* Score : toujours visible */}
              <div className="space-y-2">
                <Label htmlFor="score">
                  Seuil de score d'opportunité : <strong>{scoreThreshold}</strong> / 100
                </Label>
                <input
                  id="score"
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={scoreThreshold}
                  onChange={(e) => setScoreThreshold(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <p className="text-[11px] text-mute-2">
                  Seuls les biens ≥ {scoreThreshold} déclenchent un événement
                  «&nbsp;nouveau bien&nbsp;» dans le digest.
                </p>
              </div>

              {/* Sensibilité : toujours visible */}
              <div className="space-y-2">
                <Label>Sensibilité décotes (vs médian DVF)</Label>
                <RadioGroup
                  value={sensitivity}
                  onValueChange={(v) => setSensitivity(v as typeof sensitivity)}
                  className="grid gap-2"
                >
                  {(
                    [
                      ["strict", "Strict -20%", "Moins de faux positifs, manque des opportunités"],
                      ["moderate", "Modéré -15% (défaut)", "Équilibre signal / bruit"],
                      ["permissive", "Permissif -10%", "Plus de signaux, à vérifier sur place"],
                    ] as const
                  ).map(([val, label, hint]) => (
                    <Label
                      key={val}
                      htmlFor={`sens-${val}`}
                      className="flex cursor-pointer items-start gap-2 rounded-r-sm border border-line px-3 py-2 hover:bg-bg-2"
                    >
                      <RadioGroupItem
                        id={`sens-${val}`}
                        value={val}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-ink">{label}</div>
                        <div className="text-xs text-mute-2">{hint}</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Canaux de notification</Label>
                <div className="rounded-r-sm border border-line bg-bg-2/60 px-3 py-2 text-sm text-mute-2">
                  Email digest uniquement
                  <span className="ml-2 text-xs">
                    (push/Telegram arrivent en V2)
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={createWatch.isPending || (fromAnalysis && prefillLoading)}
                >
                  {createWatch.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Radar className="mr-1.5 h-4 w-4" />
                  )}
                  Créer ma veille
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function buildFiltersSummary(
  sf: Record<string, unknown>,
  ville: string | null,
  code_postal: string | null,
): string {
  const parts: string[] = [];
  const cities = (sf.cities as string[] | undefined)?.filter(Boolean) ?? [];
  if (cities.length > 0) {
    parts.push(cities.slice(0, 3).join(", ") + (cities.length > 3 ? "…" : ""));
  } else if (ville) {
    parts.push(ville + (code_postal ? ` (${code_postal})` : ""));
  }
  const types = (sf.propertyTypes as string[] | undefined) ?? [];
  if (types.length > 0) parts.push(types.join(" · "));
  const priceMax = sf.priceMax as number | undefined;
  if (priceMax) parts.push(`< ${Math.round(priceMax / 1000)}k€`);
  const surfMin = sf.surfaceMin as number | undefined;
  const surfMax = sf.surfaceMax as number | undefined;
  if (surfMin || surfMax) {
    parts.push(`${surfMin ?? "—"}-${surfMax ?? "—"} m²`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Recherche personnalisée";
}
