import { supabase } from "@/lib/supabase";

// Wrapper minimal des Edge Functions ImmoValue.
//
// Convention : tout appel à un endpoint serveur ImmoValue passe par ce
// module pour centraliser la gestion d'erreur, le typage et la traçabilité.
// Les agents écrans NE FONT PAS d'appel à `supabase.functions.invoke()`
// directement — ils consomment ces helpers via leurs hooks `use-xxx`.

// ──────────────────────────────────────────────────────────────────
// Types I/O (à raffiner quand les schémas Zod V1 seront stabilisés
// dans @immoscan/shared/src/value/).
// ──────────────────────────────────────────────────────────────────

// Forme exacte attendue par l'Edge Function `value-estimer`
// (cf supabase-app/supabase/functions/_shared/value-bien-schema.ts).
// **Toute divergence fait planter la validation Zod côté serveur → 400.**

export type EstimerTypologie =
  | "Studio" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6+"
  | "Maison" | "Loft" | "Autre";

export type EstimerDpe = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "NC";

export type EstimerEtatGeneral =
  | "neuf" | "refait_a_neuf" | "bon_etat"
  | "rafraichir" | "travaux" | "lourds_travaux";

export type EstimerExposition =
  | "Nord" | "Sud" | "Est" | "Ouest"
  | "Nord-Est" | "Nord-Ouest" | "Sud-Est" | "Sud-Ouest"
  | "Traversant";

export type EstimerPayload = {
  address: string;
  bien_data: {
    typologie: EstimerTypologie;
    surface_carrez: number;
    surface_habitable?: number;
    surface_terrain?: number;
    pieces: number;
    chambres?: number;
    sdb?: number;
    etage?: number;
    etage_total?: number;
    ascenseur?: boolean;
    exposition?: EstimerExposition;
    balcon?: boolean;
    terrasse?: boolean;
    jardin?: boolean;
    cave?: boolean;
    parking?: boolean;
    box?: boolean;
    etat_general?: EstimerEtatGeneral;
    dpe?: EstimerDpe;
    ges?: EstimerDpe;
    annee_construction?: number;
    type_chauffage?:
      | "gaz" | "electrique" | "fioul" | "pompe_chaleur"
      | "bois" | "collectif" | "autre";
    particularites?: string;
  };
  photos_urls?: string[];
  user_provided_urls?: string[];
};

export type EstimerResponse = {
  bien_id: string;
};

export type BiensPublishResponse = {
  checkout_url?: string;
  payment_required: boolean;
};

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Lance une estimation ImmoValue pour un bien. Crée l'enregistrement
 * en DB et déclenche le job Trigger.dev de scoring/valorisation.
 *
 * Edge function : `value-estimer`.
 * Retourne le `bien_id` à utiliser pour suivre la progression et
 * afficher le résultat.
 */
export async function postEstimer(payload: EstimerPayload): Promise<EstimerResponse> {
  const { data, error } = await supabase.functions.invoke<EstimerResponse>(
    "value-estimer",
    { body: payload },
  );
  if (error) throw error;
  if (!data) throw new Error("value-estimer: réponse vide");
  return data;
}

/**
 * Publie un bien estimé sur la marketplace (ou déclenche le checkout
 * Stripe si paiement requis).
 *
 * Edge function : `value-biens-publish/:bien_id`.
 * - Si `payment_required: true` → ouvrir `checkout_url` côté client.
 * - Sinon publication immédiate.
 */
export async function postBiensPublish(bienId: string): Promise<BiensPublishResponse> {
  const { data, error } = await supabase.functions.invoke<BiensPublishResponse>(
    `value-biens-publish/${bienId}`,
    { method: "POST" },
  );
  if (error) throw error;
  if (!data) throw new Error("value-biens-publish: réponse vide");
  return data;
}
