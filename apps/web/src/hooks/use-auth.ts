// useAuth — hook unique pour l'état de session Supabase + les actions
// d'auth (signIn / signUp / OAuth Google / magic link / signOut).
//
// Architecture :
// - Source de vérité = React Query `["session"]`. staleTime: Infinity car
//   les changements arrivent via le listener `onAuthStateChange` qui
//   `setQueryData` directement (cf installAuthListener ci-dessous).
// - Le listener est posé UNE FOIS au mount du composant racine via le
//   hook `useInstallAuthListener()`. Il s'occupe aussi des side effects
//   identify/reset PostHog + setSentryUser/clearSentryUser.
// - Les méthodes signIn/signUp/etc. retournent les fonctions (pas des
//   mutations). Les containers `features/auth/` les wrappent dans leurs
//   propres `useMutation` selon les besoins (état loading, toasts, etc.).
//
// Politique PII : userId UUID uniquement transmis à PostHog/Sentry — cf
// helpers identifyUser/setSentryUser du commit 8740f33.

import type {
  AuthResponse,
  AuthTokenResponsePassword,
  OAuthResponse,
  Session,
  User,
} from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  identifyUser,
  resetUser as resetPostHogUser,
} from "@/lib/posthog";
import { clearSentryUser, setSentryUser } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

const SESSION_QUERY_KEY = ["session"] as const;

/**
 * Récupère la session Supabase courante via React Query.
 *
 * `data: Session | null` (null = signed-out, undefined pendant le 1er
 * fetch). Le listener `onAuthStateChange` met à jour le cache via
 * setQueryData, donc on n'a pas besoin de refetch périodique.
 */
function useSessionQuery() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export type UseAuth = {
  /** Session Supabase actuelle, ou null si pas connecté. */
  session: Session | null;
  /** Raccourci vers session?.user. */
  user: User | null;
  /** True pendant le 1er fetch de getSession() au mount. */
  isLoading: boolean;
  /** True quand la session est chargée et un user est connecté. */
  isAuthenticated: boolean;

  /** signIn email/password. Throw sur error Supabase. */
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<AuthTokenResponsePassword["data"]>;
  /** signUp email/password. Throw sur error. Le profile est créé via
   *  trigger handle_new_user côté DB. */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<AuthResponse["data"]>;
  /** OAuth Google : redirige vers Google puis vers /auth/callback. */
  signInWithGoogle: () => Promise<OAuthResponse["data"]>;
  /** Magic link : envoie un mail OTP, callback /auth/callback. */
  signInWithMagicLink: (email: string) => Promise<AuthResponse["data"]>;
  /** signOut local + global. */
  signOut: () => Promise<void>;
};

export function useAuth(): UseAuth {
  const { data: session, isLoading } = useSessionQuery();
  const sess = session ?? null;
  const user = sess?.user ?? null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return {
    session: sess,
    user,
    isLoading,
    isAuthenticated: !!user,

    signInWithPassword: async (email, password) => {
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) throw res.error;
      return res.data;
    },

    signUpWithPassword: async (email, password) => {
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (res.error) throw res.error;
      return res.data;
    },

    signInWithGoogle: async () => {
      const res = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (res.error) throw res.error;
      return res.data;
    },

    signInWithMagicLink: async (email) => {
      const res = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (res.error) throw res.error;
      return res.data;
    },

    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  };
}

/**
 * À monter UNE FOIS au niveau racine (routes/__root.tsx).
 *
 * Installe le listener `supabase.auth.onAuthStateChange` qui :
 * 1. Met à jour le cache React Query `["session"]` à chaque event.
 * 2. Déclenche les side effects identify/reset PostHog et Sentry.
 *
 * Le useEffect a queryClient en dépendance mais en pratique c'est le
 * même client tout le cycle de vie de l'app — exécuté une fois au mount.
 */
export function useInstallAuthListener(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 1. Cache React Query
      queryClient.setQueryData(SESSION_QUERY_KEY, session ?? null);

      // 2. Side effects observabilité
      if (event === "SIGNED_IN" && session?.user) {
        setSentryUser(session.user.id);
        identifyUser(session.user.id);
      } else if (event === "SIGNED_OUT") {
        clearSentryUser();
        resetPostHogUser();
        // Invalide les queries user-scoped pour qu'elles repartent
        // d'un état propre au prochain sign-in.
        queryClient.removeQueries({ queryKey: ["profile"] });
        queryClient.removeQueries({ queryKey: ["user_params"] });
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        // Re-identify "for safety" — pas obligatoire mais robuste si
        // le distinct_id PostHog avait été reset entretemps.
        setSentryUser(session.user.id);
        identifyUser(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}
