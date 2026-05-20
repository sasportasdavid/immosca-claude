import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
// Entitlements — crédits PPU one-shot + add-ons recurring
// Doit être maintenu en sync avec :
//   - enum SQL `entitlement_type` (migration 20260520100100)
//   - enum SQL `entitlement_status` (migration 20260520100100)
//   - ENTITLEMENT_TYPES / ENTITLEMENT_STATUSES dans constants.ts
// ──────────────────────────────────────────────────────────────────

export const entitlementTypeSchema = z.enum([
  "ppu_analysis",
  "ppu_watch_bonus",
  "addon_watch_unit",
  "addon_watch_pack3",
  "addon_watch_daily",
  "addon_watch_pack3_daily",
  "addon_seat",
]);
export type EntitlementType = z.infer<typeof entitlementTypeSchema>;

export const entitlementStatusSchema = z.enum([
  "pending",
  "active",
  "consumed",
  "expired",
  "refunded",
]);
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

export const entitlementSourceSchema = z.enum([
  "stripe_checkout",
  "stripe_subscription",
  "promo_code",
  "manual_grant",
]);
export type EntitlementSource = z.infer<typeof entitlementSourceSchema>;

export const entitlementSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  type: entitlementTypeSchema,
  status: entitlementStatusSchema,
  source: entitlementSourceSchema,
  source_payment_id: z.string().nullable(),
  source_subscription_item_id: z.string().nullable(),
  consumed_resource_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  granted_at: z.string().datetime(),
  consumed_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;

// ──────────────────────────────────────────────────────────────────
// usage_counters
// ──────────────────────────────────────────────────────────────────

export const usageCounterSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  analyses_used: z.number().int().nonnegative(),
  analyses_concurrent: z.number().int().nonnegative(),
  watch_runs_used: z.number().int().nonnegative(),
  paste_urls_used_today: z.number().int().nonnegative(),
  paste_urls_reset_at: z.string().date().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type UsageCounter = z.infer<typeof usageCounterSchema>;

// ──────────────────────────────────────────────────────────────────
// Réponse normalisée de la RPC is_quota_exceeded()
// ──────────────────────────────────────────────────────────────────

export const quotaCheckResultSchema = z.discriminatedUnion("allowed", [
  z.object({
    allowed: z.literal(true),
    source: z.enum(["plan", "ppu"]).optional(),
    ppu_remaining: z.number().int().optional(),
    effective_limit: z.number().int().optional(),
    included: z.number().int().optional(),
    addon_slots: z.number().int().optional(),
  }),
  z.object({
    allowed: z.literal(false),
    reason: z.enum([
      "profile_not_found",
      "analysis_quota_exceeded",
      "concurrent_analyses_exceeded",
      "watch_quota_exceeded",
      "paste_urls_exceeded",
      "unknown_action",
    ]),
    used: z.number().int().optional(),
    limit: z.number().int().optional(),
    ppu_balance: z.number().int().optional(),
    included: z.number().int().optional(),
    addon_slots: z.number().int().optional(),
    total_cap: z.number().int().optional(),
    can_buy_addon: z.boolean().optional(),
    requested: z.number().int().optional(),
    upgrade_to: z.enum(["ppu", "pro", "pro_plus", "business"]).nullable().optional(),
  }),
]);
export type QuotaCheckResult = z.infer<typeof quotaCheckResultSchema>;

/** Helper de narrowing pour les call-sites. */
export function isQuotaAllowed(
  result: QuotaCheckResult,
): result is Extract<QuotaCheckResult, { allowed: true }> {
  return result.allowed === true;
}
