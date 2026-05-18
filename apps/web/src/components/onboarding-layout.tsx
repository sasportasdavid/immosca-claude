import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  OnboardingStepper,
  type OnboardingStepperProps,
} from "@/components/onboarding-stepper";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Coquille pour les routes /onboarding/step-*. Header avec logo + stepper,
// contenu centré max-720px, footer sticky avec boutons précédent/suivant.
// Pas d'AppShell (l'user n'a pas encore d'analyses, sidebar = bruit).

export type OnboardingLayoutProps = {
  step: OnboardingStepperProps["step"];
  stepLabels: OnboardingStepperProps["labels"];
  title: string;
  subtitle?: string;
  /** Désactive le bouton "Suivant" (validation pas OK). */
  nextDisabled?: boolean;
  /** Label custom pour le CTA principal. Default "Suivant". */
  nextLabel?: string;
  /** Si false, masque le bouton "Précédent" (utile sur step 1). */
  showPrev?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onStepClick?: OnboardingStepperProps["onStepClick"];
  className?: string;
  children: React.ReactNode;
};

export function OnboardingLayout({
  step,
  stepLabels,
  title,
  subtitle,
  nextDisabled,
  nextLabel = "Suivant",
  showPrev = true,
  onPrev,
  onNext,
  onStepClick,
  className,
  children,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header logo + stepper */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-6 px-6 py-4">
          <a href="/" className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
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
          <OnboardingStepper
            step={step}
            labels={stepLabels}
            onStepClick={onStepClick}
          />
        </div>
      </header>

      {/* Contenu centré */}
      <main className="flex-1">
        <div className="mx-auto max-w-[720px] px-6 py-12">
          <div className="mb-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Étape {step} sur {stepLabels.length}
            </span>
            <h1 className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-[60ch] text-[14px] text-muted-foreground leading-[1.5]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className={cn("space-y-6", className)}>{children}</div>
        </div>
      </main>

      {/* Footer sticky : actions */}
      <footer className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-6 py-4">
          <div>
            {showPrev ? (
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={onPrev}
                disabled={!onPrev}
              >
                <ArrowLeft className="h-4 w-4" />
                Précédent
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            size="default"
            onClick={onNext}
            disabled={nextDisabled || !onNext}
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
