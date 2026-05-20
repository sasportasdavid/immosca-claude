import * as React from "react";

import { cn } from "@/lib/utils";

// AdjustmentItem — ligne d'ajustement Immovalue dans la liste des
// critères (état refait, RER proximité, exposition…). Calque sur
// `.adj-item` (value-tokens.css §ajustement item).
//
// Layout grid : icône 36 / corps / impact aligné à droite.
//
// Variants :
//   - pos : impact positif (sage-soft icon, sage-2 pct)
//   - neg : impact négatif (terra-soft icon, terra-2 pct)

export type AdjustmentTone = "pos" | "neg";

export interface AdjustmentItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  tone: AdjustmentTone;
  icon: React.ReactNode;
  criterion: string;
  reason: string;
  /** Sources / tags affichés sous la raison. Tag `user: true` = mis en
   *  évidence terra (saisie utilisateur). */
  sources?: Array<{ label: string; user?: boolean }>;
  /** Pourcentage signé (ex. "+6%", "-12%"). */
  impactPct: string;
  /** Montant absolu (ex. "+18 000 €"). */
  impactEur?: string;
}

const iconBgClasses: Record<AdjustmentTone, string> = {
  pos: "bg-sage-soft text-sage-2",
  neg: "bg-terra-soft text-terra-deep",
};

const pctClasses: Record<AdjustmentTone, string> = {
  pos: "text-sage-2",
  neg: "text-terra-2",
};

const AdjustmentItem = React.forwardRef<HTMLDivElement, AdjustmentItemProps>(
  (
    {
      tone,
      icon,
      criterion,
      reason,
      sources,
      impactPct,
      impactEur,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid items-start gap-3.5 px-[18px] py-4 rounded-r-lg",
          "bg-card border border-line transition-colors hover:border-line-2",
          "[grid-template-columns:36px_1fr_auto]",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-r shrink-0",
            iconBgClasses[tone],
          )}
        >
          {icon}
        </div>

        <div>
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {criterion}
          </div>
          <div className="mt-1 text-[13px] leading-[1.5] text-muted-ink [text-wrap:pretty]">
            {reason}
          </div>
          {sources && sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sources.map((src, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.02em]",
                    src.user
                      ? "bg-terra-soft text-terra-deep"
                      : "bg-bg-2 text-mute-2",
                  )}
                >
                  {src.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-[110px] flex-col items-end text-right">
          <span
            className={cn(
              "font-mono text-[15px] font-semibold tnum",
              pctClasses[tone],
            )}
          >
            {impactPct}
          </span>
          {impactEur && (
            <span className="font-mono text-[11.5px] text-mute-2 tnum">
              {impactEur}
            </span>
          )}
        </div>
      </div>
    );
  },
);
AdjustmentItem.displayName = "AdjustmentItem";

export { AdjustmentItem };
