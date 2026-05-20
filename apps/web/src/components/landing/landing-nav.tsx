// Nav publique de la landing.
// Logo sérif italique + violet dot · liens d'ancres · login + CTA essai.

import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line-soft bg-bg/80 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 md:px-8">
        <a href="/" className="font-serif text-[28px] italic leading-none tracking-[-0.012em] text-ink">
          Immoscan<span className="text-violet">.</span>
        </a>
        <div className="hidden gap-8 justify-self-center text-[13px] tracking-[0.02em] text-muted-ink md:flex">
          <a href="#methode" className="hover:text-ink transition-colors">
            Méthode
          </a>
          <a href="#tarifs" className="hover:text-ink transition-colors">
            Tarifs
          </a>
          <a href="#faq" className="hover:text-ink transition-colors">
            FAQ
          </a>
        </div>
        <div className="flex items-center gap-3 justify-self-end">
          <a
            href="/auth/login"
            className="hidden text-[13px] text-muted-ink hover:text-ink transition-colors sm:inline"
          >
            Connexion
          </a>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href="/auth/signup">Essai 7 jours</a>
          </Button>
        </div>
      </div>
    </nav>
  );
}
