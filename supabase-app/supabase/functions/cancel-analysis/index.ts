// Edge Function `cancel-analysis` (Deno).
//
// L'utilisateur appelle cette function pour annuler une analyse en
// cours. On :
//   1. Vérifie l'auth + ownership (RLS Supabase fait le filtre)
//   2. Lit `trigger_run_id` de l'analyse
//   3. Appelle l'API Trigger.dev pour cancel le run
//   4. Update analyses.status = 'canceled'
//
// L'utilisateur reçoit `{ ok: true }` immédiatement. Le worker, s'il
// reçoit le signal de cancel à temps, va terminer proprement. Sinon
// la DB est déjà en `canceled` et les updates suivantes du worker
// échoueront silencieusement (status final déjà set).

// deno-lint-ignore-file no-explicit-any

const TRIGGER_API_URL =
  Deno.env.get("TRIGGER_API_URL") ?? "https://api.trigger.dev";
const TRIGGER_API_KEY = Deno.env.get("TRIGGER_API_KEY");
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
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/analyses?id=eq.${analysisId}&select=id,status,trigger_run_id`,
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

  // 1) Cancel côté Trigger.dev si on a un run_id
  let triggerCanceled = false;
  if (analysis.trigger_run_id) {
    triggerCanceled = await cancelTriggerRun(analysis.trigger_run_id);
  }

  // 2) Update analysis status (service_role pour bypass RLS — c'est OK
  //    car on a déjà vérifié ownership via le lookup avec JWT user).
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

  return jsonResponse(200, { ok: true, analysisId, triggerCanceled });
});
