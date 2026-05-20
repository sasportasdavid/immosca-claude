// /legal/confidentialite — Politique de Confidentialité (RGPD)
//
// Conforme RGPD (UE 2016/679) + Loi Informatique et Libertés du 6 janvier 1978
// modifiée. À faire valider par un DPO/avocat avant launch.

import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/confidentialite")({
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de Confidentialité" lastUpdated="2026-05-20">
      <p>
        Cette politique décrit comment <strong>ImmoScan SAS</strong>{" "}
        (« ImmoScan », « nous ») collecte, utilise et protège les données
        personnelles des Utilisateurs de son service{" "}
        <a href="https://app.immoscan.fr">app.immoscan.fr</a>, conformément
        au Règlement Général sur la Protection des Données (RGPD, UE
        2016/679) et à la Loi Informatique et Libertés.
      </p>

      <h2>1. Responsable de traitement</h2>
      <p>
        ImmoScan SAS, dont les coordonnées figurent dans nos{" "}
        <a href="/legal/mentions-legales">Mentions Légales</a>, est le
        responsable du traitement des données personnelles collectées via
        le Service.
      </p>
      <p>
        Pour toute question relative à la protection de vos données ou pour
        exercer vos droits, contactez :{" "}
        <a href="mailto:privacy@immoscan.fr">privacy@immoscan.fr</a>.
      </p>

      <h2>2. Données collectées et finalités</h2>

      <h3>2.1 Données d'inscription et de compte</h3>
      <ul>
        <li>
          <strong>Adresse email</strong> (obligatoire) : authentification,
          envoi des digests veille, support
        </li>
        <li>
          <strong>Prénom / nom</strong> (optionnel) : personnalisation des
          emails
        </li>
        <li>
          <strong>Mot de passe</strong> (haché via bcrypt côté Supabase
          Auth) : authentification
        </li>
      </ul>
      <p>
        <em>Base légale : exécution du contrat (CGU) — art. 6.1.b RGPD</em>
      </p>

      <h3>2.2 Données d'investissement (paramètres)</h3>
      <ul>
        <li>
          Stratégie (locatif nu / LMNP / colocation / etc.), apport, taux de
          crédit, TMI, rendement minimum, tolérance aux travaux
        </li>
      </ul>
      <p>
        Ces données sont stockées exclusivement dans le but de générer vos
        analyses personnalisées et ne sont jamais partagées avec des tiers
        à des fins commerciales.
      </p>
      <p>
        <em>Base légale : exécution du contrat</em>
      </p>

      <h3>2.3 Données de paiement</h3>
      <p>
        Les informations de carte bancaire sont collectées et stockées
        exclusivement par notre prestataire de paiement{" "}
        <strong>Stripe</strong> (conforme PCI DSS). ImmoScan ne conserve que
        l'identifiant client Stripe (`stripe_customer_id`) et l'historique
        des abonnements (plan, statut, dates).
      </p>
      <p>
        <em>Base légale : exécution du contrat + obligation légale (comptabilité)</em>
      </p>

      <h3>2.4 Données d'usage et de navigation</h3>
      <ul>
        <li>Pages visitées, fonctionnalités utilisées (anonymisé)</li>
        <li>
          Adresse IP (utilisée pour la sécurité, non géolocalisée chez
          PostHog : option <code>ip: false</code>)
        </li>
        <li>Type de navigateur, langue préférée</li>
      </ul>
      <p>
        <em>
          Base légale : intérêt légitime (amélioration du Service, prévention
          fraude) — art. 6.1.f RGPD
        </em>
      </p>

      <h3>2.5 Données métier liées au Service</h3>
      <ul>
        <li>
          URLs de recherche enregistrées dans vos veilles (publiques par
          nature)
        </li>
        <li>
          Annonces immobilières scrapées et leur scoring (données issues de
          sources publiques)
        </li>
        <li>Items du pipeline Kanban (notes personnelles)</li>
      </ul>

      <h2>3. Sous-traitants</h2>
      <p>
        ImmoScan a recours aux sous-traitants suivants, tous engagés
        contractuellement au respect du RGPD :
      </p>
      <table>
        <thead>
          <tr>
            <th>Prestataire</th>
            <th>Finalité</th>
            <th>Localisation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Base de données + authentification</td>
            <td>UE (eu-west-3 / Paris)</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hébergement frontend</td>
            <td>Europe (Paris / Francfort)</td>
          </tr>
          <tr>
            <td>Trigger.dev</td>
            <td>Exécution des tâches d'analyse et veille</td>
            <td>États-Unis (clauses contractuelles types)</td>
          </tr>
          <tr>
            <td>Apify</td>
            <td>Scraping des annonces publiques</td>
            <td>UE (République Tchèque)</td>
          </tr>
          <tr>
            <td>Anthropic</td>
            <td>Génération des thèses Claude</td>
            <td>États-Unis (clauses contractuelles types)</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Paiement et facturation</td>
            <td>Irlande (UE)</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Emails transactionnels (digests, expiration)</td>
            <td>États-Unis (clauses contractuelles types)</td>
          </tr>
          <tr>
            <td>Sentry</td>
            <td>Monitoring erreurs (sans PII)</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>PostHog</td>
            <td>Analytics produit (région UE)</td>
            <td>Allemagne (eu.posthog.com)</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Durée de conservation</h2>
      <ul>
        <li>
          <strong>Compte actif</strong> : tant que vous utilisez le Service
        </li>
        <li>
          <strong>Compte inactif</strong> : suppression automatique après
          24 mois d'inactivité (préavis email à 30 jours)
        </li>
        <li>
          <strong>Données de facturation</strong> : 10 ans (obligation
          comptable légale)
        </li>
        <li>
          <strong>Logs techniques (Sentry, PostHog)</strong> : 90 jours
        </li>
        <li>
          <strong>Cache scraping (annonces)</strong> : 7 jours pour les
          détails, 24h pour les recherches
        </li>
        <li>
          <strong>watch_listings non pipeline</strong> : purge automatique
          au bout de 6 mois (cron `watch-purge`)
        </li>
      </ul>

      <h2>5. Vos droits (RGPD)</h2>
      <p>
        Vous disposez, conformément aux articles 15 à 22 du RGPD, des droits
        suivants :
      </p>
      <ul>
        <li>
          <strong>Droit d'accès</strong> : obtenir une copie de vos données
        </li>
        <li>
          <strong>Droit de rectification</strong> : corriger les données
          inexactes
        </li>
        <li>
          <strong>Droit à l'effacement</strong> (« droit à l'oubli ») :
          supprimer votre compte et vos données
        </li>
        <li>
          <strong>Droit à la portabilité</strong> : recevoir vos données dans
          un format structuré (JSON)
        </li>
        <li>
          <strong>Droit d'opposition</strong> au traitement
        </li>
        <li>
          <strong>Droit à la limitation</strong> du traitement
        </li>
      </ul>
      <p>
        Pour exercer ces droits, envoyez une demande à{" "}
        <a href="mailto:privacy@immoscan.fr">privacy@immoscan.fr</a>. Une
        réponse vous sera apportée sous 1 mois maximum.
      </p>
      <p>
        Vous disposez également du droit d'introduire une réclamation auprès
        de la <strong>CNIL</strong> (Commission Nationale de l'Informatique
        et des Libertés) : 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex
        07, <a href="https://www.cnil.fr">www.cnil.fr</a>.
      </p>

      <h2>6. Cookies et traceurs</h2>
      <p>
        ImmoScan utilise un nombre limité de cookies, tous nécessaires au
        fonctionnement du Service :
      </p>
      <ul>
        <li>
          <strong>Cookies d'authentification</strong> (Supabase) : maintien
          de session
        </li>
        <li>
          <strong>Cookies analytiques anonymisés</strong> (PostHog EU, sans
          IP, sans session replay) : amélioration du Service. Vous pouvez les
          désactiver via l'option « Do Not Track » de votre navigateur — nous
          la respectons (<code>respect_dnt: true</code>).
        </li>
      </ul>
      <p>
        <strong>Aucun cookie publicitaire ou de tracking tiers n'est
        déposé.</strong>
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Nous mettons en œuvre les mesures techniques et organisationnelles
        appropriées pour protéger vos données :
      </p>
      <ul>
        <li>Chiffrement TLS 1.3 pour tous les échanges</li>
        <li>Chiffrement au repos de la base de données Supabase</li>
        <li>
          Politique Row Level Security (RLS) sur toutes les tables : un
          utilisateur ne peut accéder qu'à ses propres données
        </li>
        <li>Mots de passe hachés (bcrypt)</li>
        <li>Logs sans PII (politique <code>beforeSend</code> Sentry)</li>
        <li>Sauvegardes quotidiennes de la base de données</li>
      </ul>

      <h2>8. Transferts hors UE</h2>
      <p>
        Certains de nos sous-traitants (Trigger.dev, Anthropic, Resend,
        Sentry) sont situés aux États-Unis. Les transferts sont encadrés par
        les <strong>Clauses Contractuelles Types</strong> approuvées par la
        Commission Européenne (art. 46 RGPD).
      </p>

      <h2>9. Modification de la politique</h2>
      <p>
        Toute modification substantielle de cette politique sera notifiée par
        email aux utilisateurs avec un préavis minimum de 30 jours.
      </p>
    </LegalPage>
  );
}
