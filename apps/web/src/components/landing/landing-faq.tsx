// Section FAQ — accordéon natif <details>, deux colonnes.

export function LandingFaq() {
  return (
    <section
      id="faq"
      className="relative px-6 py-24 md:px-8 md:py-32"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-16 z-0 font-serif italic leading-none tracking-[-0.04em] text-bg-2 md:right-8"
        style={{ fontSize: "156px" }}
      >
        04
      </span>

      <div className="relative z-10 mx-auto max-w-[1280px]">
        <div className="mb-14 grid items-end gap-14 md:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 flex items-center gap-4 mono text-[11px] font-medium uppercase tracking-[0.24em] text-mute-2">
              <span className="h-px w-6 bg-ink" />
              <span className="font-bold text-violet">04</span> FAQ
              <span className="h-px w-6 bg-ink" />
            </div>
            <h2
              className="m-0 font-serif text-[clamp(48px,6vw,76px)] font-normal leading-[0.98] tracking-[-0.025em]"
              style={{ textWrap: "balance" }}
            >
              Questions <span className="italic text-violet">qu'on nous pose souvent.</span>
            </h2>
          </div>
          <div>
            <p
              className="m-0 max-w-[38ch] text-[15px] leading-[1.55] text-muted-ink"
              style={{ textWrap: "pretty" }}
            >
              Les sources, l'URL à coller, l'indice de confiance, le masquage freemium — toutes les questions récurrentes, répondues en clair.
            </p>
            <a
              href="mailto:hello@immoscan.fr"
              className="mt-3 inline-flex items-center gap-1.5 mono text-[11px] font-bold uppercase tracking-[0.1em] text-violet"
            >
              <span className="h-[5px] w-[5px] rounded-full bg-violet" />
              Autre question&nbsp;? Écris-nous
            </a>
          </div>
        </div>

        <div className="grid border-t border-ink md:grid-cols-2 md:gap-x-14">
          <div>
            <FaqItem
              defaultOpen
              q="D'où viennent les données ?"
              a={
                <>
                  Annonces&nbsp;: SeLoger, Le Bon Coin, PAP, Bien'ici, Logic-immo (collecte respectueuse des conditions de chaque plateforme). Données croisées&nbsp;:{" "}
                  <strong className="text-ink-2">DVF</strong> (demandes de valeurs foncières publiques),{" "}
                  <strong className="text-ink-2">ADEME</strong> pour les DPE officiels,{" "}
                  <strong className="text-ink-2">Géorisques</strong> pour inondation/retrait-gonflement/sismique,{" "}
                  <strong className="text-ink-2">IGN/INSEE</strong> pour la géolocalisation.
                </>
              }
            />
            <FaqItem
              q="L'URL à coller, c'est laquelle ?"
              a={
                <>
                  Va sur SeLoger, Le Bon Coin, PAP ou Bien'ici, fais ta recherche habituelle (ville, prix, surface…), puis copie l'URL de la{" "}
                  <strong className="text-ink-2">page de résultats</strong> — pas l'URL d'une annonce individuelle. André récupère alors tous les biens correspondants, sans limite.
                </>
              }
            />
            <FaqItem
              q="Le score d'André, c'est quoi exactement ?"
              a={
                <>
                  Une note de 0 à 100, pondérée sur 6 critères&nbsp;: prix vs marché, rendement, cashflow, DPE/GES, quartier, risques. La pondération s'adapte à ta stratégie (locatif nu, mixte, flip, viager). Le détail est toujours visible — pas une boîte noire.
                </>
              }
            />
            <FaqItem
              q="Comment André retrouve l'adresse exacte ?"
              a={
                <>
                  Croisement entre les caractéristiques de l'annonce (surface, DPE, étage) et le fichier officiel DPE ADEME, complété par un reverse-BAN. Chaque adresse arrive avec un{" "}
                  <strong className="text-ink-2">indice de confiance</strong>&nbsp;: adresse confirmée (71 %), rue à proximité (23 %), approximation au quartier (6 %).
                </>
              }
            />
          </div>
          <div>
            <FaqItem
              q="Pourquoi masquer prix et adresses en Free ?"
              a={
                <>
                  Pour t'éviter de faire des analyses gratuites et démarcher les vendeurs sans passer Pro. En Free, tu vois le score, le verdict et les critères de chaque bien — assez pour comprendre la valeur. Les biens avec score &gt; 70 (les bonnes affaires) ont prix, adresse et thèse masqués.
                </>
              }
            />
            <FaqItem
              q="Combien de temps prend une analyse ?"
              a={
                <>
                  Entre 4 et 12 minutes selon la zone et le nombre de biens. Quatre étapes&nbsp;: collecte des annonces, enrichissement (DVF, DPE, Géorisques, adresse exacte), scoring, génération du Top 5 par André. Tu vois la progression en direct, et tu peux fermer l'onglet — on t'envoie une notif.
                </>
              }
            />
            <FaqItem
              q="Mes paramètres financiers, comment ça marche ?"
              a={
                <>
                  Tu renseignes une fois apport, taux, durée, TMI et rendement minimum. Tous les biens sont simulés avec tes paramètres&nbsp;: mensualités, cashflow, rendement net après impôts. Tu peux les modifier à tout moment dans le simulateur «&nbsp;et si&nbsp;?&nbsp;» de chaque bien.
                </>
              }
            />
            <FaqItem
              q="Puis-je annuler ?"
              a={
                <>
                  Oui, à tout moment depuis ton compte. Pas de carte requise sur l'essai 7 jours. Si tu arrêtes après l'essai, ton compte passe en Découverte (Free) — tes analyses passées restent accessibles en lecture.
                </>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-line py-6 [&[open]]:pb-7"
    >
      <summary
        className="flex cursor-pointer list-none items-start justify-between gap-4 font-serif text-[21px] italic font-medium leading-[1.25] tracking-[-0.015em] text-ink [&::-webkit-details-marker]:hidden"
        style={{ textWrap: "pretty" }}
      >
        <span>{q}</span>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-[26px] leading-none mono text-violet transition-all group-open:bg-violet group-open:text-white group-open:border-violet"
        >
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <p className="mt-4 max-w-[54ch] text-[14px] leading-[1.65] text-muted-ink" style={{ textWrap: "pretty" }}>
        {a}
      </p>
    </details>
  );
}
