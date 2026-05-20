import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
// Enums alignés sur la DB (immoscan-app)
// ──────────────────────────────────────────────────────────────────

export const subscriptionPlanSchema = z.enum(["free", "pro", "pro_plus", "business"]);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const strategyTypeSchema = z.enum([
  "locatif_nu",
  "lmnp_meuble",
  "mixte",
  "colocation",
  "courte_duree",
]);
export type StrategyType = z.infer<typeof strategyTypeSchema>;

export const travauxToleranceSchema = z.enum(["aucun", "leger", "moyen", "lourd"]);
export type TravauxTolerance = z.infer<typeof travauxToleranceSchema>;

// ──────────────────────────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  subscription_plan: subscriptionPlanSchema,
  subscription_status: subscriptionStatusSchema,
  trial_ends_at: z.string().datetime().nullable(),
  stripe_customer_id: z.string().nullable(),
  preferred_locale: z.string().default("fr-FR"),
  marketing_emails_opt_in: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Profile = z.infer<typeof profileSchema>;

// ──────────────────────────────────────────────────────────────────
// UserParams (paramètres d'investissement)
// ──────────────────────────────────────────────────────────────────

export const userParamsInputSchema = z.object({
  strategy: strategyTypeSchema,
  budget_max: z
    .number()
    .positive()
    .max(50_000_000)
    .nullable()
    .optional(),
  apport: z.number().nonnegative().max(10_000_000),
  taux_credit_pct: z.number().min(0).max(15).default(3),
  duree_credit_ans: z.number().int().min(5).max(30).default(25),
  tmi_pct: z.number().min(0).max(50).default(30),
  rendement_min_pct: z.number().min(0).max(30).default(5),
  tolerance_travaux: travauxToleranceSchema.default("leger"),
  scoring_weights: z
    .object({
      prix: z.number().min(0).max(100),
      rendement: z.number().min(0).max(100),
      cashflow: z.number().min(0).max(100),
      dpe: z.number().min(0).max(100),
      quartier: z.number().min(0).max(100),
      risques: z.number().min(0).max(100),
    })
    .refine(
      (w) => Object.values(w).reduce((a, b) => a + b, 0) === 100,
      "Les poids du scoring doivent sommer à 100",
    )
    .optional(),
});
export type UserParamsInput = z.infer<typeof userParamsInputSchema>;

export const userParamsSchema = userParamsInputSchema.extend({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type UserParams = z.infer<typeof userParamsSchema>;

// ──────────────────────────────────────────────────────────────────
// Onboarding flow input (validé côté form)
// ──────────────────────────────────────────────────────────────────

export const onboardingStep1Schema = z.object({
  strategy: strategyTypeSchema,
});

export const onboardingStep2Schema = z.object({
  apport: z.number().nonnegative(),
  taux_credit_pct: z.number().min(0).max(15),
  duree_credit_ans: z.number().int().min(5).max(30),
  tmi_pct: z.number().min(0).max(50),
  rendement_min_pct: z.number().min(0).max(30),
  tolerance_travaux: travauxToleranceSchema,
  budget_max: z.number().positive().nullable().optional(),
});

export const onboardingStep3Schema = z.object({
  source_url: z.string().url().refine(
    (url) =>
      url.includes("seloger.com") ||
      url.includes("leboncoin.fr") ||
      url.includes("bienici.com"),
    "URL doit être SeLoger, Leboncoin ou BienIci",
  ),
});

export type OnboardingStep1 = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2 = z.infer<typeof onboardingStep2Schema>;
export type OnboardingStep3 = z.infer<typeof onboardingStep3Schema>;
