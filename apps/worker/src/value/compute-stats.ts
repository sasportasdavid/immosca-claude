// Worker `value-compute-stats` — cron daily 5h UTC.
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.4.
//
// Pour chaque bien visible (discret + public), agrège depuis
// `value.consultation_events` les compteurs (vues_total, vues_7j,
// vues_30j, favoris_actifs, durée mediane, etc.) puis upsert dans
// `value.bien_stats`.
//
// Aussi calcule les ratios vs médiane IRIS (combien le bien performe-t-il
// par rapport aux autres biens de son secteur).

import { logger, schedules } from "@trigger.dev/sdk";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";

const BATCH_SIZE = 100;

interface BienVisibleRow {
  id: string;
  status: string;
  code_iris: string;
  bien_data: { typologie?: string } | null;
}

interface StatsAggregate {
  vues_total: number;
  vues_uniques: number;
  vues_7j: number;
  vues_30j: number;
  favoris_actifs: number;
  favoris_total_historique: number;
  partages_total: number;
  retours_visiteurs: number;
  duree_consultation_mediane_sec: number | null;
  taux_long_view: number;
  pct_vues_investisseurs: number;
  pct_vues_primo: number;
  pct_vues_secundo: number;
  score_moyen_acheteurs: number | null;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid] ?? null;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return (a + b) / 2;
}

async function computeStatsFromEvents(bien_id: string): Promise<StatsAggregate> {
  const now = Date.now();
  const cutoff7 = new Date(now - 7 * 86_400_000).toISOString();
  const cutoff30 = new Date(now - 30 * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (supabaseApp as any)
    .schema("value")
    .from("consultation_events")
    .select(
      "event_type, duree_sec, visitor_hash, buyer_profile_snapshot, created_at",
    )
    .eq("bien_id", bien_id);

  if (error) {
    throw new Error(`consultation_events fetch failed: ${error.message}`);
  }

  type EventRow = {
    event_type: string;
    duree_sec: number | null;
    visitor_hash: string;
    buyer_profile_snapshot: {
      is_investor?: boolean;
      primary_residence_seeker?: boolean;
      strategy?: string;
    } | null;
    created_at: string;
  };
  const rows: EventRow[] = events ?? [];

  let vues_total = 0;
  let vues_7j = 0;
  let vues_30j = 0;
  let partages = 0;
  let longViews = 0;
  let retours = 0;
  let favorisAdded = 0;
  let favorisRemoved = 0;
  const visiteurs = new Set<string>();
  const durations: number[] = [];
  const visiteurCount = new Map<string, number>();
  let pctInvest = 0;
  let pctPrimo = 0;
  let pctSecundo = 0;
  let profileScored = 0;

  for (const ev of rows) {
    if (ev.event_type === "view" || ev.event_type === "long_view") {
      vues_total += 1;
      visiteurs.add(ev.visitor_hash);
      if (ev.created_at >= cutoff7) vues_7j += 1;
      if (ev.created_at >= cutoff30) vues_30j += 1;
      const count = (visiteurCount.get(ev.visitor_hash) ?? 0) + 1;
      visiteurCount.set(ev.visitor_hash, count);
      if (ev.duree_sec) durations.push(ev.duree_sec);
      if (ev.event_type === "long_view") longViews += 1;
      const p = ev.buyer_profile_snapshot;
      if (p) {
        profileScored += 1;
        if (p.is_investor) pctInvest += 1;
        else if (p.primary_residence_seeker) pctPrimo += 1;
        else pctSecundo += 1;
      }
    } else if (ev.event_type === "share") {
      partages += 1;
    } else if (ev.event_type === "favorite_add") {
      favorisAdded += 1;
    } else if (ev.event_type === "favorite_remove") {
      favorisRemoved += 1;
    } else if (ev.event_type === "return_visit") {
      retours += 1;
    }
  }

  const favoris_actifs = Math.max(0, favorisAdded - favorisRemoved);

  return {
    vues_total,
    vues_uniques: visiteurs.size,
    vues_7j,
    vues_30j,
    favoris_actifs,
    favoris_total_historique: favorisAdded,
    partages_total: partages,
    retours_visiteurs: retours,
    duree_consultation_mediane_sec: median(durations) ?? null,
    taux_long_view: vues_total > 0 ? longViews / vues_total : 0,
    pct_vues_investisseurs: profileScored > 0 ? pctInvest / profileScored : 0,
    pct_vues_primo: profileScored > 0 ? pctPrimo / profileScored : 0,
    pct_vues_secundo: profileScored > 0 ? pctSecundo / profileScored : 0,
    score_moyen_acheteurs: null, // TODO PR-V2 : moyenne du score ImmoScan des visiteurs
  };
}

/**
 * Calcule les médianes vues_30j / favoris_actifs pour les biens du même
 * IRIS + typologie, afin de produire un ratio "ce bien performe-t-il
 * mieux ou moins que les autres du quartier ?".
 *
 * Stub PR-V1 : nécessite que `value.bien_stats` soit déjà alimentée
 * pour les autres biens du secteur (chicken-and-egg). On retourne
 * (1, 1) → ratio neutre. En PR-V2 on swap pour une vraie agrégation.
 */
async function getIrisAggregateStats(
  _codeIris: string,
  _typologie: string,
): Promise<{ vues_mediane: number; favoris_mediane: number }> {
  // TODO PR-V2 brancher sur RPC value.rpc_iris_aggregate_stats
  return { vues_mediane: 1, favoris_mediane: 1 };
}

function computeRelative(value: number, median_: number): number {
  if (!Number.isFinite(median_) || median_ <= 0) return 0;
  return ((value - median_) / median_) * 100;
}

async function upsertBienStats(
  bien_id: string,
  stats: StatsAggregate & {
    vues_vs_mediane_iris_pct: number;
    favoris_vs_mediane_iris_pct: number;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseApp as any)
    .schema("value")
    .from("bien_stats")
    .upsert({ bien_id, ...stats, computed_at: new Date().toISOString() });
  if (error) {
    throw new Error(`bien_stats upsert failed: ${error.message}`);
  }
}

async function batchProcess<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fn));
    for (const r of results) {
      if (r.status === "fulfilled") processed += 1;
      else errors += 1;
    }
  }
  return { processed, errors };
}

export const valueComputeStats = schedules.task({
  id: "value-compute-stats",
  cron: "0 5 * * *",
  maxDuration: 1800,
  run: async () => {
    logger.info("value-compute-stats start");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .select("id, status, code_iris, bien_data")
        .in("status", ["discret", "public"]);

      if (error) throw new Error(`biens select failed: ${error.message}`);
      const biens: BienVisibleRow[] = (data ?? []) as BienVisibleRow[];
      logger.info(`value-compute-stats: ${biens.length} biens visibles`);

      const stats = await batchProcess(biens, BATCH_SIZE, async (bien) => {
        const agg = await computeStatsFromEvents(bien.id);
        const sector = await getIrisAggregateStats(
          bien.code_iris,
          bien.bien_data?.typologie ?? "",
        );
        const final = {
          ...agg,
          vues_vs_mediane_iris_pct: computeRelative(
            agg.vues_30j,
            sector.vues_mediane,
          ),
          favoris_vs_mediane_iris_pct: computeRelative(
            agg.favoris_actifs,
            sector.favoris_mediane,
          ),
        };
        await upsertBienStats(bien.id, final);
      });

      logger.info("value-compute-stats done", stats);
      return { ...stats, total: biens.length };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { worker: "value-compute-stats" },
      });
      throw err;
    }
  },
});
