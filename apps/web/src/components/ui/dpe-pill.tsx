import * as React from "react";

import { cn } from "@/lib/utils";

// DpePill — pastille DPE ADEME (handoff tokens.css §DPE pill).
// 22x22, font mono 11px bold, lettre blanche sur fond couleur ADEME.
// Pour C/D/E le texte est foncé (contraste sur jaune/orange clair).
// Si letter null/undefined → pill grise faint "—".

export type DpeLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface DpePillProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  letter?: DpeLetter | null;
}

// Mapping lettre → classes Tailwind (couleurs DPE déclarées dans
// tailwind.config.ts, branche "dpe").
const dpeClasses: Record<DpeLetter, string> = {
  A: "bg-dpe-a text-white",
  B: "bg-dpe-b text-white",
  // C / D / E sur fond clair : texte sombre pour contraste suffisant.
  C: "bg-dpe-c text-[#1A2400]",
  D: "bg-dpe-d text-[#423E00]",
  E: "bg-dpe-e text-[#3B1F00]",
  F: "bg-dpe-f text-white",
  G: "bg-dpe-g text-white",
};

const DpePill = React.forwardRef<HTMLSpanElement, DpePillProps>(
  ({ letter, className, ...props }, ref) => {
    if (!letter) {
      return (
        <span
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center h-[22px] w-[22px] rounded-r-xs",
            "font-mono text-[11px] font-bold text-faint bg-bg-2 border border-line",
            className,
          )}
          aria-label="DPE non renseigné"
          {...props}
        >
          —
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center h-[22px] w-[22px] rounded-r-xs",
          "font-mono text-[11px] font-bold",
          dpeClasses[letter],
          className,
        )}
        aria-label={`DPE ${letter}`}
        {...props}
      >
        {letter}
      </span>
    );
  },
);
DpePill.displayName = "DpePill";

export { DpePill };
