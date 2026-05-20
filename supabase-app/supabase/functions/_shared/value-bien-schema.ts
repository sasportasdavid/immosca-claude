// ────────────────────────────────────────────────────────────────────
// DUPLICATE (Deno-side) du schéma Zod BienData utilisé côté frontend.
// ────────────────────────────────────────────────────────────────────
// Les Edge Functions Supabase tournent en Deno isolé et ne peuvent pas
// importer le monorepo TS. La source de vérité reste
// `packages/shared/src/value/bien.ts` (sera créé par l'agent Schema).
// **Toute modif ici doit être répercutée dans le package shared.**
// (commit `chore: sync value-bien-schema`)
//
// Référence : IMMOVALUE_CLAUDE_CODE_SPEC.md §6.1 + Annexe A.
// ────────────────────────────────────────────────────────────────────

import { z } from "https://esm.sh/zod@3.23.8";

// Typologies (T1/T2/.../Maison/Loft/Studio…).
export const typologieSchema = z.enum([
  "Studio",
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6+",
  "Maison",
  "Loft",
  "Autre",
]);
export type Typologie = z.infer<typeof typologieSchema>;

export const dpeSchema = z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]);

export const etatGeneralSchema = z.enum([
  "neuf",
  "refait_a_neuf",
  "bon_etat",
  "rafraichir",
  "travaux",
  "lourds_travaux",
]);

// Caractéristiques d'un bien (équivalent JSON stocké dans `value.biens.bien_data`).
export const bienDataSchema = z.object({
  typologie: typologieSchema,
  surface_carrez: z.number().positive().max(2000),
  surface_habitable: z.number().positive().max(2000).optional(),
  surface_terrain: z.number().positive().max(100000).optional(),
  pieces: z.number().int().positive().max(30),
  chambres: z.number().int().min(0).max(20).optional(),
  sdb: z.number().int().min(0).max(10).optional(),
  etage: z.number().int().min(-2).max(60).optional(),
  etage_total: z.number().int().min(0).max(80).optional(),
  ascenseur: z.boolean().optional(),
  exposition: z
    .enum([
      "Nord",
      "Sud",
      "Est",
      "Ouest",
      "Nord-Est",
      "Nord-Ouest",
      "Sud-Est",
      "Sud-Ouest",
      "Traversant",
    ])
    .optional(),
  balcon: z.boolean().optional(),
  terrasse: z.boolean().optional(),
  jardin: z.boolean().optional(),
  cave: z.boolean().optional(),
  parking: z.boolean().optional(),
  box: z.boolean().optional(),
  etat_general: etatGeneralSchema.optional(),
  dpe: dpeSchema.optional(),
  ges: dpeSchema.optional(),
  annee_construction: z.number().int().min(1700).max(2100).optional(),
  type_chauffage: z
    .enum([
      "gaz",
      "electrique",
      "fioul",
      "pompe_chaleur",
      "bois",
      "collectif",
      "autre",
    ])
    .optional(),
  particularites: z.string().max(2000).optional(),
});
export type BienData = z.infer<typeof bienDataSchema>;

// Body du POST /value/estimer
export const valueEstimerBodySchema = z.object({
  address: z.string().min(3).max(500),
  bien_data: bienDataSchema,
  photos_urls: z.array(z.string().url()).max(10).default([]),
  user_provided_urls: z.array(z.string().url()).max(3).default([]),
});
export type ValueEstimerBody = z.infer<typeof valueEstimerBodySchema>;
