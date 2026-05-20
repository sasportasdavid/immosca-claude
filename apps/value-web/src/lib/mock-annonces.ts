// Mock annonces ImmoValue (vitrine V1).
//
// Données utilisées tant que la table `value.biens` est vide (ou que la
// vue `value.biens_publics` n'est pas encore alimentée). Quand on switchera
// sur la vraie data, les hooks `useAnnonces` / `useAnnonce` continueront
// à exposer le même `ValueBienPublic` — aucun composant à toucher.
//
// Toutes les valeurs respectent la convention de la vue publique :
// - `address_display` : chaîne anonymisée (mode discret) ou complète (public)
// - `lat_display` / `lng_display` : snappés au centroïde IRIS si discret
// - `bien_data` : Json avec surface (possiblement bucketée), etage bucketé...
// - `photos` : liste d'URLs floutées (discret) ou originales (public)
// - `valorisation_publique` : { low, high, currency, confidence }

import type { ValueBienPublic } from "@immoscan/db";

export type MockBienPublic = ValueBienPublic & {
  // Stats minimales attachées pour le compteur "live" — la vue actuelle
  // n'expose pas ces champs directement, mais on les inclut dans
  // `bien_data` pour la V1.
};

// Helper : forge un ValueBienPublic à partir d'un objet partiel.
function bien(
  id: string,
  fields: {
    status: "discret" | "public" | "vendu";
    address_display: string;
    lat: number;
    lng: number;
    code_iris: string;
    code_insee: string;
    bien_data: Record<string, unknown>;
    photos?: string[] | null;
    prix_affiche?: number | null;
    valorisation_publique?: {
      low: number;
      high: number;
      currency: "EUR";
      confidence: number;
    } | null;
    description_publique?: string | null;
    favoris_actifs?: number;
    vues_total?: number;
    vues_7j?: number;
    discret_started_at?: string | null;
    published_at?: string | null;
  },
): ValueBienPublic {
  return {
    id,
    status: fields.status,
    address_display: fields.address_display,
    lat_display: fields.lat,
    lng_display: fields.lng,
    code_iris: fields.code_iris,
    code_insee: fields.code_insee,
    bien_data: fields.bien_data as never, // Json: cast safe (objet plat)
    photos: fields.photos ?? null,
    prix_affiche: fields.prix_affiche ?? null,
    valorisation_publique: (fields.valorisation_publique ?? null) as never,
    description_publique: fields.description_publique ?? null,
    favoris_actifs: fields.favoris_actifs ?? 0,
    vues_total: fields.vues_total ?? 0,
    vues_7j: fields.vues_7j ?? 0,
    discret_started_at: fields.discret_started_at ?? null,
    published_at: fields.published_at ?? null,
  };
}

export const MOCK_ANNONCES: ValueBienPublic[] = [
  bien("iv-3041", {
    status: "discret",
    address_display: "Le Chénay, Gagny (93220)",
    lat: 48.8825,
    lng: 2.5295,
    code_iris: "930320101",
    code_insee: "93032",
    bien_data: {
      type: "appartement",
      pieces: 3,
      chambres: 2,
      surface_bucket: "60-70",
      etage_bucket: "2-4",
      dpe: "D",
      ges: "C",
      exposition: "SO",
      balcon: true,
      cave: true,
      etat: "refait",
    },
    photos: null, // floutées → placeholder
    prix_affiche: 319_000,
    valorisation_publique: {
      low: 290_000,
      high: 330_000,
      currency: "EUR",
      confidence: 0.81,
    },
    description_publique:
      "T3 lumineux refait à neuf, balcon Sud-Ouest, proche RER E (8 min).",
    favoris_actifs: 18,
    vues_total: 142,
    vues_7j: 47,
    discret_started_at: "2026-05-08T00:00:00.000Z",
  }),
  bien("iv-3042", {
    status: "public",
    address_display: "12 rue de la Gare, Gagny (93220)",
    lat: 48.8819,
    lng: 2.5298,
    code_iris: "930320101",
    code_insee: "93032",
    bien_data: {
      type: "appartement",
      pieces: 3,
      chambres: 2,
      surface: 62,
      etage: 3,
      dpe: "D",
      ges: "C",
      exposition: "SO",
      balcon: true,
      cave: true,
      etat: "refait",
    },
    photos: [
      // Placeholders : pas d'URL réelle, la card affichera bg-photo-bg
    ],
    prix_affiche: 305_000,
    valorisation_publique: {
      low: 290_000,
      high: 330_000,
      currency: "EUR",
      confidence: 0.84,
    },
    description_publique:
      "T3 62 m² refait à neuf, balcon plein sud, 5 min à pied du RER.",
    favoris_actifs: 9,
    vues_total: 86,
    vues_7j: 23,
    published_at: "2026-05-12T10:00:00.000Z",
  }),
  bien("iv-3043", {
    status: "discret",
    address_display: "Centre-ville, Saint-Denis (93200)",
    lat: 48.9356,
    lng: 2.3539,
    code_iris: "930660101",
    code_insee: "93066",
    bien_data: {
      type: "appartement",
      pieces: 2,
      chambres: 1,
      surface_bucket: "40-50",
      etage_bucket: "5+",
      dpe: "E",
      ges: "D",
      exposition: "E",
      etat: "à rafraîchir",
    },
    photos: null,
    prix_affiche: 210_000,
    valorisation_publique: {
      low: 195_000,
      high: 235_000,
      currency: "EUR",
      confidence: 0.74,
    },
    description_publique: null,
    favoris_actifs: 7,
    vues_total: 54,
    vues_7j: 19,
    discret_started_at: "2026-05-14T00:00:00.000Z",
  }),
  bien("iv-3044", {
    status: "public",
    address_display: "44 rue de Paris, Montreuil (93100)",
    lat: 48.8638,
    lng: 2.4434,
    code_iris: "930480101",
    code_insee: "93048",
    bien_data: {
      type: "appartement",
      pieces: 4,
      chambres: 3,
      surface: 84,
      etage: 2,
      dpe: "C",
      ges: "B",
      exposition: "SE",
      balcon: true,
      etat: "refait",
    },
    photos: [],
    prix_affiche: 525_000,
    valorisation_publique: {
      low: 500_000,
      high: 550_000,
      currency: "EUR",
      confidence: 0.88,
    },
    description_publique:
      "Bel appartement familial refait, balcon, métro Croix de Chavaux 4 min.",
    favoris_actifs: 12,
    vues_total: 198,
    vues_7j: 41,
    published_at: "2026-05-05T10:00:00.000Z",
  }),
  bien("iv-3045", {
    status: "discret",
    address_display: "Buttes-Chaumont, Paris 19e (75019)",
    lat: 48.8801,
    lng: 2.3825,
    code_iris: "751190101",
    code_insee: "75119",
    bien_data: {
      type: "appartement",
      pieces: 3,
      chambres: 2,
      surface_bucket: "55-65",
      etage_bucket: "2-4",
      dpe: "D",
      ges: "C",
      exposition: "SO",
      cave: true,
      etat: "bon état",
    },
    photos: null,
    prix_affiche: 615_000,
    valorisation_publique: {
      low: 580_000,
      high: 640_000,
      currency: "EUR",
      confidence: 0.79,
    },
    description_publique: null,
    favoris_actifs: 31,
    vues_total: 412,
    vues_7j: 89,
    discret_started_at: "2026-05-02T00:00:00.000Z",
  }),
  bien("iv-3046", {
    status: "public",
    address_display: "8 quai Claude-Bernard, Lyon 7e (69007)",
    lat: 45.7448,
    lng: 4.8413,
    code_iris: "693870101",
    code_insee: "69387",
    bien_data: {
      type: "appartement",
      pieces: 3,
      chambres: 2,
      surface: 68,
      etage: 4,
      dpe: "C",
      ges: "B",
      exposition: "O",
      balcon: true,
      cave: true,
      etat: "refait",
    },
    photos: [],
    prix_affiche: 365_000,
    valorisation_publique: {
      low: 350_000,
      high: 385_000,
      currency: "EUR",
      confidence: 0.86,
    },
    description_publique:
      "T3 lumineux quai du Rhône, balcon plein ouest, vue dégagée.",
    favoris_actifs: 15,
    vues_total: 167,
    vues_7j: 32,
    published_at: "2026-05-10T10:00:00.000Z",
  }),
  bien("iv-3047", {
    status: "discret",
    address_display: "Saint-Charles, Marseille 13003 (13003)",
    lat: 43.3047,
    lng: 5.3853,
    code_iris: "132030101",
    code_insee: "13203",
    bien_data: {
      type: "appartement",
      pieces: 4,
      chambres: 3,
      surface_bucket: "75-85",
      etage_bucket: "2-4",
      dpe: "F",
      ges: "E",
      exposition: "S",
      etat: "à rénover",
    },
    photos: null,
    prix_affiche: 175_000,
    valorisation_publique: {
      low: 160_000,
      high: 195_000,
      currency: "EUR",
      confidence: 0.72,
    },
    description_publique: null,
    favoris_actifs: 4,
    vues_total: 38,
    vues_7j: 14,
    discret_started_at: "2026-05-16T00:00:00.000Z",
  }),
  bien("iv-3048", {
    status: "public",
    address_display: "23 rue du Faubourg, Lille (59000)",
    lat: 50.6353,
    lng: 3.0701,
    code_iris: "593500101",
    code_insee: "59350",
    bien_data: {
      type: "maison",
      pieces: 5,
      chambres: 4,
      surface: 112,
      dpe: "E",
      ges: "D",
      jardin: true,
      etat: "bon état",
    },
    photos: [],
    prix_affiche: 285_000,
    valorisation_publique: {
      low: 270_000,
      high: 305_000,
      currency: "EUR",
      confidence: 0.81,
    },
    description_publique:
      "Maison 1930 avec jardin 80 m², proche métro Wazemmes.",
    favoris_actifs: 22,
    vues_total: 256,
    vues_7j: 53,
    published_at: "2026-05-08T10:00:00.000Z",
  }),
];

export function findMockAnnonce(bienId: string): ValueBienPublic | null {
  return MOCK_ANNONCES.find((a) => a.id === bienId) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// Comparables DVF mock — utilisés sur la page bien tant que la query
// `immoscan-data.dvf_mutations` n'est pas câblée (passe par un worker).
// ────────────────────────────────────────────────────────────────────

export type ComparableDvf = {
  id: string;
  type: "appartement" | "maison";
  pieces: number;
  surface: number;
  etage: number | null;
  etat: string | null;
  secteur: string;
  prix: number;
  prix_m2: number;
  date: string; // "mars 2025"
};

export const MOCK_COMPARABLES_DVF: Record<string, ComparableDvf[]> = {
  "iv-3041": [
    { id: "dvf-1", type: "appartement", pieces: 3, surface: 61, etage: 3, etat: "refait", secteur: "Chénay", prix: 285_000, prix_m2: 4_672, date: "mars 2025" },
    { id: "dvf-2", type: "appartement", pieces: 3, surface: 63, etage: 2, etat: "bon état", secteur: "Chénay", prix: 302_000, prix_m2: 4_793, date: "nov. 2024" },
    { id: "dvf-3", type: "appartement", pieces: 3, surface: 60, etage: 4, etat: "refait", secteur: "Chénay", prix: 298_000, prix_m2: 4_966, date: "sept. 2024" },
    { id: "dvf-4", type: "appartement", pieces: 3, surface: 65, etage: 2, etat: "à rafraîchir", secteur: "Maison Blanche", prix: 279_000, prix_m2: 4_292, date: "juin 2024" },
    { id: "dvf-5", type: "appartement", pieces: 3, surface: 64, etage: 3, etat: "refait", secteur: "Chénay", prix: 315_000, prix_m2: 4_921, date: "janv. 2024" },
  ],
  "iv-3042": [
    { id: "dvf-1", type: "appartement", pieces: 3, surface: 61, etage: 3, etat: "refait", secteur: "Chénay", prix: 285_000, prix_m2: 4_672, date: "mars 2025" },
    { id: "dvf-2", type: "appartement", pieces: 3, surface: 63, etage: 2, etat: "bon état", secteur: "Chénay", prix: 302_000, prix_m2: 4_793, date: "nov. 2024" },
    { id: "dvf-3", type: "appartement", pieces: 3, surface: 60, etage: 4, etat: "refait", secteur: "Chénay", prix: 298_000, prix_m2: 4_966, date: "sept. 2024" },
  ],
};

export function findMockComparables(bienId: string): ComparableDvf[] {
  return MOCK_COMPARABLES_DVF[bienId] ?? [];
}
