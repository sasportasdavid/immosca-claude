// Imports INSEE — IRIS géométries + Filosofi (revenus médians par IRIS).
//
// Sources :
// - IRIS géoms : https://geoservices.ign.fr/contoursiris (GeoJSON, ~50k IRIS)
// - Filosofi par IRIS : https://www.insee.fr/fr/statistiques/<id>
//
// Stratégie : refresh annuel manuel. Les fichiers IGN/INSEE bougent peu
// fréquemment et nécessitent souvent un parsing custom. On exposera des
// tasks paramétrables où l'URL exacte est passée en payload pour ne pas
// hardcoder une URL qui peut casser.

import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { withImportRun } from "@/lib/import-runs";
import { supabaseData } from "@/lib/supabase";

// ─── IRIS géoms ──────────────────────────────────────────────

const irisPayloadSchema = z.object({
  geojsonUrl: z
    .string()
    .url()
    .describe("URL du GeoJSON IGN IRIS France entière (refresh annuel)"),
  millesime: z.number().int().min(2014).max(2099),
});

const irisFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    code_iris: z.string(),
    nom_iris: z.string().optional(),
    code_com: z.string().optional(),
    code_commune: z.string().optional(),
    nom_com: z.string().optional(),
    nom_commune: z.string().optional(),
    code_dept: z.string().optional(),
    code_departement: z.string().optional(),
    typ_iris: z.string().optional(),
    type_iris: z.string().optional(),
    population: z.number().optional(),
  }),
  geometry: z.unknown(),
});

const irisGeojsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(irisFeatureSchema),
});

export const inseeIrisImport = task({
  id: "imports.insee_iris",
  maxDuration: 1800,
  retry: { maxAttempts: 2 },
  run: async (payload: unknown) => {
    const { geojsonUrl, millesime } = irisPayloadSchema.parse(payload);

    return withImportRun("insee_iris", async ({ log }) => {
      log("Téléchargement GeoJSON IRIS", { url: geojsonUrl });
      const res = await fetch(geojsonUrl);
      if (!res.ok) {
        throw new Error(`IRIS download ${res.status}`);
      }
      const raw = await res.json();
      const geojson = irisGeojsonSchema.parse(raw);
      log(`Parsed ${geojson.features.length} IRIS`);

      // Batches Supabase. La géométrie GeoJSON doit être convertie en
      // PostGIS via ST_GeomFromGeoJSON côté SQL — on stocke d'abord les
      // props puis on update geom via une RPC à coder (cf TODO).
      const rows = geojson.features.map((f) => ({
        code_iris: f.properties.code_iris,
        nom_iris: f.properties.nom_iris ?? f.properties.code_iris,
        code_commune:
          f.properties.code_commune ?? f.properties.code_com ?? "",
        nom_commune:
          f.properties.nom_commune ?? f.properties.nom_com ?? "",
        code_departement:
          f.properties.code_departement ?? f.properties.code_dept ?? "",
        type_iris: f.properties.type_iris ?? f.properties.typ_iris ?? null,
        population: f.properties.population ?? null,
        // geom : à backfill via un script SQL dédié qui parse GeoJSON.
        // Trigger.dev SDK ne supporte pas l'envoi de geometry en upsert.
      }));

      let inserted = 0;
      const BATCH = 1000;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const { error } = await supabaseData
          .from("insee_iris")
          .upsert(slice, { onConflict: "code_iris" });
        if (error) {
          log("IRIS upsert error", { error: error.message, batch: i });
          throw error;
        }
        inserted += slice.length;
      }

      logger.info("IRIS import done", { inserted, millesime });
      return {
        rowsImported: inserted,
        metadata: {
          millesime,
          totalFeatures: geojson.features.length,
          note: "geom à backfill via script SQL ST_GeomFromGeoJSON",
        },
      };
    });
  },
});

// ─── Filosofi (revenus, taux pauvreté par IRIS) ──────────────

const filosofiPayloadSchema = z.object({
  csvUrl: z.string().url(),
  millesime: z.number().int().min(2014).max(2099),
});

export const inseeFilosofiImport = task({
  id: "imports.insee_filosofi",
  maxDuration: 1800,
  run: async (payload: unknown) => {
    const { csvUrl, millesime } = filosofiPayloadSchema.parse(payload);

    return withImportRun("insee_filosofi", async ({ log }) => {
      log("Filosofi import", { csvUrl, millesime });
      // Le format Filosofi varie chaque année (libellés colonnes, codes).
      // On garde la task minimaliste : signal que la commande existe, mais
      // le mapping concret est à itérer au prochain refresh annuel.
      // À implémenter quand on aura le millésime concret en main.
      throw new Error(
        "Filosofi: parser à implémenter en fonction du millésime cible " +
          "(le format CSV change d'une année à l'autre). Voir docs/04-sources-data.md.",
      );
    });
  },
});
