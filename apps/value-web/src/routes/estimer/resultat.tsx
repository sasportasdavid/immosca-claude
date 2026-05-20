// Tunnel · Étape 7 — Résultat ⭐
//
// L'écran qui doit "faire dire ces gens sont sérieux". Sections :
// 1. Meta du bien
// 2. Valorisation (hero) — ValorisationCard
// 3. Thèse — TheseBlock
// 4. Ajustements — AdjustmentItem
// 5. Comparables (tabs + carte + liste)
// 6. Que faire maintenant — 3 cards next-steps
// 7. Téléchargement (placeholders)
//
// V1 : données hardcodées (Gagny T3 62m² 295-332k€ central 312k€ conf
// 0.84). Le worker n'est pas branché — donc même si on a un `?id=` en
// query, on affiche du mock cohérent avec le brief §10.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Eye,
  FileText,
  Layers,
  Megaphone,
  Pencil,
  Share2,
  Sparkles,
  Star,
  Volume2,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import * as React from "react";

import { AdjustmentItem } from "@web/components/ui/adjustment-item";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Eyebrow } from "@web/components/ui/eyebrow";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@web/components/ui/tabs";
import { TheseBlock } from "@web/components/ui/these-block";
import {
  ComparablesMap,
  type ComparableKind,
  type ComparablePin,
} from "@/components/value/ComparablesMap";
import { Wordmark } from "@/components/value/EstimationStepperLayout";
import { ValorisationCard } from "@/components/value/ValorisationCard";
import { useEstimerState } from "@/hooks/use-estimer-state";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────
// Données mock V1 (cf brief §10 — réference Gagny T3 62m²)
// ──────────────────────────────────────────────────────────────────

const MOCK_VALO = {
  min: 295_000,
  max: 332_000,
  central: 312_000,
  confidence: 0.84,
  surface: 62,
  medianSecteurM2: 4_680,
};

const MOCK_ADJUSTMENTS: Array<{
  tone: "pos" | "neg";
  icon: React.ReactNode;
  criterion: string;
  reason: string;
  sources: { label: string; user?: boolean }[];
  impactPct: string;
  impactEur: string;
}> = [
  {
    tone: "pos",
    icon: <Layers className="h-4 w-4" strokeWidth={2} />,
    criterion: "État refait à neuf",
    reason:
      "Tes photos montrent une rénovation récente complète : cuisine ouverte équipée, parquet propre, peintures fraîches.",
    sources: [
      { label: "Photos · Vision IA", user: true },
      { label: "DVF biens refaits" },
    ],
    impactPct: "+8,0 %",
    impactEur: "+24 000 €",
  },
  {
    tone: "pos",
    icon: <Clock className="h-4 w-4" strokeWidth={2} />,
    criterion: "Proximité RER E (Gagny)",
    reason:
      "8 minutes à pied de la gare, 27 minutes de Haussmann–Saint-Lazare. Ton secteur est sur-pondéré par rapport au médian Gagny.",
    sources: [{ label: "GTFS Île-de-France" }, { label: "DVF + OLL" }],
    impactPct: "+6,0 %",
    impactEur: "+18 000 €",
  },
  {
    tone: "pos",
    icon: <Compass className="h-4 w-4" strokeWidth={2} />,
    criterion: "Exposition Sud-Ouest",
    reason:
      "Lumineux toute la journée, balcon traversant exploitable. Apprécié dans le bassin acheteurs primo et investisseurs.",
    sources: [{ label: "Déclaratif", user: true }, { label: "Comparables actifs" }],
    impactPct: "+2,0 %",
    impactEur: "+6 000 €",
  },
  {
    tone: "pos",
    icon: <Zap className="h-4 w-4" strokeWidth={2} />,
    criterion: "DPE D (vs E secteur)",
    reason:
      "Ton DPE D te place au-dessus de la médiane du secteur (E). Avec l'audit énergétique obligatoire à la vente, c'est un argument de pricing solide.",
    sources: [
      { label: "ADEME · DPE 2206020392" },
      { label: "DPE secteur" },
    ],
    impactPct: "+3,0 %",
    impactEur: "+9 000 €",
  },
  {
    tone: "neg",
    icon: <Building2 className="h-4 w-4" strokeWidth={2} />,
    criterion: "3e étage sans ascenseur",
    reason:
      "Frein pour les acheteurs senior et primo-accédants familles. Compense partiellement la rénovation pour ce segment.",
    sources: [{ label: "Déclaratif", user: true }, { label: "Comparables actifs" }],
    impactPct: "−3,0 %",
    impactEur: "−9 000 €",
  },
  {
    tone: "neg",
    icon: <Volume2 className="h-4 w-4" strokeWidth={2} />,
    criterion: "Bruit RER (Lden 62 dB)",
    reason:
      "Niveau de bruit ambiant supérieur à la moyenne IRIS (58 dB). Mesurable surtout côté Est de l'immeuble. Ton balcon est côté Sud-Ouest, l'impact est limité.",
    sources: [{ label: "Bruitparif · Cerema" }],
    impactPct: "−2,0 %",
    impactEur: "−6 000 €",
  },
];

const MOCK_COMPARABLES = [
  {
    kind: "user" as const,
    title: "8 rue Anatole France",
    detail: "T3 · 64 m² · 3e",
    src: "Lien SeLoger · pondération haute · refait",
    price: "315 000 €",
    pricem2: "4 921 €/m²",
  },
  {
    kind: "user" as const,
    title: "14 av Jean Jaurès",
    detail: "T3 · 60 m² · 2e",
    src: "Lien SeLoger · pondération haute · bon état",
    price: "298 000 €",
    pricem2: "4 966 €/m²",
  },
  {
    kind: "user" as const,
    title: "3 rue de la Paix",
    detail: "T3 · 65 m² · 4e",
    src: "Lien Leboncoin · pondération haute · refait",
    price: "329 000 €",
    pricem2: "5 061 €/m²",
  },
  {
    kind: "dvf" as const,
    title: "22 rue Pasteur",
    detail: "T3 · 61 m² · 3e",
    src: "DVF · vente notariée · mars 2025",
    price: "285 000 €",
    pricem2: "4 672 €/m²",
  },
  {
    kind: "dvf" as const,
    title: "9 av Pierre Brossolette",
    detail: "T3 · 63 m² · 2e",
    src: "DVF · vente notariée · nov. 2024",
    price: "302 000 €",
    pricem2: "4 793 €/m²",
  },
  {
    kind: "actif" as const,
    title: "17 rue Henri Barbusse",
    detail: "T3 · 60 m² · 1er",
    src: "SeLoger · actif · 12 jours · 1 baisse",
    price: "309 000 €",
    pricem2: "5 150 €/m²",
  },
];

const MOCK_PINS: ComparablePin[] = [
  { kind: "self", x: 47, y: 48, title: "Ton bien" },
  { kind: "user", x: 38, y: 36 },
  { kind: "user", x: 56, y: 38 },
  { kind: "user", x: 52, y: 60 },
  { kind: "dvf", x: 30, y: 50 },
  { kind: "dvf", x: 42, y: 62 },
  { kind: "dvf", x: 60, y: 52 },
  { kind: "dvf", x: 36, y: 70 },
  { kind: "actif", x: 50, y: 30 },
  { kind: "actif", x: 22, y: 60 },
  { kind: "actif", x: 70, y: 64 },
];

// ──────────────────────────────────────────────────────────────────
// Route
// ──────────────────────────────────────────────────────────────────

export interface SearchParams {
  id?: string;
}

function StepResultatPage() {
  const navigate = useNavigate();
  const { state, reset } = useEstimerState();
  const address = state.address || "12 rue de la Gare, Le Chénay, Gagny (93)";
  const surface = state.bien_data.surface_carrez || MOCK_VALO.surface;

  function handleNewEstimation() {
    reset();
    void navigate({ to: "/estimer" });
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-bg",
        "[background-image:radial-gradient(900px_500px_at_100%_0%,rgba(217,119,87,0.08),transparent_60%),radial-gradient(700px_400px_at_-10%_30%,rgba(91,71,224,0.05),transparent_60%)]",
      )}
    >
      <ResultatHeader onNewEstimation={handleNewEstimation} />

      <div className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-8">
        {/* Meta row */}
        <div className="mt-9 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <Eyebrow variant="terra">
              Ton estimation · {formatDate(new Date())}
            </Eyebrow>
            <h1 className="mt-2 text-[clamp(1.5rem,3vw,1.875rem)] font-semibold leading-[1.15] tracking-[-0.022em] text-ink">
              T3 {surface} m² ·{" "}
              <span className="font-medium text-mute-2">{address}</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-ink">
              Mise à jour automatique chaque semaine · Prochaine
              réévaluation lundi
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-1 text-[11.5px] font-medium text-sage-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sage" />
              Mode suivi · gratuit
            </span>
            <Button variant="ghost" size="sm">
              <Pencil className="h-3 w-3" strokeWidth={2} />
              Modifier le bien
            </Button>
            <Button variant="secondary" size="sm">
              Rafraîchir
            </Button>
          </div>
        </div>

        {/* Section 1 — Valorisation */}
        <ValorisationCard
          min={MOCK_VALO.min}
          max={MOCK_VALO.max}
          central={MOCK_VALO.central}
          surface={surface}
          medianSecteurM2={MOCK_VALO.medianSecteurM2}
          confidence={MOCK_VALO.confidence}
          computedAtLabel={`Estimation au ${formatDate(new Date())} — réévaluée chaque semaine`}
          localisation="Le Chénay · IRIS 930320206"
          typologie={`T3 · ${surface} m² Carrez · 3e étage`}
          dpe="D"
          ges="C"
          confidenceReason={
            <>
              Estimation <b className="text-ink-2">solide</b> : 23 transactions
              DVF récentes au Chénay, 2 recherches comparables fournies (47 et
              32 biens), et 6 photos clairement analysables.
            </>
          }
        />

        {/* Section 2 — La thèse */}
        <section className="mt-14">
          <TheseBlock attribution="Claude" title="L'analyse" glyph={<Sparkles className="h-3 w-3" strokeWidth={2.5} />}>
            <p>
              Le Chénay est un secteur de Gagny qui présente une
              caractéristique rare : son prix médian au m² est{" "}
              <b>46 % inférieur</b> à celui du centre-ville (4 680 €/m² vs
              8 640 €/m² pour Gagny Centre), pour des biens dont la
              connectivité RER E reste très proche (8 min à pied de la gare).
              Pour un investisseur locatif visant 6-7 % brut sur du T3, ton
              secteur est un sweet spot évident — c&rsquo;est ce qui explique
              que <b>23 transactions ont été enregistrées en 5 ans sur ton
              IRIS</b> et que le marché actif est tendu (médian 4 760 €/m²,
              soit +1,7 % vs DVF).
            </p>
            <p>
              Sur les 47 biens proches que tu as remontés via ta recherche
              SeLoger, 18 sont vraiment comparables (T3 60-65 m², secteur
              Chénay/Maison Blanche, 2e-4e étage) : leur prix médian est de{" "}
              <b>5 100 €/m²</b> avec une dispersion serrée. Ton bien, avec son
              état refait à neuf et son exposition Sud-Ouest, se positionne{" "}
              <b>dans la moitié haute</b> de cette fourchette — d&rsquo;où le
              central à 312 000 €.
            </p>
            <p>
              À ce prix, tu as une probabilité élevée de trouver acheteur en
              6-9 semaines en vente publique. Si tu veux maximiser, le mode
              discret va te permettre de mesurer la profondeur du marché avant
              d&rsquo;arbitrer prix vs vitesse.
            </p>
          </TheseBlock>
        </section>

        {/* Section 3 — Ajustements */}
        <section className="mt-14">
          <SectionHead
            title={
              <>
                Pourquoi <span className="font-serif italic font-normal text-terra">cette</span>{" "}
                estimation
              </>
            }
            desc="7 ajustements identifiés sur le bien, le secteur, les risques et le marché."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {MOCK_ADJUSTMENTS.map((adj) => (
              <AdjustmentItem
                key={adj.criterion}
                tone={adj.tone}
                icon={adj.icon}
                criterion={adj.criterion}
                reason={adj.reason}
                sources={adj.sources}
                impactPct={adj.impactPct}
                impactEur={adj.impactEur}
              />
            ))}
          </div>
        </section>

        {/* Section 4 — Comparables */}
        <section className="mt-14">
          <SectionHead
            title={
              <>
                Les biens qui ont servi à{" "}
                <span className="font-serif italic font-normal text-terra">
                  l&rsquo;estimation
                </span>
              </>
            }
            desc="DVF + marché actif + tes liens, croisés sur un rayon de 600 m."
          />

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                Tous{" "}
                <span className="ml-1.5 font-mono text-[10.5px] text-mute-2">
                  26
                </span>
              </TabsTrigger>
              <TabsTrigger value="dvf">
                <DotMini kind="dvf" />
                Transactions DVF{" "}
                <span className="ml-1.5 font-mono text-[10.5px] text-mute-2">
                  11
                </span>
              </TabsTrigger>
              <TabsTrigger value="actif">
                <DotMini kind="actif" />
                Marché actif{" "}
                <span className="ml-1.5 font-mono text-[10.5px] text-mute-2">
                  8
                </span>
              </TabsTrigger>
              <TabsTrigger value="user">
                <Star className="mr-0.5 h-3 w-3 fill-terra text-terra" strokeWidth={1.5} />
                Tes liens{" "}
                <span className="ml-1.5 font-mono text-[10.5px] text-mute-2">
                  7
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ComparablesLayout pins={MOCK_PINS} rows={MOCK_COMPARABLES} />
            </TabsContent>
            <TabsContent value="dvf">
              <ComparablesLayout
                pins={MOCK_PINS.filter((p) => p.kind === "self" || p.kind === "dvf")}
                rows={MOCK_COMPARABLES.filter((r) => r.kind === "dvf")}
              />
            </TabsContent>
            <TabsContent value="actif">
              <ComparablesLayout
                pins={MOCK_PINS.filter(
                  (p) => p.kind === "self" || p.kind === "actif",
                )}
                rows={MOCK_COMPARABLES.filter((r) => r.kind === "actif")}
              />
            </TabsContent>
            <TabsContent value="user">
              <ComparablesLayout
                pins={MOCK_PINS.filter((p) => p.kind === "self" || p.kind === "user")}
                rows={MOCK_COMPARABLES.filter((r) => r.kind === "user")}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* Section 5 — Que faire maintenant */}
        <section className="mt-14">
          <SectionHead
            title={
              <>
                Que <span className="font-serif italic font-normal text-terra">faire</span> maintenant ?
              </>
            }
            desc="Tu peux passer d'une étape à l'autre quand tu veux. Rien n'est figé."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <NextCard
              icon={<Bell className="h-4 w-4" strokeWidth={2} />}
              title="Suivre la valeur"
              priceLabel="Gratuit"
              priceTone="free"
              desc={
                <>
                  Tu seras prévenu si la valeur de ton bien bouge de plus
                  de <b>3 %</b>. Aucune visibilité publique, aucune
                  sollicitation commerciale.
                </>
              }
              footer={
                <span className="inline-flex items-center gap-2.5 rounded-r-sm bg-bg-2 px-3 py-2 text-[12px] text-ink-2">
                  <ToggleVisual on />
                  Activé par défaut · alerte hebdo
                </span>
              }
              cta="Paramètres d'alerte"
              ctaHref="#"
            />
            <NextCard
              featured
              icon={<Eye className="h-4 w-4" strokeWidth={2} />}
              title="Tester l'intérêt"
              priceLabel="Gratuit"
              priceTone="free"
              desc={
                <>
                  Mode discret : ton bien apparaît <b>anonymement</b> dans
                  la vitrine acheteurs. Tu mesures les vues, les favoris et
                  le profil des acheteurs sans qu&rsquo;ils puissent te
                  contacter.
                </>
              }
              footer={
                <span className="inline-flex items-center gap-2 rounded-r-sm border border-terra/30 bg-transparent px-3 py-2 text-[12px] text-terra-deep">
                  <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  Adresse masquée jusqu&rsquo;à la vente
                </span>
              }
              cta="En savoir plus"
              ctaHref="#"
            />
            <NextCard
              icon={<Megaphone className="h-4 w-4" strokeWidth={2} />}
              title="Mettre en vente"
              priceLabel="49 €"
              priceTone="paid"
              desc={
                <>
                  Annonce publique complète, contact direct, visibilité Google
                  et auprès des <b>200+ investisseurs actifs sur Gagny</b> via
                  ImmoScan. Paiement unique, pas d&rsquo;abonnement.
                </>
              }
              footer={
                <span className="inline-flex items-center gap-2.5 rounded-r-sm bg-bg-2 px-3 py-2 text-[12px] text-ink-2">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                  Pas de reconduction
                </span>
              }
              cta="Démarrer"
              ctaHref="#"
            />
          </div>
        </section>

        {/* Section 6 — Téléchargement (placeholders) */}
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-r-lg border border-dashed border-line-2 bg-card px-5 py-4.5">
          <span className="flex-1 min-w-[200px] text-[13.5px] font-medium text-ink">
            Garde ton estimation sous le coude{" "}
            <span className="font-normal text-muted-ink">
              · PDF de 4 pages, partageable
            </span>
          </span>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 rounded-r-sm border border-line bg-bg px-3 py-1.5 text-[13px] text-ink-2 no-underline hover:bg-bg-2"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Télécharger le PDF
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 rounded-r-sm border border-line bg-bg px-3 py-1.5 text-[13px] text-ink-2 no-underline hover:bg-bg-2"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
            Partager par lien
          </a>
        </div>

        {/* Footer */}
        <div className="mt-24 flex items-center justify-between border-t border-line pt-7 font-mono text-[11.5px] text-mute-2">
          <span>
            ImmoValue · Estimation pour {address} · réf #IV-2026-3041
          </span>
          <a
            href="https://immoscan.fr"
            className="text-violet no-underline"
          >
            Tu cherches plutôt à investir ? → ImmoScan
          </a>
        </div>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header — fil d'Ariane + bouton "nouvelle estimation"
// ──────────────────────────────────────────────────────────────────

function ResultatHeader({ onNewEstimation }: { onNewEstimation: () => void }) {
  return (
    <header className="border-b border-line/60 bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-6 sm:px-8">
        <Wordmark />
        <nav className="hidden gap-5 text-[13px] text-muted-ink md:flex">
          <Link to="/" className="no-underline hover:text-ink">
            Tableau de bord
          </Link>
          <a href="#" className="no-underline hover:text-ink">
            Mes biens
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onNewEstimation}>
            <FileText className="h-3 w-3" strokeWidth={2} />
            Nouvelle estimation
          </Button>
        </div>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function SectionHead({
  title,
  desc,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-baseline gap-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.018em] text-ink">
        {title}
      </h2>
      {desc && <span className="text-[13.5px] text-muted-ink">{desc}</span>}
    </div>
  );
}

function DotMini({ kind }: { kind: ComparableKind }) {
  const cls =
    kind === "dvf"
      ? "bg-violet"
      : kind === "actif"
      ? "bg-sage"
      : kind === "user"
      ? "bg-terra"
      : "bg-ink";
  return (
    <span
      aria-hidden
      className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", cls)}
    />
  );
}

function ComparablesLayout({
  pins,
  rows,
}: {
  pins: ComparablePin[];
  rows: typeof MOCK_COMPARABLES;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      <ComparablesMap pins={pins} caption="RAYON 600 m · IRIS 930320206" />
      <ul className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <li className="rounded-r-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-mute-2">
            Aucun comparable pour cet onglet.
          </li>
        ) : (
          rows.map((c, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3.5 rounded-r border border-line bg-card px-4 py-3 transition-colors hover:border-line-2 hover:shadow-lvl-1"
            >
              <DotMini kind={c.kind} />
              <div>
                <div className="text-[13px] font-medium text-ink">
                  {c.title}{" "}
                  <span className="ml-1 font-normal text-mute-2">
                    · {c.detail}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-mute-2">
                  {c.kind === "user" && (
                    <Star className="mr-1 inline h-2.5 w-2.5 fill-terra text-terra" strokeWidth={1.5} />
                  )}
                  {c.src}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13.5px] font-semibold tnum text-ink">
                  {c.price}
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-mute-2 tnum">
                  {c.pricem2}
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-faint" strokeWidth={2} />
            </li>
          ))
        )}
        <li className="mt-1 text-center">
          <a
            href="#"
            className="text-[12.5px] text-violet no-underline hover:text-violet-deep"
          >
            Voir les autres comparables →
          </a>
        </li>
      </ul>
    </div>
  );
}

function NextCard({
  icon,
  title,
  desc,
  priceLabel,
  priceTone,
  footer,
  cta,
  ctaHref,
  featured = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: React.ReactNode;
  priceLabel: string;
  priceTone: "free" | "paid";
  footer: React.ReactNode;
  cta: string;
  ctaHref: string;
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative flex flex-col gap-3 p-6 transition-transform hover:-translate-y-0.5",
        featured &&
          "border-terra/30 bg-gradient-to-b from-terra/[0.05] to-terra/[0.01]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-r",
            featured
              ? "bg-terra-soft text-terra-deep"
              : "bg-bg-2 text-muted-ink",
          )}
        >
          {icon}
        </span>
        <h3 className="flex-1 text-[16.5px] font-semibold tracking-tight text-ink">
          {title}
        </h3>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold",
            priceTone === "free"
              ? "bg-sage-soft text-[#2F5340]"
              : "bg-terra-soft text-terra-deep",
          )}
        >
          {priceLabel}
        </span>
      </div>
      <p className="text-[13px] leading-[1.55] text-muted-ink [text-wrap:pretty]">
        {desc}
      </p>
      {footer}
      <a
        href={ctaHref}
        className={cn(
          "mt-auto inline-flex items-center gap-1 text-[13px] font-medium no-underline",
          featured ? "text-terra-deep" : "text-ink",
        )}
      >
        {cta}
        <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
      </a>
    </Card>
  );
}

function ToggleVisual({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-4 w-7 rounded-full",
        on ? "bg-sage" : "bg-bg-3",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 inline-block h-3 w-3 rounded-full bg-white shadow-lvl-1 transition-transform",
          on ? "right-0.5" : "left-0.5",
        )}
      />
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// search params validator pour TanStack Router.
function validateSearch(search: Record<string, unknown>): SearchParams {
  const id = typeof search.id === "string" ? search.id : undefined;
  return { id };
}

export const Route = createFileRoute("/estimer/resultat")({
  component: StepResultatPage,
  validateSearch,
});
