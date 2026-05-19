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
 * Distance Haversine en km entre 2 points lat/lng.
 * Précision suffisante pour des distances < 100km (au-delà, l'ellipsoïde
 * terrestre se fait sentir mais ça reste à ±0.5%).
 */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // rayon Terre, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import { DEPARTEMENT_CENTERS } from "@/lib/departement-centers";

const communesByDeptCache = new Map<string, Commune[]>();

async function fetchCommunesByDepartement(code: string): Promise<Commune[]> {
  if (communesByDeptCache.has(code)) return communesByDeptCache.get(code)!;
  try {
    const params = new URLSearchParams({
      fields: "nom,code,codesPostaux,codeDepartement,codeRegion,population,centre",
    });
    const res = await fetch(
      `${BASE}/departements/${code}/communes?${params.toString()}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Commune[];
    communesByDeptCache.set(code, data);
    return data;
  } catch {
    return [];
  }
}

/**
 * Retourne les communes dans un rayon de N km autour d'un point central,
 * triées par distance croissante.
 *
 * Stratégie :
 *  1. Charger /departements (101 entrées, cached)
 *  2. Filtrer ceux dont le centre est à < (rayon + 80km) du point pivot
 *     — un département fait ~80km max d'extension depuis son centre
 *  3. Fetch les communes de chaque département pertinent en parallèle
 *  4. Filtrer Haversine ≤ rayon et trier par distance
 *
 * Coût typique : 1 + 3-7 fetches selon le rayon. Tout cached, donc les
 * appels suivants pour la même zone géo sont instantanés.
 */
export async function findCommunesInRadius(
  centreLat: number,
  centreLng: number,
  radiusKm: number,
): Promise<Array<Commune & { distanceKm: number }>> {
  if (radiusKm <= 0 || !Number.isFinite(radiusKm)) return [];

  // Identifie les départements pertinents via la table statique des
  // centres (cf. departement-centers.ts). Marge de 80km = largeur max
  // d'un département depuis son centre — au-delà, ses communes sont
  // hors rayon.
  const candidateDeptCodes = Object.entries(DEPARTEMENT_CENTERS)
    .filter(([, c]) => distanceKm(centreLat, centreLng, c.lat, c.lng) <= radiusKm + 80)
    .map(([code]) => code);

  const arrays = await Promise.all(
    candidateDeptCodes.map((code) => fetchCommunesByDepartement(code)),
  );

  const all = arrays.flat();
  return all
    .map((c) => {
      if (!c.centre) return null;
      const [lng, lat] = c.centre.coordinates;
      const d = distanceKm(centreLat, centreLng, lat, lng);
      return d <= radiusKm ? { ...c, distanceKm: d } : null;
    })
    .filter((c): c is Commune & { distanceKm: number } => c !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
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
