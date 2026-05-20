// Worker `value-send-alerte-email` — envoie l'email d'alerte au
// propriétaire quand une nouvelle valo dévie de plus de
// `alert_threshold_pct` du précédent snapshot.
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.3.
//
// Déclenché par `value-build-estimation` après chaque nouvelle valo.
// Re-check côté worker que :
//   - l'user n'a pas désactivé les alertes (alert_frequency='never')
//   - le delta dépasse bien le seuil (re-validation, le caller peut
//     se tromper)
//   - on respecte la fréquence (weekly/monthly/quarterly) vs last
//     alert_sent_at

import { ValorisationOutputSchema } from "@immoscan/shared/value";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import {
  buildAlerteValoEmail,
  shouldNotify,
} from "@/services/email-templates/value-alerte";
import { sendEmail } from "@/services/resend";

const payloadSchema = z.object({
  bien_id: z.string().uuid(),
  valo_historique_id: z.string().uuid(),
});

export const valueSendAlerteEmail = task({
  id: "value-send-alerte-email",
  maxDuration: 60,
  retry: { maxAttempts: 3, minTimeoutInMs: 5_000 },
  run: async (rawPayload: unknown) => {
    const payload = payloadSchema.parse(rawPayload);
    logger.info("value-send-alerte-email start", payload);

    try {
      // 1. Lit le bien + la valoHistorique en parallèle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bienP = (supabaseApp as any)
        .schema("value")
        .from("biens")
        .select(
          "id, user_id, address, alert_threshold_pct, alert_frequency, valo_courante",
        )
        .eq("id", payload.bien_id)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const histP = (supabaseApp as any)
        .schema("value")
        .from("valos_historique")
        .select("id, valo, delta_pct, alert_sent, alert_sent_at")
        .eq("id", payload.valo_historique_id)
        .single();

      const [bienRes, histRes] = await Promise.all([bienP, histP]);

      if (bienRes.error || !bienRes.data) {
        throw new Error(
          `bien introuvable: ${payload.bien_id} (${bienRes.error?.message})`,
        );
      }
      if (histRes.error || !histRes.data) {
        throw new Error(
          `valos_historique introuvable: ${payload.valo_historique_id} (${histRes.error?.message})`,
        );
      }
      const bien = bienRes.data;
      const hist = histRes.data;

      if (hist.alert_sent) {
        logger.info("Alert déjà envoyée — skip", {
          valo_historique_id: payload.valo_historique_id,
        });
        return { skipped: true, reason: "already_sent" };
      }

      const deltaPct = Number(hist.delta_pct ?? 0);
      const threshold = Number(bien.alert_threshold_pct ?? 3);

      // 2. Check si on doit notifier selon la fréquence + threshold
      // Pour la fréquence, on doit chercher le dernier alert_sent_at
      // de ce bien (toutes valos_historique confondues).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lastAlerted } = await (supabaseApp as any)
        .schema("value")
        .from("valos_historique")
        .select("alert_sent_at")
        .eq("bien_id", payload.bien_id)
        .eq("alert_sent", true)
        .order("alert_sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastNotifiedAt: string | null = lastAlerted?.alert_sent_at ?? null;

      if (
        !shouldNotify(
          String(bien.alert_frequency ?? "monthly"),
          threshold,
          deltaPct,
          lastNotifiedAt,
        )
      ) {
        logger.info("shouldNotify=false — skip", {
          frequency: bien.alert_frequency,
          threshold,
          deltaPct,
          lastNotifiedAt,
        });
        return { skipped: true, reason: "frequency_not_met" };
      }

      // 3. Récupère l'email du destinataire via auth.users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userData, error: userErr } = await (supabaseApp as any).auth.admin.getUserById(
        bien.user_id,
      );
      if (userErr || !userData?.user?.email) {
        throw new Error(`user email introuvable: ${userErr?.message}`);
      }
      const to = String(userData.user.email);

      // 4. Récupère prénom du propriétaire (profiles)
      const { data: profile } = await supabaseApp
        .from("profiles")
        .select("first_name, full_name")
        .eq("id", bien.user_id)
        .maybeSingle();
      // any: profile peut ne pas avoir first_name selon migrations ; on accepte
      const firstName =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((profile as any)?.first_name as string | null | undefined) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((profile as any)?.full_name as string | null | undefined)?.split(" ")[0] ??
        null;

      // 5. Parse les valos
      const valoCourante = ValorisationOutputSchema.parse(hist.valo);
      const valoPrecedente = bien.valo_courante
        ? ValorisationOutputSchema.safeParse(bien.valo_courante).data ?? null
        : null;

      // 6. Build + envoie l'email
      const { subject, html, text } = buildAlerteValoEmail({
        profileFirstName: firstName,
        bienAddressDisplay: String(bien.address),
        bienId: bien.id,
        delta_pct: deltaPct,
        valoCourante,
        valoPrecedente,
      });

      await sendEmail({ to, subject, html, text, tag: "value_alerte" });

      // 7. Mark alert_sent sur la valoHistorique
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: markErr } = await (supabaseApp as any)
        .schema("value")
        .from("valos_historique")
        .update({ alert_sent: true, alert_sent_at: new Date().toISOString() })
        .eq("id", payload.valo_historique_id);
      if (markErr) {
        logger.warn("markAlertSent failed", { err: markErr.message });
      }

      return { success: true, delta_pct: deltaPct };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { worker: "value-send-alerte-email" },
        extra: { bien_id: payload.bien_id },
      });
      throw err;
    }
  },
});
