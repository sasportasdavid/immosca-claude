import { z } from "zod";
import { listingSourceSchema } from "./analysis.js";

// ──────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────

export const bienTypeSchema = z.enum(["appartement", "maison", "terrain", "immeuble", "autre"]);
export type BienType = z.infer<typeof bienTypeSchema>;

export const dpeClassSchema = z.enum(["A", "B", "C", "D", "E", "F", "G"]);
export type DpeClass = z.infer<typeof dpeClassSchema>;

// ──────────────────────────────────────────────────────────────────
// Raw output from Apify (avant normalisation)
// Tolérant : Apify peut renvoyer du flou, on parse en best-effort
// ──────────────────────────────────────────────────────────────────

export const apifyRawListingSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    url: z.string().url(),
    title: z.string().optional(),
    description: z.string().optional(),
    price: z.union([z.number(), z.string()]).optional(),
    surface: z.union([z.number(), z.string()]).optional(),
    rooms: z.union([z.number(), z.string()]).optional(),
    bedrooms: z.union([z.number(), z.string()]).optional(),
    propertyType: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
    address: z.string().optional(),
    floor: z.union([z.number(), z.string()]).optional(),
    balcony: z.boolean().optional(),
    terrace: z.boolean().optional(),
    parking: z.boolean().optional(),
    cellar: z.boolean().optional(),
    elevator: z.boolean().optional(),
    energyClass: z.string().optional(),
    gesClass: z.string().optional(),
    constructionYear: z.union([z.number(), z.string()]).optional(),
    photos: z.array(z.string()).optional(),
    publishedAt: z.string().optional(),
    isExclusive: z.boolean().optional(),
    isNew: z.boolean().optional(),
    chargesYear: z.union([z.number(), z.string()]).optional(),
    taxeFonciere: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough(); // on garde les champs additionnels au cas où
export type ApifyRawListing = z.infer<typeof apifyRawListingSchema>;

// ──────────────────────────────────────────────────────────────────
// Listing normalisé (ce qui entre dans la table listings)
// ──────────────────────────────────────────────────────────────────

export const listingInputSchema = z.object({
  analysis_id: z.string().uuid(),
  external_id: z.string().min(1),
  source_site: listingSourceSchema,
  source_url: z.string().url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  type: bienTypeSchema,
  prix: z.number().positive().max(50_000_000),
  surface: z.number().positive().max(10_000).nullable(),
  pieces: z.number().int().min(0).max(50).nullable(),
  chambres: z.number().int().min(0).max(30).nullable(),
  ville: z.string().nullable(),
  code_postal: z.string().regex(/^\d{5}$/).nullable(),
  adresse_raw: z.string().nullable(),
  adresse_geocoded: z.string().nullable(),
  code_insee: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  dpe: dpeClassSchema.nullable(),
  ges: dpeClassSchema.nullable(),
  etage: z.number().int().min(-5).max(100).nullable(),
  balcon: z.boolean().default(false),
  terrasse: z.boolean().default(false),
  parking: z.boolean().default(false),
  cave: z.boolean().default(false),
  ascenseur: z.boolean().default(false),
  charges_copro_annuelles: z.number().nonnegative().nullable(),
  taxe_fonciere: z.number().nonnegative().nullable(),
  annee_construction: z.number().int().min(1700).max(2100).nullable(),
  photos_urls: z.array(z.string().url()).default([]),
  is_exclusive: z.boolean().default(false),
  is_new_construction: z.boolean().default(false),
  published_at: z.string().datetime().nullable(),
});
export type ListingInput = z.infer<typeof listingInputSchema>;

// ──────────────────────────────────────────────────────────────────
// Listing comme retourné par la vue freemium (champs nullable)
// ──────────────────────────────────────────────────────────────────

export const listingFreemiumViewSchema = z.object({
  id: z.string().uuid(),
  analysis_id: z.string().uuid(),
  external_id: z.string(),
  source_site: listingSourceSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  type: bienTypeSchema,
  surface: z.number().nullable(),
  pieces: z.number().int().nullable(),
  chambres: z.number().int().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  dpe: dpeClassSchema.nullable(),
  ges: dpeClassSchema.nullable(),
  etage: z.number().int().nullable(),
  balcon: z.boolean().nullable(),
  terrasse: z.boolean().nullable(),
  parking: z.boolean().nullable(),
  cave: z.boolean().nullable(),
  ascenseur: z.boolean().nullable(),
  charges_copro_annuelles: z.number().nullable(),
  taxe_fonciere: z.number().nullable(),
  annee_construction: z.number().int().nullable(),
  is_exclusive: z.boolean().nullable(),
  is_new_construction: z.boolean().nullable(),
  published_at: z.string().datetime().nullable(),
  scraped_at: z.string().datetime(),
  // Score (toujours visible)
  score_total: z.number().int().nullable(),
  score_prix: z.number().int().nullable(),
  score_rendement: z.number().int().nullable(),
  score_cashflow: z.number().int().nullable(),
  score_dpe: z.number().int().nullable(),
  score_quartier: z.number().int().nullable(),
  score_risques: z.number().int().nullable(),
  is_passoire_dpe: z.boolean().nullable(),
  verdict: z.enum(["a_visiter", "sous_reserve", "no_go"]).nullable(),
  // Champs floutés si free + score > 70
  prix: z.number().nullable(),
  adresse_raw: z.string().nullable(),
  adresse_geocoded: z.string().nullable(),
  source_url: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  photos_urls: z.array(z.string()).nullable(),
  prix_marche_estime: z.number().nullable(),
  ecart_prix_pct: z.number().nullable(),
  loyer_estime: z.number().nullable(),
  rendement_brut_pct: z.number().nullable(),
  rendement_net_pct: z.number().nullable(),
  cashflow_mensuel: z.number().nullable(),
  these_claude: z.string().nullable(),
  financement_claude: z.string().nullable(),
  negociation_claude: z.string().nullable(),
  prix_negociation_cible: z.number().nullable(),
  is_masked: z.boolean(),
});
export type ListingFreemiumView = z.infer<typeof listingFreemiumViewSchema>;
