import { createClient } from "@supabase/supabase-js";
import type { Database as AppDatabase } from "@immoscan/db/app";
import type { Database as DataDatabase } from "@immoscan/db/data";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
  return value;
}

// ────── Client immoscan-app (service_role, bypasse RLS) ──────
// Lecture/écriture sur les tables transactionnelles. Utilisé par les tasks
// d'analyse et les webhooks Stripe.
export const supabaseApp = createClient<AppDatabase>(
  requireEnv("SUPABASE_APP_URL"),
  requireEnv("SUPABASE_APP_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ────── Client immoscan-data (service_role, read+write) ──────
// Accès complet réservé aux workers d'import (DVF, INSEE, Géorisques, etc.).
// Le frontend ne s'y connecte JAMAIS.
export const supabaseData = createClient<DataDatabase>(
  requireEnv("SUPABASE_DATA_URL"),
  requireEnv("SUPABASE_DATA_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
