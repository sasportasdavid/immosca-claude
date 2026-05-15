import { z } from "zod";

// ────────────────────────────────────────────────────────────────────
// Géocodage BAN
// ────────────────────────────────────────────────────────────────────

export const banResultSchema = z.object({
  label: z.string(),
  score: z.number(),
  housenumber: z.string().optional(),
  street: z.string().optional(),
  postcode: z.string(),
  city: z.string(),
  citycode: z.string(),
  type: z.enum(["housenumber", "street", "locality", "municipality"]),
  lat: z.number(),
  lng: z.number(),
});
export type BanResult = z.infer<typeof banResultSchema>;

// ────────────────────────────────────────────────────────────────────
// Parcelle cadastrale (API Carto IGN)
// ────────────────────────────────────────────────────────────────────

export const parcelleSchema = z.object({
  numero: z.string(), // ex "0042"
  section: z.string(), // ex "AB"
  commune: z.string(), // code INSEE
  prefixe: z.string().optional(),
  surface_m2: z.number(),
  // GeoJSON polygon de la parcelle
  geometry: z.object({
    type: z.literal("Polygon").or(z.literal("MultiPolygon")),
    coordinates: z.unknown(), // structure variable
  }),
});
export type Parcelle = z.infer<typeof parcelleSchema>;

// ────────────────────────────────────────────────────────────────────
// Zone PLU (GPU)
// ────────────────────────────────────────────────────────────────────

export const gpuZoneSchema = z.object({
  zone_libelle: z.string(), // ex "UB1"
  zone_type: z.string().optional(), // "U", "AU", "A", "N"
  document_id: z.string(),
  document_url: z.string().url().optional(),
  reglement_pdf_url: z.string().url().optional(),
  date_approbation: z.string().optional(),
  commune_insee: z.string(),
});
export type GpuZone = z.infer<typeof gpuZoneSchema>;

// ────────────────────────────────────────────────────────────────────
// Résultat de la mesure de couverture pour UNE adresse
// ────────────────────────────────────────────────────────────────────

export const coverageResultSchema = z.object({
  // Input
  raw_address: z.string(),
  expected_city: z.string(),

  // Étapes
  step_ban: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: banResultSchema, latency_ms: z.number() }),
    z.object({ ok: z.literal(false), error: z.string(), latency_ms: z.number() }),
  ]),

  step_cadastre: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: parcelleSchema, latency_ms: z.number() }),
    z.object({ ok: z.literal(false), error: z.string(), latency_ms: z.number() }),
  ]).optional(),

  step_gpu_zone: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: gpuZoneSchema, latency_ms: z.number() }),
    z.object({ ok: z.literal(false), error: z.string(), latency_ms: z.number() }),
  ]).optional(),

  step_reglement_download: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), pdf_size_bytes: z.number(), latency_ms: z.number() }),
    z.object({ ok: z.literal(false), error: z.string(), latency_ms: z.number() }),
  ]).optional(),

  // Verdict
  full_pipeline_ok: z.boolean(),
});
export type CoverageResult = z.infer<typeof coverageResultSchema>;

// ────────────────────────────────────────────────────────────────────
// Extraction Claude du règlement
// Les 8 indicateurs cibles
// ────────────────────────────────────────────────────────────────────

export const destinationAutoriseeSchema = z.enum([
  "habitation",
  "commerce_activite_service",
  "equipement_interet_collectif",
  "exploitation_agricole",
  "exploitation_forestiere",
  "autres_activites_secteurs_tertiaires",
  "industrie",
  "entrepot",
  "bureau",
]);

export const reglementExtractionSchema = z.object({
  // Métadonnées
  zone_libelle: z.string().describe("Libellé exact de la zone, ex 'UA1', 'UC', 'AUh'"),
  zone_type: z
    .enum(["U", "AU", "A", "N"])
    .describe(
      "Catégorie générale de la zone PLU : U (urbaine), AU (à urbaniser), A (agricole), N (naturelle)",
    ),

  // Chiffres clés (les plus sensibles à l'erreur)
  hauteur_max_m: z
    .number()
    .nullable()
    .describe(
      "Hauteur maximale autorisée en mètres. Préciser la référence dans hauteur_max_reference (égout, faîtage, hors tout).",
    ),
  hauteur_max_reference: z
    .enum(["egout", "faitage", "hors_tout", "acrotere", "non_precise"])
    .describe("Méthode de mesure de la hauteur max."),

  ces: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .describe("Coefficient d'Emprise au Sol (0-1). null si non règlementé."),

  emprise_au_sol_max_pct: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Emprise au sol maximale en pourcentage de la surface de parcelle (0-100). null si non règlementé.",
    ),

  coefficient_pleine_terre_pct: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Coefficient de pleine terre minimum (% de la parcelle qui doit rester en pleine terre). null si non règlementé.",
    ),

  prospect_voisin_m: z
    .number()
    .nullable()
    .describe("Distance minimale aux limites séparatives, en mètres. null si non règlementé."),

  destinations_autorisees: z
    .array(destinationAutoriseeSchema)
    .describe("Liste des destinations autorisées ou autorisées sous conditions dans cette zone."),

  servitudes_notables: z
    .array(z.string())
    .describe(
      "Servitudes notables : EBC, alignement, monuments historiques, PPRI, périmètre protection captage, etc. Vide si aucune.",
    ),

  // Évaluation qualitative
  potentiel: z
    .object({
      extension: z
        .enum(["evident", "possible", "exclu"])
        .describe("Potentiel d'extension au sol du bâti existant."),
      surelevation: z
        .enum(["evident", "possible", "exclu"])
        .describe("Potentiel de surélévation (ajout d'étages)."),
      division: z
        .enum(["evident", "possible", "exclu"])
        .describe("Potentiel de division parcellaire pour construire un second logement."),
      demolition_reconstruction: z
        .enum(["evident", "possible", "exclu"])
        .describe("Potentiel de démolition-reconstruction (refonte complète)."),
    })
    .describe("Évaluation qualitative des leviers de valorisation."),

  notes: z
    .string()
    .max(2000)
    .describe(
      "Notes libres : exceptions, ambiguïtés du règlement, points à vérifier en CU opérationnel.",
    ),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Niveau de confiance de l'extraction (0-1). Mettre bas si règlement ambigu, sous-zonage complexe, ou indicateurs manquants.",
    ),
});
export type ReglementExtraction = z.infer<typeof reglementExtractionSchema>;
