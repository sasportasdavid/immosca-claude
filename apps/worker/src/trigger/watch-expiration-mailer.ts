// Cron `watch-expiration-mailer` — daily 9h UTC.
//
// Pour chaque watch avec expires_at IS NOT NULL :
//   - Calcule days_until_expiration (peut être négatif si déjà expiré)
//   - Distingue Free vs PPU via entitlements `ppu_watch_bonus`
//   - Détermine le milestone (J-10/J-3/J0 Free, J-7/J-2/J0 PPU)
//   - Skip si milestone déjà notifié (expiration_emails_sent)
//   - Envoie via Resend (template approprié)
//   - Append milestone à expiration_emails_sent
//
// Idempotence : 2 runs le même jour ne renvoient pas le même email.
//
// Synchro avec watch-purge :
//   - watch-purge tourne à 3h UTC et set suspended_at + is_active=false
//     pour les watches expirées.
//   - watch-expiration-mailer tourne à 9h UTC (6h après purge), donc à J0
//     la veille est déjà suspendue → le mail "suspended" arrive avec
//     suspended_at déjà à `now() - 6h`.

import { logger, schedules } from "@trigger.dev/sdk";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";
import {
  buildFreeExpirationWarnEmail,
  buildPpuExpirationWarnEmail,
  buildSuspendedEmail,
  resolveMilestone,
  type ExpirationMilestone,
} from "@/services/email-templates/expiration";
import { sendEmail } from "@/services/resend";

export const watchExpirationMailerTask = schedules.task({
  id: "watch-expiration-mailer",
  // 9h UTC = 10h Paris hiver, 11h été. 1h après le digest (8h UTC) pour
  // ne pas overlap, et 6h après watch-purge (3h UTC) qui aura déjà
  // suspendu les watches expirées à J0.
  cron: "0 9 * * *",
  maxDuration: 300,
  run: async () => {
    // 1. Récupère toutes les watches avec expires_at not null (Free + PPU).
    //    Inclut les suspendues (pour envoyer le mail J0 après purge).
    const { data: watches, error } = await supabaseApp
      .from("watches")
      .select(
        "id, name, profile_id, expires_at, suspended_at, expiration_emails_sent, profile:profiles!inner(id, email, full_name, subscription_plan)",
      )
      .not("expires_at", "is", null);
    if (error) throw new Error(`watches query failed: ${error.message}`);
    if (!watches?.length) return { sent: 0, skipped: 0, total: 0 };

    // 2. Pour chaque watch, détermine origin (free/ppu) via entitlements
    //    On batch-charge les entitlements ppu_watch_bonus actifs pour
    //    tous les profile_id concernés.
    const profileIds = [...new Set(watches.map((w) => w.profile_id))];
    const { data: ppuEnts } = await supabaseApp
      .from("entitlements")
      .select("profile_id, expires_at, granted_at")
      .in("profile_id", profileIds)
      .eq("type", "ppu_watch_bonus")
      .in("status", ["pending", "active"]);
    const ppuByProfile = new Map<string, true>();
    for (const e of ppuEnts ?? []) {
      ppuByProfile.set(e.profile_id, true);
    }

    let sent = 0;
    let skipped = 0;
    const now = Date.now();

    for (const w of watches) {
      try {
        if (!w.expires_at) continue;
        const expiresMs = new Date(w.expires_at).getTime();
        const daysLeft = Math.floor((expiresMs - now) / (24 * 3600 * 1000));

        // Origin : si user a un entitlement ppu_watch_bonus actif → PPU.
        // Sinon → Free.
        const profile = (w as unknown as {
          profile: {
            id: string;
            email: string;
            full_name: string | null;
            subscription_plan: string;
          };
        }).profile;
        const origin: "free" | "ppu" = ppuByProfile.has(profile.id) ? "ppu" : "free";

        // Si le user est passé Pro entre temps, l'expires_at devrait avoir
        // été nullifié par le webhook Stripe (TODO PR-B câbler ça).
        // Garde-fou : skip si plan != free et pas de ppu_watch_bonus.
        if (profile.subscription_plan !== "free" && origin === "free") {
          // Le user a upgrade : on nullifie expires_at proactivement et on skip.
          await supabaseApp.from("watches").update({ expires_at: null }).eq("id", w.id);
          skipped++;
          continue;
        }

        const milestone = resolveMilestone(daysLeft, origin);
        if (!milestone) {
          skipped++;
          continue;
        }

        const alreadySent = (w.expiration_emails_sent ?? []).includes(milestone);
        if (alreadySent) {
          skipped++;
          continue;
        }

        const firstName = profile.full_name?.split(" ")[0] ?? null;

        // Récupère le total opportunités (count des watch_listings tous statuts)
        const { count: totalOpps } = await supabaseApp
          .from("watch_listings")
          .select("id", { count: "exact", head: true })
          .eq("watch_id", w.id);

        // Pour Free : count des biens score >= 70 floutés
        let maskedHighScoreCount = 0;
        if (origin === "free") {
          const { count } = await supabaseApp
            .from("watch_listings")
            .select("id", { count: "exact", head: true })
            .eq("watch_id", w.id)
            .gte("current_score", 70);
          maskedHighScoreCount = count ?? 0;
        }

        // Build le bon template
        let mailPayload: { subject: string; html: string; text: string };
        if (milestone === "free_warn_J10" || milestone === "free_warn_J3") {
          mailPayload = buildFreeExpirationWarnEmail({
            profileFirstName: firstName,
            watchName: w.name,
            daysLeft: Math.max(0, daysLeft),
            totalOpportunities: totalOpps ?? 0,
            maskedHighScoreCount,
          });
        } else if (milestone === "ppu_warn_J7" || milestone === "ppu_warn_J2") {
          mailPayload = buildPpuExpirationWarnEmail({
            profileFirstName: firstName,
            watchName: w.name,
            daysLeft: Math.max(0, daysLeft),
            totalOpportunities: totalOpps ?? 0,
          });
        } else {
          // *_suspended_J0
          mailPayload = buildSuspendedEmail({
            profileFirstName: firstName,
            watchName: w.name,
            origin,
          });
        }

        await sendEmail({
          to: profile.email,
          subject: mailPayload.subject,
          html: mailPayload.html,
          text: mailPayload.text,
          tag: `expiration-${milestone}`,
        });

        // Append milestone (idempotence)
        await supabaseApp
          .from("watches")
          .update({
            expiration_emails_sent: [...(w.expiration_emails_sent ?? []), milestone],
          })
          .eq("id", w.id);

        sent++;
        logger.info("Expiration mail sent", {
          watch_id: w.id.slice(0, 8),
          origin,
          milestone,
          days_left: daysLeft,
        });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { context: "watch-expiration-mailer", watch_id: w.id },
        });
      }
    }

    return { sent, skipped, total: watches.length };
  },
});

export type { ExpirationMilestone };
