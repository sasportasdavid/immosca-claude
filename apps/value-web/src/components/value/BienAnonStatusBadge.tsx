import { CheckCircle2, Lock, Ban } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// BienAnonStatusBadge — badge contextuel ImmoValue pour signaler le
// mode d'une annonce (discret / public / vendu / retiré).
//
// Visuel handoff écran 15 (orange terra-soft pour discret, sage-soft
// pour public). Pill avec icône lucide + label.
//
// Différence avec <StatusBadge /> du design-system : ce composant est
// pensé pour le contexte vitrine acheteur (texte + icône plus large,
// pas un simple dot), affiché en overlay sur photo et en bandeau.

export type BienAnonStatus = "discret" | "public" | "vendu" | "retire";

export interface BienAnonStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  status: BienAnonStatus;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<BienAnonStatusBadgeProps["size"]>, string> = {
  sm: "h-6 px-2.5 text-[11.5px] gap-1.5",
  md: "h-7 px-3 text-[12px] gap-1.5",
  lg: "h-9 px-4 text-[13px] gap-2",
};

const variantClasses: Record<BienAnonStatus, string> = {
  discret: "bg-terra-soft text-terra-deep border-terra/20",
  public: "bg-sage-soft text-sage-2 border-sage/30",
  vendu: "bg-ink text-bg border-ink",
  retire: "bg-bg-2 text-faint border-line",
};

const labels: Record<BienAnonStatus, string> = {
  discret: "Pré-vente discrète",
  public: "En vente",
  vendu: "Vendu",
  retire: "Retiré",
};

const BienAnonStatusBadge = React.forwardRef<
  HTMLSpanElement,
  BienAnonStatusBadgeProps
>(({ status, size = "md", className, children, ...props }, ref) => {
  const Icon =
    status === "public"
      ? CheckCircle2
      : status === "discret"
        ? Lock
        : status === "retire"
          ? Ban
          : CheckCircle2;

  const iconSize = size === "lg" ? 14 : 12;

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        sizeClasses[size],
        variantClasses[status],
        className,
      )}
      {...props}
    >
      <Icon size={iconSize} strokeWidth={2.2} className="shrink-0" />
      <span>{children ?? labels[status]}</span>
    </span>
  );
});
BienAnonStatusBadge.displayName = "BienAnonStatusBadge";

export { BienAnonStatusBadge };
