// ImmoValue — module shared (Zod schemas + logique pure).
//
// Tout ce qui est importable depuis `@immoscan/shared/value` est ici.
// Pas de dépendance runtime sur Supabase/Apify/Anthropic — logique pure
// pour pouvoir être consommé côté worker ET côté frontend.

export * from "./dossier-builder.js";
export * from "./claude-valorisation.js";
