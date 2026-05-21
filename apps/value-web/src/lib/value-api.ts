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
  // `supabase.functions.invoke` masque le body en cas d'erreur HTTP →
  // on perd les détails Zod (issues). On fetch directement pour pouvoir
  // remonter le vrai message au caller (qui l'affiche dans un bandeau).
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/value-estimer`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
  if (session?.access_token) {
    headers["authorization"] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const b = body as { error?: string; detail?: string; issues?: Array<{ path?: (string | number)[]; message?: string }> } | null;
    let msg = `${res.status}`;
    if (b?.error) msg += ` ${b.error}`;
    if (b?.detail) msg += ` — ${b.detail}`;
    if (b?.issues && b.issues.length > 0) {
      const summary = b.issues
        .slice(0, 3)
        .map((i) => `${(i.path ?? []).join(".") || "?"}: ${i.message ?? "?"}`)
        .join(" | ");
      msg += ` (${summary})`;
    }
    throw new Error(msg || text || "Edge Function error");
  }
  const data = body as EstimerResponse | null;
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
