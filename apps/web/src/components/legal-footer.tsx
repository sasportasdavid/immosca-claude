// Footer compliance présent sur les pages légales + landing.
// Liens vers les 4 pages obligatoires (CGV/CGU/Confidentialité/Mentions).

import { Link } from "@tanstack/react-router";

export function LegalFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          © {new Date().getFullYear()} ImmoScan · SaaS d'aide à l'investissement
          immobilier
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link to="/legal/cgu" className="hover:text-foreground">
            CGU
          </Link>
          <Link to="/legal/cgv" className="hover:text-foreground">
            CGV
          </Link>
          <Link to="/legal/confidentialite" className="hover:text-foreground">
            Confidentialité
          </Link>
          <Link to="/legal/mentions-legales" className="hover:text-foreground">
            Mentions légales
          </Link>
        </nav>
      </div>
    </footer>
  );
}
