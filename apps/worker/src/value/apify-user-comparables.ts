// Worker `value-apify-user-comparables` ⭐ — scrape les liens
// SeLoger / LBC fournis par le propriétaire et persiste les résultats
// dans `value.user_provided_comparables`.
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.7 + §3.3 (l'idée pivotale du
// produit : les comparables qualifiés humainement valent mieux que
// notre matching algo).
//
// Pipeline :
//   1. Validation : 0 < urls.length <= 3
//   2. Promise.allSettled sur les 3 URLs (parallel)
//   3. Save chaque succès → table user_provided_comparables
//   4. Trigger value-build-estimation avec trigger='user_links_updated'

import { logger, task, tasks } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import {
  ACTOR_BY_SITE,
  detectSiteFromUrl,
  runApifyActor,
} from "@/services/apify";

const payloadSchema = z.object({
  bien_id: z.string().uuid(),
  urls: z.array(z.string().url()).max(3),
});

const MAX_ITEMS_PER_URL = 200;

type ScrapedItem = {
  ref: string;
  url?: string;
  prix: number | null;
  surface: number | null;
  prix_m2: number | null;
  dpe: string | null;
  typologie: string | null;
  ville: string | null;
  code_postal: string | null;
};

/**
 * Tente de scraper une URL utilisateur via l'actor Apify approprié
 * (SeLoger ou LBC selon le domaine). Retourne les items + la runId
 * Apify. Throw si l'URL n'est pas reconnue ou l'actor fail.
 */
async function scrapeUrlWithApify(url: string): Promise<{
  marketplace: "seloger" | "leboncoin";
  runId: string;
  items: ScrapedItem[];
  truncated: boolean;
}> {
  const site = detectSiteFromUrl(url);
  if (site !== "seloger" && site !== "leboncoin") {
    throw new Error(`URL non supportée pour user-provided: ${url} (site=${site})`);
  }
  const plan = ACTOR_BY_SITE[site];
  if (!plan) throw new Error(`Pas d'actor configuré pour ${site}`);

  const runInput = await Promise.resolve(plan.buildInput(url, MAX_ITEMS_PER_URL + 1));
  const result = await runApifyActor<Record<string, unknown>>({
    actorId: plan.actorId,
    runInput,
    timeoutSecs: 600,
  });

  // Normalisation minimale : on extrait les champs courants. Le mapping
  // complet par actor existe dans `apify-mappers.ts` mais nécessite une
  // analyse pré-existante (analysis_id). Pour user-provided, on stocke
  // un format JSON simplifié — Claude reasoner sait travailler dessus.
  const items: ScrapedItem[] = result.items
    .slice(0, MAX_ITEMS_PER_URL)
    .map((raw): ScrapedItem => {
      const r = raw as Record<string, unknown>;
      const prix = toNumberOrNull(r.price ?? r.prix);
      const surface = toNumberOrNull(r.surface ?? r.area);
      const prix_m2 =
        prix !== null && surface !== null && surface > 0 ? prix / surface : null;
      return {
        ref: String(r.id ?? r.listingId ?? r.url ?? Math.random().toString(36)),
        url: typeof r.url === "string" ? r.url : undefined,
        prix,
        surface,
        prix_m2,
        dpe: typeof r.energyClass === "string" ? r.energyClass : null,
        typologie: typeof r.propertyType === "string" ? r.propertyType : null,
        ville: typeof r.city === "string" ? r.city : null,
        code_postal: typeof r.zipCode === "string" ? r.zipCode : null,
      };
    });

  const truncated = result.items.length > MAX_ITEMS_PER_URL;

  return {
    marketplace: site,
    runId: result.runId,
    items,
    truncated,
  };
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // "175 000 €" → 175000
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const valueApifyUserComparables = task({
  id: "value-apify-user-comparables",
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000 },
  run: async (rawPayload: unknown) => {
    const payload = payloadSchema.parse(rawPayload);
    logger.info("value-apify-user-comparables start", payload);

    if (payload.urls.length === 0) {
      logger.info("Pas d'URL — skip", { bien_id: payload.bien_id });
      return { skipped: true, reason: "no_urls" };
    }

    const results = await Promise.allSettled(
      payload.urls.map((url) => scrapeUrlWithApify(url)),
    );

    let saved = 0;
    let failed = 0;
    for (const [i, res] of results.entries()) {
      const url = payload.urls[i] ?? "";
      if (res.status === "fulfilled") {
        try {
          // Via RPC publique (schéma value pas exposé via PostgREST).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabaseApp as any).rpc(
            "value_user_comparable_save",
            {
              p_bien_id: payload.bien_id,
              p_url_source: url,
              p_marketplace: res.value.marketplace,
              p_scraped_count: res.value.items.length,
              p_truncated: res.value.truncated,
              p_items: res.value.items,
              p_apify_run_id: res.value.runId,
            },
          );
          if (error) {
            logger.error("save user_provided_comparables failed", {
              err: error.message,
              url,
            });
            failed += 1;
          } else {
            saved += 1;
          }
        } catch (e) {
          Sentry.captureException(e, {
            tags: { worker: "value-apify-user-comparables", step: "save" },
            extra: { bien_id: payload.bien_id, url },
          });
          failed += 1;
        }
      } else {
        logger.warn("user-provided URL scrape failed", {
          url,
          err: res.reason instanceof Error ? res.reason.message : String(res.reason),
        });
        Sentry.captureException(res.reason, {
          tags: { worker: "value-apify-user-comparables", step: "scrape" },
          extra: { bien_id: payload.bien_id, url },
        });
        failed += 1;
      }
    }

    // Relance la valorisation avec les nouveaux comparables, même si
    // certaines URLs ont fail — on continue best-effort.
    await tasks.trigger("value-build-estimation", {
      bien_id: payload.bien_id,
      trigger: "user_links_updated",
    });

    return {
      success: true,
      saved,
      failed,
      total: payload.urls.length,
    };
  },
});
