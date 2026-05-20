import * as React from "react";

import { cn } from "@/lib/utils";

// Textarea — même cadre visuel que <Input /> (border --line, focus
// ring-violet, radius --r). Min height 80px, resize vertical.

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-20 w-full resize-y rounded-r border border-line bg-card px-3 py-2 text-[14px] leading-[1.5] text-ink",
          "placeholder:text-faint",
          "focus-visible:outline-none focus-visible:border-violet focus-visible:shadow-ring-violet",
          "disabled:cursor-not-allowed disabled:bg-bg-2 disabled:text-mute-2",
          "aria-invalid:border-destructive aria-invalid:focus-visible:shadow-none",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
