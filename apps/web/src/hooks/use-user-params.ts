// useUserParams — lecture des paramètres d'investissement du user
// (table `user_params`, 1-1 avec `profiles`).
//
// `data` peut être :
// - `null` → l'user n'a pas encore terminé l'onboarding (pas de row).
//   Utilisé par le guard de /dashboard pour rediriger vers /onboarding.
// - un row `user_params` → onboarding terminé.
// - `undefined` pendant le 1er fetch (cf isLoading).
//
// useUpsertUserParams — mutation pour create/update les params à la fin
// de l'onboarding step-2 ou depuis la future page Paramètres. Valide
// l'input via le Zod schema partagé `userParamsInputSchema` avant
// l'upsert (defense-in-depth — les forms RHF utilisent déjà zodResolver,
// mais on re-parse au cas où on appelle la mutation hors form).

import { type UserParamsInput, userParamsInputSchema } from "@immoscan/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

import type { Database } from "@immoscan/db/app";

export type UserParamsRow = Database["public"]["Tables"]["user_params"]["Row"];

export function useUserParams() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["user_params", userId],
    queryFn: async (): Promise<UserParamsRow | null> => {
      if (!userId) {
        throw new Error("useUserParams.queryFn called without user");
      }
      const { data, error } = await supabase
        .from("user_params")
        .select("*")
        .eq("profile_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useUpsertUserParams() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (input: UserParamsInput): Promise<UserParamsRow> => {
      if (!userId) {
        throw new Error("Pas de session active pour upsert user_params");
      }
      // Defense-in-depth : on re-parse au niveau mutation au cas où
      // l'appelant aurait sauté zodResolver côté form.
      const parsed = userParamsInputSchema.parse(input);
      const { data, error } = await supabase
        .from("user_params")
        .upsert(
          { profile_id: userId, ...parsed },
          { onConflict: "profile_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Met à jour le cache directement (économise un round-trip),
      // puis invalide pour s'assurer que les listeners refetchent.
      queryClient.setQueryData(["user_params", userId], data);
      queryClient.invalidateQueries({
        queryKey: ["user_params", userId],
      });
    },
  });
}
