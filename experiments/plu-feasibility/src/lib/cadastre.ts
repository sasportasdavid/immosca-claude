import { parcelleSchema, type Parcelle } from "../types.js";

// ⚠️ ENDPOINT À VÉRIFIER AVANT EXÉCUTION
// API Carto Cadastre — endpoint connu mais a déjà changé par le passé.
// Doc officielle (à consulter) : https://apicarto.ign.fr/api/doc/cadastre
//
// L'API attend un GeoJSON Point en query param `geom` et renvoie les parcelles
// qui le contiennent.
const APICARTO_CADASTRE_URL = "https://apicarto.ign.fr/api/cadastre/parcelle";

/**
 * Cherche la parcelle cadastrale contenant le point (lat, lng).
 * Renvoie null si aucune parcelle trouvée.
 */
export async function getParcelleAtPoint(lat: number, lng: number): Promise<Parcelle | null> {
  // GeoJSON Point en WGS84 (EPSG:4326)
  const geom = {
    type: "Point" as const,
    coordinates: [lng, lat],
  };

  const url = new URL(APICARTO_CADASTRE_URL);
  url.searchParams.set("geom", JSON.stringify(geom));
  url.searchParams.set("_limit", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoScan-PLU-Spike/0.1" },
  });

  if (!res.ok) {
    throw new Error(`API Carto Cadastre returned ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    features?: Array<{
      properties: {
        idu?: string;
        numero?: string;
        section?: string;
        code_insee?: string;
        commune?: string;
        prefixe?: string;
        contenance?: number; // surface en m²
      };
      geometry: { type: string; coordinates: unknown };
    }>;
  };

  const first = json.features?.[0];
  if (!first) return null;

  return parcelleSchema.parse({
    numero: first.properties.numero ?? "",
    section: first.properties.section ?? "",
    commune: first.properties.code_insee ?? first.properties.commune ?? "",
    prefixe: first.properties.prefixe,
    surface_m2: first.properties.contenance ?? 0,
    geometry: first.geometry,
  });
}

/**
 * Health check : on prend une adresse témoin connue et on vérifie qu'on
 * récupère une parcelle non vide.
 */
export async function checkCadastre(): Promise<{ ok: boolean; message: string }> {
  try {
    // Coordonnées approximatives Mairie de Gagny
    const parcelle = await getParcelleAtPoint(48.8847, 2.5331);
    if (parcelle && parcelle.surface_m2 > 0) {
      return {
        ok: true,
        message: `Cadastre OK (parcelle ${parcelle.section}${parcelle.numero}, ${parcelle.surface_m2} m²)`,
      };
    }
    return {
      ok: false,
      message: `Cadastre renvoie un résultat vide ou suspect: ${JSON.stringify(parcelle)}`,
    };
  } catch (err) {
    return { ok: false, message: `Cadastre KO: ${(err as Error).message}` };
  }
}
