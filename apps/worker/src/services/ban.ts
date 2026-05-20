// Client BAN (Base Adresse Nationale) — géocodage avec cache 90j dans
// la table `ban_addresses_cache` du projet immoscan-data.
//
// Doc : https://adresse.data.gouv.fr/api-doc/adresse
// Rate limit officiel : 50 req/s. On reste conservateur à 10 req/s via
// PQueue (singleton module-level) pour ne pas se faire IP-ban.
//
// Cache key = la query normalisée (adresse_query est PK).

import PQueue from "p-queue";
import { z } from "zod";

import { supabaseData } from "@/lib/supabase";

const BAN_QUEUE = new PQueue({
  concurrency: 10,
  interval: 1000,
  intervalCap: 10,
});

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
const BAN_REVERSE_URL = "https://api-adresse.data.gouv.fr/reverse/";

// TTL cache 90 jours
const CACHE_TTL_DAYS = 90;

const banFeatureSchema = z.object({
  properties: z.object({
    id: z.string().optional(),
    label: z.string(),
    housenumber: z.string().optional(),
    street: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    citycode: z.string().optional(),
    context: z.string().optional(),
    type: z.string().optional(),
    score: z.number().optional(),
  }),
  geometry: z.object({
    coordinates: z.tuple([z.number(), z.number()]),
  }),
});

const banResponseSchema = z.object({
  features: z.array(banFeatureSchema),
});

export type BanGeocode = {
  query: string;
  label: string;
  housenumber: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  citycode: string | null;
  context: string | null;
  typeResult: string | null;
  latitude: number;
  longitude: number;
  score: number | null;
  fromCache: boolean;
};

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

async function readCache(query: string): Promise<BanGeocode | null> {
  const cutoff = new Date(
    Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabaseData
    .from("ban_addresses_cache")
    .select("*")
    .eq("adresse_query", query)
    .gt("cached_at", cutoff)
    .maybeSingle();
  if (error || !data) return null;
  if (data.lat === null || data.lng === null || !data.result_label) {
    return null;
  }
  return {
    query: data.adresse_query,
    label: data.result_label,
    housenumber: data.housenumber,
    street: data.street,
    postcode: data.postcode,
    city: data.city,
    citycode: data.citycode,
    context: data.context,
    typeResult: data.type_result,
    latitude: Number(data.lat),
    longitude: Number(data.lng),
    score: data.result_score !== null ? Number(data.result_score) : null,
    fromCache: true,
  };
}

async function writeCache(geo: Omit<BanGeocode, "fromCache">): Promise<void> {
  await supabaseData.from("ban_addresses_cache").upsert(
    {
      adresse_query: geo.query,
      result_label: geo.label,
      result_score: geo.score,
      housenumber: geo.housenumber,
      street: geo.street,
      postcode: geo.postcode,
      city: geo.city,
      citycode: geo.citycode,
      context: geo.context,
      type_result: geo.typeResult,
      lat: geo.latitude,
      lng: geo.longitude,
      // geom : généré via PostGIS trigger ou backfill séparé. On laisse
      // null à l'insert, le worker pourra le backfill.
      cached_at: new Date().toISOString(),
    },
    { onConflict: "adresse_query" },
  );
}

/**
 * Géocode une adresse en text. Throw si BAN répond 5xx ou si aucun
 * feature retourné. L'appelant gère le fallback.
 */
export async function banGeocode(rawQuery: string): Promise<BanGeocode> {
  const query = normalizeQuery(rawQuery);
  if (!query) throw new Error("banGeocode: query vide");

  const cached = await readCache(query);
  if (cached) return cached;

  const url = new URL(BAN_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");

  const json = await BAN_QUEUE.add(async () => {
    const res = await fetch(url, {
      headers: { "user-agent": "ImmoScan/1.0 (https://immoscan.fr)" },
    });
    if (!res.ok) {
      throw new Error(`BAN /search ${res.status}: ${await res.text()}`);
    }
    return res.json();
  });

  const parsed = banResponseSchema.parse(json);
  const first = parsed.features[0];
  if (!first) {
    throw new Error(`BAN: aucun résultat pour "${query}"`);
  }

  const geo: Omit<BanGeocode, "fromCache"> = {
    query,
    label: first.properties.label,
    housenumber: first.properties.housenumber ?? null,
    street: first.properties.street ?? null,
    postcode: first.properties.postcode ?? null,
    city: first.properties.city ?? null,
    citycode: first.properties.citycode ?? null,
    context: first.properties.context ?? null,
    typeResult: first.properties.type ?? null,
    latitude: first.geometry.coordinates[1],
    longitude: first.geometry.coordinates[0],
    score: first.properties.score ?? null,
  };

  await writeCache(geo);
  return { ...geo, fromCache: false };
}

export async function banReverse(
  latitude: number,
  longitude: number,
): Promise<BanGeocode | null> {
  const url = new URL(BAN_REVERSE_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const json = await BAN_QUEUE.add(async () => {
    const res = await fetch(url, {
      headers: { "user-agent": "ImmoScan/1.0 (https://immoscan.fr)" },
    });
    if (!res.ok) throw new Error(`BAN /reverse ${res.status}`);
    return res.json();
  });

  const parsed = banResponseSchema.parse(json);
  const first = parsed.features[0];
  if (!first) return null;

  return {
    query: `${latitude},${longitude}`,
    label: first.properties.label,
    housenumber: first.properties.housenumber ?? null,
    street: first.properties.street ?? null,
    postcode: first.properties.postcode ?? null,
    city: first.properties.city ?? null,
    citycode: first.properties.citycode ?? null,
    context: first.properties.context ?? null,
    typeResult: first.properties.type ?? null,
    latitude: first.geometry.coordinates[1],
    longitude: first.geometry.coordinates[0],
    score: first.properties.score ?? null,
    fromCache: false,
  };
}
