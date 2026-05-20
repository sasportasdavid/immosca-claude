// Helpers `beforeLoad` pour TanStack Router — protègent les routes
// authentifiées et redirigent les utilisateurs déjà connectés depuis
// les pages auth.
//
// Pattern : les helpers lèvent `redirect(...)` côté serveur (= avant le
// rendu de la route). C'est le mécanisme natif TanStack Router pour
// rediriger sans avoir à monter le composant et flash.
//
// Inspiré de apps/web/src/lib/auth-guards.ts — version ImmoValue : ne
// connaît pas user_params (pas d'onboarding ImmoScan ici).

import { redirect } from "@tanstack/react-router";

import { supabase } from "@/lib/supabase";

export type RequireAuthOpts = {
  /** Chemin retourné pour `?next=` après login. Défaut: location actuelle. */
  redirectTo?: string;
  /**
   * Cible alternative de redirection (chemin complet avec search params)
   * à utiliser à la place de `/auth/login`. Utile pour le tunnel
   * d'estimation où on veut atterrir sur `/estimer/compte?afterAuth=…`
   * plutôt que sur la page de login générique.
   */
  loginPath?: string;
};

/**
 * À utiliser dans le `beforeLoad` d'une route qui exige une session.
 *
 * Throw redirect vers `/auth/login?next=<from>` si pas de session, ou
 * vers `loginPath` si fourni (cas du tunnel d'estimation).
 * Retourne `{ userId }` si OK.
 */
export async function requireAuth(opts: { from: string } & RequireAuthOpts) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    if (opts.loginPath) {
      // Le caller fournit déjà l'URL complète (path + search params) —
      // on bypass le typage strict de TanStack via un cast.
      throw redirect({ to: opts.loginPath as never });
    }
    throw redirect({
      to: "/auth/login",
      search: { next: opts.redirectTo ?? opts.from },
    });
  }
  return { userId: session.user.id };
}

/**
 * À utiliser dans le `beforeLoad` des pages auth (/auth/login, /auth/signup).
 *
 * Throw redirect vers `/biens` (ou ?next= si fourni) si déjà authentifié,
 * no-op sinon.
 */
export async function redirectIfAuthenticated({
  search,
}: {
  search: { next?: string };
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    const to = search.next ?? "/biens";
    // Le `next` est typé en string libre — TanStack n'aime pas, on
    // contourne avec un cast minimal. Sécurité : on n'accepte que les
    // chemins commençant par "/" (pas d'URL externe).
    if (!to.startsWith("/")) {
      throw redirect({ to: "/biens" });
    }
    throw redirect({ to: to as never });
  }
}
