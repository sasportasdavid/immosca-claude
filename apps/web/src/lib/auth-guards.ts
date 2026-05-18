// Helpers `beforeLoad` pour TanStack Router — protègent les routes
// authentifiées et redirigent les utilisateurs déjà connectés depuis
// les pages auth.
//
// Pattern : les helpers lèvent `redirect(...)` côté serveur (= avant le
// rendu de la route). C'est le mécanisme natif TanStack Router pour
// rediriger sans avoir à monter le composant et flash.
//
// Ces helpers appellent directement `supabase.auth.getSession()` et le
// fetch SQL plutôt que de passer par le cache React Query. Raison : à
// la première navigation, le cache n'est pas encore peuplé (le listener
// `onAuthStateChange` ne fire qu'après le 1er getSession). Pour
// optimiser plus tard, on injectera le QueryClient dans le routerContext
// et on utilisera `queryClient.ensureQueryData`.

import { redirect } from "@tanstack/react-router";

import { supabase } from "@/lib/supabase";

export type RequireAuthOpts = {
  /** Chemin retourné pour `?redirect=` après login. Defaut: location actuelle. */
  redirectTo?: string;
};

/**
 * À utiliser dans le `beforeLoad` d'une route qui exige une session.
 *
 * Throw redirect vers `/auth/login?redirect=<from>` si pas de session.
 * Retourne `{ userId }` si OK.
 */
export async function requireAuth(opts: { from: string } & RequireAuthOpts) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw redirect({
      to: "/auth/login",
      search: { redirect: opts.redirectTo ?? opts.from },
    });
  }
  return { userId: session.user.id };
}

/**
 * À utiliser dans le `beforeLoad` d'une route accessible aux signed-in
 * MAIS qui requiert qu'ils aient fini l'onboarding (= row `user_params`).
 *
 * Doit être appelé APRÈS `requireAuth`. Throw redirect vers
 * /onboarding/step-1 si pas de row, retourne `{ userId, paramsId }` sinon.
 */
export async function requireOnboarded(opts: { userId: string }) {
  const { data, error } = await supabase
    .from("user_params")
    .select("id")
    .eq("profile_id", opts.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw redirect({ to: "/onboarding/step-1" });
  }
  return { userId: opts.userId, paramsId: data.id };
}

/**
 * À utiliser dans le `beforeLoad` des pages auth (/auth/login, /auth/signup).
 *
 * Throw redirect vers /dashboard si déjà authentifié, no-op sinon.
 */
export async function redirectIfAuthenticated() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    throw redirect({ to: "/dashboard" });
  }
}
