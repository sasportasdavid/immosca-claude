import type { AppDatabase } from "@immoscan/db";
import { createClient } from "@supabase/supabase-js";

// Client Supabase pour le projet IMMOSCAN-APP (transactionnel).
// ImmoValue partage le même projet Supabase qu'ImmoScan : un user
// ImmoScan = un user ImmoValue (auth unifiée).
// Les référentiels publics (immoscan-data) passent toujours par un worker.

const url = import.meta.env.VITE_SUPABASE_APP_URL;
const anonKey = import.meta.env.VITE_SUPABASE_APP_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Variables d'environnement Supabase manquantes : VITE_SUPABASE_APP_URL, VITE_SUPABASE_APP_ANON_KEY",
  );
}

export const supabase = createClient<AppDatabase>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
