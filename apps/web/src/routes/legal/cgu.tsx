// /legal/cgu — Conditions Générales d'Utilisation
//
// Contenu rédigé conformément au droit français (Code de la consommation
// L221-1 et suivants, RGPD, LCEN). À faire valider par un avocat avant
// le launch public définitif.

import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/cgu")({
  component: CguPage,
});

function CguPage() {
  return (
    <LegalPage title="Conditions Générales d'Utilisation" lastUpdated="2026-05-20">
      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d'Utilisation (« CGU ») régissent
        l'accès et l'utilisation de la plateforme ImmoScan (le « Service »),
        éditée par <strong>ImmoScan SAS</strong> (« nous », « la société »),
        à toute personne créant un compte (« Utilisateur », « vous »).
      </p>
      <p>
        En créant un compte, vous reconnaissez avoir lu, compris et accepté
        sans réserve les présentes CGU ainsi que la{" "}
        <a href="/legal/confidentialite">Politique de Confidentialité</a> et,
        si vous souscrivez à une offre payante, les{" "}
        <a href="/legal/cgv">Conditions Générales de Vente</a>.
      </p>

      <h2>2. Description du Service</h2>
      <p>
        ImmoScan est un outil SaaS d'aide à l'analyse d'investissement
        immobilier. Il agrège des annonces immobilières publiques (SeLoger,
        Leboncoin, PAP, Bien'ici), les croise avec des bases de données
        publiques (DVF Cerema, INSEE, ADEME, Géorisques, BAN, OLL) et génère
        des rapports d'analyse + des veilles automatisées.
      </p>
      <p>
        <strong>
          ImmoScan ne fournit aucun conseil en investissement financier,
          fiscal ou juridique.
        </strong>{" "}
        Les scores, thèses et signaux produits sont des aides à la décision,
        à valider impérativement par l'Utilisateur auprès des professionnels
        compétents (notaire, expert immobilier, conseiller fiscal).
      </p>

      <h2>3. Création de compte</h2>
      <p>
        L'accès au Service nécessite la création d'un compte avec une adresse
        email valide. L'Utilisateur s'engage à :
      </p>
      <ul>
        <li>Fournir des informations exactes lors de l'inscription</li>
        <li>
          Maintenir confidentiels ses identifiants ; toute action effectuée
          depuis son compte est réputée effectuée par lui
        </li>
        <li>
          Notifier ImmoScan en cas d'usage frauduleux de son compte par email
          à <a href="mailto:hello@immoscan.fr">hello@immoscan.fr</a>
        </li>
      </ul>

      <h2>4. Offres et accès</h2>
      <p>
        Le Service est proposé via 5 paliers d'accès :
      </p>
      <ul>
        <li>
          <strong>Free</strong> : gratuit, 1 analyse/mois, 1 veille 60 jours
          floutée (les biens de score ≥70 sont masqués).
        </li>
        <li>
          <strong>Pay-per-use (PPU)</strong> : 14,90 € l'analyse, débloque
          1 analyse complète + 1 veille bonus 30 jours non floutée.
        </li>
        <li>
          <strong>Pro</strong> : 39 €/mois (ou 390 €/an), 10 analyses,
          3 veilles, 7 jours d'essai gratuit sans carte bancaire.
        </li>
        <li>
          <strong>Pro+</strong> : 99 €/mois (ou 990 €/an), 25 analyses,
          6 veilles, Top 5 généré par Claude Opus, 7 jours d'essai gratuit.
        </li>
        <li>
          <strong>Business</strong> : 449 €/mois (ou 4 490 €/an), 80 analyses,
          15 veilles quotidiennes, démo personnalisée sur demande. La
          fonctionnalité multi-utilisateurs (jusqu'à 3 collaborateurs) est
          prévue pour Q3 2026.
        </li>
      </ul>
      <p>
        Le détail tarifaire et les fonctionnalités sont décrits sur la page
        "Plan & facturation" du Service et dans nos{" "}
        <a href="/legal/cgv">CGV</a>.
      </p>

      <h2>5. Veilles : mécaniques d'expiration</h2>
      <p>
        Les veilles sont des recherches automatisées exécutées :
      </p>
      <ul>
        <li>3 fois par semaine pour Free / PPU / Pro / Pro+</li>
        <li>Quotidiennement pour Business</li>
      </ul>
      <p>
        Les veilles des paliers <strong>Free et PPU</strong> ont une durée
        limitée :
      </p>
      <ul>
        <li>
          <strong>Veille Free</strong> : 60 jours à compter de sa création.
          Emails de rappel à J-10 et J-3. À expiration, la veille est{" "}
          <strong>suspendue</strong> (et non supprimée) ; l'historique reste
          accessible et la veille peut être réactivée en passant Pro.
        </li>
        <li>
          <strong>Veille bonus PPU</strong> : 30 jours à compter de l'achat
          PPU. Emails de rappel à J-7 et J-2. Même mécanique de suspension.
        </li>
      </ul>
      <p>
        Les veilles des abonnements Pro, Pro+ et Business restent actives
        tant que l'abonnement est en cours et payé.
      </p>

      <h2>6. Cas particulier : annulation d'abonnement payant</h2>
      <p>
        En cas d'annulation d'un abonnement payant (Pro, Pro+, Business)
        depuis le portail Stripe, l'Utilisateur conserve un accès en{" "}
        <strong>lecture seule</strong> pendant 90 jours à ses rapports
        d'analyses historiques. Les veilles sont suspendues immédiatement.
        Au-delà de 90 jours, les données sont archivées et conservées
        conformément à la <a href="/legal/confidentialite">Politique de
        Confidentialité</a>.
      </p>

      <h2>7. Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments du Service (algorithmes de scoring, design,
        thèses générées par IA, templates de rapport) reste la propriété
        exclusive d'ImmoScan SAS. Les annonces affichées restent la
        propriété de leurs sources respectives (SeLoger, Leboncoin, etc.) ;
        ImmoScan opère un usage agrégatif autorisé par la loi française
        relative aux données publiquement accessibles.
      </p>
      <p>
        L'Utilisateur dispose d'un droit d'usage personnel et professionnel
        des rapports générés pour son compte. La revente, la republication
        publique ou l'usage commercial dérivé sont interdits sans accord
        écrit préalable.
      </p>

      <h2>8. Obligations de l'Utilisateur</h2>
      <p>L'Utilisateur s'engage à ne pas :</p>
      <ul>
        <li>
          Contourner les limites techniques du Service (caps d'analyses,
          floutage Free, etc.)
        </li>
        <li>
          Utiliser le Service à des fins illégales, frauduleuses ou nuisibles
          à des tiers
        </li>
        <li>
          Tenter d'extraire massivement les données du Service par scraping
          ou tout autre moyen
        </li>
        <li>
          Partager son compte avec un tiers (sauf dans le cadre Business
          multi-utilisateurs, à venir Q3 2026)
        </li>
      </ul>

      <h2>9. Disponibilité du Service</h2>
      <p>
        Nous nous efforçons de maintenir le Service disponible 24h/24, 7j/7,
        mais ne garantissons pas une disponibilité absolue. Des interruptions
        pour maintenance, mise à jour ou cas de force majeure peuvent
        survenir. Ces interruptions ne donnent pas droit à indemnité.
      </p>

      <h2>10. Responsabilité</h2>
      <p>
        Le Service est fourni « en l'état ». ImmoScan ne saurait être tenu
        responsable des décisions d'investissement prises par les
        Utilisateurs sur la base des analyses générées. Les chiffres affichés
        (rendements, scores, médians DVF) sont des estimations indicatives,
        soumises aux limitations des sources de données publiques.
      </p>
      <p>
        En cas de défaillance imputable à ImmoScan, sa responsabilité est
        plafonnée au montant des sommes effectivement versées par
        l'Utilisateur au cours des 12 derniers mois.
      </p>

      <h2>11. Modification des CGU</h2>
      <p>
        Nous nous réservons le droit de modifier les présentes CGU. Toute
        modification substantielle sera notifiée par email avec un préavis
        minimum de 30 jours. La poursuite de l'utilisation du Service après
        ce délai vaut acceptation des nouvelles CGU.
      </p>

      <h2>12. Loi applicable et litiges</h2>
      <p>
        Les présentes CGU sont régies par le droit français. Tout litige
        relatif à leur interprétation ou exécution sera, à défaut de
        résolution amiable, soumis aux tribunaux compétents du ressort du
        siège social d'ImmoScan SAS.
      </p>
      <p>
        Conformément aux articles L611-1 et suivants du Code de la
        consommation, l'Utilisateur consommateur peut recourir gratuitement
        à un médiateur de la consommation. Les coordonnées du médiateur sont
        disponibles dans nos <a href="/legal/mentions-legales">Mentions
        Légales</a>.
      </p>
    </LegalPage>
  );
}
