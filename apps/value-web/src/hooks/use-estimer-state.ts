// useEstimerState — état partagé entre les étapes du tunnel d'estimation.
//
// V1 stocke dans sessionStorage : pas besoin de zustand pour 4 étapes
// linéaires. Une remise à zéro propre est exposée pour relancer un
// nouveau bien.
//
// Toute donnée passe par cet état : on ne push pas via search params
// (les URLs du tunnel doivent rester courtes et partageables).

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "immovalue.estimer.v1";

export type EstimerBienType = "T1" | "T2" | "T3" | "T4" | "T5+" | "maison";

export type EstimerExposition =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SO"
  | "O"
  | "NO";

export type EstimerEtatGeneral =
  | "a_renover"
  | "travaux_moyens"
  | "bon_etat"
  | "refait"
  | "haut_de_gamme";

export type EstimerDpe = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface EstimerBienData {
  type: EstimerBienType | null;
  surface_carrez: number;
  pieces: number;
  chambres: number;
  etage: number | null;
  etage_total: number | null;
  ascenseur: boolean;
  exposition: EstimerExposition | null;
  balcon: boolean;
  terrasse: boolean;
  jardin: boolean;
  cave: boolean;
  parking: boolean;
  etat: EstimerEtatGeneral | null;
  dpe: EstimerDpe | null;
  dpe_auto: boolean;
  annee_construction: string;
  particularites: string;
}

export interface EstimerState {
  address: string;
  bien_data: EstimerBienData;
  photos_urls: string[];
  user_provided_urls: string[];
  // bien_id retourné par /estimer une fois l'API appelée.
  bien_id: string | null;
}

const defaultState: EstimerState = {
  address: "",
  bien_data: {
    type: "T3",
    surface_carrez: 62,
    pieces: 3,
    chambres: 2,
    etage: 3,
    etage_total: 5,
    ascenseur: false,
    exposition: "SO",
    balcon: true,
    terrasse: false,
    jardin: false,
    cave: true,
    parking: false,
    etat: "refait",
    dpe: "D",
    dpe_auto: true,
    annee_construction: "1972",
    particularites: "",
  },
  photos_urls: [],
  user_provided_urls: [],
  bien_id: null,
};

function readStorage(): EstimerState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<EstimerState>;
    return {
      ...defaultState,
      ...parsed,
      bien_data: { ...defaultState.bien_data, ...(parsed.bien_data ?? {}) },
    };
  } catch {
    return defaultState;
  }
}

function writeStorage(state: EstimerState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage indisponible — on continue silencieusement.
  }
}

export function useEstimerState() {
  const [state, setState] = useState<EstimerState>(() => readStorage());

  // Persist on every change.
  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const patch = useCallback(<K extends keyof EstimerState>(
    key: K,
    value: EstimerState[K],
  ) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const patchBien = useCallback((bien: Partial<EstimerBienData>) => {
    setState((s) => ({ ...s, bien_data: { ...s.bien_data, ...bien } }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultState);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    state,
    patch,
    patchBien,
    reset,
  };
}
