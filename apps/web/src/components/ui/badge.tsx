import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Badge — aligné sur `.chip` du handoff : h-22 (5.5), px-2, font 11.5px,
// rounded-full, border --line. Variants couleurs (success/warning/danger/
// info) en complément, mappés sur les soft/* shadcn.
//
// Variant `accent` (PR-DA-U2) : product-agnostic, lit var(--accent-soft) +
// var(--accent-deep) — violet/violet-soft sur Immoscan, terra/terra-soft sur
// Immovalue. Préférer `accent` pour les nouveaux usages product-agnostic ;
// `violet` / `terra` restent disponibles quand on veut une teinte explicite.

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 h-[22px] rounded-full px-2 text-[11.5px] font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-bg-2 text-ink-2 border border-line",
        outline: "bg-transparent border border-line text-ink",
        success: "bg-success-soft text-success-soft-foreground border border-transparent",
        warning: "bg-warning-soft text-warning-soft-foreground border border-transparent",
        danger: "bg-destructive-soft text-destructive-soft-foreground border border-transparent",
        info: "bg-info-soft text-info-soft-foreground border border-transparent",
        violet: "bg-violet-soft text-violet-deep border border-transparent",
        terra: "bg-terra-soft text-terra-deep border border-transparent",
        sage: "bg-sage-soft text-sage-2 border border-transparent",
        // PR-DA-U2 : product-agnostic via var(--accent-soft / --accent-deep).
        accent:
          "bg-[var(--accent-soft)] text-[var(--accent-deep)] border border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
