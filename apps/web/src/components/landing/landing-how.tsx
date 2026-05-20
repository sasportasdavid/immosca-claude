// Section "comment ça marche" en 3 colonnes.

export function LandingHow() {
  return (
    <section id="methode" className="px-6 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1280px]">
        <h2
          className="text-center font-serif text-[clamp(36px,5vw,56px)] font-normal leading-[1.04] tracking-[-0.025em]"
          style={{ textWrap: "balance" }}
        >
          Trois minutes pour <span className="italic text-violet">poser la question.</span>
          <br />
          Huit pour <span className="italic text-violet">avoir la réponse.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[60ch] text-center text-[16px] leading-[1.55] text-muted-ink">
          Tu colles l'URL de ta recherche. André scanne, géolocalise, score, argumente. Tu décides — sans ouvrir un tableur.
        </p>

        <div className="mt-14 grid gap-3.5 md:grid-cols-3">
          <Step
            num="01"
            title="L'URL de ta recherche."
            body={
              <>
                Une URL de page de résultats{" "}
                <strong className="font-semibold text-ink-2">SeLoger, Le Bon Coin, PAP, Bien'ici</strong> — pas une annonce individuelle. André récupère{" "}
                <strong className="font-semibold text-ink-2">tous les biens, sans limite</strong>.
              </>
            }
          />
          <Step
            num="02"
            title="L'adresse exacte, retrouvée."
            body={
              <>
                Croisement{" "}
                <strong className="font-semibold text-ink-2">DPE ADEME + reverse-BAN + DVF + Géorisques</strong>. 94 % des biens géolocalisés avec un{" "}
                <strong className="font-semibold text-ink-2">indice de confiance</strong> par adresse.
              </>
            }
          />
          <Step
            num="03"
            title="Le verdict, argumenté."
            body={
              <>
                Score 0–100 sur 6 critères. Top 5 avec{" "}
                <strong className="font-semibold text-ink-2">thèse d'André</strong> en 3 paragraphes&nbsp;: financement, négociation, vigilance.
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-r-xl border border-line bg-card p-7">
      <div className="font-serif text-[48px] italic leading-none tracking-[-0.03em] text-violet">
        {num}
      </div>
      <h3 className="mt-3.5 text-[19px] font-semibold leading-[1.15] tracking-[-0.018em] text-ink">
        {title}
      </h3>
      <p className="mt-2.5 text-[13.5px] leading-[1.55] text-muted-ink">{body}</p>
    </div>
  );
}
