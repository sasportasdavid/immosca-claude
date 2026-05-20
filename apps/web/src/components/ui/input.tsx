import * as React from "react";

import { cn } from "@/lib/utils";

// Input — aligné sur le handoff : height 36px (h-9), padding 0 12px,
// border 1px --line, radius --r (8px), font 14px ink.
// Focus : ring violet (--ring-violet).

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-r border border-line bg-card px-3 py-2 text-[14px] text-ink",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
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
Input.displayName = "Input";

export { Input };
