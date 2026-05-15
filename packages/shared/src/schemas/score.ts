import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
// Verdict
// ──────────────────────────────────────────────────────────────────

export const verdictSchema = z.enum(["a_visiter", "sous_reserve", "no_go"]);
export type Verdict = z.infer<typeof verdictSchema>;

// ──────────────────────────────────────────────────────────────────
// Sous-scores (chaque dimension /100)
// ──────────────────────────────────────────────────────────────────

export const subScoresSchema = z.object({
  prix: z.number().int().min(0).max(100),
  rendement: z.number().int().min(0).max(100),
  cashflow: z.number().int().min(0).max(100),
  dpe: z.number().int().min(0).max(100),
  quartier: z.number().int().min(0).max(100),
  risques: z.number().int().min(0).max(100),
});
export type SubScores = z.infer<typeof subScoresSchema>;

// ──────────────────────────────────────────────────────────────────
// Indicateurs financiers calculés
// ──────────────────────────────────────────────────────────────────

export const financialIndicatorsSchema = z.object({
  prix_marche_estime: z.number().nullable(),
  ecart_prix_pct: z.number().nullable(),
  loyer_estime: z.number().nullable(),
  loyer_m2_estime: z.number().nullable(),
  rendement_brut_pct: z.number().nullable(),
  rendement_net_pct: z.number().nullable(),
  rendement_net_net_pct: z.number().nullable(),
  cashflow_mensuel: z.number().nullable(),
  mensualite_credit: z.number().nullable(),
  frais_notaire: z.number().nullable(),
  cout_total_acquisition: z.number().nullable(),
});
export type FinancialIndicators = z.infer<typeof financialIndicatorsSchema>;

// ──────────────────────────────────────────────────────────────────
// Risques climat (loi Climat 2025/2028/2034)
// ──────────────────────────────────────────────────────────────────

export const climateRisksSchema = z.object({
  is_passoire_dpe: z.boolean(),
  risque_climat_2025: z.boolean(), // G interdit
  risque_climat_2028: z.boolean(), // F interdit
  risque_climat_2034: z.boolean(), // E interdit
});
export type ClimateRisks = z.infer<typeof climateRisksSchema>;

// ──────────────────────────────────────────────────────────────────
// Output structuré attendu de Claude pour la thèse d'investissement
// (le worker force ce schéma via tool_use)
// ──────────────────────────────────────────────────────────────────

export const claudeThesisOutputSchema = z.object({
  these: z
    .string()
    .min(200)
    .max(3000)
    .describe(
      "Thèse d'investissement narrative, 200-500 mots, argumentée chiffrée, en français professionnel investisseur. Doit reprendre les chiffres exacts.",
    ),
  financement: z
    .string()
    .min(100)
    .max(1500)
    .describe(
      "Plan de financement détaillé : apport, montant emprunté, mensualité, durée, frais notaire, coût total. 100-300 mots.",
    ),
  negociation: z
    .string()
    .min(100)
    .max(1500)
    .describe(
      "Stratégie de négociation chiffrée : prix cible, leviers (DPE, travaux, marché), argumentaire. 100-300 mots.",
    ),
  prix_negociation_cible: z
    .number()
    .positive()
    .describe("Prix d'offre recommandé en euros, entier."),
  verdict: verdictSchema.describe(
    "a_visiter (>= 75/100), sous_reserve (50-74), no_go (< 50)",
  ),
});
export type ClaudeThesisOutput = z.infer<typeof claudeThesisOutputSchema>;

// ──────────────────────────────────────────────────────────────────
// Output structuré pour la synthèse marché (rapport global)
// ──────────────────────────────────────────────────────────────────

export const claudeMarketSynthesisSchema = z.object({
  resume_executif: z
    .string()
    .min(150)
    .max(800)
    .describe("Résumé exécutif 100-200 mots : volumétrie, KPIs clés, opportunités identifiées."),
  micro_quartiers: z
    .array(
      z.object({
        nom: z.string(),
        nb_biens: z.number().int(),
        prix_median_m2: z.number(),
        caracterisation: z.string().min(50).max(400),
      }),
    )
    .min(1)
    .max(8),
  recommandations_affinage: z
    .array(
      z.object({
        action: z.string().min(20).max(200),
        impact_attendu: z.string().min(20).max(200),
      }),
    )
    .length(3)
    .describe("Exactement 3 recommandations pour affiner la recherche"),
});
export type ClaudeMarketSynthesis = z.infer<typeof claudeMarketSynthesisSchema>;

// ──────────────────────────────────────────────────────────────────
// Score complet (entrée pour insertion en DB)
// ──────────────────────────────────────────────────────────────────

export const listingScoreInputSchema = z.object({
  listing_id: z.string().uuid(),
  analysis_id: z.string().uuid(),
  score_total: z.number().int().min(0).max(100),
  ...subScoresSchema.shape,
  ...financialIndicatorsSchema.shape,
  ...climateRisksSchema.shape,
  these_claude: z.string().nullable(),
  financement_claude: z.string().nullable(),
  negociation_claude: z.string().nullable(),
  prix_negociation_cible: z.number().nullable(),
  verdict: verdictSchema.nullable(),
  scoring_version: z.string().default("v1.0"),
  claude_model: z.string().nullable(),
  claude_tokens_used: z.number().int().nullable(),
});
export type ListingScoreInput = z.infer<typeof listingScoreInputSchema>;
