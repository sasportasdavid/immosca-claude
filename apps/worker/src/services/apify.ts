// Wrapper Apify avec fetch HTTP direct vers l'API REST v2.
//
// On utilisait `apify-client` (npm) mais il crashe sur Node 21 (Trigger.dev
// runtime) avec "ProxyAgent is not a constructor" — bug undici/ESM dans
// le bundler. Le passer en `additionalPackages` n'a pas suffi.
//
// L'API REST Apify est stable et simple. On fait :
//   1. POST /v2/acts/{actorId}/runs → lance le run (renvoie runId, datasetId)
//   2. Poll GET /v2/actor-runs/{runId} jusqu'à SUCCEEDED/FAILED
//   3. GET /v2/datasets/{datasetId}/items → récupère les items scrapés
//
// Doc : https://docs.apify.com/api/v2

import pRetry from "p-retry";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_BASE = "https://api.apify.com/v2";

export type ApifyRunOptions = {
  /** Format `username/actor-name` (slash) ou `username~actor-name` (tilde). */
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

type RunMeta = {
  data: {
    id: string;
    status: "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ABORTED" | "TIMING-OUT" | "TIMED-OUT";
    defaultDatasetId: string;
    usage?: { COMPUTE_UNITS?: number };
  };
};

function normalizeActorId(id: string): string {
  // L'API accepte `user~actor` dans l'URL (le `/` doit être encodé sinon).
  return id.replace("/", "~");
}

async function apifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!APIFY_TOKEN) throw new Error("APIFY_TOKEN manquant");
  const res = await fetch(`${APIFY_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${APIFY_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify API ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Lance un actor Apify, attend la fin, retourne les items du dataset.
 * Throw si l'actor fail ou si le run timeout côté worker.
 */
export async function runApifyActor<T>(
  opts: ApifyRunOptions,
): Promise<ApifyRunResult<T>> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_TOKEN manquant — Apify ne fonctionnera pas");
  }

  const startMs = Date.now();
  const actorId = normalizeActorId(opts.actorId);
  const timeoutSecs = opts.timeoutSecs ?? 480;
  const memoryMbytes = opts.memoryMbytes ?? 2048;

  // 1. Démarrage du run (avec retry sur erreurs réseau transitoires)
  const startRes = await pRetry(
    () =>
      apifyFetch<RunMeta>(
        `/acts/${actorId}/runs?timeout=${timeoutSecs}&memory=${memoryMbytes}`,
        {
          method: "POST",
          body: JSON.stringify(opts.runInput),
        },
      ),
    { retries: 2, minTimeout: 5_000 },
  );
  const runId = startRes.data.id;

  // 2. Poll status jusqu'à terminaison
  const deadline = Date.now() + timeoutSecs * 1000 + 30_000; // marge 30s
  let runMeta: RunMeta = startRes;
  while (runMeta.data.status === "READY" || runMeta.data.status === "RUNNING") {
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${runId} timeout côté worker après ${timeoutSecs}s`);
    }
    await new Promise((r) => setTimeout(r, 5_000));
    runMeta = await apifyFetch<RunMeta>(`/actor-runs/${runId}`);
  }

  if (runMeta.data.status !== "SUCCEEDED") {
    throw new Error(
      `Apify run ${runId} terminé en status=${runMeta.data.status}`,
    );
  }

  // 3. Récupère les items du dataset par défaut
  const items = await apifyFetch<T[]>(
    `/datasets/${runMeta.data.defaultDatasetId}/items?clean=true&format=json`,
  );

  const computeUnits = runMeta.data.usage?.COMPUTE_UNITS ?? 0;
  // Conversion grossière (Apify facture ~0.25$/CU, ~0.22€). À calibrer.
  const estimatedCostEur = computeUnits * 0.22;

  return {
    runId,
    status: runMeta.data.status,
    items,
    stats: {
      durationMs: Date.now() - startMs,
      computeUnits,
      estimatedCostEur,
    },
  };
}

/**
 * Récupère les items d'un run Apify déjà terminé (sans relancer un run).
 * Utilisé pour rejouer une analyse à partir d'un cache, ou pour tester
 * le pipeline en dev sans consommer de budget / contourner les rate
 * limits des actors free tier.
 *
 * Throw si le run n'a pas SUCCEEDED ou n'existe pas.
 */
export async function fetchApifyRunResult<T>(
  runId: string,
): Promise<ApifyRunResult<T>> {
  const startMs = Date.now();
  const runMeta = await apifyFetch<RunMeta>(`/actor-runs/${runId}`);
  if (runMeta.data.status !== "SUCCEEDED") {
    throw new Error(
      `Apify run ${runId} status=${runMeta.data.status} (attendu SUCCEEDED)`,
    );
  }
  const items = await apifyFetch<T[]>(
    `/datasets/${runMeta.data.defaultDatasetId}/items?clean=true&format=json`,
  );
  const computeUnits = runMeta.data.usage?.COMPUTE_UNITS ?? 0;
  return {
    runId,
    status: runMeta.data.status,
    items,
    stats: {
      durationMs: Date.now() - startMs,
      computeUnits,
      estimatedCostEur: 0, // re-run d'un cache : pas de coût additionnel
    },
  };
}

/**
 * Construit l'input JSON à passer à un actor selon ses conventions.
 *
 * Chaque actor Apify a son propre schema d'input. On dispatch ici sur
 * l'actorId connu. Si tu changes d'actor, ajoute un case ici.
 * Si on ne reconnaît pas l'actor, on tombe sur le format Apify "standard"
 * (`startUrls` array) — ça marche pour la plupart des scrapers
 * communautaires basés sur le SDK Apify officiel.
 */
export function buildApifyRunInput(
  actorId: string,
  sourceUrl: string,
): Record<string, unknown> {
  const id = actorId.toLowerCase();

  // azzouzana/* : `startUrl` (string singulier) + `maxItems`
  if (id.includes("azzouzana")) {
    return { startUrl: sourceUrl, maxItems: 1000 };
  }

  // Format standard Apify (la plupart des scrapers communautaires)
  return {
    startUrls: [{ url: sourceUrl }],
    maxItems: 1000,
  };
}

/**
 * Skeleton : on retourne false en attendant une table `apify_run_costs`
 * pour calculer le cumul mensuel. À câbler avec BetterStack en PR3.5.
 */
export async function isBudgetExceeded(_supabaseApp: unknown): Promise<boolean> {
  return false;
}
