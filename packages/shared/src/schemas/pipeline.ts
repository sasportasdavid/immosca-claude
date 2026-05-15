import { z } from "zod";

export const pipelineStageSchema = z.enum([
  "a_visiter",
  "visite",
  "offre",
  "compromis",
  "signe",
]);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const pipelineStageLabels: Record<PipelineStage, string> = {
  a_visiter: "À visiter",
  visite: "Visité",
  offre: "Offre",
  compromis: "Compromis",
  signe: "Signé",
};

export const pipelineItemCreateInputSchema = z.object({
  listing_id: z.string().uuid(),
  stage: pipelineStageSchema.default("a_visiter"),
  notes: z.string().max(10_000).optional(),
});
export type PipelineItemCreateInput = z.infer<typeof pipelineItemCreateInputSchema>;

export const pipelineItemUpdateInputSchema = z.object({
  stage: pipelineStageSchema.optional(),
  position: z.number().int().nonnegative().optional(),
  notes: z.string().max(10_000).optional(),
  visite_date: z.string().date().nullable().optional(),
  offre_price: z.number().positive().nullable().optional(),
  compromis_date: z.string().date().nullable().optional(),
  signe_date: z.string().date().nullable().optional(),
  photos: z.array(z.string().url()).optional(),
  adjusted_params: z.record(z.unknown()).optional(),
});
export type PipelineItemUpdateInput = z.infer<typeof pipelineItemUpdateInputSchema>;

export const pipelineItemSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  listing_id: z.string().uuid().nullable(),
  listing_snapshot: z.record(z.unknown()),
  stage: pipelineStageSchema,
  position: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  visite_date: z.string().date().nullable(),
  offre_price: z.number().nullable(),
  compromis_date: z.string().date().nullable(),
  signe_date: z.string().date().nullable(),
  photos: z.array(z.string()),
  adjusted_params: z.record(z.unknown()).nullable(),
  delisted_at: z.string().datetime().nullable(),
  delisted_reason: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PipelineItem = z.infer<typeof pipelineItemSchema>;
