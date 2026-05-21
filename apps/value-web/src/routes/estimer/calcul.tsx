// Tunnel · Étape 6 — Calcul streaming
//
// Animation centrale (radar pulsant) + liste verticale d'étapes qui se
// révèlent. V1 : pur setTimeout pour simulation, pas de vrai SSE/Realtime.
// Le worker arrive en PR ultérieure — quand il sera prêt, on remplacera
// cette logique par un subscribe Supabase Realtime sur value.biens.
//
// Mention "13 sources de données publiques" + pas de progress bar %
// (faux et anxiogène, cf brief).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Camera,
  Check,
  FileText,
  Loader2,
  MapPinned,
  Radar,
  Search,
  Sparkles,
  Train,
  TriangleAlert,
} from "lucide-react";
import * as React from "react";

import { Wordmark } from "@/components/value/EstimationStepperLayout";
import {
  useEstimerState,
  type EstimerState,
} from "@/hooks/use-estimer-state";
import { requireAuth } from "@/lib/auth-guards";
import {
  postEstimer,
  type EstimerEtatGeneral,
  type EstimerExposition,
  type EstimerPayload,
  type EstimerTypologie,
} from "@/lib/value-api";
import { cn } from "@/lib/utils";

// Mapping état frontend → payload Edge Function value-estimer.
// La validation Zod côté serveur est stricte → tout mismatch enum
// provoque un 400 "validation_failed".

const TYPOLOGIE_MAP: Record<NonNullable<EstimerState["bien_data"]["type"]>, EstimerTypologie> = {
  T1: "T1", T2: "T2", T3: "T3", T4: "T4",
  "T5+": "T6+", // serveur n'a pas "T5+" — on remonte sur T6+
  maison: "Maison",
};

const EXPOSITION_MAP: Record<NonNullable<EstimerState["bien_data"]["exposition"]>, EstimerExposition> = {
  N: "Nord", S: "Sud", E: "Est", O: "Ouest",
  NE: "Nord-Est", NO: "Nord-Ouest",
  SE: "Sud-Est", SO: "Sud-Ouest",
};

const ETAT_MAP: Record<NonNullable<EstimerState["bien_data"]["etat"]>, EstimerEtatGeneral> = {
  a_renover: "lourds_travaux",
  travaux_moyens: "travaux",
  bon_etat: "bon_etat",
  refait: "refait_a_neuf",
  haut_de_gamme: "neuf",
};

function buildEstimerPayload(state: EstimerState): EstimerPayload {
  const t = state.bien_data.type;
  const typologie: EstimerTypologie = t ? TYPOLOGIE_MAP[t] : "T3";

  const annee = Number(state.bien_data.annee_construction);
  const expo = state.bien_data.exposition;
  const etat = state.bien_data.etat;
  const dpe = state.bien_data.dpe ?? undefined;

  return {
    address: state.address || "Adresse à confirmer",
    bien_data: {
      typologie,
      surface_carrez: state.bien_data.surface_carrez,
      pieces: state.bien_data.pieces,
      chambres: state.bien_data.chambres,
      etage: state.bien_data.etage ?? undefined,
      etage_total: state.bien_data.etage_total ?? undefined,
      ascenseur: state.bien_data.ascenseur,
      exposition: expo ? EXPOSITION_MAP[expo] : undefined,
      balcon: state.bien_data.balcon,
      terrasse: state.bien_data.terrasse,
      jardin: state.bien_data.jardin,
      cave: state.bien_data.cave,
      parking: state.bien_data.parking,
      etat_general: etat ? ETAT_MAP[etat] : undefined,
      dpe,
      annee_construction:
        Number.isFinite(annee) && annee >= 1700 && annee <= 2100 ? annee : undefined,
      particularites: state.bien_data.particularites || undefined,
    },
    photos_urls: state.photos_urls,
    user_provided_urls: state.user_provided_urls,
  };
}

type StepStatus = "todo" | "running" | "done";

interface StreamStep {
  key: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  /** Délai en ms avant que cette étape devienne "running". */
  startAt: number;
  /** Durée en ms avant que cette étape passe à "done". */
  duration: number;
}

/**
 * Construit la liste d'étapes à partir des inputs utilisateur. Les labels
 * sont entièrement dérivés de `state` (ville, nombre de photos, nombre de
 * liens comparables, type de bien) — JAMAIS de valeur en dur.
 *
 * Les étapes qui n'ont rien à traiter (0 photos, 0 liens) sont retirées
 * pour ne pas mentir à l'utilisateur. Le timing relatif (startAt/duration)
 * est recalculé en cascade pour rester cohérent.
 */
function buildSteps(state: EstimerState): StreamStep[] {
  const ville =
    state.ville?.trim() ||
    state.address?.split(",")[0]?.trim() ||
    "ton bien";
  const isMaison = state.bien_data.type === "maison";
  const typeLabel = isMaison ? "ta maison" : `ton ${state.bien_data.type ?? "appartement"}`;
  const surface = state.bien_data.surface_carrez;
  const nbPhotos = state.photos_urls.length;
  const nbLiens = state.user_provided_urls.length;

  // Timings cibles par étape (ms). On accumule en cascade pour calculer
  // les startAt/duration sans recalcul manuel.
  const timings: Array<{ key: string; duration: number; node: StreamStep }> = [];

  let cursor = 200;
  const pushStep = (
    key: string,
    label: React.ReactNode,
    icon: React.ReactNode,
    duration: number,
  ) => {
    timings.push({
      key,
      duration,
      node: { key, label, icon, startAt: cursor, duration },
    });
    cursor += duration + 200; // gap entre étapes
  };

  pushStep(
    "geo",
    <>
      On situe <b className="text-ink">{typeLabel}</b> à{" "}
      <b className="text-ink">{ville}</b>
    </>,
    <MapPinned className="h-4 w-4" strokeWidth={2} />,
    1500,
  );

  pushStep(
    "scan",
    <>
      On scanne le quartier · <b className="text-ink">DVF, IRIS, OLL</b>
    </>,
    <Search className="h-4 w-4" strokeWidth={2} />,
    1800,
  );

  if (nbPhotos > 0) {
    pushStep(
      "photos",
      <>
        Analyse de tes{" "}
        <b className="text-ink">
          {nbPhotos} photo{nbPhotos > 1 ? "s" : ""}
        </b>
      </>,
      <Camera className="h-4 w-4" strokeWidth={2} />,
      2000,
    );
  }

  if (nbLiens > 0) {
    pushStep(
      "comparables",
      <>
        Lecture de tes{" "}
        <b className="text-ink">
          {nbLiens} lien{nbLiens > 1 ? "s" : ""} comparable{nbLiens > 1 ? "s" : ""}
        </b>
      </>,
      <Building2 className="h-4 w-4" strokeWidth={2} />,
      1700,
    );
  }

  pushStep(
    "risks",
    <>Risques environnementaux & nuisances</>,
    <TriangleAlert className="h-4 w-4" strokeWidth={2} />,
    1100,
  );

  pushStep(
    "transports",
    <>Transports, écoles, services</>,
    <Train className="h-4 w-4" strokeWidth={2} />,
    900,
  );

  pushStep(
    "these",
    <>
      Rédaction de la <b className="text-ink">thèse</b> ·{" "}
      <b className="text-ink">
        {surface > 0 ? `${surface} m²` : ""}
      </b>
    </>,
    <FileText className="h-4 w-4" strokeWidth={2} />,
    1100,
  );

  return timings.map((t) => t.node);
}

function StepCalculPage() {
  const navigate = useNavigate();
  const { state, patch } = useEstimerState();
  const [now, setNow] = React.useState(0);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const startRef = React.useRef<number>(Date.now());

  // Étapes recalculées à chaque rendu (memo sur state). Les labels sont
  // dérivés des inputs utilisateur (ville, photos, liens) — pas de
  // valeur hardcodée.
  const steps = React.useMemo(() => buildSteps(state), [state]);
  const totalDuration = React.useMemo(
    () => steps.reduce((max, s) => Math.max(max, s.startAt + s.duration), 0),
    [steps],
  );

  // Ticker visuel (60 fps n'est pas nécessaire, 4 fps suffit pour
  // animer la liste).
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now() - startRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // Appel API réel — en parallèle de la simulation visuelle.
  // En cas d'erreur on stocke le message pour l'afficher à l'utilisateur
  // au lieu de tomber silencieusement sur du mock.
  React.useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const payload = buildEstimerPayload(state);
        const res = await postEstimer(payload);
        if (!mounted) return;
        patch("bien_id", res.bien_id);
        setApiError(null);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error("[value-estimer] échec:", err);
        setApiError(msg);
        // On NE met PLUS "mock-bien-id" — on laisse bien_id null pour
        // que l'écran resultat affiche l'erreur au lieu du mock.
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  // Quand la simulation est terminée, on redirige — uniquement si on a
  // un vrai bien_id (l'API a réussi). Si erreur, on reste sur la page
  // et on affiche le détail de l'erreur (cf bloc apiError plus bas).
  React.useEffect(() => {
    if (totalDuration > 0 && now >= totalDuration && state.bien_id) {
      void navigate({
        to: "/estimer/resultat",
        search: { id: state.bien_id },
      });
    }
  }, [now, totalDuration, state.bien_id]);

  return (
    <main
      className={cn(
        "min-h-screen bg-bg",
        "[background-image:radial-gradient(900px_600px_at_50%_0%,rgba(217,119,87,0.10),transparent_60%)]",
      )}
    >
      <header className="border-b border-line/60 bg-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-6 sm:px-8">
          <Wordmark />
          <span className="font-mono text-[11.5px] text-mute-2">
            Calcul en cours · ne ferme pas la page
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[640px] px-6 pb-24 pt-20 sm:px-8">
        {/* Banner d'erreur si l'Edge Function value-estimer a échoué */}
        {apiError && (
          <div className="mb-8 rounded-r-lg border border-bad/30 bg-bad-soft px-5 py-4 text-[13.5px] leading-[1.55] text-ink-2">
            <div className="font-semibold text-bad-deep">
              Échec du calcul d'estimation
            </div>
            <p className="mt-1 text-muted-ink">
              L'API <code className="font-mono text-[12.5px]">value-estimer</code>{" "}
              a renvoyé : <span className="font-mono text-[12.5px] text-ink-2">{apiError}</span>
            </p>
            <p className="mt-2 text-[12.5px] text-muted-ink">
              Reviens à l'étape précédente, vérifie les infos saisies et relance.
              Si le problème persiste, l'estimation ne pourra pas être faite —
              dis-le nous, on regarde côté serveur.
            </p>
          </div>
        )}

        {/* Radar animé */}
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center">
          <span className="absolute h-28 w-28 animate-ping rounded-full bg-terra/15" />
          <span className="absolute h-20 w-20 animate-ping rounded-full bg-terra/20 [animation-delay:300ms]" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-terra-grad text-white shadow-lvl-2">
            <Radar className="h-7 w-7" strokeWidth={1.75} />
          </span>
        </div>

        <h1 className="text-center font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] italic font-normal leading-[1.1] tracking-[-0.018em] text-ink [text-wrap:balance]">
          On instruit le dossier de{" "}
          <span className="not-italic font-sans font-semibold">ton bien.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[50ch] text-center text-[14px] text-muted-ink">
          Ce calcul prend une dizaine de secondes en moyenne. On scanne le
          quartier, on lit tes photos, on relit tes recherches comparables.
        </p>

        {/* Liste d'étapes — entièrement dérivée de state (user inputs) */}
        <ol className="mt-10 space-y-3">
          {steps.map((s) => {
            const status: StepStatus =
              now < s.startAt
                ? "todo"
                : now < s.startAt + s.duration
                ? "running"
                : "done";
            return (
              <StepRow key={s.key} step={s} status={status} />
            );
          })}
        </ol>

        <p className="mt-10 text-center text-[12.5px] text-mute-2">
          Cette analyse croise <b className="text-ink-2">13 sources</b> de données
          publiques.
        </p>
      </section>
    </main>
  );
}

function StepRow({ step, status }: { step: StreamStep; status: StepStatus }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3.5 rounded-r-lg border bg-card px-4 py-3 transition-colors",
        status === "done" && "border-line/70",
        status === "running" && "border-terra/30 bg-terra-soft/30",
        status === "todo" && "border-line/50 opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-r",
          status === "done" && "bg-sage-soft text-sage-2",
          status === "running" && "bg-terra-soft text-terra-deep",
          status === "todo" && "bg-bg-2 text-mute-2",
        )}
      >
        {status === "done" ? (
          <Check className="h-4 w-4" strokeWidth={2.5} />
        ) : status === "running" ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          step.icon
        )}
      </span>
      <span
        className={cn(
          "text-[14px] leading-tight",
          status === "todo" ? "text-mute-2" : "text-ink-2",
        )}
      >
        {step.label}
      </span>
      {status === "running" && (
        <Sparkles
          aria-hidden
          className="ml-auto h-3.5 w-3.5 text-terra"
          strokeWidth={2}
        />
      )}
    </li>
  );
}

export const Route = createFileRoute("/estimer/calcul")({
  component: StepCalculPage,
  // Auth requise pour créer un bien : on linke le bien_id retourné par
  // l'edge fn `value-estimer` au user_id courant. Si pas auth, retour
  // sur /estimer/compte (qui reprendra le tunnel après signup).
  beforeLoad: () =>
    requireAuth({
      from: "/estimer/calcul",
      loginPath: "/estimer/compte?afterAuth=calcul",
    }),
});
