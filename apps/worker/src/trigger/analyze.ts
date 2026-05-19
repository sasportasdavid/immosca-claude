// Task d'analyse principale : scrape Apify → normalise → enrichit
// (géocodage BAN, DPE, Géorisques) → score → thèse Claude pour le top
// N → met à jour le row `analyses` et les `listings` + `listing_scores`
// côté immoscan-app.
//
// Étapes (progress_pct) :
//   pending (0) → scraping (20%) → enriching (50%) → scoring (70%)
//   → generating (90%) → done (100%)
//
// Idempotent : si on relance avec le même analysis_id, on UPSERT par
// (analysis_id, external_id) — pas de duplicates.

import {
  PLANS,
  type PlanId,
  claudeThesisOutputSchema,
  computeScore,
  verdictFromScore,
} from "@immoscan/shared";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp, supabaseData } from "@/lib/supabase";
import {
  buildApifyRunInput,
  fetchApifyRunResult,
  runApifyActor,
} from "@/services/apify";
import {
  APIFY_MAPPERS,
  type ListingInsert,
  type RawApifyListing,
} from "@/services/apify-mappers";
import { banGeocode } from "@/services/ban";
import { callClaudeStructured } from "@/services/claude";
import {
  THESIS_SYSTEM_PROMPT,
  buildThesisUserPrompt,
} from "@/services/prompts/thesis";

const payloadSchema = z.object({
  analysisId: z.string().uuid(),
  /** Override de l'actor Apify pour tests. Defaut : env APIFY_ACTOR_SELOGER / _LEBONCOIN. */
  actorId: z.string().optional(),
  /**
   * Override : ré-utilise un run Apify déjà existant au lieu d'en lancer
   * un nouveau. Utile pour rejouer une analyse depuis un cache, ou pour
   * tester le pipeline en dev sans dépenser du budget Apify ni se faire
   * rate-limit par les free tiers d'actors.
   */
  apifyRunIdOverride: z.string().optional(),
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
  const { error } = await supabaseApp
    .from("analyses")
    .update({ status, progress_pct: progressPct, ...extra })
    .eq("id", analysisId);
  if (error) {
    // Throw plutôt que swallow : sans ce check on a eu des analyses
    // zombi "pending" malgré la task qui tournait sans erreur.
    throw new Error(
      `setAnalysisStatus(${analysisId}, ${status}) DB error: ${error.message}`,
    );
  }
}

export const analyzeTask = task({
  id: "analyze",
  maxDuration: 600, // 10 min
  retry: { maxAttempts: 1 }, // pas de retry auto : on a Sentry pour debug
  run: async (payload: unknown) => {
    const { analysisId, actorId, apifyRunIdOverride } =
      payloadSchema.parse(payload);
    logger.info("Analyze start", { analysisId, apifyRunIdOverride });

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
      // 2. Apify : soit on lance un nouveau run, soit on rejoue un run
      // existant (override pour tests / replay depuis cache).
      let apifyResult;
      if (apifyRunIdOverride) {
        logger.info("Réutilisation d'un run Apify existant", {
          apifyRunIdOverride,
        });
        apifyResult = await fetchApifyRunResult<RawApifyListing>(
          apifyRunIdOverride,
        );
      } else {
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
        apifyResult = await runApifyActor<RawApifyListing>({
          actorId: resolvedActorId,
          runInput: buildApifyRunInput(resolvedActorId, analysis.source_url),
        });
      }

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

      // 4. Upsert listings : idempotent via la contrainte unique
      // (analysis_id, external_id, source_site). On peut donc re-trigger
      // un run sans dupliquer.
      const BATCH = 500;
      for (let i = 0; i < mapped.length; i += BATCH) {
        const slice = mapped.slice(i, i + BATCH);
        const { error } = await supabaseApp
          .from("listings")
          .upsert(slice, { onConflict: "analysis_id,external_id,source_site" });
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

      // 7. SCORING (PR4) — pour chaque listing on enrichit avec les
      //    référentiels marché côté immoscan-data puis on calcule le score.
      await setAnalysisStatus(analysisId, "scoring", 70);
      logger.info("Scoring listings", { count: mapped.length });

      const paramsSnapshot = analysis.params_snapshot as Record<
        string,
        unknown
      > & {
        strategy?: string;
        apport?: number;
        taux_credit_pct?: number;
        duree_credit_ans?: number;
        tmi_pct?: number;
        rendement_min_pct?: number;
        tolerance_travaux?: string;
      };

      // Re-read listings depuis la DB pour avoir les id générés + geom
      const { data: dbListings, error: readErr } = await supabaseApp
        .from("listings")
        .select(
          "id, external_id, prix, surface, type, dpe, etage, pieces, balcon, terrasse, parking, is_new_construction, code_insee, code_postal",
        )
        .eq("analysis_id", analysisId);
      if (readErr) throw readErr;

      const scoredCount = await scoreListings(
        analysisId,
        dbListings ?? [],
        paramsSnapshot,
      );
      logger.info("Scored", { scoredCount });

      // 8. GENERATING — thèse Claude pour le top N selon plan
      await setAnalysisStatus(analysisId, "generating", 90);

      // Récupère le plan du user via profile
      const { data: profile } = await supabaseApp
        .from("profiles")
        .select("subscription_plan")
        .eq("id", analysis.profile_id)
        .single();
      const plan = (profile?.subscription_plan ?? "free") as PlanId;
      const topN = PLANS[plan].topN ?? 5;

      const generatedCount = await generateThesesForTop(
        analysisId,
        topN,
        plan,
        paramsSnapshot,
      );
      logger.info("Theses generated", { generatedCount, plan, topN });

      // 9. Done
      await setAnalysisStatus(analysisId, "done", 100, {
        median_price_per_sqm: median,
        completed_at: new Date().toISOString(),
      });

      return {
        analysisId,
        scraped: apifyResult.items.length,
        normalized: mapped.length,
        geocoded: toGeocode.length,
        scored: scoredCount,
        thesesGenerated: generatedCount,
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

// ──────────────────────────────────────────────────────────────────
// PR4 — Helpers scoring + génération thèses
// ──────────────────────────────────────────────────────────────────

type DbListing = {
  id: string;
  external_id: string;
  prix: number;
  surface: number | null;
  type: string;
  dpe: string | null;
  etage: number | null;
  pieces: number | null;
  balcon: boolean | null;
  terrasse: boolean | null;
  parking: boolean | null;
  is_new_construction: boolean | null;
  code_insee: string | null;
  code_postal: string | null;
};

/**
 * Score chaque listing : enrichit avec médians DVF + risques Géorisques,
 * appelle computeScore (logique pure shared/scoring), INSERT dans
 * listing_scores.
 */
async function scoreListings(
  analysisId: string,
  listings: DbListing[],
  params: Record<string, unknown>,
): Promise<number> {
  let scored = 0;
  logger.info("scoreListings: input", {
    listingsCount: listings.length,
    firstSurfaces: listings.slice(0, 5).map((l) => ({
      id: l.id,
      surface: l.surface,
      surfaceType: typeof l.surface,
    })),
  });
  for (const l of listings) {
    // surface peut être string ("138.00") car Postgres retourne numeric en
    // string par défaut côté postgrest. Convertir avant comparaison.
    const surfaceNum = Number(l.surface);
    if (!Number.isFinite(surfaceNum) || surfaceNum <= 0) {
      logger.info("Skip listing (surface invalide)", {
        id: l.id,
        surface: l.surface,
      });
      continue;
    }

    // Lookup médians DVF côté immoscan-data
    let prixMedianCommune: number | null = null;
    let prixMedianIris: number | null = null;
    if (l.code_insee) {
      const { data } = await supabaseData
        .from("dvf_medians_commune")
        .select("median_prix_m2")
        .eq("code_commune", l.code_insee)
        .eq("type_local", l.type === "maison" ? "Maison" : "Appartement")
        .order("annee", { ascending: false })
        .limit(1)
        .maybeSingle();
      prixMedianCommune = data?.median_prix_m2
        ? Number(data.median_prix_m2)
        : null;
    }

    // Lookup loyer médian zone (OLL) côté immoscan-data.
    // On bucket pieces : 1, 2, 3 ou "4_plus" (format OLL).
    // En PR5 minimum on indexe par code_insee (code_zonage_oll = code_insee
    // dans nos seeds). Quand on aura le vrai import OLL avec ses propres
    // codes de zonage, on aura besoin d'une table de mapping insee↔zonage.
    let loyerM2MedianZone: number | null = null;
    if (l.code_insee && l.pieces !== null) {
      const piecesNum = Math.max(1, Math.floor(Number(l.pieces)));
      const piecesBucket = piecesNum >= 4 ? "4_plus" : String(piecesNum);
      const { data: ollData } = await supabaseData
        .from("oll_loyers_medians")
        .select("loyer_m2_median")
        .eq("code_zonage_oll", l.code_insee)
        .eq(
          "type_logement",
          l.type === "maison" ? "maison" : "appartement",
        )
        .eq("nombre_pieces", piecesBucket)
        .order("annee", { ascending: false })
        .limit(1)
        .maybeSingle();
      loyerM2MedianZone = ollData?.loyer_m2_median
        ? Number(ollData.loyer_m2_median)
        : null;
    }

    // Risques Géorisques
    let hasPpri = false;
    let argile: "nul" | "faible" | "moyen" | "fort" | null = null;
    let sismicite: number | null = null;
    let radon: number | null = null;
    if (l.code_insee) {
      const { data } = await supabaseData
        .from("georisques_communes")
        .select(
          "has_ppri, retrait_argile_niveau, sismicite, radon",
        )
        .eq("code_commune", l.code_insee)
        .maybeSingle();
      if (data) {
        hasPpri = data.has_ppri ?? false;
        argile = (data.retrait_argile_niveau as typeof argile) ?? null;
        sismicite = data.sismicite;
        radon = data.radon;
      }
    }

    const dpe = l.dpe as "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;

    const result = computeScore({
      prix: Number(l.prix),
      surface: Number(l.surface),
      type:
        l.type === "maison"
          ? "maison"
          : l.type === "terrain"
            ? "terrain"
            : l.type === "immeuble"
              ? "immeuble"
              : "appartement",
      dpe,
      etage: l.etage,
      balcon: !!l.balcon,
      terrasse: !!l.terrasse,
      parking: !!l.parking,
      is_new_construction: !!l.is_new_construction,
      prix_m2_median_commune: prixMedianCommune,
      prix_m2_median_iris: prixMedianIris,
      loyer_m2_median_zone: loyerM2MedianZone,
      strategy: ((params.strategy as string) ?? "locatif_nu") as never,
      apport: Number(params.apport ?? 200_000),
      taux_credit_pct: Number(params.taux_credit_pct ?? 3),
      duree_credit_ans: Number(params.duree_credit_ans ?? 25),
      tmi_pct: Number(params.tmi_pct ?? 30),
      rendement_min_pct: Number(params.rendement_min_pct ?? 6),
      tolerance_travaux: ((params.tolerance_travaux as string) ??
        "leger") as never,
      has_ppri: hasPpri,
      retrait_argile_niveau: argile,
      sismicite,
      radon,
    });

    const { error } = await supabaseApp.from("listing_scores").upsert(
      {
        analysis_id: analysisId,
        listing_id: l.id,
        score_total: result.score_total,
        score_prix: result.sub_scores.prix,
        score_rendement: result.sub_scores.rendement,
        score_cashflow: result.sub_scores.cashflow,
        score_dpe: result.sub_scores.dpe,
        score_quartier: result.sub_scores.quartier,
        score_risques: result.sub_scores.risques,
        prix_marche_estime: result.financial.prix_marche_estime,
        ecart_prix_pct: result.financial.ecart_prix_pct,
        loyer_estime: result.financial.loyer_estime,
        loyer_m2_estime: result.financial.loyer_m2_estime,
        rendement_brut_pct: result.financial.rendement_brut_pct,
        rendement_net_pct: result.financial.rendement_net_pct,
        rendement_net_net_pct: result.financial.rendement_net_net_pct,
        cashflow_mensuel: result.financial.cashflow_mensuel,
        mensualite_credit: result.financial.mensualite_credit,
        frais_notaire: result.financial.frais_notaire,
        cout_total_acquisition: result.financial.cout_total_acquisition,
        is_passoire_dpe: result.climate.is_passoire_dpe,
        risque_climat_2025: result.climate.risque_climat_2025,
        risque_climat_2028: result.climate.risque_climat_2028,
        risque_climat_2034: result.climate.risque_climat_2034,
        scoring_version: "v1.0",
        verdict: verdictFromScore(result.score_total),
      } as never,
      { onConflict: "listing_id" },
    );
    if (error) {
      // Avant on swallow vers Sentry → 0 scores et on ne savait pas
      // pourquoi. Throw pour qu'on voie dans les logs Trigger.dev.
      Sentry.captureException(error, {
        tags: { listing_id: l.id, context: "scoreListings upsert" },
      });
      throw new Error(
        `listing_scores upsert failed for listing ${l.id}: ${error.message} (code=${error.code} hint=${error.hint})`,
      );
    }
    scored++;
    logger.info("Listing scoré", { id: l.id, score: result.score_total });
  }
  return scored;
}

/**
 * Génère une thèse Claude pour le top N listings (par score_total DESC).
 * Cache 30j (via clé hash listing_id + scoring_version) — pas implémenté
 * ici, à ajouter en PR4.5 si on voit des re-générations fréquentes.
 */
async function generateThesesForTop(
  analysisId: string,
  topN: number,
  plan: PlanId,
  params: Record<string, unknown>,
): Promise<number> {
  // Récupère les N meilleurs scores avec leurs listings
  const { data: tops, error } = await supabaseApp
    .from("listing_scores")
    .select(
      "listing_id, score_total, score_prix, score_rendement, score_cashflow, score_dpe, score_quartier, score_risques, prix_marche_estime, ecart_prix_pct, loyer_estime, loyer_m2_estime, rendement_brut_pct, rendement_net_pct, rendement_net_net_pct, cashflow_mensuel, mensualite_credit, frais_notaire, cout_total_acquisition, is_passoire_dpe, risque_climat_2025, risque_climat_2028, risque_climat_2034, listing:listings!inner(id, analysis_id, title, type, surface, pieces, prix, dpe, ville, code_postal, annee_construction, etage, is_new_construction, code_insee)",
    )
    .order("score_total", { ascending: false, nullsFirst: false })
    .limit(topN);
  if (error) {
    Sentry.captureException(error, { tags: { context: "generateThesesForTop" } });
    return 0;
  }

  let generated = 0;
  for (const row of tops ?? []) {
    const l = (row as unknown as { listing: Record<string, unknown> }).listing;
    if (!l || (l.analysis_id as string) !== analysisId) continue;

    let hasPpri = false;
    if (l.code_insee) {
      const { data } = await supabaseData
        .from("georisques_communes")
        .select("has_ppri")
        .eq("code_commune", l.code_insee as string)
        .maybeSingle();
      hasPpri = data?.has_ppri ?? false;
    }

    try {
      const result = await callClaudeStructured({
        plan,
        schema: claudeThesisOutputSchema,
        toolName: "rediger_these_investissement",
        toolDescription:
          "Rédige une thèse d'investissement pour un bien immobilier",
        system: THESIS_SYSTEM_PROMPT,
        user: buildThesisUserPrompt({
          bien: {
            title: (l.title as string) ?? "(Sans titre)",
            type: l.type as string,
            surface: l.surface as number | null,
            pieces: l.pieces as number | null,
            prix: l.prix as number,
            dpe: l.dpe as string | null,
            ville: l.ville as string | null,
            code_postal: l.code_postal as string | null,
            annee_construction: l.annee_construction as number | null,
            etage: l.etage as number | null,
            is_new_construction: !!l.is_new_construction,
          },
          marche: {
            prix_m2_median_commune: null,
            prix_m2_median_iris: null,
            loyer_m2_median_zone: null,
          },
          scoring: {
            score_total: row.score_total ?? 0,
            sub_scores: {
              prix: row.score_prix ?? 0,
              rendement: row.score_rendement ?? 0,
              cashflow: row.score_cashflow ?? 0,
              dpe: row.score_dpe ?? 0,
              quartier: row.score_quartier ?? 0,
              risques: row.score_risques ?? 0,
            },
            financial: {
              prix_marche_estime: row.prix_marche_estime,
              ecart_prix_pct: row.ecart_prix_pct,
              loyer_estime: row.loyer_estime,
              loyer_m2_estime: row.loyer_m2_estime,
              rendement_brut_pct: row.rendement_brut_pct,
              rendement_net_pct: row.rendement_net_pct,
              rendement_net_net_pct: row.rendement_net_net_pct,
              cashflow_mensuel: row.cashflow_mensuel,
              mensualite_credit: row.mensualite_credit,
              frais_notaire: row.frais_notaire,
              cout_total_acquisition: row.cout_total_acquisition,
            },
          },
          user_params: {
            strategy: (params.strategy as string) ?? "locatif_nu",
            apport: Number(params.apport ?? 200_000),
            taux_credit_pct: Number(params.taux_credit_pct ?? 3),
            duree_credit_ans: Number(params.duree_credit_ans ?? 25),
            tmi_pct: Number(params.tmi_pct ?? 30),
            rendement_min_pct: Number(params.rendement_min_pct ?? 6),
          },
          risques: {
            is_passoire_dpe: row.is_passoire_dpe ?? false,
            risque_climat_2025: row.risque_climat_2025 ?? false,
            risque_climat_2028: row.risque_climat_2028 ?? false,
            risque_climat_2034: row.risque_climat_2034 ?? false,
            has_ppri: hasPpri,
          },
        }),
      });

      await supabaseApp
        .from("listing_scores")
        .update({
          these_claude: result.data.these,
          financement_claude: result.data.financement,
          negociation_claude: result.data.negociation,
          prix_negociation_cible: result.data.prix_negociation_cible,
          verdict: result.data.verdict,
          claude_model: result.model,
          claude_tokens_used: result.tokensUsed,
        } as never)
        .eq("listing_id", row.listing_id as string);

      generated++;
      logger.info("Thèse Claude générée", {
        listing_id: row.listing_id,
        tokens: result.tokensUsed,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { listing_id: row.listing_id as string, context: "claude thesis" },
      });
      // Throw pour surfacer l'erreur Claude au lieu de générer 0 thèses
      // silencieusement.
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Claude thesis failed for listing ${row.listing_id}: ${msg}`,
      );
    }
  }
  return generated;
}
