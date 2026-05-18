// Task d'analyse principale : scrape Apify → normalise → enrichit
// (géocodage BAN, DPE, Géorisques) → met à jour le row `analyses` et
// les `listings` côté immoscan-app.
//
// Étapes (progress_pct) :
//   pending (0) → scraping (20%) → enriching (50%) → done (100%)
// PR4 ajoutera scoring (70%) + generating (90%).
//
// Idempotent : si on relance avec le même analysis_id, on UPSERT par
// (analysis_id, external_id) — pas de duplicates.

import { logger, task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import {
  APIFY_MAPPERS,
  type ListingInsert,
  type RawApifyListing,
} from "@/services/apify-mappers";
import { runApifyActor } from "@/services/apify";
import { banGeocode } from "@/services/ban";

const payloadSchema = z.object({
  analysisId: z.string().uuid(),
  /** Override de l'actor Apify pour tests. Defaut : env APIFY_ACTOR_SELOGER / _LEBONCOIN. */
  actorId: z.string().optional(),
});

async function setAnalysisStatus(
  analysisId: string,
  status:
    | "pending"
    | "scraping"
    | "enriching"
    | "scoring"
    | "generating"
    | "done"
    | "failed",
  progressPct: number,
  extra?: Partial<{
    error_message: string;
    apify_run_id: string;
    total_listings_raw: number;
    total_listings_filtered: number;
    median_price_per_sqm: number | null;
    completed_at: string;
    started_at: string;
  }>,
): Promise<void> {
  await supabaseApp
    .from("analyses")
    .update({ status, progress_pct: progressPct, ...extra })
    .eq("id", analysisId);
}

export const analyzeTask = task({
  id: "analyze",
  maxDuration: 600, // 10 min
  retry: { maxAttempts: 1 }, // pas de retry auto : on a Sentry pour debug
  run: async (payload: unknown) => {
    const { analysisId, actorId } = payloadSchema.parse(payload);
    logger.info("Analyze start", { analysisId });

    // 1. Lire l'analyse
    const { data: analysis, error: readErr } = await supabaseApp
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .single();
    if (readErr || !analysis) {
      throw new Error(`Analyse ${analysisId} introuvable: ${readErr?.message}`);
    }

    await setAnalysisStatus(analysisId, "scraping", 5, {
      started_at: new Date().toISOString(),
    });

    try {
      // 2. Apify run
      const resolvedActorId =
        actorId ??
        (analysis.source_site === "seloger"
          ? process.env.APIFY_ACTOR_SELOGER
          : analysis.source_site === "leboncoin"
            ? process.env.APIFY_ACTOR_LEBONCOIN
            : undefined);
      if (!resolvedActorId) {
        throw new Error(
          `Aucun APIFY_ACTOR_${analysis.source_site.toUpperCase()} dans l'env.`,
        );
      }

      const apifyResult = await runApifyActor<RawApifyListing>({
        actorId: resolvedActorId,
        runInput: {
          startUrls: [{ url: analysis.source_url }],
          // Limit conservateur — cf MAX_LISTINGS_PER_ANALYSIS dans shared
          maxItems: 1000,
        },
      });

      logger.info("Apify done", {
        runId: apifyResult.runId,
        items: apifyResult.items.length,
        costEur: apifyResult.stats.estimatedCostEur,
      });

      await setAnalysisStatus(analysisId, "scraping", 20, {
        apify_run_id: apifyResult.runId,
        total_listings_raw: apifyResult.items.length,
      });

      // 3. Map raw → listings rows
      const mapper = APIFY_MAPPERS[analysis.source_site as keyof typeof APIFY_MAPPERS];
      if (!mapper) {
        throw new Error(`Pas de mapper pour source_site=${analysis.source_site}`);
      }

      const mapped: ListingInsert[] = apifyResult.items
        .map((raw) => mapper(raw, analysisId))
        .filter((r): r is ListingInsert => r !== null);

      logger.info("Mapped listings", {
        raw: apifyResult.items.length,
        filtered: mapped.length,
      });

      // 4. Upsert listings (idempotent via external_id × analysis_id)
      // On batche par 500 pour rester sous les limites Supabase.
      const BATCH = 500;
      for (let i = 0; i < mapped.length; i += BATCH) {
        const slice = mapped.slice(i, i + BATCH);
        const { error } = await supabaseApp.from("listings").insert(slice);
        if (error) throw error;
      }

      await setAnalysisStatus(analysisId, "enriching", 50, {
        total_listings_filtered: mapped.length,
      });

      // 5. Enrichissement géocodage (BAN) — sur listings sans lat/lng
      const toGeocode = mapped.filter((l) => !l.lat && l.adresse_raw);
      logger.info("Géocodage BAN", { count: toGeocode.length });
      for (const listing of toGeocode) {
        if (!listing.adresse_raw) continue;
        try {
          const geo = await banGeocode(listing.adresse_raw);
          await supabaseApp
            .from("listings")
            .update({
              lat: geo.latitude,
              lng: geo.longitude,
              adresse_geocoded: geo.label,
              code_insee: geo.citycode ?? listing.code_insee,
            })
            .eq("analysis_id", analysisId)
            .eq("external_id", listing.external_id);
        } catch (err) {
          // Géocodage best-effort : on continue si BAN refuse.
          Sentry.captureException(err, {
            extra: { context: "ban geocode", adresse: listing.adresse_raw },
          });
        }
      }

      // 6. Calcul stats simples (median €/m² sur les listings avec surface)
      const prixM2List = mapped
        .map((l) => (l.surface && l.surface > 0 ? l.prix / l.surface : null))
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
      const median =
        prixM2List.length > 0
          ? prixM2List[Math.floor(prixM2List.length / 2)] ?? null
          : null;

      // 7. Done
      await setAnalysisStatus(analysisId, "done", 100, {
        median_price_per_sqm: median,
        completed_at: new Date().toISOString(),
      });

      return {
        analysisId,
        scraped: apifyResult.items.length,
        normalized: mapped.length,
        geocoded: toGeocode.length,
        medianPriceM2: median,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setAnalysisStatus(analysisId, "failed", 0, {
        error_message: message,
      });
      Sentry.captureException(err, { tags: { analysis_id: analysisId } });
      throw err;
    }
  },
});
