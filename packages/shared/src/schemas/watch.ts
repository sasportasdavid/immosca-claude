import { z } from "zod";

import { listingSourceSchema } from "./analysis.js";

export const watchFrequencySchema = z.enum(["daily", "three_days", "weekly"]);
export type WatchFrequency = z.infer<typeof watchFrequencySchema>;

export const watchCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  source_url: z.string().url(),
  source_site: listingSourceSchema,
  frequency: watchFrequencySchema.default("weekly"),
  score_threshold: z.number().int().min(0).max(100).default(70),
  notify_email: z.boolean().default(true),
  notify_push: z.boolean().default(false),
  notify_telegram: z.boolean().default(false),
});
export type WatchCreateInput = z.infer<typeof watchCreateInputSchema>;

export const watchSchema = watchCreateInputSchema.extend({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  is_active: z.boolean(),
  last_run_at: z.string().datetime().nullable(),
  next_run_at: z.string().datetime(),
  last_analysis_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Watch = z.infer<typeof watchSchema>;
