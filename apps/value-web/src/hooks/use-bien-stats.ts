// useBienStats — lit la row value.bien_stats agrégée par le worker
// `value-compute-stats`. Si absente (worker pas encore exécuté), retourne
// `null` — les composants doivent alors afficher leurs valeurs mock V1.
//
// Cf useBien.ts pour la note sur le cast `any` (schéma value pas public).

import type { ValueBienStats } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function useBienStats(bienId: string | undefined) {
  return useQuery({
    queryKey: ["value", "bien-stats", bienId],
    queryFn: async (): Promise<ValueBienStats | null> => {
      if (!bienId) return null;
      // any: schéma value pas dans AppDatabase typé public.
      const { data, error } = await (supabase as any)
        .schema("value")
        .from("bien_stats")
        .select("*")
        .eq("bien_id", bienId)
        .maybeSingle();
      if (error) throw error;
      return (data as ValueBienStats | null) ?? null;
    },
    enabled: !!bienId,
    staleTime: 60 * 1000,
  });
}
