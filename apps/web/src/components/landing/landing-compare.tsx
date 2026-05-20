// Section "Vs Excel" — bande sombre, tableau de comparaison.

import { COMPARISON_ROWS } from "./data";

export function LandingCompare() {
  return (
    <section className="relative overflow-hidden border-y border-line bg-ink px-6 py-24 text-white md:px-8 md:py-32">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-16 z-0 font-serif italic leading-none tracking-[-0.04em] md:right-8"
        style={{ fontSize: "156px", color: "rgba(255,255,255,0.04)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(91,71,224,0.36), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1280px]">
        <div className="mb-5 flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
          <span className="h-px w-6 bg-white/30" />
          <span className="font-bold text-[#C7BCFC]">03</span> Pipeline vs Excel
          <span className="h-px w-6 bg-white/30" />
        </div>
        <h2
          className="m-0 max-w-[18ch] font-serif text-[clamp(48px,6.4vw,84px)] font-normal leading-[0.98] tracking-[-0.028em] text-white"
          style={{ textWrap: "balance" }}
        >
          Tu fais déjà tout ça. <span className="italic text-[#C7BCFC]">Manuellement.</span>
        </h2>
        <p
          className="mt-6 max-w-[60ch] text-[17px] leading-[1.55] text-white/65"
          style={{ textWrap: "pretty" }}
        >
          Voici ce qu'un investisseur fait à la main pour évaluer{" "}
          <strong className="font-semibold text-white">un seul bien</strong>. André le fait pour des centaines, en parallèle, en 8 minutes.
        </p>

        <div
          className="mt-14 overflow-hidden rounded-r-lg border bg-white/[0.04] backdrop-blur-sm"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-white/8 bg-black/20 px-6 py-4 text-left mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/55">
                  Tâche
                </th>
                <th className="border-b border-white/8 bg-black/20 px-6 py-4 text-left mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/50">
                  Excel maison · ~20 h / 10 biens
                </th>
                <th
                  className="relative border-b border-white/8 bg-violet-grad px-6 py-4 text-left mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-white"
                >
                  8 min · toute la recherche
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.criterion}
                  className={
                    "transition-colors hover:bg-white/[0.02] " +
                    (i === COMPARISON_ROWS.length - 1 ? "" : "[&_td]:border-b [&_td]:border-white/8")
                  }
                >
                  <td className="w-[30%] px-6 py-4 font-serif text-[17px] italic font-medium tracking-[-0.01em] text-white">
                    {row.criterion}
                  </td>
                  <td className="w-[35%] px-6 py-4 text-[13.5px] text-white/50">
                    <span className="mr-2.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white/45">
                      ✕
                    </span>
                    {row.manual}
                  </td>
                  <td className="w-[35%] bg-violet/[0.08] px-6 py-4 text-[13.5px] text-white/90">
                    <span className="mr-2.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--success))] text-[10px] font-bold text-white">
                      ✓
                    </span>
                    {row.immoscan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
