// /legal/mentions-legales — Mentions Légales
//
// Conforme article 6 LCEN (Loi pour la Confiance dans l'Économie Numérique).
//
// Les valeurs ci-dessous sont des placeholders à remplacer par les vraies
// coordonnées de la société (raison sociale, SIRET, RCS, capital, etc.)
// avant le launch public.

import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/mentions-legales")({
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions Légales" lastUpdated="2026-05-20">
      <h2>Éditeur du Service</h2>
      <p>
        Le service ImmoScan accessible à l'adresse{" "}
        <a href="https://app.immoscan.fr">app.immoscan.fr</a> est édité par :
      </p>
      <ul>
        <li>
          <strong>Raison sociale</strong> : ImmoScan SAS
        </li>
        <li>
          <strong>Forme juridique</strong> : Société par Actions Simplifiée
        </li>
        <li>
          <strong>Capital social</strong> : [à compléter]
        </li>
        <li>
          <strong>Siège social</strong> : [adresse à compléter]
        </li>
        <li>
          <strong>SIRET</strong> : [à compléter]
        </li>
        <li>
          <strong>RCS</strong> : [à compléter]
        </li>
        <li>
          <strong>TVA intracommunautaire</strong> : [à compléter]
        </li>
        <li>
          <strong>Directeur de la publication</strong> : [Nom du dirigeant]
        </li>
      </ul>

      <h2>Contact</h2>
      <ul>
        <li>
          <strong>Email général</strong> :{" "}
          <a href="mailto:hello@immoscan.fr">hello@immoscan.fr</a>
        </li>
        <li>
          <strong>Email facturation</strong> :{" "}
          <a href="mailto:facturation@immoscan.fr">facturation@immoscan.fr</a>
        </li>
        <li>
          <strong>Email RGPD / privacy</strong> :{" "}
          <a href="mailto:privacy@immoscan.fr">privacy@immoscan.fr</a>
        </li>
      </ul>

      <h2>Hébergement</h2>
      <ul>
        <li>
          <strong>Frontend (web)</strong> : Vercel Inc., 340 S Lemon Ave
          #4133, Walnut, CA 91789, États-Unis —{" "}
          <a href="https://vercel.com">vercel.com</a>
        </li>
        <li>
          <strong>Backend (base de données + auth)</strong> : Supabase,
          970 Toa Payoh North #07-04 Singapore 318992 — région UE eu-west-3
          (Paris) — <a href="https://supabase.com">supabase.com</a>
        </li>
        <li>
          <strong>Workers (tâches longues)</strong> : Trigger.dev Inc., États-Unis
        </li>
      </ul>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble du site et de ses contenus (textes, graphismes,
        algorithmes, base de données, code source) est protégé par les
        dispositions du Code de la Propriété Intellectuelle. Toute
        reproduction, représentation, modification, adaptation ou
        exploitation, totale ou partielle, par quelque procédé que ce soit,
        sans l'autorisation expresse d'ImmoScan SAS est strictement interdite
        et constituerait un acte de contrefaçon.
      </p>

      <h2>Médiation de la consommation</h2>
      <p>
        Conformément aux articles L611-1 et suivants du Code de la
        consommation, tout consommateur a le droit de recourir gratuitement à
        un médiateur de la consommation en cas de litige avec ImmoScan.
      </p>
      <p>
        Médiateur désigné : <strong>[à désigner avant launch]</strong> (par
        exemple : Médiation de la Consommation — Centre de Médiation et
        d'Arbitrage de Paris (CMAP),{" "}
        <a href="https://www.cmap.fr">www.cmap.fr</a>).
      </p>
      <p>
        Pour les litiges transfrontaliers, l'Utilisateur peut également
        utiliser la plateforme de Règlement en Ligne des Litiges (RLL) de la
        Commission Européenne :{" "}
        <a href="https://ec.europa.eu/consumers/odr/">
          ec.europa.eu/consumers/odr
        </a>
        .
      </p>

      <h2>Crédits</h2>
      <p>
        Sources de données publiques utilisées (avec respect des licences) :
      </p>
      <ul>
        <li>
          DVF+ — Cerema (Licence Ouverte 2.0) —{" "}
          <a href="https://files.data.gouv.fr/geo-dvf/">geo-dvf data.gouv.fr</a>
        </li>
        <li>
          INSEE Filosofi & IRIS (Licence Ouverte 2.0) —{" "}
          <a href="https://www.insee.fr/">insee.fr</a>
        </li>
        <li>
          ADEME — Diagnostics de Performance Énergétique (Licence Ouverte) —{" "}
          <a href="https://data.ademe.fr/datasets/dpe">ADEME open data</a>
        </li>
        <li>
          Géorisques — Ministère de la Transition Écologique (Licence
          Ouverte) — <a href="https://www.georisques.gouv.fr/">georisques.gouv.fr</a>
        </li>
        <li>
          BAN — Base Adresse Nationale (Licence Ouverte 2.0) —{" "}
          <a href="https://adresse.data.gouv.fr/">adresse.data.gouv.fr</a>
        </li>
        <li>
          OLL — Observatoires Locaux des Loyers (Licence Ouverte) — relayé via{" "}
          <a href="https://www.data.gouv.fr/">data.gouv.fr</a>
        </li>
      </ul>
    </LegalPage>
  );
}
