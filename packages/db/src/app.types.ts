// ⚠️ AUTO-GENERATED — DO NOT EDIT MANUALLY
// Régénéré par `pnpm db:types:app`. Le placeholder ci-dessous permet au
// monorepo de compiler avant la première génération.
//
// Pour régénérer :
//   pnpm db:types:app
// (alias de : supabase gen types typescript --workdir supabase/app --schema public)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
