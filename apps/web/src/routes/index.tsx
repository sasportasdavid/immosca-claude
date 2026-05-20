// Landing publique — re-skin direction Linear/Attio/Qonto (mai 2026).
// Composition des sections de `Landing - Mix.html` (handoff Claude
// Design) :
//   - Nav sticky
//   - Hero éditorial split (slogan sérif + verdict card démo)
//   - Ticker des biens scannés (CSS animation, données mockées)
//   - "Trois minutes pour poser la question…" — 3 étapes
//   - "Ce que tu vois" — 4 features (Carte, Score, Thèse, Pipeline)
//   - "Tu fais déjà tout ça. Manuellement." — vs Excel
//   - FAQ accordéon
//   - Pricing (Free + Pro+ / Pro / Business) aligné CLAUDE.md §12
//   - Final CTA + footer signature
//
// Toutes les sections sont des composants présentationnels dans
// `components/landing/`. Aucun fetch ni accès Supabase ici, seule la
// logique `redirectIfAuthenticated` reste pour rediriger les users
// déjà connectés vers /dashboard.

import { createFileRoute } from "@tanstack/react-router";

import { LandingCompare } from "@/components/landing/landing-compare";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHow } from "@/components/landing/landing-how";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingTicker } from "@/components/landing/landing-ticker";
import { redirectIfAuthenticated } from "@/lib/auth-guards";

export const Route = createFileRoute("/")({
  beforeLoad: redirectIfAuthenticated,
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingTicker />
        <LandingHow />
        <LandingFeatures />
        <LandingCompare />
        <LandingFaq />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  );
}
