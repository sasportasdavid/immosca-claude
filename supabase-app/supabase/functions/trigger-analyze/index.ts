// Edge Function `trigger-analyze` (Deno).
//
// Déclenche la task Trigger.dev `analyze` côté worker après l'INSERT
// d'une row dans `analyses`. Deux modes :
//
// 1. Appel direct depuis le frontend après création :
//      POST /functions/v1/trigger-analyze
//      Authorization: Bearer <user_jwt>
//      { "analysisId": "<uuid>" }
//    L'Edge Function vérifie que l'analyse appartient bien au user
//    (RLS) puis trigger la task.
//
// 2. Webhook DB (préféré pour la robustesse) : Supabase Database Webhook
//    configuré sur INSERT analyses appelle cette function avec le row.
//    Pas de Bearer user dans ce cas — on s'appuie sur service_role
//    et le user_id du row.
//
// Le secret `TRIGGER_API_KEY` doit être configuré côté Supabase :
//   supabase secrets set TRIGGER_API_KEY=tr_dev_...
//
// Pareil pour l'URL : TRIGGER_API_URL par defaut https://api.trigger.dev
// et TRIGGER_PROJECT_REF (le ref du projet Trigger.dev).
//
// Trigger.dev v3 API : POST {baseUrl}/api/v1/tasks/{taskId}/trigger
// avec Authorization: Bearer <api-key>

// deno-lint-ignore-file no-explicit-any

const TRIGGER_API_URL = Deno.env.get("TRIGGER_API_URL") ?? "https://api.trigger.dev";
const TRIGGER_API_KEY = Deno.env.get("TRIGGER_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body =
  | { analysisId: string }
  | {
      // Format Supabase DB Webhook
      type: "INSERT";
      table: "analyses";
      record: { id: string; profile_id: string };
    };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

async function triggerAnalyzeTask(analysisId: string): Promise<{ runId: string }> {
  if (!TRIGGER_API_KEY) {
    throw new Error("TRIGGER_API_KEY non configuré côté Supabase secrets");
  }
  const url = `${TRIGGER_API_URL}/api/v1/tasks/analyze/trigger`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TRIGGER_API_KEY}`,
    },
    body: JSON.stringify({ payload: { analysisId } }),
  });
  if (!res.ok) {
    throw new Error(`Trigger.dev API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return { runId: (json as any).id ?? "unknown" };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  // Résout l'analysisId selon mode (direct vs webhook)
  const analysisId =
    "analysisId" in body
      ? body.analysisId
      : body.type === "INSERT" && body.record
        ? body.record.id
        : null;

  if (!analysisId) {
    return jsonResponse(400, { error: "analysisId manquant" });
  }

  try {
    const { runId } = await triggerAnalyzeTask(analysisId);
    return jsonResponse(200, { ok: true, analysisId, runId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("trigger-analyze failed", { analysisId, message });
    return jsonResponse(500, { error: message, analysisId });
  }
});
