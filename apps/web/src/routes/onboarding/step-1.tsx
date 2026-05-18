// /onboarding/step-1 — stub posé en étape 4 (auth) pour permettre les
// redirects post-signup. La vraie implémentation arrive en étape 5 :
// container avec <StrategyCardGroup>, state local, mutation
// useUpsertUserParams() partielle, navigate vers /onboarding/step-2.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding/step-1")({
  component: OnboardingStep1Page,
});

function OnboardingStep1Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Onboarding · Step 1 (stub)
        </span>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
          Implémentation en étape 5.
        </h1>
      </div>
    </div>
  );
}
