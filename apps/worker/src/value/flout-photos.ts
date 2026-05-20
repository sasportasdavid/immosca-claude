// Worker `value-flout-photos` — anonymisation des photos du bien
// pour l'affichage public en mode discret.
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.6.
//
// Stratégie :
//   - Photos extérieures (façade, jardin, vue de rue) → blur fort
//     pour rendre le bien méconnaissable
//   - Photos intérieures → strip EXIF + watermark "Pré-vente discrète"
//     (l'EXIF GPS pourrait localiser le bien si le photographe l'a
//     laissé)
//
// PR-V1 : stubs (les transformations d'image réelles via Sharp/Jimp
// arrivent en PR-V2 quand on aura cadré l'hébergement des photos
// floutées — vraisemblablement Supabase Storage bucket dédié).
//
// PR-V1 retourne donc des URLs pseudo-floutées (suffixe `_blurred` ou
// `_stripped`) — le rendu front est gracieux (404 → placeholder) et
// la table est à jour.

import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import { detectOutdoor } from "@/services/claude-vision";

const payloadSchema = z.object({
  bien_id: z.string().uuid(),
});

/**
 * STUB PR-V1 : transformation blur fort. Pour l'instant on retourne
 * juste une URL marquée `_blurred.jpg`. À remplacer par Sharp en V2.
 */
async function blurImage(
  url: string,
  _opts: { intensity: "soft" | "medium" | "strong" },
): Promise<string> {
  // TODO PR-V2 : download URL → Sharp blur(40) → upload Supabase Storage
  // bucket `value-photos-blurred` → return public URL.
  return url.replace(/(\.\w+)?$/, "_blurred$1");
}

/**
 * STUB PR-V1 : strip EXIF + watermark. Pour l'instant on retourne
 * juste une URL marquée `_stripped.jpg`.
 */
async function stripExifAndWatermark(
  url: string,
  _opts: { watermark: string },
): Promise<string> {
  // TODO PR-V2 : download URL → Sharp withMetadata({exif:{}}) +
  // composite watermark text → upload Storage → return URL.
  return url.replace(/(\.\w+)?$/, "_stripped$1");
}

export const valueFloutPhotos = task({
  id: "value-flout-photos",
  maxDuration: 600,
  retry: { maxAttempts: 2, minTimeoutInMs: 5_000 },
  run: async (rawPayload: unknown) => {
    const payload = payloadSchema.parse(rawPayload);
    logger.info("value-flout-photos start", payload);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bien, error } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .select("id, photos_originales_urls")
        .eq("id", payload.bien_id)
        .single();
      if (error || !bien) {
        throw new Error(`bien introuvable: ${error?.message}`);
      }
      const photos: string[] = bien.photos_originales_urls ?? [];
      if (photos.length === 0) {
        logger.info("Aucune photo originale — skip");
        return { skipped: true, reason: "no_photos" };
      }

      // Traitement parallèle (max 5 à la fois, géré côté analyzePhotos
      // queue) : detectOutdoor + transformation.
      const results = await Promise.allSettled(
        photos.map(async (url) => {
          const isOutdoor = await detectOutdoor(url);
          if (isOutdoor) {
            return await blurImage(url, { intensity: "strong" });
          }
          return await stripExifAndWatermark(url, {
            watermark: "Pré-vente discrète",
          });
        }),
      );

      // Conserve l'ordre des photos (un échec individuel = on garde
      // l'URL originale pour ne pas casser la galerie). Note : en mode
      // discret c'est suboptimal (photo non floutée affichée) — mais
      // mieux que des trous. Le front peut ré-essayer.
      const floutees: string[] = results.map((r, i) =>
        r.status === "fulfilled" ? r.value : (photos[i] ?? ""),
      );

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        logger.warn(`${failedCount} photo(s) ont échoué au floutage`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .update({ photos_floutees_urls: floutees })
        .eq("id", payload.bien_id);
      if (updErr) {
        throw new Error(`biens update failed: ${updErr.message}`);
      }

      return {
        success: true,
        processed: floutees.length,
        failed: failedCount,
      };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { worker: "value-flout-photos" },
        extra: { bien_id: payload.bien_id },
      });
      throw err;
    }
  },
});
