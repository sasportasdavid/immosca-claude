import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { OnboardingLayout } from "@/components/onboarding-layout";
import { StrategyCardGroup } from "@/components/strategy-card";
import { type StrategyType } from "@immoscan/shared";

// Preview full-page de l'OnboardingLayout au step 1 avec StrategyCardGroup.
// Supprimé fin PR1 (étape 7).

export const Route = createFileRoute("/dev/preview/onboarding-layout")({
  component: PreviewOnboardingLayout,
});

const STEP_LABELS = ["Stratégie", "Paramètres"] as const;

function PreviewOnboardingLayout() {
  const [step, setStep] = useState<1 | 2>(1);
  const [strategy, setStrategy] = useState<StrategyType | undefined>("locatif_nu");

  return (
    <OnboardingLayout
      step={step}
      stepLabels={STEP_LABELS}
      title={
        step === 1
          ? "Quelle est ta stratégie d'investissement ?"
          : "Tes paramètres financiers"
      }
      subtitle={
        step === 1
          ? "On adapte les calculs de rendement et la thèse Claude selon ton choix. Tu pourras affiner par bien plus tard."
          : "Apport, taux de crédit, TMI, rendement minimum. On les pré-remplit avec des valeurs typiques que tu peux ajuster."
      }
      showPrev={step > 1}
      onPrev={() => setStep((s) => (s === 2 ? 1 : 1))}
      onNext={() => setStep((s) => (s === 1 ? 2 : 2))}
      nextDisabled={step === 1 && !strategy}
      onStepClick={(s) => setStep(s as 1 | 2)}
    >
      {step === 1 ? (
        <StrategyCardGroup value={strategy} onChange={setStrategy} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-[13px] text-muted-foreground">
          (Step 2 — sliders financiers : implémentés en étape 5 de PR1 dans
          features/onboarding/.)
        </div>
      )}
    </OnboardingLayout>
  );
}
