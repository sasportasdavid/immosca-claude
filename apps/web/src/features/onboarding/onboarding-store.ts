// Store Zustand pour le brouillon d'onboarding partagé entre les routes
// /onboarding/step-1 et /onboarding/step-2.
//
// Pourquoi un store et pas le cache React Query : les valeurs ne sont
// PAS persistées en DB tant que l'user n'a pas terminé le step 2
// (mutation `useUpsertUserParams` à ce moment). Avant ça, c'est un
// brouillon local. React Query n'est pas conçu pour ça (orienté
// server-state).
//
// Persistance sessionStorage : si l'user fait F5 entre step 1 et step 2,
// il garde ses choix. Si il ferme l'onglet, il recommence (acceptable —
// l'onboarding fait 2 écrans courts).
//
// Aucune PII stockée : les champs sont strategy/apport/taux/tmi/rendement
// (paramètres d'investissement, pas d'identifiant personnel).

import type { StrategyType, TravauxTolerance } from "@immoscan/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type OnboardingDraft = {
  strategy: StrategyType | null;
  apport: number;
  budget_max: number | null;
  taux_credit_pct: number;
  duree_credit_ans: number;
  tmi_pct: number;
  rendement_min_pct: number;
  tolerance_travaux: TravauxTolerance;
};

// Defaults : persona David (cf docs/02-donnees-gagny-reference.md) sauf
// strategy = null tant que l'user n'a pas choisi.
const DEFAULT_DRAFT: OnboardingDraft = {
  strategy: null,
  apport: 200_000,
  budget_max: null,
  taux_credit_pct: 3,
  duree_credit_ans: 25,
  tmi_pct: 30,
  rendement_min_pct: 6,
  tolerance_travaux: "leger",
};

type OnboardingStore = OnboardingDraft & {
  setStrategy: (strategy: StrategyType) => void;
  setStep2: (input: Omit<OnboardingDraft, "strategy">) => void;
  reset: () => void;
};

export const useOnboardingDraft = create<OnboardingStore>()(
  persist(
    (set) => ({
      ...DEFAULT_DRAFT,
      setStrategy: (strategy) => set({ strategy }),
      setStep2: (input) => set(input),
      reset: () => set(DEFAULT_DRAFT),
    }),
    {
      name: "immoscan-onboarding-draft-v1",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
