// Task `resolve-address` — récupère l'adresse exacte d'un bien à partir
// de l'URL de l'annonce. Workflow rapide (~10-60s) vs analyze.ts (5-8 min).
//
// Pipeline :
//   1. Lit la row `address_lookups` (id passé en payload)
//   2. Scrape l'URL via single-listing-scrape (Apify ou fetch direct)
//   3. Enrichissement adresse en cascade :
//      a) ADEME DPE si surface+CP+DPE connus      → adresse EXACTE
//      b) BAN reverse si lat/lng connus           → rue à proximité
//      c) Sinon fallback ville+CP                 → "Saint-Maur 94210"
//   4. Update la row avec address, lat/lng, resolution_source, confidence
//
// Status final : 'done' ou 'failed'

import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import { findAdemeDpe } from "@/services/ademe";
import { banGeocode, banReverse } from "@/services/ban";
import { scrapeSingleListingFromUrl } from "@/services/single-listing-scrape";

const payloadSchema = z.object({
  lookupId: z.string().uuid(),
});

type ResolutionSource = "ademe" | "ban_reverse" | "scraped" | "none";

export const resolveAddressTask = task({
  id: "resolve-address",
  maxDuration: 180, // 3 min max
  retry: { maxAttempts: 1 },
  run: async (payload: unknown) => {
    const { lookupId } = payloadSchema.parse(payload);
    logger.info("Resolve address start", { lookupId });

    // 1. Lire la row
    const { data: lookup, error: readErr } = await supabaseApp
      .from("address_lookups")
      .select("id, url, profile_id")
      .eq("id", lookupId)
      .single();
    if (readErr || !lookup) {
      throw new Error(`Lookup ${lookupId} introuvable: ${readErr?.message}`);
    }

    try {
      // 2. Scrape de l'URL
      const listing = await scrapeSingleListingFromUrl(lookup.url);
      logger.info("Scraped", {
        site: listing.sourceSite,
        externalId: listing.externalId,
        hasLatLng: !!(listing.lat && listing.lng),
        hasDpe: !!listing.dpe,
        hasSurface: !!listing.surface,
        hasCp: !!listing.codePostal,
      });

      // Persister tout de suite les métadonnées listing (utile même
      // si l'enrichissement adresse échoue ensuite)
      await supabaseApp
        .from("address_lookups")
        .update({
          source_site: listing.sourceSite === "logic-immo"
            ? "logic_immo"
            : listing.sourceSite,
          listing_title: listing.title,
          listing_price: listing.prix,
          listing_surface: listing.surface,
          listing_dpe: listing.dpe,
          apify_run_id: listing.apifyRunId,
          city: listing.ville,
          postal_code: listing.codePostal,
          // Si l'actor a déjà extrait une adresse (rare : SeLoger
          // parfois), on l'utilise direct
          ...(listing.adresseRaw
            ? {
                address: listing.adresseRaw,
                resolution_source: "scraped" as ResolutionSource,
                confidence: 1.0,
                lat: listing.lat,
                lng: listing.lng,
              }
            : {}),
        })
        .eq("id", lookupId);

      // Si adresse déjà scrapée et coords présentes → done
      if (listing.adresseRaw && listing.lat && listing.lng) {
        await markDone(lookupId);
        return { status: "done" as const, source: "scraped" as const };
      }

      // 3a. Tentative ADEME (priorité 1 — adresse exacte)
      let resolved: {
        address: string;
        lat: number | null;
        lng: number | null;
        source: ResolutionSource;
        confidence: number;
      } | null = null;

      if (
        listing.surface &&
        listing.surface > 10 &&
        listing.codePostal &&
        /^\d{5}$/.test(listing.codePostal) &&
        listing.dpe
      ) {
        logger.info("Try ADEME", {
          cp: listing.codePostal,
          dpe: listing.dpe,
          surface: listing.surface,
        });
        const match = await findAdemeDpe({
          codePostal: listing.codePostal,
          classeDpe: listing.dpe,
          surface: listing.surface,
        });
        if (match) {
          // Re-géocode pour avoir lat/lng cohérents avec l'adresse
          let preciseLat: number | null = listing.lat;
          let preciseLng: number | null = listing.lng;
          try {
            const geo = await banGeocode(match.adresse_ban);
            preciseLat = geo.latitude;
            preciseLng = geo.longitude;
          } catch {
            // On garde les coords du listing si BAN échoue
          }
          resolved = {
            address: match.adresse_ban,
            lat: preciseLat,
            lng: preciseLng,
            source: "ademe",
            confidence: match.score_ban ?? 0.9,
          };
          logger.info("ADEME match", {
            address: match.adresse_ban,
            candidates: match.totalCandidates,
          });
        }
      }

      // 3b. Fallback BAN reverse (rue à proximité du GPS)
      if (!resolved && listing.lat && listing.lng) {
        logger.info("Try BAN reverse", {
          lat: listing.lat,
          lng: listing.lng,
        });
        const geo = await banReverse(listing.lat, listing.lng);
        if (geo) {
          resolved = {
            address: geo.label,
            lat: listing.lat,
            lng: listing.lng,
            source: "ban_reverse",
            // Score BAN typique ici : 0.4-0.7 (street match)
            confidence: geo.score ?? 0.5,
          };
        }
      }

      // 3c. Fallback ville+CP brut (mieux que rien)
      if (!resolved) {
        const fallback =
          [listing.ville, listing.codePostal].filter(Boolean).join(" ") ||
          null;
        if (fallback) {
          resolved = {
            address: fallback,
            lat: listing.lat,
            lng: listing.lng,
            source: "none",
            confidence: 0.1,
          };
        }
      }

      if (!resolved) {
        throw new Error(
          "Impossible de résoudre une adresse (pas de GPS, pas de CP, pas de DPE)",
        );
      }

      // 4. Update final
      await supabaseApp
        .from("address_lookups")
        .update({
          address: resolved.address,
          lat: resolved.lat,
          lng: resolved.lng,
          resolution_source: resolved.source,
          confidence: resolved.confidence,
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", lookupId);

      logger.info("Resolve address done", {
        lookupId,
        source: resolved.source,
        address: resolved.address,
      });

      return { status: "done" as const, source: resolved.source };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Resolve address failed", { lookupId, message });
      await supabaseApp
        .from("address_lookups")
        .update({
          status: "failed",
          error_message: message.slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", lookupId);
      Sentry.captureException(err, {
        tags: { lookup_id: lookupId, task: "resolve-address" },
      });
      throw err;
    }
  },
});

async function markDone(lookupId: string): Promise<void> {
  await supabaseApp
    .from("address_lookups")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
    })
    .eq("id", lookupId);
}
