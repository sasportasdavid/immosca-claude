import type { ValueBien, ValueBienStats } from "@immoscan/db";
import { Heart, Lock, ChevronRight } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { ScoreBadge } from "@web/components/ui/score-badge";
import { TheseBlock } from "@web/components/ui/these-block";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@web/components/ui/tooltip";

import { FavorisProfileBreakdown } from "./FavorisProfileBreakdown";

// DiscretStatsDashboard — tab "Stats" du dashboard bien quand le bien
// est en mode discret. Calque exact du handoff `Immovalue - Stats
// discret.html` (écran 11), réécrit en React + Tailwind tokens-only.
//
// Données : stats peut être null (worker `value-compute-stats` pas encore
// exécuté) — dans ce cas on fallback sur des valeurs mock V1.
//
// Mode "Design" : composant présentationnel. Le CTA paywall remonte via
// `onOpenPaywall` au container parent.

export interface DiscretStatsDashboardProps {
  bien: ValueBien;
  stats: ValueBienStats | null;
  /** Nombre de jours écoulés depuis le passage en mode discret. */
  daysDiscret: number;
  onOpenPaywall: () => void;
  onRepasserPrive?: () => void;
  onOpenParams?: () => void;
}

// Mock V1 (cf brief §"Données mockées V1"). Quand `stats` est null on
// utilise ces valeurs. Si stats arrive, on utilise les vraies (avec fallback
// mock sur les champs non encore peuplés).
const MOCK = {
  vues_7j: 147,
  vues_uniques: 89,
  retours: 23,
  trend_vues_pct: 34,
  trend_visiteurs_pct: 22,
  trend_retours_pct: 8,
  favoris_actifs: 18,
  favoris_delta_7j: 6,
  pct_investisseurs: 65,
  pct_primo: 22,
  pct_secundo: 13,
  score_moyen: 78,
  budget_range: "295 – 330 k€",
  rendement_range: "6,1 – 7,2 %",
  ton_rendement: "6,3 %",
} as const;

export function DiscretStatsDashboard({
  bien,
  stats,
  daysDiscret,
  onOpenPaywall,
  onRepasserPrive,
  onOpenParams,
}: DiscretStatsDashboardProps) {
  const vues = stats?.vues_7j ?? MOCK.vues_7j;
  const visiteurs = stats?.vues_uniques ?? MOCK.vues_uniques;
  const retours = stats?.retours_visiteurs ?? MOCK.retours;
  const trendVues =
    stats?.trend_vues_7j_vs_30j_pct != null
      ? Math.round(stats.trend_vues_7j_vs_30j_pct)
      : MOCK.trend_vues_pct;
  const favoris = stats?.favoris_actifs ?? MOCK.favoris_actifs;
  const favorisDelta = stats?.trend_favoris_7j ?? MOCK.favoris_delta_7j;
  const pctInv = stats?.pct_vues_investisseurs ?? MOCK.pct_investisseurs;
  const pctPrimo = stats?.pct_vues_primo ?? MOCK.pct_primo;
  const pctSecundo = stats?.pct_vues_secundo ?? MOCK.pct_secundo;
  const scoreMoyen = stats?.score_moyen_acheteurs ?? MOCK.score_moyen;

  const prixAffiche = bien.prix_affiche ?? 319_000;

  return (
    <div className="space-y-9">
      {/* Bandeau discret */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-r-lg border border-terra-soft-2 bg-terra-soft px-5 py-3.5 text-terra-deep">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-r bg-terra-soft-2">
          <Lock className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <p className="text-[13.5px] leading-snug">
          <b className="font-semibold">
            Mode discret · {daysDiscret} jour{daysDiscret > 1 ? "s" : ""}
          </b>{" "}
          · Ton bien est dans la vitrine acheteurs sans son adresse ni tes
          coordonnées. Personne ne peut te contacter.
        </p>
        <div className="ml-auto flex items-center gap-2 text-[12px]">
          <button
            type="button"
            onClick={onOpenParams}
            className="rounded-r-sm border border-terra/35 px-2.5 py-1 font-medium text-terra-deep transition-colors hover:bg-terra-soft-2"
          >
            Paramètres
          </button>
          <button
            type="button"
            onClick={onRepasserPrive}
            className="rounded-r-sm border border-terra/35 bg-terra/10 px-2.5 py-1 font-medium text-terra-deep transition-colors hover:bg-terra-soft-2"
          >
            Repasser en privé
          </button>
        </div>
      </div>

      {/* Section 1 — Audience */}
      <section>
        <div className="mb-4 flex items-baseline gap-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
            Audience{" "}
            <span className="font-serif text-[18px] font-normal italic text-terra">
              cette semaine
            </span>
          </h2>
          <span className="text-[13px] text-muted-ink">
            Les chiffres se mettent à jour à 5h chaque matin.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_2fr]">
          <StatCard
            label="Vues"
            value={vues}
            sub="vs semaine précédente"
            trendPct={trendVues}
          />
          <StatCard
            label="Visiteurs uniques"
            value={visiteurs}
            sub="profils différents"
            trendPct={MOCK.trend_visiteurs_pct}
          />
          <StatCard
            label="Retours"
            value={retours}
            sub={
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-violet">
                      Acheteurs qui reviennent
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px]">
                    Les mêmes acheteurs reviennent voir ton bien plusieurs fois —
                    signal d&rsquo;intérêt sérieux.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            }
            trendPct={MOCK.trend_retours_pct}
          />
          <Vues30jChart />
        </div>
      </section>

      {/* Section 2+3 — Favoris + Profil breakdown */}
      <section>
        <div className="mb-4 flex items-baseline gap-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
            Qui s&rsquo;intéresse à{" "}
            <span className="font-serif text-[18px] font-normal italic text-terra">
              ton bien
            </span>
          </h2>
          <span className="text-[13px] text-muted-ink">
            Profils anonymisés · agrégés pour empêcher toute identification.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FavorisCard favoris={favoris} delta={favorisDelta} />
          <FavorisProfileBreakdown
            pctInvestisseurs={pctInv}
            pctPrimo={pctPrimo}
            pctSecundo={pctSecundo}
            totalFavoris={favoris}
          />
        </div>
      </section>

      {/* Section 4 — Sweet spot */}
      <section>
        <div className="mb-4 flex items-baseline gap-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
            Le profil moyen des{" "}
            <span className="font-serif text-[18px] font-normal italic text-terra">
              acheteurs intéressés
            </span>
          </h2>
          <span className="text-[13px] text-muted-ink">
            Agrégat des {favoris} favoris.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SweetCard
            label="Budget moyen"
            value={MOCK.budget_range}
            valueSize="range"
            ctx={
              <>
                Ton prix affiché à{" "}
                <b className="font-semibold text-ink-2">
                  {prixAffiche.toLocaleString("fr-FR")}&nbsp;€
                </b>{" "}
                entre dans cette fourchette.
              </>
            }
            gaugeColor="terra"
            gaugePct={78}
          />
          <SweetCard
            label="Rendement locatif cible"
            value={MOCK.rendement_range}
            valueSize="range"
            ctx={
              <>
                Ton bien offre{" "}
                <b className="font-mono font-semibold text-ink-2 tnum">
                  {MOCK.ton_rendement}
                </b>{" "}
                brut — dans leur zone.
              </>
            }
            gaugeColor="violet"
            gaugePct={62}
          />
          <SweetCard
            label="Score ImmoScan moyen donné à ton bien"
            value={<ScoreBadge value={scoreMoyen} size="lg" />}
            ctx="Très bon — top 25 % des biens du secteur scorés."
            gaugeColor="sage"
            gaugePct={scoreMoyen}
          />
        </div>
      </section>

      {/* Section 5 — Insight IA */}
      <TheseBlock attribution="Claude" title="L'analyse">
        <p>
          Sur les{" "}
          <b>{favoris} acheteurs qui ont mis ton bien en favoris</b>,{" "}
          {Math.round((pctInv / 100) * favoris)} sont des investisseurs locatifs
          avec un budget moyen de {MOCK.budget_range} et un objectif de
          rendement entre {MOCK.rendement_range.replace(/\s/g, " ")}. À ton prix
          affiché de {prixAffiche.toLocaleString("fr-FR")}&nbsp;€, ils
          obtiennent {MOCK.ton_rendement} brut — exactement dans leur zone
          d&rsquo;achat.
        </p>
        <p>
          Le pattern de consultation est fort :{" "}
          <b>
            {retours} retours sur {visiteurs} visiteurs uniques
          </b>{" "}
          ({Math.round((retours / Math.max(visiteurs, 1)) * 100)}&nbsp;%),
          c&rsquo;est-à-dire que les gens reviennent voir ton annonce.
          C&rsquo;est le signal d&rsquo;intérêt le plus fiable qu&rsquo;on
          puisse mesurer en discret.
        </p>
        <p>
          Si tu publies en vente publique maintenant, tu as{" "}
          <b>
            ~5 à 8 acheteurs sérieusement intéressés déjà identifiés
          </b>{" "}
          — ils seront notifiés instantanément.
        </p>
      </TheseBlock>

      {/* Section 6 — CTA */}
      <section>
        <div className="relative overflow-hidden rounded-r-xl bg-ink p-7 text-white">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-20 h-[320px] w-[320px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(217,119,87,0.40), transparent)",
            }}
          />
          <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto]">
            <div>
              <Eyebrow className="text-white/60">Prochaine étape recommandée</Eyebrow>
              <h3 className="mt-2 max-w-[28ch] font-serif text-[26px] font-normal italic leading-[1.15] tracking-[-0.016em] text-white [text-wrap:balance]">
                Passe en vente publique — tes {favoris} favoris seront notifiés
                instantanément.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/70">
                Adresse révélée, contact direct par formulaire masqué,
                visibilité Google +{" "}
                <b className="font-semibold text-white">
                  200+ investisseurs actifs ImmoScan
                </b>{" "}
                sur Gagny. Pas de reconduction, pas d&rsquo;abonnement.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2.5">
              <Button
                variant="terra"
                size="lg"
                onClick={onOpenPaywall}
                className="h-12 px-6"
              >
                Publier en vente publique
                <span className="rounded-r-xs bg-white/20 px-2 py-0.5 font-mono text-[12px] font-semibold">
                  49&nbsp;€
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={onOpenParams}
                className="text-[12px] text-white/55 transition-colors hover:text-white"
              >
                Plus tard · modifier les paramètres
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components (locaux à ce fichier) ──────────────────────────────

function StatCard({
  label,
  value,
  sub,
  trendPct,
}: {
  label: string;
  value: number;
  sub: React.ReactNode;
  trendPct?: number;
}) {
  const trendTone =
    trendPct == null
      ? "flat"
      : trendPct > 0
        ? "up"
        : trendPct < 0
          ? "down"
          : "flat";
  return (
    <div className="rounded-r-lg border border-line bg-card p-5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute-2">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="font-mono text-[36px] font-semibold leading-none tracking-[-0.02em] text-ink tnum">
          {value.toLocaleString("fr-FR")}
        </span>
        {trendPct != null && (
          <span
            className={
              "rounded-full px-2 py-0.5 text-[12px] font-semibold " +
              (trendTone === "up"
                ? "bg-sage-soft text-sage-2"
                : trendTone === "down"
                  ? "bg-terra-soft text-terra-deep"
                  : "bg-bg-2 text-mute-2")
            }
          >
            {trendPct > 0 ? "+" : ""}
            {trendPct}&nbsp;%
          </span>
        )}
      </div>
      <div className="mt-2 text-[12.5px] text-muted-ink">{sub}</div>
    </div>
  );
}

function Vues30jChart() {
  // Mini courbe SVG vues sur 30 jours — placeholder fidèle au handoff
  // (sparkline aire + ligne terra, IRIS median en pointillé).
  return (
    <div className="flex flex-col rounded-r-lg border border-line bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute-2">
          Vues · 30 derniers jours
        </span>
        <span className="ml-auto flex gap-3 text-[11px] text-mute-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-terra" />
            Vues quotidiennes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-line-2" />
            Médiane IRIS
          </span>
        </span>
      </div>
      <svg
        viewBox="0 0 600 110"
        preserveAspectRatio="none"
        className="mt-2 h-[110px] w-full"
        role="img"
        aria-label="Évolution des vues sur 30 jours"
      >
        <g stroke="var(--line)" strokeWidth={1}>
          <line x1={0} y1={20} x2={600} y2={20} />
          <line x1={0} y1={55} x2={600} y2={55} />
          <line x1={0} y1={90} x2={600} y2={90} />
        </g>
        <line
          x1={0}
          y1={68}
          x2={600}
          y2={68}
          stroke="var(--line-2)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <polygon
          fill="rgba(217,119,87,0.12)"
          points="0,86 20,82 40,78 60,84 80,70 100,72 120,65 140,68 160,62 180,55 200,58 220,50 240,45 260,52 280,48 300,42 320,40 340,38 360,42 380,35 400,32 420,28 440,33 460,30 480,25 500,28 520,22 540,18 560,22 580,15 600,12 600,110 0,110"
        />
        <polyline
          fill="none"
          stroke="var(--terra)"
          strokeWidth={2}
          points="0,86 20,82 40,78 60,84 80,70 100,72 120,65 140,68 160,62 180,55 200,58 220,50 240,45 260,52 280,48 300,42 320,40 340,38 360,42 380,35 400,32 420,28 440,33 460,30 480,25 500,28 520,22 540,18 560,22 580,15 600,12"
        />
        <circle cx={600} cy={12} r={3.5} fill="white" stroke="var(--terra)" strokeWidth={2} />
      </svg>
    </div>
  );
}

function FavorisCard({ favoris, delta }: { favoris: number; delta: number }) {
  // Calcule un pourcentage progress fictif basé sur le rythme. V1.
  const progressPct = Math.min(100, Math.round((favoris / 24) * 100));
  return (
    <div className="rounded-r-lg border border-line bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-r bg-terra-soft text-terra-deep">
          <Heart className="h-4.5 w-4.5" fill="currentColor" />
        </span>
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute-2">
            Favoris actifs{" "}
            <span className="ml-1 font-mono text-sage-2">
              +{delta} cette semaine
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex items-baseline gap-3">
        <span className="font-mono text-[48px] font-semibold leading-none tracking-[-0.022em] text-ink tnum">
          {favoris}
        </span>
        <span className="text-[14px] font-medium text-muted-ink">
          personnes ont mis ton bien en favoris
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-2">
        <div
          className="h-full rounded-full bg-terra-grad"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11.5px] text-mute-2 tnum">
        <span>Rythme : {(delta / 7).toFixed(1)} / jour</span>
        <span>Médiane IRIS T3 : 0,6 / jour</span>
      </div>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-violet hover:underline"
      >
        Voir les profils anonymisés
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function SweetCard({
  label,
  value,
  valueSize,
  ctx,
  gaugeColor,
  gaugePct,
}: {
  label: string;
  value: React.ReactNode;
  valueSize?: "range" | "default";
  ctx: React.ReactNode;
  gaugeColor: "violet" | "terra" | "sage";
  gaugePct: number;
}) {
  const fillCls =
    gaugeColor === "violet"
      ? "bg-violet"
      : gaugeColor === "terra"
        ? "bg-terra"
        : "bg-sage";

  return (
    <div className="rounded-r-lg border border-line bg-card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute-2">
        {label}
      </div>
      <div
        className={
          "mt-2 font-mono font-semibold tracking-[-0.01em] text-ink " +
          (valueSize === "range" ? "text-[18px]" : "text-[22px]")
        }
      >
        {value}
      </div>
      <div className="mt-1 text-[11.5px] text-muted-ink">{ctx}</div>
      <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-bg-2">
        <div
          className={"h-full rounded-full " + fillCls}
          style={{ width: `${gaugePct}%` }}
        />
      </div>
    </div>
  );
}
