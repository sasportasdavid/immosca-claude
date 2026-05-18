// /auth/callback — destination du redirectTo des flows OAuth Google et
// magic link.
//
// Supabase parse l'URL automatiquement grâce à `detectSessionInUrl: true`
// (cf apps/web/src/lib/supabase.ts) et crée la session. Le listener
// `onAuthStateChange` (installé dans __root.tsx) déclenche identify
// PostHog + setSentryUser et invalide le cache.
//
// Notre seul job ici : attendre que la session apparaisse côté state et
// rediriger l'user vers /dashboard. Si après 5s la session n'est toujours
// pas là, on bascule sur /auth/login avec un toast d'erreur.

import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Timeout safety net : si la session ne se matérialise pas en 5s,
  // c'est probablement un flow OAuth cassé (state expiré, code invalide).
  useEffect(() => {
    if (auth.isAuthenticated) {
      posthog.capture("login_completed", { method: "oauth_or_magic_link" });
      return;
    }
    if (auth.isLoading) return;

    const timer = window.setTimeout(() => {
      toast.error("La connexion a échoué. Réessaie depuis la page de connexion.");
      navigate({ to: "/auth/login", replace: true });
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
        />
        <p className="text-[14px] text-muted-foreground">
          Connexion en cours…
        </p>
      </div>
    </div>
  );
}
