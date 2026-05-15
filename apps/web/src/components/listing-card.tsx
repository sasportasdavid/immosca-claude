import { Lock, Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";
import { cn } from "@/lib/utils";

type DpeClass = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type ListingCardProps = {
  title: string;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  ville: string | null;
  codePostal: string | null;
  dpe: DpeClass | null;
  score: number;
  isMasked: boolean;
  onPin?: () => void;
  onUpgradeClick?: () => void;
};

const DPE_BG: Record<DpeClass, string> = {
  A: "bg-dpe-a text-white",
  B: "bg-dpe-b text-white",
  C: "bg-dpe-c text-foreground",
  D: "bg-dpe-d text-foreground",
  E: "bg-dpe-e text-foreground",
  F: "bg-dpe-f text-white",
  G: "bg-dpe-g text-white",
};

function DpeBadge({ dpe }: { dpe: DpeClass }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-sans text-[13px] font-bold w-7 h-7",
        DPE_BG[dpe],
      )}
      style={{ clipPath: "polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%)" }}
      aria-label={`DPE classe ${dpe}`}
    >
      {dpe}
    </span>
  );
}

function formatPrice(prix: number): string {
  return new Intl.NumberFormat("fr-FR").format(prix) + " €";
}

function formatPricePerSqm(prix: number, surface: number): string | null {
  if (surface <= 0) return null;
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Math.round(prix / surface),
    ) + " €/m²"
  );
}

export function ListingCard({
  title,
  prix,
  surface,
  pieces,
  ville,
  codePostal,
  dpe,
  score,
  isMasked,
  onPin,
  onUpgradeClick,
}: ListingCardProps) {
  const locationLabel = [ville, codePostal].filter(Boolean).join(" · ");
  const pricePerSqm =
    prix !== null && !isMasked && surface !== null
      ? formatPricePerSqm(prix, surface)
      : null;
  const surfaceLabel = surface
    ? `${new Intl.NumberFormat("fr-FR").format(surface)} m²`
    : null;
  const piecesLabel = pieces ? `${pieces} P` : null;

  return (
    <Card className="overflow-hidden shadow-lvl-1 transition-shadow hover:shadow-lvl-2">
      <div className="flex items-stretch gap-0">
        {/* Photo block — placeholder SVG silhouette */}
        <div className="relative w-[120px] flex-shrink-0 bg-secondary">
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
            <g fill="hsl(var(--muted-foreground))" opacity="0.35">
              <path d="M 18 84 L 60 26 L 102 84 L 102 110 L 18 110 Z" />
              <rect x="52" y="84" width="16" height="26" fill="hsl(var(--secondary))" />
              <rect x="28" y="80" width="14" height="12" fill="hsl(var(--secondary))" />
              <rect x="78" y="80" width="14" height="12" fill="hsl(var(--secondary))" />
            </g>
          </svg>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4 min-w-0">
          {/* Header : titre + score */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "text-[14px] font-semibold leading-tight tracking-[-0.005em]",
                  isMasked && "select-none blur-sm",
                )}
              >
                {title}
              </div>
              {locationLabel ? (
                <div className="mt-1 text-[12px] text-muted-foreground truncate">
                  {locationLabel}
                </div>
              ) : null}
            </div>
            <ScoreBadge score={score} size="md" />
          </div>

          {/* Prix + €/m² + DPE */}
          <div className="flex items-baseline gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              {prix !== null && !isMasked ? (
                <>
                  <span className="font-mono tabular-nums text-[18px] font-semibold leading-none whitespace-nowrap">
                    {formatPrice(prix)}
                  </span>
                  {pricePerSqm ? (
                    <span className="font-mono tabular-nums text-[11px] text-muted-foreground whitespace-nowrap">
                      {pricePerSqm}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[18px] font-semibold text-muted-foreground/70">
                  <span className="select-none blur-md" aria-hidden="true">
                    000 000 €
                  </span>
                  <Lock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </span>
              )}
            </div>
            {dpe ? (
              <span className="ml-auto">
                <DpeBadge dpe={dpe} />
              </span>
            ) : null}
          </div>

          {/* Specs */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {surfaceLabel ? (
              <span className="font-mono tabular-nums">{surfaceLabel}</span>
            ) : null}
            {surfaceLabel && piecesLabel ? <span>·</span> : null}
            {piecesLabel ? (
              <span className="font-mono tabular-nums">{piecesLabel}</span>
            ) : null}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            {isMasked ? (
              <Button
                type="button"
                size="sm"
                onClick={onUpgradeClick}
                className="w-full"
              >
                <Lock className="h-3.5 w-3.5" />
                Débloquer (Pro)
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onPin}
                disabled={!onPin}
              >
                <Pin className="h-3.5 w-3.5" />
                Épingler
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
