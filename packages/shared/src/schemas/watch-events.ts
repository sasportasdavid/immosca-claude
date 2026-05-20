// Schémas Zod du module veille (PR-D).
// Source de vérité : module-veille-immoscan.md §2 (events) + §9 (DB).
// Alignés sur les enums SQL définis dans migration `watches_module`.

import { z } from "zod";

import { listingSourceSchema } from "./analysis.js";

// ──────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────

export const watchEventTypeSchema = z.enum([
  "new_match",
  "price_drop",
  "signal_to_verify",
  "relisted",
  "removed",
  "price_rise",
]);
export type WatchEventType = z.infer<typeof watchEventTypeSchema>;

export const watchRunStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
export type WatchRunStatus = z.infer<typeof watchRunStatusSchema>;

export const watchListingStatusSchema = z.enum([
  "new",
  "tracked",
  "removed",
  "gone",
]);
export type WatchListingStatus = z.infer<typeof watchListingStatusSchema>;

export const watchSensitivitySchema = z.enum([
  "strict",
  "moderate",
  "permissive",
]);
export type WatchSensitivity = z.infer<typeof watchSensitivitySchema>;

export const dpeBinSchema = z.enum(["A_C", "D_E", "F_G", "unknown"]);
export type DpeBinType = z.infer<typeof dpeBinSchema>;

// ──────────────────────────────────────────────────────────────────
// Helpers : DPE letter → bin
// ──────────────────────────────────────────────────────────────────

export function dpeLetterToBin(dpe: string | null | undefined): DpeBinType {
  if (!dpe) return "unknown";
  const letter = dpe.trim().toUpperCase();
  if (letter === "A" || letter === "B" || letter === "C") return "A_C";
  if (letter === "D" || letter === "E") return "D_E";
  if (letter === "F" || letter === "G") return "F_G";
  return "unknown";
}

// ──────────────────────────────────────────────────────────────────
// watch_runs row
// ──────────────────────────────────────────────────────────────────

export const watchRunSchema = z.object({
  id: z.string().uuid(),
  watch_id: z.string().uuid(),
  status: watchRunStatusSchema,
  started_at: z.string().datetime().nullable(),
  finished_at: z.string().datetime().nullable(),
  duration_ms: z.number().int().nullable(),
  items_scraped: z.number().int().nonnegative(),
  new_count: z.number().int().nonnegative(),
  drop_count: z.number().int().nonnegative(),
  signal_count: z.number().int().nonnegative(),
  relisted_count: z.number().int().nonnegative(),
  removed_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  apify_run_ids: z.array(z.string()),
  estimated_cost_eur: z.number().nonnegative(),
  market_stats: z.record(z.string(), z.unknown()),
  error_message: z.string().nullable(),
  trigger_run_id: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type WatchRun = z.infer<typeof watchRunSchema>;

// ──────────────────────────────────────────────────────────────────
// watch_listings row
// ──────────────────────────────────────────────────────────────────

export const priceHistoryEntrySchema = z.object({
  date: z.string().datetime(),
  price: z.number().nonnegative(),
  change_pct: z.number().nullable().optional(),
});
export type PriceHistoryEntry = z.infer<typeof priceHistoryEntrySchema>;

export const watchListingSchema = z.object({
  id: z.string().uuid(),
  watch_id: z.string().uuid(),
  listing_id: z.string().uuid().nullable(),
  external_id: z.string(),
  source_site: listingSourceSchema,
  source_url: z.string().url(),
  title: z.string().nullable(),
  current_price: z.number().nonnegative(),
  current_surface: z.number().positive().nullable(),
  current_dpe: z.string().nullable(),
  current_score: z.number().min(0).max(100).nullable(),
  current_status: watchListingStatusSchema,
  price_history: z.array(priceHistoryEntrySchema),
  is_in_pipeline: z.boolean(),
  first_seen_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  removed_since: z.string().datetime().nullable(),
  notified_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type WatchListing = z.infer<typeof watchListingSchema>;

// ──────────────────────────────────────────────────────────────────
// watch_events row + payload per type
// ──────────────────────────────────────────────────────────────────

export const newMatchPayloadSchema = z.object({
  score: z.number().min(0).max(100),
  prix: z.number().nonnegative(),
  prix_m2: z.number().nonnegative().nullable().optional(),
  dpe: z.string().nullable().optional(),
  surface: z.number().positive().nullable().optional(),
});
export type NewMatchPayload = z.infer<typeof newMatchPayloadSchema>;

export const priceDropPayloadSchema = z.object({
  old_price: z.number().nonnegative(),
  new_price: z.number().nonnegative(),
  delta_pct: z.number(), // négatif pour drop
  delta_eur: z.number(),
});
export type PriceDropPayload = z.infer<typeof priceDropPayloadSchema>;

export const signalToVerifyPayloadSchema = z.object({
  ecart_pct: z.number(), // négatif quand sous-évalué vs médian
  n_transactions: z.number().int().nonnegative(),
  median_eur_m2: z.number().nonnegative(),
  dpe_bin: dpeBinSchema,
  commune_insee: z.string().nullable().optional(),
});
export type SignalToVerifyPayload = z.infer<typeof signalToVerifyPayloadSchema>;

export const relistedPayloadSchema = z.object({
  prev_removed_at: z.string().datetime(),
  new_price: z.number().nonnegative(),
  prev_price: z.number().nonnegative().nullable().optional(),
});
export type RelistedPayload = z.infer<typeof relistedPayloadSchema>;

export const removedPayloadSchema = z.object({
  last_known_price: z.number().nonnegative(),
  last_seen_at: z.string().datetime(),
  consecutive_missing_runs: z.number().int().nonnegative(),
});
export type RemovedPayload = z.infer<typeof removedPayloadSchema>;

export const watchEventSchema = z.object({
  id: z.string().uuid(),
  watch_id: z.string().uuid(),
  watch_listing_id: z.string().uuid().nullable(),
  watch_run_id: z.string().uuid().nullable(),
  event_type: watchEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  included_in_digest: z.boolean(),
  digest_sent_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type WatchEvent = z.infer<typeof watchEventSchema>;
