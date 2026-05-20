// /app/veilles/nouvelle — formulaire de création d'une veille.
//
// 3 points d'entrée (BM §8.3) :
//   A — Depuis une analyse existante : query param `fromAnalysis=ID`
//       → pré-remplit name + source_url + source_site + search_filters
//   B — Depuis zéro : URL libre
//   C — Conversion auto : redirect avec context
//
// Côté UI on garde le form minimal (BM §8.3 form spec) :
//   - Name (auto-suggéré si fromAnalysis)
//   - source_url / source_site
//   - score_threshold (50-100, défaut 70)
//   - sensitivity (strict / moderate / permissive)
//   - canal (email only au launch)
//
// Le worker calcule `expires_at` automatiquement pour Free (J+60) et PPU (J+30).
// Pour V1 on set côté frontend selon plan : si Free/PPU → expires_at = now + 60j.

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Radar } from "lucide-react";
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

function NewWatchPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = useProfile();
  const search = useSearch({ from: "/app/veilles/nouvelle" });
  const createWatch = useCreateWatch();

  const plan: PlanId = (profile.data?.subscription_plan ?? "free") as PlanId;
  const planDef = PLANS[plan];

  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSite, setSourceSite] = useState<typeof SOURCE_OPTIONS[number]["value"]>("seloger");
  const [scoreThreshold, setScoreThreshold] = useState(70);
  const [sensitivity, setSensitivity] = useState<"strict" | "moderate" | "permissive">(
    "moderate",
  );

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      navigate({ to: "/auth/login" });
    }
  }, [auth.isLoading, auth.user, navigate]);

  // Préfill depuis une analyse
  useEffect(() => {
    if (!search.fromAnalysis || !auth.user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("analyses")
        .select("name, source_url, source_site, ville, code_postal")
        .eq("id", search.fromAnalysis!)
        .single();
      if (cancelled || !data) return;
      const suggested = data.name
        ? `Veille — ${data.name}`
        : data.ville
          ? `Veille ${data.ville}`
          : "Nouvelle veille";
      setName(suggested);
      if (data.source_url) setSourceUrl(data.source_url);
      if (data.source_site) {
        // Garde-fou : ne set que si dans nos options
        if (SOURCE_OPTIONS.some((o) => o.value === data.source_site)) {
          setSourceSite(data.source_site as typeof SOURCE_OPTIONS[number]["value"]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.fromAnalysis, auth.user]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !sourceUrl.trim()) {
      toast.error("Nom et URL source obligatoires");
      return;
    }
    // Calcul expires_at pour Free uniquement (les payants n'expirent pas).
    const expiresAt =
      plan === "free"
        ? new Date(Date.now() + WATCH_EXPIRATION.free.durationDays * 24 * 3600 * 1000).toISOString()
        : null;

    createWatch.mutate(
      {
        name: name.trim(),
        source_url: sourceUrl.trim(),
        source_site: sourceSite,
        score_threshold: scoreThreshold,
        sensitivity,
        notify_email: true,
        expires_at: expiresAt,
        frequency:
          planDef.watchFrequency === "daily" ? "daily" : "three_days",
      },
      {
        onSuccess: (data) => {
          toast.success("Veille créée — 1er scout au prochain cron.");
          navigate({ to: "/app/veilles/$id", params: { id: data.id } });
        },
        onError: (err) => {
          toast.error(`Erreur création : ${(err as Error).message}`);
        },
      },
    );
  }

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
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Mes veilles
        </button>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nouvelle veille</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
              On scoute ta recherche et on t'envoie un digest email uniquement si on
              trouve quelque chose qui mérite ton œil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <p className="text-[11px] text-muted-foreground">
                  Colle ici l'URL de ta recherche enregistrée sur SeLoger / LBC / PAP.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Source</Label>
                <RadioGroup
                  value={sourceSite}
                  onValueChange={(v) => setSourceSite(v as typeof sourceSite)}
                  className="flex flex-wrap gap-3"
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <Label
                      key={opt.value}
                      htmlFor={`src-${opt.value}`}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <RadioGroupItem id={`src-${opt.value}`} value={opt.value} />
                      {opt.label}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

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
                <p className="text-[11px] text-muted-foreground">
                  Seuls les biens ≥ {scoreThreshold} déclenchent un événement
                  "nouveau bien" dans le digest.
                </p>
              </div>

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
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/40"
                    >
                      <RadioGroupItem
                        id={`sens-${val}`}
                        value={val}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{hint}</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Canaux de notification</Label>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  📧 Email digest uniquement
                  <span className="ml-2 text-xs">
                    (push/Telegram arrivent en V2)
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={createWatch.isPending}>
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
