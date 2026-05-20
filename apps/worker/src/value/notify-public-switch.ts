// Worker `value-notify-public-switch` — déclenché quand un bien
// passe en vente publique (action propriétaire + paywall payé).
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.5.
//
// Pipeline :
//   1. Récupère les favoris en mode 'discret' du bien (acheteurs qui
//      l'avaient mis en favori avant la mise en vente publique)
//   2. Trie par ancienneté (added_at ASC) pour le narrative "tu es Xe"
//   3. Envoie un mail à chacun avec son rang dans la file
//   4. Cross-sell : déclenche les veilles ImmoScan correspondantes
//      (un acheteur intéressé par ce bien aura sûrement envie d'être
//      alerté sur des biens similaires)
//
// Le mail n'est PAS envoyé aux favoris qui ont notify_on_public=false.

import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import {
  buildBasculementPublicEmail,
  humanizeFavoriAge,
} from "@/services/email-templates/value-basculement";
import { sendEmail } from "@/services/resend";

const payloadSchema = z.object({
  bien_id: z.string().uuid(),
});

interface FavoriRow {
  id: string;
  user_id: string;
  added_at: string;
  notify_on_public: boolean;
}

/**
 * Cross-sell ImmoScan : déclenche la création de veilles côté
 * propriétaire ImmoScan pour cet utilisateur sur la base des attributs
 * du bien (code_postal, prix, typologie).
 *
 * Stub PR-V1 : log only. La création réelle de veille passera par un
 * worker `value-trigger-immoscan-alertes` à créer dans une PR ultérieure
 * (cf §5.5 in fine — pas spécifié en détail dans la spec).
 */
async function triggerImmoScanAlertes(bienId: string): Promise<void> {
  // TODO PR-V2 cross-sell ImmoScan
  logger.info("[stub] triggerImmoScanAlertes", { bienId });
}

export const valueNotifyPublicSwitch = task({
  id: "value-notify-public-switch",
  maxDuration: 300,
  retry: { maxAttempts: 2, minTimeoutInMs: 5_000 },
  run: async (rawPayload: unknown) => {
    const payload = payloadSchema.parse(rawPayload);
    logger.info("value-notify-public-switch start", payload);

    try {
      // 1. Récupère le bien
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bien, error: bienErr } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .select("id, address, status, prix_affiche, bien_data")
        .eq("id", payload.bien_id)
        .single();
      if (bienErr || !bien) {
        throw new Error(`bien introuvable: ${bienErr?.message}`);
      }
      if (bien.status !== "public") {
        logger.warn("Bien pas en status public — skip", {
          status: bien.status,
        });
        return { skipped: true, reason: "not_public_status" };
      }

      // 2. Récupère les favoris notify_on_public=true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: favRows, error: favErr } = await (supabaseApp as any)
        .schema("value")
        .from("favoris")
        .select("id, user_id, added_at, notify_on_public")
        .eq("bien_id", payload.bien_id)
        .eq("notify_on_public", true)
        .order("added_at", { ascending: true });

      if (favErr) {
        throw new Error(`favoris fetch failed: ${favErr.message}`);
      }
      const favoris: FavoriRow[] = (favRows ?? []) as FavoriRow[];
      logger.info(`${favoris.length} favoris à notifier`);

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      // 3. Pour chaque favori, envoie l'email avec son rang
      for (const [index, favori] of favoris.entries()) {
        try {
          if (!favori.notify_on_public) {
            skipped += 1;
            continue;
          }

          // Récupère email + first_name
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: userData } = await (supabaseApp as any).auth.admin.getUserById(
            favori.user_id,
          );
          if (!userData?.user?.email) {
            logger.warn("user sans email — skip", { favori_id: favori.id });
            skipped += 1;
            continue;
          }

          const { data: profile } = await supabaseApp
            .from("profiles")
            .select("first_name, full_name")
            .eq("id", favori.user_id)
            .maybeSingle();
          const firstName =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((profile as any)?.first_name as string | null | undefined) ??
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((profile as any)?.full_name as string | null | undefined)?.split(" ")[0] ??
            null;

          const { subject, html, text } = buildBasculementPublicEmail({
            profileFirstName: firstName,
            bienAddressDisplay: String(bien.address),
            bienId: bien.id,
            bienSlug: null,
            prixAffiche:
              bien.prix_affiche !== null && bien.prix_affiche !== undefined
                ? Number(bien.prix_affiche)
                : null,
            rangFile: index + 1,
            totalFile: favoris.length,
            ancienneteFavoriHumain: humanizeFavoriAge(favori.added_at),
          });

          await sendEmail({
            to: String(userData.user.email),
            subject,
            html,
            text,
            tag: "value_basculement_public",
          });

          // Mark notified
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseApp as any)
            .schema("value")
            .from("favoris")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", favori.id);
          sent += 1;
        } catch (e) {
          failed += 1;
          Sentry.captureException(e, {
            tags: { worker: "value-notify-public-switch", step: "send" },
            extra: { bien_id: payload.bien_id, favori_id: favori.id },
          });
          logger.warn("notify favori failed", {
            favori_id: favori.id,
            err: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // 4. Cross-sell ImmoScan : déclenche les veilles correspondantes
      await triggerImmoScanAlertes(payload.bien_id);

      logger.info("value-notify-public-switch done", { sent, skipped, failed });
      return { sent, skipped, failed, total: favoris.length };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { worker: "value-notify-public-switch" },
        extra: { bien_id: payload.bien_id },
      });
      throw err;
    }
  },
});
