// /app/nouvelle-analyse — saisie URL + déclenchement analyse.
//
// PR3 minimal : input URL + auto-détection site (regex) + INSERT dans
// `analyses` côté Supabase + redirect /app/analyses/[id].
//
// Le déclenchement de la task `analyze` worker côté Trigger.dev est
// fait par un mécanisme à câbler en PR3.5 :
// - Option A : Edge Function Supabase qui écoute INSERT analyses et
//   appelle `tasks.trigger("analyze", { analysisId })` côté Trigger.
// - Option B : polling cron Trigger.dev qui scanne `analyses` status=pending.
// - Option C : appel direct trigger() depuis le navigateur (nécessite
//   exposer un token Trigger côté client — déconseillé).
// Recommandé : Option A.
//
// Donc ici on crée la row avec status=pending et message "démarrage en
// cours". L'user voit la progression dès que le worker prend la main.

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
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

const formSchema = z.object({
  url: z
    .string()
    .url("Doit être une URL valide")
    .refine(
      (u) =>
        /seloger\.com/.test(u) ||
        /leboncoin\.fr/.test(u) ||
        /bienici\.com/.test(u),
      "URL non reconnue (SeLoger, Leboncoin ou BienIci)",
    ),
});

type FormInput = z.infer<typeof formSchema>;

function detectSite(
  url: string,
): "seloger" | "leboncoin" | "bienici" | null {
  if (/seloger\.com/.test(url)) return "seloger";
  if (/leboncoin\.fr/.test(url)) return "leboncoin";
  if (/bienici\.com/.test(url)) return "bienici";
  return null;
}

const EXAMPLES: ReadonlyArray<{ label: string; ville: string; url: string }> = [
  {
    label: "Gagny 93220 — appartements jusqu'à 200 k€",
    ville: "Gagny",
    url: "https://www.seloger.com/list.htm?projects=2&types=1,2&natures=1,2,4&places=[{ci:930032}]&price=NaN/200000",
  },
  {
    label: "Saint-Denis 93200 — maisons",
    ville: "Saint-Denis",
    url: "https://www.seloger.com/list.htm?projects=2&types=2&natures=1,2,4&places=[{ci:930066}]",
  },
  {
    label: "Montreuil 93100 — tous types",
    ville: "Montreuil",
    url: "https://www.seloger.com/list.htm?projects=2&types=1,2&natures=1,2,4&places=[{ci:930048}]",
  },
];

function NouvelleAnalysePage() {
  const auth = useAuth();
  const profile = useProfile();
  const userParams = useUserParams();
  const navigate = useNavigate();

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
  });

  const createAnalysis = useMutation({
    mutationFn: async (values: FormInput) => {
      if (!auth.user) throw new Error("Pas de session");
      const site = detectSite(values.url);
      if (!site) throw new Error("Site non détecté");

      // Snapshot params au moment du run (immutable)
      const snapshot = {
        strategy: userParams.data?.strategy ?? null,
        apport: userParams.data?.apport ?? null,
        budget_max: userParams.data?.budget_max ?? null,
        taux_credit_pct: userParams.data?.taux_credit_pct ?? null,
        duree_credit_ans: userParams.data?.duree_credit_ans ?? null,
        tmi_pct: userParams.data?.tmi_pct ?? null,
        rendement_min_pct: userParams.data?.rendement_min_pct ?? null,
        tolerance_travaux: userParams.data?.tolerance_travaux ?? null,
      };

      const { data, error } = await supabase
        .from("analyses")
        .insert({
          profile_id: auth.user.id,
          source_url: values.url,
          source_site: site,
          params_snapshot: snapshot,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      // Déclenche la task Trigger.dev `analyze` via l'Edge Function.
      // Si l'Edge Function n'est pas déployée, l'analyse reste pending
      // mais l'user peut la voir dans son dashboard (best-effort).
      try {
        await supabase.functions.invoke("trigger-analyze", {
          body: { analysisId: data.id },
        });
      } catch (err) {
        console.warn("trigger-analyze invoke failed (analyse créée quand même)", err);
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success("Analyse créée — démarrage en cours.");
      navigate({ to: "/app/analyses/$id", params: { id: data.id } });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Impossible de créer";
      toast.error(msg);
    },
  });

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
    >
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Nouvelle analyse
        </span>
        <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Colle une URL SeLoger ou Leboncoin.
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          On scrape les 100 à 500 annonces de la recherche, on croise avec
          DVF / DPE / Géorisques, et on te livre un rapport scoré en
          8 minutes environ.
        </p>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => createAnalysis.mutate(v))}
            className="mt-8 space-y-5"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de recherche</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://www.seloger.com/list.htm?…"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Copie la barre d'adresse de ton onglet SeLoger /
                    Leboncoin après avoir saisi tes critères.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              disabled={createAnalysis.isPending}
            >
              {createAnalysis.isPending ? "Création…" : "Lancer l'analyse"}
            </Button>
          </form>
        </Form>

        {/* Examples */}
        <section className="mt-10">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Exemples — clique pour tester
          </div>
          <div className="space-y-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.url}
                type="button"
                onClick={() => form.setValue("url", ex.url)}
                className="block w-full rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="text-[14px] font-medium">{ex.label}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground line-clamp-1">
                  {ex.url}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
