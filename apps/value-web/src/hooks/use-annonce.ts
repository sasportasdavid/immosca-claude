// useAnnonce — détail d'une annonce ImmoValue (page /annonces/$bienId).
//
// Même logique que useAnnonces (query value.biens_publics avec fallback
// mock V1). Renvoie `null` si l'annonce n'existe pas.

import type { ValueBienPublic } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { findMockAnnonce } from "@/lib/mock-annonces";

export function useAnnonce(bienId: string | undefined) {
  return useQuery({
    queryKey: ["annonce", bienId],
    enabled: !!bienId,
    queryFn: async (): Promise<ValueBienPublic | null> => {
      if (!bienId) return null;

      try {
        const { data, error } = await (supabase as never as {
          schema: (s: string) => {
            from: (t: string) => {
              select: (s: string) => {
                eq: (
                  col: string,
                  val: string,
                ) => {
                  maybeSingle: () => Promise<{
                    data: ValueBienPublic | null;
                    error: unknown;
                  }>;
                };
              };
            };
          };
        })
          .schema("value")
          .from("biens_publics")
          .select("*")
          .eq("id", bienId)
          .maybeSingle();

        if (!error && data) return data;
      } catch {
        // Schéma value pas encore accessible — fallback.
      }

      return findMockAnnonce(bienId);
    },
    staleTime: 30 * 1000,
  });
}
