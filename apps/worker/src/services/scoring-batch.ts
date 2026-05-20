// Scoring helper réutilisable pour analyze + watch-scout.
//
// Le pipeline d'analyse a son propre flux `scoreListings` qui :
//   1. lit les listings + lookups DVF/OLL/Géorisques par item (N+1 queries)
//   2. compute → upsert listing_scores
//
// Pour le watch-scout on a besoin d'un flux différent :
//   - on travaille sur des ListingInsert (raw mapped, pas de id listings/listing_scores)
//   - on score INLINE pour avoir un current_score réel sur watch_listings
//   - on bénéficie de batching par (code_insee, type) pour limiter les queries
//
// Ce module factorise la logique de lookup batché DVF/OLL/Géorisques pour
// éviter le N+1 sur des batchs de 100-300 items.

import {
  computeScore,
  type StrategyType,
  type TravauxTolerance,
} from "@immoscan/shared";

import { supabaseData } from "@/lib/supabase";

export interface ScoringContext {
  /** Médians DVF par (code_insee, type_local). */
  dvfMedianByKey: Map<string, number>;
  /** Loyers médians OLL par (code_insee, type_logement, pieces_bucket). */
  loyerM2MedianByKey: Map<string, number>;
  /** Risques Géorisques par code_insee. */
  georisquesByInsee: Map<
    string,
    {
      has_ppri: boolean;
      retrait_argile_niveau: "nul" | "faible" | "moyen" | "fort" | null;
      sismicite: number | null;
      radon: number | null;
    }
  >;
}

export interface ScoringInputItem {
  code_insee: string | null;
  type: "appartement" | "maison" | "terrain" | "immeuble" | string;
  pieces: number | null;
}

/**
 * Précharge en batch toutes les données externes nécessaires au scoring d'un
 * lot d'items. Une seule query par dimension (DVF, OLL, Géorisques) au lieu
 * de N×3 queries.
 */
export async function preloadScoringContext(
  items: ScoringInputItem[],
): Promise<ScoringContext> {
  const inseeSet = new Set<string>();
  for (const it of items) {
    if (it.code_insee) inseeSet.add(it.code_insee);
  }
  const insees = [...inseeSet];

  if (insees.length === 0) {
    return {
      dvfMedianByKey: new Map(),
      loyerM2MedianByKey: new Map(),
      georisquesByInsee: new Map(),
    };
  }

  // 1) DVF médians commune × type
  const { data: dvf } = await supabaseData
    .from("dvf_medians_commune")
    .select("code_commune, type_local, median_prix_m2, annee")
    .in("code_commune", insees)
    .order("annee", { ascending: false });
  const dvfMedianByKey = new Map<string, number>();
  for (const row of dvf ?? []) {
    const key = `${row.code_commune}:${row.type_local}`;
    // Si on a déjà la plus récente (order desc), skip les suivants
    if (!dvfMedianByKey.has(key) && row.median_prix_m2 != null) {
      dvfMedianByKey.set(key, Number(row.median_prix_m2));
    }
  }

  // 2) OLL loyers médians par (insee, type, pieces_bucket)
  const { data: oll } = await supabaseData
    .from("oll_loyers_medians")
    .select(
      "code_zonage_oll, type_logement, nombre_pieces, loyer_m2_median, annee",
    )
    .in("code_zonage_oll", insees)
    .order("annee", { ascending: false });
  const loyerM2MedianByKey = new Map<string, number>();
  for (const row of oll ?? []) {
    const key = `${row.code_zonage_oll}:${row.type_logement}:${row.nombre_pieces}`;
    if (!loyerM2MedianByKey.has(key) && row.loyer_m2_median != null) {
      loyerM2MedianByKey.set(key, Number(row.loyer_m2_median));
    }
  }

  // 3) Géorisques par insee
  const { data: geo } = await supabaseData
    .from("georisques_communes")
    .select(
      "code_commune, has_ppri, retrait_argile_niveau, sismicite, radon",
    )
    .in("code_commune", insees);
  const georisquesByInsee = new Map<string, ScoringContext["georisquesByInsee"] extends Map<string, infer T> ? T : never>();
  for (const row of geo ?? []) {
    georisquesByInsee.set(row.code_commune, {
      has_ppri: row.has_ppri ?? false,
      retrait_argile_niveau:
        (row.retrait_argile_niveau as "nul" | "faible" | "moyen" | "fort" | null) ?? null,
      sismicite: row.sismicite,
      radon: row.radon,
    });
  }

  return { dvfMedianByKey, loyerM2MedianByKey, georisquesByInsee };
}

export interface ScoreSingleParams {
  prix: number;
  surface: number;
  type: "appartement" | "maison" | "terrain" | "immeuble";
  dpe: string | null;
  pieces: number | null;
  etage: number | null;
  balcon: boolean;
  terrasse: boolean;
  parking: boolean;
  is_new_construction: boolean;
  code_insee: string | null;
  /** User params (apport, taux, etc.) — lus depuis user_params. */
  strategy: StrategyType;
  apport: number;
  taux_credit_pct: number;
  duree_credit_ans: number;
  tmi_pct: number;
  rendement_min_pct: number;
  tolerance_travaux: TravauxTolerance;
}

export interface ScoreSingleResult {
  score_total: number;
  sub_scores: {
    prix: number;
    rendement: number;
    cashflow: number;
    dpe: number;
    quartier: number;
    risques: number;
  };
  financial: {
    prix_marche_estime: number | null;
    ecart_prix_pct: number | null;
    loyer_estime: number | null;
    loyer_m2_estime: number | null;
    rendement_brut_pct: number | null;
    rendement_net_pct: number | null;
    rendement_net_net_pct: number | null;
    cashflow_mensuel: number | null;
    mensualite_credit: number | null;
    frais_notaire: number | null;
    cout_total_acquisition: number | null;
  };
}

/**
 * Score un seul listing avec un contexte préchargé. Pure logic + lookup
 * in-memory dans `ctx`. Retourne null si surface invalide (skip).
 */
export function scoreSingleListing(
  args: ScoreSingleParams,
  ctx: ScoringContext,
): ScoreSingleResult | null {
  const surface = Number(args.surface);
  if (!Number.isFinite(surface) || surface <= 0) return null;

  // Lookup DVF
  const typeKeyDvf =
    args.type === "maison" ? "Maison" : args.type === "appartement" ? "Appartement" : args.type;
  const dvfKey = args.code_insee ? `${args.code_insee}:${typeKeyDvf}` : null;
  const prixMedianCommune = dvfKey ? ctx.dvfMedianByKey.get(dvfKey) ?? null : null;

  // Lookup OLL (par bucket pieces)
  let loyerM2MedianZone: number | null = null;
  if (args.code_insee && args.pieces != null) {
    const piecesNum = Math.max(1, Math.floor(Number(args.pieces)));
    const piecesBucket = piecesNum >= 4 ? "4_plus" : String(piecesNum);
    const typeKeyOll = args.type === "maison" ? "maison" : "appartement";
    const ollKey = `${args.code_insee}:${typeKeyOll}:${piecesBucket}`;
    loyerM2MedianZone = ctx.loyerM2MedianByKey.get(ollKey) ?? null;
  }

  // Lookup Géorisques
  const geo = args.code_insee ? ctx.georisquesByInsee.get(args.code_insee) : null;

  const dpe = args.dpe as "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;

  return computeScore({
    prix: Number(args.prix),
    surface,
    type:
      args.type === "maison" || args.type === "terrain" || args.type === "immeuble"
        ? args.type
        : "appartement",
    dpe,
    etage: args.etage,
    balcon: args.balcon,
    terrasse: args.terrasse,
    parking: args.parking,
    is_new_construction: args.is_new_construction,
    prix_m2_median_commune: prixMedianCommune,
    prix_m2_median_iris: null,
    loyer_m2_median_zone: loyerM2MedianZone,
    strategy: args.strategy,
    apport: args.apport,
    taux_credit_pct: args.taux_credit_pct,
    duree_credit_ans: args.duree_credit_ans,
    tmi_pct: args.tmi_pct,
    rendement_min_pct: args.rendement_min_pct,
    tolerance_travaux: args.tolerance_travaux,
    has_ppri: geo?.has_ppri ?? false,
    retrait_argile_niveau: geo?.retrait_argile_niveau ?? null,
    sismicite: geo?.sismicite ?? null,
    radon: geo?.radon ?? null,
  });
}
