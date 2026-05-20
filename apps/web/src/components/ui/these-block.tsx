import { Sparkles } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// TheseBlock — bloc "L'analyse de [attribution]" inspiré de `.these`
// (value-tokens.css §thèse block). Surface chaude (subtle terra gradient),
// eyebrow terra-deep avec glyph, titre serif italique, corps en lecture
// confortable.
//
// Usage :
//   <TheseBlock attribution="André" title="Pourquoi ce bien">
//     <p>Le Chénay est…</p>
//   </TheseBlock>

export interface TheseBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  attribution?: string;
  /** Override pour le glyph par défaut (Sparkles). */
  glyph?: React.ReactNode;
}

const TheseBlock = React.forwardRef<HTMLDivElement, TheseBlockProps>(
  (
    { title, attribution = "André", glyph, className, children, ...props },
    ref,
  ) => {
    return (
      <section
        ref={ref}
        className={cn(
          "relative rounded-r-xl border px-8 py-7",
          "border-terra/15 bg-card",
          // wash terra subtil (équivalent linear-gradient handoff)
          "bg-gradient-to-b from-terra/[0.04] to-terra/[0.01]",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-terra-deep">
          <span
            aria-hidden
            className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-r-xs bg-terra-grad text-white shadow-lvl-1"
          >
            {glyph ?? <Sparkles className="h-3 w-3" strokeWidth={2.5} />}
          </span>
          L&rsquo;analyse de {attribution}
        </div>

        {title && (
          <h3
            className={cn(
              "mt-3 mb-3.5 max-w-[30ch] font-serif text-[28px] font-normal italic",
              "tracking-[-0.018em] leading-[1.15] text-ink",
              "[text-wrap:balance]",
            )}
          >
            {title}
          </h3>
        )}

        <div
          className={cn(
            "space-y-3 text-[15.5px] leading-[1.65] text-ink-2",
            "[&_p]:[text-wrap:pretty] [&_b]:font-semibold [&_strong]:font-semibold",
          )}
        >
          {children}
        </div>
      </section>
    );
  },
);
TheseBlock.displayName = "TheseBlock";

export { TheseBlock };
