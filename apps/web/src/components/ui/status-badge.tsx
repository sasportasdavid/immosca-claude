import * as React from "react";

import { cn } from "@/lib/utils";

// StatusBadge — pastille de statut produit-agnostique (value-tokens.css
// §status badge + immoscan-unified.css §8). H24, font 11.5px, dot couleur
// courante.
//
// Vocabulaire ImmoValue (statuts d'un bien suivi) :
//   - suivi   : neutre (gris)
//   - discret : accent brand product-agnostic (PR-DA-U2 — auparavant terra
//               dur). Violet sur Immoscan, terra sur Immovalue. À l'étude,
//               privé : utilise la couleur de marque pour signifier "interne".
//   - public  : sage (publié, en vente publique — status-positive,
//               ne change pas par produit)
//   - vendu   : ink fort (transaction conclue)
//   - retire  : faint (retiré du marché)
//
// Vocabulaire ImmoScan (statuts d'un bien dans une analyse — PR-DA-U3) :
//   - nouveau : accent soft (équivalent de discret côté ImmoValue — fraîcheur)
//   - suivi   : neutre (réutilise le variant ImmoValue)
//   - score   : sage soft (équivalent public — bien noté et publié dans
//               l'analyse)
//   - exclu   : ink (équivalent vendu — exclu du périmètre de notation)

export type ListingStatus =
  | "suivi"
  | "discret"
  | "public"
  | "vendu"
  | "retire"
  | "nouveau"
  | "score"
  | "exclu";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ListingStatus;
}

const statusClasses: Record<ListingStatus, string> = {
  suivi: "bg-bg-2 text-muted-ink border-line",
  // PR-DA-U2 : product-agnostic via var(--accent-*).
  discret:
    "bg-[var(--accent-soft)] text-[var(--accent-deep)] [border-color:color-mix(in_oklab,var(--accent)_20%,transparent)]",
  public: "bg-sage-soft text-sage-2 border-sage/30",
  vendu: "bg-ink text-bg border-ink",
  retire: "bg-bg-2 text-faint border-line",
  // PR-DA-U3 — vocabulaire ImmoScan, mêmes recettes que ci-dessus pour
  // cohérence visuelle inter-produits.
  nouveau:
    "bg-[var(--accent-soft)] text-[var(--accent-deep)] [border-color:color-mix(in_oklab,var(--accent)_20%,transparent)]",
  score: "bg-sage-soft text-sage-2 border-sage/30",
  exclu: "bg-ink text-bg border-ink",
};

const statusLabels: Record<ListingStatus, string> = {
  suivi: "Suivi",
  discret: "Discret",
  public: "Public",
  vendu: "Vendu",
  retire: "Retiré",
  nouveau: "Nouveau",
  score: "Scoré",
  exclu: "Exclu",
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
