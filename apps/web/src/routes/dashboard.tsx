// /dashboard — coquille PR1 finalisée.
//
// Guards beforeLoad (serveur-side, lèvent redirect avant rendu) :
// 1. requireAuth → /auth/login si pas de session
// 2. requireOnboarded → /onboarding/step-1 si user_params manquant
//
// Contenu PR1 : état vide stylisé "Aucune analyse pour l'instant" avec
// un CTA "Nouvelle analyse" disabled (PR3 le câblera). On y arrive
// seulement quand auth + onboarding sont OK — c'est l'écran que voit
// un user juste après son signup + 2 steps.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: DashboardPage,
});

function DashboardPage() {
  const auth = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();
  const email = auth.user?.email ?? "—";
  const plan = profile.data?.subscription_plan ?? "free";

  return (
    <AppShell
      userEmail={email}
      userPlan={plan}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-[960px] px-6 py-12">
        {/* Greeting */}
        <header className="mb-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Dashboard
          </span>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Bonjour.
          </h1>
          <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
            Tu n'as pas encore lancé d'analyse. Colle une URL SeLoger ou
            Leboncoin pour démarrer.
          </p>
        </header>

        {/* Empty state */}
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <div
            aria-hidden="true"
            className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-[20px] font-semibold tracking-[-0.015em]">
            Aucune analyse pour l'instant.
          </h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-[14px] text-muted-foreground">
            ImmoScan croise 100 à 500 annonces avec DVF, DPE, INSEE et
            Géorisques en 8 minutes. Tu obtiens un Top 5 avec thèse Claude.
          </p>
          <div className="mt-6">
            <Button
              size="lg"
              onClick={() => navigate({ to: "/app/nouvelle-analyse" })}
            >
              Lancer une analyse
            </Button>
          </div>
        </div>

        {/* Help / next steps */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Tes paramètres
            </div>
            <div className="mt-2 text-[14px] leading-[1.5] text-secondary-foreground">
              {profile.data?.full_name ? `${profile.data.full_name} · ` : ""}
              Plan {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Pro+"}.
            </div>
            <a
              href="/onboarding/step-2"
              className="mt-3 inline-block text-[12px] text-primary hover:underline"
            >
              Modifier mes paramètres →
            </a>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Documentation
            </div>
            <p className="mt-2 text-[14px] leading-[1.5] text-muted-foreground">
              Méthodologie de scoring, sources de données, calculs de
              rendement.
            </p>
            <a
              href="/methodologie"
              className="mt-3 inline-block text-[12px] text-primary hover:underline"
            >
              Voir la doc →
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
