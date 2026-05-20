// Edge Function `cancel-analysis` (Deno).
//
// L'utilisateur appelle cette function pour annuler une analyse en
// cours. On :
//   1. Vérifie l'auth + ownership (RLS Supabase fait le filtre)
//   2. Update analyses.status = 'canceled' EN PREMIER (signal pour le
//      worker via `shouldAbort` qui poll cette colonne)
//   3. Appelle l'API Apify pour abort tous les runs en cours
//      (`apify_run_ids[]` — multi-URL peut avoir 4+ runs en parallèle)
//   4. Appelle l'API Trigger.dev pour cancel la task worker
//
// Ordre important : on set canceled AVANT d'appeler Apify, comme ça
// même si l'edge fn timeout sur les calls Apify, le worker verra
// `status=canceled` à son prochain poll (5s max) et s'arrêtera tout
// seul. L'abort Apify est juste pour accélérer l'arrêt facturation.

// deno-lint-ignore-file no-explicit-any

const TRIGGER_API_URL =
  Deno.env.get("TRIGGER_API_URL") ?? "https://api.trigger.dev";
const TRIGGER_API_KEY = Deno.env.get("TRIGGER_API_KEY");
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const APIFY_API_BASE = "https://api.apify.com/v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

async function cancelTriggerRun(runId: string): Promise<boolean> {
  if (!TRIGGER_API_KEY) return false;
  try {
    const res = await fetch(`${TRIGGER_API_URL}/api/v2/runs/${runId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TRIGGER_API_KEY}` },
    });
    // 200 = canceled, 404 = run inconnu (déjà terminé probablement),
    // 409 = déjà dans un état final. Tous acceptables.
    return res.ok || res.status === 404 || res.status === 409;
  } catch (err) {
    console.error("cancel trigger run failed", err);
    return false;
  }
}

/**
 * Abort un run Apify en cours pour stopper la facturation immédiatement.
 * POST /v2/actor-runs/{id}/abort, code 200 si OK, 400/404 si déjà terminal.
 */
async function abortApifyRun(runId: string): Promise<boolean> {
  if (!APIFY_TOKEN) return false;
  try {
    const res = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}/abort`, {
      method: "POST",
      headers: { Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    return res.ok || res.status === 400 || res.status === 404;
  } catch (err) {
    console.error(`abort apify run ${runId} failed`, err);
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: { analysisId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const analysisId = body.analysisId;
  if (!analysisId) {
    return jsonResponse(400, { error: "analysisId requis" });
  }

  // Auth user JWT — on l'utilise pour vérifier ownership via RLS.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Non authentifié" });
  }

  // Lookup l'analyse avec le JWT user (RLS filtrera si pas owner).
  // On récupère :
  //  - trigger_run_id : pour cancel la task Trigger.dev
  //  - apify_run_id (legacy) + apify_run_ids[] (multi-URL) : pour
  //    abort tous les runs Apify en cours et arrêter la facturation
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/analyses?id=eq.${analysisId}&select=id,status,trigger_run_id,apify_run_id,apify_run_ids`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    },
  );
  if (!lookupRes.ok) {
    return jsonResponse(500, { error: `Lookup failed: ${lookupRes.status}` });
  }
  const rows = (await lookupRes.json()) as Array<{
    id: string;
    status: string;
    trigger_run_id: string | null;
    apify_run_id: string | null;
    apify_run_ids: string[] | null;
  }>;
  if (rows.length === 0) {
    return jsonResponse(404, { error: "Analyse introuvable" });
  }
  const analysis = rows[0]!;

  if (
    analysis.status === "done" ||
    analysis.status === "failed" ||
    analysis.status === "canceled"
  ) {
    return jsonResponse(200, {
      ok: true,
      analysisId,
      alreadyTerminal: true,
      status: analysis.status,
    });
  }

  // 1) Update status='canceled' EN PREMIER. C'est le signal que le worker
  //    poll via `shouldAbort` toutes les 5s — même si nos appels Apify/
  //    Trigger.dev ci-dessous timeout, le worker s'arrêtera tout seul.
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/analyses?id=eq.${analysisId}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "canceled",
        error_message: "Annulée par l'utilisateur",
        completed_at: new Date().toISOString(),
      }),
    },
  );
  if (!updateRes.ok) {
    return jsonResponse(500, {
      error: `Update failed: ${updateRes.status}`,
    });
  }

  // 2) Abort tous les runs Apify en parallèle pour stopper la facturation.
  //    Union de `apify_run_id` (legacy) + `apify_run_ids[]` (multi-URL),
  //    dédup au cas où le legacy a été dupliqué dans le tableau.
  const apifyRunIds = Array.from(
    new Set(
      [
        ...(analysis.apify_run_ids ?? []),
        ...(analysis.apify_run_id ? [analysis.apify_run_id] : []),
      ].filter((s): s is string => !!s),
    ),
  );
  const apifyResults = await Promise.all(apifyRunIds.map(abortApifyRun));
  const apifyAborted = apifyResults.filter(Boolean).length;

  // 3) Cancel la task worker côté Trigger.dev. Le worker peut très bien
  //    déjà être en train de s'arrêter via `shouldAbort` — cet appel
  //    finit de tuer la task si elle est encore en cours.
  let triggerCanceled = false;
  if (analysis.trigger_run_id) {
    triggerCanceled = await cancelTriggerRun(analysis.trigger_run_id);
  }

  return jsonResponse(200, {
    ok: true,
    analysisId,
    triggerCanceled,
    apifyRunsAborted: apifyAborted,
    apifyRunsAttempted: apifyRunIds.length,
  });
});
