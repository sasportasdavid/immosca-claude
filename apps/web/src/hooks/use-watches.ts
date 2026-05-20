// Hooks React Query pour le module veille.
//
// Architecture data (lecture seule côté frontend) :
//   - watches              → liste + édition (CRUD via RLS user)
//   - watch_runs           → tab Historique (lecture only)
//   - watch_listings       → tab Opportunités (lecture only — alimenté par le worker)
//   - watch_events         → tab Évolutions (lecture only — alimenté par le worker)
//
// Toute mutation côté worker (scout) passe par service_role (bypass RLS).
// Côté frontend on a uniquement les CRUD watches + actions de réactivation.

import type { Database } from "@immoscan/db/app";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/posthog";
import { supabase } from "@/lib/supabase";

export type WatchRow = Database["public"]["Tables"]["watches"]["Row"];
export type WatchInsert = Database["public"]["Tables"]["watches"]["Insert"];
export type WatchUpdate = Database["public"]["Tables"]["watches"]["Update"];
export type WatchRunRow = Database["public"]["Tables"]["watch_runs"]["Row"];
export type WatchListingRow = Database["public"]["Tables"]["watch_listings"]["Row"];
export type WatchEventRow = Database["public"]["Tables"]["watch_events"]["Row"];

// ──────────────────────────────────────────────────────────────────
// Watches list
// ──────────────────────────────────────────────────────────────────

export function useWatches(opts?: { includeInactive?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["watches", user?.id, opts?.includeInactive ?? false],
    enabled: !!user,
    queryFn: async (): Promise<WatchRow[]> => {
      let q = supabase
        .from("watches")
        .select("*")
        .order("created_at", { ascending: false });
      if (!opts?.includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// Single watch
// ──────────────────────────────────────────────────────────────────

export function useWatch(watchId: string | undefined) {
  return useQuery({
    queryKey: ["watch", watchId],
    enabled: !!watchId,
    queryFn: async (): Promise<WatchRow> => {
      if (!watchId) throw new Error("watchId missing");
      const { data, error } = await supabase
        .from("watches")
        .select("*")
        .eq("id", watchId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// watch_runs (tab Historique)
// ──────────────────────────────────────────────────────────────────

export function useWatchRuns(watchId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: ["watch_runs", watchId, limit],
    enabled: !!watchId,
    queryFn: async (): Promise<WatchRunRow[]> => {
      if (!watchId) return [];
      const { data, error } = await supabase
        .from("watch_runs")
        .select("*")
        .eq("watch_id", watchId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// watch_listings (tab Opportunités)
// ──────────────────────────────────────────────────────────────────

export interface WatchListingFilters {
  status?: WatchListingRow["current_status"][];
  minScore?: number;
}

export function useWatchListings(
  watchId: string | undefined,
  filters?: WatchListingFilters,
) {
  return useQuery({
    queryKey: ["watch_listings", watchId, filters],
    enabled: !!watchId,
    queryFn: async (): Promise<WatchListingRow[]> => {
      if (!watchId) return [];
      let q = supabase
        .from("watch_listings")
        .select("*")
        .eq("watch_id", watchId);
      if (filters?.status && filters.status.length > 0) {
        q = q.in("current_status", filters.status);
      }
      if (filters?.minScore != null) {
        q = q.gte("current_score", filters.minScore);
      }
      const { data, error } = await q.order("current_score", {
        ascending: false,
        nullsFirst: false,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// watch_events (tab Évolutions)
// ──────────────────────────────────────────────────────────────────

export function useWatchEvents(
  watchId: string | undefined,
  opts?: { sinceDays?: number; limit?: number; types?: WatchEventRow["event_type"][] },
) {
  return useQuery({
    queryKey: ["watch_events", watchId, opts],
    enabled: !!watchId,
    queryFn: async (): Promise<WatchEventRow[]> => {
      if (!watchId) return [];
      const limit = opts?.limit ?? 100;
      let q = supabase
        .from("watch_events")
        .select("*")
        .eq("watch_id", watchId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (opts?.sinceDays != null) {
        const cutoff = new Date(Date.now() - opts.sinceDays * 24 * 3600 * 1000);
        q = q.gte("created_at", cutoff.toISOString());
      }
      if (opts?.types && opts.types.length > 0) {
        q = q.in("event_type", opts.types);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────

/**
 * Crée une veille. Accepte un payload standard plus un flag PostHog
 * optionnel `_fromAnalysis` (préfixé `_` car non persisté en DB, juste
 * pour l'event analytics).
 */
export type CreateWatchPayload = Omit<WatchInsert, "profile_id"> & {
  /** Flag analytics : true si créée via le bouton "Mettre en veille"
   *  depuis /app/analyses/$id (query param fromAnalysis). */
  _fromAnalysis?: boolean;
};

export function useCreateWatch() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWatchPayload) => {
      if (!user) throw new Error("not_authenticated");
      // Sépare le flag analytics du payload DB
      const { _fromAnalysis: _ignored, ...dbInput } = input;
      const { data, error } = await supabase
        .from("watches")
        .insert({ ...dbInput, profile_id: user.id })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, input };
    },
    onSuccess: ({ input }, _vars, _ctx) => {
      qc.invalidateQueries({ queryKey: ["watches"] });
      trackEvent({
        name: "watch_created",
        props: {
          source_site: input.source_site,
          sensitivity: (input.sensitivity ?? "moderate") as string,
          score_threshold: input.score_threshold ?? 70,
          from_analysis: input._fromAnalysis ?? false,
        },
      });
    },
  });
}

export function useUpdateWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: WatchUpdate }) => {
      const { error } = await supabase.from("watches").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["watches"] });
      qc.invalidateQueries({ queryKey: ["watch", vars.id] });
    },
  });
}

export function useDeleteWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watches").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["watches"] });
      trackEvent({ name: "watch_deleted", props: { watch_id: id } });
    },
  });
}

/**
 * Réactive une veille suspendue : remet is_active=true + suspended_at=null
 * + bump l'expires_at de N jours (BM §5.1/§5.2 si upgrade).
 * Pour V1, on remet juste active sans toucher à expires_at → c'est
 * l'upgrade Stripe (webhook) qui nullifie expires_at sur transition Pro.
 */
export function useReactivateWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("watches")
        .update({ is_active: true, suspended_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["watches"] });
      qc.invalidateQueries({ queryKey: ["watch", id] });
      trackEvent({ name: "watch_reactivated", props: { watch_id: id } });
    },
  });
}
