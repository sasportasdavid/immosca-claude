import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

// Preview full-page de l'AppShell. Supprimé fin PR1 (étape 7).

export const Route = createFileRoute("/dev/preview/app-shell")({
  component: PreviewAppShell,
});

function PreviewAppShell() {
  return (
    <AppShell
      userEmail="marc.dupont@example.fr"
      userPlan="free"
      currentRoute="dashboard"
      onLogout={() => undefined}
      onUpgradeClick={() => undefined}
      onNewAnalysis={() => undefined}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Preview · AppShell
        </span>
        <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Dashboard (placeholder).
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] text-muted-foreground">
          Sidebar 232 px à gauche, topbar 48 px en haut. Items nav "Mes
          analyses", "Veilles", "Pipeline", "Plan & facturation" rendus en
          state disabled avec tooltip "Disponible bientôt". Seul Dashboard
          est navigable en PR1.
        </p>
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <p className="text-[13px] text-muted-foreground">
            La vraie route /dashboard est posée en étape 6 de PR1 (skeleton +
            guards auth + redirect onboarding si user_params manquants).
          </p>
        </div>
      </div>
    </AppShell>
  );
}
