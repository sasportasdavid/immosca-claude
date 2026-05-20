// Conversion Zod → JSON Schema minimaliste pour le tool input_schema
// d'Anthropic. Supporte les cas qu'on utilise dans nos prompts :
// z.object / z.string / z.number / z.boolean / z.enum / z.array / z.literal.
// Refuse les unions/refines complexes — Claude tool_use préfère du JSON
// Schema simple (Draft 7).
//
// Pour les cas avancés on installerait `zod-to-json-schema` lib, mais
// le poids et la surface API ne valent pas pour ~5 schémas qu'on utilise.

import { type z } from "zod";

type JsonSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): JsonSchema {
  const def = schema._def;
  const typeName = def.typeName as string;
  const description = (schema.description ?? undefined) as string | undefined;

  switch (typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(shape)) {
        const childSchema = child as z.ZodTypeAny;
        properties[key] = convert(childSchema);
        if (!childSchema.isOptional()) {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        required,
        ...(description ? { description } : {}),
      };
    }
    case "ZodString": {
      const out: JsonSchema = { type: "string" };
      if (description) out.description = description;
      const checks = (def.checks ?? []) as Array<{
        kind: string;
        value?: number;
      }>;
      for (const c of checks) {
        if (c.kind === "min" && c.value !== undefined) out.minLength = c.value;
        if (c.kind === "max" && c.value !== undefined) out.maxLength = c.value;
      }
      return out;
    }
    case "ZodNumber": {
      const out: JsonSchema = { type: "number" };
      if (description) out.description = description;
      const checks = (def.checks ?? []) as Array<{
        kind: string;
        value?: number;
      }>;
      for (const c of checks) {
        if (c.kind === "min" && c.value !== undefined) out.minimum = c.value;
        if (c.kind === "max" && c.value !== undefined) out.maximum = c.value;
        if (c.kind === "int") out.type = "integer";
      }
      return out;
    }
    case "ZodBoolean":
      return { type: "boolean", ...(description ? { description } : {}) };
    case "ZodEnum":
      return {
        type: "string",
        enum: def.values,
        ...(description ? { description } : {}),
      };
    case "ZodLiteral":
      return {
        const: def.value,
        ...(description ? { description } : {}),
      };
    case "ZodArray": {
      return {
        type: "array",
        items: convert(def.type),
        ...(def.minLength !== null && def.minLength !== undefined
          ? { minItems: def.minLength.value }
          : {}),
        ...(def.maxLength !== null && def.maxLength !== undefined
          ? { maxItems: def.maxLength.value }
          : {}),
        ...(def.exactLength !== null && def.exactLength !== undefined
          ? {
              minItems: def.exactLength.value,
              maxItems: def.exactLength.value,
            }
          : {}),
        ...(description ? { description } : {}),
      };
    }
    case "ZodOptional":
    case "ZodNullable":
      return convert(def.innerType);
    case "ZodDefault":
      return convert(def.innerType);
    default:
      throw new Error(`zodToJsonSchema: type non supporté ${typeName}`);
  }
}
