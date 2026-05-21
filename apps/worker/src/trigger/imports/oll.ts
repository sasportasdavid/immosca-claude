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

import { task } from "@trigger.dev/sdk";
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
  // Vrais noms de colonnes OLL nationale (vérifiés sur
  // www.observatoires-des-loyers.org/datagouv/2024/Base_OP_2024_Nationale.csv) :
  //   Observatory;Data_year;agglomeration;Zone_complementaire;Type_habitat;
  //   epoque_construction_homogene;anciennete_locataire_homogene;
  //   nombre_pieces_homogene;loyer_1_decile;loyer_1_quartile;loyer_median;
  //   loyer_3_quartile;loyer_9_decile;loyer_moyen;...;surface_moyenne;
  //   nombre_observations;nombre_logements;methodologie_production
  //
  // Notes :
  //   - loyer_median est déjà en €/m² (valeurs ~10-25, cohérent avec loyer
  //     parisien/banlieue). Les colonnes loyer_mensuel_* donnent les loyers
  //     totaux mensuels (en €).
  //   - Les nombres décimaux utilisent ',' (10,4 → on remplace par '.').
  //   - Type_habitat peut être vide (ligne aggrégée) ou "Appartement 1-3P",
  //     "Maison 4-5P", etc.
  const code = (row.Observatory ?? "").trim();
  const nom = (row.agglomeration ?? "").trim();
  const typeRaw = (row.Type_habitat ?? "").toLowerCase().trim();
  const piecesRaw = (row.nombre_pieces_homogene ?? "").trim();
  const epoque = (row.epoque_construction_homogene ?? "").trim() || null;
  const parseDecimalFr = (v: string | undefined): number =>
    Number((v ?? "").replace(",", "."));
  const median = parseDecimalFr(row.loyer_median);
  const q1 = parseDecimalFr(row.loyer_1_quartile);
  const q3 = parseDecimalFr(row.loyer_3_quartile);
  const nbObs = Number(row.nombre_observations ?? "");

  // On ne stocke que les lignes désagrégées (Type_habitat + pieces non
  // vides). Les lignes aggrégées sans Type_habitat sont skippées car
  // elles ne sont pas exploitables par rpc_oll_market(type, pieces).
  if (!code || !nom || !typeRaw || !piecesRaw || !Number.isFinite(median)) {
    return null;
  }

  // Type_habitat OLL : "Appartement X-YP" ou "Maison X-YP" (ex: "Maison 1-3P")
  const typeLogement: "appartement" | "maison" = typeRaw.startsWith("maison")
    ? "maison"
    : "appartement";

  // nombre_pieces_homogene OLL : "1 pièce", "2 pièces", "3 pièces",
  // "4 pièces et plus", etc. On extrait le premier chiffre et on
  // normalise sur "1" / "2" / "3" / "4_plus".
  const piecesNum = piecesRaw.match(/^(\d+)/)?.[1] ?? "";
  const nbPieces =
    piecesNum === "1" ? "1"
    : piecesNum === "2" ? "2"
    : piecesNum === "3" ? "3"
    : "4_plus";

  return {
    annee: millesime,
    code_zonage_oll: code,
    nom_zonage: nom,
    region: null, // OLL national n'expose pas la région directement
    type_logement: typeLogement,
    nombre_pieces: nbPieces,
    epoque_construction: epoque,
    loyer_m2_median: Number(median.toFixed(2)),
    loyer_m2_q1: Number.isFinite(q1) ? Number(q1.toFixed(2)) : null,
    loyer_m2_q3: Number.isFinite(q3) ? Number(q3.toFixed(2)) : null,
    nb_observations: Number.isFinite(nbObs) ? nbObs : null,
  };
}

async function flushBatch(
  batch: ReturnType<typeof mapRow>[],
  log: (msg: string, extra?: Record<string, unknown>) => void,
): Promise<number> {
  const valid = batch.filter((r): r is NonNullable<typeof r> => r !== null);
  if (valid.length === 0) return 0;
  // Postgres ON CONFLICT DO UPDATE refuse 2 lignes avec la même clé
  // unique dans le même batch. Le CSV OLL agrège plusieurs millésimes/
  // observatoires/épochs identiques → on déduplique en gardant la
  // dernière occurrence (la plus récente sera typiquement la version
  // corrigée par l'observatoire).
  const dedup = new Map<string, NonNullable<typeof batch[number]>>();
  for (const row of valid) {
    const key = [
      row.annee, row.code_zonage_oll, row.type_logement,
      row.nombre_pieces, row.epoque_construction ?? "",
    ].join("|");
    dedup.set(key, row);
  }
  const rows = Array.from(dedup.values());
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
          // OLL utilise ';' comme séparateur (CSV FR avec virgules
          // décimales dans les loyers, ex: "10,4"). Auto-detect entre
          // ',' et ';' confond les nombres → on force le ';'.
          delimiter: ";",
          relax_column_count: true,
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

// Pas de cron OLL (limite 10 schedules / plan gratuit Trigger.dev déjà
// atteinte). Le refresh annuel se lance manuellement via le script
// scripts/imports/run-all-imports.sh ou en triggant directement
// `imports.oll_loyers` depuis le dashboard Trigger.dev.
