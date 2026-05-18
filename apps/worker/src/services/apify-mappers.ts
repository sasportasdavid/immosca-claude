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
export function mapSelogerRow(
  raw: RawApifyListing,
  analysisId: string,
): ListingInsert | null {
  const prix = numOrNull(raw.prix ?? raw.price);
  const externalId = strOrNull(raw.id ?? raw.idAnnonce ?? raw.reference);
  const sourceUrl = strOrNull(raw.url ?? raw.permalink);
  if (!prix || !externalId || !sourceUrl) return null;

  return {
    analysis_id: analysisId,
    external_id: externalId,
    source_site: "seloger",
    source_url: sourceUrl,
    title: strOrNull(raw.title ?? raw.titre ?? raw.descTitle) ?? "(Sans titre)",
    description: strOrNull(raw.description ?? raw.fullDescription),
    type: inferBienType(raw),
    prix,
    surface: numOrNull(raw.surface ?? raw.surfaceHabitable),
    pieces: numOrNull(raw.pieces ?? raw.nbPieces ?? raw.rooms),
    chambres: numOrNull(raw.chambres ?? raw.nbChambres ?? raw.bedrooms),
    ville: strOrNull(raw.ville ?? raw.city),
    code_postal: strOrNull(raw.codePostal ?? raw.postalCode ?? raw.zipCode),
    adresse_raw: strOrNull(raw.adresse ?? raw.address),
    lat: numOrNull(raw.lat ?? raw.latitude),
    lng: numOrNull(raw.lng ?? raw.longitude),
    dpe: dpeOrNull(raw.dpe ?? raw.energyClass ?? raw.dpeLetter),
    ges: dpeOrNull(raw.ges ?? raw.gesLetter),
    etage: numOrNull(raw.etage ?? raw.floor),
    balcon: Boolean(raw.balcon ?? raw.balcony),
    terrasse: Boolean(raw.terrasse ?? raw.terrace),
    parking: Boolean(raw.parking ?? raw.garage),
    ascenseur: Boolean(raw.ascenseur ?? raw.elevator),
    cave: Boolean(raw.cave ?? raw.cellar),
    annee_construction: numOrNull(raw.anneeConstruction ?? raw.yearBuilt),
    photos_urls: Array.isArray(raw.photos)
      ? (raw.photos as string[]).filter((p) => typeof p === "string")
      : null,
    is_exclusive: Boolean(raw.exclusivite ?? raw.isExclusive),
    is_new_construction: Boolean(raw.neuf ?? raw.isNew),
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

export const APIFY_MAPPERS = {
  seloger: mapSelogerRow,
  leboncoin: mapLeboncoinRow,
} as const;
