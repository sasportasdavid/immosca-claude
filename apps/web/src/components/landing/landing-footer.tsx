// Final CTA + footer — bande sombre éditoriale.

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-ink px-6 pt-24 pb-12 text-white md:px-8 md:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-20 h-[460px] w-[460px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(91,71,224,0.45), transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -bottom-32 h-[380px] w-[380px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(91,71,224,0.32), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1280px]">
        <div className="mb-7 flex items-center gap-4 mono text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
          <span className="h-px w-6 bg-white/30" />
          <span className="font-bold text-[#C7BCFC]">05</span> La fin
          <span className="h-px w-6 bg-white/30" />
        </div>
        <h2
          className="m-0 max-w-[14ch] font-serif text-[clamp(72px,10vw,144px)] font-normal leading-[0.94] tracking-[-0.035em] text-white"
          style={{ textWrap: "balance" }}
        >
          La perle <span className="italic text-[#C7BCFC]">n'attend pas.</span>
        </h2>
        <p
          className="mt-7 max-w-[56ch] text-[17px] leading-[1.55] text-white/70"
          style={{ textWrap: "pretty" }}
        >
          Essai <strong className="mono font-bold text-white">7 jours</strong> sans carte. Si après 8 minutes André ne t'a pas sorti un bien qui mérite une visite, on te rembourse.*
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-2.5 rounded-full border border-white bg-white px-7 py-4 text-[14px] font-medium tracking-[0.04em] text-ink no-underline transition-all hover:-translate-y-px hover:shadow-[0_12px_24px_-8px_rgba(255,255,255,0.3)]"
          >
            Commencer gratuitement
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M3 7h8m0 0L7 3m4 4L7 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href="#methode"
            className="inline-flex items-center gap-2.5 rounded-full border border-white/30 bg-transparent px-7 py-4 text-[14px] font-medium tracking-[0.04em] text-white no-underline transition-colors hover:border-white/50 hover:bg-white/[0.06]"
          >
            Voir une démo (2 min)
          </a>
        </div>

        <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-white/12 pt-8 mono text-[11px] tracking-[0.08em] text-white/45">
          <span className="font-serif text-[22px] italic font-medium not-italic tracking-[-0.012em] text-white">
            <span className="font-serif italic">Immoscan</span>
            <span className="text-[#C7BCFC]">.</span>
            <em className="ml-2.5 font-serif text-[13px] not-italic tracking-[0.02em] text-white/55">
              Investir, lucidement.
            </em>
          </span>
          <div className="flex flex-wrap gap-6">
            <a href="/mentions-legales" className="text-white/65 transition-colors hover:text-white">
              Mentions légales
            </a>
            <a href="/confidentialite" className="text-white/65 transition-colors hover:text-white">
              Confidentialité
            </a>
            <a href="#methode" className="text-white/65 transition-colors hover:text-white">
              Sources
            </a>
            <a href="mailto:hello@immoscan.fr" className="text-white/65 transition-colors hover:text-white">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
