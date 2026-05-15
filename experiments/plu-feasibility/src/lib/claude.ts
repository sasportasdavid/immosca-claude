import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante");
  _client = new Anthropic({ apiKey });
  return _client;
}

export interface ClaudeCallResult<T> {
  data: T;
  input_tokens: number;
  output_tokens: number;
  model: string;
  cost_estimate_eur: number;
}

/**
 * Pricing approximatif Claude (à jour mai 2026, à vérifier).
 * USD/MTok input, USD/MTok output.
 */
const PRICING = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
} as const;

const USD_TO_EUR = 0.92;

function estimateCostEur(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model as keyof typeof PRICING];
  if (!p) return 0;
  const usd = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  return usd * USD_TO_EUR;
}

/**
 * Appel Claude avec output forcé à respecter un schéma Zod.
 * On utilise tool_use avec un outil unique pour forcer le format.
 */
export async function callClaudeStructured<T extends z.ZodType>(args: {
  model?: string;
  system: string;
  user: string;
  schema: T;
  schemaName: string;
  schemaDescription: string;
  maxTokens?: number;
}): Promise<ClaudeCallResult<z.infer<T>>> {
  const model = args.model ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
  const jsonSchema = zodToJsonSchema(args.schema);

  const response = await client().messages.create({
    model,
    max_tokens: args.maxTokens ?? 8192,
    system: args.system,
    tools: [
      {
        name: args.schemaName,
        description: args.schemaDescription,
        input_schema: jsonSchema,
      },
    ],
    tool_choice: { type: "tool", name: args.schemaName },
    messages: [{ role: "user", content: args.user }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas appelé l'outil. Réponse: " + JSON.stringify(response.content));
  }

  const parsed = args.schema.parse(toolUse.input);

  return {
    data: parsed as z.infer<T>,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    model,
    cost_estimate_eur: estimateCostEur(model, response.usage.input_tokens, response.usage.output_tokens),
  };
}
