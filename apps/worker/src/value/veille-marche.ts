// Worker `value-veille-marche` — cron hebdomadaire (lundi 6h Paris UTC = 5h).
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.2.
//
// Recompute léger (sans Claude) chaque semaine pour détecter les
// variations de marché. Pipeline :
//   - Pour chaque bien actif (suivi, discret, public),
//     recalcule un proxy de valo via les nouveaux comparables DVF + actifs
//     (sans appel Claude, basé sur l'agrégat médian).
//   - Si la variation dépasse alert_threshold_pct, retrigger
//     `value-build-estimation` (qui fera la valo Claude argumentée).
//   - Sinon, on stocke une ligne `valos_historique` light avec
//     trigger='weekly_recompute' pour garder le graphe d'évolution.
//
// Note PR-V1 : sans `dvfComparables` / `activeComparables` branchés
// (cf stubs dans build-estimation.ts), le recompute light retournera
// systématiquement deltaPct=0. Ce worker est donc principalement un
// squelette à recâbler en PR-V2 quand les RPC sont disponibles.

import { logger, schedules, tasks } from "@trigger.dev/sdk";

import { Sentry } from "@/lib/sentry";
import { supabaseApp } from "@/lib/supabase";

const BATCH_SIZE = 50;

interface BienRow {
  id: string;
  status: string;
  valo_courante: { valorisation?: { central?: number } } | null;
  alert_threshold_pct: number;
  alert_frequency: string;
}

/**
 * Stub PR-V1 : retourne null tant que les RPC DVF + actifs ne sont pas
 * branchées. Quand elles le seront, ce helper calcule un prix m² médian
 * pondéré et applique-le à la surface du bien.
 *
 * Le déclencheur de la VRAIE valo Claude reste `value-build-estimation`
 * (cf le block "if (Math.abs(deltaPct) >= threshold)" plus bas). Donc
 * même avec ce stub, le pipeline est correct côté flow.
 */
async function recomputeValoLight(_bien: BienRow): Promise<number | null> {
  // TODO PR-V2 : agrégat médian DVF + actifs autour de la position du bien,
  // pondéré (DVF=0.7, actifs=0.3). Puis prix_m2 × surface.
  return null;
}

function computeDelta(
  previousCentral: number | null | undefined,
  newCentral: number | null,
): number {
  if (!previousCentral || !newCentral) return 0;
  if (previousCentral <= 0) return 0;
  return ((newCentral - previousCentral) / previousCentral) * 100;
}

async function batchProcess<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fn));
    for (const r of results) {
      if (r.status === "fulfilled") processed += 1;
      else errors += 1;
    }
  }
  return { processed, errors };
}

export const valueVeilleMarche = schedules.task({
  id: "value-veille-marche",
  // Lundi 6h Paris (UTC+1 hiver / UTC+2 été). On lance à 5h UTC pour
  // tomber à 6h heure d'hiver, 7h heure d'été. Cron alt: "0 4 * * 1"
  // pour caler en heure d'été — on garde 5h pour la stabilité.
  cron: "0 5 * * 1",
  maxDuration: 3600,
  run: async () => {
    logger.info("value-veille-marche start");

    try {
      // 1. Récupère les biens actifs (status suivi/discret/public).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .select(
          "id, status, valo_courante, alert_threshold_pct, alert_frequency",
        )
        .in("status", ["suivi", "discret", "public"]);

      if (error) {
        throw new Error(`value.biens select failed: ${error.message}`);
      }
      const biens: BienRow[] = (data ?? []) as BienRow[];
      logger.info(`value-veille-marche: ${biens.length} biens à traiter`);

      const stats = await batchProcess(biens, BATCH_SIZE, async (bien) => {
        const previousCentral = bien.valo_courante?.valorisation?.central ?? null;
        const newCentral = await recomputeValoLight(bien);

        const deltaPct = computeDelta(previousCentral, newCentral);
        const threshold = Number(bien.alert_threshold_pct ?? 3);

        if (newCentral !== null && Math.abs(deltaPct) >= threshold) {
          // Variation significative : on lance la vraie valo Claude.
          await tasks.trigger("value-build-estimation", {
            bien_id: bien.id,
            trigger: "weekly_recompute",
          });
        } else {
          // Pas de variation : on enregistre quand même un point
          // historique léger pour le graphe (mais sans alert).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseApp as any)
            .schema("value")
            .from("valos_historique")
            .insert({
              bien_id: bien.id,
              valo:
                newCentral !== null
                  ? {
                      valorisation: { central: newCentral },
                      light: true,
                    }
                  : bien.valo_courante ?? { light: true },
              delta_pct: deltaPct,
              trigger: "weekly_recompute",
            });
        }
      });

      logger.info("value-veille-marche done", stats);
      return { ...stats, total: biens.length };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { worker: "value-veille-marche" },
      });
      throw err;
    }
  },
});
