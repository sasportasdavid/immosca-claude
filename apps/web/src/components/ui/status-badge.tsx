import * as React from "react";

import { cn } from "@/lib/utils";

// StatusBadge — pastille de statut d'un bien Immovalue (value-tokens.css
// §status badge). H24, font 11.5px, dot couleur courante.
//
// 5 status :
//   - suivi   : neutre (gris)
//   - discret : terra (à l'étude, privé)
//   - public  : sage (publié, en vente publique)
//   - vendu   : ink fort (transaction conclue)
//   - retire  : faint (retiré du marché)

export type ListingStatus = "suivi" | "discret" | "public" | "vendu" | "retire";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ListingStatus;
}

const statusClasses: Record<ListingStatus, string> = {
  suivi: "bg-bg-2 text-muted-ink border-line",
  discret: "bg-terra-soft text-terra-deep border-terra/20",
  public: "bg-sage-soft text-sage-2 border-sage/30",
  vendu: "bg-ink text-bg border-ink",
  retire: "bg-bg-2 text-faint border-line",
};

const statusLabels: Record<ListingStatus, string> = {
  suivi: "Suivi",
  discret: "Discret",
  public: "Public",
  vendu: "Vendu",
  retire: "Retiré",
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border",
          "text-[11.5px] font-medium tracking-[0.01em] whitespace-nowrap",
          statusClasses[status],
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
        {children ?? statusLabels[status]}
      </span>
    );
  },
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge };
