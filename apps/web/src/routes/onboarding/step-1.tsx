// /onboarding/step-1 — choix de la stratégie d'investissement.
//
// Décision PO (commit 02b9811) : 5 cards alignées sur l'enum Zod
// strategyTypeSchema, rendues par <StrategyCardGroup />. L'user choisit,
// on stocke dans le store local (Zustand), on navigate vers step-2.
//
// Pas encore de guard auth ici — il viendra en étape 6 dans __root via
// un beforeLoad qui redirige /auth/login si pas de session. En attendant,
// si un user signed-out arrive ici, l'écran est visible mais le step-2
// ne pourra pas upsert (RLS bloquera). Acceptable pour PR1.

import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";

import { OnboardingLayout } from "@/components/onboarding-layout";
import { StrategyCardGroup } from "@/components/strategy-card";
import { useOnboardingDraft } from "@/features/onboarding/onboarding-store";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/onboarding/step-1")({
  component: OnboardingStep1Page,
});

const STEP_LABELS = ["Stratégie", "Paramètres"] as const;

function OnboardingStep1Page() {
  const auth = useAuth();
  const strategy = useOnboardingDraft((s) => s.strategy);
  const setStrategy = useOnboardingDraft((s) => s.setStrategy);
  const navigate = useNavigate();

  // Guard léger : si pas de session, retour vers login. Le vrai guard
  // beforeLoad viendra en étape 6.
  if (!auth.isLoading && !auth.isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <OnboardingLayout
      step={1}
      stepLabels={STEP_LABELS}
      title="Quelle est ta stratégie d'investissement ?"
      subtitle="On adapte les calculs de rendement et la thèse Claude selon ton choix. Tu pourras affiner par bien plus tard."
      showPrev={false}
      nextDisabled={!strategy}
      onNext={() => {
        if (strategy) navigate({ to: "/onboarding/step-2" });
      }}
    >
      <StrategyCardGroup
        value={strategy ?? undefined}
        onChange={setStrategy}
      />
    </OnboardingLayout>
  );
}
