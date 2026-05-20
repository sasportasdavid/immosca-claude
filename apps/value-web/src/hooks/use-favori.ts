// useFavori / useToggleFavori — gestion des favoris ImmoValue.
//
// Table cible : `value.favoris` (RLS user-scoped). En V1, si le schéma
// `value` n'est pas exposé ou si l'utilisateur n'est pas authentifié, on
// utilise un store local React Query (cache only) pour permettre le démo.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

// ────────────────────────────────────────────────────────────────────
// Store local (anonymous fallback) — persisté via localStorage pour que
// les favoris survivent au refresh quand le user n'est pas connecté.
// ────────────────────────────────────────────────────────────────────

const LOCAL_KEY = "immovalue:favoris";

function readLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeLocal(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Quota / SSR : silencieux.
  }
}

// ────────────────────────────────────────────────────────────────────
// useFavori : lecture d'état (favori actif + position dans la file
// d'attente côté discret).
// ────────────────────────────────────────────────────────────────────

type FavoriState = {
  isFavori: boolean;
  position: number | null; // place du user dans la file d'attente (mode discret)
};

export function useFavori(bienId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["favori", bienId, user?.id ?? null],
    enabled: !!bienId,
    queryFn: async (): Promise<FavoriState> => {
      if (!bienId) return { isFavori: false, position: null };

      // Branche authentifiée : query value.favoris.
      if (user?.id) {
        try {
          const { data, error } = await (supabase as never as {
            schema: (s: string) => {
              from: (t: string) => {
                select: (s: string) => {
                  eq: (
                    c: string,
                    v: string,
                  ) => {
                    eq: (
                      c: string,
                      v: string,
                    ) => {
                      maybeSingle: () => Promise<{
                        data: { id: string } | null;
                        error: unknown;
                      }>;
                    };
                  };
                };
              };
            };
          })
            .schema("value")
            .from("favoris")
            .select("id")
            .eq("bien_id", bienId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!error) {
            return { isFavori: !!data, position: null };
          }
        } catch {
          // Fallback local.
        }
      }

      // Fallback non-auth ou erreur : store local.
      const local = readLocal();
      return { isFavori: local.has(bienId), position: null };
    },
    staleTime: 10 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────
// useToggleFavori : insert / delete value.favoris (ou store local).
// ────────────────────────────────────────────────────────────────────

export function useToggleFavori(bienId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (next: boolean): Promise<boolean> => {
      if (!bienId) throw new Error("bienId manquant");

      // Authentifié : insert/delete réel.
      if (user?.id) {
        try {
          if (next) {
            const { error } = await (supabase as never as {
              schema: (s: string) => {
                from: (t: string) => {
                  insert: (row: Record<string, unknown>) => Promise<{
                    error: unknown;
                  }>;
                };
              };
            })
              .schema("value")
              .from("favoris")
              .insert({
                bien_id: bienId,
                user_id: user.id,
                favori_type: "discret",
              });
            if (error) throw error;
          } else {
            const { error } = await (supabase as never as {
              schema: (s: string) => {
                from: (t: string) => {
                  delete: () => {
                    eq: (
                      c: string,
                      v: string,
                    ) => {
                      eq: (c: string, v: string) => Promise<{ error: unknown }>;
                    };
                  };
                };
              };
            })
              .schema("value")
              .from("favoris")
              .delete()
              .eq("bien_id", bienId)
              .eq("user_id", user.id);
            if (error) throw error;
          }
          return next;
        } catch {
          // Bascule sur le local en cas d'erreur (schéma pas exposé).
        }
      }

      // Fallback local.
      const local = readLocal();
      if (next) local.add(bienId);
      else local.delete(bienId);
      writeLocal(local);
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favori", bienId] });
      queryClient.invalidateQueries({ queryKey: ["annonces"] });
      queryClient.invalidateQueries({ queryKey: ["annonce", bienId] });
    },
  });
}
