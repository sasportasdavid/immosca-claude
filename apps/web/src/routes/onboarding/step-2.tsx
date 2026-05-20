// /onboarding/step-2 — paramètres financiers.
//
// 7 champs alignés sur `onboardingStep2Schema` du @immoscan/shared :
// - apport (€, requis, >= 0)
// - budget_max (€, optionnel)
// - taux_credit_pct (0..15)
// - duree_credit_ans (5..30)
// - tmi_pct (0..50)
// - rendement_min_pct (0..30)
// - tolerance_travaux (enum aucun/leger/moyen/lourd)
//
// PR1 : Input number + Select pour tolerance_travaux. Les sliders visuels
// du handoff écran 4 step-2 sont reportés à PR2 (polish).
//
// Submit : merge strategy (step 1) + step 2 → useUpsertUserParams.mutate.
// PostHog `onboarding_completed` + navigate /dashboard + reset du store.

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type OnboardingStep2,
  onboardingStep2Schema,
} from "@immoscan/shared";
import {
  Navigate,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import posthog from "posthog-js";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { OnboardingLayout } from "@/components/onboarding-layout";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboardingDraft } from "@/features/onboarding/onboarding-store";
import { useUpsertUserParams } from "@/hooks/use-user-params";
import { requireAuth } from "@/lib/auth-guards";

export const Route = createFileRoute("/onboarding/step-2")({
  beforeLoad: ({ location }) => requireAuth({ from: location.pathname }),
  component: OnboardingStep2Page,
});

const STEP_LABELS = ["Stratégie", "Paramètres"] as const;

function OnboardingStep2Page() {
  const draft = useOnboardingDraft();
  const setStep2 = useOnboardingDraft((s) => s.setStep2);
  const reset = useOnboardingDraft((s) => s.reset);
  const upsertParams = useUpsertUserParams();
  const navigate = useNavigate();

  const form = useForm<OnboardingStep2>({
    resolver: zodResolver(onboardingStep2Schema),
    defaultValues: {
      apport: draft.apport,
      budget_max: draft.budget_max,
      taux_credit_pct: draft.taux_credit_pct,
      duree_credit_ans: draft.duree_credit_ans,
      tmi_pct: draft.tmi_pct,
      rendement_min_pct: draft.rendement_min_pct,
      tolerance_travaux: draft.tolerance_travaux,
    },
  });

  // Guard métier (le guard auth est dans beforeLoad) : si l'user arrive
  // direct sur /onboarding/step-2 sans avoir choisi sa stratégie, retour
  // au step 1. On exclut le cas où la mutation vient de succeed —
  // reset() vide draft.strategy juste avant navigate() vers /dashboard,
  // et sans cet exclude on redirect vers step-1 pendant la nav.
  if (!draft.strategy && !upsertParams.isSuccess) {
    return <Navigate to="/onboarding/step-1" replace />;
  }

  async function onSubmit(values: OnboardingStep2) {
    if (!draft.strategy) return; // double-check (TS narrowing)
    // Normalise budget_max: number | null | undefined → number | null
    // pour matcher la forme du store (qui ne porte pas le undefined).
    const normalized = { ...values, budget_max: values.budget_max ?? null };
    setStep2(normalized);
    try {
      await upsertParams.mutateAsync({
        strategy: draft.strategy,
        ...values,
      });
      posthog.capture("onboarding_completed", {
        strategy: draft.strategy,
        tolerance_travaux: values.tolerance_travaux,
      });
      reset();
      toast.success("Profil enregistré. Bon scan !");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible d'enregistrer.";
      toast.error(message);
    }
  }

  return (
    <OnboardingLayout
      step={2}
      stepLabels={STEP_LABELS}
      title="Tes paramètres financiers."
      subtitle="On les pré-remplit avec des valeurs typiques. Tu peux les ajuster maintenant ou plus tard depuis Paramètres."
      showPrev
      onPrev={() => navigate({ to: "/onboarding/step-1" })}
      nextLabel={upsertParams.isPending ? "Enregistrement…" : "Terminer"}
      nextDisabled={upsertParams.isPending}
      onNext={form.handleSubmit(onSubmit)}
      onStepClick={(s) => {
        if (s === 1) navigate({ to: "/onboarding/step-1" });
      }}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="apport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apport disponible (€)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Ce que tu peux mettre maintenant, hors frais de notaire.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="budget_max"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget max (€) — facultatif</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="ex. 320 000"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Laisse vide si tu n'as pas de plafond.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taux_credit_pct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Taux crédit cible (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.05"
                    min={0}
                    max={15}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Banque de France ~3 % en moyenne sur 25 ans.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="duree_credit_ans"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Durée crédit (années)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min={5}
                    max={30}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tmi_pct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TMI (tranche marginale d'imposition, %)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    max={50}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  0, 11, 30, 41 ou 45 %. Impacte le calcul net-net.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rendement_min_pct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rendement minimum acceptable (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={30}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Rendement brut sous lequel un bien sera classé "no-go".
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tolerance_travaux"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Tolérance travaux</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisis…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun travaux</SelectItem>
                    <SelectItem value="leger">
                      Travaux légers (peinture, sols)
                    </SelectItem>
                    <SelectItem value="moyen">
                      Travaux moyens (cuisine, salle de bain)
                    </SelectItem>
                    <SelectItem value="lourd">
                      Travaux lourds (rénovation complète)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Plus tu acceptes de travaux, plus on remontera de
                  passoires DPE à fort potentiel de décote.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </OnboardingLayout>
  );
}
