import * as React from "react";

import { cn } from "@/lib/utils";

// PrixHistoryChart — courbe de valorisation centrale dans le temps.
// V1 : SVG pur, pas de lib chart externe. On accepte une série de points
// `{ date, valo }` triés ASC et on les normalise dans le viewBox.
//
// Si la série est vide on affiche un placeholder doux (texte mute).

export type PrixHistoryPoint = {
  date: string; // ISO ou label court
  valo: number; // €
};

export type PrixHistoryRange = "1m" | "3m" | "6m" | "1y" | "all";

const RANGE_LABELS: Record<PrixHistoryRange, string> = {
  "1m": "1 mois",
  "3m": "3 mois",
  "6m": "6 mois",
  "1y": "1 an",
  all: "Tout",
};

export interface PrixHistoryChartProps {
  points: PrixHistoryPoint[];
  range: PrixHistoryRange;
  onRangeChange: (range: PrixHistoryRange) => void;
  /** Bande haute-basse optionnelle (fourchette de confiance). */
  band?: { low: number; high: number }[];
  className?: string;
}

const VIEW_W = 600;
const VIEW_H = 180;
const PADDING_Y = 16;

function normalize(values: number[]): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

export function PrixHistoryChart({
  points,
  range,
  onRangeChange,
  band,
  className,
}: PrixHistoryChartProps) {
  const allValues = React.useMemo(() => {
    const vs = points.map((p) => p.valo);
    if (band) {
      band.forEach((b) => {
        vs.push(b.low, b.high);
      });
    }
    return vs;
  }, [points, band]);

  const { min, max } = normalize(allValues);

  const project = React.useCallback(
    (valo: number, i: number) => {
      const x = points.length > 1 ? (i / (points.length - 1)) * VIEW_W : VIEW_W / 2;
      const norm = (valo - min) / (max - min || 1);
      const y = VIEW_H - PADDING_Y - norm * (VIEW_H - PADDING_Y * 2);
      return { x, y };
    },
    [points.length, min, max],
  );

  const linePath = points
    .map((p, i) => {
      const { x, y } = project(p.valo, i);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = points.length
    ? `${linePath} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`
    : "";

  return (
    <div className={cn("rounded-r-lg border border-line bg-card p-5", className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute-2">
            Valorisation centrale
          </div>
          <div className="text-[13px] text-muted-ink">
            Évolution dans le temps · vue {RANGE_LABELS[range].toLowerCase()}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line bg-bg-2 p-0.5">
          {(Object.keys(RANGE_LABELS) as PrixHistoryRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                "h-7 rounded-full px-3 text-[12px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:shadow-ring-violet",
                r === range
                  ? "bg-card text-ink shadow-lvl-1"
                  : "text-mute-2 hover:text-ink",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {points.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center rounded-r border border-dashed border-line text-[12.5px] text-mute-2">
            Pas encore assez de points pour tracer une courbe.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="h-[180px] w-full"
            role="img"
            aria-label="Évolution de la valorisation centrale"
          >
            {/* Grille horizontale */}
            <g stroke="var(--line)" strokeWidth={1}>
              <line x1={0} y1={PADDING_Y} x2={VIEW_W} y2={PADDING_Y} />
              <line x1={0} y1={VIEW_H / 2} x2={VIEW_W} y2={VIEW_H / 2} />
              <line
                x1={0}
                y1={VIEW_H - PADDING_Y}
                x2={VIEW_W}
                y2={VIEW_H - PADDING_Y}
              />
            </g>

            {/* Aire sous la courbe */}
            <path d={areaPath} fill="rgba(217,119,87,0.12)" />

            {/* Courbe */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--terra)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dernier point */}
            {(() => {
              const last = points[points.length - 1];
              if (!last) return null;
              const { x, y } = project(last.valo, points.length - 1);
              return (
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="white"
                  stroke="var(--terra)"
                  strokeWidth={2}
                />
              );
            })()}
          </svg>
        )}
      </div>
    </div>
  );
}
