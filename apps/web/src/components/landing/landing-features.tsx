// Section "Ce que tu vois" — 4 rangs magazine alternés.
// Map · Score · Thèse · Pipeline (Kanban). Previews illustratives,
// pas de vraie carte/data. Pour la map on garde un placeholder visuel
// stylisé (SVG simple) sans recoder le rendu complet du handoff.

export function LandingFeatures() {
  return (
    <section
      id="produit"
      className="relative border-t border-line px-6 py-24 md:px-8 md:py-32"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-16 z-0 font-serif italic leading-none tracking-[-0.04em] text-bg-2 md:right-8"
        style={{ fontSize: "156px" }}
      >
        02
      </span>

      <div className="relative z-10 mx-auto max-w-[1280px]">
        <div className="mb-14 grid items-end gap-14 md:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.24em] text-mute-2">
              <span className="h-px w-6 bg-ink" />
              <span className="font-bold text-violet">02</span> Ce que tu vois
              <span className="h-px w-6 bg-ink" />
            </div>
            <h2
              className="m-0 font-serif text-[clamp(48px,6vw,76px)] font-normal leading-[0.98] tracking-[-0.025em]"
              style={{ textWrap: "balance" }}
            >
              Pas un dashboard. <span className="italic text-violet">Un avis.</span>
            </h2>
          </div>
          <div>
            <p
              className="m-0 max-w-[38ch] text-[16px] leading-[1.55] text-muted-ink"
              style={{ textWrap: "pretty" }}
            >
              Chaque bien arrive avec un score sur 100, six critères transparents, une thèse argumentée. Tu ne décides pas seul.
            </p>
            <div className="mt-3.5 inline-flex items-center gap-1.5 mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-violet">
              <span className="h-[5px] w-[5px] rounded-full bg-violet" />
              Argumenté par André, l'agent immo
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          {/* ROW 1 — Carte (preview LEFT, copy RIGHT) */}
          <FeatureRow reverse>
            <FeatureCopy
              num="01"
              tag="Adresse exacte"
              title={
                <>
                  Géolocalisés et <span className="italic text-violet">colorés par verdict.</span>
                </>
              }
              lede={
                <>
                  L'adresse précise est cachée par les annonces. André la retrouve via croisement{" "}
                  <strong className="font-semibold text-ink-2">DPE ADEME + reverse-BAN</strong>, et te donne un indice de confiance par bien.
                </>
              }
              bullets={[
                <>
                  <strong className="font-mono font-bold text-ink">94 %</strong> des biens géolocalisés avec adresse confirmée
                </>,
                "Markers colorés par verdict, clusters automatiques",
                "Click → fiche complète en side panel",
              ]}
              link={{ label: "Voir une carte réelle", href: "#methode" }}
            />
            <PreviewMap />
          </FeatureRow>

          {/* ROW 2 — Score (preview RIGHT, copy LEFT) */}
          <FeatureRow>
            <FeatureCopy
              num="02"
              tag="6 critères"
              title={
                <>
                  Une note sur 100, <span className="italic text-violet">jamais une boîte noire.</span>
                </>
              }
              lede={
                <>
                  Le score est pondéré sur six critères transparents. La pondération s'adapte à{" "}
                  <strong className="font-semibold text-ink-2">ta stratégie</strong> (locatif nu, mixte, flip, viager) et à tes paramètres financiers.
                </>
              }
              bullets={[
                <>
                  <strong className="font-mono font-bold text-ink">Prix · Rendement · Cashflow · DPE · Quartier · Risques</strong>
                </>,
                "Tu vois précisément quelle métrique pèse le plus",
                <>
                  Verdict tranché&nbsp;:{" "}
                  <strong className="font-semibold text-ink">Opportunité · À considérer · À écarter</strong>
                </>,
              ]}
            />
            <PreviewScore />
          </FeatureRow>

          {/* ROW 3 — Thèse André (preview LEFT, copy RIGHT) */}
          <FeatureRow reverse>
            <FeatureCopy
              num="03"
              tag="par André"
              title={
                <>
                  Trois paragraphes, <span className="italic text-violet">pas un slogan.</span>
                </>
              }
              lede={
                <>
                  Pour le Top 5, <strong className="font-semibold text-ink-2">André</strong> écrit une thèse argumentée&nbsp;: plan de financement, stratégie de négociation, points de vigilance — appuyés sur la donnée du bien.
                </>
              }
              bullets={[
                <>
                  Croisement <strong className="font-mono font-bold text-ink">DVF</strong> du quartier pour chiffrer l'écart marché
                </>,
                "Prix cible recommandé pour ton offre initiale",
                "Risques structurels signalés (DPE, copro, travaux)",
              ]}
            />
            <PreviewThesis />
          </FeatureRow>

          {/* ROW 4 — Pipeline (full width) */}
          <div className="border-t border-line pt-16">
            <div className="grid items-end gap-10 pb-8 md:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="mb-5 inline-flex items-center gap-3.5 mono text-[11px] font-medium uppercase tracking-[0.24em] text-mute-2">
                  <span className="h-px w-6 bg-ink" />
                  <span className="font-bold text-violet">04</span> Pipeline
                  <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10.5px] font-medium tracking-[0.04em] text-violet-deep normal-case">
                    Kanban
                  </span>
                </div>
                <h3
                  className="m-0 font-serif text-[clamp(36px,4.4vw,52px)] font-normal leading-[1.02] tracking-[-0.025em] text-ink"
                  style={{ textWrap: "balance", maxWidth: "18ch" }}
                >
                  Suivi des biens, <span className="italic text-violet">de la visite à la signature.</span>
                </h3>
              </div>
              <p
                className="m-0 max-w-[44ch] text-[16px] leading-[1.6] text-muted-ink"
                style={{ textWrap: "pretty" }}
              >
                Drag-and-drop entre 5 colonnes. Les dates se remplissent automatiquement quand tu glisses une carte. Notes, prix d'offre et date de compromis par bien.
              </p>
            </div>
            <div className="overflow-hidden rounded-r-xl border border-line bg-card p-6 shadow-lvl-2">
              <PreviewKanban />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────

function FeatureRow({
  reverse,
  children,
}: {
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "grid items-center gap-16 border-t border-line py-14 first:border-t-0 first:pt-2 md:grid-cols-[1.05fr_1fr] " +
        (reverse ? "[&>*:first-child]:md:order-2 [&>*:last-child]:md:order-1" : "")
      }
    >
      {children}
    </div>
  );
}

function FeatureCopy({
  num,
  tag,
  title,
  lede,
  bullets,
  link,
}: {
  num: string;
  tag: string;
  title: React.ReactNode;
  lede: React.ReactNode;
  bullets: React.ReactNode[];
  link?: { label: string; href: string };
}) {
  return (
    <div className="py-2">
      <div className="mb-5 inline-flex items-center gap-3.5 mono text-[11px] font-medium uppercase tracking-[0.24em] text-mute-2">
        <span className="h-px w-6 bg-ink" />
        <strong className="font-bold text-violet">{num}</strong>
        <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10.5px] font-medium tracking-[0.04em] text-violet-deep normal-case">
          {tag}
        </span>
      </div>
      <h3
        className="m-0 font-serif text-[clamp(36px,4.4vw,52px)] font-normal leading-[1.02] tracking-[-0.025em] text-ink"
        style={{ textWrap: "balance", maxWidth: "18ch" }}
      >
        {title}
      </h3>
      <p
        className="mt-5 max-w-[44ch] text-[16px] leading-[1.6] text-muted-ink"
        style={{ textWrap: "pretty" }}
      >
        {lede}
      </p>
      <ul className="mt-5 flex list-none flex-col gap-3 p-0">
        {bullets.map((b, i) => (
          <li key={i} className="grid grid-cols-[16px_1fr] items-start gap-3 text-[14px] leading-[1.5] text-ink-2">
            <CheckIcon />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {link ? (
        <a
          href={link.href}
          className="mt-6 inline-flex items-center gap-2 border-b border-violet-soft pb-1 text-[13px] font-semibold text-violet hover:border-violet"
        >
          {link.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="mt-1 text-violet"
      aria-hidden="true"
    >
      <path
        d="M2 7l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Previews illustratives ─────────────────────────────────────────

function PreviewMap() {
  return (
    <div
      className="relative aspect-[5/4] overflow-hidden rounded-r-xl border border-line bg-card"
      style={{
        boxShadow:
          "0 24px 56px -20px rgba(28,25,23,0.12), 0 8px 16px -8px rgba(28,25,23,0.06)",
      }}
    >
      <svg
        viewBox="0 0 480 380"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern id="map-grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(28,25,23,0.04)" strokeWidth="0.5" />
          </pattern>
          <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" in="SourceAlpha" />
            <feOffset dy="1.5" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.35" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="480" height="380" fill="#F4F1EA" />
        <rect width="480" height="380" fill="url(#map-grid)" />
        <g fill="#EBE4D4" opacity="0.7">
          <rect x="40" y="40" width="160" height="68" rx="3" />
          <rect x="216" y="40" width="120" height="68" rx="3" />
          <rect x="352" y="40" width="92" height="68" rx="3" />
          <rect x="40" y="124" width="100" height="92" rx="3" />
          <rect x="156" y="124" width="180" height="92" rx="3" />
          <rect x="352" y="124" width="92" height="92" rx="3" />
          <rect x="40" y="270" width="120" height="80" rx="3" />
          <rect x="176" y="270" width="160" height="80" rx="3" />
          <rect x="352" y="270" width="92" height="80" rx="3" />
        </g>
        <path
          d="M 226 232 Q 220 220 240 218 L 286 220 Q 304 226 302 246 L 296 258 Q 284 264 254 262 L 230 258 Q 222 248 226 232 Z"
          fill="#D7E0C8"
          stroke="rgba(28,25,23,0.06)"
          strokeWidth="0.5"
        />
        <path
          d="M -10 234 Q 100 228 240 234 T 490 232 L 490 248 Q 380 244 240 250 T -10 248 Z"
          fill="#D5E3EF"
          stroke="rgba(28,25,23,0.06)"
          strokeWidth="0.5"
        />
        <g stroke="white" strokeWidth="6" strokeLinecap="round">
          <line x1="0" y1="116" x2="480" y2="116" />
          <line x1="0" y1="362" x2="480" y2="362" />
          <line x1="148" y1="0" x2="148" y2="380" />
          <line x1="344" y1="0" x2="344" y2="380" />
        </g>
        <g transform="translate(86,80)" filter="url(#pinShadow)">
          <circle r="14" fill="white" stroke="#16A34A" strokeWidth="2" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#14532D">
            87
          </text>
        </g>
        <g transform="translate(286,82)" filter="url(#pinShadow)">
          <circle r="14" fill="white" stroke="#16A34A" strokeWidth="2" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#14532D">
            79
          </text>
        </g>
        <g transform="translate(400,86)" filter="url(#pinShadow)">
          <circle r="18" fill="#1C1917" stroke="white" strokeWidth="3" />
          <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="700" fill="white">
            14
          </text>
        </g>
        <g transform="translate(96,304)" filter="url(#pinShadow)">
          <circle r="14" fill="white" stroke="#EA580C" strokeWidth="2" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7C2D12">
            68
          </text>
        </g>
        <g transform="translate(388,316)" filter="url(#pinShadow)">
          <circle r="14" fill="white" stroke="#EA580C" strokeWidth="2" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7C2D12">
            62
          </text>
        </g>
        <g transform="translate(248,316)" filter="url(#pinShadow)">
          <circle r="14" fill="white" stroke="#DC2626" strokeWidth="2" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7F1D1D">
            41
          </text>
        </g>
        <g transform="translate(180,170)">
          <circle r="38" fill="rgba(91,71,224,0.10)" />
          <circle r="26" fill="rgba(91,71,224,0.18)" />
          <g filter="url(#pinShadow)">
            <circle r="18" fill="#5B47E0" stroke="white" strokeWidth="3" />
            <text x="0" y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
              92
            </text>
          </g>
        </g>
      </svg>
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-3 mono text-[11px] tracking-[0.04em] text-white"
        style={{ background: "linear-gradient(180deg, transparent, rgba(28,25,23,0.78))" }}
      >
        <span>
          <span className="mr-2 inline-block h-[7px] w-[7px] rounded-full bg-[#16A34A]" />
          87 biens sur Lyon 3ᵉ + 5 km
        </span>
        <span>OpenStreetMap</span>
      </div>
    </div>
  );
}

function PreviewScore() {
  const criteria = [
    { name: "Prix", pct: 92, tone: "good" as const },
    { name: "Rendement", pct: 48, tone: "mid" as const },
    { name: "Cashflow", pct: 32, tone: "bad" as const },
    { name: "DPE", pct: 56, tone: "mid" as const },
    { name: "Quartier", pct: 91, tone: "good" as const },
    { name: "Risques", pct: 88, tone: "good" as const },
  ];
  const fillTone: Record<string, string> = {
    good: "bg-violet",
    mid: "bg-[hsl(var(--warning))]",
    bad: "bg-[hsl(var(--destructive))]",
  };
  return (
    <div
      className="relative overflow-hidden rounded-r-xl border border-line bg-card p-9 pb-8 shadow-lvl-2"
    >
      <div className="mb-7 flex items-center gap-8">
        <div
          className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.7), transparent 50%),
              conic-gradient(from -90deg, #5B47E0 0%, #5B47E0 87%, #EEEBFB 87%, #EEEBFB 100%)`,
            boxShadow:
              "0 18px 36px -14px rgba(91,71,224,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          <div
            className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-card"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" }}
          >
            <span className="mono text-[48px] font-bold leading-none tracking-[-0.045em] text-ink">87</span>
            <span className="mt-1 mono text-[9.5px] tracking-[0.08em] text-mute-2">/ 100</span>
            <span className="mt-2 text-[8.5px] font-bold uppercase tracking-[0.22em] text-violet">
              Opportunité
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-2.5 mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-mute-2">
            Scoring détaillé
          </div>
          {criteria.map((c) => (
            <div
              key={c.name}
              className="grid grid-cols-[76px_1fr_28px] items-center gap-2.5 py-1"
            >
              <span className="text-[12.5px] font-medium text-ink-2">{c.name}</span>
              <span className="block h-[5px] overflow-hidden rounded-full bg-bg-2">
                <span className={"block h-full rounded-full " + fillTone[c.tone]} style={{ width: `${c.pct}%` }} />
              </span>
              <span className="text-right mono text-[11.5px] font-bold text-ink">{c.pct}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="-mx-9 -mb-8 flex items-center gap-3.5 border-t px-5 py-3.5 text-[12.5px]"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--success-soft)), rgba(220,252,231,0.4))",
          borderTopColor: "rgba(22,163,74,0.15)",
        }}
      >
        <span className="inline-flex items-center gap-1.5 mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--success-soft-foreground))]">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
          Verdict
        </span>
        <span className="flex-1 font-serif italic text-[14px] text-[hsl(var(--success-soft-foreground))]">
          Opportunité — à visiter cette semaine.
        </span>
        <span className="mono text-[14px] font-bold text-ink">248 000 €</span>
      </div>
    </div>
  );
}

function PreviewThesis() {
  return (
    <div
      className="rounded-r-xl border border-line bg-card p-8 shadow-lvl-2"
    >
      <p
        className="relative m-0 pl-5 font-serif text-[26px] italic leading-[1.32] tracking-[-0.015em] text-ink"
        style={{ textWrap: "pretty" }}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-violet"
        />
        Bien sous-évalué de 9,2 % versus DVF du quartier — comparable au 5 rue Voltaire vendu 512 k il y a 3 mois.
      </p>
      <div className="mt-5 flex items-center gap-3 border-b border-line pb-5">
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-violet-grad font-serif text-[16px] italic font-medium text-white">
          A
        </div>
        <div>
          <div className="mono text-[11px] font-bold uppercase tracking-[0.1em] text-violet-deep">
            André · l'agent immo
          </div>
          <div className="mt-0.5 mono text-[10.5px] text-mute-2">
            Généré le 24 mai à 14:32
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <p className="m-0 text-[13.5px] leading-[1.6] text-ink-2">
          DPE C dispense de tout travaux énergétiques avant 2034. Cashflow positif{" "}
          <strong className="text-ink">+143 €/mois</strong> avec ton apport de 200 k et taux 3 %.
        </p>
        <p className="m-0 text-[13.5px] leading-[1.6] text-ink-2">
          Offre initiale conseillée à <strong className="text-ink">232 k</strong> (−6,5 %) avec argument DVF chiffré. Prix cible final&nbsp;:{" "}
          <strong className="text-ink">238 000 €</strong>.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-[hsl(var(--success-soft))] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[hsl(var(--success-soft-foreground))]">
          À visiter en priorité
        </span>
        <span className="rounded-full bg-[hsl(var(--warning-soft))] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[hsl(var(--warning-soft-foreground))]">
          Vérifier PV AG copro
        </span>
      </div>
    </div>
  );
}

function PreviewKanban() {
  const cols = [
    {
      title: "À visiter",
      count: 4,
      cards: [
        { score: 87, tone: "good" as const, title: "Lyon 3ᵉ · 2P" },
        { score: 81, tone: "good" as const, title: "Marseille 8ᵉ" },
        { score: 79, tone: "good" as const, title: "Nantes · studio" },
        { score: 73, tone: "mid" as const, title: "Paris 11ᵉ" },
      ],
    },
    {
      title: "Visité",
      count: 2,
      cards: [
        { score: 84, tone: "good" as const, title: "Toulouse · maison" },
        { score: 68, tone: "mid" as const, title: "Bordeaux · 3P" },
      ],
    },
    {
      title: "Offre",
      count: 1,
      cards: [{ score: 76, tone: "good" as const, title: "Rennes · 2P" }],
    },
    {
      title: "Compromis",
      count: 1,
      cards: [{ score: 78, tone: "good" as const, title: "Strasbourg · 3P" }],
    },
    {
      title: "Signé",
      count: 0,
      cards: [],
      signed: true,
    },
  ];
  const cardTone: Record<string, string> = {
    good: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))]",
    mid: "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-soft-foreground))]",
  };
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-5">
      {cols.map((col) => (
        <div
          key={col.title}
          className="min-h-[170px] rounded-r border border-line-soft bg-bg-2 p-3"
        >
          <h4 className="mb-2.5 flex items-center justify-between mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-mute-2">
            {col.title}
            <span
              className={
                "rounded-r-xs px-1.5 py-0.5 text-[11px] " +
                (col.signed
                  ? "bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))]"
                  : "bg-card text-ink")
              }
            >
              {col.count}
            </span>
          </h4>
          {col.cards.length === 0 ? (
            <div
              className="rounded border border-dashed border-line-2 px-1 py-3 text-center font-serif text-[10.5px] italic text-mute-2"
            >
              à venir…
            </div>
          ) : (
            col.cards.map((card) => (
              <div
                key={card.title}
                className="mb-1.5 flex items-center gap-2 rounded-r-sm border border-line bg-card px-2.5 py-2 text-[11px] text-ink-2"
              >
                <span
                  className={
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-r-xs mono text-[10px] font-bold " +
                    cardTone[card.tone]
                  }
                >
                  {card.score}
                </span>
                <span className="flex-1 truncate font-medium">{card.title}</span>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
