// EstimationStepperLayout — wrapper commun aux 4 étapes du tunnel.
// Header avec wordmark Immovalue + bouton Quitter, stepper terra (4 étapes),
// titre eyebrow / serif italic, slot pour le contenu et CTA bas.

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Adresse", "Description", "Photos", "Liens"] as const;

export interface EstimationStepperLayoutProps {
  /** 1-based step index (1..4). */
  step: 1 | 2 | 3 | 4;
  /** Eyebrow texte courte au-dessus du titre (ex. "ÉTAPE 4 · FACULTATIVE"). */
  eyebrow: React.ReactNode;
  /** Titre principal (peut contenir des span pour la serif italic). */
  title: React.ReactNode;
  /** Description sous le titre (1-2 phrases). */
  description?: React.ReactNode;
  /** Contenu principal de l'étape. */
  children: React.ReactNode;
  /** CTA de continuation. */
  continueLabel?: string;
  continueTo?: string;
  /** Si fourni, remplace le CTA Continuer (ex. step 4 avec deux CTA). */
  ctaSlot?: React.ReactNode;
  /** Lien retour. Si absent, on n'affiche pas le bouton ← Retour. */
  backTo?: string;
  /** Largeur max du conteneur (défaut 860px / step 2 et 3 → 880px). */
  maxWidth?: "narrow" | "wide";
}

export function EstimationStepperLayout({
  step,
  eyebrow,
  title,
  description,
  children,
  continueLabel = "Continuer",
  continueTo,
  ctaSlot,
  backTo,
  maxWidth = "narrow",
}: EstimationStepperLayoutProps) {
  return (
    <main
      className={cn(
        "min-h-screen bg-bg pb-24",
        // Halo subtil terra en haut à droite (cf maquettes).
        "[background-image:radial-gradient(700px_400px_at_85%_0%,rgba(217,119,87,0.08),transparent_60%)]",
      )}
    >
      <TunnelHeader />

      <div
        className={cn(
          "mx-auto px-6 sm:px-8",
          maxWidth === "wide" ? "max-w-[880px]" : "max-w-[860px]",
        )}
      >
        <StepperBar current={step} />

        <header className="mt-12 max-w-[32ch]">
          <Eyebrow variant="terra" className="mb-3">
            {eyebrow}
          </Eyebrow>
          <h1
            className={cn(
              "font-serif text-[clamp(2.25rem,4.5vw,3.25rem)] italic font-normal",
              "leading-[1.05] tracking-[-0.024em] text-ink [text-wrap:balance]",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-[56ch] text-[16px] leading-[1.55] text-muted-ink [text-wrap:pretty]">
              {description}
            </p>
          )}
        </header>

        <div className="mt-8">{children}</div>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t border-line pt-6">
          {backTo && (
            <Link
              to={backTo}
              className="text-[13.5px] text-muted-ink no-underline hover:text-ink"
            >
              ← Retour
            </Link>
          )}
          <span className="flex-1" />
          {ctaSlot ?? (
            continueTo && (
              <Button asChild variant="terra" size="lg">
                <Link to={continueTo}>
                  {continueLabel}
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </Button>
            )
          )}
        </footer>

        <div className="mt-20 flex items-center justify-between border-t border-line pt-6 font-mono text-[12px] text-mute-2">
          <span>Immovalue · Tunnel {step}/4</span>
          <Link to="/" className="text-violet no-underline">
            ← Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header — wordmark Immovalue + bouton Quitter discret
// ──────────────────────────────────────────────────────────────────

function TunnelHeader() {
  return (
    <header className="border-b border-line/60 bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-6 sm:px-8">
        <Wordmark />
        <Link
          to="/"
          className="rounded-full border border-line px-3 py-1 text-[12px] text-mute-2 no-underline hover:text-ink"
        >
          Quitter
        </Link>
      </div>
    </header>
  );
}

export function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 text-[14px] no-underline"
    >
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-r-xs bg-terra-grad text-[12px] font-bold text-white shadow-lvl-1"
      >
        I
      </span>
      <span className="font-medium tracking-tight text-ink">
        Immo<span className="font-serif italic font-normal text-terra">value</span>
      </span>
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────────
// StepperBar — barre de progression terra-grad avec 4 markers
// (calque sur la maquette : pas le composant <Stepper> qui est plus
// compact). Ici on a une vraie barre fine, plus claire visuellement
// pour un tunnel long.
// ──────────────────────────────────────────────────────────────────

function StepperBar({ current }: { current: 1 | 2 | 3 | 4 }) {
  const fillPct = (current / 4) * 100;
  return (
    <div className="mt-7 flex items-center gap-3.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute-2">
        Étape
      </span>
      <div className="relative h-1.5 flex-1 rounded-full bg-bg-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-terra-grad"
          style={{ width: `${fillPct}%` }}
        />
        {[1, 2, 3, 4].map((n) => {
          const left = (n / 4) * 100;
          const isDone = n < current;
          const isCur = n === current;
          return (
            <span
              key={n}
              aria-label={`${STEP_LABELS[n - 1]} (${
                isDone ? "fait" : isCur ? "en cours" : "à venir"
              })`}
              className={cn(
                "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
                isDone && "bg-terra",
                isCur && "bg-card border-terra shadow-[0_0_0_4px_rgba(217,119,87,0.18)]",
                !isDone && !isCur && "bg-bg-3",
              )}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>
      <span className="font-mono text-[11.5px] font-semibold tnum text-ink-2">
        {String(current).padStart(2, "0")}{" "}
        <span className="font-normal text-mute-2">/ 04</span>
      </span>
    </div>
  );
}
