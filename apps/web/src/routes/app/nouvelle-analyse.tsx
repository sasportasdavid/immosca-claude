// /app/nouvelle-analyse — formulaire structuré (ville, types, prix, sources)
// pour lancer une analyse via l'actor multi-source `dltik/pige-immo-fr-scraper`.
//
// L'ancien input "URL SeLoger" → azzouzana a été remplacé par ce form
// car azzouzana ne retourne pas de lat/lng précis. dltik est meilleur
// sur tous les axes (multi-source, dédup, lat/lng adresse, ADEME enrich).
//
// Snapshot `search_filters` + `params_snapshot` immutables au moment du
// run (la table `analyses` les conserve pour traçabilité).

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { CommuneAutocomplete } from "@/components/commune-autocomplete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useUserParams } from "@/hooks/use-user-params";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";
import { findCommunesInRadius, type Commune } from "@/lib/commune-search";
import { trackEvent } from "@/lib/posthog";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/nouvelle-analyse")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: NouvelleAnalysePage,
});

const SOURCE_OPTIONS = [
  { id: "seloger", label: "SeLoger" },
  { id: "leboncoin", label: "Leboncoin" },
  { id: "pap", label: "PAP" },
  { id: "bienici", label: "Bien'ici" },
  { id: "logic-immo", label: "Logic-immo" },
] as const;

const TYPE_OPTIONS = [
  { id: "appartement", label: "Appartement" },
  { id: "maison", label: "Maison" },
  { id: "terrain", label: "Terrain" },
  { id: "immeuble", label: "Immeuble" },
] as const;

// Détection du site à partir d'une URL — miroir du `detectSiteFromUrl`
// côté worker. On garde la logique synchro pour le preview UI.
function detectSiteFromUrl(
  url: string,
): "seloger" | "leboncoin" | "pap" | "bienici" | "logic-immo" | null {
  if (/seloger\.com/i.test(url)) return "seloger";
  if (/leboncoin\.fr/i.test(url)) return "leboncoin";
  if (/(?:^|\.)pap\.fr/i.test(url)) return "pap";
  if (/bienici\.com/i.test(url)) return "bienici";
  if (/logic-immo\.com/i.test(url)) return "logic-immo";
  return null;
}

const SITE_LABELS: Record<string, string> = {
  seloger: "SeLoger",
  leboncoin: "Leboncoin",
  pap: "PAP",
  bienici: "Bien'ici",
  "logic-immo": "Logic-immo",
};

// Couleurs des badges de source — alignées sur le handoff
// (tag colorimétrique par origine d'annonce).
const SITE_BADGE_CLASS: Record<string, string> = {
  seloger: "bg-[#FFE2E5] text-[#991B1B]",
  leboncoin: "bg-[#FEF3C7] text-[#92400E]",
  pap: "bg-[#DBEAFE] text-[#1E40AF]",
  bienici: "bg-violet-soft text-violet-deep",
  "logic-immo": "bg-bg-2 text-ink-2",
};

const formSchema = z
  .object({
    name: z.string().trim().max(80, "Max 80 caractères").optional(),
    mode: z.enum(["filters", "urls"]).default("filters"),

    // Mode "filters" — recherche guidée par form
    city: z.string().trim().max(60).optional().or(z.literal("")),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{4,5}$/, "Code postal à 4-5 chiffres")
      .optional()
      .or(z.literal("")),
    transaction: z.enum(["buy", "rent"]).default("buy"),
    propertyTypes: z
      .array(z.enum(["appartement", "maison", "terrain", "immeuble"]))
      .optional(),
    priceMax: z
      .number()
      .int()
      .min(10_000, "Min 10 000 €")
      .max(50_000_000)
      .optional(),
    priceMin: z.number().int().min(0).max(50_000_000).optional(),
    surfaceMin: z.number().int().min(5).max(2000).optional(),
    surfaceMax: z.number().int().min(5).max(2000).optional(),
    sources: z
      .array(z.enum(["leboncoin", "seloger", "pap", "bienici", "logic-immo"]))
      .optional(),

    // Mode "urls" — copier-coller multi-URLs
    urlsList: z.string().optional(),

    // Override params (optionnel — sinon profil)
    overrideParams: z.boolean().optional(),
    apport: z.number().min(0).max(10_000_000).optional(),
    taux_credit_pct: z.number().min(0).max(15).optional(),
    duree_credit_ans: z.number().int().min(5).max(30).optional(),
    tmi_pct: z.number().int().min(0).max(50).optional(),
    rendement_min_pct: z.number().min(0).max(30).optional(),
  })
  .refine(
    (v) => {
      if (v.mode === "filters") {
        return (
          !!v.city &&
          v.city.trim().length >= 2 &&
          !!v.propertyTypes &&
          v.propertyTypes.length > 0 &&
          !!v.priceMax
        );
      }
      // mode === "urls" : on demande au moins 1 URL non vide reconnue
      const urls = (v.urlsList ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return urls.length > 0;
    },
    {
      message: "Renseigne ville/types/prix max OU au moins 1 URL",
    },
  );

type FormInput = z.infer<typeof formSchema>;

function suggestName(city: string): string {
  return `${city} · ${new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}

function NouvelleAnalysePage() {
  const auth = useAuth();
  const profile = useProfile();
  const userParams = useUserParams();
  const navigate = useNavigate();

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mode: "filters",
      city: "",
      postalCode: "",
      transaction: "buy",
      propertyTypes: ["appartement", "maison"],
      priceMax: 500_000,
      priceMin: undefined,
      surfaceMin: undefined,
      surfaceMax: undefined,
      sources: ["leboncoin", "seloger", "pap", "bienici"],
      urlsList: "",
      overrideParams: false,
      apport: undefined,
      taux_credit_pct: undefined,
      duree_credit_ans: undefined,
      tmi_pct: undefined,
      rendement_min_pct: undefined,
    },
  });

  const overrideParams = form.watch("overrideParams");
  const mode = form.watch("mode");
  const urlsListRaw = form.watch("urlsList") ?? "";

  // Parse live des URLs (pour preview "5 URLs · 2 SeLoger, 3 LBC")
  const parsedUrls = urlsListRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ url, site: detectSiteFromUrl(url) }));
  const urlsBySite = parsedUrls.reduce<Record<string, number>>((acc, u) => {
    const key = u.site ?? "inconnu";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const unknownUrlsCount = parsedUrls.filter((u) => u.site === null).length;

  // Commune sélectionnée via l'autocomplete (state local, hors form).
  // Permet d'enrichir search_filters avec code INSEE, département,
  // centre géo — pas juste le nom de ville saisi.
  const [selectedCommune, setSelectedCommune] = useState<Commune | null>(null);

  // Rayon en km autour de la commune pivot. 0 = juste la ville pivot.
  const [radiusKm, setRadiusKm] = useState<number>(0);

  // Communes incluses dans le rayon (calculé async). Vide si radiusKm=0.
  const [communesInRadius, setCommunesInRadius] = useState<
    Array<Commune & { distanceKm: number }>
  >([]);
  const [radiusLoading, setRadiusLoading] = useState(false);

  // Recalcule la liste des communes incluses quand pivot ou rayon change.
  // Debounce léger pour éviter de cogner l'API à chaque tick du slider.
  useEffect(() => {
    if (!selectedCommune?.centre || radiusKm <= 0) {
      setCommunesInRadius([]);
      return;
    }
    const [lng, lat] = selectedCommune.centre.coordinates;
    setRadiusLoading(true);
    const t = setTimeout(async () => {
      const list = await findCommunesInRadius(lat, lng, radiusKm);
      setCommunesInRadius(list);
      setRadiusLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [selectedCommune, radiusKm]);

  const createAnalysis = useMutation({
    mutationFn: async (values: FormInput) => {
      if (!auth.user) throw new Error("Pas de session");

      // Construction du snapshot params (profil + override éventuel)
      const base = userParams.data;
      const ov = values.overrideParams === true;
      const params_snapshot = {
        strategy: base?.strategy ?? null,
        apport: ov && values.apport !== undefined
          ? values.apport
          : (base?.apport ?? null),
        budget_max: base?.budget_max ?? null,
        taux_credit_pct: ov && values.taux_credit_pct !== undefined
          ? values.taux_credit_pct
          : (base?.taux_credit_pct ?? null),
        duree_credit_ans: ov && values.duree_credit_ans !== undefined
          ? values.duree_credit_ans
          : (base?.duree_credit_ans ?? null),
        tmi_pct: ov && values.tmi_pct !== undefined
          ? values.tmi_pct
          : (base?.tmi_pct ?? null),
        rendement_min_pct: ov && values.rendement_min_pct !== undefined
          ? values.rendement_min_pct
          : (base?.rendement_min_pct ?? null),
        tolerance_travaux: base?.tolerance_travaux ?? null,
      };

      // Branche selon le mode : "filters" → dltik form, "urls" → multi-URLs
      // routées vers actors spécialisés par site (cf. ACTOR_BY_SITE worker).
      let search_filters: Record<string, unknown>;
      let analysisName: string;
      let analysisVille: string | null = null;
      let analysisCp: string | null = null;

      if (values.mode === "urls") {
        const urls = (values.urlsList ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (urls.length === 0) {
          throw new Error("Aucune URL fournie");
        }
        // On garde toutes les URLs (y compris inconnues) — le worker
        // détecte le site et skip celles qu'il ne sait pas router.
        search_filters = {
          urlsList: urls,
          // Hints éventuels que le worker peut utiliser pour scoring
          transaction: values.transaction,
        };
        analysisName =
          values.name?.trim() ||
          `Multi-URLs · ${new Date().toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`;
      } else {
        // Mode "filters" — recherche guidée
        const sc = selectedCommune;
        const allCommunes =
          radiusKm > 0 && communesInRadius.length > 0
            ? communesInRadius
            : sc
              ? [{ ...sc, distanceKm: 0 }]
              : [];
        const cities = allCommunes.map((c) => c.nom);
        const postalCodes = Array.from(
          new Set(allCommunes.flatMap((c) => c.codesPostaux ?? [])),
        );
        const departments = Array.from(
          new Set(
            allCommunes
              .map((c) => c.codeDepartement)
              .filter((d): d is string => !!d),
          ),
        );
        search_filters = {
          cities: cities.length > 0 ? cities : [values.city],
          postalCodes:
            postalCodes.length > 0
              ? postalCodes
              : values.postalCode
                ? [values.postalCode]
                : [],
          departments,
          codeInsee: sc?.code, // pivot uniquement (pour DVF lookup)
          centre: sc?.centre
            ? {
                lat: sc.centre.coordinates[1],
                lng: sc.centre.coordinates[0],
                radiusKm,
              }
            : null,
          transaction: values.transaction,
          propertyTypes: values.propertyTypes,
          priceMin: values.priceMin ?? null,
          priceMax: values.priceMax,
          surfaceMin: values.surfaceMin ?? null,
          surfaceMax: values.surfaceMax ?? null,
          sources: values.sources,
          maxResultsPerSource: 200,
          enrichDpe: true,
          dedupAcrossSources: true,
        };
        analysisName =
          values.name?.trim() || suggestName(values.city ?? "Recherche");
        analysisVille = values.city ?? null;
        analysisCp = values.postalCode || null;
      }

      const { data, error } = await supabase
        .from("analyses")
        .insert({
          profile_id: auth.user.id,
          source_url: null, // on n'a plus d'URL unique, c'est le form qui fait foi
          source_site: "seloger", // valeur arbitraire (enum NOT NULL), le
          //                          worker overwritera avec la vraie source
          //                          par bien quand il insère listings
          params_snapshot,
          // search_filters est typé Json côté Supabase — on cast car notre
          // shape Record<string, unknown> est garantie JSON-compatible
          // (uniquement des primitives + arrays + objets plats).
          search_filters: search_filters as never,
          status: "pending",
          name: analysisName,
          ville: analysisVille,
          code_postal: analysisCp,
        })
        .select("id")
        .single();
      if (error) throw error;

      // PostHog : analyse lancée — track avant invoke pour ne pas perdre
      // l'event si trigger-analyze échoue.
      trackEvent({
        name: "analysis_started",
        props: {
          source_site: values.mode === "urls" ? "multi" : "filters",
          from_url: values.mode === "urls",
          from_paste_urls: values.mode === "urls",
        },
      });

      // Déclenche la task Trigger.dev
      const invokeRes = await supabase.functions.invoke("trigger-analyze", {
        body: { analysisId: data.id },
      });
      if (invokeRes.error) {
        await supabase
          .from("analyses")
          .update({
            status: "failed",
            error_message: `trigger-analyze: ${invokeRes.error.message ?? "erreur inconnue"}`,
          })
          .eq("id", data.id);
        throw new Error(
          `Impossible de démarrer l'analyse : ${invokeRes.error.message}`,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success("Analyse créée — démarrage en cours.");
      navigate({ to: "/app/analyses/$id", params: { id: data.id } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Impossible de créer");
    },
  });

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
    >
      <div className="mx-auto max-w-[860px] px-6 py-10 pb-32">
        {/* ── En-tête de page ── */}
        <Eyebrow>Nouvelle analyse</Eyebrow>
        <h1 className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
          Décris ta recherche.
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-muted-ink">
          Donne l'URL de ta recherche SeLoger, Leboncoin ou PAP, ou cible une zone.
          On récupère 100 à 500 annonces, on croise avec DVF, DPE et Géorisques,
          et on te livre un rapport noté en 8 minutes.
        </p>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => createAnalysis.mutate(v))}
            className="mt-8 space-y-4"
          >
            {/* ── Mode switch (URLs vs Recherche guidée) ── */}
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <div className="grid grid-cols-1 gap-1 rounded-r-lg border border-line bg-bg-2 p-1 sm:grid-cols-2">
                    {[
                      {
                        id: "urls" as const,
                        title: "Coller des URLs",
                        sub: "Le plus rapide — copie l'URL d'une page de résultats SeLoger, LBC, PAP ou Bien'ici.",
                        reco: true,
                      },
                      {
                        id: "filters" as const,
                        title: "Recherche guidée",
                        sub: "Définis ville, prix, surface, type — on cherche pour toi sur 5 sources en parallèle.",
                        reco: false,
                      },
                    ].map((opt) => {
                      const active = field.value === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => field.onChange(opt.id)}
                          className={`flex items-start gap-3 rounded-r p-3 text-left transition-all ${
                            active
                              ? "bg-card shadow-lvl-1"
                              : "bg-transparent hover:bg-card/60"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-r-sm border text-[13px] ${
                              active
                                ? "border-violet/20 bg-violet-soft text-violet"
                                : "border-line bg-card text-mute-2"
                            }`}
                            aria-hidden
                          >
                            {opt.id === "urls" ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                              </svg>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
                                {opt.title}
                              </span>
                              {opt.reco ? (
                                <Badge variant="violet" className="h-[18px] px-1.5 text-[10px] uppercase tracking-[0.04em]">
                                  Recommandé
                                </Badge>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-[11.5px] leading-[1.4] text-mute-2">
                              {opt.sub}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Nom de l'analyse (optionnel, toujours visible) ── */}
            <div className="rounded-r-lg border border-line bg-card p-5 shadow-lvl-1">
              <div className="mb-4 flex items-baseline gap-3">
                <Eyebrow>Nom de la recherche</Eyebrow>
                <span className="text-[12px] text-mute-2">optionnel</span>
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Ex. Gagny été 2026 — appart 2 pièces"
                        maxLength={80}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Pour t'y retrouver entre plusieurs analyses.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* ── Mode URLs ── */}
            {mode === "urls" ? (
              <div className="rounded-r-lg border border-line bg-card p-5 shadow-lvl-1">
                <div className="mb-4 flex items-baseline gap-3">
                  <Eyebrow>1. Colle l'URL de ta recherche</Eyebrow>
                  <span className="text-[12px] text-mute-2">
                    une URL par ligne · maximum 5
                  </span>
                </div>
                <FormField
                  control={form.control}
                  name="urlsList"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          className="min-h-[160px] font-mono text-[12.5px] leading-relaxed tnum"
                          placeholder={`https://www.seloger.com/list.htm?ci=750056&px=300000-600000
https://www.leboncoin.fr/recherche?category=9&locations=Paris
https://www.pap.fr/annonce/vente-appartement-paris-11`}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>

                      {parsedUrls.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-r border border-line bg-bg-2 px-3 py-2.5 text-[12.5px]">
                          <Badge variant="sage" className="gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                            {parsedUrls.length} URL
                            {parsedUrls.length > 1 ? "s" : ""} détectée
                            {parsedUrls.length > 1 ? "s" : ""}
                          </Badge>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-mute-2">Sources :</span>
                            {Object.entries(urlsBySite).map(([site, count]) => {
                              if (site === "inconnu") {
                                return (
                                  <span
                                    key={site}
                                    className="font-mono text-[11px] text-destructive"
                                  >
                                    {count} non reconnue
                                    {count > 1 ? "s" : ""}
                                  </span>
                                );
                              }
                              return (
                                <span
                                  key={site}
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.04em] ${
                                    SITE_BADGE_CLASS[site] ??
                                    "bg-bg-2 text-ink-2"
                                  }`}
                                >
                                  {SITE_LABELS[site] ?? site} · {count}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <FormDescription>
                          Mélange plusieurs sites et plusieurs recherches dans la même analyse.
                        </FormDescription>
                      )}

                      {unknownUrlsCount > 0 ? (
                        <p className="mt-2 text-[11.5px] text-mute-2">
                          Sites supportés : SeLoger, Leboncoin, PAP, Bien'ici, Logic-immo. Les URLs hors de cette liste sont ignorées.
                        </p>
                      ) : null}

                      <div className="mt-3 rounded-r border border-violet-soft bg-violet-soft/40 p-3">
                        <div className="mb-1.5">
                          <Eyebrow variant="violet">
                            URL de recherche, pas d'annonce
                          </Eyebrow>
                        </div>
                        <p className="text-[11.5px] leading-relaxed text-muted-ink">
                          Va sur SeLoger, LBC, PAP ou Bien'ici, fais ta recherche habituelle (ville, prix, surface), puis copie l'URL de la page de résultats — pas l'URL d'une annonce. Exemple valide :{" "}
                          <code className="rounded border border-line bg-card px-1 py-0.5 font-mono text-[11px] text-ink-2">
                            seloger.com/list.htm?ci=…
                          </code>
                          . Exemple à éviter :{" "}
                          <code className="rounded border border-line bg-card px-1 py-0.5 font-mono text-[11px] text-ink-2">
                            seloger.com/annonces/achat/appartement/124847291.htm
                          </code>{" "}
                          (une seule annonce).
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {/* ── Mode Recherche guidée ── */}
            {mode === "filters" ? (
              <>
                {/* Localisation */}
                <div className="rounded-r-lg border border-line bg-card p-5 shadow-lvl-1">
                  <div className="mb-4 flex items-baseline gap-3">
                    <Eyebrow>1. Localisation</Eyebrow>
                    <span className="text-[12px] text-mute-2">
                      on cherche dans cette zone
                    </span>
                  </div>

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Ville
                          <span className="ml-2 text-[11.5px] font-normal text-mute-2">
                            autocomplétion INSEE
                          </span>
                        </FormLabel>
                        <FormControl>
                          <CommuneAutocomplete
                            id="city-input"
                            value={field.value ?? ""}
                            onChange={(val) => {
                              field.onChange(val);
                              // Si l'user retape après pick, on invalide la
                              // sélection (sinon CP/INSEE deviennent obsolètes)
                              if (
                                selectedCommune &&
                                val.toLowerCase() !==
                                  selectedCommune.nom.toLowerCase()
                              ) {
                                setSelectedCommune(null);
                                form.setValue("postalCode", "");
                              }
                            }}
                            onSelect={(commune) => {
                              setSelectedCommune(commune);
                              field.onChange(commune.nom);
                              // Auto-fill du CP (1er si plusieurs — l'user
                              // verra "+N" dans la liste pour les communes
                              // multi-CP comme Paris)
                              form.setValue(
                                "postalCode",
                                commune.codesPostaux[0] ?? "",
                              );
                            }}
                            placeholder="Tape les 2 premières lettres…"
                            autoFocus
                          />
                        </FormControl>
                        <FormDescription>
                          {selectedCommune ? (
                            <span className="font-mono text-[11.5px] text-ink-2">
                              {selectedCommune.nom} ·{" "}
                              {selectedCommune.codesPostaux.join(", ")} · INSEE{" "}
                              {selectedCommune.code} · dép.{" "}
                              {selectedCommune.codeDepartement}
                            </span>
                          ) : (
                            "Suggestions officielles INSEE via geo.api.gouv.fr."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Code postal — hidden, rempli par l'autocomplete */}
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <input type="hidden" {...field} />
                    )}
                  />

                  {/* Slider rayon — visible seulement si commune sélectionnée */}
                  {selectedCommune?.centre ? (
                    <div className="mt-5">
                      <div className="mb-2 flex items-baseline justify-between">
                        <label
                          htmlFor="radius-slider"
                          className="text-[11.5px] font-medium text-ink-2"
                        >
                          Rayon autour de {selectedCommune.nom}
                        </label>
                        <span className="font-mono text-[13px] tnum text-ink">
                          {radiusKm === 0 ? (
                            <span className="text-mute-2">Ville seule</span>
                          ) : (
                            <>
                              <span className="font-semibold text-violet">
                                {radiusKm}
                              </span>{" "}
                              km
                            </>
                          )}
                        </span>
                      </div>
                      <input
                        id="radius-slider"
                        type="range"
                        min={0}
                        max={30}
                        step={1}
                        value={radiusKm}
                        onChange={(e) => setRadiusKm(Number(e.target.value))}
                        className="h-1.5 w-full appearance-none rounded-full bg-bg-2 accent-violet outline-none"
                      />
                      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
                        <span>0 km</span>
                        <span>5 km</span>
                        <span>10 km</span>
                        <span>20 km</span>
                        <span>30 km</span>
                      </div>
                      {radiusKm > 0 ? (
                        <details className="mt-3 rounded-r border border-line bg-bg-2 p-3 text-[12px] leading-relaxed text-muted-ink">
                          <summary className="cursor-pointer">
                            {radiusLoading ? (
                              <span className="text-mute-2">
                                Calcul des communes incluses…
                              </span>
                            ) : (
                              <span>
                                <strong className="font-mono text-ink">
                                  {communesInRadius.length}
                                </strong>{" "}
                                commune
                                {communesInRadius.length > 1 ? "s" : ""} incluse
                                {communesInRadius.length > 1 ? "s" : ""} dans le rayon
                              </span>
                            )}
                          </summary>
                          {communesInRadius.length > 0 ? (
                            <ul className="mt-2 max-h-[180px] space-y-1 overflow-y-auto pr-2 text-[11.5px]">
                              {communesInRadius.map((c) => (
                                <li
                                  key={c.code}
                                  className="flex justify-between gap-2"
                                >
                                  <span className="text-ink-2">{c.nom}</span>
                                  <span className="font-mono text-mute-2">
                                    {c.distanceKm.toFixed(1)} km · {c.codesPostaux[0]}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Type de bien */}
                <div className="rounded-r-lg border border-line bg-card p-5 shadow-lvl-1">
                  <div className="mb-4 flex items-baseline gap-3">
                    <Eyebrow>2. Type de bien</Eyebrow>
                  </div>

                  <FormField
                    control={form.control}
                    name="propertyTypes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégories</FormLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {TYPE_OPTIONS.map((t) => {
                            const checked =
                              field.value?.includes(t.id) ?? false;
                            return (
                              <label
                                key={t.id}
                                className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-all ${
                                  checked
                                    ? "border-violet/30 bg-violet-soft font-medium text-violet-deep"
                                    : "border-line bg-card text-ink-2 hover:bg-bg-2"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = new Set(field.value ?? []);
                                    if (e.target.checked) next.add(t.id);
                                    else next.delete(t.id);
                                    field.onChange(Array.from(next));
                                  }}
                                  className="sr-only"
                                />
                                {checked ? (
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    className="text-violet"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : null}
                                {t.label}
                              </label>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transaction"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Transaction</FormLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "buy", label: "Achat" },
                            { id: "rent", label: "Location" },
                          ].map((t) => {
                            const checked = field.value === t.id;
                            return (
                              <label
                                key={t.id}
                                className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-all ${
                                  checked
                                    ? "border-violet/30 bg-violet-soft font-medium text-violet-deep"
                                    : "border-line bg-card text-ink-2 hover:bg-bg-2"
                                }`}
                              >
                                <input
                                  type="radio"
                                  value={t.id}
                                  checked={checked}
                                  onChange={() => field.onChange(t.id)}
                                  className="sr-only"
                                />
                                {checked ? (
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    className="text-violet"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : null}
                                {t.label}
                              </label>
                            );
                          })}
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="priceMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Prix min
                            <span className="ml-2 text-[11.5px] font-normal text-mute-2">
                              optionnel
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={5000}
                              min={0}
                              placeholder="0"
                              className="font-mono tnum"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priceMax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix max (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={5000}
                              min={10000}
                              className="font-mono tnum"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Filtres avancés (collapsible) */}
                <details className="group rounded-r-lg border border-line bg-card shadow-lvl-1 [&[open]_.chev]:rotate-180">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-5 transition-colors hover:bg-bg-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-r-sm bg-violet-soft text-violet"
                      aria-hidden
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="4" y1="21" x2="4" y2="14" />
                        <line x1="4" y1="10" x2="4" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12" y2="3" />
                        <line x1="20" y1="21" x2="20" y2="16" />
                        <line x1="20" y1="12" x2="20" y2="3" />
                        <line x1="1" y1="14" x2="7" y2="14" />
                        <line x1="9" y1="8" x2="15" y2="8" />
                        <line x1="17" y1="16" x2="23" y2="16" />
                      </svg>
                    </span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
                        Filtres avancés
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-mute-2">
                        Surface min/max et sources à interroger.
                      </div>
                    </div>
                    <svg
                      className="chev text-mute-2 transition-transform"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div className="border-t border-line p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="surfaceMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Surface min (m²)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={5}
                                placeholder="—"
                                className="font-mono tnum"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="surfaceMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Surface max (m²)
                              <span className="ml-2 text-[11.5px] font-normal text-mute-2">
                                optionnel
                              </span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={5}
                                placeholder="—"
                                className="font-mono tnum"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="sources"
                      render={({ field }) => (
                        <FormItem className="mt-5">
                          <FormLabel>Sources à interroger</FormLabel>
                          <div className="flex flex-wrap gap-1.5">
                            {SOURCE_OPTIONS.map((s) => {
                              const checked =
                                field.value?.includes(s.id) ?? false;
                              return (
                                <label
                                  key={s.id}
                                  className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-all ${
                                    checked
                                      ? "border-violet/30 bg-violet-soft font-medium text-violet-deep"
                                      : "border-line bg-card text-ink-2 hover:bg-bg-2"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = new Set(field.value ?? []);
                                      if (e.target.checked) next.add(s.id);
                                      else next.delete(s.id);
                                      field.onChange(Array.from(next));
                                    }}
                                    className="sr-only"
                                  />
                                  {checked ? (
                                    <svg
                                      width="11"
                                      height="11"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      className="text-violet"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : null}
                                  {s.label}
                                </label>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </details>
              </>
            ) : null}

            {/* ── Paramètres financiers (collapsible) ── */}
            <details className="group rounded-r-lg border border-line bg-card shadow-lvl-1 [&[open]_.chev]:rotate-180">
              <FormField
                control={form.control}
                name="overrideParams"
                render={({ field }) => (
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-5 transition-colors hover:bg-bg-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-r-sm bg-violet-soft text-violet"
                      aria-hidden
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
                        Personnaliser tes paramètres financiers
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-mute-2">
                        Sinon on utilise ceux de ton profil : apport{" "}
                        <span className="font-mono tnum">
                          {userParams.data?.apport?.toLocaleString("fr-FR") ??
                            "—"}
                        </span>{" "}
                        €, TMI{" "}
                        <span className="font-mono tnum">
                          {userParams.data?.tmi_pct ?? "—"}
                        </span>{" "}
                        %, rendement min{" "}
                        <span className="font-mono tnum">
                          {userParams.data?.rendement_min_pct ?? "—"}
                        </span>{" "}
                        %.
                      </div>
                    </div>
                    <label
                      className="flex cursor-pointer items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => {
                          field.onChange(e.target.checked);
                          if (e.target.checked && userParams.data) {
                            form.setValue(
                              "apport",
                              userParams.data.apport ?? 200_000,
                            );
                            form.setValue(
                              "taux_credit_pct",
                              userParams.data.taux_credit_pct ?? 3,
                            );
                            form.setValue(
                              "duree_credit_ans",
                              userParams.data.duree_credit_ans ?? 25,
                            );
                            form.setValue(
                              "tmi_pct",
                              userParams.data.tmi_pct ?? 30,
                            );
                            form.setValue(
                              "rendement_min_pct",
                              userParams.data.rendement_min_pct ?? 6,
                            );
                          }
                        }}
                        className="h-4 w-4 cursor-pointer rounded border-line accent-violet"
                      />
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] ${
                          field.value
                            ? "bg-violet-soft text-violet-deep"
                            : "bg-bg-2 text-mute-2"
                        }`}
                      >
                        {field.value ? "Personnalisé" : "Par défaut"}
                      </span>
                    </label>
                    <svg
                      className="chev text-mute-2 transition-transform"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                )}
              />
              {overrideParams ? (
                <div className="grid grid-cols-1 gap-4 border-t border-line p-5 md:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    form={form}
                    name="apport"
                    label="Apport (€)"
                    step={5000}
                    min={0}
                  />
                  <NumberField
                    form={form}
                    name="taux_credit_pct"
                    label="Taux crédit (%)"
                    step={0.05}
                    min={0}
                    max={15}
                  />
                  <NumberField
                    form={form}
                    name="duree_credit_ans"
                    label="Durée crédit (années)"
                    step={1}
                    min={5}
                    max={30}
                  />
                  <NumberField
                    form={form}
                    name="tmi_pct"
                    label="TMI (%)"
                    step={1}
                    min={0}
                    max={50}
                  />
                  <NumberField
                    form={form}
                    name="rendement_min_pct"
                    label="Rendement min (%)"
                    step={0.1}
                    min={0}
                    max={30}
                  />
                </div>
              ) : null}
            </details>

            {/* ── Sticky launch bar ── */}
            <div className="sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center gap-4 border-t border-line bg-card/95 px-6 py-3.5 shadow-lvl-2 backdrop-blur supports-[backdrop-filter]:bg-card/85">
              <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted-ink">
                {mode === "urls" ? (
                  parsedUrls.length > 0 ? (
                    <>
                      Prête à lancer :{" "}
                      <strong className="font-mono text-ink">
                        {parsedUrls.length} URL
                        {parsedUrls.length > 1 ? "s" : ""}
                      </strong>{" "}
                      ·{" "}
                      <span className="font-mono text-violet-deep">
                        {Object.keys(urlsBySite)
                          .filter((s) => s !== "inconnu")
                          .map((s) => SITE_LABELS[s] ?? s)
                          .join(" · ") || "—"}
                      </span>
                    </>
                  ) : (
                    <span className="text-mute-2">
                      Colle au moins une URL de recherche pour démarrer.
                    </span>
                  )
                ) : selectedCommune ? (
                  <>
                    Prête à lancer :{" "}
                    <strong className="font-mono text-ink">
                      {selectedCommune.nom}
                    </strong>
                    {radiusKm > 0 ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-mono text-violet-deep">
                          rayon {radiusKm} km
                        </span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="text-mute-2">
                    Choisis une ville pour démarrer.
                  </span>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={createAnalysis.isPending}
                className="min-w-[180px]"
              >
                {createAnalysis.isPending ? (
                  "Création…"
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Lancer l'analyse
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppShell>
  );
}

function NumberField({
  form,
  name,
  label,
  step,
  min,
  max,
}: {
  form: ReturnType<typeof useForm<FormInput>>;
  name: keyof FormInput;
  label: string;
  step: number;
  min?: number;
  max?: number;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step={step}
              min={min}
              max={max}
              className="font-mono tnum"
              value={
                field.value === undefined || field.value === null
                  ? ""
                  : String(field.value)
              }
              onChange={(e) =>
                field.onChange(
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
