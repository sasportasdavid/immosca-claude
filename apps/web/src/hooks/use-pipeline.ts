// Hook React Query pour le Pipeline Kanban.
//
// pipeline_items est une table 1-N par user qui stocke les biens qu'il
// suit. Stage = a_visiter / visite / offre / compromis / signe.
// `listing_snapshot` (jsonb) garde la donnée du bien au moment de l'ajout,
// pour qu'on garde le contexte même si l'annonce SeLoger disparaît.

import type { Database } from "@immoscan/db/app";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export type PipelineStage =
  | "a_visiter"
  | "visite"
  | "offre"
  | "compromis"
  | "signe";

export const PIPELINE_STAGES: PipelineStage[] = [
  "a_visiter",
  "visite",
  "offre",
  "compromis",
  "signe",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  a_visiter: "À visiter",
  visite: "Visité",
  offre: "Offre faite",
  compromis: "Compromis",
  signe: "Signé",
};

export type PipelineItem = Database["public"]["Tables"]["pipeline_items"]["Row"];

export type ListingSnapshot = {
  id: string;
  external_id: string;
  source_url: string | null;
  source_site: string;
  title: string | null;
  type: string | null;
  surface: number | null;
  pieces: number | null;
  prix: number | null;
  dpe: string | null;
  ville: string | null;
  code_postal: string | null;
  photos_urls: string[] | null;
  score_total: number | null;
  rendement_brut_pct: number | null;
  cashflow_mensuel: number | null;
  verdict: "a_visiter" | "sous_reserve" | "no_go" | null;
  analysis_id: string;
};

export function usePipelineItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pipeline_items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_items")
        .select("*")
        .order("stage", { ascending: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddToPipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      snapshot,
      stage = "a_visiter",
    }: {
      snapshot: ListingSnapshot;
      stage?: PipelineStage;
    }) => {
      if (!user) throw new Error("Pas de session");
      const { data, error } = await supabase
        .from("pipeline_items")
        .insert({
          profile_id: user.id,
          listing_id: snapshot.id,
          listing_snapshot: snapshot,
          stage,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_items"] });
    },
  });
}

export function useUpdatePipelineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Database["public"]["Tables"]["pipeline_items"]["Update"];
    }) => {
      const { error } = await supabase
        .from("pipeline_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_items"] });
    },
  });
}

export function useDeletePipelineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pipeline_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_items"] });
    },
  });
}

/**
 * Hook utility : `listing_id IS already in pipeline ?`
 * Retourne null si pas dans pipeline, sinon le pipeline_item.
 */
export function usePipelineItemForListing(listingId: string | null) {
  const all = usePipelineItems();
  const item = all.data?.find((i) => i.listing_id === listingId) ?? null;
  return { item, isLoading: all.isLoading };
}
