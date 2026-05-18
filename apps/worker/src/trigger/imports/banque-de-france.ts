// Import Banque de France — taux moyens crédits immobiliers mensuels.
//
// Source : https://www.banque-france.fr/statistiques/credit/credit/credit-aux-particuliers
//          (publication PDF/Excel mensuelle) ou API Webstat
//          (https://webstat.banque-france.fr/) qui expose les séries
//          via SDMX-JSON.
//
// Stratégie : le format BdF varie (PDF parsé, ou SDMX, ou CSV manuel).
// Cette task est un squelette qui prend en payload les couples
// {duree_ans, taux_pct} et les UPSERT. L'extraction depuis la source
// brute (PDF/Webstat) reste manuelle ou via un script séparé jusqu'à
// stabilisation d'une API stable.

import { schedules, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { withImportRun } from "@/lib/import-runs";
import { supabaseData } from "@/lib/supabase";

const payloadSchema = z.object({
  datePublication: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z
    .array(
      z.object({
        dureeAns: z.number().int().min(5).max(30),
        tauxPct: z.number().min(0).max(20),
      }),
    )
    .min(1),
});

export const banqueDeFranceImport = task({
  id: "imports.banque_de_france",
  maxDuration: 60,
  run: async (payload: unknown) => {
    const { datePublication, rates } = payloadSchema.parse(payload);

    return withImportRun("banque_de_france", async ({ log }) => {
      log("BdF rates upsert", { datePublication, count: rates.length });

      const rows = rates.map((r) => ({
        date_publication: datePublication,
        duree_ans: r.dureeAns,
        taux_moyen_pct: r.tauxPct,
        source: "banque_de_france" as const,
      }));

      const { error } = await supabaseData
        .from("credit_rates_history")
        .upsert(rows, {
          onConflict: "date_publication,duree_ans,source",
          ignoreDuplicates: false,
        });
      if (error) throw error;

      return {
        rowsImported: rates.length,
        metadata: { datePublication },
      };
    });
  },
});

// Placeholder cron : reminder mensuel. Le payload réel doit être saisi
// à la main ou via un parser PDF/Webstat dédié (à coder quand la source
// stabilisée sera identifiée).
export const banqueDeFranceReminder = schedules.task({
  id: "imports.banque_de_france.reminder",
  cron: "0 9 5 * *", // le 5 du mois à 9h UTC
  run: async () => {
    console.warn(
      "[BdF reminder] Penser à récupérer les taux mensuels Banque de France " +
        "et déclencher imports.banque_de_france avec le payload typé.",
    );
  },
});
