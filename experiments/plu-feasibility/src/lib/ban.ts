import { z } from "zod";
import { banResultSchema, type BanResult } from "../types.js";

// API BAN — endpoint stable, documenté
// Doc : https://adresse.data.gouv.fr/api-doc/adresse
const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";

const banApiResponseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({
        coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
      }),
      properties: z.object({
        label: z.string(),
        score: z.number(),
        housenumber: z.string().optional(),
        street: z.string().optional(),
        postcode: z.string(),
        city: z.string(),
        citycode: z.string(),
        type: z.enum(["housenumber", "street", "locality", "municipality"]),
      }),
    }),
  ),
});

export async function geocodeAddress(address: string): Promise<BanResult | null> {
  const url = new URL(BAN_SEARCH_URL);
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "1");
  url.searchParams.set("autocomplete", "0");

  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoScan-PLU-Spike/0.1" },
  });

  if (!res.ok) {
    throw new Error(`BAN returned ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const parsed = banApiResponseSchema.parse(json);

  const first = parsed.features[0];
  if (!first) return null;

  const [lng, lat] = first.geometry.coordinates;
  return banResultSchema.parse({
    ...first.properties,
    lat,
    lng,
  });
}

/**
 * Health check : retourne true si l'API BAN répond et renvoie un résultat
 * pour une adresse témoin connue.
 */
export async function checkBan(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await geocodeAddress("1 rue Aristide Briand 93220 Gagny");
    if (result && result.city.toLowerCase().includes("gagny")) {
      return { ok: true, message: `BAN OK (résultat: ${result.label})` };
    }
    return { ok: false, message: `BAN renvoie un résultat inattendu: ${JSON.stringify(result)}` };
  } catch (err) {
    return { ok: false, message: `BAN KO: ${(err as Error).message}` };
  }
}
