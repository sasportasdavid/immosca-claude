import * as React from "react";

import { cn } from "@/lib/utils";

// ConfBadge — badge de confiance Immovalue (value-tokens.css §badge
// confiance). Pill bg-card border --line, meter horizontal 36px puis
// pourcentage tabular mono.
//
// Couleur du meter :
//   - high (>= 0.8) : sage (status-positive, ne change pas par produit)
//   - mid  (>= 0.6) : accent brand product-agnostic (violet sur Immoscan,
//                     terra sur Immovalue) — PR-DA-U2 (auparavant terra dur)
//   - low           : mute-2
//
// Usage : <ConfBadge confidence={0.84} />

export interface ConfBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  confidence: number;
}

function getLevel(c: number): "high" | "mid" | "low" {
  if (c >= 0.8) return "high";
  if (c >= 0.6) return "mid";
  return "low";
}

const fillClasses: Record<"high" | "mid" | "low", string> = {
  high: "bg-sage",
  // PR-DA-U2 : mid passe de bg-terra (Immovalue dur) à var(--accent)
  // product-agnostic — violet sur Immoscan, terra sur Immovalue.
  mid: "bg-[var(--accent)]",
  low: "bg-mute-2",
};

const ConfBadge = React.forwardRef<HTMLSpanElement, ConfBadgeProps>(
  ({ confidence, className, ...props }, ref) => {
    const safe = Math.max(0, Math.min(1, confidence));
    const level = getLevel(safe);
    const pct = Math.round(safe * 100);

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 h-6 pl-2 pr-2.5 rounded-full",
          "bg-card border border-line text-[11.5px] font-medium text-ink-2",
          className,
        )}
        aria-label={`Confiance ${pct}%`}
        {...props}
      >
        <span
          aria-hidden
          className="relative h-[5px] w-9 rounded-full bg-line overflow-hidden"
        >
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full", fillClasses[level])}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="font-mono text-[11.5px] font-semibold text-ink tnum">
          {pct}%
        </span>
      </span>
    );
  },
);
ConfBadge.displayName = "ConfBadge";

export { ConfBadge };
