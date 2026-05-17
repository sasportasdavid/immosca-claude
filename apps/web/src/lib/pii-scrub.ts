// PII scrub helpers — utilisés par Sentry beforeSend / beforeBreadcrumb.
//
// Politique : aucune PII (Personally Identifiable Information) ne doit
// quitter le navigateur de l'utilisateur vers un service tiers. On filtre
// par PATTERN sur le nom de clé plutôt que par liste exhaustive — toute
// clé contenant l'un des fragments PII_KEY_PATTERNS est remplacée par
// '[Filtered]'. Si une nouvelle clé sensible apparaît avec un nom matchant
// un de ces patterns, elle est filtrée automatiquement.
//
// Patterns choisis :
// - "mail"   → email, user_email, x-user-mail, etc.
// - "phone"  → phone, phone_number, mobile_phone, etc.
// - "address"→ address, billing_address, ip_address
// - "postal" → postal_code, code_postal, postal
// - "numero" → numero, numero_rue, numero_telephone (équivalent FR)
//
// Ces helpers sont des fonctions pures, sans dépendance Sentry,
// pour pouvoir être testées en isolation (cf pii-scrub.test.ts).

export const PII_KEY_PATTERNS = [
  "mail",
  "phone",
  "address",
  "postal",
  "numero",
] as const;

export const REDACTED = "[Filtered]" as const;

/**
 * `true` si le nom de clé contient l'un des patterns PII (case-insensitive).
 */
export function isPiiKey(key: string): boolean {
  const k = key.toLowerCase();
  return PII_KEY_PATTERNS.some((p) => k.includes(p));
}

/**
 * Scrub récursif d'une valeur arbitraire.
 *
 * - Primitives (string, number, boolean, null, undefined) → préservées.
 * - Arrays → chaque élément scrubbé récursivement.
 * - Objects → chaque clé inspectée :
 *   - si la clé est PII → valeur remplacée par '[Filtered]'.
 *   - sinon → valeur scrubbée récursivement.
 *
 * Préserve la forme structurelle (pas de réordonnancement, conserve null
 * vs undefined). Ne traverse pas les prototypes (Object.entries).
 */
export function scrubObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => scrubObject(v));
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isPiiKey(k) ? REDACTED : scrubObject(v);
  }
  return out;
}

/**
 * Scrub des params PII dans une query string URL-encoded.
 * Conserve l'ordre des params. Retourne la chaîne d'origine si parsing échoue.
 */
export function scrubQueryString(qs: string | undefined): string | undefined {
  if (!qs) return qs;
  try {
    const params = new URLSearchParams(qs);
    let mutated = false;
    for (const key of Array.from(params.keys())) {
      if (isPiiKey(key)) {
        params.set(key, REDACTED);
        mutated = true;
      }
    }
    return mutated ? params.toString() : qs;
  } catch {
    return qs;
  }
}

/**
 * Scrub des query params PII dans une URL complète. Le path et le fragment
 * sont préservés.
 */
export function scrubUrl(url: string): string {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return url;
  const path = url.slice(0, qIndex);
  const rest = url.slice(qIndex + 1);
  const hashIndex = rest.indexOf("#");
  const qs = hashIndex === -1 ? rest : rest.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : rest.slice(hashIndex);
  const scrubbed = scrubQueryString(qs);
  return `${path}?${scrubbed}${hash}`;
}

/**
 * Scrub d'un objet `data` de breadcrumb fetch/xhr.
 * - Toutes les clés PII → '[Filtered]'
 * - data.url → query string scrubbée si présente
 */
export function scrubBreadcrumbData(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") return data;
  const scrubbed = scrubObject(data) as Record<string, unknown>;
  if (typeof scrubbed.url === "string") {
    scrubbed.url = scrubUrl(scrubbed.url);
  }
  return scrubbed;
}
