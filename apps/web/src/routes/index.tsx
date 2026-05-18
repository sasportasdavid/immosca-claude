// Landing publique minimaliste — PR1.
//
// Décision PO (commit b2b2d6d) : pas de landing handoff-grade en PR1.
// Logo + 1 CTA "S'inscrire" + redirect /dashboard si déjà connecté. La
// vraie landing marketing (héros, démo, preuve sociale, pricing, FAQ
// — cf brief original Bloc A) viendra avec un handoff design dédié.

import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { redirectIfAuthenticated } from "@/lib/auth-guards";

export const Route = createFileRoute("/")({
  beforeLoad: redirectIfAuthenticated,
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header minimaliste */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <a href="/" className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground"
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 13V8.5A1.5 1.5 0 0 1 6.5 7h2A1.5 1.5 0 0 1 10 8.5V13M3 13h13M10 13v-2.5A1.5 1.5 0 0 1 11.5 9h1A1.5 1.5 0 0 1 14 10.5V13M14 13h3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight">
              ImmoScan
            </span>
          </a>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href="/auth/login">Connexion</a>
            </Button>
            <Button asChild size="sm">
              <a href="/auth/signup">S'inscrire</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-[640px] text-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Investissement locatif · France
          </span>
          <h1 className="mt-4 text-[48px] font-semibold leading-[1.05] tracking-[-0.025em]">
            20 heures d'analyse Excel en 8 minutes.
          </h1>
          <p className="mx-auto mt-5 max-w-[60ch] text-[16px] leading-[1.6] text-muted-foreground">
            Tu colles une URL SeLoger ou Leboncoin, ImmoScan croise les 500
            annonces avec DVF, DPE, INSEE et te livre un rapport scoré
            avec thèse Claude.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="/auth/signup">Créer mon compte</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="/auth/login">Se connecter</a>
            </Button>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            7 jours d'essai Pro offerts, sans carte bancaire.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 text-[12px] text-muted-foreground">
          <span>ImmoScan · 2026</span>
          <div className="flex items-center gap-4">
            <a
              href="/mentions-legales"
              className="hover:text-foreground transition-colors"
            >
              Mentions légales
            </a>
            <a
              href="/confidentialite"
              className="hover:text-foreground transition-colors"
            >
              Confidentialité
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
