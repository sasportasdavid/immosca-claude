// Dossier d'estimation ImmoValue : assemblage des 13 sources avant
// soumission à Claude pour valorisation argumentée.
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §3.4.
//
// Logique pure : aucune dépendance worker / db / fetch ici. Le worker
// `value-build-estimation` fournit les loaders (banGeocode, fetchDpe,
// rpcDvfComparables, etc.) en injection lazy via les arguments.

import { z } from "zod";

import { bienTypeSchema, dpeClassSchema } from "../schemas/listing.js";

// ──────────────────────────────────────────────────────────────────
// 1. Bien à estimer (input utilisateur)
// ──────────────────────────────────────────────────────────────────

export const BienInputSchema = z.object({
  id: z.string().uuid().optional(),
  address: z.string().min(3),
  typologie: bienTypeSchema,
  surface_carrez: z.number().positive(),
  pieces: z.number().int().nonnegative().nullable().optional(),
  chambres: z.number().int().nonnegative().nullable().optional(),
  etage: z.number().int().nullable().optional(),
  etage_total: z.number().int().nullable().optional(),
  ascenseur: z.boolean().nullable().optional(),
  balcon: z.boolean().nullable().optional(),
  terrasse: z.boolean().nullable().optional(),
  parking: z.boolean().nullable().optional(),
  cave: z.boolean().nullable().optional(),
  jardin_m2: z.number().nullable().optional(),
  dpe: dpeClassSchema.nullable().optional(),
  ges: dpeClassSchema.nullable().optional(),
  annee_construction: z.number().int().nullable().optional(),
  particularites_uniques: z.string().nullable().optional(),
  description_libre: z.string().nullable().optional(),
  photos_originales_urls: z.array(z.string().url()).default([]),
});
export type BienInput = z.infer<typeof BienInputSchema>;

// ──────────────────────────────────────────────────────────────────
// 2. Geo BAN
// ──────────────────────────────────────────────────────────────────

export const GeoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  codeInsee: z.string(),
  codeIris: z.string(),
  adresseNormalisee: z.string(),
});
export type GeoSource = z.infer<typeof GeoSchema>;

// ──────────────────────────────────────────────────────────────────
// 3. DPE ADEME du bien lui-même
// ──────────────────────────────────────────────────────────────────

export const DpeAdresseSchema = z.object({
  numero_dpe: z.string(),
  etiquette_dpe: dpeClassSchema,
  etiquette_ges: dpeClassSchema.nullable(),
  date_etablissement_dpe: z.string(),
  surface_habitable: z.number(),
  conso_5_usages_ep_m2: z.number().nullable(),
  emission_ges_5_usages_m2: z.number().nullable(),
});
export type DpeAdresse = z.infer<typeof DpeAdresseSchema>;

// ──────────────────────────────────────────────────────────────────
// 4. Photos — analyse Claude vision
// ──────────────────────────────────────────────────────────────────

export const PhotoAnalysisSchema = z.object({
  url: z.string().url(),
  type_piece: z
    .enum([
      "salon",
      "cuisine",
      "chambre",
      "salle_de_bain",
      "wc",
      "entree",
      "couloir",
      "balcon",
      "terrasse",
      "jardin",
      "garage",
      "cave",
      "vue_exterieure",
      "facade",
      "exterieur",
      "autre",
    ])
    .nullable(),
  is_outdoor: z.boolean(),
  etat_general: z
    .enum(["a_renover", "rafraichir", "bon", "tres_bon", "neuf_renove"])
    .nullable(),
  luminosite: z.enum(["sombre", "moyen", "lumineux", "tres_lumineux"]).nullable(),
  qualite_finitions: z
    .enum(["basique", "standard", "qualite", "haut_de_gamme"])
    .nullable(),
  remarques: z.array(z.string()).default([]),
});
export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;

// ──────────────────────────────────────────────────────────────────
// 5. DVF comparables (transactions des 5 dernières années)
// ──────────────────────────────────────────────────────────────────

export const DvfComparableSchema = z.object({
  ref: z.string(),
  date_mutation: z.string(),
  prix: z.number(),
  surface: z.number(),
  prix_m2: z.number(),
  typologie: z.string(),
  distance_m: z.number().nullable(),
  code_iris: z.string().nullable(),
});
export type DvfComparable = z.infer<typeof DvfComparableSchema>;

// ──────────────────────────────────────────────────────────────────
// 6. Active comparables (annonces SeLoger / LBC scrapées en live)
// ──────────────────────────────────────────────────────────────────

export const ActiveComparableSchema = z.object({
  ref: z.string(),
  url: z.string().url(),
  source: z.enum(["seloger", "leboncoin", "pap", "bienici", "logic-immo"]),
  prix: z.number(),
  surface: z.number().nullable(),
  prix_m2: z.number().nullable(),
  typologie: z.string().nullable(),
  dpe: dpeClassSchema.nullable(),
  distance_m: z.number().nullable(),
  date_publication: z.string().nullable(),
});
export type ActiveComparable = z.infer<typeof ActiveComparableSchema>;

// ──────────────────────────────────────────────────────────────────
// 7. ⭐ User-provided comparables (lien SeLoger/LBC fourni par l'user)
// ──────────────────────────────────────────────────────────────────

export const UserComparableSchema = z.object({
  url_source: z.string().url(),
  marketplace: z.enum(["seloger", "leboncoin"]),
  scraped_at: z.string(),
  truncated: z.boolean().default(false),
  items: z.array(
    z.object({
      ref: z.string(),
      url: z.string().url().optional(),
      prix: z.number().nullable(),
      surface: z.number().nullable(),
      prix_m2: z.number().nullable(),
      dpe: dpeClassSchema.nullable().optional(),
      typologie: z.string().nullable().optional(),
      ville: z.string().nullable().optional(),
      code_postal: z.string().nullable().optional(),
      distance_m: z.number().nullable().optional(),
    }),
  ),
});
export type UserComparable = z.infer<typeof UserComparableSchema>;

// ──────────────────────────────────────────────────────────────────
// 8. IRIS INSEE — démographie secteur
// ──────────────────────────────────────────────────────────────────

export const IrisContextSchema = z.object({
  code_iris: z.string(),
  nom_iris: z.string().nullable(),
  population: z.number().nullable(),
  revenu_median: z.number().nullable(),
  taux_pauvrete: z.number().nullable(),
  pct_proprietaires: z.number().nullable(),
  pct_residences_principales: z.number().nullable(),
  pct_logements_collectifs: z.number().nullable(),
  age_median: z.number().nullable(),
});
export type IrisContext = z.infer<typeof IrisContextSchema>;

// ──────────────────────────────────────────────────────────────────
// 9. OLL — marché locatif local
// ──────────────────────────────────────────────────────────────────

export const OllMarketSchema = z.object({
  code_insee: z.string(),
  typologie: z.string(),
  loyer_median_m2: z.number().nullable(),
  loyer_p25_m2: z.number().nullable(),
  loyer_p75_m2: z.number().nullable(),
  source: z.enum(["oll", "olap", "scraping", "stub"]).default("stub"),
  annee_reference: z.number().nullable(),
});
export type OllMarket = z.infer<typeof OllMarketSchema>;

// ──────────────────────────────────────────────────────────────────
// 10. DPE moyen du secteur (pour comparer la classe du bien)
// ──────────────────────────────────────────────────────────────────

export const DpeSectorSchema = z.object({
  code_iris: z.string(),
  typologie: z.string(),
  distribution: z.object({
    A: z.number().default(0),
    B: z.number().default(0),
    C: z.number().default(0),
    D: z.number().default(0),
    E: z.number().default(0),
    F: z.number().default(0),
    G: z.number().default(0),
  }),
  classe_mediane: dpeClassSchema.nullable(),
  echantillon_size: z.number().default(0),
});
export type DpeSector = z.infer<typeof DpeSectorSchema>;

// ──────────────────────────────────────────────────────────────────
// 11. Géorisques
// ──────────────────────────────────────────────────────────────────

export const GeorisquesSchema = z.object({
  ppri_inondation: z.boolean().nullable(),
  ppri_mouvement_terrain: z.boolean().nullable(),
  argile_aleas: z.enum(["faible", "moyen", "fort"]).nullable(),
  sismicite_zone: z.number().nullable(),
  radon_potentiel: z.enum(["faible", "moyen", "significatif"]).nullable(),
  basol_proche_m: z.number().nullable(),
  remarques: z.array(z.string()).default([]),
});
export type Georisques = z.infer<typeof GeorisquesSchema>;

// ──────────────────────────────────────────────────────────────────
// 12. Transports + services (GTFS/OSM)
// ──────────────────────────────────────────────────────────────────

export const TransportsSchema = z.object({
  metro_proche: z
    .object({ ligne: z.string(), distance_m: z.number() })
    .nullable(),
  rer_proche: z
    .object({ ligne: z.string(), distance_m: z.number() })
    .nullable(),
  bus_proche: z
    .object({ ligne: z.string(), distance_m: z.number() })
    .nullable(),
  gare_proche: z
    .object({ nom: z.string(), distance_m: z.number() })
    .nullable(),
  isochrone_15min_paris: z.boolean().nullable(),
  commerces_500m: z.number().default(0),
  services_500m: z.number().default(0),
});
export type Transports = z.infer<typeof TransportsSchema>;

// ──────────────────────────────────────────────────────────────────
// 13. Écoles
// ──────────────────────────────────────────────────────────────────

export const SchoolsSchema = z.object({
  ecole_primaire: z
    .object({ nom: z.string(), distance_m: z.number(), ips: z.number().nullable() })
    .nullable(),
  college: z
    .object({ nom: z.string(), distance_m: z.number(), ips: z.number().nullable() })
    .nullable(),
  lycee: z
    .object({ nom: z.string(), distance_m: z.number(), ips: z.number().nullable() })
    .nullable(),
});
export type Schools = z.infer<typeof SchoolsSchema>;

// ──────────────────────────────────────────────────────────────────
// 14. Bruit Lden
// ──────────────────────────────────────────────────────────────────

export const NoiseSchema = z.object({
  lden_db: z.number().nullable(),
  categorie: z.enum(["calme", "modere", "bruyant", "tres_bruyant"]).nullable(),
  source_bruit_principale: z
    .enum(["route", "rail", "aerien", "industrie", "autre"])
    .nullable(),
});
export type Noise = z.infer<typeof NoiseSchema>;

// ──────────────────────────────────────────────────────────────────
// 15. Tendance prix sur 5 ans
// ──────────────────────────────────────────────────────────────────

export const PrixTrendSchema = z.object({
  code_iris: z.string(),
  typologie: z.string(),
  prix_m2_par_annee: z.array(
    z.object({ annee: z.number(), prix_m2_median: z.number() }),
  ),
  trend_5y_pct: z.number().nullable(),
  trend_1y_pct: z.number().nullable(),
});
export type PrixTrend = z.infer<typeof PrixTrendSchema>;

// ──────────────────────────────────────────────────────────────────
// Composition : DossierEstimation
// ──────────────────────────────────────────────────────────────────

export const DossierEstimationSchema = z.object({
  bien: BienInputSchema,
  geo: GeoSchema,
  dpeBien: DpeAdresseSchema.nullable(),
  photoAnalysis: z.array(PhotoAnalysisSchema),
  dvfComparables: z.array(DvfComparableSchema),
  activeComparables: z.array(ActiveComparableSchema),
  userProvidedComparables: z.array(UserComparableSchema),
  irisContext: IrisContextSchema,
  rentalMarket: OllMarketSchema,
  dpeSector: DpeSectorSchema,
  georisques: GeorisquesSchema,
  transports: TransportsSchema,
  schools: SchoolsSchema,
  noise: NoiseSchema,
  prixTrend: PrixTrendSchema,
});
export type DossierEstimation = z.infer<typeof DossierEstimationSchema>;

// ──────────────────────────────────────────────────────────────────
// Loaders (injection lazy)
// ──────────────────────────────────────────────────────────────────
//
// Le builder est pur : il prend des loaders en argument. Le worker
// les implémente avec ses services (banGeocode, fetchDpe, rpcDvf, ...).
//
// Avantage : on peut le tester avec des mocks et on évite que
// `packages/shared` dépende de `supabaseApp` / `apify` (logique pure).

export interface DossierLoaders {
  geocode: (address: string) => Promise<GeoSource>;
  fetchDpeBien: (address: string) => Promise<DpeAdresse | null>;
  analyzePhotos: (urls: string[]) => Promise<PhotoAnalysis[]>;
  dvfComparables: (geo: GeoSource, bien: BienInput) => Promise<DvfComparable[]>;
  activeComparables: (
    geo: GeoSource,
    bien: BienInput,
  ) => Promise<ActiveComparable[]>;
  userProvidedComparables: (urls: string[]) => Promise<UserComparable[]>;
  irisContext: (codeIris: string) => Promise<IrisContext>;
  rentalMarket: (codeInsee: string, typologie: string) => Promise<OllMarket>;
  dpeSector: (codeIris: string, typologie: string) => Promise<DpeSector>;
  georisques: (lat: number, lng: number) => Promise<Georisques>;
  transports: (lat: number, lng: number) => Promise<Transports>;
  schools: (codeInsee: string) => Promise<Schools>;
  noise: (lat: number, lng: number) => Promise<Noise>;
  prixTrend: (codeIris: string, typologie: string) => Promise<PrixTrend>;
}

export class EstimationError extends Error {
  readonly code: string;
  readonly hint: string | undefined;
  constructor(code: string, hint?: string) {
    super(`${code}${hint ? ` (${hint})` : ""}`);
    this.name = "EstimationError";
    this.code = code;
    this.hint = hint;
  }
}

/**
 * Assemble le dossier d'estimation complet.
 *
 * Stratégie :
 *  1. Géocoder en premier (les autres loaders en dépendent)
 *  2. Lancer le DPE en parallèle du géocodage (best-effort)
 *  3. Lancer les 12 autres sources en parallèle (Promise.all) une fois
 *     le geo connu
 *
 * Si un loader optionnel throw, on log côté worker (Sentry) puis on
 * remonte l'erreur — le caller décide de fail le run ou de continuer.
 * Pour l'instant, on laisse Promise.all faire le travail (1 fail =
 * tout fail). Les stubs sont donc nécessaires pour éviter de bloquer
 * la PR-V1 quand l'immoscan-data n'est pas encore prêt.
 */
export async function buildDossierEstimation(
  bien: BienInput,
  userProvidedUrls: string[],
  loaders: DossierLoaders,
): Promise<DossierEstimation> {
  const geo = await loaders.geocode(bien.address);
  if (!geo) throw new EstimationError("GEOCODE_FAILED", bien.address);

  // DPE en parallèle des autres sources (l'address suffit)
  const dpePromise = loaders.fetchDpeBien(bien.address);

  const [
    dpeBien,
    photoAnalysis,
    dvfComparables,
    activeComparables,
    userProvidedComparables,
    irisContext,
    rentalMarket,
    dpeSector,
    georisques,
    transports,
    schools,
    noise,
    prixTrend,
  ] = await Promise.all([
    dpePromise,
    loaders.analyzePhotos(bien.photos_originales_urls),
    loaders.dvfComparables(geo, bien),
    loaders.activeComparables(geo, bien),
    loaders.userProvidedComparables(userProvidedUrls),
    loaders.irisContext(geo.codeIris),
    loaders.rentalMarket(geo.codeInsee, bien.typologie),
    loaders.dpeSector(geo.codeIris, bien.typologie),
    loaders.georisques(geo.lat, geo.lng),
    loaders.transports(geo.lat, geo.lng),
    loaders.schools(geo.codeInsee),
    loaders.noise(geo.lat, geo.lng),
    loaders.prixTrend(geo.codeIris, bien.typologie),
  ]);

  return DossierEstimationSchema.parse({
    bien,
    geo,
    dpeBien,
    photoAnalysis,
    dvfComparables,
    activeComparables,
    userProvidedComparables,
    irisContext,
    rentalMarket,
    dpeSector,
    georisques,
    transports,
    schools,
    noise,
    prixTrend,
  });
}
