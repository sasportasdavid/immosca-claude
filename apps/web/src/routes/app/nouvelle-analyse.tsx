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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { Commune } from "@/lib/commune-search";

import { AppShell } from "@/components/app-shell";
import { CommuneAutocomplete } from "@/components/commune-autocomplete";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useUserParams } from "@/hooks/use-user-params";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";
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

const formSchema = z.object({
  name: z.string().trim().max(80, "Max 80 caractères").optional(),

  // Localisation
  city: z.string().trim().min(2, "Ville requise").max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{4,5}$/, "Code postal à 4-5 chiffres")
    .optional()
    .or(z.literal("")),

  // Critères
  transaction: z.enum(["buy", "rent"]).default("buy"),
  propertyTypes: z
    .array(z.enum(["appartement", "maison", "terrain", "immeuble"]))
    .min(1, "Coche au moins un type"),
  priceMax: z.number().int().min(10_000, "Min 10 000 €").max(50_000_000),
  priceMin: z.number().int().min(0).max(50_000_000).optional(),
  surfaceMin: z.number().int().min(5).max(2000).optional(),
  surfaceMax: z.number().int().min(5).max(2000).optional(),
  sources: z
    .array(z.enum(["leboncoin", "seloger", "pap", "bienici", "logic-immo"]))
    .min(1, "Au moins une source"),

  // Override params (optionnel — sinon profil)
  overrideParams: z.boolean().optional(),
  apport: z.number().min(0).max(10_000_000).optional(),
  taux_credit_pct: z.number().min(0).max(15).optional(),
  duree_credit_ans: z.number().int().min(5).max(30).optional(),
  tmi_pct: z.number().int().min(0).max(50).optional(),
  rendement_min_pct: z.number().min(0).max(30).optional(),
});

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
      city: "",
      postalCode: "",
      transaction: "buy",
      propertyTypes: ["appartement", "maison"],
      priceMax: 500_000,
      priceMin: undefined,
      surfaceMin: undefined,
      surfaceMax: undefined,
      sources: ["leboncoin", "seloger", "pap", "bienici"],
      overrideParams: false,
      apport: undefined,
      taux_credit_pct: undefined,
      duree_credit_ans: undefined,
      tmi_pct: undefined,
      rendement_min_pct: undefined,
    },
  });

  const overrideParams = form.watch("overrideParams");

  // Commune sélectionnée via l'autocomplete (state local, hors form).
  // Permet d'enrichir search_filters avec code INSEE, département,
  // centre géo — pas juste le nom de ville saisi.
  const [selectedCommune, setSelectedCommune] = useState<Commune | null>(null);

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

      // Filtres dltik (format PigeImmoFilters côté worker).
      // Si l'user a pické une commune dans l'autocomplete, on enrichit
      // avec tous ses codes postaux (Paris a 20 CP, Lyon en a 9, etc.)
      // et le département.
      const sc = selectedCommune;
      const search_filters = {
        cities: [values.city],
        postalCodes:
          sc?.codesPostaux?.length
            ? sc.codesPostaux
            : values.postalCode
              ? [values.postalCode]
              : [],
        departments: sc?.codeDepartement ? [sc.codeDepartement] : [],
        codeInsee: sc?.code, // pas dans le schema PigeImmoFilters mais utile
        //                      pour le worker (lookup DVF par code commune)
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

      const { data, error } = await supabase
        .from("analyses")
        .insert({
          profile_id: auth.user.id,
          source_url: null, // on n'a plus d'URL, c'est le form qui fait foi
          source_site: "seloger", // valeur arbitraire (enum NOT NULL), le
          //                          worker overwritera avec la vraie source
          //                          par bien quand il insère listings
          params_snapshot,
          search_filters,
          status: "pending",
          name: values.name?.trim() || suggestName(values.city),
          ville: values.city,
          code_postal: values.postalCode || null,
        })
        .select("id")
        .single();
      if (error) throw error;

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
          `Impossible de démarrer l'analyse: ${invokeRes.error.message}`,
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
      <div className="mx-auto max-w-[640px] px-6 py-12">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Nouvelle analyse
        </span>
        <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Décris ta recherche.
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          On collecte 100 à 500 annonces depuis SeLoger, Leboncoin, PAP et
          Bien'ici en croisant avec DVF, DPE et Géorisques. Rapport noté en
          ~8 minutes.
        </p>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => createAnalysis.mutate(v))}
            className="mt-8 space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la recherche (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Ex. Gagny été 2026 — appart 2P"
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

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <CommuneAutocomplete
                      id="city-input"
                      value={field.value}
                      onChange={(val) => {
                        field.onChange(val);
                        // Si l'user retape après pick, on invalide la
                        // sélection (sinon CP/INSEE deviennent obsolètes)
                        if (
                          selectedCommune &&
                          val.toLowerCase() !== selectedCommune.nom.toLowerCase()
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
                      <span className="font-mono">
                        {selectedCommune.nom} · {selectedCommune.codesPostaux.join(", ")}{" "}
                        · INSEE {selectedCommune.code} · dép. {selectedCommune.codeDepartement}
                      </span>
                    ) : (
                      "Suggestions officielles INSEE via geo.api.gouv.fr."
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Code postal : caché pour l'user (rempli par l'autocomplete),
                mais reste dans le form pour préserver la valeur si l'user
                tape manuellement sans pick. */}
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <input type="hidden" {...field} />
              )}
            />

            <FormField
              control={form.control}
              name="propertyTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de bien</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {TYPE_OPTIONS.map((t) => {
                      const checked = field.value?.includes(t.id) ?? false;
                      return (
                        <label
                          key={t.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                            checked
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-background hover:border-primary/40"
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
                <FormItem>
                  <FormLabel>Type de transaction</FormLabel>
                  <div className="flex gap-2">
                    {[
                      { id: "buy", label: "Achat" },
                      { id: "rent", label: "Location" },
                    ].map((t) => {
                      const checked = field.value === t.id;
                      return (
                        <label
                          key={t.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                            checked
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-background hover:border-primary/40"
                          }`}
                        >
                          <input
                            type="radio"
                            value={t.id}
                            checked={checked}
                            onChange={() => field.onChange(t.id)}
                            className="sr-only"
                          />
                          {t.label}
                        </label>
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priceMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix min (€) — optionnel</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={5000}
                        min={0}
                        placeholder="0"
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
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <details className="rounded-lg border border-border bg-card p-3">
              <summary className="cursor-pointer text-[13px] text-muted-foreground">
                Filtres avancés — surface, sources
              </summary>
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                        <FormLabel>Surface max (m²)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={5}
                            placeholder="—"
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
                    <FormItem>
                      <FormLabel>Sources à scraper</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {SOURCE_OPTIONS.map((s) => {
                          const checked = field.value?.includes(s.id) ?? false;
                          return (
                            <label
                              key={s.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                                checked
                                  ? "border-primary bg-primary-soft text-primary"
                                  : "border-border bg-background hover:border-primary/40"
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

            {/* Paramètres personnalisés (apport, taux, TMI) */}
            <div className="rounded-lg border border-border bg-card p-4">
              <FormField
                control={form.control}
                name="overrideParams"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (e.target.checked && userParams.data) {
                          form.setValue("apport", userParams.data.apport ?? 200_000);
                          form.setValue(
                            "taux_credit_pct",
                            userParams.data.taux_credit_pct ?? 3,
                          );
                          form.setValue(
                            "duree_credit_ans",
                            userParams.data.duree_credit_ans ?? 25,
                          );
                          form.setValue("tmi_pct", userParams.data.tmi_pct ?? 30);
                          form.setValue(
                            "rendement_min_pct",
                            userParams.data.rendement_min_pct ?? 6,
                          );
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div>
                      <div className="text-[14px] font-medium">
                        Personnaliser les paramètres financiers
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Sinon on utilise ceux de ton profil (apport{" "}
                        {userParams.data?.apport?.toLocaleString("fr-FR") ?? "—"} €,
                        TMI {userParams.data?.tmi_pct ?? "—"} %, rendement min{" "}
                        {userParams.data?.rendement_min_pct ?? "—"} %).
                      </p>
                    </div>
                  </label>
                )}
              />
              {overrideParams ? (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <NumberField form={form} name="apport" label="Apport (€)" step={5000} min={0} />
                  <NumberField form={form} name="taux_credit_pct" label="Taux crédit (%)" step={0.05} min={0} max={15} />
                  <NumberField form={form} name="duree_credit_ans" label="Durée crédit (années)" step={1} min={5} max={30} />
                  <NumberField form={form} name="tmi_pct" label="TMI (%)" step={1} min={0} max={50} />
                  <NumberField form={form} name="rendement_min_pct" label="Rendement min (%)" step={0.1} min={0} max={30} />
                </div>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={createAnalysis.isPending}
              className="w-full"
            >
              {createAnalysis.isPending ? "Création…" : "Lancer l'analyse"}
            </Button>
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
