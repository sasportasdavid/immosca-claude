import { z } from "zod";

/**
 * Convertisseur minimal Zod → JSON Schema, suffisant pour l'API Anthropic tool_use.
 *
 * On évite la dépendance `zod-to-json-schema` pour rester minimal sur ce spike.
 * Les types supportés sont ceux qu'on utilise dans `reglementExtractionSchema` :
 * object, string, number, boolean, array, enum, nullable, union (discriminated),
 * literal, optional.
 *
 * Si un nouveau type Zod apparaît dans le schéma, ajouter ici. Pas de magie.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

function convert(s: z.ZodTypeAny): Record<string, unknown> {
  const description = s.description;
  const result = convertInner(s);
  if (description) result.description = description;
  return result;
}

function convertInner(s: z.ZodTypeAny): Record<string, unknown> {
  if (s instanceof z.ZodString) return { type: "string" };
  if (s instanceof z.ZodNumber) {
    const constraints: Record<string, number> = {};
    for (const check of (s._def.checks ?? []) as Array<{
      kind: string;
      value?: number;
    }>) {
      if (check.kind === "min" && typeof check.value === "number") {
        constraints.minimum = check.value;
      }
      if (check.kind === "max" && typeof check.value === "number") {
        constraints.maximum = check.value;
      }
    }
    return { type: "number", ...constraints };
  }
  if (s instanceof z.ZodBoolean) return { type: "boolean" };
  if (s instanceof z.ZodLiteral) {
    const v = s._def.value as unknown;
    return { const: v };
  }
  if (s instanceof z.ZodEnum) {
    return { type: "string", enum: s._def.values as string[] };
  }
  if (s instanceof z.ZodNativeEnum) {
    return { type: "string", enum: Object.values(s._def.values) };
  }
  if (s instanceof z.ZodArray) {
    return { type: "array", items: convert(s._def.type as z.ZodTypeAny) };
  }
  if (s instanceof z.ZodObject) {
    const shape = s._def.shape() as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convert(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }
  if (s instanceof z.ZodOptional) {
    return convert(s._def.innerType as z.ZodTypeAny);
  }
  if (s instanceof z.ZodNullable) {
    const inner = convert(s._def.innerType as z.ZodTypeAny);
    // JSON Schema nullable via union avec null
    return { anyOf: [inner, { type: "null" }] };
  }
  if (s instanceof z.ZodDefault) {
    return convert(s._def.innerType as z.ZodTypeAny);
  }
  if (s instanceof z.ZodUnion) {
    const options = s._def.options as z.ZodTypeAny[];
    return { anyOf: options.map((o) => convert(o)) };
  }
  if (s instanceof z.ZodDiscriminatedUnion) {
    const options = s._def.options as z.ZodTypeAny[];
    return { anyOf: options.map((o) => convert(o)) };
  }
  if (s instanceof z.ZodTuple) {
    const items = (s._def.items as z.ZodTypeAny[]).map((item) => convert(item));
    return { type: "array", prefixItems: items, minItems: items.length, maxItems: items.length };
  }
  if (s instanceof z.ZodUnknown || s instanceof z.ZodAny) {
    return {};
  }
  throw new Error(`zodToJsonSchema: type Zod non supporté (${s.constructor.name})`);
}
