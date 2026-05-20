import type { ValueBienPublic } from "@immoscan/db";
import { Link } from "@tanstack/react-router";
import { Eye, Heart, MapPin, Layers, Building2 } from "lucide-react";
import * as React from "react";

import { DpePill, type DpeLetter } from "@web/components/ui/dpe-pill";
import { cn } from "@/lib/utils";

import { AjouterFavoriButton } from "./AjouterFavoriButton";
import { BienAnonStatusBadge } from "./BienAnonStatusBadge";

// AnnonceCard — card d'une annonce dans la liste vitrine (/annonces).
//
// Distingue mode discret vs public via `bien.status`. Photo principale
// floutée si discret (placeholder bg-photo-bg + filter blur). Titre,
// prix ou fourchette, chips caractéristiques, stats teasing, bouton
// cœur en overlay.

export interface AnnonceCardProps {
  bien: ValueBienPublic;
  className?: string;
}

// ── Helpers d'extraction sécurisés depuis bien_data (Json typé large).
function getField<T>(bien: ValueBienPublic, key: string): T | undefined {
  const data = (bien.bien_data ?? {}) as Record<string, unknown>;
  return data[key] as T | undefined;
}

function formatSurface(bien: ValueBienPublic): string {
  const exact = getField<number>(bien, "surface");
  if (typeof exact === "number") return `${exact} m²`;
  const bucket = getField<string>(bien, "surface_bucket");
  if (typeof bucket === "string") return `${bucket} m²`;
  return "—";
}

function formatEtage(bien: ValueBienPublic): string | null {
  const exact = getField<number>(bien, "etage");
  if (typeof exact === "number") {
    if (exact === 0) return "RDC";
    return `${exact}ᵉ étage`;
  }
  const bucket = getField<string>(bien, "etage_bucket");
  if (typeof bucket === "string") return `${bucket}ᵉ étage`;
  return null;
}

function formatTypeLabel(bien: ValueBienPublic): string {
  const type = getField<string>(bien, "type") ?? "bien";
  const pieces = getField<number>(bien, "pieces");
  const typeLabel = type === "maison" ? "Maison" : `T${pieces ?? "—"}`;
  return typeLabel;
}

function formatPrice(value: number): string {
  // Espaces fines insécables entre milliers (handoff §wording).
  return value.toLocaleString("fr-FR").replace(/\s/g, " ") + " €";
}

function formatRange(low: number, high: number): string {
  const a = Math.round(low / 1000);
  const b = Math.round(high / 1000);
  return `${a} – ${b} k€`;
}

function getValorisation(
  bien: ValueBienPublic,
): { low: number; high: number; confidence: number } | null {
  const v = bien.valorisation_publique as
    | { low?: number; high?: number; confidence?: number }
    | null;
  if (!v || typeof v.low !== "number" || typeof v.high !== "number") return null;
  return {
    low: v.low,
    high: v.high,
    confidence: typeof v.confidence === "number" ? v.confidence : 0.7,
  };
}

const AnnonceCard = React.forwardRef<HTMLAnchorElement, AnnonceCardProps>(
  ({ bien, className }, ref) => {
    const isDiscret = bien.status === "discret";
    const isPublic = bien.status === "public";

    const typeLabel = formatTypeLabel(bien);
    const surface = formatSurface(bien);
    const etage = formatEtage(bien);
    const pieces = getField<number>(bien, "pieces");
    const dpe = getField<DpeLetter>(bien, "dpe");

    // Titre : selon mode
    const title = isDiscret
      ? `${typeLabel} ${surface} — ${bien.address_display ?? "Localisation masquée"}`
      : `${typeLabel} ${surface} — ${bien.address_display ?? ""}`;

    const valo = getValorisation(bien);
    const vues7j = bien.vues_7j ?? 0;
    const favoris = bien.favoris_actifs ?? 0;

    return (
      <Link
        ref={ref}
        to="/annonces/$bienId"
        // any: TanStack type le params en strict mais bienId est une string libre.
        params={{ bienId: bien.id! } as never}
        className={cn(
          "group block rounded-r-lg border border-line bg-card shadow-lvl-1",
          "transition-all hover:shadow-lvl-2 hover:-translate-y-px",
          "focus-visible:outline-none focus-visible:shadow-ring-violet",
          className,
        )}
      >
        {/* ── Image + overlays ── */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-r-lg bg-photo-bg">
          {/* Placeholder : facade abstraite */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 bg-gradient-to-br from-photo-bg to-photo-bg-2",
              isDiscret && "[filter:blur(12px)_saturate(0.7)]",
            )}
          >
            <svg
              viewBox="0 0 280 210"
              preserveAspectRatio="xMidYMid slice"
              className="h-full w-full"
            >
              <rect width="280" height="210" fill="currentColor" className="text-photo-bg" />
              {/* Faux immeuble */}
              <rect x="40" y="50" width="200" height="140" fill="#B5A595" opacity="0.5" />
              <rect x="60" y="70" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="105" y="70" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="150" y="70" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="195" y="70" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="60" y="110" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="105" y="110" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="150" y="110" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="195" y="110" width="30" height="25" fill="#8B7C6E" opacity="0.6" />
              <rect x="60" y="150" width="30" height="35" fill="#8B7C6E" opacity="0.6" />
              <rect x="195" y="150" width="30" height="35" fill="#8B7C6E" opacity="0.6" />
            </svg>
          </div>

          {/* Badge status — overlay haut gauche */}
          <div className="absolute left-3 top-3 z-10">
            <BienAnonStatusBadge status={bien.status as "discret" | "public"} size="sm" />
          </div>

          {/* Bouton favori — overlay haut droite */}
          <div className="absolute right-3 top-3 z-10">
            <AjouterFavoriButton bienId={bien.id!} variant="icon" />
          </div>

          {/* Watermark — overlay bas */}
          {isDiscret && (
            <div className="absolute bottom-3 right-3 z-10 rounded-[4px] bg-ink/55 px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-white/85 backdrop-blur-sm">
              Pré-vente discrète
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="space-y-3 p-4">
          {/* Titre + localisation */}
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink line-clamp-2">
              {title}
            </h3>
            {bien.address_display && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-mute-2">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{bien.address_display}</span>
              </div>
            )}
          </div>

          {/* Prix ou valorisation */}
          <div className="flex items-baseline justify-between gap-2">
            {bien.prix_affiche != null ? (
              <div className="font-mono text-[18px] font-semibold tracking-[-0.01em] text-ink tnum">
                {formatPrice(bien.prix_affiche)}
              </div>
            ) : valo ? (
              <div className="space-y-0.5">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-mute-2">
                  Estimation
                </div>
                <div className="font-mono text-[15px] font-medium text-ink-2 tnum">
                  {formatRange(valo.low, valo.high)}
                </div>
              </div>
            ) : (
              <div className="font-mono text-[14px] text-mute-2">Sur demande</div>
            )}

            {/* Mini-tag mode si pas de prix */}
            {bien.prix_affiche == null && valo && (
              <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-terra-deep">
                Confiance {Math.round(valo.confidence * 100)}%
              </div>
            )}
          </div>

          {/* Chips caractéristiques */}
          <div className="flex flex-wrap items-center gap-1.5">
            {typeof pieces === "number" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1 text-[11.5px] text-ink-2">
                <Layers size={11} className="text-mute-2" />
                {pieces} pièce{pieces > 1 ? "s" : ""}
              </span>
            )}
            {etage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1 text-[11.5px] text-ink-2">
                <Building2 size={11} className="text-mute-2" />
                {etage}
                {isDiscret && (
                  <span className="ml-0.5 rounded-[3px] bg-terra-soft px-1 py-px font-mono text-[9.5px] text-terra-deep">
                    ~
                  </span>
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-2 px-2 py-1 text-[11.5px] text-ink-2">
              <DpePill letter={dpe ?? null} className="!h-[14px] !w-[14px] !text-[9px]" />
              DPE {dpe ?? "—"}
            </span>
          </div>

          {/* Stats teasing */}
          {(vues7j > 0 || favoris > 0) && (
            <div className="flex items-center gap-3 border-t border-line/70 pt-3 text-[11.5px] text-mute-2">
              {vues7j > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Eye size={11.5} className="text-terra" />
                  <strong className="font-medium text-ink-2 tabular-nums">{vues7j}</strong>
                  <span>consultent</span>
                </span>
              )}
              {favoris > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Heart size={11.5} className="text-terra" />
                  <strong className="font-medium text-ink-2 tabular-nums">{favoris}</strong>
                  <span>en favoris</span>
                </span>
              )}
              {isPublic && (
                <span className="ml-auto text-[10.5px] font-medium uppercase tracking-[0.1em] text-sage-2">
                  En vente
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  },
);
AnnonceCard.displayName = "AnnonceCard";

export { AnnonceCard };
