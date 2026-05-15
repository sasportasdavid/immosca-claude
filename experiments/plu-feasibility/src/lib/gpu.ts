import { gpuZoneSchema, type GpuZone } from "../types.js";

// ⚠️ ENDPOINT FORTEMENT À VÉRIFIER AVANT EXÉCUTION ⚠️
//
// L'API du Géoportail de l'Urbanisme (GPU) a beaucoup évolué. Plusieurs voies d'accès :
//
// 1. API GPU officielle (la plus simple si elle existe encore comme telle) :
//    https://www.geoportail-urbanisme.gouv.fr/api/...
//    À vérifier dans la doc — il est possible qu'elle ait été dépréciée
//    au profit de l'API Carto GPU ou du WFS.
//
// 2. API Carto GPU (probablement la voie recommandée actuelle) :
//    https://apicarto.ign.fr/api/gpu/zone-urba?geom=<geojson>
//    Doc : https://apicarto.ign.fr/api/doc/gpu
//    Avantage : même endpoint que le cadastre, signature similaire.
//
// 3. WFS direct sur data.geopf.fr :
//    https://data.geopf.fr/wfs/ows?SERVICE=WFS&...
//    Plus bas niveau, plus stable mais plus pénible à requêter.
//
// On code la voie #2 par défaut et le health check confirme la disponibilité.
// Si KO, lire la doc et ajuster avant le batch.

const APICARTO_GPU_ZONE_URBA_URL = "https://apicarto.ign.fr/api/gpu/zone-urba";

/**
 * Cherche la zone PLU contenant le point (lat, lng).
 * Renvoie null si aucune zone trouvée (commune sans PLU sur GPU, ou hors emprise).
 */
export async function getGpuZoneAtPoint(lat: number, lng: number): Promise<GpuZone | null> {
  const geom = {
    type: "Point" as const,
    coordinates: [lng, lat],
  };

  const url = new URL(APICARTO_GPU_ZONE_URBA_URL);
  url.searchParams.set("geom", JSON.stringify(geom));
  url.searchParams.set("_limit", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoScan-PLU-Spike/0.1" },
  });

  if (!res.ok) {
    throw new Error(`API Carto GPU returned ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    features?: Array<{
      properties: Record<string, unknown>;
    }>;
  };

  const first = json.features?.[0];
  if (!first) return null;

  // Les propriétés exactes varient selon les communes (chaque PLU est saisi
  // par sa collectivité avec sa propre nomenclature). On essaie plusieurs clés.
  const p = first.properties;
  const libelle = (p.libelle ?? p.libelong ?? p.typezone ?? "") as string;
  const typezone = (p.typezone ?? p.type ?? "") as string;

  return gpuZoneSchema.parse({
    zone_libelle: libelle,
    zone_type: typezone.toString().slice(0, 2).toUpperCase() || undefined,
    document_id: (p.idurba ?? p.partition ?? p.gid ?? "unknown").toString(),
    document_url: typeof p.urlfic === "string" ? p.urlfic : undefined,
    reglement_pdf_url: typeof p.urlfic === "string" ? p.urlfic : undefined,
    date_approbation:
      typeof p.dateapprobation === "string" ? p.dateapprobation : undefined,
    commune_insee: (p.insee ?? p.code_insee ?? "").toString(),
  });
}

/**
 * Récupère les métadonnées du document d'urbanisme pour une commune,
 * notamment les URLs des PDFs de règlement attachés au document GPU.
 *
 * Endpoint encore plus incertain — à coder/finaliser après le check.
 */
export async function getGpuDocumentMetadata(documentId: string): Promise<{
  pdf_urls: string[];
} | null> {
  // TODO: À CODER après health check.
  // Possible endpoint : https://apicarto.ign.fr/api/gpu/document?partition=<id>
  // ou via le GPU directement.
  void documentId;
  return null;
}

/**
 * Health check : Mairie de Gagny, on attend une zone urbaine.
 */
export async function checkGpu(): Promise<{ ok: boolean; message: string }> {
  try {
    const zone = await getGpuZoneAtPoint(48.8847, 2.5331);
    if (zone && zone.zone_libelle) {
      return {
        ok: true,
        message: `GPU OK (zone: ${zone.zone_libelle}, type: ${zone.zone_type ?? "?"})`,
      };
    }
    return {
      ok: false,
      message: `GPU renvoie vide pour Gagny (commune normalement couverte). Vérifier l'endpoint.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `GPU KO: ${(err as Error).message}. Consulter https://apicarto.ign.fr/api/doc/gpu`,
    };
  }
}

/**
 * Télécharge un PDF de règlement et retourne ses bytes.
 */
export async function downloadReglementPdf(
  url: string,
): Promise<{ size: number; bytes: ArrayBuffer }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoScan-PLU-Spike/0.1" },
  });
  if (!res.ok) {
    throw new Error(`PDF download returned ${res.status} ${res.statusText}`);
  }
  const bytes = await res.arrayBuffer();
  return { size: bytes.byteLength, bytes };
}
