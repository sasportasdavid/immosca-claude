// useDashboardSummary — appelle la RPC SQL `dashboard_summary` qui agrège
// en une seule requête tout le contenu de /dashboard.
//
// Refetch toutes les 60s en background pour rester à jour sans bloquer.

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export type PipelineStage = "a_visiter" | "visite" | "offre" | "compromis" | "signe";

export interface DashboardOpportunity {
  watch_listing_id: string;
  watch_id: string;
  watch_name: string;
  title: string | null;
  source_site: string;
  source_url: string;
  current_price: number;
  current_surface: number | null;
  current_dpe: string | null;
  current_score: number | null;
  first_seen_at: string;
  last_seen_at: string;
  is_in_pipeline: boolean;
}

export interface DashboardAlert {
  kind:
    | "watch_expiring"
    | "watch_truncated"
    | "quota_analyses"
    | "trial_ending";
  label: string;
  cta_link: string;
}

export interface DashboardMarketStat {
  city: string;
  median_eur_m2: number;
  delta_pct: number | null;
}

export interface DashboardSummary {
  plan: "free" | "pro" | "pro_plus" | "business";
  top_opportunities: DashboardOpportunity[];
  watch_activity_7d: Partial<{
    new_match: number;
    price_drop: number;
    signal_to_verify: number;
    relisted: number;
    removed: number;
  }>;
  stats: {
    analyses_used: number;
    analyses_limit: number;
    watches_active: number;
    watches_effective_limit: number;
    ppu_balance: number;
    period_end: string | null;
  };
  pipeline_counts: Partial<Record<PipelineStage, number>>;
  alerts: DashboardAlert[];
  market_stats: DashboardMarketStat[];
  empty_state_hint:
    | "first_analysis"
    | "first_watch"
    | "first_pipeline"
    | null;
}

export function useDashboardSummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dashboard_summary", user?.id],
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async (): Promise<DashboardSummary> => {
      if (!user) throw new Error("not_authenticated");
      const { data, error } = await supabase.rpc("dashboard_summary", {
        p_profile_id: user.id,
      });
      if (error) throw error;
      // La RPC retourne un Json — on type-cast vers notre interface.
      return data as unknown as DashboardSummary;
    },
  });
}
