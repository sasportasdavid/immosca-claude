import type { ValueBien } from "@immoscan/db";
import {
  Wrench,
  TreePine,
  TrainFront,
  Sun,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import * as React from "react";

import { AdjustmentItem } from "@web/components/ui/adjustment-item";
import { Button } from "@web/components/ui/button";
import { ConfBadge } from "@web/components/ui/conf-badge";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { TheseBlock } from "@web/components/ui/these-block";

import {
  PrixHistoryChart,
  type PrixHistoryPoint,
  type PrixHistoryRange,
} from "./PrixHistoryChart";

// BienTabsEstimation — onglet "Estimation" du dashboard bien.
// - ValorisationCard inline (fourchette + central + ConfBadge + date)
// - PrixHistoryChart avec sélecteur de range
// - "Rafraîchir maintenant" + note prochaine réévaluation
// - Sections collapsées par défaut : thèse Claude / ajustements
//
// V1 : extraction des données de `bien.valo_courante` (Json). Fallbacks
// mockés alignés avec la persona David / les chiffres seed Gagny.

export interface BienTabsEstimationProps {
  bien: ValueBien;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type ValoSnapshot = {
  central?: number;
  low?: number;
  high?: number;
  confidence?: number;
};

function parseValo(input: unknown): ValoSnapshot {
  if (!input || typeof input !== "object") return {};
  const v = input as Record<string, unknown>;
  return {
    central: typeof v.central === "number" ? v.central : undefined,
    low: typeof v.low === "number" ? v.low : undefined,
    high: typeof v.high === "number" ? v.high : undefined,
    confidence:
      typeof v.confidence === "number" ? v.confidence : undefined,
  };
}

function parseHistory(input: unknown): PrixHistoryPoint[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const obj = p as Record<string, unknown>;
      const date = typeof obj.date === "string" ? obj.date : undefined;
      const valo = typeof obj.valo === "number" ? obj.valo : undefined;
      if (!date || valo == null) return null;
      return { date, valo };
    })
    .filter((x): x is PrixHistoryPoint => x !== null);
}

function nextMondayLabel(): string {
  const now = new Date();
  const day = now.getDay();
  // dimanche = 0, lundi = 1 → on cible le prochain lundi
  const daysUntilMonday = (8 - day) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  return next.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function BienTabsEstimation({
  bien,
  onRefresh,
  isRefreshing = false,
}: BienTabsEstimationProps) {
  const [range, setRange] = React.useState<PrixHistoryRange>("3m");

  const valo = parseValo(bien.valo_courante);
  const confidence = valo.confidence ?? bien.valo_confiance ?? 0.78;
  const central = valo.central ?? 312_000;
  const low = valo.low ?? 295_000;
  const high = valo.high ?? 330_000;

  const allHistory = React.useMemo(
    () => parseHistory(bien.prix_history),
    [bien.prix_history],
  );

  // V1 : on filtre le range côté client. Si pas de data réelle, on
  // fabrique une série mock cohérente (-3% à +5% sur 6 mois).
  const points = React.useMemo<PrixHistoryPoint[]>(() => {
    if (allHistory.length > 0) {
      const now = Date.now();
      const cutoffByRange: Record<PrixHistoryRange, number> = {
        "1m": now - 30 * 24 * 3600 * 1000,
        "3m": now - 90 * 24 * 3600 * 1000,
        "6m": now - 180 * 24 * 3600 * 1000,
        "1y": now - 365 * 24 * 3600 * 1000,
        all: 0,
      };
      const cutoff = cutoffByRange[range];
      return allHistory.filter((p) => new Date(p.date).getTime() >= cutoff);
    }
    // Mock — 12 points sur 6 mois avec dérive douce.
    const nbPoints =
      range === "1m" ? 4 : range === "3m" ? 8 : range === "6m" ? 12 : 16;
    return Array.from({ length: nbPoints }).map((_, i) => {
      const drift = Math.sin(i / 2) * 6_000 + i * 800;
      return {
        date: new Date(Date.now() - (nbPoints - i) * 7 * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10),
        valo: Math.round(central - 10_000 + drift),
      };
    });
  }, [allHistory, range, central]);

  return (
    <div className="space-y-7">
      {/* ── ValorisationCard ─────────────────────────────────── */}
      <section className="rounded-r-xl border border-line bg-card p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow variant="terra">Valorisation centrale</Eyebrow>
            <div className="mt-2 flex items-baseline gap-4">
              <span className="font-mono text-[44px] font-semibold leading-none tracking-[-0.022em] text-ink tnum">
                {central.toLocaleString("fr-FR")}&nbsp;€
              </span>
              <ConfBadge confidence={confidence} />
            </div>
            <p className="mt-2.5 text-[13px] text-muted-ink">
              Fourchette :{" "}
              <span className="font-mono text-ink-2 tnum">
                {low.toLocaleString("fr-FR")}&nbsp;€
              </span>{" "}
              –{" "}
              <span className="font-mono text-ink-2 tnum">
                {high.toLocaleString("fr-FR")}&nbsp;€
              </span>{" "}
              ·{" "}
              {bien.valo_updated_at
                ? `Maj le ${new Date(bien.valo_updated_at).toLocaleDateString("fr-FR")}`
                : "Première estimation"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={
                  "h-3.5 w-3.5 " + (isRefreshing ? "animate-spin" : "")
                }
              />
              {isRefreshing ? "Recalcul…" : "Rafraîchir maintenant"}
            </Button>
            <span className="text-[11.5px] text-mute-2">
              Prochaine réévaluation auto : {nextMondayLabel()}
            </span>
          </div>
        </div>
      </section>

      {/* ── Courbe ───────────────────────────────────────────── */}
      <PrixHistoryChart points={points} range={range} onRangeChange={setRange} />

      {/* ── Thèse Claude (collapsée) ─────────────────────────── */}
      <details className="group rounded-r-lg border border-line bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5">
          <div>
            <Eyebrow variant="terra">L&rsquo;analyse de Claude</Eyebrow>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Pourquoi cette valorisation
            </div>
          </div>
          <span className="text-[12px] font-medium text-violet group-open:hidden">
            Déplier
          </span>
          <span className="hidden text-[12px] font-medium text-violet group-open:inline">
            Replier
          </span>
        </summary>
        <div className="border-t border-line p-5">
          <TheseBlock
            attribution="Claude"
            title="Un T3 refait au cœur d'un sweet spot Gagny"
            className="border-0 bg-transparent p-0"
          >
            <p>
              Le Chénay est l&rsquo;un des quartiers les plus sous-évalués de
              Gagny — médiane à <b>2 279&nbsp;€/m²</b> (-46&nbsp;% vs la
              moyenne globale). Ton bien à 5&nbsp;032&nbsp;€/m² intègre une
              prime de qualité justifiée par l&rsquo;état refait et la
              proximité gare.
            </p>
            <p>
              La fourchette {low.toLocaleString("fr-FR")} –{" "}
              {high.toLocaleString("fr-FR")}&nbsp;€ reflète une incertitude
              modérée : peu de comparables refaits dans le secteur, mais une
              dynamique de transactions soutenue (12 DVF+ derniers 6 mois).
            </p>
          </TheseBlock>
        </div>
      </details>

      {/* ── Ajustements (collapsée) ──────────────────────────── */}
      <details className="group rounded-r-lg border border-line bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5">
          <div>
            <Eyebrow>Critères d&rsquo;ajustement</Eyebrow>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Ce qui pèse sur la valorisation
            </div>
          </div>
          <span className="text-[12px] font-medium text-violet group-open:hidden">
            Voir le détail
          </span>
          <span className="hidden text-[12px] font-medium text-violet group-open:inline">
            Replier
          </span>
        </summary>
        <div className="space-y-2 border-t border-line p-5">
          <AdjustmentItem
            tone="pos"
            icon={<Wrench className="h-4 w-4" />}
            criterion="État refait"
            reason="Cuisine et SDB <5 ans, sols et peintures neufs."
            sources={[{ label: "user: visite" }]}
            impactPct="+6 %"
            impactEur="+18 000 €"
          />
          <AdjustmentItem
            tone="pos"
            icon={<TrainFront className="h-4 w-4" />}
            criterion="Gare à pied"
            reason="Gagny T4 (RER E) à 8 minutes — accès direct Haussmann."
            sources={[{ label: "IGN" }, { label: "SNCF GTFS" }]}
            impactPct="+4 %"
            impactEur="+12 000 €"
          />
          <AdjustmentItem
            tone="pos"
            icon={<Sun className="h-4 w-4" />}
            criterion="Exposition SO"
            reason="Balcon plein sud-ouest, lumière toute la journée."
            impactPct="+2 %"
            impactEur="+6 000 €"
          />
          <AdjustmentItem
            tone="neg"
            icon={<AlertTriangle className="h-4 w-4" />}
            criterion="DPE D"
            reason="200 kWh/m²/an — proche du seuil E. Travaux à anticiper."
            sources={[{ label: "ADEME" }]}
            impactPct="-3 %"
            impactEur="-9 000 €"
          />
          <AdjustmentItem
            tone="neg"
            icon={<TreePine className="h-4 w-4" />}
            criterion="Pas de parking"
            reason="Pas de box ni de place de stationnement attribuée."
            impactPct="-2 %"
            impactEur="-6 000 €"
          />
        </div>
      </details>
    </div>
  );
}
