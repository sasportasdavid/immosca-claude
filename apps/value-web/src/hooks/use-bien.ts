// useBien — lit un enregistrement value.biens via Supabase + React Query.
//
// NOTE : le schéma `value` n'est pas (encore) exposé dans `AppDatabase`
// public. On cast donc `as any` sur l'appel chaîné pour garder un typage
// `ValueBien` côté retour, sans perdre l'auto-complétion du SDK Supabase.
// Quand le schéma value sera ajouté à `config.toml#[api].schemas`, on
// pourra retirer ce cast (cf packages/db/src/value.types.ts).

import type { ValueBien } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function useBien(bienId: string | undefined) {
  return useQuery({
    queryKey: ["value", "bien", bienId],
    queryFn: async (): Promise<ValueBien | null> => {
      if (!bienId) return null;
      // any: schéma value pas dans AppDatabase typé public — cf header.
      const { data, error } = await (supabase as any)
        .schema("value")
        .from("biens")
        .select("*")
        .eq("id", bienId)
        .maybeSingle();
      if (error) throw error;
      return (data as ValueBien | null) ?? null;
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
