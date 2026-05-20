// Ticker — défilement horizontal CSS pur des derniers biens analysés
// (mockés dans data.ts). Pas de websocket ni d'API : la "liveness" est
// purement visuelle, c'est un placeholder marketing.
// TODO: brancher sur un vrai feed quand un service côté worker exposera
// les derniers biens scorés > 70.

import { TICKER_ITEMS } from "./data";

export function LandingTicker() {
  // On duplique la liste pour que l'animation translateX(-50%) boucle
  // sans saut.
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <section className="relative mt-14 overflow-hidden border-y border-line bg-card py-5">
      <style>{tickerKeyframes}</style>
      {/* Fades latéraux */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[140px]"
        style={{ background: "linear-gradient(90deg, hsl(var(--card)), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[140px]"
        style={{ background: "linear-gradient(-90deg, hsl(var(--card)), transparent)" }}
      />

      <div
        className="flex w-max items-center gap-10"
        style={{ animation: "is-ticker-scroll 90s linear infinite" }}
      >
        {items.map((it, i) => (
          <div
            key={`${it.city}-${i}`}
            className="inline-flex items-center gap-3 whitespace-nowrap mono text-[13px] text-mute-2"
          >
            <span className="font-medium text-ink">{it.city}</span>
            <span className="text-line-2">/</span>
            <span>{it.type}</span>
            <span className="text-line-2">/</span>
            <span>{it.price}</span>
            <span className="text-line-2">/</span>
            <span
              className={
                "rounded-r-xs px-1.5 py-0.5 font-bold " +
                scoreToneClass(it.score)
              }
            >
              {it.score}
            </span>
            {it.delta ? (
              <span className="font-semibold text-[hsl(var(--success))]">
                {it.delta}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function scoreToneClass(score: number): string {
  if (score >= 75)
    return "bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))]";
  if (score >= 50)
    return "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-soft-foreground))]";
  return "bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive-soft-foreground))]";
}

const tickerKeyframes = `
@keyframes is-ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
`;
