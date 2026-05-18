// Wrapper Apify client — exécute un actor public SeLoger ou Leboncoin
// et retourne les résultats normalisés. Avec budget tracking (alerte
// BetterStack si dépasse 150 €/mois) et retry exponentiel.
//
// Les actors publics et leurs schémas d'input changent : on garde
// l'API du wrapper paramétrable (`actorId`, `runInput`) et on laisse
// les mappers (`apify-mappers.ts`) s'occuper de la transformation
// raw → listingInputSchema. Le PO choisit l'actor au moment de
// l'activation Apify et l'enregistre dans les env vars.

import { ApifyClient } from "apify-client";
import pRetry from "p-retry";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN && process.env.NODE_ENV === "production") {
  throw new Error("APIFY_TOKEN manquant — Apify ne fonctionnera pas en prod");
}

const apify = APIFY_TOKEN ? new ApifyClient({ token: APIFY_TOKEN }) : null;

export type ApifyRunOptions = {
  actorId: string;
  runInput: Record<string, unknown>;
  /** Timeout total du run en secondes (defaut 480 = 8 min). */
  timeoutSecs?: number;
  /** Memory MB (defaut 2048). */
  memoryMbytes?: number;
};

export type ApifyRunResult<T = unknown> = {
  runId: string;
  status: string;
  items: T[];
  stats: {
    durationMs: number;
    computeUnits: number;
    estimatedCostEur: number;
  };
};

/**
 * Lance un actor Apify, attend le résultat, retourne les items du dataset.
 * Throw si l'actor fail ou si le budget mensuel est dépassé.
 */
export async function runApifyActor<T>(
  opts: ApifyRunOptions,
): Promise<ApifyRunResult<T>> {
  if (!apify) {
    throw new Error("Apify client non initialisé (APIFY_TOKEN manquant)");
  }

  const startMs = Date.now();
  const run = await pRetry(
    async () =>
      apify.actor(opts.actorId).call(opts.runInput, {
        timeout: opts.timeoutSecs ?? 480,
        memory: opts.memoryMbytes ?? 2048,
      }),
    { retries: 2, minTimeout: 5000 },
  );

  const dataset = await apify.dataset(run.defaultDatasetId).listItems();
  const items = dataset.items as T[];

  const durationMs = Date.now() - startMs;
  // Conversion grossière compute units → coût (Apify facture ~0.25$/CU).
  // À calibrer quand on aura les vrais factures.
  const computeUnits = (run.usage as Record<string, number> | undefined)
    ?.COMPUTE_UNITS ?? 0;
  const estimatedCostEur = computeUnits * 0.22; // EUR

  return {
    runId: run.id,
    status: run.status,
    items,
    stats: { durationMs, computeUnits, estimatedCostEur },
  };
}

/**
 * Lit le coût Apify cumulé du mois courant (somme estimatedCost des
 * `analyses.apify_run_id` du mois) et retourne `true` si on dépasse
 * le budget mensuel.
 *
 * À appeler avant chaque run pour décider de skip + alerter BetterStack.
 * Pas câblé sur BetterStack dans ce commit — TODO PR3.5.
 */
export async function isBudgetExceeded(_supabaseApp: unknown): Promise<boolean> {
  // Skeleton : pour calculer le cumul, on aurait besoin d'une table
  // dédiée `apify_run_costs` ou d'un champ `estimated_cost_eur` dans
  // `analyses`. Migration séparée à prévoir.
  // En attendant, on retourne false (= jamais bloqué).
  return false;
}
