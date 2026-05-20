// useBanAutocomplete — appel réel à l'API publique BAN (api-adresse.data.gouv.fr).
//
// Aucune clé requise, rate limit 50 req/s (public). On debounce 300ms côté
// client pour ne pas saturer pendant la frappe et on cache 60s via React
// Query (les adresses ne changent pas).
//
// En cas d'erreur réseau ou de 5xx, on remonte une `Error` à l'appelant
// (le composant Input doit dégrader gracieusement : laisser taper l'adresse
// libre sans dropdown).

import { useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "./use-debounced-value";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type BanSuggestionType =
  | "housenumber"
  | "street"
  | "locality"
  | "municipality";

export interface BanSuggestion {
  /** Label complet "11 Allée des Sapins 93340 Le Raincy". */
  label: string;
  /** Code postal (5 chiffres). */
  postcode: string;
  /** Nom de la commune. */
  city: string;
  /** Latitude WGS84 (geometry.coordinates[1]). */
  lat: number;
  /** Longitude WGS84 (geometry.coordinates[0]). */
  lng: number;
  /** Code INSEE de la commune si renvoyé par BAN, sinon null. */
  codeInsee: string | null;
  /** Niveau de précision : housenumber > street > locality > municipality. */
  type: BanSuggestionType;
  /** Score BAN entre 0 et 1 (qualité du match). */
  score: number;
  /** Contexte département/région ("93, Seine-Saint-Denis, Île-de-France"). */
  context: string;
  /** ID stable BAN, utile comme React key. */
  id: string;
}

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

const BAN_ENDPOINT = "https://api-adresse.data.gouv.fr/search/";
const DEFAULT_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const DEFAULT_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 5_000;

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

interface BanFeatureGeometry {
  type: "Point";
  coordinates: [number, number];
}

interface BanFeatureProperties {
  label?: string;
  postcode?: string;
  city?: string;
  context?: string;
  citycode?: string;
  type?: string;
  score?: number;
  id?: string;
}

interface BanFeature {
  geometry: BanFeatureGeometry;
  properties: BanFeatureProperties;
}

interface BanResponse {
  features?: BanFeature[];
}

function isBanSuggestionType(t: string | undefined): t is BanSuggestionType {
  return (
    t === "housenumber" ||
    t === "street" ||
    t === "locality" ||
    t === "municipality"
  );
}

function normalizeFeature(f: BanFeature): BanSuggestion | null {
  const p = f.properties;
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  if (!p?.label) return null;

  const type: BanSuggestionType = isBanSuggestionType(p.type)
    ? p.type
    : "locality";

  return {
    label: p.label,
    postcode: p.postcode ?? "",
    city: p.city ?? "",
    lat: coords[1],
    lng: coords[0],
    codeInsee: p.citycode ?? null,
    type,
    score: typeof p.score === "number" ? p.score : 0,
    context: p.context ?? "",
    id: p.id ?? `${p.label}-${coords[0]}-${coords[1]}`,
  };
}

async function fetchBan(
  query: string,
  limit: number,
  autocomplete: boolean,
  signal?: AbortSignal,
): Promise<BanSuggestion[]> {
  const url = new URL(BAN_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("autocomplete", autocomplete ? "1" : "0");

  // AbortController custom pour ajouter un timeout côté client en plus
  // de l'éventuel signal React Query.
  const localCtrl = new AbortController();
  const onAbort = () => localCtrl.abort();
  signal?.addEventListener("abort", onAbort);
  const timeout = window.setTimeout(
    () => localCtrl.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: localCtrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`BAN API error: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as BanResponse;
    const features = json.features ?? [];
    return features
      .map(normalizeFeature)
      .filter((s): s is BanSuggestion => s !== null);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Résout une seule adresse en best-effort. Utilisé au submit du form quand
 * l'utilisateur a tapé du texte sans cliquer de suggestion.
 *
 * Renvoie `null` plutôt que de throw si BAN est down ou ne renvoie rien :
 * dans ce cas on laisse passer l'adresse texte libre (lat/lng à null) côté
 * appelant.
 */
export async function resolveBanAddress(
  query: string,
): Promise<BanSuggestion | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;
  try {
    const results = await fetchBan(trimmed, 1, false);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

export interface UseBanAutocompleteResult {
  suggestions: BanSuggestion[];
  isLoading: boolean;
  error: Error | null;
}

export function useBanAutocomplete(query: string): UseBanAutocompleteResult {
  const debounced = useDebouncedValue(query.trim(), DEFAULT_DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching, error } = useQuery<BanSuggestion[], Error>({
    queryKey: ["ban-autocomplete", debounced],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: ({ signal }) => fetchBan(debounced, DEFAULT_LIMIT, true, signal),
  });

  return {
    suggestions: data ?? [],
    isLoading: enabled && isFetching,
    error: error ?? null,
  };
}
