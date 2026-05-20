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
import { useEstimerState } from "@/hooks/use-estimer-state";
import { requireAuth } from "@/lib/auth-guards";
import { postEstimer } from "@/lib/value-api";
import { cn } from "@/lib/utils";

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

const STEPS: StreamStep[] = [
  {
    key: "geo",
    label: (
      <>
        On situe ton bien à <b className="text-ink">Gagny</b>
      </>
    ),
    icon: <MapPinned className="h-4 w-4" strokeWidth={2} />,
    startAt: 200,
    duration: 1500,
  },
  {
    key: "scan",
    label: (
      <>
        On scanne ton quartier · <b className="text-ink">23 transactions</b>
      </>
    ),
    icon: <Search className="h-4 w-4" strokeWidth={2} />,
    startAt: 1700,
    duration: 1800,
  },
  {
    key: "photos",
    label: (
      <>
        Analyse de tes <b className="text-ink">photos</b>
      </>
    ),
    icon: <Camera className="h-4 w-4" strokeWidth={2} />,
    startAt: 3500,
    duration: 2000,
  },
  {
    key: "comparables",
    label: (
      <>
        Lecture de tes recherches{" "}
        <b className="text-ink">SeLoger / Leboncoin</b>
      </>
    ),
    icon: <Building2 className="h-4 w-4" strokeWidth={2} />,
    startAt: 5500,
    duration: 1700,
  },
  {
    key: "risks",
    label: <>Risques environnementaux & nuisances</>,
    icon: <TriangleAlert className="h-4 w-4" strokeWidth={2} />,
    startAt: 7200,
    duration: 1100,
  },
  {
    key: "transports",
    label: <>Transports, écoles, services</>,
    icon: <Train className="h-4 w-4" strokeWidth={2} />,
    startAt: 8300,
    duration: 900,
  },
  {
    key: "these",
    label: (
      <>
        Rédaction de la <b className="text-ink">thèse</b>
      </>
    ),
    icon: <FileText className="h-4 w-4" strokeWidth={2} />,
    startAt: 9200,
    duration: 1100,
  },
];

const TOTAL_DURATION = 10500;

function StepCalculPage() {
  const navigate = useNavigate();
  const { state, patch } = useEstimerState();
  const [now, setNow] = React.useState(0);
  const startRef = React.useRef<number>(Date.now());

  // Ticker visuel (60 fps n'est pas nécessaire, 4 fps suffit pour
  // animer la liste).
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now() - startRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // Appel API réel — en parallèle de la simulation visuelle. En V1, si
  // le worker n'est pas branché, on ignore l'erreur et on continue.
  React.useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const res = await postEstimer({
          address: state.address || "Adresse à confirmer",
          bien_data: {
            type:
              state.bien_data.type === "maison" ? "maison" : "appartement",
            surface: state.bien_data.surface_carrez,
            pieces: state.bien_data.pieces,
            chambres: state.bien_data.chambres,
            etage: state.bien_data.etage ?? undefined,
            annee_construction: Number(state.bien_data.annee_construction) || undefined,
            dpe: state.bien_data.dpe ?? undefined,
          },
          photos_urls: state.photos_urls,
          user_provided_urls: state.user_provided_urls,
        });
        if (!mounted) return;
        patch("bien_id", res.bien_id);
      } catch {
        // Worker pas encore branché — V1 : on continue avec un id mocké.
        if (!mounted) return;
        patch("bien_id", "mock-bien-id");
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  // Quand la simulation est terminée, on redirige.
  React.useEffect(() => {
    if (now >= TOTAL_DURATION) {
      void navigate({
        to: "/estimer/resultat",
        search: { id: state.bien_id ?? "mock-bien-id" },
      });
    }
  }, [now]);

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

        {/* Liste d'étapes */}
        <ol className="mt-10 space-y-3">
          {STEPS.map((s) => {
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
