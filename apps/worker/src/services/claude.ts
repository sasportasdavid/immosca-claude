// Wrapper Anthropic SDK pour appels Claude avec tool_use forcé.
//
// Le tool_use est notre mécanisme pour obliger Claude à retourner du
// JSON structuré (vs du markdown libre) : on déclare un seul tool dont
// l'input_schema matche notre Zod, et on set tool_choice = ce tool.
// Le SDK retourne alors un content block `tool_use` avec un input
// JSON-conformant.
//
// Validation finale par Zod côté worker — si Claude dévie du schéma
// (rare avec tool_use forcé), on throw et le retry de Trigger.dev
// re-tente.

import Anthropic from "@anthropic-ai/sdk";
import {
  CLAUDE_MODEL_DEFAULT,
  type ClaudeModel,
  type PlanId,
  claudeModelForPlan,
} from "@immoscan/shared";
import { type z } from "zod";

import { zodToJsonSchema } from "@/services/zod-to-json-schema";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

export type CallClaudeOpts<T extends z.ZodType> = {
  /** Plan du user — détermine le modèle (Sonnet/Opus selon palier + rank). */
  plan?: PlanId;
  /**
   * Rang (1-based) du listing dans le Top N. Combiné au plan, détermine
   * le modèle :
   *   - Pro+ : rank ≤ 5 → Opus, rank > 5 → Sonnet
   *   - Business : Opus partout
   *   - Free / Pro : Sonnet partout
   * Si omis, on retourne le modèle "top5" du plan.
   */
  rank?: number;
  /** Override explicite du modèle (bypasse plan+rank). */
  model?: ClaudeModel;
  /** Prompt système (rôle, contraintes, ton). */
  system: string;
  /** Message user. */
  user: string;
  /** Schema Zod attendu en sortie. */
  schema: T;
  /** Nom du tool — apparaît dans les logs Anthropic. */
  toolName: string;
  /** Description du tool (1-2 phrases). */
  toolDescription: string;
  /** Max tokens output (defaut 4096). */
  maxTokens?: number;
};

export type CallClaudeResult<T> = {
  data: T;
  tokensUsed: number;
  model: string;
};

export async function callClaudeStructured<T extends z.ZodType>(
  opts: CallClaudeOpts<T>,
): Promise<CallClaudeResult<z.infer<T>>> {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY manquant — Claude indisponible");
  }

  const model =
    opts.model ??
    (opts.plan
      ? claudeModelForPlan(opts.plan, opts.rank)
      : CLAUDE_MODEL_DEFAULT);

  const inputSchema = zodToJsonSchema(opts.schema);

  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: inputSchema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.user }],
  });

  // Trouve le content block tool_use
  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `Claude n'a pas retourné de tool_use. Stop reason: ${response.stop_reason}`,
    );
  }

  // Validation Zod stricte
  const parsed = opts.schema.parse(toolUse.input);

  const tokensUsed =
    response.usage.input_tokens + response.usage.output_tokens;

  return {
    data: parsed,
    tokensUsed,
    model,
  };
}
