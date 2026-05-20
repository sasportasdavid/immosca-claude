// Cron `watch-digest-mailer` :
//   - Standard : lun/mer/ven 8h UTC (1h après les scouts à 7h)
//   - Business : daily 8h UTC
//
// Agrège les watch_events `included_in_digest=false` (créés par les scouts
// de la nuit) par profile, envoie 1 email par profile, puis marque les
// events comme `included_in_digest=true` + `digest_sent_at=now()`.
//
// **Pas d'email s'il n'y a strictement rien** (BM §7.1 "silence radio").
//
// Floutage Free : appliqué dans le template digest.ts via `isMasked(plan, score)`.

import { PLANS, type PlanId } from "@immoscan/shared";
import { logger, schedules } from "@trigger.dev/sdk";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import { buildDigestHtml, type DigestData } from "@/services/email-templates/digest";
import { sendEmail } from "@/services/resend";

interface ProfileBucket {
  profile_id: string;
  email: string;
  full_name: string | null;
  plan: PlanId;
}

async function dispatchDigests(schedule: "standard" | "business") {
  // 1. Récupère les events non encore inclus dans un digest, joint sur watches
  //    et profiles. On filtre les profiles selon le schedule (Free/Pro/Pro+ vs Business).
  const planFilter =
    schedule === "business"
      ? ["business"]
      : ["free", "pro", "pro_plus"];

  // On récupère les events des dernières 24h max (le scout vient juste de
  // finir, donc même fenêtre).
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Lit la liste des watches actives pour les plans concernés
  const { data: watches } = await supabaseApp
    .from("watches")
    .select(
      "id, profile_id, name, source_url, expires_at, profile:profiles!inner(id, email, full_name, subscription_plan)",
    )
    .eq("is_active", true)
    .is("suspended_at", null);

  if (!watches?.length) {
    logger.info("No active watches", { schedule });
    return { schedule, sent: 0, skipped: 0 };
  }

  // Bucketize par profile filtré sur plan
  const byProfile = new Map<
    string,
    {
      bucket: ProfileBucket;
      watchIds: string[];
      watchInfo: Map<string, { name: string; location: string | null; expires_at: string | null }>;
    }
  >();

  for (const w of watches) {
    const p = (w as unknown as { profile: { id: string; email: string; full_name: string | null; subscription_plan: string } }).profile;
    if (!planFilter.includes(p.subscription_plan)) continue;
    if (!byProfile.has(p.id)) {
      byProfile.set(p.id, {
        bucket: {
          profile_id: p.id,
          email: p.email,
          full_name: p.full_name,
          plan: p.subscription_plan as PlanId,
        },
        watchIds: [],
        watchInfo: new Map(),
      });
    }
    const grp = byProfile.get(p.id)!;
    grp.watchIds.push(w.id);
    // Location déduite du nom de la veille — fallback à parse-search-url plus tard
    grp.watchInfo.set(w.id, {
      name: w.name,
      location: null,
      expires_at: (w as unknown as { expires_at: string | null }).expires_at,
    });
  }

  let sentCount = 0;
  let skippedCount = 0;

  for (const [, grp] of byProfile) {
    try {
      // 2. Récupère les events non envoyés pour les watches de ce profile
      const { data: events } = await supabaseApp
        .from("watch_events")
        .select(
          "id, watch_id, watch_listing_id, event_type, payload, created_at",
        )
        .in("watch_id", grp.watchIds)
        .eq("included_in_digest", false)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false });

      const evs = events ?? [];
      if (evs.length === 0) {
        skippedCount++;
        continue; // silence radio
      }

      // 3. Charge les watch_listings concernés
      const listingIds = [...new Set(evs.map((e) => e.watch_listing_id).filter(Boolean))] as string[];
      const { data: listings } = await supabaseApp
        .from("watch_listings")
        .select("*")
        .in("id", listingIds);
      const listingById = new Map((listings ?? []).map((l) => [l.id, l]));

      // 4. Construit les 3 sections (cap 5 par section, BM §7.1)
      // Filtre les new_match avec score null (pas encore enrichis) — évite
      // d'envoyer des notifications sans valeur.
      const newMatches = evs
        .filter((e) => e.event_type === "new_match" && (e.payload as { score?: number | null }).score != null)
        .slice(0, 5)
        .map((e) => ({
          event: e as never,
          listing: listingById.get(e.watch_listing_id!)! as never,
          watchName: grp.watchInfo.get(e.watch_id)?.name ?? "Ma veille",
        }))
        .filter((m) => m.listing);

      const priceDrops = evs
        .filter((e) => e.event_type === "price_drop")
        .slice(0, 5)
        .map((e) => ({
          event: e as never,
          listing: listingById.get(e.watch_listing_id!)! as never,
          watchName: grp.watchInfo.get(e.watch_id)?.name ?? "Ma veille",
        }))
        .filter((m) => m.listing);

      const signalsToVerify = evs
        .filter((e) => e.event_type === "signal_to_verify")
        .slice(0, 5)
        .map((e) => ({
          event: e as never,
          listing: listingById.get(e.watch_listing_id!)! as never,
          watchName: grp.watchInfo.get(e.watch_id)?.name ?? "Ma veille",
        }))
        .filter((m) => m.listing);

      // Si tout est vide après filtrage (score null sur tous les new_match) → skip
      if (newMatches.length === 0 && priceDrops.length === 0 && signalsToVerify.length === 0) {
        // Mais on marque quand même les events comme "vus" pour ne pas les
        // reproposer aux digests suivants (event price_rise / removed sont
        // analytics-only).
        await supabaseApp
          .from("watch_events")
          .update({ included_in_digest: true, digest_sent_at: new Date().toISOString() })
          .in(
            "id",
            evs.map((e) => e.id),
          );
        skippedCount++;
        continue;
      }

      // 5. Build l'expiration la plus proche (pour countdown Free/PPU)
      let earliestExpire: string | null = null;
      for (const [, info] of grp.watchInfo) {
        if (info.expires_at) {
          if (!earliestExpire || info.expires_at < earliestExpire) {
            earliestExpire = info.expires_at;
          }
        }
      }

      // 6. Stats marché : agrège les médianes DVF des communes des biens
      //    actuellement trackés pour ce profile, dédupliquées.
      //    Le delta_pct vs N-1 reste null en V1 (besoin d'un historique
      //    market_stats_cache versionné — TODO PR-E bis).
      const marketStats: DigestData["marketStats"] = [];
      try {
        const trackedListingIds = listingIds; // alimenté plus haut
        if (trackedListingIds.length > 0) {
          // Récupère les codes INSEE + ville des biens trackés
          const { data: listingsCommunes } = await supabaseApp
            .from("listings")
            .select("code_insee, ville")
            .in(
              "id",
              (listings ?? [])
                .map((l) => l.listing_id)
                .filter((x): x is string => !!x),
            )
            .not("code_insee", "is", null);
          const communeByInsee = new Map<string, string>();
          for (const r of listingsCommunes ?? []) {
            if (r.code_insee && r.ville) communeByInsee.set(r.code_insee, r.ville);
          }
          if (communeByInsee.size > 0) {
            const { data: stats } = await supabaseApp
              .from("market_stats_cache")
              .select("commune_insee, bien_type, median_eur_m2")
              .in("commune_insee", [...communeByInsee.keys()])
              .eq("dpe_bin", "unknown") // V1 : seul bin disponible
              .eq("bien_type", "appartement"); // Priorité appart (cas majoritaire David)
            // Dédup par ville (garde la 1ère stat trouvée par commune)
            const seenCities = new Set<string>();
            for (const s of stats ?? []) {
              const city = communeByInsee.get(s.commune_insee);
              if (!city || seenCities.has(city)) continue;
              seenCities.add(city);
              marketStats.push({
                city,
                medianEurM2: Number(s.median_eur_m2),
                deltaPct: null, // V2 quand historique versionné
              });
              if (marketStats.length >= 5) break; // cap à 5 villes dans le digest
            }
          }
        }
      } catch (statsErr) {
        // Section marché optionnelle — on log et on continue sans bloquer l'envoi
        Sentry.captureException(statsErr, {
          tags: { context: "watch-digest-mailer.marketStats" },
        });
      }

      // 7. Build HTML + send
      const firstName = grp.bucket.full_name?.split(" ")[0] ?? null;
      const digest = buildDigestHtml({
        profileFirstName: firstName,
        plan: grp.bucket.plan,
        expiresAt: earliestExpire,
        watches: [...grp.watchInfo.entries()].map(([id, info]) => ({
          id,
          name: info.name,
          location: info.location,
        })),
        newMatches,
        priceDrops,
        signalsToVerify,
        marketStats,
        totalScored: evs.length,
        totalRetained: newMatches.length + priceDrops.length + signalsToVerify.length,
      });

      await sendEmail({
        to: grp.bucket.email,
        subject: digest.subject,
        html: digest.html,
        text: digest.text,
        tag: "digest",
      });

      // 8. Marque les events comme envoyés
      await supabaseApp
        .from("watch_events")
        .update({ included_in_digest: true, digest_sent_at: new Date().toISOString() })
        .in(
          "id",
          evs.map((e) => e.id),
        );

      sentCount++;
      logger.info("Digest sent", {
        profile_id: grp.bucket.profile_id.slice(0, 8),
        plan: grp.bucket.plan,
        events: evs.length,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { context: "watch-digest-mailer", profile_id: grp.bucket.profile_id },
      });
      // Continue avec les autres profiles
    }
  }

  // Cap par palier respect (à logger pour télémétrie post-launch)
  for (const _plan of Object.keys(PLANS)) {
    /* placeholder pour metrics par plan */
  }

  return { schedule, sent: sentCount, skipped: skippedCount };
}

export const watchDigestMailerStandard = schedules.task({
  id: "watch-digest-mailer-standard",
  cron: "0 8 * * 1,3,5",
  maxDuration: 600,
  run: async () => dispatchDigests("standard"),
});

export const watchDigestMailerBusiness = schedules.task({
  id: "watch-digest-mailer-business",
  cron: "0 8 * * *",
  maxDuration: 600,
  run: async () => dispatchDigests("business"),
});
