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
import { supabaseApp } from "@/lib/supabase";
import { findAdemeDpe } from "@/services/ademe";
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
// Loaders (stubs + réutilisation services existants)
// ──────────────────────────────────────────────────────────────────
//
// Les stubs renvoient des données vides avec un tag `source: "stub"`
// pour que Claude sache qu'il a moins d'info. Ils seront branchés en
// PR-V2 sur les RPC `value.rpc_*` une fois `immoscan-data` peuplé
// (DVF, IRIS, OLL, Géorisques, transports, écoles, bruit).

async function geocodeLoader(address: string) {
  const geo = await banGeocode(address);
  return {
    lat: geo.latitude,
    lng: geo.longitude,
    codeInsee: geo.citycode ?? "",
    // TODO PR-V2 : enrichir avec le code IRIS via un PostGIS lookup
    // (`insee_iris` géom contains point). Pour l'instant on dérive un
    // pseudo-code IRIS depuis le citycode (commune.0000).
    codeIris: geo.citycode ? `${geo.citycode}0000` : "",
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

// TODO PR-V2 brancher sur RPC immoscan-data
async function dvfComparablesStub(): Promise<DvfComparable[]> {
  return [];
}

// TODO PR-V2 brancher sur Apify SeLoger + LBC en live
async function activeComparablesStub(): Promise<ActiveComparable[]> {
  return [];
}

async function userProvidedComparablesLoader(
  bien_id: string,
): Promise<UserComparable[]> {
  // Lit ce qui est déjà persisté par `value-apify-user-comparables`.
  // Le schéma `value` peut ne pas être typé dans `@immoscan/db` →
  // cast en never pour passer le typecheck (la migration SQL est en
  // cours dans l'agent Schema-Backend).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseApp as any)
    .schema("value")
    .from("user_provided_comparables")
    .select("url_source, marketplace, scraped_at, truncated, items")
    .eq("bien_id", bien_id);
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

async function irisContextStub(codeIris: string): Promise<IrisContext> {
  // TODO PR-V2 brancher sur RPC value.rpc_iris_context(code_iris) dans immoscan-data
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

async function rentalMarketStub(
  codeInsee: string,
  typologie: string,
): Promise<OllMarket> {
  // TODO PR-V2 brancher sur RPC value.rpc_oll_rental_market
  return {
    code_insee: codeInsee,
    typologie,
    loyer_median_m2: null,
    loyer_p25_m2: null,
    loyer_p75_m2: null,
    source: "stub",
    annee_reference: null,
  };
}

async function dpeSectorStub(
  codeIris: string,
  typologie: string,
): Promise<DpeSector> {
  // TODO PR-V2 brancher sur RPC value.rpc_dpe_sector_average
  return {
    code_iris: codeIris,
    typologie,
    distribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
    classe_mediane: null,
    echantillon_size: 0,
  };
}

async function georisquesStub(): Promise<Georisques> {
  // TODO PR-V2 brancher sur API Géorisques + cache value.georisques_communes
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

async function transportsStub(): Promise<Transports> {
  // TODO PR-V2 brancher sur PostGIS GTFS (immoscan-data)
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

async function schoolsStub(): Promise<Schools> {
  // TODO PR-V2 brancher sur data.education.gouv (IPS)
  return {
    ecole_primaire: null,
    college: null,
    lycee: null,
  };
}

async function noiseStub(): Promise<Noise> {
  // TODO PR-V2 brancher sur PostGIS Bruitparif/Cerema
  return {
    lden_db: null,
    categorie: null,
    source_bruit_principale: null,
  };
}

async function prixTrendStub(
  codeIris: string,
  typologie: string,
): Promise<PrixTrend> {
  // TODO PR-V2 brancher sur RPC value.rpc_prix_trend (DVF 5 ans rolling)
  return {
    code_iris: codeIris,
    typologie,
    prix_m2_par_annee: [],
    trend_5y_pct: null,
    trend_1y_pct: null,
  };
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

    // 1. Lit le bien depuis value.biens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bienRow, error } = await (supabaseApp as any)
      .schema("value")
      .from("biens")
      .select(
        "id, address, bien_data, photos_originales_urls, photos_floutees_urls, user_provided_urls",
      )
      .eq("id", payload.bien_id)
      .single();

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
      // 2. Build dossier complet (parallèle Promise.all)
      const loaders: DossierLoaders = {
        geocode: geocodeLoader,
        fetchDpeBien: (address) => fetchDpeBienLoader(address, bien),
        analyzePhotos,
        dvfComparables: dvfComparablesStub,
        activeComparables: activeComparablesStub,
        userProvidedComparables: () => userProvidedComparablesLoader(bien.id ?? payload.bien_id),
        irisContext: irisContextStub,
        rentalMarket: rentalMarketStub,
        dpeSector: dpeSectorStub,
        georisques: georisquesStub,
        transports: transportsStub,
        schools: schoolsStub,
        noise: noiseStub,
        prixTrend: prixTrendStub,
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

      // a. Calcul du delta vs valo_courante précédente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .select("valo_courante")
        .eq("id", payload.bien_id)
        .single();

      let deltaPct: number | null = null;
      if (existing?.valo_courante?.valorisation?.central) {
        const prev = Number(existing.valo_courante.valorisation.central);
        if (Number.isFinite(prev) && prev > 0) {
          deltaPct = ((valo.valorisation.central - prev) / prev) * 100;
        }
      }

      // b. Insert valos_historique
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: histRow, error: histErr } = await (supabaseApp as any)
        .schema("value")
        .from("valos_historique")
        .insert({
          bien_id: payload.bien_id,
          valo: valoJson,
          delta_pct: deltaPct,
          trigger: payload.trigger,
        })
        .select("id")
        .single();
      if (histErr) {
        logger.error("valos_historique insert failed", {
          err: histErr.message,
        });
        throw new Error(`valos_historique insert: ${histErr.message}`);
      }

      // c. Update biens.valo_courante (+ valo_initiale si premier run)
      const update: Record<string, unknown> = {
        valo_courante: valoJson,
        valo_updated_at: new Date().toISOString(),
        valo_confiance: valo.valorisation.confiance,
      };
      if (payload.trigger === "initial") {
        update.valo_initiale = valoJson;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (supabaseApp as any)
        .schema("value")
        .from("biens")
        .update(update)
        .eq("id", payload.bien_id);
      if (updErr) {
        logger.error("biens valo_courante update failed", { err: updErr.message });
        throw new Error(`biens update: ${updErr.message}`);
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
