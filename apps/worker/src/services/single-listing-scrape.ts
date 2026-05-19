// Service de scraping d'UN bien à partir d'une URL detail page (vs URL
// search). Utilisé par le module "Adresse à partir d'un lien".
//
// Stratégie selon le site :
//
//  - PAP : fetch HTML direct + parse JSON-LD `<script type="application/
//    ld+json">`. PAP expose les données structurées sans anti-bot lourd.
//    Coût : 0€, latence ~500ms.
//
//  - SeLoger / LeBonCoin / Bien'ici : anti-bot lourd (DataDome /
//    PerimeterX). Impossible de fetch HTML directement. On retombe sur
//    un actor Apify "search-mode" en mode mono-résultat :
//      • LBC silentflow : `searchUrl` accepte une URL de detail page
//        en input ? Si non, on utilise une astuce : construire une URL
//        search avec keyword = ID. Mais ce n'est pas fiable.
//      • Approche actuelle : on appelle l'actor SeLoger/PAP/BI standard
//        avec l'URL de detail comme `startUrl`. Beaucoup d'actors gèrent
//        ce cas (1 résultat retourné).
//
//  Cost : ~$0.001-0.005 par lookup. Latence : 15-60s.

import { logger } from "@trigger.dev/sdk";

import { detectSiteFromUrl, runApifyActor } from "@/services/apify";

/**
 * Représentation normalisée d'un bien après scraping d'une URL detail.
 * Contient le minimum nécessaire pour la résolution d'adresse.
 */
export type SingleListing = {
  sourceSite: "seloger" | "leboncoin" | "pap" | "bienici" | "logic-immo";
  externalId: string;
  title: string | null;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  codePostal: string | null;
  ville: string | null;
  /** Adresse exacte si déjà extraite par l'actor (rare). */
  adresseRaw: string | null;
  /** Coords GPS (souvent floutées ±100m). */
  lat: number | null;
  lng: number | null;
  /** Classe DPE A-G en majuscule. */
  dpe: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  /** URL canonique du listing. */
  url: string;
  /** Photos pour affichage. */
  photos: string[];
  /** runId Apify si applicable (pour debug + abort). */
  apifyRunId: string | null;
};

const ALPHA_DPE = new Set(["A", "B", "C", "D", "E", "F", "G"]);

function asDpe(v: unknown): SingleListing["dpe"] {
  if (typeof v !== "string") return null;
  const u = v.toUpperCase();
  return ALPHA_DPE.has(u) ? (u as SingleListing["dpe"]) : null;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.,-]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * PAP — fetch HTML + parse JSON-LD.
 *
 * Exemple d'URL : https://www.pap.fr/annonces/-r449900226
 *
 * PAP expose ses biens via JSON-LD `Product` ou `RealEstateListing` dans
 * la page HTML. Pas d'anti-bot lourd → fetch direct possible.
 */
async function scrapePapDirect(url: string): Promise<SingleListing | null> {
  // PAP a un WAF Cloudflare/Akamai qui bloque les IPs datacenter
  // (Trigger.dev = AWS). Les headers ci-dessous miment Chrome desktop FR
  // pour passer la première check. Si 403 quand même, c'est du IP block
  // et il faut passer par un proxy résidentiel (cf. fallback Apify).
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      "accept-encoding": "gzip, deflate, br, zstd",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`PAP fetch ${res.status} on ${url}`);
  }
  const html = await res.text();

  // Extract JSON-LD blocks
  const ldMatches = Array.from(
    html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  );
  let ld: Record<string, unknown> | null = null;
  for (const m of ldMatches) {
    try {
      const data = JSON.parse(m[1]!);
      if (
        data &&
        typeof data === "object" &&
        (data["@type"] === "Product" ||
          data["@type"] === "RealEstateListing" ||
          data["@type"] === "Apartment" ||
          data["@type"] === "House" ||
          data["@type"] === "Residence")
      ) {
        ld = data;
        break;
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }

  // Fallback : parse les meta OG si pas de JSON-LD utilisable
  // (titre, prix viennent des og:* généralement)
  const getMeta = (prop: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    return m ? m[1]! : null;
  };

  // Extract id from URL (PAP : -r<id>)
  const idMatch = url.match(/-r(\d+)/);
  if (!idMatch) {
    throw new Error("Impossible d'extraire l'ID PAP de l'URL");
  }
  const externalId = idMatch[1]!;

  // Parse depuis HTML : surface ("m²"), prix, code postal (94210)
  // Ces regex sont best-effort — PAP affiche tout sur la page.
  const surfaceMatch = html.match(/(\d+(?:[.,]\d+)?)\s*m²/);
  const surface = surfaceMatch
    ? Number(surfaceMatch[1]!.replace(",", "."))
    : null;
  const cpMatch = html.match(/\b(\d{5})\b/);
  const codePostal = cpMatch ? cpMatch[1]! : null;

  // DPE : cherche "DPE : X" ou "Classe énergie : X" ou "classe_energie"
  const dpeMatch = html.match(/(?:DPE|[Cc]lasse énergie)\s*[:=]\s*([A-G])/);
  const dpe = dpeMatch ? asDpe(dpeMatch[1]) : null;

  // Lat/lng peuvent venir du JSON-LD ou de markers JS embarqués
  let lat: number | null = null;
  let lng: number | null = null;
  const geoMatch = html.match(
    /["']?lat["']?\s*:\s*(-?\d+\.\d+)[\s\S]{1,200}["']?lng["']?\s*:\s*(-?\d+\.\d+)/,
  );
  if (geoMatch) {
    lat = Number(geoMatch[1]);
    lng = Number(geoMatch[2]);
  }

  return {
    sourceSite: "pap",
    externalId,
    title: asStr(ld?.name) ?? asStr(getMeta("og:title")) ?? null,
    prix: asNum(
      (ld?.offers as { price?: unknown })?.price ??
        getMeta("product:price:amount"),
    ),
    surface,
    pieces: null, // pas systématique dans le JSON-LD
    codePostal,
    ville:
      asStr(
        (
          ld?.address as {
            addressLocality?: unknown;
          }
        )?.addressLocality,
      ) ?? null,
    adresseRaw: null, // PAP n'expose pas l'adresse exacte côté frontend
    lat,
    lng,
    dpe,
    url,
    photos:
      typeof ld?.image === "string"
        ? [ld.image as string]
        : Array.isArray(ld?.image)
          ? (ld.image as unknown[]).filter(
              (s): s is string => typeof s === "string",
            )
          : [],
    apifyRunId: null,
  };
}

/**
 * PAP via Apify — fallback quand le fetch direct est bloqué par le WAF
 * (403 sur IP datacenter). On utilise `abotapi/pap-fr-scraper` qui
 * tourne avec des proxies résidentiels et accepte un array d'URLs.
 *
 * Note : abotapi est principalement search-URL, mais avec
 * `fetchDetails: true` il visite chaque URL et extrait les détails. Si
 * l'URL est detail (pas search), il devrait toujours tenter le fetch
 * et parser ce qu'il trouve.
 *
 * Si l'actor renvoie 0 items (URL detail non comprise), on tente un
 * dernier fallback : extraire CP + slug ville depuis l'URL elle-même
 * pour permettre au moins le fallback ville/CP côté pipeline.
 */
async function scrapePapViaApify(url: string): Promise<SingleListing | null> {
  try {
    const result = await runApifyActor<Record<string, unknown>>({
      actorId: "abotapi~pap-fr-scraper",
      runInput: {
        mode: "url",
        urls: [url],
        maxListings: 1,
        maxPages: 1,
        fetchDetails: true,
        proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
      },
      timeoutSecs: 180,
      memoryMbytes: 2048,
    });

    const item = result.items[0];
    if (item) {
      return normalizePapApifyItem(item, url, result.runId);
    }
  } catch (err) {
    logger.warn("PAP Apify fallback failed", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Dernier recours : extraire le minimum depuis l'URL pour permettre
  // au moins un fallback ville+CP en aval. Format URL PAP detail :
  //   /annonces/maison-saint-maur-des-fosses-94100-r438201542
  const slugMatch = url.match(/\/annonces\/([^/?#]+)/);
  if (!slugMatch) return null;
  const slug = slugMatch[1]!;
  const cpMatch = slug.match(/-(\d{5})-r\d+$/);
  const idMatch = slug.match(/-r(\d+)$/);
  if (!cpMatch || !idMatch) return null;

  const codePostal = cpMatch[1]!;
  const externalId = idMatch[1]!;
  // Slug = "maison-saint-maur-des-fosses-94100-r438201542"
  // → on retire le suffixe -cp-rId et le préfixe type → ville
  const villeSlug = slug
    .replace(/-\d{5}-r\d+$/, "")
    .replace(/^(maison|appartement|terrain|immeuble|parking|garage|local|local-commercial|bureaux|chambre|loft|studio)-/i, "")
    .replace(/-/g, " ");
  const ville = villeSlug
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  logger.info("PAP minimal extraction from URL", {
    externalId,
    codePostal,
    ville,
  });

  return {
    sourceSite: "pap",
    externalId,
    title: null,
    prix: null,
    surface: null,
    pieces: null,
    codePostal,
    ville,
    adresseRaw: null,
    lat: null,
    lng: null,
    dpe: null,
    url,
    photos: [],
    apifyRunId: null,
  };
}

function normalizePapApifyItem(
  raw: Record<string, unknown>,
  url: string,
  apifyRunId: string,
): SingleListing | null {
  const pick = (...names: string[]): unknown => {
    for (const n of names) {
      const v = raw[n];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  };

  const externalId =
    asStr(pick("reference", "reference_courte", "id", "papRef")) ??
    url.match(/-r(\d+)/)?.[1] ??
    null;
  if (!externalId) return null;

  return {
    sourceSite: "pap",
    externalId,
    title: asStr(pick("title", "titre", "publishedTitle")),
    prix: asNum(pick("price", "priceNumeric", "prix")),
    surface: asNum(pick("livingArea", "surface", "area")),
    pieces: asNum(pick("rooms", "pieces", "nb_pieces")),
    codePostal: asStr(pick("postcode", "postalCode", "zipcode", "code_postal")),
    ville: asStr(pick("city", "ville", "arrondissement")),
    adresseRaw: asStr(pick("streetAddress", "street", "adresse", "address")),
    lat: asNum(pick("latitude", "lat")),
    lng: asNum(pick("longitude", "lng", "lon")),
    dpe: asDpe(pick("energyClass", "dpe", "classe_energie")),
    url: asStr(pick("url", "permalink")) ?? url,
    photos: Array.isArray(raw.images)
      ? (raw.images as unknown[]).filter(
          (s): s is string => typeof s === "string",
        )
      : Array.isArray(raw.photos)
        ? (raw.photos as unknown[]).filter(
            (s): s is string => typeof s === "string",
          )
        : [],
    apifyRunId,
  };
}

/**
 * LBC, SeLoger, Bien'ici — via Apify actor "detail URL" (vs search URL).
 *
 * Distinction importante : les actors câblés dans `ACTOR_BY_SITE` (pour
 * les analyses multi-URLs) attendent des URLs de **search page**. Mais
 * dans ce module on reçoit une URL de **detail page** (une seule annonce).
 * On utilise donc d'autres actors dédiés au scraping par URL d'annonce :
 *
 *  - LBC      : fatihtahta/leboncoin-fr-scraper  (startUrls + limit)
 *  - SeLoger  : azzouzana/.../by-items-urls       (startUrls)
 *  - Bien'ici : silentflow/bienici-scraper-ppr    (adUrls + deepScrape)
 *
 * Tous acceptent un array d'URLs de detail page. On en passe 1 → on récupère
 * 1 item.
 */
async function scrapeViaApify(
  url: string,
  site: "leboncoin" | "seloger" | "bienici",
): Promise<SingleListing | null> {
  let actorId: string;
  let runInput: Record<string, unknown>;

  if (site === "leboncoin") {
    // fatihtahta accepte les URLs detail LBC dans startUrls
    actorId = "fatihtahta~leboncoin-fr-scraper";
    runInput = { startUrls: [{ url }], limit: 1 };
  } else if (site === "seloger") {
    // Variante "by-items-urls" — vs "by-search-url" qu'on utilise pour analyze
    actorId = "azzouzana~seloger-mass-products-scraper-by-items-urls";
    runInput = { startUrls: [{ url }] };
  } else {
    // silentflow Bien'ici : adUrls dédié aux annonces individuelles
    actorId = "silentflow~bienici-scraper-ppr";
    runInput = { adUrls: [url], maxItems: 1, deepScrape: true };
  }

  logger.info("Apify detail-URL", { url, actorId });

  const result = await runApifyActor<Record<string, unknown>>({
    actorId,
    runInput,
    timeoutSecs: 180, // 3 min max pour single-URL
    memoryMbytes: 2048,
  });

  const item = result.items[0];
  if (!item) {
    logger.warn("Apify single-URL : 0 items returned", { url, actorId });
    return null;
  }

  // Normalisation selon site
  return normalizeApifyItem(item, site, url, result.runId);
}

function normalizeApifyItem(
  raw: Record<string, unknown>,
  site: "leboncoin" | "seloger" | "bienici",
  url: string,
  apifyRunId: string,
): SingleListing | null {
  // Helper : essaye plusieurs noms de champ candidats (tolérance entre
  // actors qui exposent le même attribut sous différents noms).
  const pick = (...names: string[]): unknown => {
    for (const n of names) {
      const v = raw[n];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  };

  if (site === "leboncoin") {
    // Acceptable pour silentflow ET fatihtahta. fatihtahta utilise
    // souvent listId/list_id pour l'ID, prix/price_value, etc.
    const externalId =
      typeof raw.id === "number" || typeof raw.id === "string"
        ? String(raw.id)
        : typeof raw.list_id === "number" || typeof raw.list_id === "string"
          ? String(raw.list_id)
          : typeof raw.listId === "number" || typeof raw.listId === "string"
            ? String(raw.listId)
            : null;
    if (!externalId) return null;

    // attributes[] pivotable (silentflow). fatihtahta utilise une struct
    // différente — on tente de récupérer surface/pieces direct sinon.
    const attrs = new Map<string, string>();
    if (Array.isArray(raw.attributes)) {
      for (const a of raw.attributes as Array<{
        key?: string;
        value?: string;
      }>) {
        if (typeof a?.key === "string" && typeof a?.value === "string") {
          attrs.set(a.key, a.value);
        }
      }
    }

    return {
      sourceSite: "leboncoin",
      externalId,
      title: asStr(pick("title", "subject")),
      prix: asNum(pick("price", "price_eur", "price_cents")),
      surface: asNum(
        attrs.get("square") ??
          pick("surface", "surface_m2", "square_meters"),
      ),
      pieces: asNum(attrs.get("rooms") ?? pick("rooms", "nb_pieces")),
      codePostal: asStr(pick("zipcode", "postal_code", "zip_code")),
      ville: asStr(pick("city", "location_city")),
      adresseRaw: null,
      lat: asNum(pick("latitude", "lat", "location_lat")),
      lng: asNum(pick("longitude", "lng", "lon", "location_lng")),
      dpe: asDpe(
        (attrs.get("energy_rate") ?? attrs.get("energy_class"))?.toUpperCase() ??
          pick("energy_class", "energy_rate", "dpe"),
      ),
      url: asStr(raw.url) ?? url,
      photos: Array.isArray(raw.images)
        ? (raw.images as unknown[]).filter(
            (s): s is string => typeof s === "string",
          )
        : Array.isArray(raw.images_urls)
          ? (raw.images_urls as unknown[]).filter(
              (s): s is string => typeof s === "string",
            )
          : Array.isArray(raw.photos)
            ? (raw.photos as unknown[]).filter(
                (s): s is string => typeof s === "string",
              )
            : [],
      apifyRunId,
    };
  }

  if (site === "seloger") {
    // azzouzana output (cf. mapSelogerRow)
    const externalId = asStr(raw.id) ?? asStr(raw.identifier);
    if (!externalId) return null;

    const address = (raw.address ?? {}) as Record<string, unknown>;
    const location = (raw.location ?? {}) as Record<string, unknown>;

    return {
      sourceSite: "seloger",
      externalId,
      title: asStr(raw.title) ?? asStr(raw.publishedTitle),
      prix: asNum(raw.price ?? raw.prix),
      surface: asNum(raw.surface ?? raw.area),
      pieces: asNum(raw.rooms ?? raw.pieces),
      codePostal: asStr(address.zipCode ?? raw.zipCode ?? raw.code_postal),
      ville: asStr(address.city ?? raw.city ?? raw.ville),
      adresseRaw: asStr(address.street ?? raw.adresse ?? raw.address),
      lat: asNum(location.lat ?? raw.lat ?? raw.latitude),
      lng: asNum(location.lng ?? raw.lng ?? raw.longitude),
      dpe: asDpe(raw.energyClass ?? raw.dpe),
      url: asStr(raw.url) ?? url,
      photos: Array.isArray(raw.photos)
        ? (raw.photos as unknown[]).filter(
            (s): s is string => typeof s === "string",
          )
        : Array.isArray(raw.pictures)
          ? (raw.pictures as unknown[]).filter(
              (s): s is string => typeof s === "string",
            )
          : [],
      apifyRunId,
    };
  }

  // bienici (silentflow ou stealth_mode — formats légèrement différents)
  const externalId =
    asStr(raw.id) ?? asStr(raw.adId) ?? asStr(raw.ad_id);
  if (!externalId) return null;

  // stealth_mode utilise `blur_info.position`, silentflow utilise direct
  // latitude/longitude
  const blurInfo = raw.blur_info as { position?: { lat?: number; lon?: number } } | undefined;
  const district = (raw.district ?? {}) as { name?: unknown };
  const photos = Array.isArray(raw.photos)
    ? (raw.photos as unknown[])
        .map((p) => {
          if (typeof p === "string") return p;
          if (p && typeof p === "object") {
            const obj = p as { url_photo?: unknown; url?: unknown };
            return typeof obj.url_photo === "string"
              ? obj.url_photo
              : typeof obj.url === "string"
                ? obj.url
                : null;
          }
          return null;
        })
        .filter((s): s is string => typeof s === "string")
    : Array.isArray(raw.images)
      ? (raw.images as unknown[]).filter(
          (s): s is string => typeof s === "string",
        )
      : [];

  return {
    sourceSite: "bienici",
    externalId,
    title: asStr(pick("title", "name", "subject")),
    prix: asNum(pick("price", "price_eur", "priceValue")),
    surface: asNum(pick("surface", "surface_area", "livingArea")),
    pieces: asNum(pick("rooms_quantity", "rooms", "roomsQuantity", "nb_pieces")),
    codePostal: asStr(pick("postal_code", "zipcode", "postalCode")),
    ville: asStr(pick("city", "city_label", "cityName")),
    adresseRaw: asStr(district.name ?? pick("address", "street")),
    lat: asNum(blurInfo?.position?.lat ?? pick("latitude", "lat")),
    lng: asNum(blurInfo?.position?.lon ?? pick("longitude", "lng", "lon")),
    dpe: asDpe(
      pick("energy_classification", "dpe", "energy_class", "energyValue"),
    ),
    url: asStr(raw.url) ?? url,
    photos,
    apifyRunId,
  };
}

/**
 * Point d'entrée : prend une URL de listing, détecte le site, scrape
 * via la méthode la plus appropriée, retourne un `SingleListing`
 * normalisé prêt pour l'enrichissement adresse.
 */
export async function scrapeSingleListingFromUrl(
  url: string,
): Promise<SingleListing> {
  const site = detectSiteFromUrl(url);
  if (!site) {
    throw new Error(
      "URL non reconnue. Sites supportés : LeBonCoin, PAP, SeLoger, Bien'ici.",
    );
  }

  logger.info("Single-listing scrape", { url, site });

  if (site === "pap") {
    // Tentative 1 : fetch HTML direct (gratuit, rapide ~500ms).
    // PAP a un WAF qui bloque souvent les IPs datacenter.
    try {
      const result = await scrapePapDirect(url);
      if (result) return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("PAP direct fetch failed, fallback to Apify", {
        url,
        error: msg,
      });
    }
    // Tentative 2 : Apify avec proxy résidentiel (abotapi)
    const result = await scrapePapViaApify(url);
    if (!result) throw new Error("PAP : aucune donnée extraite");
    return result;
  }

  if (site === "logic-immo") {
    throw new Error("Logic-immo pas encore supporté pour le lookup adresse");
  }

  const result = await scrapeViaApify(url, site);
  if (!result) {
    throw new Error(`${site} : aucun résultat retourné par Apify`);
  }
  return result;
}
