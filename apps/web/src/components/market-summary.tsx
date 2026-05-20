// MarketSummary — section synthèse marché d'une analyse.
// Présentationnel pur : reçoit les listings (visibles, post-masquage),
// calcule les stats côté client (min/médian/max prix, distribution DPE,
// distribution scores).
//
// Repaint DA : ligne horizontale de cells type "market-summary" du handoff
// (eyebrow .eyebrow, val font-mono tnum 22-28px), card unique partagée
// avec séparateurs border-line. Bloc distribution DPE en dessous.

import { useMemo } from "react";

import { DpePill } from "@/components/ui/dpe-pill";
import { Eyebrow } from "@/components/ui/eyebrow";

export type MarketSummaryListing = {
  prix: number | null;
  surface: number | null;
  dpe: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  score_total: number | null;
  is_masked: boolean;
};

type Props = {
  listings: MarketSummaryListing[];
  /** Médian DVF de la zone si dispo, pour comparer au prix médian observé. */
  medianMarketM2?: number | null;
};

const DPE_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function MarketSummary({ listings }: Props) {
  const stats = useMemo(() => {
    // €/m² pour les biens avec prix ET surface visibles
    const prixM2 = listings
      .map((l) =>
        l.prix !== null && l.surface && l.surface > 0
          ? l.prix / l.surface
          : null,
      )
      .filter((n): n is number => n !== null && n > 0);
    prixM2.sort((a, b) => a - b);

    // Distribution DPE
    const dpeDist = DPE_LETTERS.reduce<Record<string, number>>((acc, l) => {
      acc[l] = 0;
      return acc;
    }, {});
    let dpeKnown = 0;
    for (const l of listings) {
      if (l.dpe && dpeDist[l.dpe] !== undefined) {
        dpeDist[l.dpe] = (dpeDist[l.dpe] ?? 0) + 1;
        dpeKnown++;
      }
    }
    const passoiresCount = (dpeDist.F ?? 0) + (dpeDist.G ?? 0);

    // Distribution scores (buckets de 10)
    const scores = listings
      .map((l) => l.score_total)
      .filter((n): n is number => n !== null);
    const goodCount = scores.filter((s) => s >= 70).length;

    return {
      count: listings.length,
      maskedCount: listings.filter((l) => l.is_masked).length,
      minPrixM2: prixM2.length ? prixM2[0] : null,
      medianPrixM2: median(prixM2),
      maxPrixM2: prixM2.length ? prixM2[prixM2.length - 1] : null,
      dpeDist,
      dpeKnown,
      passoiresCount,
      goodCount,
    };
  }, [listings]);

  if (stats.count === 0) return null;

  const dpeMax = Math.max(...Object.values(stats.dpeDist), 1);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
          Synthèse marché
        </h2>
        <p className="mt-1 text-[12.5px] text-mute-2">
          Statistiques calculées sur les {stats.count} biens de l'analyse.
        </p>
      </div>

      {/* Ligne unique "market-summary" du handoff : grille flex avec
          séparateurs verticaux border-line entre cells. */}
      <div className="overflow-hidden rounded-r-lg border border-line bg-card shadow-lvl-1">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {/* Fourchette €/m² */}
          <div className="border-b border-r border-line px-5 py-4 md:border-b-0">
            <Eyebrow>Fourchette €/m²</Eyebrow>
            <div className="mt-2.5 flex items-baseline gap-2 font-mono tnum">
              <span className="text-[14px] text-mute-2">
                {stats.minPrixM2 ? Math.round(stats.minPrixM2) : "—"}
              </span>
              <span className="text-faint">·</span>
              <span className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
                {stats.medianPrixM2 ? Math.round(stats.medianPrixM2) : "—"}
              </span>
              <span className="text-faint">·</span>
              <span className="text-[14px] text-mute-2">
                {stats.maxPrixM2 ? Math.round(stats.maxPrixM2) : "—"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-mute-2">
              min · médian · max
            </div>
          </div>

          {/* Biens analysés */}
          <div className="border-b border-line px-5 py-4 md:border-b-0 md:border-r">
            <Eyebrow>Biens analysés</Eyebrow>
            <div className="mt-2.5 font-mono tnum text-[22px] font-semibold tracking-[-0.015em] text-ink">
              {stats.count}
            </div>
            <div className="mt-1 text-[11px] text-mute-2">
              dont {stats.dpeKnown} avec DPE renseigné
            </div>
          </div>

          {/* Biens à fort score */}
          <div className="border-r border-line px-5 py-4">
            <Eyebrow>Score ≥ 70</Eyebrow>
            <div className="mt-2.5 font-mono tnum text-[22px] font-semibold tracking-[-0.015em] text-ink">
              {stats.goodCount}
              <span className="ml-1 text-[14px] font-normal text-mute-2">
                / {stats.count}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-mute-2">
              {stats.maskedCount > 0
                ? `${stats.maskedCount} masqué${stats.maskedCount > 1 ? "s" : ""} (Free)`
                : "Biens prioritaires"}
            </div>
          </div>

          {/* Passoires DPE */}
          <div className="px-5 py-4">
            <Eyebrow>Passoires F/G</Eyebrow>
            <div className="mt-2.5 font-mono tnum text-[22px] font-semibold tracking-[-0.015em] text-ink">
              {stats.passoiresCount}
              <span className="ml-1 text-[14px] font-normal text-mute-2">
                / {stats.dpeKnown}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-mute-2">
              Interdites loc 2025/28/34
            </div>
          </div>
        </div>
      </div>

      {/* Distribution DPE — barres verticales avec pills DPE atomiques. */}
      {stats.dpeKnown > 0 ? (
        <div className="mt-4 rounded-r-lg border border-line bg-card p-5 shadow-lvl-1">
          <div className="mb-3">
            <Eyebrow>Distribution DPE</Eyebrow>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {DPE_LETTERS.map((letter) => {
              const count = stats.dpeDist[letter] ?? 0;
              const heightPct = (count / dpeMax) * 100;
              const isPoor = letter === "F" || letter === "G";
              return (
                <div key={letter} className="flex flex-col items-center gap-1.5">
                  <div className="relative flex h-20 w-full items-end justify-center">
                    <div
                      className={`w-full rounded-t-r-xs transition-all ${
                        isPoor ? "bg-bad/70" : "bg-violet/60"
                      }`}
                      style={{
                        height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%`,
                      }}
                    />
                  </div>
                  <DpePill letter={letter} />
                  <div className="font-mono tnum text-[11px] text-mute-2">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
