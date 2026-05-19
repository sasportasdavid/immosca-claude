// AnalysisProgress — timeline 4 étapes pour suivre une analyse en cours.
//
// Substitut au "status + % barre" minimaliste qui faisait croire à
// l'utilisateur que l'analyse était bloquée. Chaque étape a :
// - un nom court + une description longue ("On regarde les ventes DVF
//   passées dans le quartier…")
// - un état (à venir / en cours / fait)
// - une animation pulse sur l'étape en cours
//
// Présentationnel pur. Reçoit `status` + `progressPct` en props.

import { Check, Loader2, Sparkles, X } from "lucide-react";

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
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    key: "scraping",
    title: "Collecte des annonces",
    description:
      "On lit ta recherche et on récupère les 100 à 500 annonces actives. C'est l'étape la plus longue (~3-5 minutes).",
  },
  {
    key: "enriching",
    title: "Croisement avec le marché",
    description:
      "Pour chaque bien on regarde les ventes DVF récentes du quartier, le DPE, les risques Géorisques (PPRI, argile, sismicité).",
  },
  {
    key: "scoring",
    title: "Notation et calcul de rentabilité",
    description:
      "Score sur 100 par bien selon ton apport, ton taux et ton TMI. On calcule loyer estimé, rendement brut/net, cashflow mensuel.",
  },
  {
    key: "generating",
    title: "Analyses Claude pour le Top 5",
    description:
      "Claude rédige une thèse argumentée pour les 5 meilleurs biens : plan de financement chiffré, stratégie de négociation, leviers.",
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

  return (
    <div className="space-y-6">
      {/* Headline + barre fine */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="text-[14px] font-medium">
            {isDone ? (
              <span className="text-success-foreground">
                ✓ Analyse terminée
              </span>
            ) : isFailed ? (
              <span className="text-destructive-foreground">
                Analyse interrompue
              </span>
            ) : isCanceled ? (
              <span className="text-muted-foreground">
                Analyse annulée
              </span>
            ) : (
              <span>Analyse en cours…</span>
            )}
          </div>
          <span className="font-mono tabular-nums text-[12px] text-muted-foreground">
            {progressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all duration-700 ${isFailed ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <ol className="space-y-3">
        {STEPS.map((step) => {
          const state = getStepState(step.key, status);
          return (
            <li
              key={step.key}
              className={`flex gap-4 rounded-lg border border-border p-4 transition-colors ${
                state === "active"
                  ? "bg-primary-soft/30"
                  : state === "done"
                    ? "bg-secondary/40"
                    : "bg-card"
              }`}
            >
              <div className="flex-shrink-0 pt-0.5">
                <StepIcon state={state} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <div
                    className={`text-[14px] font-medium ${
                      state === "pending" ? "text-muted-foreground" : ""
                    }`}
                  >
                    {step.title}
                  </div>
                  {state === "active" ? (
                    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                      <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      En cours
                    </span>
                  ) : null}
                  {state === "done" ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-success-foreground">
                      Fait
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-1 text-[12.5px] leading-[1.55] ${
                    state === "pending"
                      ? "text-tertiary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.description}
                </p>
                {state === "active" && step.key === "scraping" && totalListings ? (
                  <p className="mt-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {totalListings} annonces récupérées jusqu'ici…
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {isActive ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-3">
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Cette page se rafraîchit toute seule. Tu peux fermer l'onglet et
            revenir plus tard — l'analyse continue côté serveur.
          </p>
          {onCancel ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isCanceling}
              className="flex-shrink-0"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              {isCanceling ? "Annulation…" : "Arrêter l'analyse"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepIcon({
  state,
}: {
  state: "done" | "active" | "pending" | "failed";
}) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-background">
      <span className="h-1.5 w-1.5 rounded-full bg-tertiary-foreground/40" />
    </span>
  );
}
