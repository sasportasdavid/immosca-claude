// Tunnel · Étape 3 — Photos
//
// Drag & drop zone (input file natif), preview grid 3 colonnes avec X,
// compteur N/10, info-bulle pédagogique.
//
// Upload Supabase Storage (bucket `bien-photos`, privé, TTL signed URL 1h).
// Path : `{auth.uid()}/{ts}-{n}.{ext}` si user loggé, `draft-{uuid}/...`
// sinon. Les URLs stockées dans `state.photos_urls` sont des URLs signées
// que le worker Claude Vision peut fetch directement.
//
// Avant cette PR le code utilisait URL.createObjectURL() qui crée des
// `blob:https://...` côté browser uniquement — Claude Vision recevait
// des 404 silencieux. Corrigé.

import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { EstimationStepperLayout } from "@/components/value/EstimationStepperLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEstimerState } from "@/hooks/use-estimer-state";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 10;
const MIN_PHOTOS = 3;
const BUCKET = "bien-photos";
const SIGNED_URL_TTL_SECONDS = 3600; // 1h, ample pour que le worker fetch

/**
 * Récupère ou crée l'identifiant de session draft pour les uploads
 * anonymes. Persiste dans sessionStorage pour qu'un rafraîchissement
 * de page ne crée pas un nouveau dossier.
 */
function getOrCreateDraftId(): string {
  const key = "immovalue.estimer.draftId";
  if (typeof window === "undefined") return `draft-${crypto.randomUUID()}`;
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = `draft-${crypto.randomUUID()}`;
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

function StepPhotosPage() {
  const { state, patch } = useEstimerState();
  const { session } = useAuth();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);

    const userScope = session?.user?.id ?? getOrCreateDraftId();
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));

    try {
      // Upload séquentiel pour éviter de saturer Supabase Storage
      // (latence < 500ms par photo, ordre déterministe pour preview).
      const uploaded: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        if (!file) continue;
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${userScope}/${Date.now()}-${i}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
        if (uploadErr) {
          // eslint-disable-next-line no-console
          console.error("[photos] upload failed", path, uploadErr);
          throw uploadErr;
        }

        // URL signée publique-pendant-TTL → le worker Claude Vision la fetch
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (signErr || !signed) {
          // eslint-disable-next-line no-console
          console.error("[photos] sign failed", path, signErr);
          throw signErr ?? new Error("sign_url_failed");
        }
        uploaded.push(signed.signedUrl);
      }

      const merged = [...state.photos_urls, ...uploaded].slice(0, MAX_PHOTOS);
      patch("photos_urls", merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(
        `Upload échoué : ${msg}. Réessaye, ou continue sans photos (estimation moins précise).`,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(signedUrl: string) {
    // Extrait le path depuis l'URL signée pour delete côté Storage.
    // Format URL signée Supabase :
    //   {origin}/storage/v1/object/sign/{bucket}/{path}?token=...
    try {
      const u = new URL(signedUrl);
      const marker = `/object/sign/${BUCKET}/`;
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        const path = u.pathname.slice(idx + marker.length);
        await supabase.storage.from(BUCKET).remove([path]);
      }
    } catch {
      // best-effort — si la delete échoue (URL inattendue, perms),
      // on retire quand même de la liste locale, le cron de nettoyage
      // 24h s'occupera des orphelins draft-*.
    }
    patch(
      "photos_urls",
      state.photos_urls.filter((u) => u !== signedUrl),
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
        disabled={uploading}
        className={cn(
          "block w-full cursor-pointer rounded-r-xl border-2 border-dashed border-line-2 bg-card px-8 py-14 text-center transition-all",
          "hover:border-terra hover:bg-terra-soft",
          uploading && "cursor-wait opacity-70",
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
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              Upload en cours…
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
              Parcourir mes fichiers
            </>
          )}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </button>

      {uploadError && (
        <p className="mt-3 rounded-r border border-bad/30 bg-bad-soft px-4 py-2 text-[12.5px] text-bad-deep">
          {uploadError}
        </p>
      )}

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
