// Import Education — Annuaire des établissements scolaires + IPS.
//
// Sources :
// - Annuaire : https://www.data.gouv.fr/fr/datasets/r/<id> (csv-base)
//   ~70k établissements (écoles, collèges, lycées) avec adresse + coords
// - IPS : data.education.gouv.fr (Indice de Position Sociale) — annuel,
//   école primaire / collège / lycée séparés.
//
// Stratégie : 1 task paramétrable par CSV source. Refresh annuel
// (calendrier scolaire). IPS publié vers septembre N pour rentrée N-1.

import { Readable } from "node:stream";

import { task } from "@trigger.dev/sdk";
import { parse } from "csv-parse";
import { z } from "zod";

import { withImportRun } from "@/lib/import-runs";
import { supabaseData } from "@/lib/supabase";

const BATCH_SIZE = 2_000;

// ─── Annuaire des établissements ────────────────────────────────

const annuairePayloadSchema = z.object({
  csvUrl: z
    .string()
    .url()
    .describe("URL du CSV Annuaire de l'Éducation Nationale (data.gouv.fr)"),
});

/**
 * Mappe une ligne CSV de l'annuaire vers `education_etablissements`.
 * L'annuaire de l'Éducation Nationale utilise des colonnes stables :
 * identifiant_de_l_etablissement (UAI), nom_etablissement, type_etablissement,
 * statut_public_prive, code_postal, code_commune, adresse_1, latitude,
 * longitude.
 */
function mapAnnuaire(
  row: Record<string, string>,
): {
  id: string;
  nom_etablissement: string;
  type_etablissement: string;
  secteur: string | null;
  code_postal: string | null;
  code_commune: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
} | null {
  const uai = (row.identifiant_de_l_etablissement ?? row.uai ?? row.numero_uai ?? "")
    .trim();
  const nom = (row.nom_etablissement ?? row.appellation_officielle ?? "").trim();
  const typeRaw = (row.type_etablissement ?? "").toLowerCase().trim();
  if (!uai || !nom || !typeRaw) return null;

  // Normalisation type : "École", "Collège", "Lycée"... → "ecole" / "college" / "lycee"
  let type = "autre";
  if (typeRaw.includes("école") || typeRaw.includes("ecole")) type = "ecole";
  else if (typeRaw.includes("collège") || typeRaw.includes("college")) type = "college";
  else if (typeRaw.includes("lycée") || typeRaw.includes("lycee")) type = "lycee";

  const statutRaw = (row.statut_public_prive ?? row.secteur_public_prive ?? "")
    .toLowerCase()
    .trim();
  const secteur = statutRaw.includes("priv") ? "prive" : statutRaw.includes("public") ? "public" : null;

  const lat = row.latitude ? Number(row.latitude) : null;
  const lng = row.longitude ? Number(row.longitude) : null;

  return {
    id: uai,
    nom_etablissement: nom,
    type_etablissement: type,
    secteur,
    code_postal: row.code_postal || null,
    code_commune: row.code_commune || null,
    adresse: row.adresse_1 || row.adresse || null,
    lat: lat && Number.isFinite(lat) ? lat : null,
    lng: lng && Number.isFinite(lng) ? lng : null,
  };
}

async function flushAnnuaire(
  batch: ReturnType<typeof mapAnnuaire>[],
  log: (msg: string, extra?: Record<string, unknown>) => void,
): Promise<number> {
  const rows = batch.filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return 0;
  const { error, count } = await supabaseData
    .from("education_etablissements")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false, count: "exact" });
  if (error) {
    log("Education upsert error", { error: error.message, batchSize: rows.length });
    throw error;
  }
  return count ?? rows.length;
}

export const educationAnnuaireImport = task({
  id: "imports.education_annuaire",
  maxDuration: 1200,
  retry: { maxAttempts: 2 },
  run: async (payload: unknown) => {
    const { csvUrl } = annuairePayloadSchema.parse(payload);

    return withImportRun("education", async ({ log }) => {
      log("Annuaire téléchargement", { csvUrl });
      const res = await fetch(csvUrl);
      if (!res.ok || !res.body) {
        throw new Error(`Annuaire fetch ${csvUrl} → ${res.status}`);
      }

      const stream = Readable.fromWeb(res.body as never);
      const parser = stream.pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          delimiter: [",", ";"],
        }),
      );

      let batch: ReturnType<typeof mapAnnuaire>[] = [];
      let total = 0;
      let inserted = 0;
      let skipped = 0;

      for await (const row of parser) {
        const mapped = mapAnnuaire(row as Record<string, string>);
        total += 1;
        if (mapped === null) {
          skipped += 1;
          continue;
        }
        batch.push(mapped);
        if (batch.length >= BATCH_SIZE) {
          inserted += await flushAnnuaire(batch, log);
          batch = [];
        }
      }
      if (batch.length > 0) {
        inserted += await flushAnnuaire(batch, log);
      }

      log("Annuaire import terminé", { total, inserted, skipped });
      return {
        rowsImported: inserted,
        metadata: { total, skipped, csvUrl },
      };
    });
  },
});

// ─── IPS (Indice de Position Sociale) ────────────────────────────

const ipsPayloadSchema = z.object({
  csvUrl: z
    .string()
    .url()
    .describe("URL du CSV IPS (data.education.gouv.fr)"),
  millesime: z.number().int().min(2014).max(2099),
});

/**
 * Met à jour les colonnes `ips` + `ips_annee` sur `education_etablissements`
 * (les rows doivent exister via l'import Annuaire préalable).
 */
function mapIps(
  row: Record<string, string>,
  millesime: number,
): { id: string; ips: number; ips_annee: number } | null {
  const uai = (row.uai ?? row.identifiant_de_l_etablissement ?? "").trim();
  const ipsRaw = row.ips ?? row.ips_etablissement ?? row.ips_moyen;
  if (!uai || !ipsRaw) return null;
  const ips = Number(ipsRaw);
  if (!Number.isFinite(ips)) return null;
  return { id: uai, ips: Number(ips.toFixed(2)), ips_annee: millesime };
}

export const educationIpsImport = task({
  id: "imports.education_ips",
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async (payload: unknown) => {
    const { csvUrl, millesime } = ipsPayloadSchema.parse(payload);

    return withImportRun("education", async ({ log }) => {
      log("IPS téléchargement", { csvUrl, millesime });
      const res = await fetch(csvUrl);
      if (!res.ok || !res.body) {
        throw new Error(`IPS fetch ${csvUrl} → ${res.status}`);
      }

      const stream = Readable.fromWeb(res.body as never);
      const parser = stream.pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          delimiter: [",", ";"],
        }),
      );

      let total = 0;
      let updated = 0;
      let skipped = 0;
      let buf: { id: string; ips: number; ips_annee: number }[] = [];

      const flushIps = async () => {
        if (buf.length === 0) return;
        // L'IPS ne sert qu'à patcher des rows existantes (annuaire importé
        // au préalable). On fait un UPDATE par UAI plutôt qu'un upsert
        // pour éviter de créer des rows sans nom_etablissement /
        // type_etablissement (NOT NULL). Coût : N round-trips, mais
        // ~50k établissements / annual run reste tolérable.
        let batchUpdated = 0;
        await Promise.all(
          buf.map(async (row) => {
            const { error } = await supabaseData
              .from("education_etablissements")
              .update({ ips: row.ips, ips_annee: row.ips_annee })
              .eq("id", row.id);
            if (error) {
              log("IPS update error", { error: error.message, uai: row.id });
              return;
            }
            batchUpdated += 1;
          }),
        );
        updated += batchUpdated;
        buf = [];
      };

      for await (const row of parser) {
        total += 1;
        const mapped = mapIps(row as Record<string, string>, millesime);
        if (!mapped) {
          skipped += 1;
          continue;
        }
        buf.push(mapped);
        if (buf.length >= BATCH_SIZE) await flushIps();
      }
      await flushIps();

      log("IPS import terminé", { total, updated, skipped, millesime });
      return {
        rowsImported: updated,
        metadata: { total, skipped, millesime, csvUrl, mode: "ips_update" },
      };
    });
  },
});

// Pas de cron Education (limite 10 schedules / plan gratuit Trigger.dev
// déjà atteinte). Le refresh annuel se lance manuellement via le script
// scripts/imports/run-all-imports.sh ou en triggant directement
// `imports.education_annuaire` puis `imports.education_ips` depuis le
// dashboard Trigger.dev.
