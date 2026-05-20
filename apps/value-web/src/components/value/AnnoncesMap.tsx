import type { ValueBienPublic } from "@immoscan/db";
import { Map as MapIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// AnnoncesMap — placeholder visuel pour MapLibre (V1 = SVG France
// stylisé). Affiche le nombre de pins et la teinte discret vs public.
//
// Implémentation MapLibre prévue en V2 — le contrat I/O reste le même
// (`biens: ValueBienPublic[]`) donc rien à toucher dans la route.

export interface AnnoncesMapProps {
  biens: ValueBienPublic[];
  className?: string;
}

export function AnnoncesMap({ biens, className }: AnnoncesMapProps) {
  const discretCount = biens.filter((b) => b.status === "discret").length;
  const publicCount = biens.filter((b) => b.status === "public").length;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-r-lg border border-line",
        "bg-gradient-to-br from-[#E7EBE5] to-[#DCE4DA]",
        className,
      )}
    >
      {/* Faux fond carte stylisé */}
      <svg
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden
      >
        {/* Lignes de routes */}
        <g stroke="rgba(255,255,255,0.55)" strokeWidth="1" fill="none">
          <line x1="0" y1="120" x2="800" y2="80" />
          <line x1="0" y1="240" x2="800" y2="210" />
          <line x1="0" y1="360" x2="800" y2="340" />
          <line x1="0" y1="480" x2="800" y2="460" />
          <line x1="120" y1="0" x2="100" y2="600" />
          <line x1="280" y1="0" x2="260" y2="600" />
          <line x1="440" y1="0" x2="420" y2="600" />
          <line x1="600" y1="0" x2="580" y2="600" />
        </g>

        {/* Hexagones IRIS factices */}
        <g fill="rgba(91,71,224,0.08)" stroke="rgba(91,71,224,0.2)" strokeWidth="1">
          <polygon points="200,160 280,160 320,220 280,280 200,280 160,220" />
          <polygon points="400,260 480,260 520,320 480,380 400,380 360,320" />
          <polygon points="560,140 640,140 680,200 640,260 560,260 520,200" />
        </g>

        {/* Pins biens (V1 = points colorés répartis sur la zone visible) */}
        {biens.slice(0, 12).map((b, i) => {
          const x = 100 + ((i * 73) % 600);
          const y = 80 + ((i * 109) % 420);
          const isDiscret = b.status === "discret";
          return (
            <g key={b.id ?? i}>
              <circle
                cx={x}
                cy={y}
                r="11"
                fill={isDiscret ? "#D97757" : "#7C9885"}
                opacity="0.18"
              />
              <circle
                cx={x}
                cy={y}
                r="6"
                fill={isDiscret ? "#D97757" : "#7C9885"}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>

      {/* Légende — coin haut-gauche */}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-r-sm border border-line bg-card/95 px-3 py-2 text-[11.5px] text-ink-2 shadow-lvl-1 backdrop-blur">
        <MapIcon size={12} className="text-terra" />
        <span className="font-medium">{biens.length} biens</span>
        {discretCount > 0 && (
          <>
            <span className="text-line">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-terra"
              />
              <span className="tabular-nums">{discretCount}</span>
              <span>discrets</span>
            </span>
          </>
        )}
        {publicCount > 0 && (
          <>
            <span className="text-line">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-sage"
              />
              <span className="tabular-nums">{publicCount}</span>
              <span>publics</span>
            </span>
          </>
        )}
      </div>

      {/* Mention V1 — coin bas-droit */}
      <div className="absolute bottom-3 right-3 rounded-[4px] bg-ink/55 px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-white/85 backdrop-blur-sm">
        Carte interactive prochainement
      </div>
    </div>
  );
}
