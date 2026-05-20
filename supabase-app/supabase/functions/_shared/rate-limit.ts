// ────────────────────────────────────────────────────────────────────
// Rate limiter — placeholder in-memory (TODO Upstash Redis en V2).
// ────────────────────────────────────────────────────────────────────
// Chaque instance Edge Function Deno isolée a sa propre Map → ce
// limiter est BEST-EFFORT et ne protège pas vraiment à l'échelle.
// Pour la V1 ImmoValue (trafic faible, endpoints publics rares),
// c'est acceptable. À remplacer par Upstash Redis dès qu'on a >100
// requêtes/min documentées.
//
// Interface volontairement identique à ce qu'on aurait avec Upstash :
//   `await assertRateLimit(key, { limit: 10, windowSeconds: 3600 })`
//
// En cas de dépassement → throw `RateLimitError` (HTTP 429 côté caller).
// ────────────────────────────────────────────────────────────────────

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("rate_limited");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export function assertRateLimit(key: string, opts: RateLimitOptions): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return;
  }

  if (bucket.count >= opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new RateLimitError(retryAfter);
  }

  bucket.count += 1;
}

// Util : récupère une clé IP best-effort depuis les headers Cloudflare /
// Supabase Edge (Deno Deploy).
export function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ??
    "unknown"
  );
}
