// HelpDrawer — guide explicatif : méthodologie scoring + glossaire.
//
// Sheet déclenché depuis la page rapport. Sections :
// - Comment lire le score (formule, pondération, sub-scores)
// - Glossaire (DPE, GES, rendement brut/net, cashflow, écart marché…)
// - Sources de données
// - FAQ (freemium, fraîcheur des données)

import { BookOpen, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function HelpDrawer({ triggerLabel = "Comment ça marche ?" }: { triggerLabel?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Comprendre ton rapport</SheetTitle>
          <SheetDescription>
            Comment on calcule les scores, ce que veulent dire les chiffres,
            et d'où viennent les données.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-8">
          {/* ───── Score total ───── */}
          <section>
            <SectionTitle>Le score sur 100</SectionTitle>
            <p className="text-[13.5px] leading-[1.65] text-secondary-foreground">
              Chaque bien reçoit un score de 0 à 100 qui combine 6
              dimensions, pondérées selon ta stratégie d'investissement
              (locatif nu, LMNP, courte durée…).
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-[12.5px] md:grid-cols-2">
              <Item label="Prix" detail="Écart par rapport au médian DVF de la commune." />
              <Item label="Rendement" detail="Rendement brut (loyer × 12 / prix)." />
              <Item label="Cashflow" detail="Solde mensuel après mensualité de crédit et charges." />
              <Item label="DPE" detail="Lettre énergie : A pénalise moins, F/G fortement (lois de 2025/28/34)." />
              <Item label="Quartier" detail="Revenus médians IRIS, équipements, transports." />
              <Item label="Risques" detail="PPRI, retrait argile, sismicité, radon, sols pollués." />
            </dl>
            <Verdicts />
          </section>

          {/* ───── Métriques financières ───── */}
          <section>
            <SectionTitle>Les métriques financières</SectionTitle>
            <dl className="space-y-3 text-[13px]">
              <Term name="Loyer estimé">
                Loyer mensuel attendu, basé sur les loyers signés de
                l'Observatoire Local des Loyers (OLL) pour ta zone et le
                nombre de pièces. C'est le loyer probable, pas un
                plafonnement réglementaire.
              </Term>
              <Term name="Rendement brut">
                <code className="font-mono">(loyer × 12) / prix d'achat</code>
                . Avant impôts et charges. Repère : 6 % en zone tendue est
                déjà bon, 8 %+ en zone détendue.
              </Term>
              <Term name="Rendement net">
                Brut moins taxe foncière, charges copropriété
                non-récupérables, gestion (~7 %), assurance PNO, vacance
                locative estimée. Avant impôts sur les revenus.
              </Term>
              <Term name="Cashflow mensuel">
                Loyer encaissé - (mensualité de crédit + charges + impôts
                estimés). Positif = ton patrimoine grandit sans toucher
                à ta trésorerie. Négatif = effort d'épargne mensuel.
              </Term>
              <Term name="Coût total acquisition">
                Prix + frais de notaire (~8 % pour l'ancien, ~3 % pour le
                neuf). C'est le vrai chèque à signer chez le notaire.
              </Term>
              <Term name="Écart vs marché">
                Différence entre le prix affiché et le médian DVF de la
                commune pour le même type de bien. -10 % = bien décoté
                vs marché, +15 % = au-dessus du marché.
              </Term>
            </dl>
          </section>

          {/* ───── Glossaire ───── */}
          <section>
            <SectionTitle>Glossaire</SectionTitle>
            <dl className="space-y-3 text-[13px]">
              <Term name="DPE">
                Diagnostic de Performance Énergétique. Lettre A à G qui
                évalue la consommation. F et G sont des "passoires
                thermiques" : interdites à la location (2025 pour G,
                2028 pour F, 2034 pour E). Décote possible 5-15 % à
                l'achat.
              </Term>
              <Term name="GES">
                Gaz à Effet de Serre. Note environnementale qui complète
                le DPE.
              </Term>
              <Term name="DVF">
                Demandes de Valeurs Foncières. Base publique du fisc
                listant toutes les ventes immobilières en France depuis
                2014. Source officielle pour le prix de marché.
              </Term>
              <Term name="IRIS">
                Découpage statistique INSEE en quartiers de ~2 000
                habitants. On utilise ça pour les revenus médians et le
                profil socio-démo plus fin que la commune.
              </Term>
              <Term name="PPRI">
                Plan de Prévention des Risques d'Inondation. Si une
                commune a un PPRI, certaines zones sont inconstructibles
                ou ont des contraintes (assurances plus chères, value à
                la revente).
              </Term>
              <Term name="TMI">
                Tranche Marginale d'Imposition. Le taux de ton dernier €
                imposé : 0, 11, 30, 41 ou 45 %. Détermine l'impact
                fiscal de tes revenus fonciers en locatif nu.
              </Term>
              <Term name="LMNP">
                Loueur en Meublé Non Professionnel. Statut fiscal pour
                louer en meublé. Permet d'amortir le bien et de réduire
                fortement l'imposition pendant 15-25 ans.
              </Term>
              <Term name="Cashflow">
                Solde mensuel net après toutes les charges. Le bien
                "s'auto-finance" si cashflow ≥ 0.
              </Term>
            </dl>
          </section>

          {/* ───── Sources de données ───── */}
          <section>
            <SectionTitle>D'où viennent les données ?</SectionTitle>
            <ul className="space-y-2 text-[13px] text-secondary-foreground">
              <Source name="Annonces" desc="SeLoger et Leboncoin, scrapées au moment où tu lances l'analyse." />
              <Source name="Prix marché" desc="DVF+ Cerema, mises à jour trimestrielles." />
              <Source name="Loyers" desc="Observatoires Locaux des Loyers (OLL) via data.gouv, annuel." />
              <Source name="DPE" desc="Base nationale ADEME, mise à jour mensuelle." />
              <Source name="Risques" desc="API Géorisques (PPRI, argile, sismicité, radon, sites pollués)." />
              <Source name="Socio-démo" desc="INSEE Filosofi (revenus) + IRIS (géographie statistique)." />
            </ul>
          </section>

          {/* ───── FAQ ───── */}
          <section>
            <SectionTitle>FAQ</SectionTitle>
            <dl className="space-y-3 text-[13px]">
              <Term name="Pourquoi certains biens ont leur prix masqué ?">
                Sur le plan Free, les biens à score ≥ 70 (le top 30 %)
                ont leur prix, adresse exacte et lien d'annonce masqués.
                C'est intentionnel : tu vois qu'il y a des opportunités,
                tu passes Pro pour y accéder. Free reste utile pour
                comprendre ton marché.
              </Term>
              <Term name="Pourquoi certains biens n'ont pas de note ?">
                Si la surface habitable n'est pas renseignée dans
                l'annonce (programmes neufs avec surface "à partir de"),
                on ne peut pas calculer le €/m² ni le rendement. On les
                garde dans le tableau mais sans score.
              </Term>
              <Term name="Le scoring se met-il à jour ?">
                Le score est figé au moment de l'analyse. Les paramètres
                financiers (apport, taux, TMI) sont snapshotés. Si tu
                changes tes paramètres dans ton profil, relance une
                analyse pour voir l'impact.
              </Term>
              <Term name="Combien de temps prend une analyse ?">
                5 à 10 minutes selon le volume d'annonces (≈100 à 500).
                Tu peux fermer l'onglet et revenir, ça continue côté
                serveur. Tu recevras un email quand c'est fini (à venir).
              </Term>
            </dl>
          </section>

          <div className="border-t border-border pt-5">
            <Button asChild variant="outline" size="sm">
              <a href="/methodologie" target="_blank" rel="noopener">
                Méthodologie détaillée
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </h3>
  );
}

function Item({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <dt className="font-medium">{label}</dt>
      <dd className="mt-0.5 text-[11.5px] text-muted-foreground">{detail}</dd>
    </div>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{name}</dt>
      <dd className="mt-0.5 leading-[1.55] text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}

function Source({ name, desc }: { name: string; desc: string }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
      <span>
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-muted-foreground"> · {desc}</span>
      </span>
    </li>
  );
}

function Verdicts() {
  return (
    <div className="mt-4 rounded-md border border-border bg-card p-3 text-[12px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Verdict
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          <span className="font-medium">À visiter</span>
          <span className="text-muted-foreground">— score ≥ 70</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-warning" />
          <span className="font-medium">Sous réserve</span>
          <span className="text-muted-foreground">— 50 ≤ score &lt; 70</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
          <span className="font-medium">No-go</span>
          <span className="text-muted-foreground">— score &lt; 50</span>
        </div>
      </div>
    </div>
  );
}
