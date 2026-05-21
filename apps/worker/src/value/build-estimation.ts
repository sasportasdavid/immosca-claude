// Worker `value-build-estimation` — build du dossier d'estimation
// (13 sources) puis valorisation Claude argumentée.
//
// Cf IMMOVALUE_CLAUDE_CODE_SPEC.md §5.1 + §3.4 + §3.5.
//
// Synchrone : déclenché par l'API `/value/estimer` ou par
// `value-apify-user-comparables` quand les liens user sont chargés.
//
// Idempotent par run (`valos_historique` reçoit une nouvelle ligne par
// run, et `biens.valo_courante` est upserté). Si on retrigger sur le
// même `bien_id`, on a une nouvelle valo + historique — comportement
// voulu pour la veille hebdo.

import {
  type ActiveComparable,
  type DossierLoaders,
  type DpeAdresse,
  type DpeSector,
  type DvfComparable,
  type GeoSource,
  type Georisques,
  type IrisContext,
  type Noise,
  type OllMarket,
  type PrixTrend,
  type Schools,
  type Transports,
  type UserComparable,
  type BienInput,
  BienInputSchema,
  buildDossierEstimation,
  claudeValorisation,
} from "@immoscan/shared/value";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { z } from "zod";

import { Sentry } from "@/lib/sentry";
import { supabaseApp, supabaseData } from "@/lib/supabase";
import { findAdemeDpe } from "@/services/ademe";
import {
  ACTOR_BY_SITE,
  runApifyActor,
} from "@/services/apify";
import { banGeocode } from "@/services/ban";
import { callClaudeStructured } from "@/services/claude";
import { analyzePhotos } from "@/services/claude-vision";

const payloadSchema = z.object({
  bien_id: z.string().uuid(),
  /** Origine de l'estimation — tracée dans `valos_historique.trigger`. */
  trigger: z
    .enum([
      "initial",
      "weekly_recompute",
      "monthly_recompute",
      "manual_refresh",
      "photo_updated",
      "bien_data_updated",
      "user_links_updated",
    ])
    .default("initial"),
});

// ──────────────────────────────────────────────────────────────────
// Loaders (PR-V6 : RPCs immoscan-data + Apify active comparables)
// ──────────────────────────────────────────────────────────────────
//
// 10 stubs PR-V1 ont été remplacés par de vrais appels :
//   - 8 RPCs sur immoscan-data (rpc_dvf_comparables, rpc_iris_context,
//     rpc_oll_market, rpc_dpe_sector_average, rpc_georisques,
//     rpc_transports, rpc_noise, rpc_prix_trend) ;
//   - 1 source Apify pour les annonces actives (réutilise ACTOR_BY_SITE
//     SeLoger via une URL de recherche construite à la volée) ;
//   - 1 lookup PostGIS pour le code IRIS du point géocodé.
//
// Politique d'erreur : chaque loader est wrappé `withFallback` — si
// la source échoue, on log Sentry (sans PII) et on renvoie un objet
// "vide" valide pour le schéma Zod (null sur tous les champs optionnels,
// arrays vides). Jamais bloquer le dossier complet pour une source en
// panne — Claude voit l'absence de data et n'invente pas.

// Helper générique pour wrapper un loader avec fallback + Sentry log.
async function withFallback<T>(
  source: string,
  fn: () => Promise<T>,
  fallback: T,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { worker: "value-build-estimation", source },
      extra: context ?? {},
    });
    logger.warn(`loader ${source} failed, using fallback`, {
      err: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

// Lookup PostGIS pour récupérer le code_iris depuis (lat, lng). Le citycode
// BAN est le code_commune (5 digits) — l'IRIS est plus fin (9 digits).
// Si insee_iris est vide ou point hors polygones, on tombe sur le
// fallback `{citycode}0000`.
async function lookupCodeIris(
  lat: number,
  lng: number,
  citycode: string,
): Promise<string> {
  const { data, error } = await supabaseData.rpc("rpc_iris_context", {
    p_lat: lat,
    p_lng: lng,
  });
  if (error) {
    logger.warn("rpc_iris_context (lookup) failed", { err: error.message });
    return citycode ? `${citycode}0000` : "";
  }
  const first = (data ?? [])[0];
  if (first?.code_iris) return first.code_iris;
  return citycode ? `${citycode}0000` : "";
}

async function geocodeLoader(address: string): Promise<GeoSource> {
  const geo = await banGeocode(address);
  const citycode = geo.citycode ?? "";
  const codeIris = await lookupCodeIris(geo.latitude, geo.longitude, citycode);
  return {
    lat: geo.latitude,
    lng: geo.longitude,
    codeInsee: citycode,
    codeIris,
    adresseNormalisee: geo.label,
  };
}

async function fetchDpeBienLoader(
  address: string,
  bien: BienInput,
): Promise<DpeAdresse | null> {
  // findAdemeDpe a besoin de (codePostal, classeDpe, surface). On l'utilise
  // si l'user a déclaré son DPE — sinon stub.
  if (!bien.dpe) return null;
  // Extraire le CP depuis l'adresse (regex 5 chiffres)
  const cpMatch = address.match(/\b(\d{5})\b/);
  if (!cpMatch) return null;
  const match = await findAdemeDpe({
    codePostal: cpMatch[1] ?? "",
    classeDpe: bien.dpe,
    surface: bien.surface_carrez,
  });
  if (!match) return null;
  return {
    numero_dpe: match.numero_dpe,
    etiquette_dpe: match.etiquette_dpe as DpeAdresse["etiquette_dpe"],
    etiquette_ges: null,
    date_etablissement_dpe: match.date_etablissement_dpe,
    surface_habitable: match.surface_habitable_logement,
    conso_5_usages_ep_m2: null,
    emission_ges_5_usages_m2: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// DVF comparables : rpc_dvf_comparables sur immoscan-data
// ──────────────────────────────────────────────────────────────────
async function dvfComparablesLoader(
  geo: GeoSource,
  bien: BienInput,
): Promise<DvfComparable[]> {
  return withFallback(
    "rpc_dvf_comparables",
    async () => {
      const { data, error } = await supabaseData.rpc("rpc_dvf_comparables", {
        p_lat: geo.lat,
        p_lng: geo.lng,
        p_surface_m2: bien.surface_carrez,
        p_type_bien: bien.typologie,
        p_rayon_m: 2000,
      });
      if (error) throw new Error(`rpc_dvf_comparables: ${error.message}`);
      return (data ?? []).map((r): DvfComparable => ({
        ref: r.ref,
        date_mutation: r.date_mutation,
        prix: Number(r.prix),
        surface: Number(r.surface),
        prix_m2: r.prix_m2 == null ? 0 : Number(r.prix_m2),
        typologie: r.typologie,
        distance_m: r.distance_m == null ? null : Number(r.distance_m),
        code_iris: r.code_iris ?? null,
      }));
    },
    [],
    { code_iris: geo.codeIris, surface: bien.surface_carrez },
  );
}

// ──────────────────────────────────────────────────────────────────
// Active comparables : scrape live SeLoger via Apify (10-20 annonces).
// ──────────────────────────────────────────────────────────────────
// Stratégie : on construit une URL de recherche SeLoger filtrée par
// code postal + type bien + surface ±25% et on appelle l'actor SeLoger
// configuré dans ACTOR_BY_SITE. Cap dur à 20 résultats. Si rien ne sort
// (CP non-IDF, actor down, etc.) on fallback à [].

function buildSelogerSearchUrl(geo: GeoSource, bien: BienInput): string {
  // Format SeLoger : places=[{cp:XXXXX}], price=NaN/NaN, types=1(appart) ou 2(maison)
  const typeCode = bien.typologie === "maison" ? "2" : "1";
  const cp = geo.codeInsee && geo.codeInsee.length === 5 ? geo.codeInsee : "";
  const places = cp
    ? encodeURIComponent(JSON.stringify([{ cp }]))
    : encodeURIComponent(JSON.stringify([]));
  const surfaceMin = Math.max(9, Math.round(bien.surface_carrez * 0.75));
  const surfaceMax = Math.round(bien.surface_carrez * 1.25);
  return (
    `https://www.seloger.com/list.htm?projects=2,5&types=${typeCode}` +
    `&places=${places}&surface=${surfaceMin}/${surfaceMax}` +
    `&qsVersion=1.0`
  );
}

async function activeComparablesLoader(
  geo: GeoSource,
  bien: BienInput,
): Promise<ActiveComparable[]> {
  return withFallback(
    "apify_active_comparables",
    async () => {
      if (!process.env.APIFY_TOKEN) {
        logger.info("APIFY_TOKEN absent — skip active comparables");
        return [];
      }
      const plan = ACTOR_BY_SITE.seloger;
      if (!plan) {
        throw new Error("ACTOR_BY_SITE.seloger non configuré");
      }
      const searchUrl = buildSelogerSearchUrl(geo, bien);
      const cap = 20;
      const runInput = await Promise.resolve(plan.buildInput(searchUrl, cap));
      const result = await runApifyActor<Record<string, unknown>>({
        actorId: plan.actorId,
        runInput,
        timeoutSecs: 300,
        memoryMbytes: 2048,
      });

      return result.items.slice(0, cap).flatMap((raw): ActiveComparable[] => {
        const r = raw as Record<string, unknown>;
        const url = typeof r.url === "string" ? r.url : null;
        const prix = toNumber(r.price ?? r.prix);
        const surface = toNumber(r.surface ?? r.area);
        const prix_m2 =
          prix != null && surface != null && surface > 0 ? prix / surface : null;
        if (!url || prix == null) return [];
        // Validation URL stricte (Zod refuse les URLs invalides)
        try {
          new URL(url);
        } catch {
          return [];
        }
        return [
          {
            ref: String(r.id ?? r.listingId ?? url),
            url,
            source: "seloger" as const,
            prix,
            surface: surface ?? null,
            prix_m2,
            typologie:
              typeof r.propertyType === "string" ? r.propertyType : null,
            dpe: normalizeDpe(r.energyClass),
            distance_m: null,
            date_publication:
              typeof r.publicationDate === "string" ? r.publicationDate : null,
          },
        ];
      });
    },
    [],
    { code_postal: geo.codeInsee, surface: bien.surface_carrez },
  );
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDpe(v: unknown): DpeAdresse["etiquette_dpe"] | null {
  if (typeof v !== "string") return null;
  const upper = v.trim().toUpperCase();
  if (["A", "B", "C", "D", "E", "F", "G"].includes(upper)) {
    return upper as DpeAdresse["etiquette_dpe"];
  }
  return null;
}

async function userProvidedComparablesLoader(
  bien_id: string,
): Promise<UserComparable[]> {
  // Lit ce qui est déjà persisté par `value-apify-user-comparables`.
  // Via RPC publique (schéma value pas exposé via PostgREST → SDK
  // rejette .schema("value") même en service_role).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseApp as any).rpc(
    "value_user_comparables_get",
    { p_bien_id: bien_id },
  );
  if (error) {
    logger.warn("user_provided_comparables fetch failed", {
      bien_id,
      err: error.message,
    });
    return [];
  }
  return (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => ({
      url_source: String(row.url_source),
      marketplace: row.marketplace as "seloger" | "leboncoin",
      scraped_at: String(row.scraped_at),
      truncated: Boolean(row.truncated),
      items: Array.isArray(row.items) ? row.items : [],
    }),
  );
}

// ──────────────────────────────────────────────────────────────────
// IRIS context : rpc_iris_context(lat, lng) sur immoscan-data
// ──────────────────────────────────────────────────────────────────
// L'interface DossierLoaders fournit `codeIris` mais nous avons besoin
// de (lat, lng) car la PostGIS contains se fait sur la géométrie. On
// les récupère depuis le geo retourné par geocodeLoader, exposé via
// une closure côté task (cf section task plus bas).
function makeIrisContextLoader(geo: GeoSource) {
  return async (codeIris: string): Promise<IrisContext> =>
    withFallback(
      "rpc_iris_context",
      async () => {
        const { data, error } = await supabaseData.rpc("rpc_iris_context", {
          p_lat: geo.lat,
          p_lng: geo.lng,
        });
        if (error) throw new Error(`rpc_iris_context: ${error.message}`);
        const first = (data ?? [])[0];
        if (!first) {
          return {
            code_iris: codeIris,
            nom_iris: null,
            population: null,
            revenu_median: null,
            taux_pauvrete: null,
            pct_proprietaires: null,
            pct_residences_principales: null,
            pct_logements_collectifs: null,
            age_median: null,
          };
        }
        return {
          code_iris: first.code_iris ?? codeIris,
          nom_iris: first.nom_iris ?? null,
          population: first.population == null ? null : Number(first.population),
          revenu_median:
            first.revenu_median == null ? null : Number(first.revenu_median),
          taux_pauvrete:
            first.taux_pauvrete == null ? null : Number(first.taux_pauvrete),
          pct_proprietaires:
            first.pct_proprietaires == null
              ? null
              : Number(first.pct_proprietaires),
          pct_residences_principales:
            first.pct_residences_principales == null
              ? null
              : Number(first.pct_residences_principales),
          pct_logements_collectifs:
            first.pct_logements_collectifs == null
              ? null
              : Number(first.pct_logements_collectifs),
          age_median: first.age_median == null ? null : Number(first.age_median),
        };
      },
      {
        code_iris: codeIris,
        nom_iris: null,
        population: null,
        revenu_median: null,
        taux_pauvrete: null,
        pct_proprietaires: null,
        pct_residences_principales: null,
        pct_logements_collectifs: null,
        age_median: null,
      },
    );
}

// ──────────────────────────────────────────────────────────────────
// OLL rental market : rpc_oll_market
// ──────────────────────────────────────────────────────────────────
async function rentalMarketLoader(
  codeInsee: string,
  typologie: string,
): Promise<OllMarket> {
  return withFallback(
    "rpc_oll_market",
    async () => {
      const { data, error } = await supabaseData.rpc("rpc_oll_market", {
        p_code_insee: codeInsee,
        p_type_bien: typologie,
      });
      if (error) throw new Error(`rpc_oll_market: ${error.message}`);
      const first = (data ?? [])[0];
      if (!first) {
        return {
          code_insee: codeInsee,
          typologie,
          loyer_median_m2: null,
          loyer_p25_m2: null,
          loyer_p75_m2: null,
          source: "stub" as const,
          annee_reference: null,
        };
      }
      const src: OllMarket["source"] =
        first.source === "oll" || first.source === "olap" || first.source === "scraping"
          ? first.source
          : "stub";
      return {
        code_insee: first.code_insee ?? codeInsee,
        typologie: first.typologie ?? typologie,
        loyer_median_m2:
          first.loyer_median_m2 == null ? null : Number(first.loyer_median_m2),
        loyer_p25_m2:
          first.loyer_p25_m2 == null ? null : Number(first.loyer_p25_m2),
        loyer_p75_m2:
          first.loyer_p75_m2 == null ? null : Number(first.loyer_p75_m2),
        source: src,
        annee_reference:
          first.annee_reference == null ? null : Number(first.annee_reference),
      };
    },
    {
      code_insee: codeInsee,
      typologie,
      loyer_median_m2: null,
      loyer_p25_m2: null,
      loyer_p75_m2: null,
      source: "stub" as const,
      annee_reference: null,
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// DPE sector : rpc_dpe_sector_average
// ──────────────────────────────────────────────────────────────────
async function dpeSectorLoader(
  codeIris: string,
  typologie: string,
): Promise<DpeSector> {
  return withFallback(
    "rpc_dpe_sector_average",
    async () => {
      const { data, error } = await supabaseData.rpc("rpc_dpe_sector_average", {
        // Le RPC accepte code_iris ou code_insee : il tronque sur 5 digits.
        p_code_insee: codeIris,
        p_type_bien: typologie,
      });
      if (error) throw new Error(`rpc_dpe_sector_average: ${error.message}`);
      const first = (data ?? [])[0];
      if (!first) {
        return {
          code_iris: codeIris,
          typologie,
          distribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
          classe_mediane: null,
          echantillon_size: 0,
        };
      }
      const cm = normalizeDpe(first.classe_mediane);
      return {
        code_iris: first.code_iris ?? codeIris,
        typologie: first.typologie ?? typologie,
        distribution: {
          A: Number(first.count_a ?? 0),
          B: Number(first.count_b ?? 0),
          C: Number(first.count_c ?? 0),
          D: Number(first.count_d ?? 0),
          E: Number(first.count_e ?? 0),
          F: Number(first.count_f ?? 0),
          G: Number(first.count_g ?? 0),
        },
        classe_mediane: cm,
        echantillon_size: Number(first.echantillon_size ?? 0),
      };
    },
    {
      code_iris: codeIris,
      typologie,
      distribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
      classe_mediane: null,
      echantillon_size: 0,
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// Géorisques : rpc_georisques(code_insee). DossierLoaders fournit (lat,
// lng) — on a besoin du codeInsee qui est dans geo. Closure.
// ──────────────────────────────────────────────────────────────────
function makeGeorisquesLoader(geo: GeoSource) {
  return async (_lat: number, _lng: number): Promise<Georisques> =>
    withFallback(
      "rpc_georisques",
      async () => {
        const { data, error } = await supabaseData.rpc("rpc_georisques", {
          p_code_insee: geo.codeInsee,
        });
        if (error) throw new Error(`rpc_georisques: ${error.message}`);
        const first = (data ?? [])[0];
        if (!first) {
          return {
            ppri_inondation: null,
            ppri_mouvement_terrain: null,
            argile_aleas: null,
            sismicite_zone: null,
            radon_potentiel: null,
            basol_proche_m: null,
            remarques: [],
          };
        }
        const argile = normalizeArgile(first.argile_aleas);
        const radon = normalizeRadon(first.radon_potentiel);
        return {
          ppri_inondation: first.ppri_inondation,
          ppri_mouvement_terrain: first.ppri_mouvement_terrain,
          argile_aleas: argile,
          sismicite_zone:
            first.sismicite_zone == null ? null : Number(first.sismicite_zone),
          radon_potentiel: radon,
          basol_proche_m:
            first.basol_proche_m == null ? null : Number(first.basol_proche_m),
          remarques: Array.isArray(first.remarques) ? first.remarques : [],
        };
      },
      {
        ppri_inondation: null,
        ppri_mouvement_terrain: null,
        argile_aleas: null,
        sismicite_zone: null,
        radon_potentiel: null,
        basol_proche_m: null,
        remarques: [],
      },
    );
}

function normalizeArgile(v: unknown): Georisques["argile_aleas"] {
  if (v === "faible" || v === "moyen" || v === "fort") return v;
  return null;
}

function normalizeRadon(v: unknown): Georisques["radon_potentiel"] {
  if (v === "faible" || v === "moyen" || v === "significatif") return v;
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Transports : rpc_transports (stub PR-V6, à brancher GTFS PR-V7)
// ──────────────────────────────────────────────────────────────────
async function transportsLoader(lat: number, lng: number): Promise<Transports> {
  return withFallback(
    "rpc_transports",
    async () => {
      const { data, error } = await supabaseData.rpc("rpc_transports", {
        p_lat: lat,
        p_lng: lng,
        p_rayon_m: 500,
      });
      if (error) throw new Error(`rpc_transports: ${error.message}`);
      const first = (data ?? [])[0];
      if (!first) {
        return {
          metro_proche: null,
          rer_proche: null,
          bus_proche: null,
          gare_proche: null,
          isochrone_15min_paris: null,
          commerces_500m: 0,
          services_500m: 0,
        };
      }
      return {
        metro_proche:
          first.metro_ligne && first.metro_distance_m != null
            ? {
                ligne: first.metro_ligne,
                distance_m: Number(first.metro_distance_m),
              }
            : null,
        rer_proche:
          first.rer_ligne && first.rer_distance_m != null
            ? {
                ligne: first.rer_ligne,
                distance_m: Number(first.rer_distance_m),
              }
            : null,
        bus_proche:
          first.bus_ligne && first.bus_distance_m != null
            ? {
                ligne: first.bus_ligne,
                distance_m: Number(first.bus_distance_m),
              }
            : null,
        gare_proche:
          first.gare_nom && first.gare_distance_m != null
            ? {
                nom: first.gare_nom,
                distance_m: Number(first.gare_distance_m),
              }
            : null,
        isochrone_15min_paris: first.isochrone_15min_paris ?? null,
        commerces_500m: Number(first.commerces_500m ?? 0),
        services_500m: Number(first.services_500m ?? 0),
      };
    },
    {
      metro_proche: null,
      rer_proche: null,
      bus_proche: null,
      gare_proche: null,
      isochrone_15min_paris: null,
      commerces_500m: 0,
      services_500m: 0,
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// Schools : pas de RPC PR-V6, on lit directement education_etablissements
// si peuplée. Sinon stub.
// ──────────────────────────────────────────────────────────────────
async function schoolsLoader(codeInsee: string): Promise<Schools> {
  return withFallback(
    "education_etablissements",
    async () => {
      const { data, error } = await supabaseData
        .from("education_etablissements")
        .select("nom_etablissement, type_etablissement, ips")
        .eq("code_commune", codeInsee);
      if (error) throw new Error(`education_etablissements: ${error.message}`);
      const rows = data ?? [];
      const ecole =
        rows.find((r) => r.type_etablissement === "ecole") ?? null;
      const college =
        rows.find((r) => r.type_etablissement === "college") ?? null;
      const lycee =
        rows.find((r) => r.type_etablissement === "lycee") ?? null;
      return {
        ecole_primaire: ecole
          ? {
              nom: ecole.nom_etablissement,
              distance_m: 0, // distance non calculée sans geom du bien
              ips: ecole.ips == null ? null : Number(ecole.ips),
            }
          : null,
        college: college
          ? {
              nom: college.nom_etablissement,
              distance_m: 0,
              ips: college.ips == null ? null : Number(college.ips),
            }
          : null,
        lycee: lycee
          ? {
              nom: lycee.nom_etablissement,
              distance_m: 0,
              ips: lycee.ips == null ? null : Number(lycee.ips),
            }
          : null,
      };
    },
    {
      ecole_primaire: null,
      college: null,
      lycee: null,
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// Noise : rpc_noise (stub PR-V6)
// ──────────────────────────────────────────────────────────────────
async function noiseLoader(lat: number, lng: number): Promise<Noise> {
  return withFallback(
    "rpc_noise",
    async () => {
      const { data, error } = await supabaseData.rpc("rpc_noise", {
        p_lat: lat,
        p_lng: lng,
      });
      if (error) throw new Error(`rpc_noise: ${error.message}`);
      const first = (data ?? [])[0];
      if (!first) {
        return {
          lden_db: null,
          categorie: null,
          source_bruit_principale: null,
        };
      }
      return {
        lden_db: first.lden_db == null ? null : Number(first.lden_db),
        categorie: normalizeNoiseCat(first.categorie),
        source_bruit_principale: normalizeNoiseSource(
          first.source_bruit_principale,
        ),
      };
    },
    {
      lden_db: null,
      categorie: null,
      source_bruit_principale: null,
    },
  );
}

function normalizeNoiseCat(v: unknown): Noise["categorie"] {
  if (v === "calme" || v === "modere" || v === "bruyant" || v === "tres_bruyant")
    return v;
  return null;
}

function normalizeNoiseSource(v: unknown): Noise["source_bruit_principale"] {
  if (v === "route" || v === "rail" || v === "aerien" || v === "industrie" || v === "autre")
    return v;
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Prix trend : rpc_prix_trend(code_insee). Worker calcule trend_5y/1y.
// ──────────────────────────────────────────────────────────────────
async function prixTrendLoader(
  codeIris: string,
  typologie: string,
): Promise<PrixTrend> {
  return withFallback(
    "rpc_prix_trend",
    async () => {
      const { data, error } = await supabaseData.rpc("rpc_prix_trend", {
        p_code_insee: codeIris,
        p_type_bien: typologie,
      });
      if (error) throw new Error(`rpc_prix_trend: ${error.message}`);
      const rows = (data ?? [])
        .map((r) => ({
          annee: Number(r.annee),
          prix_m2_median: Number(r.prix_m2_median),
        }))
        .filter(
          (r) => Number.isFinite(r.annee) && Number.isFinite(r.prix_m2_median),
        )
        .sort((a, b) => a.annee - b.annee);

      const first = rows[0];
      const last = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      const trend_5y_pct =
        first && last && first.prix_m2_median > 0
          ? ((last.prix_m2_median - first.prix_m2_median) /
              first.prix_m2_median) *
            100
          : null;
      const trend_1y_pct =
        prev && last && prev.prix_m2_median > 0
          ? ((last.prix_m2_median - prev.prix_m2_median) / prev.prix_m2_median) *
            100
          : null;

      return {
        code_iris: codeIris,
        typologie,
        prix_m2_par_annee: rows,
        trend_5y_pct,
        trend_1y_pct,
      };
    },
    {
      code_iris: codeIris,
      typologie,
      prix_m2_par_annee: [],
      trend_5y_pct: null,
      trend_1y_pct: null,
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// Task
// ──────────────────────────────────────────────────────────────────

export const valueBuildEstimation = task({
  id: "value-build-estimation",
  maxDuration: 120,
  retry: { maxAttempts: 2, minTimeoutInMs: 5_000 },
  run: async (rawPayload: unknown) => {
    const payload = payloadSchema.parse(rawPayload);
    logger.info("value-build-estimation start", payload);

    // 1. Lit le bien depuis value.biens via RPC publique (schéma value
    //    pas exposé via PostgREST → SDK rejette .schema("value")).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bienRows, error } = await (supabaseApp as any).rpc(
      "value_bien_load_for_worker",
      { p_bien_id: payload.bien_id },
    );
    const bienRow = Array.isArray(bienRows) ? bienRows[0] : bienRows;

    if (error || !bienRow) {
      const msg = `Bien introuvable: ${payload.bien_id} (${error?.message ?? "no row"})`;
      logger.error(msg);
      throw new Error(msg);
    }

    const bien = BienInputSchema.parse({
      id: bienRow.id,
      address: bienRow.address,
      // bien_data contient les caractéristiques (typologie, surface, etc.)
      ...(bienRow.bien_data ?? {}),
      photos_originales_urls: bienRow.photos_originales_urls ?? [],
    });

    const userProvidedUrls: string[] = bienRow.user_provided_urls ?? [];

    try {
      // 2. Pré-géocodage (les loaders iris/géorisques ont besoin de geo
      //    avant le Promise.all interne de buildDossierEstimation pour
      //    closuriser sur lat/lng/codeInsee — sinon ils devraient se
      //    re-géocoder, ce qui doublerait les appels BAN).
      const geo = await geocodeLoader(bien.address);

      // 3. Build dossier complet (parallèle Promise.all)
      const loaders: DossierLoaders = {
        // geocodeLoader sera ré-appelé par buildDossierEstimation —
        // on lui renvoie le `geo` déjà résolu (idempotent, ~0ms via cache BAN).
        geocode: async () => geo,
        fetchDpeBien: (address) => fetchDpeBienLoader(address, bien),
        analyzePhotos,
        dvfComparables: dvfComparablesLoader,
        activeComparables: activeComparablesLoader,
        userProvidedComparables: () =>
          userProvidedComparablesLoader(bien.id ?? payload.bien_id),
        irisContext: makeIrisContextLoader(geo),
        rentalMarket: rentalMarketLoader,
        dpeSector: dpeSectorLoader,
        georisques: makeGeorisquesLoader(geo),
        transports: transportsLoader,
        schools: schoolsLoader,
        noise: noiseLoader,
        prixTrend: prixTrendLoader,
      };

      const dossier = await buildDossierEstimation(bien, userProvidedUrls, loaders);

      // 3. Claude valorisation
      const { valo, tokensUsed, model } = await claudeValorisation(
        dossier,
        async (opts) => {
          const result = await callClaudeStructured({
            system: opts.system,
            user: opts.user,
            schema: opts.schema,
            toolName: opts.toolName,
            toolDescription: opts.toolDescription,
            maxTokens: opts.maxTokens,
          });
          return result;
        },
      );

      logger.info("value-build-estimation valo done", {
        bien_id: payload.bien_id,
        model,
        tokensUsed,
        delta: valo.valorisation.central,
      });

      // 4. Persistance — saveValoHistorique + updateValoCourante
      // Idéalement transactional, mais supabase-js v2 ne supporte pas
      // les transactions multi-table côté client. On accepte un risque
      // microscopique d'inconsistance (RFP: si l'historique est saved
      // et que valo_courante fail, le prochain build verra l'historique
      // comme "le précédent" et calculera un delta cohérent).

      const valoJson = valo as unknown as Record<string, unknown>;

      // a. Calcul du delta vs valo_courante précédente (already loaded
      //    via value_bien_load_for_worker → bienRow.valo_courante)
      let deltaPct: number | null = null;
      const prevValo = bienRow.valo_courante as
        | { valorisation?: { central?: number } }
        | null;
      if (prevValo?.valorisation?.central) {
        const prev = Number(prevValo.valorisation.central);
        if (Number.isFinite(prev) && prev > 0) {
          deltaPct = ((valo.valorisation.central - prev) / prev) * 100;
        }
      }

      // b+c. Insert historique + UPDATE biens en 1 RPC atomique
      //      (transaction implicite PL/pgSQL).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: histRow, error: saveErr } = await (supabaseApp as any).rpc(
        "value_save_valorisation",
        {
          p_bien_id: payload.bien_id,
          p_valo: valoJson,
          p_delta_pct: deltaPct,
          p_trigger: payload.trigger,
          p_set_initial: payload.trigger === "initial",
        },
      );
      if (saveErr) {
        logger.error("value_save_valorisation RPC failed", {
          err: saveErr.message,
        });
        throw new Error(`save valorisation: ${saveErr.message}`);
      }

      // 5. Si on a des photos originales et pas encore de floutees,
      //    trigger l'async flou (pour préparer le mode discret).
      const photos_originales: string[] = bienRow.photos_originales_urls ?? [];
      const photos_floutees: string[] = bienRow.photos_floutees_urls ?? [];
      if (photos_originales.length > 0 && photos_floutees.length === 0) {
        // tasks.trigger pour éviter une dépendance circulaire d'import
        await tasks.trigger("value-flout-photos", {
          bien_id: payload.bien_id,
        });
      }

      // 6. Si delta dépasse le seuil, trigger l'email alerte
      //    (le worker `value-send-alerte-email` re-check `shouldNotify`
      //    contre `alert_frequency` et `notified_at`).
      if (deltaPct !== null && Math.abs(deltaPct) >= 1) {
        await tasks.trigger("value-send-alerte-email", {
          bien_id: payload.bien_id,
          valo_historique_id: histRow.id,
        });
      }

      return {
        success: true,
        bien_id: payload.bien_id,
        valo_historique_id: histRow.id,
        delta_pct: deltaPct,
        model,
        tokensUsed,
      };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { worker: "value-build-estimation" },
        extra: { bien_id: payload.bien_id, trigger: payload.trigger },
      });
      logger.error("value-build-estimation failed", {
        bien_id: payload.bien_id,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
});
