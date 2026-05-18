import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { StrategyType } from "@immoscan/shared";

import { cn } from "@/lib/utils";

// StrategyCardGroup : grille de cards visuelles pour onboarding step-1.
// Pattern handoff Claude Design écran 4 (Bloc B / Step 1 — Stratégie).
//
// Décision PO (cf chat 2026-05-18) : 5 cards alignées strictement sur
// l'enum SQL/Zod `strategyTypeSchema` (locatif_nu / lmnp_meuble / mixte /
// colocation / courte_duree). Les 2 cards extra du handoff (patrimonial,
// unsure) sont droppées — `patrimonial` n'est pas dans le modèle produit,
// `unsure` est un cas UX traité séparément (pas une vraie stratégie).
//
// Composant présentationnel pur (props uniquement). Le container Code
// (apps/web/src/features/onboarding/) gère l'état et la persistance via
// useUserParams.

type StrategyDefinition = {
  id: StrategyType;
  title: string;
  sub: string;
  popular?: boolean;
  icon: React.ReactNode;
};

// Icônes Lucide-style 32×32 inline. Choix sémantique :
// - locatif_nu : maison + extension (location longue durée classique)
// - lmnp_meuble : commode (mobilier inclus)
// - mixte : 2 maisons superposées (alternance nu/meublé)
// - colocation : 3 silhouettes (multiple occupants)
// - courte_duree : marker (Airbnb-style)
//
// Tous en stroke currentColor pour hériter de la couleur du parent
// (text-foreground par défaut, text-primary quand sélectionné).

const ICON_LOCATIF_NU = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 14L16 6L27 14" />
    <path d="M7 13V26H25V13" />
    <rect x="13" y="18" width="6" height="8" />
  </svg>
);

const ICON_LMNP = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="9" width="22" height="16" rx="1.5" />
    <line x1="5" y1="15" x2="27" y2="15" />
    <circle cx="10" cy="20" r="1.5" />
    <rect x="14" y="18" width="9" height="4" />
  </svg>
);

const ICON_COURTE_DUREE = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 4 L26 22 C26 26 22 28 16 28 C10 28 6 26 6 22 Z" />
    <circle cx="16" cy="18" r="3" />
  </svg>
);

const ICON_MIXTE = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 13L11 7L18 13V25H4Z" />
    <path d="M14 13L21 7L28 13V25H14Z" opacity="0.5" />
  </svg>
);

const ICON_COLOCATION = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="12" r="3" />
    <circle cx="21" cy="12" r="3" />
    <circle cx="16" cy="10" r="3" />
    <path d="M5 25c0-3 3-5 6-5h2" />
    <path d="M27 25c0-3-3-5-6-5h-2" />
    <path d="M10 25c0-3 3-5 6-5s6 2 6 5" />
  </svg>
);

export const STRATEGY_DEFINITIONS: readonly StrategyDefinition[] = [
  {
    id: "locatif_nu",
    title: "Locatif nu",
    sub: "TMI 30 % · micro-foncier ou réel",
    popular: true,
    icon: ICON_LOCATIF_NU,
  },
  {
    id: "lmnp_meuble",
    title: "LMNP meublé",
    sub: "Régime réel · amortissement",
    icon: ICON_LMNP,
  },
  {
    id: "courte_duree",
    title: "Courte durée (Airbnb)",
    sub: "Forte rentabilité · gestion active",
    icon: ICON_COURTE_DUREE,
  },
  {
    id: "mixte",
    title: "Stratégie mixte",
    sub: "Mélange nu / meublé selon le bien",
    icon: ICON_MIXTE,
  },
  {
    id: "colocation",
    title: "Colocation",
    sub: "Plusieurs locataires · bail individuel ou collectif",
    icon: ICON_COLOCATION,
  },
];

export type StrategyCardGroupProps = {
  value?: StrategyType;
  onChange: (value: StrategyType) => void;
  /** Override de la liste si besoin (defaut = STRATEGY_DEFINITIONS). */
  strategies?: readonly StrategyDefinition[];
  className?: string;
};

export function StrategyCardGroup({
  value,
  onChange,
  strategies = STRATEGY_DEFINITIONS,
  className,
}: StrategyCardGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(v as StrategyType)}
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
      aria-label="Choisis ta stratégie d'investissement"
    >
      {strategies.map((s) => (
        <RadioGroupPrimitive.Item
          key={s.id}
          value={s.id}
          id={`strategy-${s.id}`}
          className={cn(
            "group relative flex h-full cursor-pointer flex-col items-start gap-3 rounded-lg border bg-card p-5 text-left transition-all",
            "hover:border-primary/40 hover:shadow-lvl-1",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            // État sélectionné : bordure primary + ring soft + shadow
            "data-[state=checked]:border-primary data-[state=checked]:ring-2 data-[state=checked]:ring-primary-soft data-[state=checked]:shadow-lvl-1",
            // État non sélectionné : bordure standard
            "data-[state=unchecked]:border-border",
          )}
        >
          {s.popular ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-primary-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
              Populaire
            </span>
          ) : null}

          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors",
              "group-data-[state=checked]:bg-primary-soft group-data-[state=checked]:text-primary",
            )}
          >
            {s.icon}
          </span>

          <div className="space-y-1">
            <div className="text-[15px] font-semibold tracking-[-0.005em] text-foreground">
              {s.title}
            </div>
            <div className="text-[12px] leading-[1.5] text-muted-foreground">
              {s.sub}
            </div>
          </div>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
