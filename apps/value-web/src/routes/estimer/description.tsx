// Tunnel · Étape 2 — Description
//
// Form long, sectionné en 6 blocs : type, surface/pièces, caractéristiques
// (étage, ascenseur, exposition, annexes), état, DPE, année + textarea.
// Sur mobile, chaque section reste affichée — pas d'accordion V1
// (l'utilisateur scroll). À ajuster si feedback ergo.

import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CircleDot,
  Home,
  ImageOff,
  Layers,
  Minus,
  Plus,
  Sparkles,
  Sun,
} from "lucide-react";
import * as React from "react";

import { DpePill, type DpeLetter } from "@web/components/ui/dpe-pill";
import { EstimationStepperLayout } from "@/components/value/EstimationStepperLayout";
import {
  type EstimerBienType,
  type EstimerEtatGeneral,
  type EstimerExposition,
  useEstimerState,
} from "@/hooks/use-estimer-state";
import { cn } from "@/lib/utils";

const BIEN_TYPES: { key: EstimerBienType; name: string; desc: string }[] = [
  { key: "T1", name: "T1", desc: "Studio" },
  { key: "T2", name: "T2", desc: "1 chambre" },
  { key: "T3", name: "T3", desc: "2 chambres" },
  { key: "T4", name: "T4", desc: "3 chambres" },
  { key: "T5+", name: "T5+", desc: "4+ chambres" },
  { key: "maison", name: "Maison", desc: "Individuelle" },
];

const ETATS: { key: EstimerEtatGeneral; name: string; desc: string }[] = [
  { key: "a_renover", name: "À rénover", desc: "Travaux importants" },
  { key: "travaux_moyens", name: "Travaux moyens", desc: "Rafraîchissement" },
  { key: "bon_etat", name: "Bon état", desc: "Vivable sans travaux" },
  { key: "refait", name: "Refait à neuf", desc: "Rénovation récente" },
  { key: "haut_de_gamme", name: "Haut de gamme", desc: "Prestations premium" },
];

const DPE_LETTERS: DpeLetter[] = ["A", "B", "C", "D", "E", "F", "G"];

const EXPOSITIONS: EstimerExposition[] = [
  "N", "NE", "E", "SE", "S", "SO", "O", "NO",
];

const EXPO_LABELS: Record<EstimerExposition, string> = {
  N: "Nord",
  NE: "Nord-Est",
  E: "Est",
  SE: "Sud-Est",
  S: "Sud",
  SO: "Sud-Ouest",
  O: "Ouest",
  NO: "Nord-Ouest",
};

function StepDescriptionPage() {
  const { state, patchBien } = useEstimerState();
  const bien = state.bien_data;

  const isAppartement = bien.type !== "maison";

  return (
    <EstimationStepperLayout
      step={2}
      eyebrow="Étape 2 · Ton bien"
      title={
        <>
          Parle-nous{" "}
          <span className="not-italic font-sans font-semibold">de ton bien.</span>
        </>
      }
      description="Plus tu es précis, plus l'estimation l'est. Tu pourras toujours modifier après."
      backTo="/estimer"
      continueLabel="Continuer"
      continueTo="/estimer/photos"
      maxWidth="wide"
    >
      {/* 1. Type */}
      <Section num="01" title="Type de bien">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BIEN_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => patchBien({ type: t.key })}
              className={cn(
                "rounded-r-lg border bg-bg px-2.5 py-3.5 text-center transition-colors",
                bien.type === t.key
                  ? "border-terra bg-terra-soft shadow-[0_0_0_3px_rgba(217,119,87,0.10)]"
                  : "border-line hover:border-line-2",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mb-1.5 inline-flex h-6 w-6 items-center justify-center",
                  bien.type === t.key ? "text-terra-deep" : "text-mute-2",
                )}
              >
                {t.key === "maison" ? (
                  <Home className="h-5 w-5" strokeWidth={1.8} />
                ) : (
                  <Building2 className="h-5 w-5" strokeWidth={1.8} />
                )}
              </span>
              <div className="text-[13px] font-semibold tracking-tight text-ink">
                {t.name}
              </div>
              <div
                className={cn(
                  "text-[10.5px]",
                  bien.type === t.key ? "text-terra-deep" : "text-mute-2",
                )}
              >
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* 2. Surface et pièces */}
      <Section num="02" title="Surface et pièces">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[2fr_1fr_1fr]">
          <SurfaceSlider
            value={bien.surface_carrez}
            onChange={(v) => patchBien({ surface_carrez: v })}
          />
          <NumberStepper
            label="Pièces principales"
            value={bien.pieces}
            min={1}
            max={20}
            onChange={(v) => patchBien({ pieces: v })}
          />
          <NumberStepper
            label="Chambres"
            value={bien.chambres}
            min={0}
            max={15}
            onChange={(v) => patchBien({ chambres: v })}
          />
        </div>
      </Section>

      {/* 3. Caractéristiques */}
      <Section
        num="03"
        title="Caractéristiques"
        optional={isAppartement ? "car ton bien est un appartement" : undefined}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            {isAppartement && (
              <>
                <div>
                  <label className="block text-[12px] font-medium text-mute-2">
                    Étage
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <NumberInline
                      value={bien.etage ?? 0}
                      onChange={(v) => patchBien({ etage: v })}
                    />
                    <span className="text-[13px] text-mute-2">sur</span>
                    <NumberInline
                      value={bien.etage_total ?? 0}
                      onChange={(v) => patchBien({ etage_total: v })}
                    />
                    <span className="text-[13px] text-mute-2">étages</span>
                  </div>
                </div>

                <ToggleRow
                  label="Ascenseur"
                  sub={
                    bien.ascenseur
                      ? "L'immeuble est équipé d'un ascenseur."
                      : "Tu n'as pas d'ascenseur dans l'immeuble."
                  }
                  on={bien.ascenseur}
                  onChange={(v) => patchBien({ ascenseur: v })}
                />
              </>
            )}

            <div>
              <label className="block text-[12px] font-medium text-mute-2">
                Annexes
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <ChipToggle
                  label="Balcon"
                  on={bien.balcon}
                  onChange={(v) => patchBien({ balcon: v })}
                />
                <ChipToggle
                  label="Terrasse"
                  on={bien.terrasse}
                  onChange={(v) => patchBien({ terrasse: v })}
                />
                <ChipToggle
                  label="Jardin"
                  on={bien.jardin}
                  onChange={(v) => patchBien({ jardin: v })}
                />
                <ChipToggle
                  label="Cave"
                  on={bien.cave}
                  onChange={(v) => patchBien({ cave: v })}
                />
                <ChipToggle
                  label="Parking"
                  on={bien.parking}
                  onChange={(v) => patchBien({ parking: v })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-mute-2">
              Exposition
            </label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {EXPOSITIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => patchBien({ exposition: dir })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-r border px-2 py-3 text-[12px] font-semibold transition-colors",
                    bien.exposition === dir
                      ? "border-terra bg-terra text-white shadow-[0_0_0_3px_rgba(217,119,87,0.16)]"
                      : "border-line bg-card text-ink-2 hover:border-terra/60",
                  )}
                >
                  {dir}
                </button>
              ))}
            </div>
            {bien.exposition && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-terra-deep">
                <Sun className="h-3 w-3" strokeWidth={2} />
                {EXPO_LABELS[bien.exposition]}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* 4. État */}
      <Section num="04" title="État général">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ETATS.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => patchBien({ etat: e.key })}
              className={cn(
                "overflow-hidden rounded-r-lg border bg-bg text-left transition-colors",
                bien.etat === e.key
                  ? "border-terra shadow-[0_0_0_3px_rgba(217,119,87,0.12)]"
                  : "border-line hover:border-line-2",
              )}
            >
              <div className="flex h-20 items-center justify-center bg-photo-bg text-mute-2">
                <ImageOff className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div className="px-3 py-2.5">
                <div
                  className={cn(
                    "text-[12.5px] font-semibold tracking-tight",
                    bien.etat === e.key ? "text-terra-deep" : "text-ink",
                  )}
                >
                  {e.name}
                </div>
                <div className="text-[10.5px] text-mute-2">{e.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* 5. DPE */}
      <Section num="05" title="DPE · Diagnostic énergétique">
        {bien.dpe_auto && bien.dpe && (
          <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3.5 rounded-r-lg border border-[rgba(124,152,133,0.30)] bg-sage-soft px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-r bg-sage text-white">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div>
              <div className="text-[13.5px] font-medium text-[#2F5340]">
                DPE trouvé automatiquement dans la base ADEME
              </div>
              <div className="mt-0.5 font-mono text-[11.5px] text-[#4B6753]">
                N° 2206020392 · audit 12 mars 2024 · diagnostiqueur ICC
              </div>
            </div>
            <button
              type="button"
              onClick={() => patchBien({ dpe_auto: false })}
              className="text-[12.5px] text-violet no-underline"
            >
              Corriger
            </button>
          </div>
        )}

        <div className="mt-5">
          <label className="block text-[12px] font-medium text-mute-2">
            {bien.dpe_auto
              ? "Pour corriger manuellement"
              : "Sélectionne la classe DPE"}
          </label>
          <div className="mt-2 flex gap-1">
            {DPE_LETTERS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => patchBien({ dpe: l, dpe_auto: false })}
                className={cn(
                  "flex-1 transition-transform",
                  bien.dpe === l && "scale-110 shadow-lvl-2 z-10",
                )}
                aria-label={`DPE ${l}`}
              >
                <span className="inline-flex h-12 w-full items-center justify-center font-mono text-[16px] font-bold">
                  <DpePill letter={l} className="h-12 w-full rounded-r-sm" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* 6. Année + particularités */}
      <Section
        num="06"
        title="Année et particularités"
        optional="optionnel mais utile"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            <label className="block text-[12px] font-medium text-mute-2">
              Année de construction
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={bien.annee_construction}
              onChange={(e) =>
                patchBien({ annee_construction: e.target.value.replace(/\D/g, "") })
              }
              className="mt-1.5 h-10 w-full rounded-r-sm border border-line bg-bg px-3 text-center font-mono text-[16px] font-semibold text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
              maxLength={4}
              placeholder="1972"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-mute-2">
              Particularités{" "}
              <span className="text-faint">
                (vue, parquet d&rsquo;origine, atelier…)
              </span>
            </label>
            <textarea
              value={bien.particularites}
              onChange={(e) => patchBien({ particularites: e.target.value })}
              placeholder="Tout ce que tu juges utile, en quelques mots."
              className="mt-1.5 min-h-[90px] w-full resize-y rounded-r-sm border border-line bg-bg p-3 text-[13.5px] leading-[1.5] text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
            />
          </div>
        </div>
      </Section>
    </EstimationStepperLayout>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers UI locaux
// ──────────────────────────────────────────────────────────────────

function Section({
  num,
  title,
  optional,
  children,
}: {
  num: string;
  title: string;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 rounded-r-xl border border-line bg-card p-7">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="rounded-full bg-bg-2 px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-mute-2">
          {num}
        </span>
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {optional && (
          <span className="text-[11.5px] italic text-mute-2">{optional}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function SurfaceSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const min = 10;
  const max = 500;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <label
        htmlFor="iv-surface"
        className="flex items-center text-[12px] font-medium text-mute-2"
      >
        Surface Carrez
        <span className="ml-auto font-mono text-[14px] font-semibold text-ink">
          {value} m²
        </span>
      </label>
      <input
        id="iv-surface"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-2 accent-terra"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${pct}%, var(--bg-2) ${pct}%, var(--bg-2) 100%)`,
        }}
      />
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-mute-2">
        <span>10 m²</span>
        <span>100</span>
        <span>200</span>
        <span>300</span>
        <span>500 m²</span>
      </div>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-mute-2">
        {label}
      </label>
      <div className="mt-1.5 inline-flex h-[38px] w-full items-center overflow-hidden rounded-r-sm border border-line bg-bg px-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-r-sm text-ink hover:bg-bg-2"
          aria-label="Diminuer"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="flex-1 bg-transparent text-center font-mono text-[14px] font-semibold text-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-r-sm text-ink hover:bg-bg-2"
          aria-label="Augmenter"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function NumberInline({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={0}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.max(0, n));
      }}
      className="h-10 w-14 rounded-r-sm border border-line bg-bg px-2 text-center font-mono text-[14px] font-semibold text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
    />
  );
}

function ToggleRow({
  label,
  sub,
  on,
  onChange,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-r-sm border border-line bg-bg px-3.5 py-2.5 text-left transition-colors hover:border-line-2"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-[18px] w-8 shrink-0 rounded-full transition-colors",
          on ? "bg-terra" : "bg-bg-3",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 inline-block h-[14px] w-[14px] rounded-full bg-white shadow-lvl-1 transition-transform",
            on ? "right-0.5" : "left-0.5",
          )}
        />
      </span>
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        {sub && <div className="mt-0.5 text-[11.5px] text-mute-2">{sub}</div>}
      </div>
    </button>
  );
}

function ChipToggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition-colors",
        on
          ? "border-terra bg-terra-soft text-terra-deep"
          : "border-line bg-bg text-ink-2 hover:border-line-2",
      )}
    >
      <CircleDot
        className={cn("h-3 w-3", on ? "text-terra" : "text-mute-2")}
        strokeWidth={2}
      />
      {label}
    </button>
  );
}

// Keep unused-but-handy import alive for symmetry with maquette.
void Link;
void Layers;

export const Route = createFileRoute("/estimer/description")({
  component: StepDescriptionPage,
});
