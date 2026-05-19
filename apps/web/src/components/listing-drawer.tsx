// ListingDrawer — fiche bien complète dans un side panel.
//
// Présentationnel pur : reçoit `listing` en props, expose `open` + `onClose`.
// Sections : header (titre/prix), KPIs financiers, scoring détaillé,
// thèse Claude, plan financement, stratégie négociation.
//
// Tous les champs sont nullable côté DB → on rend "—" si manquant.
// Le freemium teasing est géré côté serveur via la vue : les champs
// sensibles (prix, adresse, thèse) arrivent déjà à null si `is_masked`.

import { ExternalLink, Lock, MapPin } from "lucide-react";
import * as React from "react";

import { ListingSimulator } from "@/components/listing-simulator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScoreBadge } from "@/components/score-badge";

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
};

const VERDICT_LABEL: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  a_visiter: { label: "À visiter", variant: "success" },
  sous_reserve: { label: "Sous réserve", variant: "warning" },
  no_go: { label: "No-go", variant: "danger" },
};

function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(digits)} %`;
}

export function ListingDrawer({
  listing,
  onClose,
  onUpgrade,
  analysisParams,
}: Props) {
  const open = listing !== null;
  const verdict = listing?.verdict ? VERDICT_LABEL[listing.verdict] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {listing ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-3">
                {listing.score_total !== null ? (
                  <ScoreBadge score={listing.score_total} size="lg" />
                ) : null}
                <div className="min-w-0 flex-1 pr-8">
                  <SheetTitle className={listing.is_masked ? "blur-sm select-none" : ""}>
                    {listing.title ?? "Sans titre"}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.ville ?? "—"}
                    {listing.code_postal ? ` · ${listing.code_postal}` : ""}
                    {listing.surface ? ` · ${listing.surface} m²` : ""}
                    {listing.pieces ? ` · ${listing.pieces}P` : ""}
                  </SheetDescription>
                  {verdict ? (
                    <Badge variant={verdict.variant} className="mt-2">
                      {verdict.label}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-7">
              {/* Galerie photos : 1ère en grand + thumbs scrollables horizontales */}
              {listing.photos_urls && listing.photos_urls.length > 0 ? (
                <ListingGallery
                  photos={listing.photos_urls}
                  alt={listing.title ?? ""}
                  blurred={listing.is_masked}
                />
              ) : null}

              {/* Prix + écart marché */}
              <section>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Prix affiché
                    </div>
                    <div className="mt-1 font-mono text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                      {listing.is_masked ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Lock className="h-5 w-5 text-primary" /> Masqué
                        </span>
                      ) : (
                        fmtEur(listing.prix)
                      )}
                    </div>
                    {!listing.is_masked && listing.surface ? (
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {Math.round((listing.prix ?? 0) / listing.surface)} €/m²
                      </div>
                    ) : null}
                  </div>
                  {!listing.is_masked && listing.ecart_prix_pct !== null && listing.ecart_prix_pct !== undefined ? (
                    <div className="text-right">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Écart vs marché
                      </div>
                      <div
                        className={`mt-1 font-mono text-[18px] font-semibold tabular-nums ${
                          listing.ecart_prix_pct < 0
                            ? "text-success-foreground"
                            : "text-warning-foreground"
                        }`}
                      >
                        {listing.ecart_prix_pct > 0 ? "+" : ""}
                        {listing.ecart_prix_pct.toFixed(1)} %
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Marché : {fmtEur(listing.prix_marche_estime)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Caractéristiques bien */}
              <section>
                <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Caractéristiques
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <Pair label="Type" value={listing.type ?? "—"} />
                  <Pair label="Surface" value={listing.surface ? `${listing.surface} m²` : "—"} />
                  <Pair label="Pièces" value={listing.pieces?.toString() ?? "—"} />
                  <Pair label="Chambres" value={listing.chambres?.toString() ?? "—"} />
                  <Pair label="DPE" value={listing.dpe ?? "—"} />
                  <Pair label="GES" value={listing.ges ?? "—"} />
                  <Pair label="Étage" value={listing.etage?.toString() ?? "—"} />
                  <Pair
                    label="Année"
                    value={listing.annee_construction?.toString() ?? (listing.is_new_construction ? "Neuf" : "—")}
                  />
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.balcon ? <Tag>Balcon</Tag> : null}
                  {listing.terrasse ? <Tag>Terrasse</Tag> : null}
                  {listing.parking ? <Tag>Parking</Tag> : null}
                  {listing.ascenseur ? <Tag>Ascenseur</Tag> : null}
                  {listing.cave ? <Tag>Cave</Tag> : null}
                  {listing.is_new_construction ? <Tag>Neuf</Tag> : null}
                </div>
              </section>

              {/* Scoring détaillé */}
              {listing.score_total !== null ? (
                <section>
                  <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Scoring détaillé
                  </h3>
                  <div className="space-y-2">
                    <SubScore label="Prix" score={listing.score_prix} />
                    <SubScore label="Rendement" score={listing.score_rendement} />
                    <SubScore label="Cashflow" score={listing.score_cashflow} />
                    <SubScore label="DPE" score={listing.score_dpe} />
                    <SubScore label="Quartier" score={listing.score_quartier} />
                    <SubScore label="Risques" score={listing.score_risques} />
                  </div>
                </section>
              ) : null}

              {/* Métriques financières */}
              {!listing.is_masked &&
              (listing.loyer_estime !== null ||
                listing.rendement_brut_pct !== null) ? (
                <section>
                  <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Indicateurs financiers
                  </h3>
                  <dl className="grid grid-cols-2 gap-3 text-[13px]">
                    <Pair label="Loyer estimé" value={fmtEur(listing.loyer_estime)} />
                    <Pair
                      label="Cashflow / mois"
                      value={fmtEur(listing.cashflow_mensuel)}
                    />
                    <Pair label="Rendement brut" value={fmtPct(listing.rendement_brut_pct)} />
                    <Pair label="Rendement net" value={fmtPct(listing.rendement_net_pct)} />
                  </dl>
                </section>
              ) : null}

              {/* Simulateur "et si ?" */}
              {!listing.is_masked && analysisParams && listing.loyer_estime ? (
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
              ) : null}

              {/* Thèse Claude */}
              {listing.is_masked ? (
                <section className="rounded-lg border border-border bg-primary-soft/30 p-5 text-center">
                  <Lock className="mx-auto h-6 w-6 text-primary" />
                  <p className="mt-3 text-[14px] font-medium">
                    Thèse Claude masquée
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Passe Pro pour lire la thèse complète, le plan de
                    financement et la stratégie de négociation chiffrée.
                  </p>
                  <Button className="mt-4" size="sm" onClick={onUpgrade}>
                    Passer Pro — 7 jours offerts
                  </Button>
                </section>
              ) : listing.these_claude ? (
                <section>
                  <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Analyse Claude
                  </h3>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[13.5px] leading-[1.65] text-secondary-foreground">
                    {listing.these_claude}
                  </div>
                </section>
              ) : null}

              {/* Plan de financement */}
              {!listing.is_masked && listing.financement_claude ? (
                <section>
                  <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Plan de financement
                  </h3>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[13.5px] leading-[1.65] text-secondary-foreground">
                    {listing.financement_claude}
                  </div>
                </section>
              ) : null}

              {/* Stratégie de négociation */}
              {!listing.is_masked && listing.negociation_claude ? (
                <section>
                  <h3 className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <span>Stratégie de négociation</span>
                    {listing.prix_negociation_cible !== null ? (
                      <span className="font-mono text-[12px] normal-case text-foreground">
                        Cible : {fmtEur(listing.prix_negociation_cible)}
                      </span>
                    ) : null}
                  </h3>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[13.5px] leading-[1.65] text-secondary-foreground">
                    {listing.negociation_claude}
                  </div>
                </section>
              ) : null}

              {/* Description originale */}
              {!listing.is_masked && listing.description ? (
                <section>
                  <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Description annonce
                  </h3>
                  <p className="whitespace-pre-wrap text-[13px] text-muted-foreground line-clamp-[10]">
                    {listing.description}
                  </p>
                </section>
              ) : null}

              {/* Lien source */}
              {!listing.is_masked && listing.source_url ? (
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={listing.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Voir l'annonce
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              ) : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
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
  const safeIdx = Math.min(activeIdx, photos.length - 1);
  const heroSrc = photos[safeIdx]!;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border">
        <img
          src={heroSrc}
          alt={alt}
          className={`aspect-[16/10] w-full bg-secondary object-cover ${blurred ? "blur-md select-none" : ""}`}
        />
      </div>
      {photos.length > 1 ? (
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                i === safeIdx
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              }`}
              aria-label={`Photo ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className={`h-14 w-20 object-cover ${blurred ? "blur-sm" : ""}`}
              />
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {photos.length} photo{photos.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function SubScore({ label, score }: { label: string; score: number | null }) {
  const value = score ?? 0;
  const tone =
    value >= 70 ? "bg-success" : value >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-[12px] text-muted-foreground">{label}</div>
      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full ${tone} transition-all`}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
      </div>
      <div className="w-8 text-right font-mono tabular-nums text-[12px]">
        {score ?? "—"}
      </div>
    </div>
  );
}
