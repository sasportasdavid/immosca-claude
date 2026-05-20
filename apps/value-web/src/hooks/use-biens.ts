// useBiens — liste les biens ImmoValue du user authentifié.
//
// La RLS de `value.biens` filtre déjà par `user_id = auth.uid()` côté DB ;
// on n'a donc pas besoin de passer un filtre `.eq("user_id", ...)`.
// Aucune ligne ne sera retournée tant que la session n'est pas montée.
//
// NOTE : même cast `as any` que dans `use-bien.ts` — le schéma `value`
// n'est pas exposé dans `AppDatabase`.

import type { ValueBien } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export function useBiens() {
  const { user, isLoading: authLoading } = useAuth();
  return useQuery({
    queryKey: ["value", "biens", "list", user?.id ?? null],
    queryFn: async (): Promise<ValueBien[]> => {
      // any: schéma value pas dans AppDatabase typé public — cf use-bien.ts header.
      const { data, error } = await (supabase as any)
        .schema("value")
        .from("biens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ValueBien[] | null) ?? [];
    },
    enabled: !authLoading && !!user,
    staleTime: 30 * 1000,
  });
}
