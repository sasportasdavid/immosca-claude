// Layout partagé pour les pages légales (/legal/*).
//
// Choix design :
//   - Pas d'AppShell : ces pages sont accessibles sans auth (RGPD)
//   - Layout minimal : header simple ImmoScan + footer compliance + contenu
//   - Lisibilité prio : prose maxw-3xl, line-height 1.7, headings nets
//
// Mode Design (composant présentationnel pur) — reçoit titre + dateMaj + children.

import { Link } from "@tanstack/react-router";

import { LegalFooter } from "@/components/legal-footer";

export interface LegalPageProps {
  title: string;
  /** Date de dernière mise à jour, format "YYYY-MM-DD". */
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header minimal */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight hover:opacity-80"
          >
            ImmoScan
          </Link>
          <Link
            to="/auth/login"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Se connecter
          </Link>
        </div>
      </header>

      {/* Contenu */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Dernière mise à jour :{" "}
          {new Date(lastUpdated).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="legal-prose mt-8">{children}</div>
      </main>

      <LegalFooter />
    </div>
  );
}
