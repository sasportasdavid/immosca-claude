// Service ADEME DPE — récupération de l'adresse exacte d'un bien à partir
// de sa surface + code postal + classe DPE.
//
// Pourquoi : LBC/PAP/Bien'ici floutent les coordonnées GPS pour anonymiser
// le vendeur. Reverse-BAN nous donne donc "rue voisine ±100m". Mais le
// DPE déclaré à l'ADEME contient l'adresse RÉELLE du diagnostic — avec
// numéro de voie. En matchant (CP, classe DPE, surface ±5m²), on retrouve
// l'adresse exacte avec ~60-80% de taux de succès.
//
// Données : dataset "DPE Logements existants (depuis juillet 2021)"
// hébergé par Koumoul. 14.7M de DPE France entière, mis à jour quotidien.
// API gratuite, sans clé, ~10 req/s soutenu sans rate-limit visible.
//
// Doc : https://koumoul.com/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe
//
// Limites :
//  - Les biens neufs (< 2 ans) n'ont parfois pas encore de DPE → 0 match
//  - Plusieurs DPE peuvent matcher si l'immeuble a plusieurs apparts de
//    surface proche → on prend le plus récent
//  - Si > 20 candidats matchent, on refuse (probablement immeuble avec
//    beaucoup d'apparts de même taille — trop d'ambiguïté)

import PQueue from "p-queue";

const ADEME_BASE =
  "https://koumoul.com/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines";

// Queue pour éviter de saturer Koumoul si on a 100+ listings à enrichir.
// 5 concurrents = ~50 req/s en burst, ce qui passe sans rate-limit.
const ADEME_QUEUE = new PQueue({ concurrency: 5 });

export type AdemeDpeMatch = {
  numero_dpe: string;
  date_etablissement_dpe: string;
  etiquette_dpe: string;
  surface_habitable_logement: number;
  /** Adresse complète formatée : "12 Avenue Bara 94210 Saint-Maur-des-Fossés" */
  adresse_ban: string;
  numero_voie_ban: string | null;
  nom_rue_ban: string | null;
  code_postal_ban: string;
  nom_commune_ban: string;
  code_insee_ban: string | null;
  /** Score de qualité du géocodage BAN (0-1, >0.5 = fiable) */
  score_ban: number | null;
  /** Nombre total de candidats matchés (pour debug/dédup) */
  totalCandidates: number;
};

type Opts = {
  codePostal: string;
  classeDpe: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  surface: number;
  /** Tolérance ±m² sur la surface (defaut 5) */
  surfaceTolerance?: number;
  /** Seuil de refus si trop de candidats (defaut 20) */
  maxCandidates?: number;
};

// Cache module-scope par clé (cp|dpe|surface arrondie au m²).
// La même requête revient souvent au sein d'un run d'analyse (plusieurs
// listings d'un même immeuble par exemple) — éviter d'appeler ADEME 2×.
const cache = new Map<string, AdemeDpeMatch | null>();

/**
 * Recherche le meilleur DPE matchant (CP, classe, surface ±5m²) dans la
 * base ADEME. Retourne `null` si :
 *  - aucun match
 *  - trop de matches (> maxCandidates) → ambiguïté
 *  - erreur réseau (best-effort)
 */
export async function findAdemeDpe(opts: Opts): Promise<AdemeDpeMatch | null> {
  const { codePostal, classeDpe, surface } = opts;
  const tol = opts.surfaceTolerance ?? 5;
  const maxCand = opts.maxCandidates ?? 20;

  if (!/^\d{5}$/.test(codePostal)) return null;
  if (!/^[A-G]$/.test(classeDpe)) return null;
  if (!Number.isFinite(surface) || surface < 10 || surface > 1000) return null;

  const cacheKey = `${codePostal}|${classeDpe}|${Math.round(surface)}|${tol}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const surfaceMin = Math.max(1, surface - tol);
  const surfaceMax = surface + tol;

  // Syntaxe Elasticsearch via Koumoul `qs` :
  //   field:"value" AND field:[min TO max]
  const qs = [
    `code_postal_ban:"${codePostal}"`,
    `etiquette_dpe:"${classeDpe}"`,
    `surface_habitable_logement:[${surfaceMin} TO ${surfaceMax}]`,
  ].join(" AND ");

  const url = new URL(ADEME_BASE);
  url.searchParams.set("qs", qs);
  url.searchParams.set("sort", "-date_etablissement_dpe");
  url.searchParams.set("size", "5");
  url.searchParams.set(
    "select",
    [
      "numero_dpe",
      "date_etablissement_dpe",
      "etiquette_dpe",
      "surface_habitable_logement",
      "adresse_ban",
      "numero_voie_ban",
      "nom_rue_ban",
      "code_postal_ban",
      "nom_commune_ban",
      "code_insee_ban",
      "score_ban",
    ].join(","),
  );

  try {
    const json = await ADEME_QUEUE.add(async () => {
      const res = await fetch(url, {
        headers: { "user-agent": "ImmoScan/1.0 (https://immoscan.fr)" },
      });
      if (!res.ok) {
        throw new Error(`ADEME API ${res.status} on ${url.pathname}`);
      }
      return res.json();
    });

    const data = json as {
      total?: number;
      results?: Array<Record<string, unknown>>;
    };
    const total = data.total ?? 0;
    const results = data.results ?? [];

    // Trop de candidats = ambigu → on refuse plutôt que de raconter
    // n'importe quoi. Cas typique : un immeuble avec 50 appartements de
    // 50m² classés D — impossible de savoir lequel est l'annonce.
    if (total === 0 || total > maxCand) {
      cache.set(cacheKey, null);
      return null;
    }

    const first = results[0];
    if (!first) {
      cache.set(cacheKey, null);
      return null;
    }

    // Score BAN < 0.4 = géocodage incertain (ex : adresse non normalisée).
    // On l'accepte quand même mais on le passe au caller pour info.
    const scoreBan =
      typeof first.score_ban === "number" ? first.score_ban : null;
    if (!first.adresse_ban || typeof first.adresse_ban !== "string") {
      cache.set(cacheKey, null);
      return null;
    }

    const match: AdemeDpeMatch = {
      numero_dpe: String(first.numero_dpe ?? ""),
      date_etablissement_dpe: String(first.date_etablissement_dpe ?? ""),
      etiquette_dpe: String(first.etiquette_dpe ?? ""),
      surface_habitable_logement: Number(first.surface_habitable_logement ?? 0),
      adresse_ban: first.adresse_ban,
      numero_voie_ban:
        typeof first.numero_voie_ban === "string"
          ? first.numero_voie_ban
          : null,
      nom_rue_ban:
        typeof first.nom_rue_ban === "string" ? first.nom_rue_ban : null,
      code_postal_ban: String(first.code_postal_ban ?? codePostal),
      nom_commune_ban: String(first.nom_commune_ban ?? ""),
      code_insee_ban:
        typeof first.code_insee_ban === "string"
          ? first.code_insee_ban
          : null,
      score_ban: scoreBan,
      totalCandidates: total,
    };
    cache.set(cacheKey, match);
    return match;
  } catch (err) {
    console.warn(`findAdemeDpe(${cacheKey}) failed:`, err);
    cache.set(cacheKey, null);
    return null;
  }
}
