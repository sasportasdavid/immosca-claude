import { Heart } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { useFavori, useToggleFavori } from "@/hooks/use-favori";
import { cn } from "@/lib/utils";

// AjouterFavoriButton — CTA central de la page bien discret (handoff
// écran 15 §Right column / btn-fav).
//
// Comportements :
//   - Affiche un cœur outlined + label "Ajouter à mes favoris".
//   - Si déjà favori : cœur rempli + label "Retiré de mes favoris" / "Dans tes favoris".
//   - Animation pulse au toggle.
//   - Pas de loading state visible (mutation rapide, fallback local).
//
// `variant` :
//   - "terra" (default) : pour la page bien discret, gros CTA terra.
//   - "icon"            : petit bouton coeur 36x36 (sur les cards de la vitrine).
//   - "ghost"           : variante compacte pour la page bien public.

export type AjouterFavoriButtonVariant = "terra" | "icon" | "ghost";

export interface AjouterFavoriButtonProps {
  bienId: string;
  variant?: AjouterFavoriButtonVariant;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Label custom — utile en page bien public où on parle de "Suivre l'annonce". */
  label?: string;
  /** Label custom quand favori actif. */
  activeLabel?: string;
}

export function AjouterFavoriButton({
  bienId,
  variant = "terra",
  size = "default",
  className,
  label = "Ajouter à mes favoris",
  activeLabel = "Dans tes favoris",
}: AjouterFavoriButtonProps) {
  const { data: state } = useFavori(bienId);
  const toggle = useToggleFavori(bienId);
  const isFavori = !!state?.isFavori;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle.mutate(!isFavori);
  };

  // ── Mode "icon" : utilisé sur les cards vitrine (en haut à droite).
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={isFavori ? activeLabel : label}
        aria-pressed={isFavori}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "bg-card/95 backdrop-blur border border-line shadow-lvl-1",
          "text-mute-2 transition-colors",
          "hover:text-terra-deep hover:border-terra/30",
          "focus-visible:outline-none focus-visible:shadow-ring-terra",
          isFavori && "text-terra-deep border-terra/30",
          className,
        )}
      >
        <Heart
          size={16}
          strokeWidth={2}
          className={cn(isFavori && "fill-current")}
        />
      </button>
    );
  }

  // ── Mode "ghost" : sur la page bien public.
  if (variant === "ghost") {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={onClick}
        aria-pressed={isFavori}
        className={cn(
          "gap-2",
          isFavori && "text-terra-deep border-terra/30 bg-terra-soft",
          className,
        )}
      >
        <Heart
          size={16}
          strokeWidth={2}
          className={cn(isFavori && "fill-current")}
        />
        <span>{isFavori ? activeLabel : label}</span>
      </Button>
    );
  }

  // ── Mode "terra" (default) : CTA principal page bien discret.
  return (
    <Button
      type="button"
      variant="terra"
      size={size}
      onClick={onClick}
      aria-pressed={isFavori}
      className={cn("gap-2", className)}
    >
      <Heart
        size={size === "lg" ? 18 : 16}
        strokeWidth={2.2}
        className={cn(isFavori && "fill-current")}
      />
      <span>{isFavori ? activeLabel : label}</span>
    </Button>
  );
}
