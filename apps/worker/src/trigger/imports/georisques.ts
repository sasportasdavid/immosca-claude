// Import Géorisques — synthèse risques par commune.
//
// Source : https://georisques.gouv.fr/api/v1/
// Volume : 35k communes France. Rate limit ~10 req/s conservateur.
// Durée totale estimée : 1h pour un refresh complet.
//
// 2 tasks :
// - `georisquesImport({ codeCommune })` : fetch + upsert 1 commune
// - `georisquesImportAll` : itère sur toutes les communes (depuis
//   `dvf_mutations.code_commune` distinct) via PQueue rate-limited.

import type { Json } from "@immoscan/db/data";
import { task } from "@trigger.dev/sdk";
import PQueue from "p-queue";
import { z } from "zod";


import { withImportRun } from "@/lib/import-runs";
import { supabaseData } from "@/lib/supabase";

const QUEUE = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 8 });

const GEORISQUES_BASE = "https://www.georisques.gouv.fr/api/v1";

const niveauArgileSchema = z.enum(["nul", "faible", "moyen", "fort"]);

async function fetchCommuneRisks(codeCommune: string): Promise<{
  nom: string;
  has_ppri: boolean;
  ppri_count: number;
  retrait_argile_niveau: z.infer<typeof niveauArgileSchema> | null;
  sismicite: number | null;
  radon: number | null;
  sites_basol_count: number;
  sites_basias_count: number;
  has_ppr_mouvement_terrain: boolean;
  has_ppr_feu_foret: boolean;
  has_ppr_avalanche: boolean;
  raw: Record<string, unknown>;
}> {
  // L'endpoint /risques retourne une synthèse multi-domaines. Format
  // documenté : https://www.georisques.gouv.fr/doc-api
  const url = `${GEORISQUES_BASE}/resultats_rapport_risque?code_insee=${codeCommune}`;
  const res = await QUEUE.add(async () => {
    const r = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Géorisques ${r.status} pour ${codeCommune}`);
    return r.json();
  });

  const raw = res as Record<string, unknown>;

  // Le mapping ci-dessous est conservateur : on extrait ce qu'on peut
  // typer sans casser si Géorisques renomme un champ. Le raw_data est
  // stocké en jsonb pour analyse ultérieure.
  const nom =
    (raw.libelle_commune as string) ?? (raw.nom_commune as string) ?? codeCommune;

  const ppris = (raw.PPR as unknown[]) ?? [];
  const ppriList = Array.isArray(ppris) ? ppris : [];
  const has_ppri = ppriList.some((p) => {
    const obj = p as Record<string, unknown>;
    const lib = (obj.libelle as string) ?? "";
    return /inondation/i.test(lib);
  });

  const argile = (raw.argile as Record<string, unknown> | undefined) ?? {};
  const niveauStr = ((argile.niveau as string) ?? "").toLowerCase();
  const retrait_argile_niveau = niveauArgileSchema.safeParse(niveauStr).success
    ? (niveauStr as z.infer<typeof niveauArgileSchema>)
    : null;

  const sismicite = Number((raw.sismicite as Record<string, unknown>)?.zone) || null;
  const radon = Number((raw.radon as Record<string, unknown>)?.classe) || null;

  return {
    nom,
    has_ppri,
    ppri_count: ppriList.length,
    retrait_argile_niveau,
    sismicite,
    radon,
    sites_basol_count: Array.isArray(raw.basol)
      ? (raw.basol as unknown[]).length
      : 0,
    sites_basias_count: Array.isArray(raw.basias)
      ? (raw.basias as unknown[]).length
      : 0,
    has_ppr_mouvement_terrain: ppriList.some((p) =>
      /mouvement.+terrain/i.test(((p as Record<string, unknown>).libelle as string) ?? ""),
    ),
    has_ppr_feu_foret: ppriList.some((p) =>
      /feu.+for[êe]t/i.test(((p as Record<string, unknown>).libelle as string) ?? ""),
    ),
    has_ppr_avalanche: ppriList.some((p) =>
      /avalanche/i.test(((p as Record<string, unknown>).libelle as string) ?? ""),
    ),
    raw,
  };
}

export const georisquesImport = task({
  id: "imports.georisques.commune",
  maxDuration: 60,
  retry: { maxAttempts: 3, minTimeoutInMs: 2000 },
  run: async (payload: unknown) => {
    const { codeCommune } = z
      .object({ codeCommune: z.string().regex(/^\d{5}$/) })
      .parse(payload);

    const data = await fetchCommuneRisks(codeCommune);

    const { error } = await supabaseData.from("georisques_communes").upsert(
      {
        code_commune: codeCommune,
        nom_commune: data.nom,
        has_ppri: data.has_ppri,
        ppri_count: data.ppri_count,
        retrait_argile_niveau: data.retrait_argile_niveau,
        sismicite: data.sismicite,
        radon: data.radon,
        sites_basol_count: data.sites_basol_count,
        sites_basias_count: data.sites_basias_count,
        has_ppr_mouvement_terrain: data.has_ppr_mouvement_terrain,
        has_ppr_feu_foret: data.has_ppr_feu_foret,
        has_ppr_avalanche: data.has_ppr_avalanche,
        raw_data: data.raw as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code_commune" },
    );
    if (error) throw error;

    return { codeCommune, success: true };
  },
});

export const georisquesImportAll = task({
  id: "imports.georisques.all",
  maxDuration: 7200, // 2h — gros refresh
  retry: { maxAttempts: 1 },
  run: async () => {
    return withImportRun("georisques", async ({ log }) => {
      // On itère sur les communes connues via DVF (~36k). Pour un
      // refresh "vraie France entière" sans dépendance DVF, on
      // pourrait croiser avec data.gouv.fr (table COG).
      const { data, error } = await supabaseData
        .from("dvf_mutations")
        .select("code_commune")
        .order("code_commune");
      if (error) throw error;

      const codes = Array.from(
        new Set((data ?? []).map((r) => r.code_commune)),
      ).filter((c) => /^\d{5}$/.test(c));

      log(`Géorisques refresh ${codes.length} communes`);

      let success = 0;
      let failed = 0;
      await Promise.all(
        codes.map((codeCommune) =>
          QUEUE.add(async () => {
            try {
              const data = await fetchCommuneRisks(codeCommune);
              await supabaseData.from("georisques_communes").upsert(
                {
                  code_commune: codeCommune,
                  nom_commune: data.nom,
                  has_ppri: data.has_ppri,
                  ppri_count: data.ppri_count,
                  retrait_argile_niveau: data.retrait_argile_niveau,
                  sismicite: data.sismicite,
                  radon: data.radon,
                  sites_basol_count: data.sites_basol_count,
                  sites_basias_count: data.sites_basias_count,
                  has_ppr_mouvement_terrain: data.has_ppr_mouvement_terrain,
                  has_ppr_feu_foret: data.has_ppr_feu_foret,
                  has_ppr_avalanche: data.has_ppr_avalanche,
                  raw_data: data.raw as Json,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "code_commune" },
              );
              success++;
            } catch {
              failed++;
            }
          }),
        ),
      );

      log(`Géorisques done: success=${success} failed=${failed}`);
      return {
        rowsImported: success,
        metadata: { totalCommunes: codes.length, success, failed },
      };
    });
  },
});
