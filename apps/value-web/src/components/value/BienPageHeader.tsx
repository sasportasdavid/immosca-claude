import type { ValueBienPublic } from "@immoscan/db";
import { Eye, Heart } from "lucide-react";

import { cn } from "@/lib/utils";

import { BienAnonStatusBadge } from "./BienAnonStatusBadge";

// BienPageHeader — galerie photos en haut de page bien (handoff écran
// 15 §gallery). En mode discret : 4 cellules placeholder floutées. En
// mode public : la photo principale en grand + thumbs.
//
// V1 : on n'a pas de carrousel interactif, juste le premier rendu.

export interface BienPageHeaderProps {
  bien: ValueBienPublic;
  className?: string;
}

function FacadePlaceholder({ blur }: { blur: boolean }) {
  return (
    <svg
      viewBox="0 0 560 380"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", blur && "[filter:blur(14px)_saturate(0.7)]")}
    >
      <defs>
        <linearGradient id="bphFacade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8D9C8" />
          <stop offset="1" stopColor="#C9B89F" />
        </linearGradient>
        <pattern
          id="bphGrain"
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
        >
          <circle cx="3" cy="3" r="1.5" fill="#A89789" fillOpacity="0.35" />
        </pattern>
      </defs>
      <rect width="560" height="380" fill="url(#bphFacade)" />
      <rect width="560" height="380" fill="url(#bphGrain)" />
      {/* façade abstraite — alignement de fenêtres */}
      <g fill="#8B7C6E" opacity="0.55">
        <rect x="70" y="100" width="55" height="55" rx="3" />
        <rect x="160" y="100" width="55" height="55" rx="3" />
        <rect x="250" y="100" width="55" height="55" rx="3" />
        <rect x="340" y="100" width="55" height="55" rx="3" />
        <rect x="430" y="100" width="55" height="55" rx="3" />
        <rect x="70" y="190" width="55" height="55" rx="3" />
        <rect x="160" y="190" width="55" height="55" rx="3" />
        <rect x="250" y="190" width="55" height="55" rx="3" />
        <rect x="340" y="190" width="55" height="55" rx="3" />
        <rect x="430" y="190" width="55" height="55" rx="3" />
      </g>
      {/* sol */}
      <rect x="0" y="360" width="560" height="20" fill="#A89789" opacity="0.4" />
    </svg>
  );
}

function ThumbPlaceholder({ blur, label }: { blur: boolean; label: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-photo-bg">
      <svg
        viewBox="0 0 280 186"
        preserveAspectRatio="xMidYMid slice"
        className={cn("h-full w-full", blur && "[filter:blur(12px)_saturate(0.7)]")}
      >
        <rect width="280" height="186" fill="#E7DBCC" />
        <rect x="20" y="60" width="240" height="120" fill="#A89789" opacity="0.4" />
        <rect x="40" y="80" width="100" height="80" fill="#9B8A7C" opacity="0.5" />
      </svg>
      {blur && (
        <div className="absolute bottom-2 right-2 rounded-[4px] bg-ink/55 px-1.5 py-0.5 font-mono text-[9.5px] text-white/85">
          {label}
        </div>
      )}
    </div>
  );
}

export function BienPageHeader({ bien, className }: BienPageHeaderProps) {
  const isDiscret = bien.status === "discret";
  const status = (bien.status as "discret" | "public" | "vendu" | "retire") ?? "discret";

  const vues7j = bien.vues_7j ?? 0;
  const favoris = bien.favoris_actifs ?? 0;

  return (
    <div
      className={cn(
        "grid h-[380px] gap-2 md:grid-cols-[1.4fr_1fr_1fr]",
        className,
      )}
    >
      {/* Grande photo — gauche, span 2 rows en desktop */}
      <div className="relative col-span-1 row-span-2 overflow-hidden rounded-l-r-lg bg-photo-bg border border-line md:row-span-2">
        <FacadePlaceholder blur={isDiscret} />

        {/* Badge status */}
        <div className="absolute left-3 top-3 z-10">
          <BienAnonStatusBadge status={status} size="md" />
        </div>

        {/* Live count */}
        {(vues7j > 0 || favoris > 0) && (
          <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-3 rounded-full bg-ink/78 px-3 py-1.5 text-[11.5px] text-white backdrop-blur">
            {vues7j > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-terra animate-pulse"
                />
                <strong className="font-mono font-semibold tabular-nums">
                  {vues7j}
                </strong>
                <span className="opacity-90">consultent</span>
              </span>
            )}
            {favoris > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Heart size={11} className="fill-current text-terra" />
                <strong className="font-mono font-semibold tabular-nums">
                  {favoris}
                </strong>
                <span className="opacity-90">favoris</span>
              </span>
            )}
          </div>
        )}

        {/* Watermark */}
        {isDiscret && (
          <div className="absolute bottom-3 right-3 z-10 rounded-[4px] bg-ink/55 px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-white/85 backdrop-blur-sm">
            Pré-vente discrète · ImmoValue
          </div>
        )}
      </div>

      {/* Thumb haut-droite */}
      <div className="relative hidden overflow-hidden rounded-tr-r-lg border border-line md:block">
        <ThumbPlaceholder blur={isDiscret} label="Salon · floutée" />
      </div>

      {/* Thumb milieu-droite */}
      <div className="relative hidden overflow-hidden border border-line md:block">
        <ThumbPlaceholder blur={isDiscret} label="Cuisine" />
      </div>

      {/* Thumb bas-gauche-droite (couvre 2 cols) — "+N photos" */}
      <div className="relative col-span-1 hidden overflow-hidden rounded-br-r-lg border border-line bg-[#D6C9BB] md:block">
        <div className="flex h-full items-center justify-center text-[13px] font-medium text-white">
          + {Math.max(0, (bien.photos?.length ?? 6) - 3)} photos
          {isDiscret && (
            <span className="ml-2 font-mono text-[11px] text-white/70">
              toutes floutées
            </span>
          )}
        </div>
      </div>

      {/* Mobile : juste l'overlay favori sous la grande photo (V1 = pas
          de carrousel). Les thumbs sont masquées en mobile. */}
      <div className="md:hidden flex items-center justify-between rounded-r-sm border border-line bg-card px-3 py-2 text-[12px] text-mute-2">
        <span className="inline-flex items-center gap-1.5">
          <Eye size={12} className="text-terra" />
          <strong className="text-ink tabular-nums">{vues7j}</strong> consultent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Heart size={12} className="text-terra" />
          <strong className="text-ink tabular-nums">{favoris}</strong> favoris
        </span>
      </div>
    </div>
  );
}
