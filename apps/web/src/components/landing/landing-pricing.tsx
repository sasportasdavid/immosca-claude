// Section pricing — Free bandeau + 3 cards (Pro+ · Pro featured · Business).
// Tarifs et features strictement alignés sur CLAUDE.md §12 (source de
// vérité = docs/01-spec-produit.md §Pricing), pas sur le HTML handoff.

import { PRICING_PLANS } from "./data";

export function LandingPricing() {
  return (
    <section
      id="tarifs"
      className="border-y border-line bg-bg-2 px-6 py-24 md:px-8"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14 text-center">
          <div className="flex items-center justify-center gap-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute-2">
            <span className="h-px w-7 bg-ink" />
            Tarifs TTC · Annulable à tout moment
            <span className="h-px w-7 bg-ink" />
          </div>
          <h2
            className="mt-3.5 font-serif text-[clamp(48px,6vw,76px)] font-normal leading-[0.98] tracking-[-0.025em]"
            style={{ textWrap: "balance" }}
          >
            Un bien acheté
            <br />
            <span className="italic text-violet">paie 4 ans d'abonnement.</span>
          </h2>
          <p className="mt-3.5 text-[15px] text-muted-ink">
            Essai 7 jours sans CB sur Pro / Pro+.
          </p>
        </div>

        {/* Free bandeau */}
        <div className="relative mb-5 grid items-center gap-7 overflow-hidden rounded-r-xl border border-line bg-card p-7 md:grid-cols-[auto_1fr_auto]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-10 h-[220px] w-[220px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(91,71,224,0.10), transparent)",
            }}
          />
          <div
            className="flex h-13 w-13 shrink-0 items-center justify-center rounded-r-lg bg-violet-soft text-violet"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)", height: 52, width: 52 }}
          >
            <StarIcon />
          </div>
          <div className="min-w-0">
            <p className="m-0 font-serif text-[26px] italic font-medium leading-[1.15] tracking-[-0.015em] text-ink">
              Démarre <span className="text-violet">gratuitement.</span>
            </p>
            <p className="mt-1.5 text-[14px] leading-[1.5] text-muted-ink">
              Analyses illimitées · biens premium masqués au-dessus de 70. Sans CB, sans engagement.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href="/auth/signup"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ink bg-ink px-5 text-[13.5px] font-medium tracking-[0.04em] text-white no-underline"
            >
              Créer mon compte gratuit
              <ArrowRight />
            </a>
            <a
              href="#faq"
              className="hidden text-[13px] font-medium text-ink-2 hover:text-violet sm:inline"
            >
              Ce qui est inclus →
            </a>
          </div>
        </div>

        {/* 3 cards */}
        <div className="grid items-stretch gap-3.5 lg:grid-cols-[1fr_1.05fr_1fr]">
          {PRICING_PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mt-7 text-center text-[12.5px] leading-[1.6] text-mute-2">
          Tarifs TTC · <strong className="text-ink">−20 %</strong> en annuel (engagement 12 mois) sur Pro / Pro+ / Business.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ plan }: { plan: (typeof PRICING_PLANS)[number] }) {
  const featured = plan.featured;
  return (
    <div
      className={
        "relative flex flex-col rounded-r-lg border p-6 pt-7 " +
        (featured
          ? "-translate-y-2 border-ink bg-ink text-white shadow-lvl-3"
          : "border-line bg-card text-ink")
      }
    >
      {featured ? (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
          Le plus choisi
        </span>
      ) : null}
      <div className="font-serif text-[22px] italic tracking-[-0.015em]">{plan.name}</div>
      <div className="mt-3.5 flex items-baseline gap-1">
        <span
          className={
            "font-serif text-[52px] italic leading-none tracking-[-0.03em] " +
            (featured ? "text-white" : "text-ink")
          }
        >
          {plan.price}
        </span>
        <span className={"text-[13px] " + (featured ? "text-white/70" : "text-mute-2")}>
          {plan.per}
        </span>
      </div>
      <div className={"mt-1 text-[12.5px] " + (featured ? "text-white/70" : "text-muted-ink")}>
        {plan.tagline}
      </div>
      <hr className={"my-6 border-0 border-t " + (featured ? "border-white/12" : "border-line")} />
      <ul className="flex flex-1 list-none flex-col gap-2.5 p-0">
        {plan.features.map((f, i) => (
          <li
            key={i}
            className={
              "flex items-start gap-2.5 text-[13px] leading-[1.45] " +
              (featured ? "text-white/85" : "text-ink-2")
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              className={"mt-0.5 shrink-0 " + (featured ? "text-[#C7BCFC]" : "text-violet")}
              aria-hidden="true"
            >
              <path
                d="M2 7l3 3 7-7"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={plan.ctaHref}
        className={
          "mt-7 rounded-full border px-3 py-3 text-center text-[13px] font-medium tracking-[0.04em] no-underline " +
          (featured
            ? "border-white bg-white text-ink"
            : "border-ink bg-transparent text-ink hover:bg-bg-2")
        }
      >
        {plan.ctaLabel}
      </a>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 7h8m0 0L7 3m4 4L7 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
