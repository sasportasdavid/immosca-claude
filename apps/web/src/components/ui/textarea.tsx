import * as React from "react";

import { cn } from "@/lib/utils";

// Textarea shadcn-style aligné sur l'Input ImmoScan (mêmes tokens border,
// même focus ring, même comportement disabled/aria-invalid).
// Hauteur min 80px (h-20), resize vertical only.

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-20 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-[13px] leading-[1.5] ring-offset-background",
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
Textarea.displayName = "Textarea";

export { Textarea };
