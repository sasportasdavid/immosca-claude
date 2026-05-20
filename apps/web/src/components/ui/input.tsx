import * as React from "react";

import { cn } from "@/lib/utils";

// Input shadcn-style aligné sur les tokens ImmoScan.
// Hauteur 36px (h-9), radius 6px (rounded-md), bordure stone-300 via --input.
// Focus : ring 2px stone-700 (--ring) + ring-offset 2px (background).

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-2 text-[13px] ring-offset-background",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
          "placeholder:text-tertiary-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
          "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
