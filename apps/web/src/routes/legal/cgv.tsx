// /legal/cgv — Conditions Générales de Vente
//
// Contraintes spécifiques au modèle hybride credits + abonnement :
//   - PPU one-shot (analyses à l'unité)
//   - Abonnements recurring (Pro, Pro+, Business)
//   - Add-ons recurring (veilles supplémentaires, seats)
//   - Mécaniques d'expiration / suspension / réactivation

import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/cgv")({
  component: CgvPage,
});

function CgvPage() {
  return (
    <LegalPage title="Conditions Générales de Vente" lastUpdated="2026-05-20">
      <h2>1. Champ d'application</h2>
      <p>
        Les présentes Conditions Générales de Vente (« CGV ») s'appliquent à
        toute commande d'un produit ou service payant proposé par ImmoScan
        SAS (« ImmoScan ») via la plateforme accessible à l'adresse{" "}
        <a href="https://app.immoscan.fr">app.immoscan.fr</a>.
      </p>
      <p>
        Toute commande implique l'acceptation sans réserve des présentes CGV,
        des <a href="/legal/cgu">CGU</a> et de la{" "}
        <a href="/legal/confidentialite">Politique de Confidentialité</a>.
      </p>

      <h2>2. Catalogue et prix</h2>

      <h3>2.1 Analyses Pay-per-use (PPU)</h3>
      <p>
        Achat ponctuel d'une analyse complète au prix unitaire de{" "}
        <strong>14,90 €</strong> TTC. Inclut :
      </p>
      <ul>
        <li>1 analyse de jusqu'à 300 biens immobiliers</li>
        <li>Top 10 généré par IA Claude Sonnet</li>
        <li>
          1 veille bonus de 30 jours sur le périmètre de l'analyse, sans
          floutage
        </li>
        <li>Accès en lecture seule à l'analyse pendant 90 jours</li>
      </ul>

      <h3>2.2 Abonnements récurrents</h3>
      <table>
        <thead>
          <tr>
            <th>Palier</th>
            <th>Mensuel</th>
            <th>Annuel (équiv. /mois)</th>
            <th>Analyses</th>
            <th>Veilles</th>
            <th>Essai gratuit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pro</td>
            <td>39 €</td>
            <td>390 € (32,50 €)</td>
            <td>10/mois</td>
            <td>3 × 3/sem</td>
            <td>7 jours sans CB</td>
          </tr>
          <tr>
            <td>Pro+</td>
            <td>99 €</td>
            <td>990 € (82,50 €)</td>
            <td>25/mois</td>
            <td>6 × 3/sem</td>
            <td>7 jours sans CB</td>
          </tr>
          <tr>
            <td>Business</td>
            <td>449 €</td>
            <td>4 490 € (374 €)</td>
            <td>80/mois</td>
            <td>15 daily</td>
            <td>Démo sur demande</td>
          </tr>
        </tbody>
      </table>
      <p>
        Tous les prix sont indiqués en euros TTC. Au-delà du quota inclus
        (« overage »), les analyses supplémentaires sont facturées au tarif
        de 5 € (Pro), 4 € (Pro+) ou 3 € (Business) par analyse.
      </p>

      <h3>2.3 Add-ons recurring</h3>
      <ul>
        <li>
          <strong>Veille additionnelle 3×/sem</strong> : 7 €/mois (Pro, Pro+)
        </li>
        <li>
          <strong>Pack 3 veilles 3×/sem</strong> : 19 €/mois (Pro, Pro+)
        </li>
        <li>
          <strong>Veille additionnelle quotidienne</strong> : 19 €/mois
          (Business)
        </li>
        <li>
          <strong>Pack 3 veilles quotidiennes</strong> : 49 €/mois (Business)
        </li>
        <li>
          <strong>Seat supplémentaire</strong> : 30 €/mois (Business — V1.5,
          arrive Q3 2026)
        </li>
      </ul>

      <h2>3. Commande et paiement</h2>
      <p>
        Le paiement s'effectue exclusivement en ligne par carte bancaire via
        notre prestataire <strong>Stripe</strong> (Stripe Inc., conforme PCI
        DSS). ImmoScan ne stocke aucune donnée de carte bancaire en clair.
      </p>
      <p>
        Pour les <strong>abonnements</strong>, le paiement est automatique
        au cycle : mensuel ou annuel selon l'option choisie. Le premier
        prélèvement intervient à la fin de la période d'essai gratuit pour
        les paliers Pro et Pro+, ou immédiatement en l'absence d'essai.
      </p>
      <p>
        Pour les <strong>achats PPU</strong>, le paiement est unique et
        immédiat. L'analyse est créditée sur le compte dès confirmation du
        paiement.
      </p>

      <h2>4. Annulation et droit de rétractation</h2>

      <h3>4.1 Pendant la période d'essai gratuit (Pro / Pro+)</h3>
      <p>
        L'annulation est <strong>libre et gratuite</strong> à tout moment
        pendant les 7 jours d'essai sans CB. Aucune carte n'a été enregistrée,
        aucune somme n'est due.
      </p>

      <h3>4.2 Annulation d'un abonnement payant en cours</h3>
      <p>
        L'Utilisateur peut résilier son abonnement à tout moment depuis le
        portail Stripe accessible via{" "}
        <a href="https://app.immoscan.fr/app/billing">app.immoscan.fr/app/billing</a>.
        La résiliation prend effet à la fin de la période en cours déjà
        facturée. Les sommes déjà perçues ne sont pas remboursées au prorata.
      </p>
      <p>
        À la fin de la période, l'Utilisateur conserve un accès en lecture
        seule à ses rapports historiques pendant 90 jours. Les veilles
        actives sont suspendues immédiatement.
      </p>

      <h3>4.3 Droit de rétractation pour les achats one-shot (PPU)</h3>
      <p>
        Conformément à l'article L221-28 13° du Code de la consommation, le
        droit de rétractation ne peut être exercé pour les contenus
        numériques fournis sur un support immatériel <strong>dès lors que
        leur exécution a commencé avec l'accord exprès du consommateur et
        renoncement à son droit de rétractation</strong>.
      </p>
      <p>
        L'analyse PPU étant déclenchée et générée immédiatement après l'achat
        (≤ 8 minutes), l'Utilisateur reconnaît expressément que l'exécution
        commence dès la confirmation de la commande et renonce à son droit
        de rétractation pour ce produit.
      </p>

      <h3>4.4 Cas exceptionnels de remboursement</h3>
      <p>
        En cas de défaillance technique du Service entraînant une
        impossibilité totale de générer le rapport PPU dans les 24h après
        achat, ImmoScan procédera au remboursement intégral sur demande
        écrite à <a href="mailto:hello@immoscan.fr">hello@immoscan.fr</a>.
      </p>

      <h2>5. Modification du plan en cours d'abonnement</h2>
      <p>
        L'Utilisateur peut à tout moment passer à un palier supérieur
        (upgrade) ou inférieur (downgrade) depuis le portail Stripe. Les
        changements prennent effet :
      </p>
      <ul>
        <li>
          <strong>Upgrade</strong> : immédiatement, avec ajustement au prorata
          des sommes déjà versées
        </li>
        <li>
          <strong>Downgrade</strong> : à la fin du cycle en cours (l'accès
          aux fonctionnalités supérieures reste actif jusqu'à cette date)
        </li>
      </ul>

      <h2>6. Facturation</h2>
      <p>
        Une facture est émise automatiquement pour chaque transaction et
        rendue disponible dans le portail Stripe. Sur demande, une facture
        PDF nominative peut être envoyée à
        <a href="mailto:facturation@immoscan.fr"> facturation@immoscan.fr</a>.
      </p>
      <p>
        Pour les comptes Business à usage professionnel, les factures
        incluent les mentions légales B2B requises (TVA intracommunautaire si
        applicable).
      </p>

      <h2>7. Prix et révision tarifaire</h2>
      <p>
        Les prix indiqués peuvent être révisés. Toute modification tarifaire
        affectera uniquement les nouveaux abonnements ou renouvellements
        postérieurs à sa date d'entrée en vigueur, sauf préavis explicite
        de 30 jours notifié par email aux abonnés en cours.
      </p>

      <h2>8. Service après-vente</h2>
      <p>
        Pour toute question relative à votre commande, votre facturation ou
        une demande de remboursement :
      </p>
      <ul>
        <li>
          Email :{" "}
          <a href="mailto:hello@immoscan.fr">hello@immoscan.fr</a>
        </li>
        <li>Délai de réponse : J+2 pour Free/PPU, J+1 pour Pro et Pro+, prioritaire pour Business</li>
      </ul>

      <h2>9. Loi applicable</h2>
      <p>
        Les présentes CGV sont régies par le droit français. Tout litige
        sera soumis aux tribunaux compétents conformément aux dispositions
        du Code de procédure civile.
      </p>
    </LegalPage>
  );
}
