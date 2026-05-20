// ValorisationCard — bloc hero du Résultat.
// Fourchette de valorisation min / max + central, indice de confiance,
// pills meta (IRIS, surface, DPE) et une mini-façade illustrative.

import { Info, MapPin } from "lucide-react";
import * as React from "react";

import { ConfBadge } from "@web/components/ui/conf-badge";
import { DpePill, type DpeLetter } from "@web/components/ui/dpe-pill";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export interface ValorisationCardProps {
  /** Fourchette basse (€). */
  min: number;
  /** Fourchette haute (€). */
  max: number;
  /** Valeur centrale (€). */
  central: number;
  /** Surface Carrez en m² — pour calculer le €/m². */
  surface: number;
  /** Médian secteur €/m² (pour comparaison). */
  medianSecteurM2?: number;
  /** Confidence 0..1. */
  confidence: number;
  /** Date de calcul (string déjà formatée). */
  computedAtLabel?: string;
  /** Localisation textuelle (ex. "Le Chénay · IRIS 930320206"). */
  localisation: string;
  /** Description courte typologie (ex. "T3 · 62 m² Carrez · 3e étage"). */
  typologie: string;
  /** Lettre DPE éventuelle. */
  dpe?: DpeLetter | null;
  /** Lettre GES éventuelle. */
  ges?: DpeLetter | null;
  /** Phrase d'explication de l'indice de confiance. */
  confidenceReason?: React.ReactNode;
}

const fmtEur = (n: number) =>
  // Espace insécable fine entre milliers + € avec espace insécable.
  `${n
    .toLocaleString("fr-FR")
    .replace(/ /g, " ")
    .replace(/ /g, " ")} €`;

const fmtEurM2 = (n: number) =>
  `${n
    .toLocaleString("fr-FR")
    .replace(/ /g, " ")
    .replace(/ /g, " ")} €/m²`;

export function ValorisationCard({
  min,
  max,
  central,
  surface,
  medianSecteurM2,
  confidence,
  computedAtLabel,
  localisation,
  typologie,
  dpe,
  ges,
  confidenceReason,
}: ValorisationCardProps) {
  const m2 = surface > 0 ? Math.round(central / surface) : 0;
  return (
    <section
      className={cn(
        "relative mt-8 grid grid-cols-1 gap-10 overflow-hidden rounded-r-2xl border border-line bg-card p-8 shadow-lvl-2 md:grid-cols-[1.25fr_1fr] md:gap-14 md:p-11",
      )}
    >
      {/* Halo terra décoratif. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-24 h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(217,119,87,0.16),transparent)] blur-3xl"
      />

      {/* Colonne gauche — fourchette. */}
      <div className="relative">
        <Eyebrow variant="terra">Fourchette de valorisation</Eyebrow>

        <div
          className={cn(
            "mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2",
            "font-serif text-[clamp(2.75rem,5.4vw,4.5rem)] font-normal italic",
            "leading-[0.98] tracking-[-0.028em] text-ink",
          )}
        >
          <span>
            <span className="mr-2 align-baseline text-[0.32em] font-sans not-italic uppercase tracking-[0.05em] font-medium text-mute-2">
              de
            </span>
            <span className="font-mono tnum not-italic font-semibold text-ink">
              {fmtEur(min)}
            </span>
          </span>
          <span className="text-[0.6em] italic text-terra">à</span>
          <span className="font-mono tnum not-italic font-semibold text-ink">
            {fmtEur(max)}
          </span>
        </div>

        {/* Centrale + €/m² */}
        <div className="mt-6 flex flex-wrap items-baseline gap-6 border-t border-dashed border-line-2 pt-5">
          <div>
            <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-mute-2">
              Centrale
            </span>
            <span className="ml-2 font-mono text-[22px] font-semibold tnum text-ink">
              {fmtEur(central)}
            </span>
          </div>
          <div className="text-[13px] text-muted-ink">
            Soit{" "}
            <b className="font-mono font-semibold tnum text-ink-2">
              {fmtEurM2(m2)}
            </b>
            {medianSecteurM2 && (
              <>
                {" "}· médian secteur{" "}
                <b className="font-mono font-semibold tnum text-ink-2">
                  {fmtEurM2(medianSecteurM2)}
                </b>
              </>
            )}
          </div>
        </div>

        {/* Pills meta. */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Pill icon={<MapPin className="h-3 w-3" strokeWidth={2} />}>
            {localisation}
          </Pill>
          <Pill icon={<HomeIcon />}>{typologie}</Pill>
          {(dpe || ges) && (
            <Pill icon={<DpePill letter={dpe ?? null} className="h-[18px] w-[18px]" />}>
              DPE {dpe ?? "—"}
              {ges && (
                <>
                  {" "}· GES {ges}
                </>
              )}
            </Pill>
          )}
        </div>

        {computedAtLabel && (
          <p className="mt-5 text-[12.5px] text-mute-2">{computedAtLabel}</p>
        )}
      </div>

      {/* Colonne droite — confiance + façade placeholder. */}
      <div className="relative z-10 flex flex-col gap-3.5">
        <ConfidenceCard
          confidence={confidence}
          reason={confidenceReason}
        />
        <FacadeStrip />
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-2.5 py-1.5 text-[12px] text-ink-2">
      <span className="text-mute-2">{icon}</span>
      {children}
    </span>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-3 w-3"
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function ConfidenceCard({
  confidence,
  reason,
}: {
  confidence: number;
  reason?: React.ReactNode;
}) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.8 ? "high" : confidence >= 0.6 ? "mid" : "low";
  const pctColor =
    tone === "high"
      ? "text-sage-2"
      : tone === "mid"
      ? "text-terra-2"
      : "text-mute-2";
  const fillColor =
    tone === "high"
      ? "bg-sage"
      : tone === "mid"
      ? "bg-terra"
      : "bg-mute-2";

  return (
    <div className="rounded-r-lg border border-line bg-bg p-4.5">
      <div className="flex items-center gap-2.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-mute-2">
        Indice de confiance
        <Info className="h-3 w-3 text-faint" strokeWidth={2} />
      </div>
      <div className={cn("mt-2 flex items-baseline gap-2 font-mono text-[34px] font-semibold tnum tracking-tight", pctColor)}>
        {pct}
        <span className={cn("font-sans text-[12px] font-medium lowercase", pctColor)}>
          / 100
        </span>
        <ConfBadge confidence={confidence} className="ml-auto" />
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-line">
        <span
          className={cn("h-full", fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {reason && (
        <div className="mt-3 border-t border-line pt-3 text-[12.5px] leading-[1.55] text-muted-ink">
          {reason}
        </div>
      )}
    </div>
  );
}

function FacadeStrip() {
  // Illustration placeholder façade — reproduit fidèlement la maquette.
  return (
    <div className="relative h-[120px] overflow-hidden rounded-r-lg border border-line bg-photo-bg">
      <svg
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="ivvc-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#EFE9E4" />
            <stop offset="1" stopColor="#E5DDD5" />
          </linearGradient>
        </defs>
        <rect width="320" height="120" fill="url(#ivvc-sky)" />
        <g fill="#C9BFB5" stroke="#A8998A" strokeWidth="1">
          <rect x="20" y="42" width="46" height="68" />
          <rect x="74" y="30" width="56" height="80" />
          <rect x="138" y="20" width="68" height="90" />
          <rect x="214" y="36" width="50" height="74" />
          <rect x="272" y="48" width="40" height="62" />
        </g>
        <rect
          x="138"
          y="20"
          width="68"
          height="90"
          fill="none"
          stroke="#D97757"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <g fill="#A8998A">
          {[32, 52, 72].map((y) =>
            [148, 166, 184].map((x) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="10" height="12" />
            )),
          )}
        </g>
        <line x1="138" y1="20" x2="206" y2="20" stroke="#7A6A5C" strokeWidth="2" />
      </svg>
      <span className="absolute bottom-2.5 left-3 rounded-r-xs bg-white/85 px-2 py-0.5 font-mono text-[10px] tracking-wide text-ink-2">
        Ton bien
      </span>
    </div>
  );
}
