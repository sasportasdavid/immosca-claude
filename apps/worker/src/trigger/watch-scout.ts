// Task `watch-scout` : exécute un scout pour UNE watch donnée.
//
// Flow :
//   1. Crée une row watch_runs (status=running)
//   2. Scrape multi-source via les actors ACTOR_BY_SITE (maxItems = cap_plan + 1)
//   3. Normalize via MULTI_URL_MAPPERS → ListingInsert
//   4. Pour chaque item :
//        - upsert dans listings (analysis_id = analysis "shell" de la veille)
//        - cherche match existant dans watch_listings (par external_id)
//        - si absent ET score >= threshold → event new_match
//        - si présent ET prix changé : update price_history + event price_drop|price_rise
//        - si présent ET prix m² < -X% vs DVF (market_stats_cache) → event signal_to_verify
//        - update last_seen_at + current_*
//   5. Pour chaque watch_listing en DB pas dans le scout :
//        - 1er run absent → current_status='removed', removed_since=now
//        - 2e run consécutif absent → current_status='gone' + event removed
//   6. Marque watch_runs comme succeeded, update watches.stats_7d
//
// Idempotent : si une run avec status='running' existe pour cette watch, skip.
//
// Trigger : appelé par les schedulers (watch-scheduler-standard|business).

import {
  PLANS,
  type PlanId,
  PRICE_DROP_THRESHOLD_PCT,
  SIGNAL_TO_VERIFY_THRESHOLDS,
  SIGNAL_MIN_TRANSACTIONS,
  dpeLetterToBin,
  type DpeBinType,
  type PriceHistoryEntry,
  type WatchSensitivity,
} from "@immoscan/shared";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import {
  ACTOR_BY_SITE,
  buildPigeImmoRunInput,
  detectSiteFromUrl,
  runApifyActor,
  type PigeImmoFilters,
} from "@/services/apify";
import {
  MULTI_URL_MAPPERS,
  PIGE_IMMO_MAPPER,
  type ListingInsert,
  type MultiUrlMapperKey,
  type RawApifyListing,
} from "@/services/apify-mappers";
import {
  preloadScoringContext,
  scoreSingleListing,
  type ScoreSingleResult,
} from "@/services/scoring-batch";

const payloadSchema = z.object({
  watchId: z.string().uuid(),
});

interface MarketStat {
  median_eur_m2: number;
  n_transactions: number;
}

export const watchScoutTask = task({
  id: "watch-scout",
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async (payload: unknown) => {
    const { watchId } = payloadSchema.parse(payload);
    logger.info("Watch scout start", { watchId });

    // 1. Read watch + profile plan
    const { data: watch, error: wErr } = await supabaseApp
      .from("watches")
      .select(
        "id, profile_id, name, source_url, source_site, search_filters, score_threshold, sensitivity, is_active, suspended_at, consecutive_truncated_runs",
      )
      .eq("id", watchId)
      .single();
    if (wErr || !watch) throw new Error(`Watch ${watchId} introuvable: ${wErr?.message}`);
    if (!watch.is_active || watch.suspended_at) {
      logger.info("Watch inactive — skip", { watchId, suspended_at: watch.suspended_at });
      return { status: "skipped", reason: "inactive" };
    }

    const { data: profile, error: pErr } = await supabaseApp
      .from("profiles")
      .select("subscription_plan")
      .eq("id", watch.profile_id)
      .single();
    if (pErr || !profile) throw new Error(`Profile ${watch.profile_id} introuvable`);
    const plan: PlanId = (profile.subscription_plan ?? "free") as PlanId;
    const planDef = PLANS[plan];
    const itemsCap = planDef.itemsMaxPerWatchRun;

    // 2. Create watch_runs row (status=running)
    const runStart = new Date();
    const { data: runRow, error: runErr } = await supabaseApp
      .from("watch_runs")
      .insert({
        watch_id: watchId,
        status: "running",
        started_at: runStart.toISOString(),
      })
      .select("id")
      .single();
    if (runErr || !runRow) throw new Error(`watch_runs insert failed: ${runErr?.message}`);
    const runId = runRow.id;

    try {
      // 3. Scrape : 2 modes selon ce qui est set sur la watch.
      //   A) search_filters (mode form moderne) → actor dltik multi-source
      //      Mêmes filtres que analyses.search_filters, mêmes 4 sources
      //      (LBC + SeLoger + PAP + Bien'ici), dédup natif côté actor.
      //   B) source_url (mode legacy par site) → actor unique selon ACTOR_BY_SITE
      let apifyResult: Awaited<ReturnType<typeof runApifyActor<RawApifyListing>>>;
      let mapped: ListingInsert[];

      if (watch.search_filters) {
        // Mode A : multi-source dltik
        const multiActorId =
          process.env.APIFY_ACTOR_MULTI ?? "dltik~pige-immo-fr-scraper";
        const filters: PigeImmoFilters = {
          ...(watch.search_filters as PigeImmoFilters),
          // Cap items/source : cap_plan + 1 par source (best effort dédup).
          maxResultsPerSource: itemsCap + 1,
        };
        logger.info("Scout via search_filters (multi-source)", {
          watchId,
          actorId: multiActorId,
          filters,
        });
        apifyResult = await runApifyActor<RawApifyListing>({
          actorId: multiActorId,
          runInput: buildPigeImmoRunInput(filters),
          timeoutSecs: 900,
          memoryMbytes: 2048,
        });
        mapped = apifyResult.items
          .map((raw) => PIGE_IMMO_MAPPER(raw, runId))
          .filter(<T,>(x: T | null): x is T => x != null);
      } else if (watch.source_url) {
        // Mode B : URL legacy par site
        const site = detectSiteFromUrl(watch.source_url) ?? watch.source_site;
        const sitePlan = ACTOR_BY_SITE[site];
        if (!sitePlan) {
          throw new Error(`Pas d'actor configuré pour le site ${site}`);
        }
        const runInput = await sitePlan.buildInput(watch.source_url, itemsCap + 1);
        logger.info("Scout via source_url", {
          watchId,
          actorId: sitePlan.actorId,
          source_url: watch.source_url.slice(0, 80),
        });
        apifyResult = await runApifyActor<RawApifyListing>({
          actorId: sitePlan.actorId,
          runInput,
          timeoutSecs: 600,
          memoryMbytes: 2048,
        });
        const mapper = MULTI_URL_MAPPERS[sitePlan.mapperKey as MultiUrlMapperKey];
        if (!mapper) {
          throw new Error(`Pas de mapper pour ${sitePlan.mapperKey}`);
        }
        mapped = apifyResult.items
          .map((raw) => mapper(raw, runId))
          .filter(<T,>(x: T | null): x is T => x != null);
      } else {
        throw new Error(
          `Watch ${watchId} sans source_url ni search_filters — incohérent.`,
        );
      }

      const truncated = apifyResult.items.length >= itemsCap + 1;
      logger.info("Scout scraped", {
        watchId,
        items: apifyResult.items.length,
        truncated,
      });

      // Dédup intra-batch par external_id
      const seenExt = new Set<string>();
      const uniqueMapped = mapped.filter((l) => {
        const k = `${l.source_site}:${l.external_id}`;
        if (seenExt.has(k)) return false;
        seenExt.add(k);
        return true;
      });
      logger.info("Normalized", { watchId, mapped: uniqueMapped.length });

      // 4.5. PR-D bis : scoring inline batché
      // - Charge les user_params pour le scoring financier
      // - Précharge DVF/OLL/Géorisques en batch (groupé par INSEE)
      // - Pour chaque item avec code_insee + surface valides, calcule un score réel
      const { data: userParams } = await supabaseApp
        .from("user_params")
        .select(
          "strategy, apport, taux_credit_pct, duree_credit_ans, tmi_pct, rendement_min_pct, tolerance_travaux",
        )
        .eq("profile_id", watch.profile_id)
        .single();

      const scoringInput = userParams ?? {
        strategy: "locatif_nu" as const,
        apport: 200_000,
        taux_credit_pct: 3,
        duree_credit_ans: 25,
        tmi_pct: 30,
        rendement_min_pct: 6,
        tolerance_travaux: "leger" as const,
      };

      // Précharge le contexte de scoring (1 query par dimension au lieu de N×3)
      const scoringCtx = await preloadScoringContext(
        uniqueMapped.map((l) => ({
          code_insee: l.code_insee ?? null,
          type: l.type ?? "appartement",
          pieces: l.pieces ?? null,
        })),
      );

      // Map external_id → score result (null si surface invalide)
      const scoreByExt = new Map<string, ScoreSingleResult | null>();
      for (const l of uniqueMapped) {
        if (!l.surface || Number(l.surface) <= 0) {
          scoreByExt.set(l.external_id, null);
          continue;
        }
        const res = scoreSingleListing(
          {
            prix: Number(l.prix),
            surface: Number(l.surface),
            type:
              l.type === "maison" || l.type === "terrain" || l.type === "immeuble"
                ? l.type
                : "appartement",
            dpe: l.dpe ?? null,
            pieces: l.pieces ?? null,
            etage: l.etage ?? null,
            balcon: !!l.balcon,
            terrasse: !!l.terrasse,
            parking: !!l.parking,
            is_new_construction: !!l.is_new_construction,
            code_insee: l.code_insee ?? null,
            strategy: scoringInput.strategy as never,
            apport: Number(scoringInput.apport ?? 200_000),
            taux_credit_pct: Number(scoringInput.taux_credit_pct ?? 3),
            duree_credit_ans: Number(scoringInput.duree_credit_ans ?? 25),
            tmi_pct: Number(scoringInput.tmi_pct ?? 30),
            rendement_min_pct: Number(scoringInput.rendement_min_pct ?? 6),
            tolerance_travaux: (scoringInput.tolerance_travaux ?? "leger") as never,
          },
          scoringCtx,
        );
        scoreByExt.set(l.external_id, res);
      }
      logger.info("Scored inline", {
        watchId,
        scored: [...scoreByExt.values()].filter(Boolean).length,
      });

      // 5. Read all existing watch_listings for this watch (for diff)
      const { data: existing } = await supabaseApp
        .from("watch_listings")
        .select(
          "id, external_id, current_price, current_status, current_score, price_history, removed_since, listing_id",
        )
        .eq("watch_id", watchId);
      const existingByExt = new Map<string, NonNullable<typeof existing>[number]>();
      for (const e of existing ?? []) {
        existingByExt.set(e.external_id, e);
      }

      // Stat counters
      let newCount = 0;
      let dropCount = 0;
      let signalCount = 0;
      let relistedCount = 0;
      let removedCount = 0;
      const seenInThisRun = new Set<string>();

      // Sensitivity → seuil signal_to_verify
      const sensitivity: WatchSensitivity =
        (watch.sensitivity ?? "moderate") as WatchSensitivity;
      const signalThreshold = SIGNAL_TO_VERIFY_THRESHOLDS[sensitivity];

      // 6. Pour chaque item : upsert watch_listing + détecte events
      for (const item of uniqueMapped) {
        seenInThisRun.add(item.external_id);

        // Pour calculer le score, on a besoin d'enrichir avec ADEME/BAN + scoring.
        // PR-D simplifié : on n'enrichit pas dans le scout (coût + latence). Le
        // score sera = null si pas déjà vu, sinon conservé. Pour la 1ère
        // détection on accepte un score null et on filtre côté digest sur
        // listing.current_score qui peut être null.
        //
        // Future optim PR-D bis : lancer enrichissement+scoring async post-scout.

        const existingRow = existingByExt.get(item.external_id);
        const currentPriceM2 = item.surface && item.surface > 0 ? item.prix / item.surface : null;

        if (!existingRow) {
          // NEW : insère avec score inline + event new_match SI score >= threshold
          const scoreResult = scoreByExt.get(item.external_id);
          const scoreTotal = scoreResult?.score_total ?? null;

          const { data: inserted } = await supabaseApp
            .from("watch_listings")
            .insert({
              watch_id: watchId,
              external_id: item.external_id,
              source_site: item.source_site,
              source_url: item.source_url,
              title: item.title,
              current_price: item.prix,
              current_surface: item.surface,
              current_dpe: item.dpe,
              current_score: scoreTotal,
              current_status: "new",
              price_history: [
                {
                  date: runStart.toISOString(),
                  price: item.prix,
                  change_pct: null,
                } satisfies PriceHistoryEntry,
              ],
              first_seen_at: runStart.toISOString(),
              last_seen_at: runStart.toISOString(),
            })
            .select("id")
            .single();
          if (inserted) {
            // Event new_match seulement si score >= seuil de la watch.
            // Sinon on tracke le listing mais on ne notifie pas (réduit le bruit).
            if (scoreTotal != null && scoreTotal >= watch.score_threshold) {
              newCount++;
              await supabaseApp.from("watch_events").insert({
                watch_id: watchId,
                watch_listing_id: inserted.id,
                watch_run_id: runId,
                event_type: "new_match",
                payload: {
                  score: scoreTotal,
                  prix: item.prix,
                  prix_m2: currentPriceM2,
                  dpe: item.dpe,
                  surface: item.surface,
                },
              });
            }
          }
        } else {
          // EXISTING : check price change
          const oldPrice = Number(existingRow.current_price);
          const newPrice = item.prix;
          const deltaPct = oldPrice > 0 ? (newPrice - oldPrice) / oldPrice : 0;

          const wasRemoved = existingRow.current_status === "removed" || existingRow.current_status === "gone";

          // Append to price_history si prix changé
          const oldHistory = (existingRow.price_history as PriceHistoryEntry[]) ?? [];
          const updatedHistory: PriceHistoryEntry[] =
            Math.abs(deltaPct) > 0.001
              ? [...oldHistory, { date: runStart.toISOString(), price: newPrice, change_pct: deltaPct }]
              : oldHistory;

          // Recalcule le score si le prix a changé (sinon on garde l'ancien)
          const scoreResult = Math.abs(deltaPct) > 0.001
            ? scoreByExt.get(item.external_id)
            : null;
          const newScore = scoreResult?.score_total ?? existingRow.current_score;

          await supabaseApp
            .from("watch_listings")
            .update({
              current_price: newPrice,
              current_surface: item.surface,
              current_dpe: item.dpe,
              current_score: newScore,
              current_status: wasRemoved ? "tracked" : (existingRow.current_status === "new" ? "tracked" : existingRow.current_status),
              price_history: updatedHistory as never,
              last_seen_at: runStart.toISOString(),
              removed_since: null,
            })
            .eq("id", existingRow.id);

          if (wasRemoved) {
            // Event relisted
            relistedCount++;
            await supabaseApp.from("watch_events").insert({
              watch_id: watchId,
              watch_listing_id: existingRow.id,
              watch_run_id: runId,
              event_type: "relisted",
              payload: {
                prev_removed_at: existingRow.removed_since,
                new_price: newPrice,
                prev_price: oldPrice,
              },
            });
          } else if (deltaPct <= -PRICE_DROP_THRESHOLD_PCT) {
            // Price drop notable (>= 3%)
            dropCount++;
            await supabaseApp.from("watch_events").insert({
              watch_id: watchId,
              watch_listing_id: existingRow.id,
              watch_run_id: runId,
              event_type: "price_drop",
              payload: {
                old_price: oldPrice,
                new_price: newPrice,
                delta_pct: deltaPct * 100,
                delta_eur: newPrice - oldPrice,
              },
            });
          } else if (deltaPct >= PRICE_DROP_THRESHOLD_PCT) {
            // Price rise : enregistré pour analytics, pas dans email
            await supabaseApp.from("watch_events").insert({
              watch_id: watchId,
              watch_listing_id: existingRow.id,
              watch_run_id: runId,
              event_type: "price_rise",
              payload: {
                old_price: oldPrice,
                new_price: newPrice,
                delta_pct: deltaPct * 100,
              },
            });
          }

          // Signal to verify : lit market_stats_cache par code_insee.
          // Skip si pas d'INSEE (besoin pour PK lookup).
          if (currentPriceM2 != null && item.code_insee) {
            const stat = await fetchMarketStat({
              code_insee: item.code_insee,
              type: item.type ?? "appartement",
              dpeBin: dpeLetterToBin(item.dpe),
            });
            if (stat && stat.n_transactions >= SIGNAL_MIN_TRANSACTIONS) {
              const ecart = (currentPriceM2 - stat.median_eur_m2) / stat.median_eur_m2;
              if (ecart <= signalThreshold) {
                signalCount++;
                await supabaseApp.from("watch_events").insert({
                  watch_id: watchId,
                  watch_listing_id: existingRow.id,
                  watch_run_id: runId,
                  event_type: "signal_to_verify",
                  payload: {
                    ecart_pct: ecart * 100,
                    n_transactions: stat.n_transactions,
                    median_eur_m2: stat.median_eur_m2,
                    dpe_bin: dpeLetterToBin(item.dpe) satisfies DpeBinType,
                    commune_insee: item.code_insee,
                  },
                });
              }
            }
          }
        }
      }

      // 7. Pour chaque watch_listing en DB pas dans le scout :
      //    - 1er run absent → current_status='removed', removed_since=now
      //    - 2e run consécutif absent → current_status='gone' + event removed
      for (const old of existing ?? []) {
        if (seenInThisRun.has(old.external_id)) continue;
        if (old.current_status === "removed") {
          // 2e run consécutif absent → confirme removed
          await supabaseApp
            .from("watch_listings")
            .update({ current_status: "gone" })
            .eq("id", old.id);
          removedCount++;
          await supabaseApp.from("watch_events").insert({
            watch_id: watchId,
            watch_listing_id: old.id,
            watch_run_id: runId,
            event_type: "removed",
            payload: {
              last_known_price: Number(old.current_price),
              last_seen_at: old.removed_since ?? runStart.toISOString(),
              consecutive_missing_runs: 2,
            },
          });
        } else if (old.current_status === "new" || old.current_status === "tracked") {
          // 1er run absent → marque pour confirmation
          await supabaseApp
            .from("watch_listings")
            .update({
              current_status: "removed",
              removed_since: runStart.toISOString(),
            })
            .eq("id", old.id);
        }
      }

      // 8. Finalize run
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - runStart.getTime();

      await supabaseApp
        .from("watch_runs")
        .update({
          status: "succeeded",
          finished_at: finishedAt.toISOString(),
          duration_ms: durationMs,
          items_scraped: uniqueMapped.length,
          new_count: newCount,
          drop_count: dropCount,
          signal_count: signalCount,
          relisted_count: relistedCount,
          removed_count: removedCount,
          truncated,
          apify_run_ids: [apifyResult.runId],
          estimated_cost_eur: apifyResult.stats.estimatedCostEur,
        })
        .eq("id", runId);

      // Update watches stats + truncate consecutive counter
      const newConsecutiveTruncated = truncated
        ? (watch.consecutive_truncated_runs ?? 0) + 1
        : 0;
      await supabaseApp
        .from("watches")
        .update({
          last_run_at: runStart.toISOString(),
          last_run_status: "succeeded",
          consecutive_truncated_runs: newConsecutiveTruncated,
          stats_7d: {
            new: newCount,
            drops: dropCount,
            signals: signalCount,
            relisted: relistedCount,
            removed: removedCount,
            last_updated: finishedAt.toISOString(),
          } as never,
        })
        .eq("id", watchId);

      logger.info("Watch scout done", {
        watchId,
        newCount,
        dropCount,
        signalCount,
        relistedCount,
        removedCount,
        truncated,
        durationMs,
      });

      return {
        watchId,
        runId,
        newCount,
        dropCount,
        signalCount,
        relistedCount,
        removedCount,
        truncated,
        itemsScraped: uniqueMapped.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabaseApp
        .from("watch_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", runId);
      await supabaseApp
        .from("watches")
        .update({
          last_run_at: runStart.toISOString(),
          last_run_status: "failed",
        })
        .eq("id", watchId);
      Sentry.captureException(err, { tags: { watch_id: watchId, run_id: runId } });
      throw err;
    }
  },
});

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

async function fetchMarketStat(args: {
  code_insee: string | null;
  type: string;
  dpeBin: DpeBinType;
}): Promise<MarketStat | null> {
  if (!args.code_insee) return null;

  // PR-E : lookup par (commune_insee, bien_type, dpe_bin) — c'est la PK.
  // Fallback dpe_bin='unknown' si match exact absent (DVF V1 sans DPE crossing).
  const bienType =
    args.type === "maison" ? "maison" : args.type === "appartement" ? "appartement" : null;
  if (!bienType) return null;

  // 1. Tente le match exact sur le bin DPE
  const { data: exact } = await supabaseApp
    .from("market_stats_cache")
    .select("median_eur_m2, n_transactions")
    .eq("commune_insee", args.code_insee)
    .eq("bien_type", bienType)
    .eq("dpe_bin", args.dpeBin)
    .maybeSingle();
  if (exact) {
    return {
      median_eur_m2: Number(exact.median_eur_m2),
      n_transactions: exact.n_transactions,
    };
  }

  // 2. Fallback : dpe_bin='unknown' (cas V1 où on n'a pas la segmentation DPE)
  if (args.dpeBin !== "unknown") {
    const { data: fallback } = await supabaseApp
      .from("market_stats_cache")
      .select("median_eur_m2, n_transactions")
      .eq("commune_insee", args.code_insee)
      .eq("bien_type", bienType)
      .eq("dpe_bin", "unknown")
      .maybeSingle();
    if (fallback) {
      return {
        median_eur_m2: Number(fallback.median_eur_m2),
        n_transactions: fallback.n_transactions,
      };
    }
  }
  return null;
}
