// useAnnonces — liste paginée des annonces ImmoValue (vitrine).
//
// Query la vue `value.biens_publics` (anonymisation appliquée côté
// serveur). Si la vue est vide ou inaccessible (schéma value pas encore
// exposé dans la PostgREST API), on retombe sur les mocks V1.
//
// Le client `@/lib/supabase` est typé `AppDatabase` qui n'inclut pas le
// schéma `value` — on passe par `from(...).schema('value')` avec un cast
// large `from('biens_publics' as never)`.

import type { ValueBienPublic } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { MOCK_ANNONCES, findMockAnnonce } from "@/lib/mock-annonces";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type AnnonceMode = "tous" | "discret" | "public";

export type AnnoncesFilters = {
  search?: string;
  mode?: AnnonceMode;
  prixMin?: number;
  prixMax?: number;
  surfaceMin?: number;
  surfaceMax?: number;
  piecesMin?: number;
  dpe?: string[]; // ["A","B","C"]
};

// ────────────────────────────────────────────────────────────────────
// Filtres en JS — appliqués sur les mocks et utilisés en complément du
// filtrage SQL côté supabase (qui ne couvre que ce qui est typable).
// ────────────────────────────────────────────────────────────────────

function getBienField<T = unknown>(bien: ValueBienPublic, key: string): T | undefined {
  const data = (bien.bien_data ?? {}) as Record<string, unknown>;
  return data[key] as T | undefined;
}

function bienSurface(bien: ValueBienPublic): number | null {
  const exact = getBienField<number>(bien, "surface");
  if (typeof exact === "number") return exact;
  // Bucket "60-70" → moyenne
  const bucket = getBienField<string>(bien, "surface_bucket");
  if (typeof bucket === "string") {
    const m = bucket.match(/^(\d+)-(\d+)$/);
    if (m) return (Number(m[1]) + Number(m[2])) / 2;
    const m2 = bucket.match(/^(\d+)\+$/);
    if (m2) return Number(m2[1]) + 10;
  }
  return null;
}

function matchesFilters(bien: ValueBienPublic, f: AnnoncesFilters): boolean {
  if (f.mode && f.mode !== "tous") {
    if (bien.status !== f.mode) return false;
  }
  if (f.search) {
    const q = f.search.toLowerCase().trim();
    if (q.length > 0) {
      const haystack = `${bien.address_display ?? ""} ${
        bien.description_publique ?? ""
      }`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
  }
  if (typeof f.prixMin === "number" && bien.prix_affiche != null) {
    if (bien.prix_affiche < f.prixMin) return false;
  }
  if (typeof f.prixMax === "number" && bien.prix_affiche != null) {
    if (bien.prix_affiche > f.prixMax) return false;
  }
  const surf = bienSurface(bien);
  if (typeof f.surfaceMin === "number" && surf != null && surf < f.surfaceMin) {
    return false;
  }
  if (typeof f.surfaceMax === "number" && surf != null && surf > f.surfaceMax) {
    return false;
  }
  if (typeof f.piecesMin === "number") {
    const pieces = getBienField<number>(bien, "pieces");
    if (typeof pieces === "number" && pieces < f.piecesMin) return false;
  }
  if (f.dpe && f.dpe.length > 0) {
    const dpe = getBienField<string>(bien, "dpe");
    if (typeof dpe === "string" && !f.dpe.includes(dpe)) return false;
  }
  return true;
}

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

export function useAnnonces(filters: AnnoncesFilters = {}) {
  return useQuery({
    queryKey: ["annonces", filters],
    queryFn: async (): Promise<ValueBienPublic[]> => {
      // 1) Tente la requête réelle (vue value.biens_publics).
      try {
        // any: client typé AppDatabase, le schéma 'value' n'est pas encore
        // exposé dans les types — fallback sur cast large.
        const { data, error } = await (supabase as never as {
          schema: (s: string) => {
            from: (t: string) => {
              select: (s: string) => Promise<{
                data: ValueBienPublic[] | null;
                error: unknown;
              }>;
            };
          };
        })
          .schema("value")
          .from("biens_publics")
          .select("*");

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.filter((b) => matchesFilters(b, filters));
        }
      } catch {
        // Schéma value pas encore accessible — on retombe sur les mocks.
      }

      // 2) Fallback mocks V1.
      return MOCK_ANNONCES.filter((b) => matchesFilters(b, filters));
    },
    staleTime: 30 * 1000,
  });
}

// Re-export utile pour les pages détail.
export { findMockAnnonce };
