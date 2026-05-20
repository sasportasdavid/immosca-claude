// /auth/callback — destination du redirectTo des flows OAuth Google et
// magic link / email confirmation.
//
// Supabase parse l'URL automatiquement grâce à `detectSessionInUrl: true`
// (cf apps/value-web/src/lib/supabase.ts). Le listener
// `onAuthStateChange` (installé dans __root.tsx) déclenche identify
// PostHog + setSentryUser et invalide le cache.
//
// Notre seul job ici : attendre que la session apparaisse côté state
// puis rediriger vers `?next=` (ou /biens). Si timeout 5s : retour /auth/login.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";

export interface CallbackSearch {
  next?: string;
}

function validateSearch(raw: Record<string, unknown>): CallbackSearch {
  const next = typeof raw.next === "string" ? raw.next : undefined;
  return { next };
}

function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  React.useEffect(() => {
    if (auth.isAuthenticated) {
      const dest = search.next && search.next.startsWith("/") ? search.next : "/biens";
      void navigate({ to: dest as never, replace: true });
      return;
    }
    if (auth.isLoading) return;

    const timer = window.setTimeout(() => {
      toast.error("La connexion a échoué. Réessaie depuis la page de connexion.");
      void navigate({ to: "/auth/login", replace: true });
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [auth.isAuthenticated, auth.isLoading, navigate, search.next]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-terra"
        />
        <p className="text-[14px] text-muted-ink">Connexion en cours…</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch,
  component: CallbackPage,
});
