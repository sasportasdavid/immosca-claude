// ────────────────────────────────────────────────────────────────────
// Edge Function : value-estimer
// ────────────────────────────────────────────────────────────────────
// POST /functions/v1/value-estimer
//
// Crée un bien ImmoValue et déclenche le pipeline d'estimation IA.
// L'endpoint accepte les requêtes anonymes (status `anonymous_draft`)
// ou authentifiées (status `suivi`).
//
// Si l'utilisateur fournit des `user_provided_urls` (annonces SeLoger /
// LBC à scraper), on déclenche d'abord `value-apify-user-comparables`
// qui orchestrera ensuite `value-build-estimation`. Sinon on appelle
// directement `value-build-estimation`.
//
// Body Zod : voir `_shared/value-bien-schema.ts`
//   {
//     "address": "12 rue de la Gare, 93220 Gagny",
//     "bien_data": { typologie, surface_carrez, ... },
//     "photos_urls": [...max 10],
//     "user_provided_urls": [...max 3]
//   }
//
// Réponse :
//   { bien_id: "uuid" }
//
// Sécurité :
//   - Bearer JWT optionnel (header `Authorization`)
//   - Rate limit best-effort en mémoire :
//       * 10 req / IP / heure pour les anonymes
//       * 50 req / user / heure pour les authentifiés
//     (cf. `_shared/rate-limit.ts` — TODO Upstash Redis en V2)
//
// Note sur le statut `anonymous_draft` :
//   La spec demande ce statut mais le CHECK constraint historique de
//   `value.biens.status` n'autorise que ('suivi','discret','public',
//   'vendu','retire'). La migration `value_anonymous_draft_status.sql`
//   (agent Schema) ajoute la valeur. Si elle n'est pas encore appliquée,
//   l'INSERT échouera avec code Postgres 23514 — on log et on retourne
//   500 pour que l'incident remonte clairement.
//
// Env requises :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   TRIGGER_API_URL (default https://api.trigger.dev)
//   TRIGGER_API_KEY
//
// Déploiement :
//   supabase functions deploy value-estimer --no-verify-jwt
//   (no-verify-jwt car endpoint public — on gère l'auth nous-mêmes)
// ────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any

import { ZodError } from "https://esm.sh/zod@3.23.8";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { valueEstimerBodySchema } from "../_shared/value-bien-schema.ts";
import {
  RateLimitError,
  assertRateLimit,
  clientIpFromRequest,
} from "../_shared/rate-limit.ts";
import { triggerTask } from "../_shared/trigger-dev.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json", ...extraHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createAdminClient();

  // 1) Résolution user (optionnelle) via Bearer JWT.
  const authHeader = req.headers.get("authorization");
  let userId: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice("Bearer ".length);
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data?.user) {
      return json(401, { error: "invalid_token" });
    }
    userId = data.user.id;
  }

  // 2) Rate limit.
  try {
    if (userId) {
      assertRateLimit(`value-estimer:user:${userId}`, {
        limit: 50,
        windowSeconds: 3600,
      });
    } else {
      const ip = clientIpFromRequest(req);
      assertRateLimit(`value-estimer:ip:${ip}`, {
        limit: 10,
        windowSeconds: 3600,
      });
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      return json(
        429,
        { error: "rate_limited", retry_after_seconds: err.retryAfterSeconds },
        { "retry-after": String(err.retryAfterSeconds) },
      );
    }
    throw err;
  }

  // 3) Parse + validation Zod.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  let body;
  try {
    body = valueEstimerBodySchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return json(400, { error: "validation_failed", issues: err.issues });
    }
    throw err;
  }

  // 4) INSERT value.biens via RPC publique.
  //
  // Le schéma `value` n'est pas exposé via PostgREST (sinon le SDK
  // rejette `.schema("value")` avec "Invalid schema: value"). On passe
  // donc par la fonction RPC `public.value_bien_create` (SECURITY
  // DEFINER) qui insère côté serveur. address_hash / lat / lng /
  // code_insee / code_iris sont initialisés à des placeholders dans
  // la RPC — le worker `value-build-estimation` se charge du
  // géocoding BAN + enrichissement IRIS post-insertion.
  const { data: newBienId, error: insertErr } = await admin.rpc(
    "value_bien_create",
    {
      p_user_id: userId, // peut être NULL pour anonymous_draft
      p_status: userId ? "suivi" : "anonymous_draft",
      p_address: body.address,
      p_bien_data: body.bien_data,
      p_photos_urls: body.photos_urls,
      p_user_provided_urls: body.user_provided_urls,
    },
  );

  if (insertErr || !newBienId) {
    console.error("[value-estimer] RPC value_bien_create failed:", insertErr);
    return json(500, {
      error: "insert_failed",
      detail: insertErr?.message ?? "unknown",
    });
  }

  const bien = { id: newBienId as string };

  // 5) Trigger.dev — pipeline async.
  //
  // On ne `await` PAS bloquant sur l'estimation elle-même : la task
  // peut prendre 30s+ (Apify, ADEME, Claude). Mais on attend la
  // *création du run* pour confirmer au client que tout est parti.
  try {
    if (body.user_provided_urls.length > 0) {
      await triggerTask("value-apify-user-comparables", {
        bien_id: bien.id,
        urls: body.user_provided_urls,
      });
    } else {
      await triggerTask("value-build-estimation", { bien_id: bien.id });
    }
  } catch (err) {
    // Le bien est inséré mais on n'a pas réussi à lancer la task.
    // On log et on renvoie quand même 202 (Accepted) : le worker
    // value-veille-marche cron rattrapera tout bien en `anonymous_draft`
    // / `suivi` sans valo après X minutes (à confirmer côté Workers).
    console.error("[value-estimer] trigger.dev failed (bien créé mais task non lancée):", err);
    return json(202, {
      bien_id: bien.id,
      warning: "task_trigger_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return json(200, { bien_id: bien.id });
});
