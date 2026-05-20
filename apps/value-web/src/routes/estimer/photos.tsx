// Tunnel · Étape 3 — Photos
//
// Drag & drop zone (input file natif), preview grid 3 colonnes avec X,
// compteur N/10, info-bulle pédagogique. V1 : les URLs créées par
// URL.createObjectURL() sont stockées en sessionStorage — pas d'upload
// réel. Cf brief : "photos plus présentes que dans ImmoScan, plus de
// blanc, moins de cards empilées".

import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Sparkles, Upload, X } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { EstimationStepperLayout } from "@/components/value/EstimationStepperLayout";
import { useEstimerState } from "@/hooks/use-estimer-state";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 10;
const MIN_PHOTOS = 3;

function StepPhotosPage() {
  const { state, patch } = useEstimerState();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      // V1 : URL.createObjectURL() — pas d'upload S3/Supabase Storage.
      // Limitation : ces URLs sont éphémères (réinitialisées au reload).
      .map((f) => URL.createObjectURL(f));
    const merged = [...state.photos_urls, ...urls].slice(0, MAX_PHOTOS);
    patch("photos_urls", merged);
  }

  function handleRemove(url: string) {
    patch(
      "photos_urls",
      state.photos_urls.filter((u) => u !== url),
    );
  }

  const count = state.photos_urls.length;
  const pct = (count / MAX_PHOTOS) * 100;

  return (
    <EstimationStepperLayout
      step={3}
      eyebrow="Étape 3 · Photos"
      title={
        <>
          Montre-nous{" "}
          <span className="not-italic font-sans font-semibold">ton bien.</span>
        </>
      }
      description={
        <>
          3 photos minimum, 10 maximum. Notre IA les analyse pour affiner
          l&rsquo;estimation : état réel, qualité des prestations,
          plus-values cachées (parquet ancien, hauteur sous plafond, lumière).
        </>
      }
      backTo="/estimer/description"
      continueLabel="Continuer"
      continueTo="/estimer/liens-comparables"
      maxWidth="wide"
    >
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "block w-full cursor-pointer rounded-r-xl border-2 border-dashed border-line-2 bg-card px-8 py-14 text-center transition-all",
          "hover:border-terra hover:bg-terra-soft",
        )}
      >
        <span className="mx-auto mb-3.5 inline-flex h-14 w-14 items-center justify-center rounded-r-lg bg-terra-soft text-terra-deep">
          <Upload className="h-5 w-5" strokeWidth={2} />
        </span>
        <h3 className="text-[18px] font-semibold tracking-tight text-ink">
          Glisse-dépose tes photos ici{" "}
          <span className="font-serif italic text-terra">
            — ou clique pour parcourir.
          </span>
        </h3>
        <p className="mt-2 text-[14px] text-muted-ink">
          JPG, PNG, HEIC · 25 Mo max par photo · compression automatique.
        </p>
        <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-r bg-ink px-4 text-[13px] font-medium text-white">
          <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
          Parcourir mes fichiers
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>

      {/* Compteur + progress */}
      <div className="mt-7 flex items-center gap-4">
        <span className="font-mono text-[14px] font-semibold text-ink">
          {count}{" "}
          <span className="font-normal text-mute-2">/ {MAX_PHOTOS} photos</span>
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg-2">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-terra-grad"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[12.5px] text-mute-2">
          {count < MIN_PHOTOS ? (
            <>
              <b className="text-ink">{MIN_PHOTOS} photos minimum</b> ·{" "}
              {MIN_PHOTOS - count} de plus pour valider
            </>
          ) : (
            <>
              <b className="text-ink">Minimum atteint</b> ·{" "}
              {MAX_PHOTOS - count} de plus possible
            </>
          )}
        </span>
      </div>

      {/* Grid preview */}
      {state.photos_urls.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.photos_urls.map((url, i) => (
            <div
              key={url}
              className="relative aspect-[4/3] overflow-hidden rounded-r-lg border border-line bg-photo-bg"
            >
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink/70 font-mono text-[10.5px] font-semibold text-white backdrop-blur-sm">
                {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Retirer photo ${i + 1}`}
                onClick={() => handleRemove(url)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-r-sm bg-ink/70 text-white backdrop-blur-sm hover:bg-ink/90"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
              {i === 0 && (
                <span className="absolute bottom-2 left-2.5 rounded-r-xs bg-terra px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-white">
                  Principale
                </span>
              )}
            </div>
          ))}

          {state.photos_urls.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-r-lg border-2 border-dashed border-line-2 bg-bg text-mute-2",
                "transition-colors hover:border-terra hover:bg-terra-soft hover:text-terra-deep",
              )}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-2">
                <ImagePlus className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="text-[12px] font-medium">Ajouter</span>
            </button>
          )}
        </div>
      )}

      {/* Info banner */}
      <div className="mt-7 flex items-start gap-3.5 rounded-r-lg border border-violet/20 bg-violet-soft px-5 py-4 text-[13.5px] leading-[1.55] text-ink-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-r bg-violet text-white">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div>
          <span className="block font-semibold text-ink">
            Pourquoi les photos comptent
          </span>
          Notre IA analyse l&rsquo;état réel, la qualité des prestations et
          identifie des plus-values cachées : parquet d&rsquo;origine,
          hauteur sous plafond, lumière naturelle, ouverture de la cuisine.
          Sur les biens refaits récemment, on observe en moyenne{" "}
          <b className="text-violet-deep">+5 à +8 % d&rsquo;ajustement</b> grâce
          aux photos.
        </div>
      </div>

      {/* Si moins du minimum, on bloque visuellement le CTA dans
          EstimationStepperLayout n'est pas possible direct — V1 on
          laisse l'utilisateur continuer même sans photos (worker tolère
          0 photo, scoring moins précis). */}
      {count > 0 && count < MIN_PHOTOS && (
        <p className="mt-5 text-center text-[12.5px] text-terra-deep">
          <Button
            asChild
            variant="link"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <button type="button">Ajouter au moins {MIN_PHOTOS} photos</button>
          </Button>{" "}
          pour une estimation plus précise.
        </p>
      )}
    </EstimationStepperLayout>
  );
}

export const Route = createFileRoute("/estimer/photos")({
  component: StepPhotosPage,
});
