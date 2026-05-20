// /confidentialite — placeholder PR1. La politique de confidentialité
// formelle sera rédigée en lien avec la mise en conformité RGPD.

import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-16">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Politique de confidentialité
      </span>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
        Confidentialité ImmoScan.
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-muted-foreground">
        Le texte légal complet RGPD sera publié avant l'ouverture des
        inscriptions payantes. En bref :
      </p>
      <ul className="mt-4 space-y-2 text-[14px] leading-[1.6] text-muted-foreground">
        <li>
          On ne vend pas tes données. Tes analyses restent privées par
          défaut (RLS Supabase, freemium teasing côté serveur).
        </li>
        <li>
          Sentry et PostHog reçoivent uniquement ton{" "}
          <code className="font-mono">user_id</code> UUID. Aucun email,
          aucune adresse, aucune IP ne quitte ton navigateur.
        </li>
        <li>
          Suppression de compte → suppression complète de tes données
          (cascade SQL). Demande à support@immoscan.fr (à venir).
        </li>
      </ul>
      <p className="mt-6 text-[13px]">
        <Link to="/" className="text-primary hover:underline">
          ← Retour à l'accueil
        </Link>
      </p>
    </div>
  );
}
