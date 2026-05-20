// useUpdateBien — mutations sur un enregistrement value.biens.
//
// Toutes les mutations invalidate la query `["value", "bien", bienId]`.
// V1 : on remonte une signature large (Partial<ValueBienUpdate>) pour
// que les écrans Paramètres / status switches consomment un seul hook.

import type { ValueBien, ValueBienUpdate } from "@immoscan/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function useUpdateBien(bienId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<ValueBienUpdate>): Promise<ValueBien> => {
      if (!bienId) throw new Error("useUpdateBien: bienId manquant");
      // any: schéma value pas dans AppDatabase typé public.
      const { data, error } = await (supabase as any)
        .schema("value")
        .from("biens")
        .update(patch)
        .eq("id", bienId)
        .select("*")
        .single();
      if (error) throw error;
      return data as ValueBien;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["value", "bien", bienId], updated);
    },
  });
}
