// useAuth — hook unique pour l'état de session Supabase + actions auth.
// Identique à apps/web/src/hooks/use-auth.ts (auth unifiée ImmoScan/ImmoValue).
//
// Voir apps/web/src/hooks/use-auth.ts pour la doc détaillée.

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
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<AuthTokenResponsePassword["data"]>;
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<AuthResponse["data"]>;
  signInWithGoogle: () => Promise<OAuthResponse["data"]>;
  signInWithMagicLink: (email: string) => Promise<AuthResponse["data"]>;
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
 * Installe le listener supabase.auth.onAuthStateChange.
 */
export function useInstallAuthListener(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session ?? null);

      if (event === "SIGNED_IN" && session?.user) {
        setSentryUser(session.user.id);
        identifyUser(session.user.id);
      } else if (event === "SIGNED_OUT") {
        clearSentryUser();
        resetPostHogUser();
        queryClient.removeQueries({ queryKey: ["profile"] });
        queryClient.removeQueries({ queryKey: ["user_params"] });
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSentryUser(session.user.id);
        identifyUser(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}
