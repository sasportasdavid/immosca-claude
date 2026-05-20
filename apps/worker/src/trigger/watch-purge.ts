// Cron `watch-purge` : daily 3h UTC.
// - Purge les watch_listings > 6 mois non pipeline (RPC purge_watch_listings)
// - Suspend les watches expirées Free/PPU (RPC suspend_expired_watches)
//
// Source : module-veille-immoscan.md §9.2

import { logger, schedules } from "@trigger.dev/sdk";

import { supabaseApp } from "@/lib/supabase";

export const watchPurgeTask = schedules.task({
  id: "watch-purge",
  cron: "0 3 * * *",
  maxDuration: 300,
  run: async () => {
    const { data: purged, error: pErr } = await supabaseApp.rpc("purge_watch_listings");
    if (pErr) throw new Error(`purge_watch_listings: ${pErr.message}`);

    const { data: suspended, error: sErr } = await supabaseApp.rpc(
      "suspend_expired_watches",
    );
    if (sErr) throw new Error(`suspend_expired_watches: ${sErr.message}`);

    logger.info("Watch purge done", { purged, suspended });
    return { purgedListings: purged, suspendedWatches: suspended };
  },
});
