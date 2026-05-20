import * as React from "react";

import { cn } from "@/lib/utils";

// Eyebrow — petit label uppercase tracking large, posé en surtitre de
// section. Tokens.css §eyebrow : 11px medium tracking 0.16em couleur
// --mute-2 (variant default) ou --violet / --terra (variants brand).

export type EyebrowVariant = "default" | "violet" | "terra";

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: EyebrowVariant;
}

const variantClasses: Record<EyebrowVariant, string> = {
  default: "text-mute-2",
  violet: "text-violet",
  terra: "text-terra-deep",
};

const Eyebrow = React.forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ variant = "default", className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-block text-[11px] font-medium uppercase tracking-[0.16em]",
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
Eyebrow.displayName = "Eyebrow";

export { Eyebrow };
