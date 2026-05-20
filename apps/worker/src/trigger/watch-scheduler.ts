// Crons Trigger.dev qui dispatchent les watch-scout :
//   - `watch-scheduler-standard` : lun/mer/ven 7h UTC pour Free/Pro/Pro+
//   - `watch-scheduler-business` : daily 7h UTC pour Business uniquement
//
// Pattern : pour chaque watch active retournée par la RPC SQL
// `watches_to_dispatch(p_schedule)`, déclenche la task `watch-scout`
// avec `batchTrigger` (50 par appel pour éviter le timeout).
//
// La RPC filtre déjà les watches qui ont une run pending/running en cours
// (idempotence), donc on peut spammer le cron sans risque de doublon.

import { logger, schedules } from "@trigger.dev/sdk";

import { supabaseApp } from "@/lib/supabase";

import { watchScoutTask } from "@/trigger/watch-scout";

const BATCH_SIZE = 50;

async function dispatchSchedule(schedule: "standard" | "business") {
  const { data: watches, error } = await supabaseApp.rpc("watches_to_dispatch", {
    p_schedule: schedule,
  });
  if (error) {
    throw new Error(`watches_to_dispatch failed: ${error.message}`);
  }
  const items = (watches ?? []) as Array<{
    watch_id: string;
    profile_id: string;
    plan: string;
  }>;
  logger.info(`Dispatching ${items.length} watches`, { schedule });

  let dispatched = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await watchScoutTask.batchTrigger(
      batch.map((it) => ({
        payload: { watchId: it.watch_id },
        options: {
          tags: [`watch:${it.watch_id}`, `plan:${it.plan}`, `schedule:${schedule}`],
          idempotencyKey: `watch-scout-${it.watch_id}-${new Date().toISOString().slice(0, 10)}`,
        },
      })),
    );
    dispatched += batch.length;
  }
  return { schedule, dispatched, total: items.length };
}

export const watchSchedulerStandard = schedules.task({
  id: "watch-scheduler-standard",
  // 7h UTC = 8h Paris (heure d'hiver) / 9h (été). On envoie le digest 1h
  // après, soit à 8h UTC. Cron lun/mer/ven.
  cron: "0 7 * * 1,3,5",
  maxDuration: 300,
  run: async () => dispatchSchedule("standard"),
});

export const watchSchedulerBusiness = schedules.task({
  id: "watch-scheduler-business",
  cron: "0 7 * * *",
  maxDuration: 300,
  run: async () => dispatchSchedule("business"),
});
