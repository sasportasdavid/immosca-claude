// Mappers raw Apify → format DB `listings`.
//
// Chaque actor Apify retourne un schéma différent. On normalise via
// des mappers paramétrés par `source_site`. Tolérants : skip si les
// champs critiques manquent (prix, surface). Le PO ajustera quand il
// aura choisi l'actor définitif (souvent il faut quelques itérations).

import type { Database } from "@immoscan/db/app";

export type RawApifyListing = Record<string, unknown>;
export type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

const DPE_VALID = new Set(["A", "B", "C", "D", "E", "F", "G"]);

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.,]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function dpeOrNull(v: unknown): "A" | "B" | "C" | "D" | "E" | "F" | "G" | null {
  if (typeof v === "string" && DPE_VALID.has(v.toUpperCase())) {
    return v.toUpperCase() as "A" | "B" | "C" | "D" | "E" | "F" | "G";
  }
  return null;
}

function inferBienType(raw: RawApifyListing): Database["public"]["Enums"]["bien_type"] {
  const t = String(raw.type ?? raw.bien ?? raw.property_type ?? "").toLowerCase();
  if (t.includes("maison") || t.includes("house")) return "maison";
  if (t.includes("terrain") || t.includes("land")) return "terrain";
  if (t.includes("immeuble") || t.includes("building")) return "immeuble";
  if (t.includes("appartement") || t.includes("apartment") || t.includes("flat")) {
    return "appartement";
  }
  return "appartement";
}

/**
 * Map un raw SeLoger Apify → row listings.
 * Le schéma exact dépend de l'actor — ces clés sont des candidats
 * fréquents. Si certains restent null en pratique, ajuster.
 */
/**
 * Map un raw SeLoger Apify → row listings.
 *
 * Format actor `azzouzana/seloger-mass-products-scraper-by-search-url` :
 * structure nested. Champs clés :
 *  - `id` : externalId
 *  - `url` : URL annonce
 *  - `rawData.price` : prix (number direct)
 *  - `rawData.propertyType` : FLAT / HOUSE / PROJECT (programme neuf)
 *  - `rawData.propertySubType` : précision pour PROJECT
 *  - `rawData.surface.main` : surface habitable (null pour PROJECT)
 *  - `rawData.nbroom` / `rawData.nbbedroom`
 *  - `location.address.city` / `.zipCode`
 *  - `energyClass` : DPE (A-G, top-level)
 *  - `hardFacts.title` : titre annonce
 *  - `mainDescription` : description longue
 *
 * Fallback sur les clés génériques (raw.price, raw.title…) pour rester
 * compatible si on change d'actor SeLoger un jour.
 */
export function mapSelogerRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  const rawData = (raw.rawData ?? {}) as Record<string, unknown>;
  const location = (raw.location ?? {}) as Record<string, unknown>;
  const address = (location.address ?? {}) as Record<string, unknown>;
  const hardFacts = (raw.hardFacts ?? {}) as Record<string, unknown>;
  const surfaceObj = (rawData.surface ?? {}) as Record<string, unknown>;

  const prix = numOrNull(rawData.price ?? raw.prix ?? raw.price);
  const externalId = strOrNull(raw.id ?? rawData.legacy_id ?? raw.idAnnonce);
  const sourceUrl = strOrNull(raw.url ?? raw.permalink);
  if (!prix || !externalId || !sourceUrl) return null;

  // Type bien : azzouzana retourne FLAT / HOUSE / PROJECT
  const propertyType = String(rawData.propertyType ?? raw.type ?? "").toUpperCase();
  const propertySubType = String(rawData.propertySubType ?? "").toUpperCase();
  const inferredType =
    propertyType === "FLAT" || propertyType === "APARTMENT"
      ? ("appartement" as const)
      : propertyType === "HOUSE"
        ? ("maison" as const)
        : propertyType === "LAND"
          ? ("terrain" as const)
          : propertyType === "BUILDING"
            ? ("immeuble" as const)
            : propertyType === "PROJECT"
              ? propertySubType.includes("HOUSE")
                ? ("maison" as const)
                : ("appartement" as const)
              : inferBienType(raw); // fallback heuristique

  return {
    analysis_id: analysisId,
    external_id: externalId,
    source_site: "seloger",
    source_url: sourceUrl,
    title:
      strOrNull(hardFacts.title ?? raw.title ?? raw.titre) ?? "(Sans titre)",
    description: strOrNull(raw.mainDescription ?? raw.description),
    type: inferredType,
    prix,
    // azzouzana met la surface habitable dans rawData.surface.main (null
    // pour les programmes neufs). On fallback sur les clés génériques.
    surface: numOrNull(surfaceObj.main ?? raw.surface ?? raw.surfaceHabitable),
    pieces: numOrNull(rawData.nbroom ?? raw.pieces ?? raw.nbPieces),
    chambres: numOrNull(rawData.nbbedroom ?? raw.chambres ?? raw.nbChambres),
    ville: strOrNull(address.city ?? raw.ville ?? raw.city),
    code_postal: strOrNull(
      address.zipCode ?? raw.codePostal ?? raw.postalCode,
    ),
    adresse_raw: strOrNull(address.street ?? raw.adresse ?? raw.address),
    lat: numOrNull(location.lat ?? raw.lat ?? raw.latitude),
    lng: numOrNull(location.lng ?? raw.lng ?? raw.longitude),
    // azzouzana met le DPE en top-level `energyClass`
    dpe: dpeOrNull(raw.energyClass ?? raw.dpe ?? raw.dpeLetter),
    ges: dpeOrNull(raw.ges ?? raw.gesLetter),
    etage: numOrNull(raw.etage ?? raw.floor),
    balcon: Boolean(raw.balcon ?? raw.balcony),
    terrasse: Boolean(raw.terrasse ?? raw.terrace),
    parking: Boolean(raw.parking ?? raw.garage),
    ascenseur: Boolean(raw.ascenseur ?? raw.elevator),
    cave: Boolean(raw.cave ?? raw.cellar),
    annee_construction: numOrNull(raw.anneeConstruction ?? raw.yearBuilt),
    // azzouzana retourne `gallery: { images: [{ url, alt, classification }] }`
    // (dict, pas array). Format précédemment supporté pour les actors
    // qui renvoient un array de strings ou {src} reste compatible.
    photos_urls: (() => {
      const gallery = raw.gallery as
        | { images?: Array<{ url?: string }> }
        | Array<{ src?: string } | string>
        | null
        | undefined;
      if (!gallery) {
        return Array.isArray(raw.photos)
          ? (raw.photos as string[]).filter((p) => typeof p === "string")
          : null;
      }
      if (Array.isArray(gallery)) {
        const urls = gallery
          .map((g) => (typeof g === "string" ? g : g.src))
          .filter((p): p is string => typeof p === "string");
        return urls.length > 0 ? urls : null;
      }
      if (Array.isArray(gallery.images)) {
        const urls = gallery.images
          .map((img) => img.url)
          .filter((u): u is string => typeof u === "string");
        return urls.length > 0 ? urls : null;
      }
      return null;
    })(),
    is_exclusive: Boolean(raw.exclusivite ?? raw.isExclusive),
    is_new_construction:
      propertyType === "PROJECT" || Boolean(raw.neuf ?? raw.isNew),
  };
}

/**
 * Map un raw Leboncoin Apify → row listings.
 * Le format LBC est différent (ad_id, location, attributes[…]).
 */
export function mapLeboncoinRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  const prix = numOrNull(raw.price ?? raw.prix);
  const externalId = strOrNull(raw.list_id ?? raw.id ?? raw.ad_id);
  const sourceUrl = strOrNull(raw.url ?? raw.permalink);
  if (!prix || !externalId || !sourceUrl) return null;

  const location = (raw.location ?? {}) as Record<string, unknown>;
  const attributes = (raw.attributes ?? []) as Array<{
    key: string;
    value: string | number;
  }>;
  const attr = (key: string): string | number | null => {
    const found = attributes.find((a) => a.key === key);
    return found ? found.value : null;
  };

  return {
    analysis_id: analysisId,
    external_id: externalId,
    source_site: "leboncoin",
    source_url: sourceUrl,
    title:
      strOrNull(raw.subject ?? raw.title) ?? "(Sans titre)",
    description: strOrNull(raw.body ?? raw.description),
    type: inferBienType({ type: attr("real_estate_type") }),
    prix,
    surface: numOrNull(attr("square")),
    pieces: numOrNull(attr("rooms")),
    chambres: numOrNull(attr("bedrooms")),
    ville: strOrNull(location.city),
    code_postal: strOrNull(location.zipcode ?? location.zip),
    adresse_raw: null,
    lat: numOrNull(location.lat),
    lng: numOrNull(location.lng),
    dpe: dpeOrNull(attr("energy_rate")),
    ges: dpeOrNull(attr("ges")),
    etage: numOrNull(attr("floor_number")),
    photos_urls: Array.isArray(raw.images)
      ? (raw.images as Array<{ url: string }>)
          .map((i) => i.url)
          .filter(Boolean)
      : null,
  };
}

/**
 * Map un raw Pige Immo FR (actor `dltik/pige-immo-fr-scraper`) → row listings.
 *
 * Cet actor agrège LBC + SeLoger + PAP + Bien'ici + Logic-immo et
 * retourne un format unifié. Les champs clés (sans pseudonyme) :
 *   - source : "leboncoin" / "seloger" / "pap" / "bienici" / "logic-immo"
 *   - source_id : ID dans la source (=> external_id côté DB)
 *   - latitude / longitude : précis adresse (top win vs azzouzana)
 *   - address : adresse complète (parfois null pour les programmes neufs,
 *     fallback alors sur raw_extra.ademe.ademe_adresse si DPE matché)
 *   - district : quartier précis (ex. "Gagny - Parc Carette")
 *   - energy_class / ghg_class : DPE / GES
 *   - main_photo_url + photo_count : 1 photo principale seulement,
 *     pas de galerie complète (régression vs azzouzana)
 */
export function mapPigeImmoRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  const prix = numOrNull(raw.price);
  const sourceId = strOrNull(raw.source_id);
  const sourceUrl = strOrNull(raw.url);
  const source = strOrNull(raw.source);
  if (!prix || !sourceId || !sourceUrl || !source) return null;

  // Source mapping vers notre enum listing_source
  const sourceMap: Record<string, Database["public"]["Enums"]["listing_source"]> = {
    leboncoin: "leboncoin",
    seloger: "seloger",
    pap: "pap",
    bienici: "bienici",
    "logic-immo": "logic_immo",
    logic_immo: "logic_immo",
  };
  const sourceSite = sourceMap[source.toLowerCase()];
  if (!sourceSite) {
    // Source inconnue : on skip plutôt que d'insérer un type cassé.
    return null;
  }

  // Adresse : top-level `address`, fallback ADEME enrich si dispo
  const rawExtra = (raw.raw_extra ?? {}) as Record<string, unknown>;
  const ademe = (rawExtra.ademe ?? {}) as Record<string, unknown>;
  const adresseRaw =
    strOrNull(raw.address) ??
    strOrNull(ademe.ademe_adresse) ??
    null;

  // Type bien : property_type peut être "appartement", "maison",
  // "programme" (neuf), "terrain", "immeuble"
  const propertyType = String(raw.property_type ?? "").toLowerCase();
  const inferredType =
    propertyType === "maison" || propertyType === "house"
      ? ("maison" as const)
      : propertyType === "terrain" || propertyType === "land"
        ? ("terrain" as const)
        : propertyType === "immeuble" || propertyType === "building"
          ? ("immeuble" as const)
          : ("appartement" as const); // programme = neuf appartement par défaut

  const mainPhoto = strOrNull(raw.main_photo_url);

  return {
    analysis_id: analysisId,
    external_id: sourceId,
    source_site: sourceSite,
    source_url: sourceUrl,
    title: strOrNull(raw.title) ?? "(Sans titre)",
    description: strOrNull(raw.description),
    type: inferredType,
    prix,
    surface: numOrNull(raw.surface),
    pieces: numOrNull(raw.rooms),
    chambres: numOrNull(raw.bedrooms),
    ville: strOrNull(raw.city),
    code_postal: strOrNull(raw.postal_code),
    adresse_raw: adresseRaw,
    lat: numOrNull(raw.latitude),
    lng: numOrNull(raw.longitude),
    dpe: dpeOrNull(raw.energy_class),
    ges: dpeOrNull(raw.ghg_class),
    etage: numOrNull(raw.floor),
    balcon: Boolean(raw.has_balcony),
    terrasse: Boolean(raw.has_terrace),
    parking: Boolean(raw.has_parking),
    ascenseur: Boolean(raw.has_elevator),
    cave: false, // pas dans le schéma
    annee_construction: numOrNull(ademe.ademe_annee_construction),
    photos_urls: mainPhoto ? [mainPhoto] : null,
    is_exclusive: false,
    is_new_construction:
      Boolean(raw.is_new_build) || propertyType === "programme",
  };
}

export const APIFY_MAPPERS = {
  seloger: mapSelogerRow,
  leboncoin: mapLeboncoinRow,
} as const;

/**
 * Mapper pour les runs multi-source dltik. Le `source_site` du listing
 * est déterminé par le champ `source` de chaque item (pas le worker).
 * On exporte directement la fonction — la dispatch par source_site
 * d'APIFY_MAPPERS ne s'applique pas car ici tous les items passent
 * par le même mapper.
 */
export const PIGE_IMMO_MAPPER = mapPigeImmoRow;
