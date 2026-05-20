// Hero éditorial split — slogan sérif à gauche, verdict card démo à droite.
// Le verdict card est statique (chiffres mockés dans data.ts). L'arc de
// score est rendu en conic-gradient inline, pas de lib charts.

import { HERO_STATS, TOP5_RANKING, VERDICT_DEMO } from "./data";

import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-10 md:px-8 md:pt-20">
      {/* Halos violet décoratifs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-16 z-0 h-[480px] w-[480px] rounded-full opacity-60 blur-[40px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(91,71,224,0.18), transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -bottom-24 z-0 h-[380px] w-[380px] rounded-full opacity-60 blur-[28px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(91,71,224,0.10), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-[0.95fr_1.05fr]">
        {/* LEFT — slogan + CTAs + stats */}
        <HeroCopy />
        {/* RIGHT — verdict card */}
        <HeroVerdict />
      </div>
    </section>
  );
}

function HeroCopy() {
  return (
    <div>
      <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-card pl-1.5 pr-3 py-1 text-[12px] text-muted-ink shadow-lvl-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-white">
          <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-white" />
          André
        </span>
        l'agent immo · scanne, score, argumente
      </span>

      <h1
        className="mt-7 font-serif text-[clamp(48px,6.4vw,88px)] font-normal leading-[0.96] tracking-[-0.03em] text-ink"
        style={{ textWrap: "balance", maxWidth: "13ch" }}
      >
        La perle est dans{" "}
        <span className="relative inline-block font-mono text-[0.92em] font-bold not-italic tracking-[-0.04em] text-ink">
          <span
            aria-hidden="true"
            className="absolute -inset-x-[3%] bottom-[6%] -z-10 h-[36%] rounded"
            style={{
              background: "rgba(91,71,224,0.2)",
              transform: "skewY(-1deg)",
            }}
          />
          600
        </span>{" "}
        annonces.
        <span className="mt-3.5 block text-[0.4em] font-medium not-italic leading-[1.15] tracking-[-0.02em] text-mute-2">
          On te dit{" "}
          <span className="font-serif font-medium italic text-ink">
            laquelle.
          </span>
        </span>
      </h1>

      <p
        className="mt-7 max-w-[48ch] text-[17px] leading-[1.55] text-muted-ink"
        style={{ textWrap: "pretty" }}
      >
        Colle l'URL de ta recherche SeLoger, Le Bon Coin ou PAP.{" "}
        <span className="rounded px-1.5 py-[1px] bg-violet-soft font-mono text-[0.94em] font-semibold not-italic text-violet-deep">
          André
        </span>{" "}
        récupère{" "}
        <strong className="font-semibold text-ink-2">
          tous les biens, sans limite
        </strong>
        , retrouve leur adresse exacte, et te livre un Top 5 argumenté en 8 minutes.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2.5">
        <Button asChild size="lg" variant="secondary" className="rounded-full px-6 h-[52px] text-[13.5px] tracking-[0.04em]">
          <a href="/auth/signup">
            Trouver ma perle
            <ArrowRight />
          </a>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="rounded-full px-6 h-[52px] text-[13.5px] tracking-[0.04em]"
        >
          <a href="#methode">
            <PlayIcon />
            Voir une analyse type
          </a>
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-6">
        {HERO_STATS.map((s) => (
          <div key={s.value}>
            <div className="font-serif text-[36px] font-normal italic leading-none tracking-[-0.02em] text-violet">
              {s.value}
            </div>
            <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-mute-2">
              {s.reverse ? (
                <>
                  {s.suffix} <strong className="font-semibold text-ink">{s.label}</strong>
                </>
              ) : (
                <>
                  <strong className="font-semibold text-ink">{s.label}</strong> {s.suffix}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroVerdict() {
  const arcStyle: React.CSSProperties = {
    background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.7), transparent 50%),
      conic-gradient(from -90deg, #5B47E0 0%, #5B47E0 ${VERDICT_DEMO.score}%, #EEEBFB ${VERDICT_DEMO.score}%, #EEEBFB 100%)`,
    boxShadow:
      "0 20px 40px -16px rgba(91,71,224,0.5), inset 0 1px 0 rgba(255,255,255,0.5)",
  };

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-r-xl border border-line bg-card"
        style={{
          boxShadow:
            "0 32px 80px -24px rgba(91,71,224,0.32), 0 12px 32px -8px rgba(28,25,23,0.10)",
        }}
      >
        {/* Trait gradient supérieur */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #5B47E0, transparent)",
          }}
        />

        {/* HEAD */}
        <div className="flex items-center justify-between border-b border-line bg-bg-2 px-5 py-3.5">
          <span className="flex items-center gap-2 mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mute-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet" />
            {VERDICT_DEMO.stamp}
          </span>
          <span className="mono text-[10.5px] font-bold tracking-[0.04em] text-violet">
            Bien #<strong className="text-ink">{VERDICT_DEMO.rank.current}</strong> / {VERDICT_DEMO.rank.total}
          </span>
        </div>

        {/* BODY — score + meta */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-6 px-7 pt-7 pb-5">
          <div
            className="relative flex h-[156px] w-[156px] shrink-0 items-center justify-center rounded-full"
            style={arcStyle}
          >
            <div
              aria-hidden="true"
              className="absolute -inset-2 animate-[spin_32s_linear_infinite] rounded-full border border-dashed"
              style={{ borderColor: "rgba(91,71,224,0.25)" }}
            />
            <div
              className="flex h-[116px] w-[116px] flex-col items-center justify-center rounded-full bg-card"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" }}
            >
              <span className="mono text-[54px] font-bold leading-none tracking-[-0.045em] text-ink">
                {VERDICT_DEMO.score}
              </span>
              <span className="mt-1 mono text-[10px] tracking-[0.08em] text-mute-2">
                / 100
              </span>
              <span className="mt-2 text-[8.5px] font-bold uppercase tracking-[0.2em] text-violet">
                {VERDICT_DEMO.verdict}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2.5 inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--success))]">
              <span className="h-[7px] w-[7px] rounded-full bg-[hsl(var(--success))]" />
              {VERDICT_DEMO.verdict}
              <span className="ml-1 border-l border-line pl-2.5 mono text-[11px] font-semibold normal-case tracking-[0.04em] text-violet">
                → {VERDICT_DEMO.cta}
              </span>
            </div>
            <h2 className="m-0 text-[19px] font-semibold leading-[1.18] tracking-[-0.022em] text-ink" style={{ textWrap: "balance" }}>
              {VERDICT_DEMO.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 mono text-[11.5px] text-muted-ink">
              <span>{VERDICT_DEMO.meta.surface}</span>
              <span className="text-faint">·</span>
              <span>{VERDICT_DEMO.meta.rooms}</span>
              <span className="text-faint">·</span>
              <span>{VERDICT_DEMO.meta.floor}</span>
              <span className="text-faint">·</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-r-xs bg-[var(--dpe-c-hex)] text-[10px] font-bold text-ink">
                {VERDICT_DEMO.meta.dpe}
              </span>
            </div>
          </div>
        </div>

        {/* QUOTE */}
        <div
          className="border-b border-t border-line px-7 py-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(91,71,224,0.03), transparent)",
          }}
        >
          <p
            className="relative m-0 pl-3.5 font-serif text-[18px] italic leading-[1.4] tracking-[-0.01em] text-ink"
            style={{ textWrap: "pretty" }}
          >
            <span
              aria-hidden="true"
              className="absolute left-0 top-1 bottom-1 w-[2.5px] rounded-full bg-violet"
            />
            {VERDICT_DEMO.quote}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 mono text-[10px] font-bold uppercase tracking-[0.1em] text-violet">
            <span className="h-[5px] w-[5px] rounded-full bg-violet" />
            {VERDICT_DEMO.attribution}
          </div>
        </div>

        {/* CRITERIA bars */}
        <div className="grid grid-cols-6 gap-3 px-7 py-4">
          {VERDICT_DEMO.criteria.map((c) => (
            <div key={c.name} className="text-center">
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-mute-2">
                {c.name}
              </div>
              <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-bg-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${c.pct}%`,
                    background:
                      c.pct >= 75
                        ? "hsl(var(--success))"
                        : c.pct >= 50
                          ? "hsl(var(--warning))"
                          : "hsl(var(--destructive))",
                  }}
                />
              </div>
              <div className="mono text-[10.5px] font-bold tabular-nums text-ink">
                {c.pct}
              </div>
            </div>
          ))}
        </div>

        {/* FOOT — price */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-7 py-3.5 mono text-[10.5px] tracking-[0.04em] text-mute-2">
          <span>
            <strong className="text-[17px] font-bold tracking-[-0.02em] text-ink">
              {VERDICT_DEMO.price}
            </strong>
            <span className="mx-1.5">·</span>
            {VERDICT_DEMO.pricePerM2}
            <span className="mx-1.5">·</span>
            <strong className="font-bold text-[hsl(var(--success))]">
              {VERDICT_DEMO.delta}
            </strong>
          </span>
          <div className="flex items-center gap-3">
            <span>
              Cashflow{" "}
              <strong className="font-bold text-[hsl(var(--success))]">
                {VERDICT_DEMO.cashflow}
              </strong>
            </span>
            <span className="text-faint">·</span>
            <span>
              Rdt net <strong className="font-bold text-ink">{VERDICT_DEMO.netYield}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Mini ranking strip sous la card */}
      <div className="mt-3.5 flex items-center gap-3.5 rounded-r border border-line bg-card px-3.5 py-3 shadow-lvl-1">
        <span className="shrink-0 mono text-[9px] font-bold uppercase tracking-[0.12em] text-mute-2">
          Top 5
        </span>
        <div className="flex flex-1 items-center gap-2.5 mono text-[11.5px]">
          {TOP5_RANKING.map((r, i) => (
            <span key={r.city} className="flex items-center gap-2">
              {i > 0 && <span className="text-faint">·</span>}
              <span className="flex items-center gap-1.5 text-mute-2">
                <span
                  className={
                    "flex h-[18px] w-[18px] items-center justify-center rounded-r-xs text-[10px] font-bold " +
                    (r.selected
                      ? "bg-violet text-white"
                      : "bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))]")
                  }
                >
                  {r.score}
                </span>
                <span className="font-medium text-ink">{r.city}</span>
              </span>
            </span>
          ))}
        </div>
        <a
          href="#methode"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet no-underline"
        >
          Voir tout
          <ArrowRight size={11} />
        </a>
      </div>
    </div>
  );
}

function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
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

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <path d="M3.5 2.5v8l7-4-7-4z" fill="currentColor" />
    </svg>
  );
}
