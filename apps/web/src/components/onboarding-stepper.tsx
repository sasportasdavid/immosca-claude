import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

// Stepper d'onboarding. Pattern handoff écran 4 : dots reliés par
// segments, dot actif = pulse-accent (anneau), dots done = primary + check,
// dots pending = stone-200.
//
// PR1 : 2 steps (stratégie, paramètres financiers).
// PR3 : 3e step (saisie URL + exemples) ajoutera la valeur 3.
//
// Props "step" = numéro 1-indexed du step courant. Les steps < step sont
// done ; le step courant est active ; les steps > step sont pending.

export type OnboardingStepperProps = {
  step: number;
  labels: readonly string[];
  onStepClick?: (s: number) => void;
  className?: string;
};

type DotState = "done" | "active" | "pending";

function stateFor(index: number, step: number): DotState {
  if (index + 1 < step) return "done";
  if (index + 1 === step) return "active";
  return "pending";
}

export function OnboardingStepper({
  step,
  labels,
  onStepClick,
  className,
}: OnboardingStepperProps) {
  return (
    <nav
      aria-label="Progression onboarding"
      className={cn("flex items-center gap-3", className)}
    >
      {labels.map((label, i) => {
        const state = stateFor(i, step);
        const isLast = i === labels.length - 1;
        const isClickable = onStepClick && state === "done";

        return (
          <div key={label} className="flex items-center gap-3">
            {/* Dot + label */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={isClickable ? () => onStepClick?.(i + 1) : undefined}
              className={cn(
                "flex items-center gap-2.5 text-left",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-default",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-mono font-semibold tabular-nums transition-colors",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "active" &&
                    "bg-primary text-primary-foreground ring-4 ring-primary-soft",
                  state === "pending" && "bg-secondary text-tertiary-foreground",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  state === "active" && "text-foreground",
                  state === "done" && "text-muted-foreground",
                  state === "pending" && "text-tertiary-foreground",
                )}
              >
                {label}
              </span>
            </button>

            {/* Segment de liaison */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "block h-px w-10 transition-colors",
                  state === "done" ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
