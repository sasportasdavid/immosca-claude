// Tunnel · Étape 4 — Liens comparables ⭐
//
// L'écran différenciateur. Sous-titre rassurant ("facultative"), schéma
// pédagogique "Nous : 661 annonces → Toi : ~10 qui te ressemblent",
// input multi-URL avec validation regex live, liste avec preview mock,
// 2 CTA en bas : "Continuer avec ces liens" (terra) + "Continuer sans".
// Bandeau pédago violet en fond.

import { ArrowRight, Lightbulb, Sparkles, Star } from "lucide-react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { EstimationStepperLayout } from "@/components/value/EstimationStepperLayout";
import { LiensComparablesInput } from "@/components/value/LiensComparablesInput";
import { useAuth } from "@/hooks/use-auth";
import { useEstimerState } from "@/hooks/use-estimer-state";

function StepLiensComparablesPage() {
  const navigate = useNavigate();
  const { state, patch } = useEstimerState();
  const { isAuthenticated } = useAuth();

  // Auth gate : si l'user n'est pas loggé, on intercale /estimer/compte
  // (avec afterAuth=calcul) pour qu'il crée son compte avant le call
  // à l'edge fn `value-estimer`. Sinon on enchaîne directement sur
  // l'écran de calcul.
  function handleContinue() {
    if (isAuthenticated) {
      void navigate({ to: "/estimer/calcul" });
    } else {
      void navigate({
        to: "/estimer/compte",
        search: { afterAuth: "calcul" } as never,
      });
    }
  }

  function handleSkip() {
    // On efface les URLs au cas où l'utilisateur en avait saisi puis
    // change d'avis — comportement explicite "sans lien".
    patch("user_provided_urls", []);
    if (isAuthenticated) {
      void navigate({ to: "/estimer/calcul" });
    } else {
      void navigate({
        to: "/estimer/compte",
        search: { afterAuth: "calcul" } as never,
      });
    }
  }

  return (
    <EstimationStepperLayout
      step={4}
      eyebrow={
        <>
          <Star className="mr-1 inline h-3 w-3 fill-terra text-terra" strokeWidth={1.5} />
          Étape clé · facultative
        </>
      }
      title={
        <>
          Aide-nous à mieux estimer{" "}
          <span className="not-italic font-sans font-semibold">ton bien.</span>
        </>
      }
      description={
        <>
          Cette étape est facultative — mais c&rsquo;est elle qui fait la
          différence entre une bonne estimation et une{" "}
          <b className="font-semibold text-ink-2">estimation précise</b>. Tu
          peux la sauter, on continuera avec nos données automatiques.
        </>
      }
      backTo="/estimer/photos"
      ctaSlot={
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleSkip}
            className="text-[13.5px] text-muted-ink underline underline-offset-[3px] decoration-line-2 hover:text-ink hover:decoration-muted-ink"
          >
            Continuer sans lien
            <span className="ml-1 text-[12px] text-mute-2">
              — l&rsquo;estimation sera moins précise
            </span>
          </button>
          <span className="flex-1" />
          <Button
            type="button"
            variant="terra"
            size="lg"
            onClick={handleContinue}
            disabled={state.user_provided_urls.length === 0}
          >
            Continuer avec ces liens
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </div>
      }
    >
      {/* Schéma "Nous vs Toi" */}
      <NousVsToi />

      {/* Input */}
      <div className="mt-10">
        <LiensComparablesInput
          urls={state.user_provided_urls}
          onChange={(urls) => patch("user_provided_urls", urls)}
        />
      </div>

      {/* Pedago bandeau violet */}
      <div className="mt-6 flex items-start gap-3 rounded-r-lg border border-violet/20 bg-violet-soft px-4 py-3.5 text-[12.5px] leading-[1.5] text-ink-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-r-xs bg-violet text-white">
          <Lightbulb className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <div>
          <b className="font-semibold text-violet-deep">
            Conseil pour des résultats optimaux :
          </b>{" "}
          une recherche avec un cadre géographique resserré (1 km), la même
          typologie et une surface ±20 % donne le meilleur signal. Tu peux te
          baser sur les recherches que tu fais déjà quand tu veilles ton
          marché.
        </div>
      </div>

      {/* Footnote estimation */}
      <p className="mt-6 text-center font-mono text-[11.5px] text-mute-2">
        Le calcul prendra ~25 à 40 s après cette étape.
      </p>

      {/* Bandeau de fond — l'écran a besoin d'air, on garde le footer
          du layout neutre. Le pédago est suffisant. */}
      <UnusedLink />
    </EstimationStepperLayout>
  );
}

function NousVsToi() {
  // Pattern décoratif — grid de dots terra pour "Toi", grid grise + qq
  // dots terra pour "Nous".
  return (
    <section className="grid grid-cols-1 items-stretch gap-5 rounded-r-xl border border-line bg-card p-7 sm:grid-cols-[1fr_auto_1fr]">
      {/* Nous */}
      <div>
        <DotGrid total={110} highlighted={18} tone="muted" />
        <Eyebrow className="mt-3">Ce que nous voyons</Eyebrow>
        <div className="mt-1 font-mono text-[28px] font-semibold tnum text-ink-2 tracking-[-0.02em]">
          661 annonces
        </div>
        <p className="mt-1 text-[13px] leading-snug text-muted-ink">
          Tout ce qui s&rsquo;est vendu et tout ce qui se vend dans ton
          secteur depuis cinq ans.
        </p>
      </div>

      {/* Flèche */}
      <div className="hidden items-center justify-center sm:flex">
        <ArrowRight className="h-10 w-10 text-terra" strokeWidth={1.5} />
      </div>

      {/* Toi */}
      <div className="rounded-r-lg border border-terra/20 bg-gradient-to-b from-terra/[0.08] to-terra/[0.02] p-5">
        <DotGrid total={44} highlighted={20} tone="terra" />
        <Eyebrow variant="terra" className="mt-3">
          Ce que toi tu connais
        </Eyebrow>
        <div className="mt-1 font-mono text-[28px] font-semibold tnum text-terra-deep tracking-[-0.02em]">
          ~10 vraiment comparables
        </div>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">
          Mêmes étage, exposition, état, micro-quartier — la connaissance
          qu&rsquo;aucun algo n&rsquo;a.
        </p>
      </div>
    </section>
  );
}

function DotGrid({
  total,
  highlighted,
  tone,
}: {
  total: number;
  highlighted: number;
  tone: "terra" | "muted";
}) {
  // Génère un pattern déterministe (pas Math.random au render) — on
  // sélectionne `highlighted` indices répartis modulo total/highlighted.
  const cols = tone === "terra" ? 22 : 22;
  const onSet = React.useMemo(() => {
    const set = new Set<number>();
    const step = Math.max(1, Math.floor(total / Math.max(1, highlighted)));
    for (let i = 0; i < total && set.size < highlighted; i += step) {
      set.add(i + (tone === "terra" ? 0 : 3));
    }
    return set;
  }, [total, highlighted, tone]);

  return (
    <div
      className="mb-3 grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      aria-hidden
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            onSet.has(i)
              ? tone === "terra"
                ? "aspect-square rounded-[1px] bg-terra"
                : "aspect-square rounded-[1px] bg-mute-2"
              : "aspect-square rounded-[1px] bg-bg-3"
          }
        />
      ))}
    </div>
  );
}

function UnusedLink() {
  // Garde l'import Link/Sparkles vivants — utiles aux extensions de la
  // page si on ajoute des liens type "voir un exemple de bonne recherche".
  void Link;
  void Sparkles;
  return null;
}

export const Route = createFileRoute("/estimer/liens-comparables")({
  component: StepLiensComparablesPage,
});
