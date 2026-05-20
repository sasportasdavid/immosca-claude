// Service quota worker — appelle les RPCs SQL `is_quota_exceeded`,
// `increment_analysis_counter`, `decrement_concurrent_analysis`.
//
// Toutes les RPCs sont SECURITY DEFINER et exposées avec
// `grant execute … to service_role`, donc utilisables depuis le worker.
//
// Le worker call ces RPCs au début et à la fin d'une analyse pour :
//   - vérifier que le user n'a pas dépassé son quota (analyses/mois ou
//     concurrent_analyses)
//   - décrémenter automatiquement le slot concurrent à la fin
//   - basculer sur PPU si le quota mensuel est atteint mais qu'un PPU
//     est en `pending`

import { logger } from "@trigger.dev/sdk";

import { supabaseApp } from "@/lib/supabase";

export interface QuotaCheckOk {
  allowed: true;
  source?: "plan" | "ppu";
  ppu_remaining?: number;
}
export interface QuotaCheckBlocked {
  allowed: false;
  reason:
    | "profile_not_found"
    | "analysis_quota_exceeded"
    | "concurrent_analyses_exceeded"
    | "watch_quota_exceeded"
    | "paste_urls_exceeded"
    | "unknown_action";
  used?: number;
  limit?: number;
  ppu_balance?: number;
  upgrade_to?: "ppu" | "pro" | "pro_plus" | "business" | null;
}
export type QuotaCheckResult = QuotaCheckOk | QuotaCheckBlocked;

export type QuotaAction =
  | "analysis"
  | "concurrent_analysis"
  | "watch_create"
  | "paste_urls";

export async function checkQuota(
  profileId: string,
  action: QuotaAction,
  requestedCount: number = 1,
): Promise<QuotaCheckResult> {
  const { data, error } = await supabaseApp.rpc("is_quota_exceeded", {
    p_profile_id: profileId,
    p_action: action,
    p_requested_count: requestedCount,
  });
  if (error) {
    throw new Error(`is_quota_exceeded RPC failed: ${error.message}`);
  }
  return data as unknown as QuotaCheckResult;
}

export interface IncrementResult {
  billed_via: "plan" | "ppu";
  analyses_used?: number;
  analyses_limit?: number;
  entitlement_id?: string;
}

/**
 * Incrémente le compteur d'analyses du cycle + le slot concurrent.
 * Si plan saturé, consomme automatiquement un entitlement PPU pending.
 * Throw 'quota_exceeded_no_ppu' (P0001) si plus rien de disponible.
 */
export async function incrementAnalysisCounter(
  profileId: string,
  analysisId: string,
): Promise<IncrementResult> {
  const { data, error } = await supabaseApp.rpc("increment_analysis_counter", {
    p_profile_id: profileId,
    p_analysis_id: analysisId,
  });
  if (error) {
    // Postgres codes : P0001 = quota_exceeded_no_ppu, P0002 = profile_not_found
    throw new Error(`increment_analysis_counter: ${error.message} (code=${error.code})`);
  }
  return data as unknown as IncrementResult;
}

/**
 * Décrémente le slot concurrent. Idempotent (max(0, count-1)).
 * À appeler dans tous les exit paths : done, failed, canceled.
 */
export async function decrementConcurrentAnalysis(
  profileId: string,
): Promise<void> {
  const { error } = await supabaseApp.rpc("decrement_concurrent_analysis", {
    p_profile_id: profileId,
  });
  if (error) {
    // On log mais on ne throw pas : si le décrément échoue, c'est gênant
    // pour le user (slot occupé) mais ne doit pas masquer l'erreur d'origine.
    logger.warn("decrement_concurrent_analysis failed", {
      profileId,
      error: error.message,
    });
  }
}

/** Encode une erreur quota dans le `error_message` pour parsing UI. */
export function encodeQuotaError(blocked: QuotaCheckBlocked): string {
  const parts = [
    "QUOTA_EXCEEDED",
    blocked.reason,
    blocked.upgrade_to ?? "none",
    `used=${blocked.used ?? "-"}`,
    `limit=${blocked.limit ?? "-"}`,
  ];
  return parts.join("|");
}

/** Décode un error_message côté frontend pour afficher le bon upsell. */
export function decodeQuotaError(message: string | null): QuotaCheckBlocked | null {
  if (!message || !message.startsWith("QUOTA_EXCEEDED|")) return null;
  const [, reason, upgradeTo, usedStr, limitStr] = message.split("|");
  if (!reason) return null;
  return {
    allowed: false,
    reason: reason as QuotaCheckBlocked["reason"],
    upgrade_to: upgradeTo === "none" ? null : (upgradeTo as QuotaCheckBlocked["upgrade_to"]),
    used: parseInt(usedStr?.split("=")[1] ?? "", 10) || undefined,
    limit: parseInt(limitStr?.split("=")[1] ?? "", 10) || undefined,
  };
}
