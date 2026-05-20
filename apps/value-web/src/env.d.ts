/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ⚠️ Toute variable préfixée VITE_ est EXPOSÉE au client.
  // Ne jamais préfixer une clé sensible. Les service_role et secrets
  // Stripe/Anthropic/Apify restent côté worker / Edge Function uniquement.
  //
  // ImmoValue partage le même projet Supabase qu'ImmoScan (auth unifiée).
  readonly VITE_SUPABASE_APP_URL: string;
  readonly VITE_SUPABASE_APP_ANON_KEY: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_SENTRY_DSN_WEB?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
