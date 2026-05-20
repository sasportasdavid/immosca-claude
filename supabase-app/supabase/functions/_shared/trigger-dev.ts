// ────────────────────────────────────────────────────────────────────
// Helper d'appel Trigger.dev v3 depuis les Edge Functions Deno.
// ────────────────────────────────────────────────────────────────────
// On utilise l'API REST `POST {baseUrl}/api/v1/tasks/{taskId}/trigger`
// avec Authorization: Bearer <TRIGGER_API_KEY>.
//
// Env requises côté Supabase :
//   TRIGGER_API_URL   (default https://api.trigger.dev)
//   TRIGGER_API_KEY   secret server token (tr_dev_... ou tr_prod_...)
//
// L'appel est best-effort : si Trigger.dev ne répond pas dans le délai
// imparti, on propage l'erreur au caller (qui peut décider de logger
// sans casser la requête utilisateur).
// ────────────────────────────────────────────────────────────────────

const TRIGGER_API_URL = Deno.env.get("TRIGGER_API_URL") ?? "https://api.trigger.dev";

export async function triggerTask(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<{ runId: string }> {
  const key = Deno.env.get("TRIGGER_API_KEY");
  if (!key) throw new Error("TRIGGER_API_KEY not set");

  const url = `${TRIGGER_API_URL}/api/v1/tasks/${taskId}/trigger`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    throw new Error(`trigger.dev ${taskId} → ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { id?: string };
  return { runId: json.id ?? "unknown" };
}
