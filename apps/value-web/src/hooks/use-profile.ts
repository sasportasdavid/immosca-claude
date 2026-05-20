// useProfile — lit la table `profiles` (1-1 avec auth.users) via React Query.
// Identique à apps/web/src/hooks/use-profile.ts (auth unifiée).
//
// Le profile est créé automatiquement à l'inscription via le trigger SQL
// `handle_new_user` (cf migration init_app.sql).

import type { AppDatabase } from "@immoscan/db";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { setUserProperties } from "@/lib/posthog";
import { supabase } from "@/lib/supabase";

export type ProfileRow = AppDatabase["public"]["Tables"]["profiles"]["Row"];

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<ProfileRow> => {
      if (!userId) {
        throw new Error("useProfile.queryFn called without user");
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  // Effect : enrichit PostHog person properties dès qu'on connaît le plan.
  useEffect(() => {
    if (query.data?.subscription_plan) {
      setUserProperties({
        plan: query.data.subscription_plan,
        status: query.data.subscription_status,
      });
    }
  }, [query.data?.subscription_plan, query.data?.subscription_status]);

  return query;
}
