import * as React from "react";

import { cn } from "@/lib/utils";

// VerdictPill — pastille rounded-full inspirée de `.verdict` (handoff
// tokens.css §verdict pill). H22, font 11px medium, dot couleur à gauche.
//
// Variants couleurs :
//   - good    : vert ok (à visiter, opportunité)
//   - mid     : ambre warn (à creuser)
//   - bad     : rouge bad (à éviter)
//   - pending : neutre violet/info (en cours, en attente)

export type VerdictTone = "good" | "mid" | "bad" | "pending";

export interface VerdictPillProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  verdict: VerdictTone;
  children: React.ReactNode;
}

const toneClasses: Record<VerdictTone, string> = {
  good: "bg-success-soft text-success-soft-foreground",
  mid: "bg-warning-soft text-warning-soft-foreground",
  bad: "bg-destructive-soft text-destructive-soft-foreground",
  pending: "bg-info-soft text-info-soft-foreground",
};

const VerdictPill = React.forwardRef<HTMLSpanElement, VerdictPillProps>(
  ({ verdict, children, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full",
          "text-[11px] font-medium tracking-[0.01em] whitespace-nowrap",
          toneClasses[verdict],
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
        {children}
      </span>
    );
  },
);
VerdictPill.displayName = "VerdictPill";

export { VerdictPill };
