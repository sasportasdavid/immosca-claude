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
  /**
   * Callback appelée dès que le runId est connu (juste après la création
   * du run Apify, avant le polling). Utilisée par `analyze.ts` pour
   * persister l'id en base — ainsi le edge fn `cancel-analysis` peut
   * appeler `abortApifyRun` même si le run est encore en cours.
   */
  onStart?: (runId: string) => Promise<void> | void;
  /**
   * Callback async appelée à chaque tick de polling (toutes les 5s).
   * Si elle retourne `true`, on abort le run côté Apify et on throw
   * `ApifyRunCanceledError`. Permet à l'user d'arrêter immédiatement
   * un scraping en cours sans payer le crédit complet.
   */
  shouldAbort?: () => Promise<boolean> | boolean;
};

/**
 * Erreur levée quand `shouldAbort()` a renvoyé true pendant le polling.
 * `analyze.ts` la catch et termine proprement (status=canceled).
 */
export class ApifyRunCanceledError extends Error {
  readonly runId: string;
  constructor(runId: string) {
    super(`Apify run ${runId} aborted (cancel par user)`);
    this.name = "ApifyRunCanceledError";
    this.runId = runId;
  }
}

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

  // Notifie le caller du runId (pour persistance en base avant polling).
  // On swallow toute erreur — c'est un side-channel, pas critique.
  if (opts.onStart) {
    try {
      await opts.onStart(runId);
    } catch (e) {
      console.warn(`onStart callback failed for run ${runId}:`, e);
    }
  }

  // 2. Poll status jusqu'à terminaison
  const deadline = Date.now() + timeoutSecs * 1000 + 30_000; // marge 30s
  let runMeta: RunMeta = startRes;
  while (runMeta.data.status === "READY" || runMeta.data.status === "RUNNING") {
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${runId} timeout côté worker après ${timeoutSecs}s`);
    }
    // Check cancellation avant de dormir, pour répondre vite.
    if (opts.shouldAbort) {
      try {
        const cancel = await opts.shouldAbort();
        if (cancel) {
          // Abort côté Apify pour stopper la facturation immédiatement,
          // puis throw pour que le caller termine proprement.
          await abortApifyRun(runId);
          throw new ApifyRunCanceledError(runId);
        }
      } catch (e) {
        // Si shouldAbort throw, on log mais on continue. Si c'est notre
        // ApifyRunCanceledError, on la re-throw.
        if (e instanceof ApifyRunCanceledError) throw e;
        console.warn(`shouldAbort check failed for run ${runId}:`, e);
      }
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
 * Annule un run Apify en cours via l'endpoint POST /actor-runs/{id}/abort.
 * Idempotent : 200 si abort accepté, 404/410 si run déjà terminal. On
 * tolère tous les codes "déjà fini" car notre objectif est juste de
 * stopper la facturation.
 *
 * Utilisé par :
 *  - le polling de `runApifyActor` quand `shouldAbort()` renvoie true
 *  - le edge fn `cancel-analysis` quand l'user click "Arrêter"
 */
export async function abortApifyRun(runId: string): Promise<boolean> {
  if (!APIFY_TOKEN) return false;
  try {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}/abort`, {
      method: "POST",
      headers: { Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    // 200 = abort OK
    // 400 = déjà ABORTED/TIMED-OUT/etc (state inválido pour abort)
    // 404 = inconnu (ou pas accessible avec ce token)
    return res.ok || res.status === 400 || res.status === 404;
  } catch (err) {
    console.warn(`abortApifyRun(${runId}) failed:`, err);
    return false;
  }
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
 * Filtres "multi-source" pour l'actor `dltik/pige-immo-fr-scraper`.
 * Format JSON propre à cet actor (cities/postalCodes/propertyTypes/...).
 *
 * Cet actor scrape LBC + SeLoger + PAP + Bien'ici + Logic-immo en un
 * seul run avec déduplication. Coût $0.005/listing + $0.005 enrichDpe.
 */
export type PigeImmoFilters = {
  cities?: string[];
  postalCodes?: string[];
  departments?: string[];
  transaction?: "buy" | "rent";
  propertyTypes?: Array<"appartement" | "maison" | "terrain" | "immeuble">;
  priceMin?: number;
  priceMax?: number;
  surfaceMin?: number;
  surfaceMax?: number;
  roomsMin?: number;
  roomsMax?: number;
  bedroomsMin?: number;
  onlyOwner?: boolean;
  newOnly?: boolean;
  onlyWithPhotos?: boolean;
  enrichDpe?: boolean;
  dedupAcrossSources?: boolean;
  maxResultsPerSource?: number;
  sources?: Array<"leboncoin" | "seloger" | "pap" | "bienici" | "logic-immo">;
};

export function buildPigeImmoRunInput(
  filters: PigeImmoFilters,
): Record<string, unknown> {
  // Defaults raisonnables si l'appelant ne les fournit pas.
  return {
    transaction: filters.transaction ?? "buy",
    propertyTypes: filters.propertyTypes ?? ["appartement", "maison"],
    cities: filters.cities ?? [],
    postalCodes: filters.postalCodes ?? [],
    departments: filters.departments ?? [],
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    surfaceMin: filters.surfaceMin,
    surfaceMax: filters.surfaceMax,
    roomsMin: filters.roomsMin,
    roomsMax: filters.roomsMax,
    bedroomsMin: filters.bedroomsMin,
    onlyOwner: filters.onlyOwner ?? false,
    newOnly: filters.newOnly ?? false,
    onlyWithPhotos: filters.onlyWithPhotos ?? false,
    enrichDpe: filters.enrichDpe ?? true,
    dedupAcrossSources: filters.dedupAcrossSources ?? true,
    maxResultsPerSource: filters.maxResultsPerSource ?? 200,
    sources: filters.sources ?? ["leboncoin", "seloger", "pap", "bienici"],
  };
}

/**
 * Tente d'extraire des filtres Pige Immo depuis une URL SeLoger.
 * Best-effort — si certains champs ne matchent pas, on les laisse
 * undefined (l'actor utilise alors ses defaults).
 *
 * On fallback sur ville/CP fournis en argument si l'URL ne les contient
 * pas (typiquement issu de la table `analyses.ville` / `code_postal`).
 */
export function selogerUrlToPigeImmoFilters(
  url: string,
  fallback?: { ville?: string | null; codePostal?: string | null },
): PigeImmoFilters {
  const filters: PigeImmoFilters = {};
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    if (fallback?.ville) filters.cities = [fallback.ville];
    if (fallback?.codePostal) filters.postalCodes = [fallback.codePostal];
    return filters;
  }
  const params = parsed.searchParams;

  // distributionTypes / projects
  const dist = params.get("distributionTypes") ?? params.get("projects");
  if (dist && /buy/i.test(dist) && !/rent/i.test(dist)) {
    filters.transaction = "buy";
  } else if (dist && /rent/i.test(dist)) {
    filters.transaction = "rent";
  }

  // types / estateTypes
  const types = params.get("types");
  const estateTypes = params.get("estateTypes");
  const list: PigeImmoFilters["propertyTypes"] = [];
  if (estateTypes) {
    if (/apartment/i.test(estateTypes)) list.push("appartement");
    if (/house/i.test(estateTypes)) list.push("maison");
    if (/land/i.test(estateTypes)) list.push("terrain");
    if (/building/i.test(estateTypes)) list.push("immeuble");
  } else if (types) {
    // SeLoger : 1=appart, 2=maison, 3=terrain, 5=immeuble
    types.split(",").forEach((t) => {
      const c = t.trim();
      if (c === "1") list.push("appartement");
      else if (c === "2") list.push("maison");
      else if (c === "3") list.push("terrain");
      else if (c === "5") list.push("immeuble");
    });
  }
  if (list.length > 0) filters.propertyTypes = list;

  // places=[{cp:93220}] ou [{ci:930032}]
  const places = params.get("places");
  if (places) {
    const cps = [...places.matchAll(/cp:(\d{4,5})/g)]
      .map((m) => m[1])
      .filter((v): v is string => !!v);
    if (cps.length > 0) filters.postalCodes = cps;
  }

  // price=NaN/200000 ou priceMax
  const price = params.get("price");
  const priceMax = params.get("priceMax");
  const priceMin = params.get("priceMin");
  if (price) {
    const m = price.match(/(\w+)\/(\w+)/);
    if (m) {
      if (m[1] !== "NaN") filters.priceMin = Number(m[1]);
      if (m[2] !== "NaN") filters.priceMax = Number(m[2]);
    }
  }
  if (priceMax) filters.priceMax = Number(priceMax);
  if (priceMin) filters.priceMin = Number(priceMin);

  // Fallback ville/CP depuis le contexte si l'URL ne les contient pas
  if (!filters.postalCodes?.length && fallback?.codePostal) {
    filters.postalCodes = [fallback.codePostal];
  }
  if (!filters.cities?.length && fallback?.ville) {
    filters.cities = [fallback.ville];
  }

  return filters;
}

/**
 * Détecte le site d'une URL de recherche immobilière.
 * Retourne le nom du site (= source_site) ou null si non reconnu.
 */
export function detectSiteFromUrl(
  url: string,
): "seloger" | "leboncoin" | "pap" | "bienici" | "logic-immo" | null {
  if (/seloger\.com/i.test(url)) return "seloger";
  if (/leboncoin\.fr/i.test(url)) return "leboncoin";
  if (/pap\.fr/i.test(url)) return "pap";
  if (/bienici\.com/i.test(url)) return "bienici";
  if (/logic-immo\.com/i.test(url)) return "logic-immo";
  return null;
}

export type SitePlan = {
  actorId: string;
  /**
   * Construit l'input JSON spécifique à cet actor à partir de l'URL.
   * Async pour permettre des lookups externes (ex. LBC : résoudre CP →
   * nom de commune via geo.api.gouv.fr car leadsbrary refuse les CP
   * non-arrondissement).
   */
  buildInput: (url: string) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Clé du mapper dans MULTI_URL_MAPPERS. */
  mapperKey: string;
};

/**
 * Mapping site → actor par défaut + builder d'input + mapper.
 * Pour changer d'actor sur un site, modifier ici (et ajouter le mapper
 * correspondant dans apify-mappers.MULTI_URL_MAPPERS).
 */
export const ACTOR_BY_SITE: Record<string, SitePlan | undefined> = {
  seloger: {
    actorId: "azzouzana~seloger-mass-products-scraper-by-search-url",
    buildInput: (url) => ({ startUrl: url, maxItems: 1000 }),
    mapperKey: "seloger:azzouzana",
  },
  leboncoin: {
    // 2026-05-19 : swap leadsbrary → silentflow.
    // Raisons :
    //  - silentflow accepte une URL LBC directe (`searchUrl`), pas besoin
    //    de parser les filtres ni de résoudre CP→ville (leadsbrary
    //    rejetait les CP non-arrondissement avec "City not found")
    //  - $0.0015/result vs $0.003/result (2× moins cher)
    //  - Sortie : GPS natif (`latitude`/`longitude`), `attributes[]`
    //    pivotable pour DPE/surface/pièces, `images[]` complet
    actorId: "silentflow~leboncoin-scraper-ppr",
    buildInput: (url) => ({
      searchUrl: url,
      maxItems: 500,
      browseMode: true, // requis pour DPE, GPS, surface (mode "search" simple
      //                   ne renvoie que titre/prix/ville)
    }),
    mapperKey: "leboncoin:silentflow",
  },
  pap: {
    actorId: "azzouzana~pap-fr-mass-products-scraper-by-search-url",
    buildInput: (url) => ({ startUrl: url, maxItemsToScrape: 1000 }),
    mapperKey: "pap:azzouzana",
  },
  bienici: {
    actorId: "stealth_mode~bienici-property-search-scraper",
    buildInput: (url) => ({
      urls: [url],
      ignore_url_failures: true,
      max_items_per_url: 500,
    }),
    mapperKey: "bienici:stealth_mode",
  },
};

/**
 * Skeleton : on retourne false en attendant une table `apify_run_costs`
 * pour calculer le cumul mensuel. À câbler avec BetterStack en PR3.5.
 */
export async function isBudgetExceeded(_supabaseApp: unknown): Promise<boolean> {
  return false;
}
