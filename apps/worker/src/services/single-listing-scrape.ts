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
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9",
    },
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
 * LBC, SeLoger, Bien'ici — via Apify actor en mode mono-résultat.
 * On utilise les mêmes actors que pour l'analyse complète (déjà câblés
 * dans ACTOR_BY_SITE), mais avec un maxItems=1 ou équivalent.
 *
 * NOTE : les actors search-URL acceptent souvent une URL de detail page
 * comme `startUrl` — ils renvoient alors un seul résultat. À tester par
 * site.
 */
async function scrapeViaApify(
  url: string,
  site: "leboncoin" | "seloger" | "bienici",
): Promise<SingleListing | null> {
  // Pour LBC : silentflow accepte un searchUrl, pas un detail URL.
  // Solution : construire une URL search qui matche l'annonce.
  // Pour MVP, on appelle l'actor avec searchUrl=URL detail — beaucoup
  // d'actors gèrent ça en interne (suit le redirect, extrait l'ID).
  let actorId: string;
  let runInput: Record<string, unknown>;

  if (site === "leboncoin") {
    actorId = "silentflow~leboncoin-scraper-ppr";
    runInput = { searchUrl: url, maxItems: 1, browseMode: true };
  } else if (site === "seloger") {
    actorId = "azzouzana~seloger-mass-products-scraper-by-search-url";
    runInput = { startUrl: url, maxItems: 1 };
  } else {
    actorId = "stealth_mode~bienici-property-search-scraper";
    runInput = { urls: [url], ignore_url_failures: true, max_items_per_url: 1 };
  }

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

  // Normalisation selon site. Reuse des mêmes mappings que dans
  // apify-mappers.ts mais en mode "single result", on fait du best-effort.
  return normalizeApifyItem(item, site, url, result.runId);
}

function normalizeApifyItem(
  raw: Record<string, unknown>,
  site: "leboncoin" | "seloger" | "bienici",
  url: string,
  apifyRunId: string,
): SingleListing | null {
  if (site === "leboncoin") {
    // Silentflow output (cf. mapLbcSilentflowRow)
    const externalId =
      typeof raw.id === "number" || typeof raw.id === "string"
        ? String(raw.id)
        : null;
    if (!externalId) return null;

    // attributes[] pivotable
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
      title: asStr(raw.title),
      prix: asNum(raw.price),
      surface: asNum(attrs.get("square")),
      pieces: asNum(attrs.get("rooms")),
      codePostal: asStr(raw.zipcode),
      ville: asStr(raw.city),
      adresseRaw: null,
      lat: asNum(raw.latitude),
      lng: asNum(raw.longitude),
      dpe: asDpe(attrs.get("energy_rate")?.toUpperCase()),
      url: asStr(raw.url) ?? url,
      photos: Array.isArray(raw.images)
        ? (raw.images as unknown[]).filter(
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

  // bienici
  const externalId = asStr(raw.id);
  if (!externalId) return null;

  const blurInfo = raw.blur_info as { position?: { lat?: number; lon?: number } } | undefined;
  const district = (raw.district ?? {}) as { name?: unknown };

  return {
    sourceSite: "bienici",
    externalId,
    title: asStr(raw.title),
    prix: asNum(raw.price),
    surface: asNum(raw.surface ?? raw.surface_area),
    pieces: asNum(raw.rooms_quantity),
    codePostal: asStr(raw.postal_code ?? raw.zipcode),
    ville: asStr(raw.city ?? raw.city_label),
    adresseRaw: asStr(district.name),
    lat: asNum(blurInfo?.position?.lat),
    lng: asNum(blurInfo?.position?.lon),
    dpe: asDpe(raw.energy_classification ?? raw.dpe),
    url: asStr(raw.url) ?? url,
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Array<{ url_photo?: string }>).map((p) => p.url_photo).filter(
          (u): u is string => typeof u === "string",
        )
      : [],
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
    const result = await scrapePapDirect(url);
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
