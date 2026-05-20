// Géocodage commune via API BAN (gratuit, sans clé).
// Retourne le centroïde lat/lng pour une (code_postal, ville).
//
// Cache en module-scope pour éviter les appels répétés sur la même
// commune au sein d'une session.

const cache = new Map<string, { lat: number; lng: number } | null>();

const BAN_API = "https://api-adresse.data.gouv.fr/search/";

export async function geocodeCommune(
  codePostal: string | null,
  ville: string | null,
): Promise<{ lat: number; lng: number } | null> {
  if (!codePostal && !ville) return null;
  const key = `${codePostal ?? ""}-${ville ?? ""}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  // BAN attend `q` + optionnel `postcode`. On donne juste la ville en q
  // car ses centroïdes sont plus précis qu'une recherche par CP.
  const params = new URLSearchParams();
  if (ville) params.set("q", ville);
  if (codePostal) params.set("postcode", codePostal);
  params.set("type", "municipality");
  params.set("limit", "1");

  try {
    const res = await fetch(`${BAN_API}?${params.toString()}`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
      }>;
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      cache.set(key, null);
      return null;
    }
    const result = { lat: coords[1]!, lng: coords[0]! };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/**
 * Pour une liste de listings, géocode les communes uniques en batch
 * puis assigne à chaque listing une position lat/lng = centroïde commune
 * + jitter aléatoire (~500m) pour éviter l'empilement parfait.
 *
 * Le jitter est seed sur l'external_id du listing pour être stable
 * d'un render à l'autre (sinon les markers sautillent).
 */
export type ListingPosition = {
  id: string;
  lat: number;
  lng: number;
};

// xmur3 hash + mulberry32 PRNG — donne une distribution uniforme.
// Sans ça les markers s'alignent sur une diagonale (les UUIDs étant
// séquentiels au niveau byte-pattern).
function seededRandom(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h ^ (h >>> 16);
  a = Math.imul(a, 2246822507);
  a ^= a >>> 13;
  a = Math.imul(a, 3266489909);
  a ^= a >>> 16;
  return (a >>> 0) / 4294967296; // [0, 1)
}

export async function geocodeListingsBatch<
  T extends {
    id: string;
    code_postal: string | null;
    ville: string | null;
    lat?: number | null;
    lng?: number | null;
  },
>(listings: T[]): Promise<ListingPosition[]> {
  // 1. Quels CP+ville uniques on a ?
  const uniqueKeys = new Map<string, { cp: string | null; ville: string | null }>();
  for (const l of listings) {
    if (l.lat && l.lng) continue; // déjà positionné
    const k = `${l.code_postal ?? ""}-${l.ville ?? ""}`;
    if (!uniqueKeys.has(k)) {
      uniqueKeys.set(k, { cp: l.code_postal, ville: l.ville });
    }
  }

  // 2. Géocode chaque commune unique en parallèle (avec cap pour pas
  //    cogner BAN trop fort).
  const entries = [...uniqueKeys.entries()];
  const results = new Map<string, { lat: number; lng: number } | null>();
  const CONCURRENCY = 5;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const slice = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async ([k, v]) => {
        const r = await geocodeCommune(v.cp, v.ville);
        results.set(k, r);
      }),
    );
  }

  // 3. Assigne à chaque listing un point = centroïde + jitter seed
  const positions: ListingPosition[] = [];
  for (const l of listings) {
    if (l.lat && l.lng) {
      positions.push({ id: l.id, lat: l.lat, lng: l.lng });
      continue;
    }
    const k = `${l.code_postal ?? ""}-${l.ville ?? ""}`;
    const center = results.get(k);
    if (!center) continue;
    // Jitter ~500m max : 1° lat ≈ 111km → 0.0045° ≈ 500m
    const r1 = seededRandom(l.id + "a") - 0.5;
    const r2 = seededRandom(l.id + "b") - 0.5;
    positions.push({
      id: l.id,
      lat: center.lat + r1 * 0.009,
      lng: center.lng + r2 * 0.009,
    });
  }
  return positions;
}
