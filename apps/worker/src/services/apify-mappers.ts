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

// ──────────────────────────────────────────────────────────────────
// Mappers dédiés par actor (multi-URLs mode)
//
// Stratégie : 1 actor par site (au lieu de 1 actor multi-source). Chaque
// actor a son propre format de sortie, donc son propre mapper. C'est plus
// de plomberie mais ça donne :
//  - meilleure couverture (chaque actor a son bypass anti-bot dédié)
//  - meilleur format par site (lat/lng natif sur LBC leadsbrary, district
//    sur Bien'ici stealth_mode, etc.)
// ──────────────────────────────────────────────────────────────────

/**
 * LBC `leadsbrary/leboncoin-real-estate-scraper`.
 * Format moderne avec location_lat/lng natif, images_urls galerie.
 */
export function mapLbcLeadsbraryRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  const prix = numOrNull(raw.price_eur);
  const externalId = strOrNull(raw.id);
  const sourceUrl = strOrNull(raw.url);
  if (!prix || !externalId || !sourceUrl) return null;

  const pt = String(raw.property_type ?? "").toLowerCase();
  const inferredType =
    pt === "house" || pt === "maison"
      ? ("maison" as const)
      : pt === "land" || pt === "terrain"
        ? ("terrain" as const)
        : pt === "building" || pt === "immeuble"
          ? ("immeuble" as const)
          : ("appartement" as const);

  return {
    analysis_id: analysisId,
    external_id: externalId,
    source_site: "leboncoin",
    source_url: sourceUrl,
    title: strOrNull(raw.title) ?? "(Sans titre)",
    description: strOrNull(raw.description),
    type: inferredType,
    prix,
    surface: numOrNull(raw.surface_m2),
    pieces: numOrNull(raw.rooms),
    chambres: numOrNull(raw.bedrooms),
    ville: strOrNull(raw.location_city),
    code_postal: strOrNull(raw.location_zipcode),
    adresse_raw: null, // LBC ne donne pas l'adresse exacte
    lat: numOrNull(raw.location_lat),
    lng: numOrNull(raw.location_lng),
    dpe: dpeOrNull(raw.energy_class),
    ges: dpeOrNull(raw.ges_class),
    etage: numOrNull(raw.floors),
    balcon: false, // pas exposé directement par leadsbrary
    terrasse: false,
    parking: Number(raw.parking_spots ?? 0) > 0,
    ascenseur: false,
    cave: false,
    annee_construction: numOrNull(raw.building_year),
    photos_urls: Array.isArray(raw.images_urls)
      ? (raw.images_urls as string[]).filter((u) => typeof u === "string")
      : null,
    is_exclusive: false,
    is_new_construction: String(raw.condition ?? "").toLowerCase().includes("neuf"),
  };
}

/**
 * PAP `azzouzana/pap-fr-mass-products-scraper-by-search-url`.
 * Format français : `prix` est une string "192.000 €", surface dans
 * `caracteristiques` à parser via regex ("Appartement / 1 pièce / 35,51 m² / 5.407 € le m²").
 */
export function mapPapAzzouzanaRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  // prix : "192.000 €" → 192000 (format français avec '.' pour milliers)
  const prixStr = String(raw.prix ?? "").replace(/\./g, "").replace(/[^\d]/g, "");
  const prix = prixStr ? Number(prixStr) : null;
  const externalId = strOrNull(raw.id) ?? strOrNull(raw.reference_courte);
  const sourceUrl = strOrNull(raw.url);
  if (!prix || !externalId || !sourceUrl) return null;

  // Parse caracteristiques "Appartement / 1 pièce / 35,51 m² / 5.407 € le m²"
  const carac = String(raw.caracteristiques ?? "");
  const surfaceMatch = carac.match(/(\d+(?:[.,]\d+)?)\s*m²/);
  const surface = surfaceMatch
    ? Number(surfaceMatch[1]!.replace(",", "."))
    : null;

  const typeSlug = String(raw.typebien_slug ?? "").toLowerCase();
  const inferredType =
    typeSlug === "maison"
      ? ("maison" as const)
      : typeSlug === "terrain"
        ? ("terrain" as const)
        : typeSlug === "immeuble"
          ? ("immeuble" as const)
          : ("appartement" as const);

  const marker = (raw.marker ?? {}) as { lat?: number; lng?: number };

  return {
    analysis_id: analysisId,
    external_id: externalId,
    source_site: "pap",
    source_url: sourceUrl,
    title: strOrNull(raw.titre) ?? "(Sans titre)",
    description: strOrNull(raw.texte),
    type: inferredType,
    prix,
    surface,
    pieces: numOrNull(raw.nb_pieces),
    chambres: numOrNull(raw.nb_chambres_max),
    ville: null, // pas exposé directement (à extraire du titre/URL si besoin)
    code_postal: null,
    adresse_raw: null,
    lat: typeof marker.lat === "number" ? marker.lat : null,
    lng: typeof marker.lng === "number" ? marker.lng : null,
    dpe: dpeOrNull(raw.classe_energie),
    ges: dpeOrNull(raw.classe_ges),
    etage: null,
    balcon: false,
    terrasse: false,
    parking: false,
    ascenseur: false,
    cave: false,
    annee_construction: null,
    photos_urls: Array.isArray(raw.photos)
      ? (raw.photos as string[]).filter((u) => typeof u === "string")
      : null,
    is_exclusive: false,
    is_new_construction: false,
  };
}

/**
 * Bien'ici `stealth_mode/bienici-property-search-scraper`.
 * Lat/lng dans `blur_info.position` (centroïde quartier si adresse floutée).
 * Programmes neufs : `price`, `surface_area`, `rooms_quantity` sont des
 * arrays [min, max] — on prend la valeur min pour avoir le ticket d'entrée.
 */
export function mapBienIciStealthRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  // Helper : extrait soit un number, soit le min d'un array [min, max]
  const numOrMin = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v) && v.length > 0) {
      const n = Number(v[0]);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const prix = numOrMin(raw.price);
  const externalId = strOrNull(raw.id) ?? strOrNull(raw.reference);
  // L'URL n'est pas toujours fournie ; on fallback sur from_url + id
  const fromUrl = strOrNull(raw.from_url);
  const sourceUrl =
    strOrNull(raw.url) ??
    (externalId && fromUrl ? `${fromUrl}#${externalId}` : null);
  if (!prix || !externalId || !sourceUrl) return null;

  const pt = String(raw.property_type ?? "").toLowerCase();
  const inferredType =
    pt === "house" || pt === "maison"
      ? ("maison" as const)
      : pt === "land" || pt === "terrain"
        ? ("terrain" as const)
        : pt === "building" || pt === "immeuble"
          ? ("immeuble" as const)
          : ("appartement" as const); // "programme" = appart neuf par défaut

  const blurInfo = (raw.blur_info ?? {}) as {
    position?: { lat?: number; lon?: number };
    centroid?: { lat?: number; lon?: number };
  };
  const pos = blurInfo.position ?? blurInfo.centroid ?? {};

  const district = (raw.district ?? {}) as { name?: string };

  return {
    analysis_id: analysisId,
    external_id: externalId,
    source_site: "bienici",
    source_url: sourceUrl,
    title: strOrNull(raw.title) ?? "(Sans titre)",
    description: strOrNull(raw.description),
    type: inferredType,
    prix,
    surface: numOrMin(raw.surface_area),
    pieces: numOrMin(raw.rooms_quantity),
    chambres: numOrMin(raw.bedrooms_quantity),
    ville: strOrNull(raw.city),
    code_postal: strOrNull(raw.postal_code),
    // L'adresse exacte est rarement publique chez Bien'ici (RGPD).
    // À défaut on garde le nom de quartier comme indication.
    adresse_raw: strOrNull(district.name),
    lat: typeof pos.lat === "number" ? pos.lat : null,
    lng: typeof pos.lon === "number" ? pos.lon : null,
    dpe: dpeOrNull(raw.energy_classification),
    ges: dpeOrNull(raw.greenhouse_gaz_classification),
    etage: numOrNull(raw.floor),
    balcon: false,
    terrasse: false,
    parking: false,
    ascenseur: Boolean(raw.has_elevator),
    cave: Boolean(raw.has_cellar),
    annee_construction: null,
    photos_urls: Array.isArray(raw.photos)
      ? (raw.photos as Array<{ url_photo?: string }>)
          .map((p) => p.url_photo)
          .filter((u): u is string => typeof u === "string")
      : null,
    is_exclusive: Boolean(raw.is_bien_ici_exclusive),
    is_new_construction:
      Boolean(raw.new_property) || pt === "programme",
  };
}

export const APIFY_MAPPERS = {
  seloger: mapSelogerRow,
  leboncoin: mapLeboncoinRow,
} as const;

/**
 * Mappers par actor key (utilisés en mode multi-URLs).
 * La clé est `${source_site}:${actor_slug_court}` pour pouvoir avoir
 * plusieurs mappers par site si on change d'actor au fil du temps.
 */
export const MULTI_URL_MAPPERS = {
  "seloger:azzouzana": mapSelogerRow,
  "leboncoin:leadsbrary": mapLbcLeadsbraryRow,
  "pap:azzouzana": mapPapAzzouzanaRow,
  "bienici:stealth_mode": mapBienIciStealthRow,
} as const;

export type MultiUrlMapperKey = keyof typeof MULTI_URL_MAPPERS;

/**
 * Mapper pour les runs multi-source dltik. Le `source_site` du listing
 * est déterminé par le champ `source` de chaque item (pas le worker).
 * On exporte directement la fonction — la dispatch par source_site
 * d'APIFY_MAPPERS ne s'applique pas car ici tous les items passent
 * par le même mapper.
 */
export const PIGE_IMMO_MAPPER = mapPigeImmoRow;
