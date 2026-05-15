import { z } from "zod";
import { userParamsInputSchema } from "./user.js";

// ──────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────

export const listingSourceSchema = z.enum([
  "seloger",
  "leboncoin",
  "bienici",
  "pap",
  "logic_immo",
]);
export type ListingSource = z.infer<typeof listingSourceSchema>;

export const analysisStatusSchema = z.enum([
  "pending",
  "scraping",
  "enriching",
  "scoring",
  "generating",
  "done",
  "failed",
]);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

// ──────────────────────────────────────────────────────────────────
// Détection auto du site depuis l'URL
// ──────────────────────────────────────────────────────────────────

export function detectSourceFromUrl(url: string): ListingSource | null {
  const lower = url.toLowerCase();
  if (lower.includes("seloger.com")) return "seloger";
  if (lower.includes("leboncoin.fr")) return "leboncoin";
  if (lower.includes("bienici.com")) return "bienici";
  if (lower.includes("pap.fr")) return "pap";
  if (lower.includes("logic-immo.com")) return "logic_immo";
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Input : création d'une analyse
// ──────────────────────────────────────────────────────────────────

export const analysisCreateInputSchema = z.object({
  source_url: z
    .string()
    .url()
    .refine((url) => detectSourceFromUrl(url) !== null, "Site non supporté"),
});
export type AnalysisCreateInput = z.infer<typeof analysisCreateInputSchema>;

// ──────────────────────────────────────────────────────────────────
// Analysis (lecture)
// ──────────────────────────────────────────────────────────────────

export const analysisSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  source_url: z.string().url(),
  source_site: listingSourceSchema,
  ville: z.string().nullable(),
  code_postal: z.string().nullable(),
  status: analysisStatusSchema,
  params_snapshot: userParamsInputSchema,
  progress_pct: z.number().int().min(0).max(100),
  error_message: z.string().nullable(),
  apify_run_id: z.string().nullable(),
  trigger_run_id: z.string().nullable(),
  total_listings_raw: z.number().int().nonnegative(),
  total_listings_filtered: z.number().int().nonnegative(),
  median_price_per_sqm: z.number().nullable(),
  median_score: z.number().int().nullable(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
});
export type Analysis = z.infer<typeof analysisSchema>;

// ──────────────────────────────────────────────────────────────────
// Progrès en temps réel (Supabase Realtime)
// ──────────────────────────────────────────────────────────────────

export const analysisProgressSchema = z.object({
  analysis_id: z.string().uuid(),
  status: analysisStatusSchema,
  progress_pct: z.number().int().min(0).max(100),
  stage_label: z.string(),
  current_count: z.number().int().nonnegative().optional(),
  total_count: z.number().int().nonnegative().optional(),
});
export type AnalysisProgress = z.infer<typeof analysisProgressSchema>;
