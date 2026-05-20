// ComparablesMap — placeholder carte des comparables.
// V1 : SVG décoratif inspiré de la maquette, pas de vraie carte MapLibre.
// Les pins sont rendus depuis les props pour pouvoir cycler entre les
// onglets (Tous / DVF / Marché actif / Tes liens).

import { cn } from "@/lib/utils";

export type ComparableKind = "self" | "dvf" | "actif" | "user";

export interface ComparablePin {
  kind: ComparableKind;
  /** Coordonnées relatives (0-100) sur la carte placeholder. */
  x: number;
  y: number;
  title?: string;
}

export interface ComparablesMapProps {
  pins: ComparablePin[];
  /** Label en bas à gauche (rayon, IRIS, etc.). */
  caption?: string;
}

const PIN_BG: Record<ComparableKind, string> = {
  self: "bg-ink",
  dvf: "bg-violet",
  actif: "bg-sage",
  user: "bg-terra",
};

const PIN_SIZE: Record<ComparableKind, string> = {
  self: "h-[18px] w-[18px] shadow-[0_0_0_6px_rgba(28,25,23,0.10)]",
  dvf: "h-3.5 w-3.5",
  actif: "h-3.5 w-3.5",
  user: "h-[18px] w-[18px]",
};

export function ComparablesMap({ pins, caption }: ComparablesMapProps) {
  return (
    <div className="relative aspect-[1.1/1] overflow-hidden rounded-r-lg border border-line bg-gradient-to-br from-[#E7EBE5] to-[#DCE4DA]">
      <svg
        viewBox="0 0 400 360"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <g stroke="rgba(255,255,255,0.55)" strokeWidth="1" fill="none">
          <line x1="0" y1="80" x2="400" y2="60" />
          <line x1="0" y1="160" x2="400" y2="140" />
          <line x1="0" y1="240" x2="400" y2="220" />
          <line x1="0" y1="320" x2="400" y2="300" />
          <line x1="80" y1="0" x2="60" y2="360" />
          <line x1="180" y1="0" x2="160" y2="360" />
          <line x1="280" y1="0" x2="260" y2="360" />
          <line x1="380" y1="0" x2="360" y2="360" />
        </g>
        <path
          d="M40 80 L 340 60 L 360 280 L 60 300 Z"
          fill="rgba(124,152,133,0.10)"
          stroke="rgba(124,152,133,0.45)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text
          x="285"
          y="78"
          fontFamily="JetBrains Mono"
          fontSize="10"
          fill="#5C6E5F"
          letterSpacing="0.5"
        >
          LE CHÉNAY
        </text>
        <path
          d="M 0 200 Q 200 140 400 220"
          stroke="rgba(91,71,224,0.5)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="6 3"
        />
        <text x="20" y="195" fontFamily="JetBrains Mono" fontSize="9" fill="#5B47E0">
          RER E
        </text>
      </svg>

      {pins.map((p, i) => (
        <span
          key={i}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lvl-1",
            PIN_BG[p.kind],
            PIN_SIZE[p.kind],
          )}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          title={p.title}
          aria-label={p.title ?? p.kind}
        />
      ))}

      {/* Legend */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5 rounded-r-sm border border-line bg-white/90 p-2.5 text-[11px] text-ink-2 backdrop-blur-sm">
        <LegendItem kind="dvf" label="DVF (5 ans)" />
        <LegendItem kind="actif" label="Annonces actives" />
        <LegendItem kind="user" label="Tes liens" />
        <LegendItem kind="self" label="Ton bien" />
      </div>

      {caption && (
        <div className="absolute bottom-3 left-3 rounded-r-xs bg-white/90 px-2 py-1 font-mono text-[10px] text-ink-2 tracking-wide">
          {caption}
        </div>
      )}
    </div>
  );
}

function LegendItem({ kind, label }: { kind: ComparableKind; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("h-2.5 w-2.5 rounded-full", PIN_BG[kind])}
      />
      {label}
    </span>
  );
}
