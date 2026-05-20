// Données mockées pour la landing publique.
//
// Ces constantes alimentent les sections visuelles (verdict card, ticker,
// FAQ, pricing). Aucune n'est connectée à la vraie BDD — elles servent
// uniquement à donner du contenu réaliste à la maquette éditoriale.
// Quand on aura des données live (top biens scannés, stats temps réel),
// ces tableaux deviendront des hooks data — voir TODO inline.

export type HeroStat = {
  value: string;
  label: string;
  suffix: string;
  reverse?: boolean;
};

export const HERO_STATS: HeroStat[] = [
  { value: "47k", label: "Biens", suffix: "déjà scannés" },
  { value: "94 %", label: "Adresses", suffix: "retrouvées" },
  { value: "8 min", label: "analyse", suffix: "par", reverse: true },
];

export type VerdictCriterion = {
  name: string;
  pct: number;
};

export const VERDICT_DEMO = {
  stamp: "Analyse · Paris 11ᵉ · 24 mai",
  rank: { current: 1, total: 612 },
  score: 87,
  verdict: "Opportunité",
  cta: "Visiter cette semaine",
  title: "Appartement 2 pièces · Lyon 3ᵉ · Préfecture",
  meta: { surface: "48 m²", rooms: "1 chambre", floor: "4ᵉ étage", dpe: "C" },
  quote:
    "Sous-évalué de 9,2 % versus DVF du quartier — comparable au 5 rue Voltaire vendu 512 k il y a 3 mois.",
  attribution: "Thèse d'André · l'agent immo",
  criteria: [
    { name: "Prix", pct: 92 },
    { name: "Rdt", pct: 78 },
    { name: "Cashflow", pct: 71 },
    { name: "DPE", pct: 84 },
    { name: "Quartier", pct: 95 },
    { name: "Risques", pct: 89 },
  ] satisfies VerdictCriterion[],
  price: "248 000 €",
  pricePerM2: "5 167 €/m²",
  delta: "−9,2 %",
  cashflow: "+143 €",
  netYield: "4,1 %",
};

export const TOP5_RANKING = [
  { score: 87, city: "Lyon 3ᵉ", selected: true },
  { score: 84, city: "Toulouse", selected: false },
  { score: 81, city: "Marseille", selected: false },
];

// TODO: brancher sur une vraie API quand le ticker temps réel sera dispo.
// Pour l'instant : défilement CSS pur sur cette liste dupliquée.
export type TickerItem = {
  city: string;
  type: string;
  price: string;
  score: number;
  delta?: string;
};

export const TICKER_ITEMS: TickerItem[] = [
  { city: "Lyon 3ᵉ", type: "2P 48 m²", price: "248 k€", score: 87, delta: "−9,2 %" },
  { city: "Toulouse", type: "Maison 110 m²", price: "289 k€", score: 84, delta: "−4,1 %" },
  { city: "Marseille 8ᵉ", type: "4P 92 m²", price: "392 k€", score: 81, delta: "−5,8 %" },
  { city: "Nantes", type: "Studio 24 m²", price: "132 k€", score: 79, delta: "−7,1 %" },
  { city: "Strasbourg", type: "3P 75 m²", price: "248 k€", score: 78, delta: "−6,0 %" },
  { city: "Rennes", type: "2P 44 m²", price: "168 k€", score: 76, delta: "−3,4 %" },
  { city: "Paris 11ᵉ", type: "3P 62 m²", price: "485 k€", score: 73 },
  { city: "Bordeaux", type: "3P 71 m²", price: "318 k€", score: 68 },
  { city: "Montpellier", type: "2P 50 m²", price: "212 k€", score: 62 },
  { city: "Lille", type: "3P 68 m²", price: "196 k€", score: 41 },
];

export type HowStep = {
  num: string;
  title: string;
  body: React.ReactNode;
};

export type ComparisonRow = {
  criterion: string;
  manual: string;
  immoscan: string;
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    criterion: "Collecte des annonces",
    manual: "Copier-coller manuel, ~3 h pour 10 biens.",
    immoscan: "Récupération auto depuis l'URL de ta recherche.",
  },
  {
    criterion: "Adresse exacte",
    manual: "Annonce floue, géolocalisation à l'œil.",
    immoscan: "DPE ADEME + reverse-BAN, indice de confiance par bien.",
  },
  {
    criterion: "Estimation prix marché",
    manual: "Recherche DVF cas par cas, écart calculé à la main.",
    immoscan: "DVF croisé automatiquement, écart % calculé.",
  },
  {
    criterion: "Vérification DPE",
    manual: "Annonce souvent fausse, vérif ADEME oubliée.",
    immoscan: "DPE officiel ADEME + GES.",
  },
  {
    criterion: "Simulation financière",
    manual: "Cashflow, rendement, mensualités — formule par bien.",
    immoscan: "Tes paramètres (apport, taux, TMI) appliqués à tous.",
  },
  {
    criterion: "Risques",
    manual: "Géorisques rarement consulté.",
    immoscan: "Inondation, retrait-gonflement, sismique inclus.",
  },
  {
    criterion: "Synthèse et tri",
    manual: "Filtres Excel, score à l'œil, biais cognitif.",
    immoscan: "Score 0–100 sur 6 critères, Top 5 argumenté par André.",
  },
  {
    criterion: "Suivi des visites",
    manual: "Notes éparpillées, dates oubliées.",
    immoscan: "Kanban À visiter → Signé, dates auto.",
  },
];

export type FaqItem = {
  q: string;
  a: React.ReactNode;
};

export type PricingPlan = {
  id: string;
  name: string;
  price: string;
  per: string;
  tagline: string;
  features: React.ReactNode[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
};

// Tarifs strictement alignés sur CLAUDE.md §12 (Free / Pro 49€ / Pro+ 99€
// / Business 249€). Le HTML handoff affiche d'autres chiffres marketing
// (39€ / 99€ / 449€) qu'on n'aligne PAS : la source de vérité est
// docs/01-spec-produit.md §Pricing.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "pro-plus",
    name: "Pro+",
    price: "99 €",
    per: "/ mois",
    tagline: "Multi-villes intensif",
    features: [
      "Analyses illimitées · jusqu'à 500 biens",
      "20 veilles quotidiennes",
      "Top 20 + thèse approfondie sur Top 5",
      "Historique illimité · export PDF + CSV",
    ],
    ctaLabel: "Passer Pro+",
    ctaHref: "/auth/signup?plan=pro-plus",
  },
  {
    id: "pro",
    name: "Pro",
    price: "49 €",
    per: "/ mois",
    tagline: "Investisseur particulier",
    featured: true,
    features: [
      "30 analyses / mois · 300 biens",
      "5 veilles hebdomadaires",
      "Top 10 avec thèse écrite par André · pipeline",
      "Historique 6 mois · export PDF + CSV",
    ],
    ctaLabel: "Essai 7 jours sans CB",
    ctaHref: "/auth/signup?plan=pro",
  },
  {
    id: "business",
    name: "Business",
    price: "249 €",
    per: "/ mois",
    tagline: "Marchands de biens · CGP · family offices",
    features: [
      "Analyses illimitées · 1 000 biens",
      "Veilles illimitées quotidiennes",
      "Top 30 + thèse approfondie sur tous",
      "5 utilisateurs · modèle Opus 4.7 · SLA",
    ],
    ctaLabel: "Nous contacter",
    ctaHref: "/contact?plan=business",
  },
];
