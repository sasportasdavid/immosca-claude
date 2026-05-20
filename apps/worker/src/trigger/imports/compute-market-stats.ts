// ────────────────────────────────────────────────────────────────────
// Cron `compute-market-stats` — mensuel le 5 à 4h UTC
// ────────────────────────────────────────────────────────────────────
// Pipeline :
//   immoscan-data.dvf_medians_commune (matérialisée par DVF import)
//        │
//        ▼  SELECT (filtre n_transactions >= SIGNAL_MIN_TRANSACTIONS)
//   immoscan-app.market_stats_cache (PR-D table créée vide)
//        │
//        ▼  lookup côté watch-scout pour event signal_to_verify
//
// V1 limitation : DVF ne contient PAS le DPE → on stocke dpe_bin='unknown'.
// Le watch-scout (PR-E.3) fait un fallback lookup sur 'unknown' si le bin
// exact n'existe pas. Quand on aura un crossing DVF×ADEME, ce cron
// génèrera les 3 bins (A_C, D_E, F_G).
//
// Filtre n_transactions >= 15 (BM §5.2 / Veille §6) appliqué ici :
// les communes avec trop peu de mutations sont skippées (pas de signal
// fiable possible).

import { logger, schedules } from "@trigger.dev/sdk";
import { SIGNAL_MIN_TRANSACTIONS } from "@immoscan/shared";

import { Sentry } from "@/lib/sentry";
import { supabaseApp, supabaseData } from "@/lib/supabase";

const UPSERT_BATCH = 500;

interface ComputeStatsResult {
  rows_read: number;
  rows_skipped_too_few_tx: number;
  rows_upserted: number;
  communes_distinct: number;
  most_recent_year: number | null;
}

async function computeMarketStats(): Promise<ComputeStatsResult> {
  // 1. Trouve l'année la plus récente avec données (refresh DVF trimestriel).
  //    On utilise cette année comme `window_end`.
  const { data: maxYearRow } = await supabaseData
    .from("dvf_medians_commune")
    .select("annee")
    .order("annee", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mostRecentYear = maxYearRow?.annee ?? null;
  if (!mostRecentYear) {
    logger.info("compute-market-stats: no DVF data available, skip");
    return {
      rows_read: 0,
      rows_skipped_too_few_tx: 0,
      rows_upserted: 0,
      communes_distinct: 0,
      most_recent_year: null,
    };
  }

  const windowEnd = `${mostRecentYear}-12-31`;
  const windowStart = `${mostRecentYear - 1}-01-01`; // approxime "12 mois" via 2 années (la vue groupe par année)

  // 2. Lit toutes les médianes commune × type pour l'année la plus récente.
  //    `dvf_medians_commune` filtre déjà type_local in ('Maison', 'Appartement')
  //    et nature_mutation='Vente'.
  const { data: medians, error } = await supabaseData
    .from("dvf_medians_commune")
    .select("code_commune, type_local, median_prix_m2, q1_prix_m2, q3_prix_m2, nb_mutations, annee")
    .eq("annee", mostRecentYear);
  if (error) throw new Error(`dvf_medians_commune read failed: ${error.message}`);

  const rowsRead = (medians ?? []).length;
  if (rowsRead === 0) {
    return {
      rows_read: 0,
      rows_skipped_too_few_tx: 0,
      rows_upserted: 0,
      communes_distinct: 0,
      most_recent_year: mostRecentYear,
    };
  }

  // 3. Map DVF type_local ("Maison" / "Appartement") → enum bien_type ("maison" / "appartement").
  //    Filtre n_transactions >= SIGNAL_MIN_TRANSACTIONS pour signal fiable.
  //    dpe_bin = 'unknown' en V1 (cf header).
  const toUpsert: {
    commune_insee: string;
    bien_type: "appartement" | "maison";
    dpe_bin: "unknown";
    median_eur_m2: number;
    p25_eur_m2: number | null;
    p75_eur_m2: number | null;
    n_transactions: number;
    window_start: string;
    window_end: string;
  }[] = [];

  let skipped = 0;
  const communeSet = new Set<string>();

  for (const row of medians ?? []) {
    const nbMut = row.nb_mutations ?? 0;
    if (nbMut < SIGNAL_MIN_TRANSACTIONS) {
      skipped++;
      continue;
    }
    if (!row.median_prix_m2 || row.median_prix_m2 <= 0) continue;
    if (!row.code_commune) continue;
    const bienType =
      row.type_local === "Maison" ? "maison" : row.type_local === "Appartement" ? "appartement" : null;
    if (!bienType) continue;

    toUpsert.push({
      commune_insee: row.code_commune,
      bien_type: bienType,
      dpe_bin: "unknown",
      median_eur_m2: Number(row.median_prix_m2),
      p25_eur_m2: row.q1_prix_m2 != null ? Number(row.q1_prix_m2) : null,
      p75_eur_m2: row.q3_prix_m2 != null ? Number(row.q3_prix_m2) : null,
      n_transactions: nbMut,
      window_start: windowStart,
      window_end: windowEnd,
    });
    communeSet.add(row.code_commune);
  }

  // 4. UPSERT en batches dans market_stats_cache.
  //    Conflit sur (commune_insee, bien_type, dpe_bin) → écrase les anciennes valeurs.
  let upserted = 0;
  for (let i = 0; i < toUpsert.length; i += UPSERT_BATCH) {
    const batch = toUpsert.slice(i, i + UPSERT_BATCH);
    const { error: upsertErr } = await supabaseApp
      .from("market_stats_cache")
      .upsert(batch, { onConflict: "commune_insee,bien_type,dpe_bin" });
    if (upsertErr) {
      throw new Error(`market_stats_cache upsert failed: ${upsertErr.message}`);
    }
    upserted += batch.length;
  }

  logger.info("compute-market-stats done", {
    rowsRead,
    skipped,
    upserted,
    communes: communeSet.size,
    mostRecentYear,
  });

  return {
    rows_read: rowsRead,
    rows_skipped_too_few_tx: skipped,
    rows_upserted: upserted,
    communes_distinct: communeSet.size,
    most_recent_year: mostRecentYear,
  };
}

// 5e du mois à 4h UTC = 1h après le watch-purge (3h) + 5h avant l'expiration mailer.
// Mensuel suffit : DVF refresh trimestriel + les médianes annuelles bougent peu.
export const computeMarketStatsTask = schedules.task({
  id: "compute-market-stats",
  cron: "0 4 5 * *",
  maxDuration: 600,
  run: async () => {
    try {
      return await computeMarketStats();
    } catch (err) {
      Sentry.captureException(err, { tags: { context: "compute-market-stats" } });
      throw err;
    }
  },
});

// On expose aussi le helper pour pouvoir l'appeler depuis l'import DVF
// après refresh des matérialisées (chaîne : DVF import → refresh views →
// compute-market-stats trigger immédiat plutôt que d'attendre le cron mensuel).
export { computeMarketStats };

// Stub appelable manuellement depuis Trigger.dev dashboard (rerun ad-hoc).
import { task as triggerTask } from "@trigger.dev/sdk";
export const computeMarketStatsManual = triggerTask({
  id: "compute-market-stats.manual",
  maxDuration: 600,
  run: async () => computeMarketStats(),
});
