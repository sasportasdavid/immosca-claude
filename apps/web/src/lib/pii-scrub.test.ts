import { describe, expect, it } from "vitest";

import {
  REDACTED,
  isPiiKey,
  scrubBreadcrumbData,
  scrubObject,
  scrubQueryString,
  scrubUrl,
} from "./pii-scrub";

describe("isPiiKey", () => {
  it("matches keys containing PII patterns (case-insensitive)", () => {
    expect(isPiiKey("email")).toBe(true);
    expect(isPiiKey("user_email")).toBe(true);
    expect(isPiiKey("X-User-Mail")).toBe(true);
    expect(isPiiKey("phone")).toBe(true);
    expect(isPiiKey("phone_number")).toBe(true);
    expect(isPiiKey("address")).toBe(true);
    expect(isPiiKey("billing_address")).toBe(true);
    expect(isPiiKey("ip_address")).toBe(true);
    expect(isPiiKey("postal_code")).toBe(true);
    expect(isPiiKey("code_postal")).toBe(true);
    expect(isPiiKey("numero")).toBe(true);
    expect(isPiiKey("numero_rue")).toBe(true);
  });

  it("does not match safe keys", () => {
    expect(isPiiKey("id")).toBe(false);
    expect(isPiiKey("user_id")).toBe(false);
    expect(isPiiKey("name")).toBe(false);
    expect(isPiiKey("plan")).toBe(false);
    expect(isPiiKey("created_at")).toBe(false);
    expect(isPiiKey("score")).toBe(false);
    expect(isPiiKey("count")).toBe(false);
  });
});

describe("scrubObject", () => {
  it("filters PII keys at the top level", () => {
    const input = { id: "u_1", email: "foo@bar.com", phone: "+33612345678" };
    expect(scrubObject(input)).toEqual({
      id: "u_1",
      email: REDACTED,
      phone: REDACTED,
    });
  });

  it("recurses into nested objects", () => {
    const input = {
      user: { id: "u_1", email: "foo@bar.com" },
      meta: { address: "10 rue X", city: "Paris" },
    };
    expect(scrubObject(input)).toEqual({
      user: { id: "u_1", email: REDACTED },
      meta: { address: REDACTED, city: "Paris" },
    });
  });

  it("recurses into arrays", () => {
    const input = {
      users: [
        { id: "u_1", email: "a@b.fr" },
        { id: "u_2", email: "c@d.fr" },
      ],
    };
    expect(scrubObject(input)).toEqual({
      users: [
        { id: "u_1", email: REDACTED },
        { id: "u_2", email: REDACTED },
      ],
    });
  });

  it("preserves primitives and null/undefined", () => {
    expect(scrubObject("hello")).toBe("hello");
    expect(scrubObject(42)).toBe(42);
    expect(scrubObject(true)).toBe(true);
    expect(scrubObject(null)).toBe(null);
    expect(scrubObject(undefined)).toBe(undefined);
  });

  it("does not mutate the input", () => {
    const input = { email: "foo@bar.com", id: "u_1" };
    const before = JSON.stringify(input);
    scrubObject(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("handles keys whose VALUE contains PII but key is safe", () => {
    // Politique : on filtre par nom de clé, pas par contenu. Une URL
    // contenant un email dans le path n'est PAS filtrée par scrubObject
    // (c'est intentionnel : trop d'inférence sur le contenu = faux
    // positifs). C'est à l'appelant d'utiliser scrubUrl quand la clé est
    // safe mais la valeur transporte de la PII via query string.
    const input = { url: "https://api.example.com/users?email=foo@bar.com" };
    const output = scrubObject(input) as { url: string };
    expect(output.url).toBe("https://api.example.com/users?email=foo@bar.com");
  });
});

describe("scrubQueryString", () => {
  it("redacts PII params", () => {
    const out = scrubQueryString("email=foo%40bar.com&page=2");
    expect(out).toContain(`email=${encodeURIComponent(REDACTED)}`);
    expect(out).toContain("page=2");
  });

  it("redacts French-style params", () => {
    const out = scrubQueryString("numero=42&code_postal=75011&ville=Paris");
    expect(out).toContain(`numero=${encodeURIComponent(REDACTED)}`);
    expect(out).toContain(`code_postal=${encodeURIComponent(REDACTED)}`);
    expect(out).toContain("ville=Paris");
  });

  it("returns input unchanged when no PII present", () => {
    expect(scrubQueryString("page=2&sort=score")).toBe("page=2&sort=score");
  });

  it("handles empty/undefined", () => {
    expect(scrubQueryString(undefined)).toBeUndefined();
    expect(scrubQueryString("")).toBe("");
  });
});

describe("scrubUrl", () => {
  it("scrubs query string only, preserves path", () => {
    expect(scrubUrl("https://api.example.com/v1/users?email=a@b.fr&id=42")).toBe(
      `https://api.example.com/v1/users?email=${encodeURIComponent(REDACTED)}&id=42`,
    );
  });

  it("returns URL unchanged when no query string", () => {
    expect(scrubUrl("https://api.example.com/v1/users")).toBe(
      "https://api.example.com/v1/users",
    );
  });

  it("preserves hash fragment after query string", () => {
    expect(scrubUrl("https://app.example.com/page?email=a@b.fr#section")).toBe(
      `https://app.example.com/page?email=${encodeURIComponent(REDACTED)}#section`,
    );
  });
});

describe("scrubBreadcrumbData", () => {
  it("scrubs both keys and URL query string", () => {
    const input = {
      method: "GET",
      url: "https://api.example.com/users?email=a@b.fr",
      status_code: 200,
      email: "request-user@example.com",
    };
    const out = scrubBreadcrumbData(input) as Record<string, unknown>;
    expect(out.method).toBe("GET");
    expect(out.status_code).toBe(200);
    expect(out.email).toBe(REDACTED);
    expect(out.url).toBe(
      `https://api.example.com/users?email=${encodeURIComponent(REDACTED)}`,
    );
  });

  it("handles null/undefined data", () => {
    expect(scrubBreadcrumbData(null)).toBe(null);
    expect(scrubBreadcrumbData(undefined)).toBe(undefined);
  });
});
