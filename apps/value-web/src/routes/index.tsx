// Landing ImmoValue — écran 1.
//
// Hero proposition de valeur, input adresse central, parcours en 3 étapes
// (Estime → Suis → Vends), méthode synthétique sans mentionner "13 sources",
// preuve sociale placeholder, cross-lien ImmoScan en footer.

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Check,
  FileText,
  MapPin,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { Wordmark } from "@/components/value/EstimationStepperLayout";
import { useEstimerState } from "@/hooks/use-estimer-state";
import { cn } from "@/lib/utils";

function LandingPage() {
  const navigate = useNavigate();
  const { state, patch } = useEstimerState();
  const [address, setAddress] = React.useState(state.address);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (trimmed.length === 0) return;
    patch("address", trimmed);
    void navigate({ to: "/estimer" });
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-bg",
        "[background-image:radial-gradient(900px_600px_at_90%_-5%,rgba(217,119,87,0.12),transparent_60%),radial-gradient(600px_400px_at_-10%_30%,rgba(91,71,224,0.05),transparent_60%)]",
      )}
    >
      <LandingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-24 sm:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <HeroEyebrow />

            <h1
              className={cn(
                "mt-7 font-serif font-normal text-ink",
                "text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.96] tracking-[-0.03em]",
                "max-w-[11ch] [text-wrap:balance]",
              )}
            >
              Estime ton bien,{" "}
              <span className="italic text-terra">
                suis le marché,
              </span>{" "}
              <span className="block">vends au bon moment.</span>
            </h1>

            <p className="mt-7 max-w-[50ch] text-[17.5px] leading-[1.55] text-muted-ink [text-wrap:pretty]">
              Estimation argumentée, gratuite, sans inscription. Tu fournis
              l&rsquo;adresse, on croise les données publiques avec tes
              propres comparables et on te rend une fourchette opposable —
              pas un score opaque.
            </p>

            {/* Address input */}
            <form
              onSubmit={handleSubmit}
              className="mt-9 max-w-[540px] space-y-2"
            >
              <label
                htmlFor="iv-address"
                className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-mute-2"
              >
                <MapPin className="h-3 w-3 text-terra" strokeWidth={2} />
                Où se trouve ton bien ?
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2.5">
                <div className="relative">
                  <MapPin
                    aria-hidden
                    className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-2"
                    strokeWidth={2}
                  />
                  <input
                    id="iv-address"
                    type="text"
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Adresse, ville, code postal"
                    className={cn(
                      "h-[60px] w-full rounded-r-lg border border-line-2 bg-card pl-11 pr-4 text-[15.5px] text-ink",
                      "placeholder:text-mute-2 shadow-lvl-2",
                      "focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra",
                    )}
                  />
                </div>
                <Button type="submit" variant="terra" size="lg" className="h-[60px] px-6 text-[14.5px]">
                  Estimer mon bien
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 text-[11.5px] text-mute-2">
                <Pill icon={<Check className="h-3 w-3 text-sage-2" strokeWidth={2.5} />}>
                  Sans inscription
                </Pill>
                <Pill icon={<Check className="h-3 w-3 text-sage-2" strokeWidth={2.5} />}>
                  Sans carte bleue
                </Pill>
                <Pill icon={<Check className="h-3 w-3 text-sage-2" strokeWidth={2.5} />}>
                  Sans commission
                </Pill>
              </div>
            </form>
          </div>

          {/* Hero art */}
          <HeroArt />
        </div>
      </section>

      <HowItWorksSection />
      <MethodeSection />
      <ComparablesSection />
      <TestimonialsSection />

      {/* Final CTA */}
      <section className="border-t border-line bg-bg-2">
        <div className="mx-auto max-w-[1100px] px-6 py-20 text-center sm:px-8">
          <h2 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
            Commence par{" "}
            <span className="italic text-terra">savoir</span> ce que vaut ton
            bien.
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-[15.5px] text-muted-ink">
            Une estimation argumentée, à n&rsquo;importe quelle heure, sans
            te laisser un email.
          </p>
          <div className="mt-7 flex justify-center">
            <Button asChild variant="terra" size="lg">
              <Link to="/estimer">
                Estimer mon bien
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────

function LandingHeader() {
  return (
    <header className="border-b border-line/60 bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6 sm:px-8">
        <Wordmark />
        <nav className="hidden gap-7 text-[13.5px] text-muted-ink md:flex">
          <a href="#methode" className="no-underline hover:text-ink">
            Méthode
          </a>
          <a href="#comparables" className="no-underline hover:text-ink">
            Tes comparables
          </a>
          <a href="#parcours" className="no-underline hover:text-ink">
            Parcours
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/estimer/compte"
            className="text-[13px] text-ink-2 no-underline hover:text-ink"
          >
            Se connecter
          </Link>
          <Button asChild variant="terra" size="sm" className="hidden md:inline-flex">
            <Link to="/estimer">Estimer mon bien</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroEyebrow() {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-card pl-1.5 pr-3.5 py-1.5 text-[12px] text-muted-ink shadow-lvl-1">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-terra px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-white">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Gratuit
      </span>
      Estimation indépendante · sources publiques · sans commission
    </span>
  );
}

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 py-1">
      {icon}
      {children}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Hero art — placeholder maison + floating cards
// ──────────────────────────────────────────────────────────────────

function HeroArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px] lg:ml-auto">
      <div className="absolute inset-[8%] overflow-hidden rounded-r-2xl border border-line bg-card shadow-lvl-3">
        <svg
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="hsky-iv" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#F6E9DB" />
              <stop offset="1" stopColor="#E8D5C0" />
            </linearGradient>
          </defs>
          <rect width="400" height="280" fill="url(#hsky-iv)" />
          <rect x="0" y="280" width="400" height="120" fill="#E5DDD3" />
          <rect x="260" y="100" width="22" height="50" fill="#A89789" />
          <polygon points="60,180 200,80 340,180" fill="#C76544" />
          <polygon points="60,180 200,80 340,180" fill="url(#hsky-iv)" opacity="0.18" />
          <line x1="60" y1="180" x2="340" y2="180" stroke="#A8482A" strokeWidth="3" />
          <rect x="90" y="180" width="220" height="160" fill="#FAF6F0" stroke="#D9CFC0" strokeWidth="2" />
          <rect x="120" y="210" width="50" height="50" fill="#D9CFC0" stroke="#A89789" strokeWidth="2" />
          <rect x="230" y="210" width="50" height="50" fill="#D9CFC0" stroke="#A89789" strokeWidth="2" />
          <rect x="180" y="270" width="40" height="70" fill="#D97757" />
          <circle cx="60" cy="320" r="34" fill="#9DAE9F" />
          <circle cx="350" cy="310" r="40" fill="#9DAE9F" />
          <circle cx="320" cy="80" r="22" fill="#F6DFD2" />
        </svg>
      </div>

      {/* Float card 1 — estimation */}
      <div className="absolute left-0 top-[8%] z-10 rounded-r-lg border border-line bg-card p-4 shadow-lvl-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-mute-2">
          Estimation
        </div>
        <div className="mt-1 font-mono text-[22px] font-semibold tnum text-ink">
          295–332 k€
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-sage-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sage" />
          Confiance 84%
        </div>
      </div>

      {/* Float card 2 — comparables (dark) */}
      <div className="absolute bottom-[12%] right-[-4%] z-10 flex max-w-[250px] items-center gap-2.5 rounded-r-lg border border-ink bg-ink p-4 text-white shadow-lvl-2">
        <div className="flex gap-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-r-xs bg-[#F0413B] font-mono text-[9px] font-bold text-white">
            SL
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-r-xs bg-[#FF5A03] font-mono text-[9px] font-bold text-white">
            LBC
          </span>
        </div>
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.10em] text-white/60">
            Tes comparables
          </div>
          <div className="mt-1 text-[12.5px]">
            47 + 32 biens ·{" "}
            <b className="font-semibold text-terra">pondération haute</b>
          </div>
        </div>
      </div>

      {/* Float card 3 — signal */}
      <div className="absolute bottom-[48%] left-[-4%] z-10 max-w-[200px] rounded-r-lg border border-terra/40 bg-terra-soft p-3.5 shadow-lvl-2">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.10em] text-terra-deep">
          Signal marché
        </div>
        <div className="mt-1 text-[12.5px] leading-snug text-ink-2">
          Valorisation en hausse de{" "}
          <b className="font-mono font-semibold text-terra-deep">+4,2 %</b> sur
          30 jours.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// "Comment ça marche" — 3 colonnes Estime / Suis / Vends
// ──────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <section id="parcours" className="border-t border-line bg-bg">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:px-8">
        <div className="max-w-[60ch]">
          <Eyebrow>Le parcours</Eyebrow>
          <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
            Trois moments,{" "}
            <span className="italic text-terra">tu décides</span> à chaque
            palier.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <HowCard
            num="01"
            icon={<Search className="h-5 w-5" strokeWidth={2} />}
            title="Estime"
            desc="Tu renseignes adresse, caractéristiques, photos et tes propres recherches comparables. On instruit le dossier et on te rend une fourchette argumentée."
            badge="Gratuit · sans compte"
            featured
          />
          <HowCard
            num="02"
            icon={<Bell className="h-5 w-5" strokeWidth={2} />}
            title="Suis"
            desc="Réévaluation automatique chaque semaine. Tu es prévenu si la valorisation bouge de plus de 3 %, à la hausse comme à la baisse."
            badge="Gratuit · alertes hebdo"
          />
          <HowCard
            num="03"
            icon={<Megaphone className="h-5 w-5" strokeWidth={2} />}
            title="Vends"
            desc="Quand tu décides, tu bascules en vente publique. Annonce, contacts directs, visibilité — paiement unique, sans commission."
            badge="49 € · paiement unique"
          />
        </div>
      </div>
    </section>
  );
}

function HowCard({
  num,
  icon,
  title,
  desc,
  badge,
  featured = false,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge: string;
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative flex flex-col gap-3 p-7",
        featured && "border-terra/30 bg-gradient-to-b from-terra/[0.04] to-transparent",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-mute-2">
          {num}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-r",
            featured
              ? "bg-terra-soft text-terra-deep"
              : "bg-bg-2 text-ink-2",
          )}
        >
          {icon}
        </span>
      </div>
      <h3 className="font-serif text-[26px] font-normal italic leading-tight tracking-[-0.018em] text-ink">
        {title}
      </h3>
      <p className="text-[14px] leading-[1.55] text-muted-ink">{desc}</p>
      <span
        className={cn(
          "mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
          featured
            ? "bg-terra-soft text-terra-deep"
            : "bg-bg-2 text-ink-2",
        )}
      >
        {badge}
      </span>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// "Notre méthode" — sans dire "13 sources"
// ──────────────────────────────────────────────────────────────────

function MethodeSection() {
  return (
    <section id="methode" className="border-t border-line bg-bg-2/40">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow variant="violet">Méthode · traçabilité</Eyebrow>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
              Chaque chiffre,{" "}
              <span className="italic text-terra">une source</span>.
            </h2>
            <p className="mt-5 max-w-[56ch] text-[15.5px] leading-[1.6] text-muted-ink">
              Pas de boîte noire. Chaque ajustement de l&rsquo;estimation
              renvoie à la donnée publique qui le justifie — transactions
              notariales pour les prix, ADEME pour l&rsquo;énergie, INSEE
              pour le secteur, observatoires locaux pour le locatif. La
              méthode d&rsquo;évaluation des notaires, appliquée à
              l&rsquo;échelle d&rsquo;internet.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {METHODE_PILLS.map((p) => (
                <SourcePill key={p.name} {...p} />
              ))}
            </div>

            <p className="mt-5 max-w-[56ch] text-[13px] text-mute-2">
              Méthodologie publique, données auditables et traçabilité ligne
              par ligne dans le rapport final.
            </p>
          </div>

          <div className="rounded-r-2xl border border-line bg-card p-6 shadow-lvl-1">
            <Eyebrow variant="terra">L&rsquo;analyse en pratique</Eyebrow>
            <h3 className="mt-3 font-serif text-[26px] font-normal italic leading-tight tracking-[-0.018em] text-ink">
              « Ton T3 du Chénay tape dans la zone d&rsquo;investisseur locatif. »
            </h3>
            <p className="mt-4 text-[14px] leading-[1.6] text-muted-ink">
              Tes photos confirment une rénovation récente — ajustement
              positif. Bruit RER mesurable côté Est — ajustement négatif.
              Chaque ligne du rapport est justifiée par une source publique.
            </p>
            <div className="mt-5 flex items-center gap-2 text-[12px] text-mute-2">
              <Sparkles className="h-3.5 w-3.5 text-terra" strokeWidth={2} />
              Extrait d&rsquo;une thèse pour un T3 à Gagny.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const METHODE_PILLS = [
  { name: "Transactions notariales", sub: "Cinq ans d'historique", dot: "violet" },
  { name: "ADEME", sub: "DPE officiel du bien", dot: "terra" },
  { name: "Marché actif", sub: "SeLoger · Leboncoin", dot: "sage" },
  { name: "INSEE · IRIS", sub: "Démographie quartier", dot: "violet" },
  { name: "Observatoires loyers", sub: "Référence locative", dot: "terra" },
  { name: "Géorisques", sub: "Risques environnementaux", dot: "sage" },
] as const;

function SourcePill({
  name,
  sub,
  dot,
}: {
  name: string;
  sub: string;
  dot: "violet" | "terra" | "sage";
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-r border border-line bg-card p-3">
      <span
        aria-hidden
        className={cn(
          "mt-1 h-2 w-2 shrink-0 rounded-full",
          dot === "violet" && "bg-violet",
          dot === "terra" && "bg-terra",
          dot === "sage" && "bg-sage",
        )}
      />
      <div>
        <div className="text-[13px] font-medium text-ink">{name}</div>
        <div className="text-[11.5px] text-mute-2">{sub}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// "Tes comparables comptent" — schéma nous vs toi
// ──────────────────────────────────────────────────────────────────

function ComparablesSection() {
  return (
    <section id="comparables" className="border-t border-line bg-bg">
      <div className="mx-auto max-w-[1100px] px-6 py-24 sm:px-8">
        <div className="max-w-[60ch]">
          <Eyebrow variant="terra">Le différenciateur</Eyebrow>
          <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
            Le micro-marché, c&rsquo;est{" "}
            <span className="italic text-terra">toi</span> qui le connais.
          </h2>
          <p className="mt-5 text-[15.5px] leading-[1.6] text-muted-ink">
            On voit des centaines d&rsquo;annonces dans ton secteur. Toi tu
            sais lesquelles ressemblent vraiment au tien — étage, exposition,
            état perçu, micro-quartier. Tu fournis 1 à 3 recherches SeLoger
            ou Leboncoin, on les pondère plus fort que nos propres
            comparables.
          </p>
        </div>

        <Card className="mt-10 grid gap-6 p-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <ComparableSide
            label="Ce qu'on voit"
            value="661 annonces"
            desc="Tout ce qui s'est vendu et tout ce qui se vend dans ton secteur depuis 5 ans."
          />
          <ArrowRight className="hidden h-6 w-6 text-terra sm:block" strokeWidth={1.5} />
          <ComparableSide
            label="Ce que toi tu connais"
            value="~10 vraiment comparables"
            desc="Mêmes étage, exposition, état, micro-quartier. La connaissance qu'aucun algo n'a."
            highlighted
          />
        </Card>
      </div>
    </section>
  );
}

function ComparableSide({
  label,
  value,
  desc,
  highlighted = false,
}: {
  label: string;
  value: string;
  desc: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-r-lg p-5",
        highlighted &&
          "border border-terra/20 bg-gradient-to-b from-terra/[0.08] to-terra/[0.02]",
      )}
    >
      <div
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.10em]",
          highlighted ? "text-terra-deep" : "text-mute-2",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-[28px] font-semibold tnum tracking-[-0.02em]",
          highlighted ? "text-terra-deep" : "text-ink-2",
        )}
      >
        {value}
      </div>
      <p
        className={cn(
          "mt-1.5 text-[13px] leading-snug",
          highlighted ? "text-ink-2" : "text-muted-ink",
        )}
      >
        {desc}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Preuve sociale (placeholder)
// ──────────────────────────────────────────────────────────────────

function TestimonialsSection() {
  return (
    <section className="border-t border-line bg-bg-2/40">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:px-8">
        <div className="max-w-[60ch]">
          <Eyebrow>Ils ont vendu au bon moment</Eyebrow>
          <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
            Une estimation, puis{" "}
            <span className="italic text-terra">le temps</span> de décider.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    name: "Camille, Lyon 3e",
    quote:
      "J'ai testé l'intérêt en mode discret pendant trois semaines avant d'arbitrer prix vs vitesse. Vendu sous deux mois au prix annoncé.",
    detail: "T3 67 m² · vendu en 7 semaines",
  },
  {
    name: "Karim, Aubervilliers",
    quote:
      "Le rapport explique chaque ajustement. Mon notaire a validé la fourchette en quinze minutes — c'est rare.",
    detail: "Maison 4P 92 m² · prix obtenu : centrale + 1,2 %",
  },
  {
    name: "Léa & David, Gagny",
    quote:
      "On a fourni nos propres recherches. La pondération haute sur nos liens a fait bouger la fourchette de 6 % — la réalité du quartier.",
    detail: "T3 62 m² · estimation centrale 312 000 €",
  },
] as const;

function TestimonialCard({
  name,
  quote,
  detail,
}: {
  name: string;
  quote: string;
  detail: string;
}) {
  return (
    <Card className="flex h-full flex-col gap-4 p-7">
      <div className="flex gap-1 text-terra">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
        ))}
      </div>
      <p className="font-serif text-[18px] italic leading-[1.45] text-ink-2 [text-wrap:pretty]">
        « {quote} »
      </p>
      <div className="mt-auto text-[13px] text-mute-2">
        <div className="font-medium text-ink">{name}</div>
        <div className="font-mono text-[11px] tracking-wide">{detail}</div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Footer + cross-lien ImmoScan
// ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto max-w-[1200px] px-6 py-14 sm:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-[40ch] text-[13px] leading-[1.55] text-muted-ink">
              Estimation immobilière indépendante. Sources publiques croisées,
              tes comparables pondérés, méthode opposable. Sans commission.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-mute-2">
              <Pill icon={<ShieldCheck className="h-3 w-3 text-sage-2" strokeWidth={2} />}>
                RGPD · données auditables
              </Pill>
              <Pill icon={<FileText className="h-3 w-3 text-violet" strokeWidth={2} />}>
                Méthode publique
              </Pill>
            </div>
          </div>

          <FooterCol
            title="Produit"
            links={[
              { label: "Estimer", to: "/estimer" },
              { label: "Méthode", to: "#methode" },
              { label: "Annonces", to: "#" },
            ]}
          />
          <FooterCol
            title="Société"
            links={[
              { label: "À propos", to: "#" },
              { label: "Mentions légales", to: "#" },
              { label: "Confidentialité", to: "#" },
            ]}
          />

          {/* Cross-lien ImmoScan */}
          <div className="rounded-r-lg border border-violet/20 bg-violet-soft/60 p-5">
            <Eyebrow variant="violet">Investisseur ?</Eyebrow>
            <h4 className="mt-2 font-serif text-[18px] italic leading-tight text-ink">
              Tu cherches plutôt à investir ?
            </h4>
            <p className="mt-2 text-[13px] text-muted-ink">
              ImmoScan analyse 50 à 500 annonces par requête et te sort les
              opportunités locatives notées par Claude.
            </p>
            <a
              href="https://immoscan.fr"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet no-underline hover:text-violet-deep"
            >
              Découvrir ImmoScan
              <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 font-mono text-[11.5px] text-mute-2">
          <span>© 2026 ImmoValue · une initiative ImmoScan</span>
          <span>Mode clair uniquement · v1.0</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div>
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mute-2">
        {title}
      </h4>
      <ul className="mt-3 space-y-2 text-[13px]">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.to}
              className="text-ink-2 no-underline hover:text-ink"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPage,
});
