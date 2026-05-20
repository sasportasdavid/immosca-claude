import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// Stepper — wizard horizontal Immovalue (value-tokens.css §stepper).
// Étapes affichées comme pills avec numéro :
//   - antérieures (done)  : ink fond foncé + ✓
//   - étape courante (active) : terra-soft + terra
//   - suivantes (todo)    : bg-2 + mute-2
//
// Lignes de séparation fines entre chaque step.
//
// Usage :
//   <Stepper current={2} total={4} labels={["Adresse", "Description", "Photos", "Liens"]} />

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  /** Index 1-based de l'étape courante. */
  current: number;
  /** Nombre total d'étapes. */
  total: number;
  /** Labels optionnels par étape (longueur = total). */
  labels?: string[];
}

const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(
  ({ current, total, labels, className, ...props }, ref) => {
    const steps = Array.from({ length: total }, (_, i) => i + 1);

    return (
      <ol
        ref={ref}
        className={cn(
          "flex items-center gap-1.5 text-[12px] text-mute-2",
          className,
        )}
        aria-label={`Étape ${current} sur ${total}`}
        {...props}
      >
        {steps.map((n, idx) => {
          const isActive = n === current;
          const isDone = n < current;
          const isTodo = n > current;
          const label = labels?.[idx];

          return (
            <React.Fragment key={n}>
              <li
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1",
                  isDone && "bg-bg-2 text-ink-2",
                  isActive && "bg-terra-soft text-terra-deep",
                  isTodo && "bg-bg-2 text-mute-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full",
                    "font-mono text-[10px] font-semibold",
                    isDone && "bg-ink text-white",
                    isActive && "bg-terra text-white",
                    isTodo && "bg-bg-3 text-mute-2",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
                </span>
                {label && (
                  <span className="font-medium tracking-[-0.005em]">{label}</span>
                )}
              </li>
              {idx < steps.length - 1 && (
                <span
                  aria-hidden
                  className="inline-block h-px w-3 bg-line"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    );
  },
);
Stepper.displayName = "Stepper";

export { Stepper };
