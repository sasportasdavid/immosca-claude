// Tunnel · Étape 1 — Adresse
//
// Input adresse plein largeur, autocomplete BAN mock (suggestions
// hard-codées V1), carte placeholder en SVG, CTA Continuer → /estimer/description.
// Le bouton "Comment ça marche ?" ouvre un Sheet pédagogique.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  HelpCircle,
  MapPin,
  Search,
  X,
} from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@web/components/ui/sheet";
import { EstimationStepperLayout } from "@/components/value/EstimationStepperLayout";
import { useEstimerState } from "@/hooks/use-estimer-state";
import { cn } from "@/lib/utils";

// Suggestions BAN mockées V1 — quand l'utilisateur tape, on filtre
// par includes. Pas de vrai appel à api-adresse.data.gouv.fr ici.
const MOCK_SUGGESTIONS = [
  { label: "12 rue de la Gare, 93220 Gagny", confidence: 99, iris: "Le Chénay" },
  { label: "12 rue de la Gare, 75001 Paris", confidence: 92, iris: "Halles" },
  {
    label: "12 rue de la Garenne, 92250 La Garenne-Colombes",
    confidence: 78,
    iris: "Centre",
  },
] as const;

function StepAdressePage() {
  const navigate = useNavigate();
  const { state, patch } = useEstimerState();
  const [address, setAddress] = React.useState(state.address);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const trimmed = address.trim();
  const selected = trimmed.length >= 3;

  const filtered = React.useMemo(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return MOCK_SUGGESTIONS.filter((s) => s.label.toLowerCase().includes(q));
  }, [trimmed]);

  function handleContinue() {
    if (!selected) return;
    patch("address", trimmed);
    void navigate({ to: "/estimer/description" });
  }

  return (
    <EstimationStepperLayout
      step={1}
      eyebrow="Étape 1 · Adresse"
      title={
        <>
          Où se situe{" "}
          <span className="not-italic font-sans font-semibold">ton bien</span> ?
        </>
      }
      description={
        <>
          On part de ton adresse pour récupérer automatiquement le DPE
          ADEME, l&rsquo;IRIS INSEE, les transports et les comparables
          DVF — tout ce dont on a besoin pour estimer.
        </>
      }
      backTo="/"
      ctaSlot={
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <HelpSheet />
          <span className="flex-1" />
          <Button
            type="button"
            variant="terra"
            size="lg"
            disabled={!selected}
            onClick={handleContinue}
          >
            Continuer
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </div>
      }
    >
      {/* Input + suggestions */}
      <div className="relative">
        <MapPin
          aria-hidden
          className="absolute left-5 top-[18px] h-[18px] w-[18px] text-mute-2"
          strokeWidth={2}
        />
        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Délai pour permettre le click sur une suggestion.
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder="Numéro, rue, ville, code postal"
          autoComplete="off"
          className={cn(
            "h-[60px] w-full rounded-r-lg border border-line-2 bg-card pl-13 pr-12 text-[16px] text-ink shadow-lvl-1",
            "focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra",
          )}
          style={{ paddingLeft: 52 }}
        />
        {trimmed.length > 0 && (
          <button
            type="button"
            aria-label="Effacer"
            onClick={() => setAddress("")}
            className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-bg-2 text-mute-2 hover:text-ink"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}

        {showSuggestions && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-r-lg border border-line bg-card p-1.5 shadow-lvl-2">
            {filtered.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // onMouseDown pour devancer le onBlur.
                    e.preventDefault();
                    setAddress(s.label);
                    setShowSuggestions(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-r-sm px-3 py-2.5 text-left text-[13.5px] text-ink-2 hover:bg-bg-2",
                    i === 0 && "bg-terra-soft text-terra-deep",
                  )}
                >
                  <MapPin
                    aria-hidden
                    className={cn(
                      "h-3.5 w-3.5",
                      i === 0 ? "text-terra" : "text-mute-2",
                    )}
                    strokeWidth={2}
                  />
                  <span className="flex-1">{s.label}</span>
                  <span
                    className={cn(
                      "rounded-r-xs px-1.5 py-0.5 font-mono text-[10px]",
                      i === 0
                        ? "bg-terra/20 text-terra-deep"
                        : "bg-bg-2 text-mute-2",
                    )}
                  >
                    BAN · {s.confidence}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmation card. Affichée quand une adresse "résolue" est
          sélectionnée — V1 : on l'affiche dès qu'il y a 3+ caractères
          pour ne pas mentir sur un appel BAN qu'on ne fait pas. */}
      {selected && (
        <div className="mt-5 grid grid-cols-[36px_1fr_auto] items-center gap-3.5 rounded-r-lg border border-line bg-card px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-r bg-sage-soft text-[#2F5340]">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-[14px] font-medium text-ink">
              {address || "Adresse à confirmer"}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px] text-mute-2">
              <span className="rounded-r-xs bg-bg-2 px-1.5 py-0.5">
                INSEE 93032
              </span>
              <span className="rounded-r-xs bg-bg-2 px-1.5 py-0.5">
                IRIS 930320206
              </span>
              <span className="rounded-r-xs bg-bg-2 px-1.5 py-0.5">
                Le Chénay
              </span>
            </div>
          </div>
          <span className="text-[12.5px] text-violet">Métadonnées indicatives</span>
        </div>
      )}

      {/* Map preview placeholder */}
      <div className="relative mt-6 h-[360px] overflow-hidden rounded-r-lg border border-line bg-gradient-to-br from-[#E7EBE5] to-[#DCE4DA]">
        <svg
          viewBox="0 0 800 380"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <g stroke="rgba(255,255,255,0.55)" strokeWidth="1" fill="none">
            <line x1="0" y1="60" x2="800" y2="40" />
            <line x1="0" y1="120" x2="800" y2="100" />
            <line x1="0" y1="200" x2="800" y2="180" />
            <line x1="0" y1="280" x2="800" y2="260" />
            <line x1="0" y1="360" x2="800" y2="340" />
            <line x1="100" y1="0" x2="80" y2="380" />
            <line x1="220" y1="0" x2="200" y2="380" />
            <line x1="340" y1="0" x2="320" y2="380" />
            <line x1="460" y1="0" x2="440" y2="380" />
            <line x1="580" y1="0" x2="560" y2="380" />
            <line x1="700" y1="0" x2="680" y2="380" />
          </g>
          <g fill="rgba(255,255,255,0.45)">
            <rect x="120" y="50" width="80" height="50" />
            <rect x="240" y="50" width="80" height="50" />
            <rect x="360" y="50" width="80" height="50" />
            <rect x="480" y="50" width="80" height="50" />
            <rect x="120" y="130" width="80" height="60" />
            <rect x="240" y="130" width="80" height="60" />
            <rect x="360" y="130" width="80" height="60" />
            <rect x="480" y="130" width="80" height="60" />
            <rect x="600" y="130" width="80" height="60" />
          </g>
          <path
            d="M 0 230 Q 400 200 800 240"
            stroke="rgba(91,71,224,0.5)"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="6 3"
          />
          <text
            x="40"
            y="222"
            fontFamily="JetBrains Mono"
            fontSize="11"
            fill="#5B47E0"
          >
            RER E · Gagny
          </text>
        </svg>

        {/* Pin centré, draggable visuellement (pas réellement V1). */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full"
          aria-hidden
        >
          <svg viewBox="0 0 36 44" width="36" height="44" fill="none">
            <path
              d="M18 0c-9.94 0-18 8.06-18 18 0 13 18 26 18 26s18-13 18-26C36 8.06 27.94 0 18 0z"
              fill="#D97757"
            />
            <circle cx="18" cy="18" r="6.5" fill="white" />
          </svg>
        </div>

        <span className="absolute right-3 top-3 rounded-r-xs border border-line bg-white/95 px-3 py-1.5 text-[11px] text-mute-2">
          Pin <b className="font-mono text-ink">déplaçable</b> pour ajuster
        </span>

        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-r-xs border border-line bg-white/95 px-3 py-2 text-[12px]">
          <span className="h-1.5 w-1.5 rounded-full bg-terra" />
          {trimmed || "Adresse à saisir"}
        </div>
      </div>
    </EstimationStepperLayout>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sheet pédagogique — "Comment ça marche ?"
// ──────────────────────────────────────────────────────────────────

function HelpSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] text-violet no-underline"
        >
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
          Comment ça marche ?
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Comment on estime ton bien</SheetTitle>
          <SheetDescription>
            Quatre étapes courtes, puis un rapport argumenté à
            partager.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <HelpStep
            num="01"
            title="Adresse"
            desc="On géolocalise au mètre près pour récupérer le DPE ADEME, l'IRIS INSEE et le marché local."
            icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
          />
          <HelpStep
            num="02"
            title="Description"
            desc="Type, surface, état, exposition, étage. Plus tu es précis, plus la fourchette se resserre."
            icon={<Search className="h-4 w-4" strokeWidth={2} />}
          />
          <HelpStep
            num="03"
            title="Photos"
            desc="Notre IA analyse l'état réel et identifie les plus-values cachées (parquet, hauteur sous plafond, lumière)."
            icon={<Check className="h-4 w-4" strokeWidth={2} />}
          />
          <HelpStep
            num="04"
            title="Tes comparables"
            desc="Tu fournis 1 à 3 recherches SeLoger ou Leboncoin. On les pondère plus fort que nos comparables automatiques."
            icon={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function HelpStep({
  num,
  title,
  desc,
  icon,
}: {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-r bg-terra-soft text-terra-deep"
      >
        {icon}
      </span>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-mute-2">
            {num}
          </span>
          <h4 className="text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h4>
        </div>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-ink">
          {desc}
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/estimer/")({
  component: StepAdressePage,
});
