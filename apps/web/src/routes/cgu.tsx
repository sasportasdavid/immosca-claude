// /cgu — placeholder PR1. Le contenu légal réel sera rédigé par un
// juriste et déposé en PR ultérieure.

import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cgu")({
  component: CguPage,
});

function CguPage() {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-16">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Conditions générales d'utilisation
      </span>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
        CGU ImmoScan.
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-muted-foreground">
        Le texte légal complet sera publié avant l'ouverture des
        inscriptions payantes. Pour la version bêta, l'utilisation de
        l'outil vaut acceptation tacite : ImmoScan est un outil d'aide à
        la décision, ne remplace pas un conseil professionnel, et les
        données restent ta propriété.
      </p>
      <p className="mt-6 text-[13px]">
        <Link to="/" className="text-primary hover:underline">
          ← Retour à l'accueil
        </Link>
      </p>
    </div>
  );
}
