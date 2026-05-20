import * as React from "react";

import { cn } from "@/lib/utils";

// ScoreBadge — badge carré affichant un score /100.
// Inspiré de `.score` du handoff (tokens.css §score badge) :
//   - good : >= 75 (vert sage)
//   - mid  : 50-74 (ambre warn)
//   - bad  : < 50  (rouge bad)
//
// Tailles :
//   - sm : 24px / texte 11px
//   - md : 32px / texte 14px (défaut)
//   - lg : 48px / texte 22px

export type ScoreBadgeSize = "sm" | "md" | "lg";

export interface ScoreBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  size?: ScoreBadgeSize;
}

function getTone(value: number): "good" | "mid" | "bad" {
  if (value >= 75) return "good";
  if (value >= 50) return "mid";
  return "bad";
}

const sizeClasses: Record<ScoreBadgeSize, string> = {
  sm: "h-6 w-6 text-[11px] rounded-r-sm",
  md: "h-8 w-8 text-[14px] rounded-r-sm",
  lg: "h-12 w-12 text-[22px] rounded-r",
};

const toneClasses: Record<"good" | "mid" | "bad", string> = {
  good: "bg-sage-soft text-sage-2 border-sage/25",
  mid: "bg-warning-soft text-warning-soft-foreground border-warning/25",
  bad: "bg-destructive-soft text-destructive-soft-foreground border-destructive/25",
};

const ScoreBadge = React.forwardRef<HTMLSpanElement, ScoreBadgeProps>(
  ({ value, size = "md", className, ...props }, ref) => {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    const tone = getTone(safe);

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center border font-mono font-semibold tnum",
          sizeClasses[size],
          toneClasses[tone],
          className,
        )}
        aria-label={`Score ${safe} sur 100`}
        {...props}
      >
        {safe}
      </span>
    );
  },
);
ScoreBadge.displayName = "ScoreBadge";

export { ScoreBadge };
