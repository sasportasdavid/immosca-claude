// Recherche de communes françaises via API geo.api.gouv.fr.
// Gratuite, sans clé, mise à jour officielle (INSEE).
//
// Doc : https://geo.api.gouv.fr/decoupage-administratif/communes
// Endpoint : GET /communes?nom={q}&boost=population&limit=N&fields=...
//
// Cache module-scope par query pour éviter les re-fetch en cas de
// keypresses successifs sur la même chaîne.

export type Commune = {
  /** Nom officiel (ex. "Gagny") */
  nom: string;
  /** Code INSEE 5 chiffres (ex. "93032") */
  code: string;
  /** Codes postaux (une commune peut en avoir plusieurs — Paris a 20) */
  codesPostaux: string[];
  /** Code département (ex. "93") */
  codeDepartement: string;
  /** Code région (ex. "11" pour IDF) */
  codeRegion: string;
  /** Population municipale (pour ranking) */
  population: number;
  /** Centre géo {type: "Point", coordinates: [lng, lat]} */
  centre?: {
    type: "Point";
    coordinates: [number, number];
  };
};

const cache = new Map<string, Commune[]>();
const BASE = "https://geo.api.gouv.fr";

/**
 * Recherche par nom (fuzzy). Retourne max `limit` communes triées par
 * population (boost=population). La page IDF + grandes villes remonte
 * d'abord, ce qui matche les attentes utilisateur.
 */
export async function searchCommunes(
  query: string,
  limit = 8,
): Promise<Commune[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cacheKey = `${q.toLowerCase()}|${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const params = new URLSearchParams({
    nom: q,
    boost: "population",
    limit: String(limit),
    fields: "nom,code,codesPostaux,codeDepartement,codeRegion,population,centre",
  });

  try {
    const res = await fetch(`${BASE}/communes?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as Commune[];
    cache.set(cacheKey, data);
    return data;
  } catch {
    return [];
  }
}

/**
 * Recherche par code postal exact (5 chiffres). Retourne toutes les
 * communes qui partagent ce CP (utile pour le 75001-75020 etc.).
 */
export async function searchByCodePostal(
  codePostal: string,
): Promise<Commune[]> {
  if (!/^\d{4,5}$/.test(codePostal)) return [];
  const cacheKey = `cp:${codePostal}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const params = new URLSearchParams({
    codePostal,
    fields: "nom,code,codesPostaux,codeDepartement,codeRegion,population,centre",
  });

  try {
    const res = await fetch(`${BASE}/communes?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as Commune[];
    cache.set(cacheKey, data);
    return data;
  } catch {
    return [];
  }
}
