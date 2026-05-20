// ListingDrawer — fiche bien complète dans un side panel.
//
// Présentationnel pur : reçoit `listing` en props, expose `open` + `onClose`.
// Sections : header (titre/prix), galerie, prix/écart marché, caractéristiques,
// mini-carte + confiance adresse, scoring détaillé, indicateurs financiers,
// simulateur "et si ?", thèse Claude, plan financement, rail de négociation,
// description, source.
//
// Tous les champs sont nullable côté DB → on rend "—" si manquant.
// Le freemium teasing est géré côté serveur via la vue : les champs
// sensibles (prix, adresse, thèse) arrivent déjà à null si `is_masked`.

import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ImageOff,
  Lock,
  MapPin,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ListingMap } from "@/components/listing-map";
import { ListingSimulator } from "@/components/listing-simulator";
import { Button } from "@/components/ui/button";
import { ConfBadge } from "@/components/ui/conf-badge";
import { DpePill, type DpeLetter } from "@/components/ui/dpe-pill";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ScoreBadge } from "@/components/ui/score-badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TheseBlock } from "@/components/ui/these-block";
import { VerdictPill, type VerdictTone } from "@/components/ui/verdict-pill";
import {
  type ListingSnapshot,
  useAddToPipeline,
  useDeletePipelineItem,
  usePipelineItemForListing,
} from "@/hooks/use-pipeline";
import { cn } from "@/lib/utils";

export type ListingDrawerData = {
  id: string;
  title: string | null;
  type: string | null;
  surface: number | null;
  pieces: number | null;
  chambres: number | null;
  prix: number | null;
  dpe: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  ges: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  ville: string | null;
  code_postal: string | null;
  adresse_raw: string | null;
  source_url: string | null;
  description: string | null;
  annee_construction: number | null;
  etage: number | null;
  is_new_construction: boolean | null;
  ascenseur: boolean | null;
  balcon: boolean | null;
  terrasse: boolean | null;
  parking: boolean | null;
  cave: boolean | null;
  photos_urls: string[] | null;

  // scoring
  score_total: number | null;
  score_prix: number | null;
  score_rendement: number | null;
  score_cashflow: number | null;
  score_dpe: number | null;
  score_quartier: number | null;
  score_risques: number | null;
  verdict: "a_visiter" | "sous_reserve" | "no_go" | null;

  // financial
  prix_marche_estime: number | null;
  ecart_prix_pct: number | null;
  loyer_estime: number | null;
  rendement_brut_pct: number | null;
  rendement_net_pct: number | null;
  cashflow_mensuel: number | null;

  // Claude
  these_claude: string | null;
  financement_claude: string | null;
  negociation_claude: string | null;
  prix_negociation_cible: number | null;

  // localisation
  lat: number | null;
  lng: number | null;
  /** Source de résolution d'adresse : 'ademe' | 'ban_forward' | 'ban_reverse' | 'scraped' | 'none' */
  resolution_source: string | null;
  /** Confiance 0-1 du résultat adresse (1 = exact, 0.1 = approx ville/CP). */
  address_confidence: number | null;

  // freemium
  is_masked: boolean;
};

type Props = {
  listing: ListingDrawerData | null;
  onClose: () => void;
  onUpgrade?: () => void;
  /** Params actuels de l'analyse (pour pré-remplir le simulateur). */
  analysisParams?: {
    apport: number | null;
    taux_credit_pct: number | null;
    duree_credit_ans: number | null;
    tmi_pct: number | null;
  } | null;
  /** analysisId pour le snapshot pipeline_items (lien vers la recherche). */
  analysisId?: string;
};

const VERDICT_LABEL: Record<
  string,
  { label: string; tone: VerdictTone }
> = {
  a_visiter: { label: "À visiter", tone: "good" },
  sous_reserve: { label: "Sous réserve", tone: "mid" },
  no_go: { label: "No-go", tone: "bad" },
};

function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  // Espace insécable avant le symbole € (typo française).
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(digits).replace(".", ",")} %`;
}

export function ListingDrawer({
  listing,
  onClose,
  onUpgrade,
  analysisParams,
  analysisId,
}: Props) {
  const { item: pipelineItem } = usePipelineItemForListing(listing?.id ?? null);
  const addToPipeline = useAddToPipeline();
  const removeFromPipeline = useDeletePipelineItem();

  function togglePipeline() {
    if (!listing || !analysisId) return;
    if (pipelineItem) {
      removeFromPipeline.mutate(pipelineItem.id, {
        onSuccess: () => toast.success("Retiré du pipeline"),
      });
    } else {
      const snapshot: ListingSnapshot = {
        id: listing.id,
        external_id: "", // dispo dans ListingRow mais pas dans ListingDrawerData
        source_url: listing.source_url,
        source_site: "seloger",
        title: listing.title,
        type: listing.type,
        surface: listing.surface,
        pieces: listing.pieces,
        prix: listing.prix,
        dpe: listing.dpe,
        ville: listing.ville,
        code_postal: listing.code_postal,
        photos_urls: listing.photos_urls,
        score_total: listing.score_total,
        rendement_brut_pct: listing.rendement_brut_pct,
        cashflow_mensuel: listing.cashflow_mensuel,
        verdict: listing.verdict,
        analysis_id: analysisId,
      };
      addToPipeline.mutate(
        { snapshot },
        {
          onSuccess: () => toast.success("Ajouté au pipeline · À visiter"),
          onError: (err) => toast.error(`Erreur : ${(err as Error).message}`),
        },
      );
    }
  }
  const open = listing !== null;
  const verdict = listing?.verdict ? VERDICT_LABEL[listing.verdict] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {listing ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                {listing.score_total !== null ? (
                  <ScoreBadge value={listing.score_total} size="lg" />
                ) : null}
                <div className="min-w-0 flex-1 pr-8">
                  <SheetTitle
                    className={cn(
                      "text-2xl font-semibold tracking-tight",
                      listing.is_masked && "blur-sm select-none",
                    )}
                  >
                    {listing.title ?? "Sans titre"}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-1.5 text-muted-ink">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.ville ?? "—"}
                    {listing.code_postal ? ` · ${listing.code_postal}` : ""}
                    {listing.surface ? ` · ${listing.surface} m²` : ""}
                    {listing.pieces ? ` · ${listing.pieces} pièces` : ""}
                  </SheetDescription>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {verdict ? (
                      <VerdictPill verdict={verdict.tone}>
                        {verdict.label}
                      </VerdictPill>
                    ) : null}
                    {analysisId && !listing.is_masked ? (
                      <Button
                        variant={pipelineItem ? "default" : "ghost"}
                        size="sm"
                        onClick={togglePipeline}
                        disabled={
                          addToPipeline.isPending || removeFromPipeline.isPending
                        }
                      >
                        {pipelineItem ? (
                          <BookmarkCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Bookmark className="h-3.5 w-3.5" />
                        )}
                        {pipelineItem ? "Dans le pipeline" : "Ajouter au pipeline"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-8">
              {/* 1. Galerie photos — placeholder si vide. */}
              <ListingGallery
                photos={listing.photos_urls ?? []}
                alt={listing.title ?? ""}
                blurred={listing.is_masked}
              />

              {/* 2. Prix + écart marché */}
              <section className="rounded-r-lg border border-line bg-card p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <Eyebrow>Prix demandé</Eyebrow>
                    <div className="mt-1.5 font-mono text-3xl font-semibold tnum tracking-[-0.02em] text-ink">
                      {listing.is_masked ? (
                        <span className="inline-flex items-center gap-2 text-mute-2">
                          <Lock className="h-5 w-5 text-violet" /> Masqué
                        </span>
                      ) : (
                        fmtEur(listing.prix)
                      )}
                    </div>
                    {!listing.is_masked && listing.surface && listing.prix ? (
                      <div className="mt-1.5 font-mono text-xs tnum text-mute-2">
                        {Math.round(listing.prix / listing.surface).toLocaleString("fr-FR")}
                        {" €/m²"}
                      </div>
                    ) : null}
                  </div>
                  {!listing.is_masked &&
                  listing.ecart_prix_pct !== null &&
                  listing.ecart_prix_pct !== undefined ? (
                    <div className="text-right">
                      <Eyebrow>Écart médian DVF</Eyebrow>
                      <EcartBadge pct={listing.ecart_prix_pct} />
                      {listing.prix_marche_estime !== null ? (
                        <div className="mt-1.5 font-mono text-[11px] tnum text-mute-2">
                          Marché : {fmtEur(listing.prix_marche_estime)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>

              {/* 3. Caractéristiques (chips) */}
              <section>
                <Eyebrow className="mb-3">Caractéristiques</Eyebrow>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <Pair label="Type" value={listing.type ?? "—"} />
                  <Pair
                    label="Surface"
                    value={listing.surface ? `${listing.surface} m²` : "—"}
                  />
                  <Pair label="Pièces" value={listing.pieces?.toString() ?? "—"} />
                  <Pair label="Chambres" value={listing.chambres?.toString() ?? "—"} />
                  <PairDpe label="DPE" letter={listing.dpe} />
                  <PairDpe label="GES" letter={listing.ges} />
                  <Pair label="Étage" value={listing.etage?.toString() ?? "—"} />
                  <Pair
                    label="Année"
                    value={
                      listing.annee_construction?.toString() ??
                      (listing.is_new_construction ? "Neuf" : "—")
                    }
                  />
                </dl>
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {listing.balcon ? <Chip>Balcon</Chip> : null}
                  {listing.terrasse ? <Chip>Terrasse</Chip> : null}
                  {listing.parking ? <Chip>Parking</Chip> : null}
                  {listing.ascenseur ? <Chip>Ascenseur</Chip> : null}
                  {listing.cave ? <Chip>Cave</Chip> : null}
                  {listing.is_new_construction ? <Chip>Neuf</Chip> : null}
                </div>
              </section>

              {/* 4. Mini-carte + confiance adresse — uniquement si payant + coords. */}
              {!listing.is_masked &&
              listing.lat !== null &&
              listing.lng !== null ? (
                <section>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <Eyebrow>Localisation</Eyebrow>
                    {listing.adresse_raw ? (
                      <span className="truncate font-mono text-[11px] tnum text-ink-2">
                        {listing.adresse_raw}
                      </span>
                    ) : null}
                  </div>
                  <AddressConfidence
                    source={listing.resolution_source}
                    confidence={listing.address_confidence}
                  />
                  <div className="mt-3 overflow-hidden rounded-r-md border border-line">
                    <ListingMap
                      lat={listing.lat}
                      lng={listing.lng}
                      address={
                        listing.adresse_raw ??
                        (`${listing.ville ?? ""} ${listing.code_postal ?? ""}`.trim() ||
                          null)
                      }
                      verdict={listing.verdict}
                    />
                  </div>
                </section>
              ) : null}

              {/* 5. Scoring 6 critères */}
              {listing.score_total !== null ? (
                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Eyebrow>Scoring détaillé</Eyebrow>
                    <ScoreBadge value={listing.score_total} size="sm" />
                  </div>
                  <div className="space-y-2.5">
                    <SubScore label="Prix" hint="vs DVF" score={listing.score_prix} />
                    <SubScore
                      label="Rendement"
                      hint="brut"
                      score={listing.score_rendement}
                    />
                    <SubScore
                      label="Cashflow"
                      hint="mensuel"
                      score={listing.score_cashflow}
                    />
                    <SubScore label="DPE" hint="/ GES" score={listing.score_dpe} />
                    <SubScore
                      label="Quartier"
                      hint="attractivité"
                      score={listing.score_quartier}
                    />
                    <SubScore
                      label="Risques"
                      hint="Géorisques"
                      score={listing.score_risques}
                    />
                  </div>
                </section>
              ) : null}

              {/* 6. Indicateurs financiers */}
              {!listing.is_masked &&
              (listing.loyer_estime !== null ||
                listing.rendement_brut_pct !== null) ? (
                <section>
                  <Eyebrow className="mb-3">Indicateurs financiers</Eyebrow>
                  <div className="grid grid-cols-2 gap-3">
                    <FinCell
                      label="Loyer estimé"
                      value={fmtEur(listing.loyer_estime)}
                    />
                    <FinCell
                      label="Cashflow / mois"
                      value={fmtEur(listing.cashflow_mensuel)}
                      tone={
                        listing.cashflow_mensuel !== null
                          ? listing.cashflow_mensuel >= 0
                            ? "good"
                            : "bad"
                          : undefined
                      }
                    />
                    <FinCell
                      label="Rendement brut"
                      value={fmtPct(listing.rendement_brut_pct)}
                    />
                    <FinCell
                      label="Rendement net"
                      value={fmtPct(listing.rendement_net_pct)}
                    />
                  </div>
                </section>
              ) : null}

              {/* 7. Simulateur "et si ?" — branché sur ListingSimulator existant.
                   Si pas de prix/loyer, on affiche un placeholder pour cohérence. */}
              {!listing.is_masked &&
              analysisParams &&
              listing.loyer_estime &&
              listing.prix ? (
                <ListingSimulator
                  listing={{
                    prix: listing.prix,
                    surface: listing.surface,
                    is_new_construction: listing.is_new_construction,
                    loyer_estime: listing.loyer_estime,
                  }}
                  initialParams={{
                    apport: analysisParams.apport ?? 200_000,
                    taux_credit_pct: analysisParams.taux_credit_pct ?? 3,
                    duree_credit_ans: analysisParams.duree_credit_ans ?? 25,
                    tmi_pct: analysisParams.tmi_pct ?? 30,
                  }}
                />
              ) : !listing.is_masked ? (
                <section className="rounded-r-md border border-dashed border-line bg-bg-2 p-5 text-center">
                  <Eyebrow variant="violet">Simulateur « et si ? »</Eyebrow>
                  <p className="mt-2 text-[13px] text-mute-2">
                    Disponible dès qu'on a le loyer estimé et le prix du bien.
                  </p>
                </section>
              ) : null}

              {/* 8. Thèse Claude */}
              {listing.is_masked ? (
                <section className="rounded-r-lg border border-line bg-violet-soft/30 p-6 text-center">
                  <Lock className="mx-auto h-6 w-6 text-violet" />
                  <p className="mt-3 text-sm font-medium text-ink">
                    Thèse Claude masquée
                  </p>
                  <p className="mt-1.5 text-[13px] text-mute-2">
                    Passe Pro pour lire la thèse complète, le plan de financement
                    et la stratégie de négociation chiffrée.
                  </p>
                  <Button className="mt-4" size="sm" onClick={onUpgrade}>
                    Passer Pro — 7 jours offerts
                  </Button>
                </section>
              ) : listing.these_claude ? (
                <TheseBlock attribution="Claude" title="Pourquoi ce bien">
                  <p className="whitespace-pre-wrap">{listing.these_claude}</p>
                </TheseBlock>
              ) : null}

              {/* 9. Plan de financement */}
              {!listing.is_masked && listing.financement_claude ? (
                <section className="rounded-r-md border border-line bg-card p-5">
                  <Eyebrow className="mb-3">Plan de financement</Eyebrow>
                  <div className="whitespace-pre-wrap text-[13.5px] leading-[1.65] text-ink-2">
                    {listing.financement_claude}
                  </div>
                </section>
              ) : null}

              {/* 10. Rail de négociation (statique si pas de slider implémenté). */}
              {!listing.is_masked && listing.negociation_claude ? (
                <section className="rounded-r-md border border-line bg-card p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Eyebrow>Stratégie de négociation</Eyebrow>
                    {listing.prix_negociation_cible !== null ? (
                      <span className="font-mono text-[12px] tnum text-ink">
                        Cible :{" "}
                        <span className="font-semibold">
                          {fmtEur(listing.prix_negociation_cible)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-[1.65] text-ink-2">
                    {listing.negociation_claude}
                  </p>
                  {listing.prix !== null &&
                  listing.prix_negociation_cible !== null &&
                  listing.prix_marche_estime !== null ? (
                    <NegoRail
                      target={listing.prix_negociation_cible}
                      asking={listing.prix}
                      market={listing.prix_marche_estime}
                    />
                  ) : null}
                </section>
              ) : null}

              {/* 11. Description annonce */}
              {!listing.is_masked && listing.description ? (
                <section>
                  <Eyebrow className="mb-3">Description annonce</Eyebrow>
                  <p className="line-clamp-[10] whitespace-pre-wrap text-[13.5px] leading-[1.6] text-ink-2">
                    {listing.description}
                  </p>
                </section>
              ) : null}

              {/* 12. Source */}
              {!listing.is_masked && listing.source_url ? (
                <section>
                  <Eyebrow className="mb-2">Source de l'annonce</Eyebrow>
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-violet hover:underline"
                  >
                    Voir l'annonce sur le site
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </section>
              ) : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * EcartBadge — affiche le pourcentage d'écart au marché coloré selon le sens :
 *  - sous le marché (négatif)   → sage-soft / sage-2 (opportunité)
 *  - dans la fourchette ±3%     → bg-2 / mute-2 (neutre)
 *  - au-dessus du marché        → warning-soft / warning (vigilance)
 */
function EcartBadge({ pct }: { pct: number }) {
  const tone: "good" | "neutral" | "warn" =
    pct <= -3 ? "good" : pct >= 3 ? "warn" : "neutral";
  const cls = {
    good: "bg-sage-soft text-sage-2",
    neutral: "bg-bg-2 text-mute-2",
    warn: "bg-warning-soft text-warning-soft-foreground",
  }[tone];
  return (
    <div
      className={cn(
        "mt-1.5 inline-flex items-center rounded-r-sm px-2 py-1 font-mono text-lg font-semibold tnum",
        cls,
      )}
    >
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1).replace(".", ",")}
      {" %"}
    </div>
  );
}

/**
 * Badge "Adresse exacte / Approximative / Inconnue" selon comment le
 * pipeline a résolu l'adresse du bien. On utilise <ConfBadge> pour le
 * meter de confiance numérique et un libellé textuel à côté.
 */
function AddressConfidence({
  source,
  confidence,
}: {
  source: string | null;
  confidence: number | null;
}) {
  if (!source) return null;
  type Tone = "good" | "mid" | "bad";
  const config: Record<string, { label: string; tone: Tone; help: string }> = {
    ademe: {
      label: "Adresse exacte",
      tone: "good",
      help: "Vérifiée via le DPE déclaré à l'ADEME (numéro + rue).",
    },
    scraped: {
      label: "Adresse exacte",
      tone: "good",
      help: "Extraite directement de l'annonce.",
    },
    ban_forward: {
      label: "Adresse précise",
      tone: "good",
      help: "Adresse scrapée puis géocodée via la Base Adresse Nationale.",
    },
    ban_reverse: {
      label: "Rue à proximité",
      tone: "mid",
      help: "Reconstituée depuis les coordonnées GPS (parfois floutées par le vendeur).",
    },
    none: {
      label: "Localisation approximative",
      tone: "bad",
      help: "Aucun enrichissement n'a réussi — seuls la ville et le code postal sont fiables.",
    },
  };
  const cfg = config[source];
  if (!cfg) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <VerdictPill verdict={cfg.tone}>{cfg.label}</VerdictPill>
      {confidence !== null ? (
        <ConfBadge confidence={confidence} title={cfg.help} />
      ) : (
        <span className="text-[11.5px] text-mute-2">{cfg.help}</span>
      )}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-r-sm border border-line bg-card px-3 py-2">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-0.5 font-mono text-[13px] font-medium tnum text-ink">
        {value}
      </div>
    </div>
  );
}

function PairDpe({
  label,
  letter,
}: {
  label: string;
  letter: DpeLetter | null;
}) {
  return (
    <div className="rounded-r-sm border border-line bg-card px-3 py-2">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1 flex items-center gap-2">
        <DpePill letter={letter} />
        {letter ? null : (
          <span className="text-[12px] text-mute-2">non renseigné</span>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-line bg-bg-2 px-2.5 text-[11.5px] font-medium text-ink-2">
      {children}
    </span>
  );
}

function ListingGallery({
  photos,
  alt,
  blurred,
}: {
  photos: string[];
  alt: string;
  blurred: boolean;
}) {
  // index de la photo affichée en grand. Cliquer une thumb la met en hero.
  const [activeIdx, setActiveIdx] = React.useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-r-lg border border-line bg-bg-2 text-faint">
        <div className="flex flex-col items-center gap-2">
          <ImageOff className="h-7 w-7" />
          <span className="text-[12px]">Aucune photo</span>
        </div>
      </div>
    );
  }

  const safeIdx = Math.min(activeIdx, photos.length - 1);
  const heroSrc = photos[safeIdx]!;

  return (
    <div>
      <div className="overflow-hidden rounded-r-lg border border-line">
        <img
          src={heroSrc}
          alt={alt}
          className={cn(
            "aspect-[16/10] w-full bg-bg-2 object-cover",
            blurred && "select-none blur-md",
          )}
        />
      </div>
      {photos.length > 1 ? (
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "shrink-0 overflow-hidden rounded-r-sm border-2 transition-colors",
                i === safeIdx
                  ? "border-violet"
                  : "border-transparent hover:border-line-2",
              )}
              aria-label={`Photo ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className={cn("h-14 w-20 object-cover", blurred && "blur-sm")}
              />
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1.5 font-mono text-[11px] tnum text-mute-2">
        {photos.length} photo{photos.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function SubScore({
  label,
  hint,
  score,
}: {
  label: string;
  hint?: string;
  score: number | null;
}) {
  const value = score ?? 0;
  // Couleur barre selon score (sage / warning / destructive).
  const fillCls =
    value >= 70
      ? "bg-sage"
      : value >= 50
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className="grid grid-cols-[110px_1fr_36px] items-center gap-3">
      <div className="text-[12.5px] text-ink-2">
        {label}
        {hint ? (
          <span className="ml-1.5 text-[11px] text-mute-2">{hint}</span>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-2">
        <div
          className={cn("h-full rounded-full transition-all", fillCls)}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <div className="text-right font-mono text-[12.5px] font-semibold tnum text-ink">
        {score ?? "—"}
      </div>
    </div>
  );
}

function FinCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const toneCls =
    tone === "good" ? "text-sage-2" : tone === "bad" ? "text-destructive" : "text-ink";
  return (
    <div className="rounded-r-md border border-line bg-card p-4">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tnum tracking-[-0.02em]",
          toneCls,
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * NegoRail — barre statique 3 marqueurs : offre cible / prix demandé /
 * marché. On positionne la cible et le prix demandé entre 0 (min) et le
 * marché (max), avec une petite marge pour que les marqueurs soient
 * visibles si la cible est trop basse / le marché trop bas.
 */
function NegoRail({
  target,
  asking,
  market,
}: {
  target: number;
  asking: number;
  market: number;
}) {
  // Échelle : min = 90% de min(target,asking,market), max = 110% de max.
  const lo = Math.min(target, asking, market) * 0.92;
  const hi = Math.max(target, asking, market) * 1.08;
  const span = Math.max(1, hi - lo);
  const pos = (v: number) => `${((v - lo) / span) * 100}%`;

  return (
    <div className="mt-5 pt-2">
      <div className="relative h-1.5 w-full rounded-full bg-bg-2">
        {/* Cible (violet) */}
        <Marker label={`Cible ${fmtEur(target)}`} left={pos(target)} tone="violet" />
        {/* Demandé (ink) */}
        <Marker label={`Demandé ${fmtEur(asking)}`} left={pos(asking)} tone="ink" />
        {/* Marché (mute) */}
        <Marker label={`Marché ${fmtEur(market)}`} left={pos(market)} tone="mute" />
      </div>
    </div>
  );
}

function Marker({
  label,
  left,
  tone,
}: {
  label: string;
  left: string;
  tone: "violet" | "ink" | "mute";
}) {
  const cls = {
    violet: "bg-violet text-violet",
    ink: "bg-ink text-ink",
    mute: "bg-mute-2 text-mute-2",
  }[tone];
  return (
    <span
      className="absolute -top-1.5 -translate-x-1/2"
      style={{ left }}
      aria-label={label}
    >
      <span className={cn("block h-4 w-0.5", cls.split(" ")[0])} />
      <span
        className={cn(
          "absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-r-xs border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] tnum",
          cls.split(" ")[1],
        )}
      >
        {label}
      </span>
    </span>
  );
}
