// Clients Supabase service_role pour le worker.
//
// Init lazy via Proxy : `createClient` n'est appelé qu'à la première
// utilisation. Sans ça, Trigger.dev v4 fail au build parce qu'il importe
// les task files avant que les secrets soient injectés (les vars d'env
// arrivent au runtime, pas au build).

import type { Database as AppDatabase } from "@immoscan/db/app";
import type { Database as DataDatabase } from "@immoscan/db/data";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import ws from "ws";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
  return value;
}

// Trigger.dev cloud tourne sur Node 21 (pas de WebSocket natif avant Node
// 22). Le client Supabase init un RealtimeClient au boot et fail sans
// transport explicite. On n'utilise pas Realtime côté worker, mais
// `createClient` l'initialise quand même → on passe `ws` pour éviter le
// crash. À supprimer quand Trigger.dev passera à Node 22+.
//
// `ws` implémente l'interface WebSocket runtime mais les types ne matchent
// pas exactement (ErrorEvent vs Event) → cast en any.
// any: ws est compatible runtime mais pas typage exact
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realtimeOpts = { transport: ws as any };

let _supabaseApp: SupabaseClient<AppDatabase> | null = null;
function getSupabaseApp(): SupabaseClient<AppDatabase> {
  if (!_supabaseApp) {
    _supabaseApp = createClient<AppDatabase>(
      requireEnv("SUPABASE_APP_URL"),
      requireEnv("SUPABASE_APP_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: realtimeOpts,
      },
    );
  }
  return _supabaseApp;
}

let _supabaseData: SupabaseClient<DataDatabase> | null = null;
function getSupabaseData(): SupabaseClient<DataDatabase> {
  if (!_supabaseData) {
    _supabaseData = createClient<DataDatabase>(
      requireEnv("SUPABASE_DATA_URL"),
      requireEnv("SUPABASE_DATA_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: realtimeOpts,
      },
    );
  }
  return _supabaseData;
}

// ────── Client immoscan-app (service_role, bypasse RLS) ──────
// Proxy : forward toutes les opérations au client réel (résolu au 1er accès).
export const supabaseApp = new Proxy({} as SupabaseClient<AppDatabase>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseApp(), prop, receiver);
  },
});

// ────── Client immoscan-data (service_role, read+write) ──────
export const supabaseData = new Proxy({} as SupabaseClient<DataDatabase>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseData(), prop, receiver);
  },
});
