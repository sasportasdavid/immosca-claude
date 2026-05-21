// useBien — lit un enregistrement value.biens via la RPC publique
// `public.value_bien_get(bien_id)` (le schéma value n'est pas exposé
// via PostgREST, sinon ".schema('value').from('biens')" plante avec
// 'Invalid schema: value'). La RPC est SECURITY INVOKER → l'user ne
// peut lire que ses propres biens (RLS-like check via auth.uid()).

import type { ValueBien } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function useBien(bienId: string | undefined) {
  return useQuery({
    queryKey: ["value", "bien", bienId],
    queryFn: async (): Promise<ValueBien | null> => {
      if (!bienId) return null;
      const { data, error } = await (supabase as any).rpc("value_bien_get", {
        p_bien_id: bienId,
      });
      if (error) throw error;
      // La RPC returns table → SDK renvoie un array. On prend la 1re row.
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ValueBien | undefined) ?? null;
    },
    enabled: !!bienId,
    staleTime: 30 * 1000,
    // Polling tant que la valorisation Claude n'est pas écrite par le
    // worker `value-build-estimation`. Une fois `valo_courante`
    // présent, on arrête le polling (refetchInterval renvoie false).
    refetchInterval: (query) => {
      const bien = query.state.data;
      if (!bien) return 3000;
      if (!bien.valo_courante) return 3000;
      return false;
    },
    refetchIntervalInBackground: false,
  });
}
