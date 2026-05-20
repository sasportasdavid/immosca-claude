import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Button — aligné sur les composants `.btn / .btn-primary / .btn-ghost /
// .btn-terra / .btn-sm / .btn-lg` du handoff (tokens.css + value-tokens.css).
//
// Variants :
// - `default`     → .btn-primary (violet-grad + white, ring violet au focus)
// - `secondary`   → .btn (ink bg, bg/foreground inversé)
// - `ghost`       → .btn-ghost (bg-2 hover, bordure --line)
// - `outline`     → bordure ink, bg transparent, hover bg-2
// - `terra`       → .btn-terra (terra-grad, à utiliser sur Immovalue)
// - `destructive` → ok shadcn (rouge bad)
// - `link`        → texte violet souligné
//
// Sizes :
// - `sm`      → h-7  (28px) — .btn-sm
// - `default` → h-9  (36px) — .btn
// - `lg`      → h-11 (44px) — .btn-lg
// - `icon`    → h-9 w-9     — bouton carré 36px

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium tracking-[-0.005em] transition-all",
    "focus-visible:outline-none focus-visible:shadow-ring-violet",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        // .btn-primary : violet-grad, white, inset highlight, shadow lvl-1.
        default: cn(
          "bg-violet-grad text-white border border-transparent",
          "shadow-lvl-1",
          "hover:shadow-lvl-2 hover:-translate-y-px",
        ),
        // .btn-terra : terra-grad (Immovalue CTA).
        terra: cn(
          "bg-terra-grad text-white border border-transparent",
          "shadow-lvl-1",
          "hover:shadow-lvl-2 hover:-translate-y-px",
          "focus-visible:shadow-ring-terra",
        ),
        // .btn : ink bg, bg foreground (inverse).
        secondary: cn(
          "bg-ink text-bg border border-ink",
          "hover:shadow-lvl-2 hover:-translate-y-px",
        ),
        // .btn-ghost : transparent + bordure --line, hover bg-2.
        ghost: cn(
          "bg-transparent text-ink border border-line",
          "hover:bg-bg-2",
        ),
        // Variant utilitaire : bordure ink (style attio quiet primary).
        outline: cn(
          "bg-transparent text-ink border border-ink",
          "hover:bg-bg-2",
        ),
        // Destructif : équivalent bad token.
        destructive: cn(
          "bg-destructive text-destructive-foreground border border-transparent",
          "hover:bg-destructive/90",
        ),
        // Lien plat — pas de bordure, texte violet souligné au hover.
        link: "text-violet underline-offset-4 hover:underline border-0 bg-transparent",
      },
      // Tailles alignées sur le handoff (.btn-sm / .btn / .btn-lg).
      size: {
        sm: "h-7 px-2.5 text-[12px] rounded-r-sm",
        default: "h-9 px-3.5 text-[13px] rounded-r",
        lg: "h-11 px-5 text-[14px] rounded-r",
        icon: "h-9 w-9 rounded-r",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
