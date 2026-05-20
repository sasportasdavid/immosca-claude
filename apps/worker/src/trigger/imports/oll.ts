// Import OLL — Observatoires Locaux des Loyers (loyers signés).
//
// Source : data.gouv.fr — Réseau des Observatoires Locaux des Loyers.
// Dataset principal : "Résultats des Observatoires Locaux des Loyers"
//   https://www.data.gouv.fr/fr/datasets/r/<resource-id>
//
// ~50 territoires couverts. Format CSV. ~10k lignes par millésime.
// Refresh annuel manuel (le dataset bouge lentement, le millésime est
// passé en payload pour permettre un import historique).
//
// Pattern aligné sur dvf.ts / insee.ts : task paramétrable (URL passée
// en payload) + cron annuel qui pointe vers la dernière publication
// connue. Si l'URL casse côté data.gouv, l'URL hardcodée du cron doit
// être mise à jour — le payload manuel permet de relancer entre temps.

import { Readable } from "node:stream";

import { logger, schedules, task } from "@trigger.dev/sdk";
import { parse } from "csv-parse";
import { z } from "zod";

import { withImportRun } from "@/lib/import-runs";
import { supabaseData } from "@/lib/supabase";

const BATCH_SIZE = 1_000;

const payloadSchema = z.object({
  csvUrl: z
    .string()
    .url()
    .describe(
      "URL du CSV OLL (data.gouv.fr — Observatoires Locaux des Loyers)",
    ),
  millesime: z.number().int().min(2014).max(2099),
});

/**
 * Mappe une ligne CSV OLL vers le schéma de `oll_loyers_medians`.
 * Le format OLL contient des variations entre millésimes (libellés
 * colonnes). On accepte plusieurs noms communs.
 */
function mapRow(
  row: Record<string, string>,
  millesime: number,
): {
  annee: number;
  code_zonage_oll: string;
  nom_zonage: string;
  region: string | null;
  type_logement: "appartement" | "maison";
  nombre_pieces: string;
  epoque_construction: string | null;
  loyer_m2_median: number;
  loyer_m2_q1: number | null;
  loyer_m2_q3: number | null;
  nb_observations: number | null;
} | null {
  const code = (row.code_zonage_oll ?? row.code_zonage ?? row.zonage ?? "").trim();
  const nom = (row.nom_zonage ?? row.nom_zonage_oll ?? row.zonage_label ?? "").trim();
  const typeRaw = (row.type_logement ?? row.type_bien ?? "").toLowerCase().trim();
  const piecesRaw = (row.nombre_pieces ?? row.nb_pieces ?? row.pieces ?? "").trim();
  const epoque = (row.epoque_construction ?? row.epoque ?? row.periode ?? "").trim() || null;
  const median = Number(row.loyer_m2_median ?? row.loyer_median ?? row.mediane);
  const q1 = row.loyer_m2_q1 ?? row.q1 ?? row.quartile_1;
  const q3 = row.loyer_m2_q3 ?? row.q3 ?? row.quartile_3;
  const nbObs = row.nb_observations ?? row.n_obs ?? row.effectif;

  if (!code || !nom || !typeRaw || !piecesRaw || !Number.isFinite(median)) {
    return null;
  }

  // Normalisation type_logement : OLL utilise parfois "individuel"/"collectif"
  const typeLogement: "appartement" | "maison" =
    typeRaw.includes("maison") || typeRaw.includes("individuel")
      ? "maison"
      : "appartement";

  // Normalisation nombre_pieces : OLL peut écrire "4 et plus", "T4+", "4_plus"
  const pieces = piecesRaw.replace(/[^0-9+_a-z]/gi, "").toLowerCase();
  const nbPieces =
    pieces.startsWith("1") ? "1"
    : pieces.startsWith("2") ? "2"
    : pieces.startsWith("3") ? "3"
    : "4_plus";

  return {
    annee: millesime,
    code_zonage_oll: code,
    nom_zonage: nom,
    region: row.region || row.nom_region || null,
    type_logement: typeLogement,
    nombre_pieces: nbPieces,
    epoque_construction: epoque,
    loyer_m2_median: Number(median.toFixed(2)),
    loyer_m2_q1: q1 ? Number(Number(q1).toFixed(2)) : null,
    loyer_m2_q3: q3 ? Number(Number(q3).toFixed(2)) : null,
    nb_observations: nbObs ? Number(nbObs) : null,
  };
}

async function flushBatch(
  batch: ReturnType<typeof mapRow>[],
  log: (msg: string, extra?: Record<string, unknown>) => void,
): Promise<number> {
  const rows = batch.filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return 0;
  const { error, count } = await supabaseData
    .from("oll_loyers_medians")
    .upsert(rows, {
      onConflict: "annee,code_zonage_oll,type_logement,nombre_pieces,epoque_construction",
      ignoreDuplicates: false,
      count: "exact",
    });
  if (error) {
    log("OLL upsert error", { error: error.message, batchSize: rows.length });
    throw error;
  }
  return count ?? rows.length;
}

// ─── Task manuelle ──────────────────────────────────────────────

export const ollImport = task({
  id: "imports.oll_loyers",
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async (payload: unknown) => {
    const { csvUrl, millesime } = payloadSchema.parse(payload);

    return withImportRun("oll", async ({ log }) => {
      log("OLL téléchargement", { csvUrl, millesime });
      const res = await fetch(csvUrl);
      if (!res.ok || !res.body) {
        throw new Error(`OLL fetch ${csvUrl} → ${res.status}`);
      }

      const stream = Readable.fromWeb(res.body as never);
      const parser = stream.pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          // OLL utilise parfois ';' comme séparateur (CSV FR).
          delimiter: [",", ";"],
        }),
      );

      let batch: ReturnType<typeof mapRow>[] = [];
      let total = 0;
      let inserted = 0;
      let skipped = 0;

      for await (const row of parser) {
        const mapped = mapRow(row as Record<string, string>, millesime);
        total += 1;
        if (mapped === null) {
          skipped += 1;
          continue;
        }
        batch.push(mapped);
        if (batch.length >= BATCH_SIZE) {
          inserted += await flushBatch(batch, log);
          batch = [];
        }
      }
      if (batch.length > 0) {
        inserted += await flushBatch(batch, log);
      }

      log("OLL import terminé", { total, inserted, skipped, millesime });
      return {
        rowsImported: inserted,
        metadata: { total, skipped, millesime, csvUrl },
      };
    });
  },
});

// ─── Cron annuel : 15 décembre pour le millésime N-1 ──────────────

export const ollImportScheduled = schedules.task({
  id: "imports.oll_loyers.scheduled",
  cron: "0 4 15 12 *", // 15 décembre 4h UTC
  maxDuration: 600,
  run: async () => {
    const millesime = new Date().getFullYear() - 1;
    // URL placeholder — à mettre à jour selon la dernière publication OLL.
    // Si data.gouv casse l'URL, lancer manuellement `imports.oll_loyers`
    // avec la nouvelle URL en payload.
    const csvUrl = `https://static.data.gouv.fr/resources/observatoires-locaux-des-loyers-resultats/${millesime}/oll-${millesime}.csv`;
    logger.warn("OLL scheduled trigger — vérifier que l'URL est à jour", {
      csvUrl,
      millesime,
    });
    await ollImport.trigger({ csvUrl, millesime });
  },
});
