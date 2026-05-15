import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { ListingCard } from "@/components/listing-card";
import { ScoreBadge } from "@/components/score-badge";

// Page de validation visuelle des composants Design — supprimée à la fin de PR1.
// Mode Design strict : aucun fetch, props hardcodées.

export const Route = createFileRoute("/dev/components")({
  component: DevComponentsPage,
});

function Section({
  num,
  title,
  hint,
  children,
}: {
  num: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border pb-12">
      <div className="mb-6 flex items-baseline gap-3 border-b border-border pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {num}
        </span>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em]">{title}</h2>
        {hint ? (
          <span className="ml-auto text-[12px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DevComponentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        userEmail="marc.dupont@example.fr"
        userPlan="pro"
        onLogout={() => undefined}
        onUpgradeClick={() => undefined}
      />

      <main className="mx-auto max-w-[1280px] px-6 py-12">
        <header className="mb-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Validation visuelle · PR1
          </span>
          <h1 className="mt-2 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
            Composants Design.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] text-muted-foreground">
            Cette page affiche les 3 composants présentationnels avec props
            hardcodées. Elle sera supprimée à la fin de la PR1.
          </p>
        </header>

        {/* 01 — ScoreBadge */}
        <Section
          num="01"
          title="ScoreBadge"
          hint="≥75 vert · 50-74 orange · <50 rouge"
        >
          <div className="grid grid-cols-3 gap-6">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Score = 92
              </div>
              <div className="flex items-center gap-4">
                <ScoreBadge score={92} size="sm" />
                <ScoreBadge score={92} size="md" />
                <ScoreBadge score={92} size="lg" />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <ScoreBadge score={92} size="md" showLabel />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Score = 65
              </div>
              <div className="flex items-center gap-4">
                <ScoreBadge score={65} size="sm" />
                <ScoreBadge score={65} size="md" />
                <ScoreBadge score={65} size="lg" />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <ScoreBadge score={65} size="md" showLabel />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Score = 35
              </div>
              <div className="flex items-center gap-4">
                <ScoreBadge score={35} size="sm" />
                <ScoreBadge score={35} size="md" />
                <ScoreBadge score={35} size="lg" />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <ScoreBadge score={35} size="md" showLabel />
              </div>
            </div>
          </div>
        </Section>

        {/* 02 — ListingCard */}
        <Section
          num="02"
          title="ListingCard"
          hint="Masquage freemium = SQL. Le composant rend ce qu'on lui passe."
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Pro · données complètes
              </div>
              <ListingCard
                title="Maison 4P · 95 m² · jardin"
                prix={235_000}
                surface={95}
                pieces={4}
                ville="Gagny"
                codePostal="93220"
                dpe="D"
                score={92}
                isMasked={false}
                onPin={() => undefined}
              />
            </div>
            <div>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Free · prix masqué (score &gt; 70)
              </div>
              <ListingCard
                title="Appartement T3 · 72 m²"
                prix={null}
                surface={72}
                pieces={3}
                ville="Gagny"
                codePostal="93220"
                dpe="C"
                score={87}
                isMasked={true}
                onUpgradeClick={() => undefined}
              />
            </div>
            <div>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Score moyen · DPE F passoire
              </div>
              <ListingCard
                title="Appartement F · 60,5 m²"
                prix={155_000}
                surface={60.5}
                pieces={3}
                ville="Gagny"
                codePostal="93220"
                dpe="F"
                score={65}
                isMasked={false}
                onPin={() => undefined}
              />
            </div>
            <div>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                No-go · prix trop élevé
              </div>
              <ListingCard
                title="Studio · 29 m² RDC"
                prix={130_000}
                surface={29}
                pieces={1}
                ville="Gagny"
                codePostal="93220"
                dpe="D"
                score={24}
                isMasked={false}
                onPin={() => undefined}
              />
            </div>
          </div>
        </Section>

        {/* 03 — AppHeader */}
        <Section
          num="03"
          title="AppHeader"
          hint="Pro connecté · Free connecté · déconnecté"
        >
          <div className="space-y-6">
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Plan Pro — utilisateur connecté
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <AppHeader
                  userEmail="marc.dupont@example.fr"
                  userPlan="pro"
                  onLogout={() => undefined}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Plan Free — CTA &quot;Passer Pro&quot; visible
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <AppHeader
                  userEmail="invest@example.fr"
                  userPlan="free"
                  onLogout={() => undefined}
                  onUpgradeClick={() => undefined}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Déconnecté — boutons connexion / inscription
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <AppHeader userEmail={null} userPlan={null} />
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
