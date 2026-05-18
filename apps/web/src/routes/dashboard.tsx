// /dashboard — stub posé en étape 4 (auth) pour permettre les redirects
// post-login. La vraie implémentation arrive en étape 6 :
// - guard auth (redirect /auth/login si pas de session)
// - guard onboarding (redirect /onboarding/step-1 si user_params null)
// - état vide "Aucune analyse pour l'instant" + CTA disabled (PR3+)
// Le shell visuel est déjà disponible via <AppShell>.

import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const auth = useAuth();
  const profile = useProfile();
  const email = auth.user?.email ?? "—";
  const plan = profile.data?.subscription_plan ?? "free";

  return (
    <AppShell
      userEmail={email}
      userPlan={plan}
      currentRoute="dashboard"
      onLogout={() => auth.signOut()}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Dashboard · PR1 stub
        </span>
        <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Bienvenue.
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] text-muted-foreground">
          État vide ImmoScan. Les guards auth + onboarding et le contenu
          réel arrivent en étape 6 de PR1.
        </p>
      </div>
    </AppShell>
  );
}
