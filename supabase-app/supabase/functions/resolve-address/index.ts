// Edge Function `resolve-address` (Deno).
//
// Endpoint pour le module "Adresse à partir d'un lien" :
//   POST /functions/v1/resolve-address
//   Authorization: Bearer <user_jwt>
//   { "url": "https://www.leboncoin.fr/ad/ventes_immobilieres/123" }
//
// Workflow :
//   1. Auth user (sinon 401)
//   2. Vérifie rate limit via RPC `can_lookup_address` (5/jour Free)
//   3. Hash l'URL et check cache : si lookup `done` existe (<7j),
//      return son id directement → pas de re-scrape, instantané
//   4. Sinon : INSERT row pending + triggers la task `resolve-address`
//   5. Return l'id du lookup → frontend poll la row
//
// Le secret `TRIGGER_API_KEY` est partagé avec trigger-analyze.

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

/**
 * Normalise une URL pour le cache : lowercase, trim trailing slash,
 * supprime les utm_* et autres query strings non-fonctionnelles.
 */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    // Drop noise params
    const noise = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref", "fbclid", "gclid"];
    for (const n of noise) u.searchParams.delete(n);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function detectSite(url: string):
  | "seloger"
  | "leboncoin"
  | "pap"
  | "bienici"
  | "logic_immo"
  | null {
  if (/seloger\.com/i.test(url)) return "seloger";
  if (/leboncoin\.fr/i.test(url)) return "leboncoin";
  if (/(?:^|\.)pap\.fr/i.test(url)) return "pap";
  if (/bienici\.com/i.test(url)) return "bienici";
  if (/logic-immo\.com/i.test(url)) return "logic_immo";
  return null;
}

async function triggerResolveAddressTask(lookupId: string): Promise<string> {
  if (!TRIGGER_API_KEY) {
    throw new Error("TRIGGER_API_KEY non configuré côté Supabase secrets");
  }
  const url = `${TRIGGER_API_URL}/api/v1/tasks/resolve-address/trigger`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TRIGGER_API_KEY}`,
    },
    body: JSON.stringify({ payload: { lookupId } }),
  });
  if (!res.ok) {
    throw new Error(`Trigger.dev ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return (json as any).id ?? "unknown";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const inputUrl = (body.url ?? "").trim();
  if (!inputUrl || !/^https?:\/\//i.test(inputUrl)) {
    return jsonResponse(400, { error: "URL invalide" });
  }

  const site = detectSite(inputUrl);
  if (!site) {
    return jsonResponse(400, {
      error:
        "Site non supporté. Sites acceptés : LeBonCoin, PAP, SeLoger, Bien'ici.",
    });
  }

  // Auth user JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Non authentifié" });
  }

  // Get user id via supabase auth/v1/user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: authHeader,
    },
  });
  if (!userRes.ok) {
    return jsonResponse(401, { error: "Token invalide" });
  }
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) {
    return jsonResponse(401, { error: "User id manquant" });
  }
  const profileId = user.id;

  const normalized = normalizeUrl(inputUrl);
  const urlHash = await sha256Hex(normalized);

  // 1. Check cache (any user's recent done lookup — partagé volontairement
  //    pour économiser les coûts Apify, l'adresse n'est pas du PII).
  //
  // IMPORTANT : on n'inclut PAS les résultats avec resolution_source=none
  // qui sont des "échecs déguisés" (le pipeline n'a rien trouvé de précis
  // et a juste retourné ville+CP par fallback URL). Servir ces lookups en
  // cache empêcherait toute nouvelle tentative — alors qu'on veut justement
  // pouvoir retry (PAP par exemple où le scraping est instable).
  const cacheRes = await fetch(
    `${SUPABASE_URL}/rest/v1/address_lookups?url_hash=eq.${urlHash}&status=eq.done&resolution_source=in.(ademe,ban_reverse,scraped)&expires_at=gt.now&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (cacheRes.ok) {
    const cached = (await cacheRes.json()) as Array<{
      id: string;
      address: string | null;
    }>;
    if (cached.length > 0 && cached[0].address) {
      // Cache hit : on clone la row pour l'user (sa propre history)
      // mais on copie le résultat direct → status=done immédiatement.
      const src = cached[0]!;
      const cloneRes = await fetch(`${SUPABASE_URL}/rest/v1/address_lookups`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "content-type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          profile_id: profileId,
          url: inputUrl,
          url_hash: urlHash,
          source_site: site,
          status: "done",
          // Copie tous les champs résultat depuis la row source
          ...(await fetchLookupFull(src.id)),
        }),
      });
      if (cloneRes.ok) {
        const [row] = await cloneRes.json();
        return jsonResponse(200, {
          ok: true,
          lookupId: row.id,
          cached: true,
        });
      }
    }
  }

  // 2. Rate limit (Free user uniquement)
  const rateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/can_lookup_address`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_profile_id: profileId }),
    },
  );
  if (rateRes.ok) {
    const rate = (await rateRes.json()) as {
      allowed: boolean;
      remaining: number | null;
      reason: string | null;
    };
    if (!rate.allowed) {
      return jsonResponse(429, {
        error: rate.reason ?? "Rate limit atteint",
        rateLimited: true,
      });
    }
  }

  // 3. Insert row pending
  const insertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/address_lookups`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        profile_id: profileId,
        url: inputUrl,
        url_hash: urlHash,
        source_site: site,
        status: "pending",
      }),
    },
  );
  if (!insertRes.ok) {
    const text = await insertRes.text();
    return jsonResponse(500, {
      error: `Insert lookup failed: ${insertRes.status} ${text}`,
    });
  }
  const [lookup] = (await insertRes.json()) as Array<{ id: string }>;

  // 4. Trigger task
  try {
    const triggerRunId = await triggerResolveAddressTask(lookup.id);
    await fetch(
      `${SUPABASE_URL}/rest/v1/address_lookups?id=eq.${lookup.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ trigger_run_id: triggerRunId }),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await fetch(
      `${SUPABASE_URL}/rest/v1/address_lookups?id=eq.${lookup.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "failed",
          error_message: message.slice(0, 500),
          completed_at: new Date().toISOString(),
        }),
      },
    );
    return jsonResponse(500, { error: `Trigger failed: ${message}` });
  }

  return jsonResponse(200, {
    ok: true,
    lookupId: lookup.id,
    cached: false,
  });
});

/**
 * Récupère tous les champs résultat d'un lookup pour les copier dans
 * une nouvelle row (cache hit pour un autre user).
 */
async function fetchLookupFull(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/address_lookups?id=eq.${id}&select=address,lat,lng,city,postal_code,resolution_source,confidence,listing_title,listing_price,listing_surface,listing_dpe,source_site,apify_run_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) return {};
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  if (rows.length === 0) return {};
  return { ...rows[0], completed_at: new Date().toISOString() };
}
