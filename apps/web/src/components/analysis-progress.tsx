// AnalysisProgress — timeline 4 étapes pour suivre une analyse en cours.
//
// Repaint DA : pourcentage XXL central en mono violet, timeline en grille
// horizontale avec cercles d'étape (done = sage, active = violet pulse,
// pending = ligne neutre), bandeau "live data" en bas. Substitut au
// "status + barre" minimaliste qui faisait croire à l'utilisateur que
// l'analyse était bloquée. Chaque étape a :
// - un nom court + une description longue ("On regarde les ventes DVF
//   passées dans le quartier…")
// - un état (à venir / en cours / fait)
// - une animation pulse sur l'étape en cours
//
// Présentationnel pur. Reçoit `status` + `progressPct` en props.

import { Check, Loader2, Sparkles, X } from "lucide-react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Button } from "@/components/ui/button";

export type AnalysisStatus =
  | "pending"
  | "scraping"
  | "enriching"
  | "scoring"
  | "generating"
  | "done"
  | "failed"
  | "canceled";

type Step = {
  key: AnalysisStatus;
  num: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    key: "scraping",
    num: "01",
    title: "Collecte",
    description:
      "On lit ta recherche et on récupère les 100 à 500 annonces actives. C'est l'étape la plus longue (~3-5 minutes).",
  },
  {
    key: "enriching",
    num: "02",
    title: "Croisement",
    description:
      "Adresse précise via DPE ADEME + reverse-BAN, puis DVF Notaires, Géorisques pour inondation, argile, sismicité.",
  },
  {
    key: "scoring",
    num: "03",
    title: "Notation",
    description:
      "Score sur 100 par bien selon ton apport, ton taux et ton TMI. On calcule loyer estimé, rendement brut/net, cashflow.",
  },
  {
    key: "generating",
    num: "04",
    title: "Top 5 par Claude",
    description:
      "3 paragraphes par bien : plan financement, négociation, vigilance. Argumenté par Claude.",
  },
];

const STATUS_ORDER: AnalysisStatus[] = [
  "pending",
  "scraping",
  "enriching",
  "scoring",
  "generating",
  "done",
];

const STATUS_HEADLINE: Record<string, { eyebrow: string; serif: string }> = {
  pending: { eyebrow: "Étape 1 / 4 —", serif: "préparation." },
  scraping: { eyebrow: "Étape 1 / 4 —", serif: "collecte des annonces." },
  enriching: { eyebrow: "Étape 2 / 4 —", serif: "croisement avec le marché." },
  scoring: { eyebrow: "Étape 3 / 4 —", serif: "calcul des scores." },
  generating: {
    eyebrow: "Étape 4 / 4 —",
    serif: "rédaction des thèses Claude.",
  },
};

function getStepState(
  stepKey: AnalysisStatus,
  current: AnalysisStatus,
): "done" | "active" | "pending" | "failed" {
  if (current === "failed") {
    // Toutes les étapes après l'échec restent pending, on ne sait pas où
    // ça a cassé sans l'error_message — l'affichage failed est géré en
    // dehors du composant.
    return "pending";
  }
  const currentIdx = STATUS_ORDER.indexOf(current);
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  if (currentIdx > stepIdx) return "done";
  if (currentIdx === stepIdx) return "active";
  return "pending";
}

type Props = {
  status: AnalysisStatus;
  progressPct: number;
  totalListings?: number | null;
  /** Si fourni, affiche un bouton "Arrêter l'analyse" pendant les étapes
   *  en cours. Le parent gère la mutation Edge Function + invalidation. */
  onCancel?: () => void;
  isCanceling?: boolean;
};

export function AnalysisProgress({
  status,
  progressPct,
  totalListings,
  onCancel,
  isCanceling,
}: Props) {
  const isDone = status === "done";
  const isFailed = status === "failed";
  const isCanceled = status === "canceled";
  const isActive = !isDone && !isFailed && !isCanceled;
  const headline = STATUS_HEADLINE[status] ?? {
    eyebrow: "Analyse",
    serif: "en cours.",
  };

  return (
    <section className="space-y-6">
      {/* Hero : pourcentage XXL + headline serif + temps écoulé.
          Carte unique, gradient violet subtil au sommet (cf. maquette). */}
      <div className="overflow-hidden rounded-r-xl border border-line bg-card shadow-lvl-1">
        <div className="relative bg-gradient-to-b from-violet/[0.05] to-transparent border-b border-line">
          <div className="flex items-center gap-6 px-7 py-6">
            {/* Pourcentage XXL en mono violet, tnum pour alignement
                stable pendant l'animation du polling 3s. */}
            <div
              className={`font-mono tnum text-[64px] md:text-[72px] font-semibold leading-none tracking-[-0.04em] ${
                isFailed ? "text-bad" : isDone ? "text-sage-2" : "text-violet"
              }`}
            >
              {progressPct}
              <span className="text-[28px] text-mute-2">%</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold tracking-[-0.012em] text-ink">
                {isDone ? (
                  <>
                    Terminé —{" "}
                    <span className="font-serif italic font-normal text-sage-2">
                      tes biens t'attendent.
                    </span>
                  </>
                ) : isFailed ? (
                  <>
                    Analyse interrompue —{" "}
                    <span className="font-serif italic font-normal text-bad">
                      on n'a pas pu finir.
                    </span>
                  </>
                ) : isCanceled ? (
                  <>
                    Analyse annulée —{" "}
                    <span className="font-serif italic font-normal text-muted-ink">
                      arrêtée à ta demande.
                    </span>
                  </>
                ) : (
                  <>
                    {headline.eyebrow}{" "}
                    <span className="font-serif italic font-normal text-violet">
                      {headline.serif}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1.5 max-w-[56ch] text-[13px] leading-[1.5] text-muted-ink">
                {isDone
                  ? "Le score, le Top 5 thèses Claude et le tableau complet sont prêts en dessous."
                  : isFailed
                    ? "Le détail est juste en dessous. Tu peux relancer une nouvelle analyse depuis le dashboard."
                    : isCanceled
                      ? "Tu peux relancer une nouvelle analyse depuis le dashboard."
                      : "Tu peux laisser tourner — on garde tout côté serveur et on te prévient à la fin."}
              </p>
            </div>

            {isActive && onCancel ? (
              <div className="hidden md:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isCanceling}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  {isCanceling ? "Annulation…" : "Arrêter"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Timeline 4 étapes — grid horizontal avec rail connecteur.
            Active = cercle violet pulse, done = sage check, pending = neutre. */}
        <ol className="relative grid grid-cols-1 gap-6 px-7 py-7 md:grid-cols-4">
          {/* Rail neutre */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[calc(56px+1.75rem)] right-[calc(56px+1.75rem)] top-[calc(1.75rem+22px)] hidden h-[2px] bg-line md:block"
          />
          {/* Rail rempli — largeur proportionnelle au % (max 100% du rail) */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[calc(56px+1.75rem)] top-[calc(1.75rem+22px)] hidden h-[2px] bg-violet shadow-[0_0_6px_rgba(91,71,224,0.4)] transition-[width] duration-500 md:block"
            style={{
              width: `min(${Math.max(0, Math.min(100, progressPct))}%, calc(100% - 7rem - 112px))`,
            }}
          />
          {STEPS.map((step) => {
            const state = getStepState(step.key, status);
            return (
              <li
                key={step.key}
                className="relative flex flex-col items-start gap-3.5"
              >
                <StepCircle state={state} />
                <div className="space-y-1.5">
                  <div className="font-mono text-[11px] tracking-[0.06em] text-mute-2">
                    <span
                      className={
                        state === "active"
                          ? "font-semibold text-violet"
                          : state === "done"
                            ? "font-semibold text-sage-2"
                            : "font-semibold text-ink"
                      }
                    >
                      {step.num}
                    </span>{" "}
                    · {step.title}
                  </div>
                  <p
                    className={`text-[12.5px] leading-[1.45] max-w-[30ch] ${
                      state === "pending" ? "text-faint" : "text-muted-ink"
                    }`}
                  >
                    {step.description}
                  </p>
                  <StepStatusPill
                    state={state}
                    stepKey={step.key}
                    totalListings={totalListings}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Pied : rappel "on garde tout en arrière-plan" + bouton stop mobile */}
      {isActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-r-lg border border-line bg-bg-2 px-4 py-3">
          <p className="flex items-center gap-2 text-[12.5px] text-muted-ink">
            <Sparkles className="h-3.5 w-3.5 text-violet" />
            Tu peux fermer l'onglet et revenir plus tard — on garde tout côté
            serveur et on t'envoie une notif à la fin.
          </p>
          {onCancel ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCanceling}
              className="md:hidden"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              {isCanceling ? "Annulation…" : "Arrêter l'analyse"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Skeleton Top 5 — éveille l'attente du résultat. Affichage live
          via shimmer subtil (animate-pulse pour rester sobre). */}
      {isActive ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eyebrow>Ton Top 5 apparaîtra ici dès que le scoring sera fait</Eyebrow>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-r-lg border border-line bg-bg-2 p-4"
              >
                <div className="h-3 w-[70%] animate-pulse rounded bg-line-2/60" />
                <div className="mt-2 h-2.5 w-[40%] animate-pulse rounded bg-line-2/40" />
                <div className="mt-4 h-3.5 w-[30%] animate-pulse rounded bg-line-2/60" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StepCircle({
  state,
}: {
  state: "done" | "active" | "pending" | "failed";
}) {
  if (state === "done") {
    return (
      <span
        className="relative z-[1] flex h-11 w-11 items-center justify-center rounded-full border-2 border-sage-2 bg-sage-2 text-white"
        aria-label="Étape terminée"
      >
        <Check className="h-[18px] w-[18px]" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className="relative z-[1] flex h-11 w-11 items-center justify-center rounded-full border-2 border-violet bg-violet text-white shadow-[0_0_0_6px_rgba(91,71,224,0.12)]"
        aria-label="Étape en cours"
      >
        <Loader2 className="h-[18px] w-[18px] animate-spin" />
        <span
          aria-hidden
          className="absolute -inset-2 rounded-full border-2 border-violet opacity-40 animate-ping"
        />
      </span>
    );
  }
  return (
    <span
      className="relative z-[1] flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-card text-mute-2"
      aria-label="Étape à venir"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-faint" />
    </span>
  );
}

function StepStatusPill({
  state,
  stepKey,
  totalListings,
}: {
  state: "done" | "active" | "pending" | "failed";
  stepKey: AnalysisStatus;
  totalListings?: number | null;
}) {
  if (state === "done") {
    return (
      <span className="inline-flex items-center rounded-full border border-sage/25 bg-sage-soft px-2 py-[2px] font-mono text-[11px] font-medium text-sage-2">
        Fait
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/20 bg-violet-soft px-2 py-[2px] font-mono text-[11px] font-medium text-violet-deep">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet animate-pulse" />
        {stepKey === "scraping" && totalListings
          ? `En cours · ${totalListings} biens`
          : "En cours"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-bg-2 px-2 py-[2px] font-mono text-[11px] text-faint">
      En attente
    </span>
  );
}
