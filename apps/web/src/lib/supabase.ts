import { createClient } from "@supabase/supabase-js";
import type { Database } from "@immoscan/db/app";

// Client Supabase pour le projet IMMOSCAN-APP (transactionnel).
// Ne JAMAIS instancier de client pour immoscan-data côté frontend.
// Les référentiels publics passent toujours par un worker.

const url = import.meta.env.VITE_SUPABASE_APP_URL;
const anonKey = import.meta.env.VITE_SUPABASE_APP_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Variables d'environnement Supabase manquantes : VITE_SUPABASE_APP_URL, VITE_SUPABASE_APP_ANON_KEY",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
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
