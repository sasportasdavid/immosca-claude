// Import DVF+ Cerema : transactions immobilières France entière.
//
// Source : https://files.data.gouv.fr/geo-dvf/latest/csv/<annee>/full.csv.gz
// Volume : ~1.5M lignes / année, ~3 GB en cumul sur 5 ans.
// Stratégie : 1 task par millésime. Stream + parse + batches Supabase
// (insert avec ignoreDuplicates pour idempotence en cas de retry).
//
// 2 tasks exportées :
// - `dvfImport` : task manuelle, prend `{ millesime: number }`
// - `dvfImportScheduled` : cron trimestriel qui déclenche pour l'année
//   courante. `0 3 1 */3 *` = 1er du trimestre à 3h UTC.

import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

import { logger, schedules, task } from "@trigger.dev/sdk/v3";
import { parse } from "csv-parse";
import { z } from "zod";

import { withImportRun } from "@/lib/import-runs";
import { supabaseData } from "@/lib/supabase";

const BATCH_SIZE = 5_000;

const payloadSchema = z.object({
  millesime: z.number().int().min(2014).max(2099),
});

// DVF row → format DB. Tolère les valeurs vides du CSV (lignes incomplètes).
function mapRow(row: Record<string, string>, millesime: string) {
  const idMutation = row.id_mutation?.trim();
  const codeCommune = row.code_commune?.trim();
  const dateMutation = row.date_mutation?.trim();
  // date_mutation et code_commune sont NOT NULL côté DB. Skip si manquants.
  if (!idMutation || !codeCommune || !dateMutation) return null;

  const lat = row.latitude ? Number(row.latitude) : null;
  const lng = row.longitude ? Number(row.longitude) : null;
  const valeur = row.valeur_fonciere ? Number(row.valeur_fonciere) : null;
  const surface = row.surface_reelle_bati ? Number(row.surface_reelle_bati) : null;
  const surfaceTerrain = row.surface_terrain ? Number(row.surface_terrain) : null;
  const pieces = row.nombre_pieces_principales
    ? Number(row.nombre_pieces_principales)
    : null;

  return {
    id_mutation: idMutation,
    date_mutation: dateMutation,
    nature_mutation: row.nature_mutation || "Vente",
    valeur_fonciere: valeur,
    code_postal: row.code_postal || null,
    code_commune: codeCommune,
    nom_commune: row.nom_commune || "",
    code_departement: row.code_departement || codeCommune.slice(0, 2),
    code_iris: row.code_iris || null,
    type_local: row.type_local || null,
    surface_reelle_bati: surface,
    nombre_pieces_principales: pieces,
    surface_terrain: surfaceTerrain,
    longitude: lng,
    latitude: lat,
    // geom : à backfill par trigger ou via SQL (PostGIS), null à l'insert
    millesime_dvf: millesime,
  };
}

async function flushBatch(
  batch: ReturnType<typeof mapRow>[],
  log: (msg: string, extra?: Record<string, unknown>) => void,
): Promise<number> {
  const rows = batch.filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return 0;
  const { error, count } = await supabaseData
    .from("dvf_mutations")
    .upsert(rows, { onConflict: "id_mutation", ignoreDuplicates: true, count: "exact" });
  if (error) {
    log("DVF upsert error", { error: error.message, batchSize: rows.length });
    throw error;
  }
  return count ?? rows.length;
}

export const dvfImport = task({
  id: "imports.dvf",
  maxDuration: 3600, // 1h max par millésime
  retry: { maxAttempts: 2, minTimeoutInMs: 30_000 },
  run: async (payload: unknown) => {
    const { millesime } = payloadSchema.parse(payload);
    const millesimeStr = String(millesime);
    const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/${millesime}/full.csv.gz`;

    return withImportRun("dvf", async ({ log }) => {
      log(`DVF import millésime ${millesime}`, { url });

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`DVF download ${res.status}: ${url}`);
      }
      if (!res.body) {
        throw new Error("DVF: response.body null");
      }

      // Web Stream → Node Stream → gunzip → csv-parse
      const nodeStream = Readable.fromWeb(
        res.body as unknown as Parameters<typeof Readable.fromWeb>[0],
      );
      const parser = nodeStream.pipe(createGunzip()).pipe(
        parse({ columns: true, skip_empty_lines: true, relax_quotes: true }),
      );

      let batch: ReturnType<typeof mapRow>[] = [];
      let totalRows = 0;
      let totalInserted = 0;

      for await (const record of parser) {
        const mapped = mapRow(record as Record<string, string>, millesimeStr);
        if (!mapped) continue;
        batch.push(mapped);
        totalRows++;
        if (batch.length >= BATCH_SIZE) {
          totalInserted += await flushBatch(batch, log);
          batch = [];
          if (totalRows % 50_000 === 0) {
            log(`Progress: ${totalRows} rows parsed, ${totalInserted} inserted`);
            logger.info("DVF progress", { totalRows, totalInserted });
          }
        }
      }
      if (batch.length > 0) {
        totalInserted += await flushBatch(batch, log);
      }

      log(`DVF import done`, { totalRows, totalInserted });

      // Refresh matérialisées (CONCURRENTLY pour ne pas bloquer les reads)
      log("Refreshing materialized views…");
      const { error: refreshErr1 } = await supabaseData.rpc("refresh_dvf_medians" as never);
      if (refreshErr1) {
        // Pas bloquant : on log mais ne fail pas le run. Le PO peut
        // refresh manuellement si la RPC n'existe pas encore.
        log("RPC refresh_dvf_medians indisponible (à créer côté SQL)", {
          error: refreshErr1.message,
        });
      }

      return {
        rowsImported: totalInserted,
        metadata: { millesime, totalRowsParsed: totalRows, url },
      };
    });
  },
});

export const dvfImportScheduled = schedules.task({
  id: "imports.dvf.scheduled",
  cron: "0 3 1 */3 *", // 1er du trimestre à 3h UTC
  run: async () => {
    const year = new Date().getFullYear();
    await dvfImport.trigger({ millesime: year });
  },
});
