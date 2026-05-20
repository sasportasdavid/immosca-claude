// Prompt + schéma de sortie pour la valorisation Claude (§3.5).
//
// Logique pure : pas d'import SDK ici. Le worker passe le prompt à
// `callClaudeStructured(...)` avec le schéma `ValorisationOutputSchema`
// comme tool_use → JSON validé Zod côté serveur.

import { z } from "zod";

import { DossierEstimationSchema, type DossierEstimation } from "./dossier-builder.js";

// ──────────────────────────────────────────────────────────────────
// Schéma de sortie attendu de Claude (validé par Zod côté worker)
// ──────────────────────────────────────────────────────────────────

export const ValorisationAjustementSchema = z.object({
  categorie: z.enum(["bien", "secteur", "risques", "marche"]),
  critere: z.string(),
  impact_pct: z.number(),
  impact_eur: z.number(),
  raisonnement: z.string(),
  sources: z.array(z.string()),
});
export type ValorisationAjustement = z.infer<typeof ValorisationAjustementSchema>;

export const ValorisationComparableRetenuSchema = z.object({
  type: z.enum(["dvf", "actif", "user"]),
  ref: z.string(),
  poids: z.number().min(0).max(1),
});
export type ValorisationComparableRetenu = z.infer<typeof ValorisationComparableRetenuSchema>;

export const ValorisationTensionSchema = z.object({
  ratio_actif_vs_dvf_pct: z.number(),
  interpretation: z.enum(["vendeur", "equilibre", "acheteur"]),
});
export type ValorisationTension = z.infer<typeof ValorisationTensionSchema>;

export const ValorisationQualiteDossierSchema = z.object({
  score: z.number().min(0).max(100),
  manques: z.array(z.string()),
});
export type ValorisationQualiteDossier = z.infer<typeof ValorisationQualiteDossierSchema>;

export const ValorisationOutputSchema = z.object({
  prix_m2_secteur_pondere: z.number(),
  valorisation: z.object({
    bas: z.number(),
    central: z.number(),
    haut: z.number(),
    confiance: z.number().min(0).max(1),
  }),
  ajustements: z.array(ValorisationAjustementSchema),
  comparables_retenus: z.array(ValorisationComparableRetenuSchema),
  tension_marche: ValorisationTensionSchema,
  these: z.string(),
  signaux_faibles: z.array(z.string()),
  recommandation_prix_vente: z.number(),
  duree_vente_estimee_jours: z.number().int(),
  qualite_dossier: ValorisationQualiteDossierSchema,
});
export type ValorisationOutput = z.infer<typeof ValorisationOutputSchema>;

// ──────────────────────────────────────────────────────────────────
// Helpers de sérialisation YAML-like pour le prompt
// ──────────────────────────────────────────────────────────────────
//
// On évite une dep `js-yaml` : la sortie « YAML-like » suffit à Claude.
// Avantage : pas d'évasion compliquée des strings, juste de la lisibilité.

function indent(n: number, s: string): string {
  const pad = "  ".repeat(n);
  return s
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function yaml(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    // String courte → inline, longue → bloc
    if (value.length < 80 && !value.includes("\n")) return JSON.stringify(value);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((v) => `- ${indent(depth + 1, yaml(v, depth + 1)).trimStart()}`)
      .join("\n");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return keys
      .map((k) => {
        const v = obj[k];
        const serialized = yaml(v, depth + 1);
        if (
          typeof v === "object" &&
          v !== null &&
          !Array.isArray(v) &&
          Object.keys(v).length > 0
        ) {
          return `${k}:\n${indent(depth + 1, serialized)}`;
        }
        if (Array.isArray(v) && v.length > 0) {
          return `${k}:\n${indent(depth + 1, serialized)}`;
        }
        return `${k}: ${serialized}`;
      })
      .join("\n");
  }
  return JSON.stringify(value);
}

// ──────────────────────────────────────────────────────────────────
// Prompt builder
// ──────────────────────────────────────────────────────────────────

export const VALORISATION_SYSTEM_PROMPT = `Tu es expert en évaluation immobilière, formé selon les méthodes des notaires de France.
Tu estimes ce bien avec rigueur professionnelle et tu argumentes chaque ajustement.

Règles strictes :
- Ne JAMAIS halluciner une donnée. Si tu manques d'info, dis-le dans signaux_faibles.
- Les pourcentages d'ajustement doivent être documentés par au moins une source.
- Si confiance < 0.6, l'expliquer dans la thèse.
- Vocabulaire métier français accepté : DVF, DPE, IRIS, OLL, m² Carrez, etc.
- La thèse fait 200-350 mots, argumentée.`;

export function buildValorisationPrompt(dossier: DossierEstimation): string {
  // Validation défensive — on s'assure que le dossier est bien formé
  // avant de le sérialiser (évite de balancer du junk à Claude).
  DossierEstimationSchema.parse(dossier);

  const userProvidedSection =
    dossier.userProvidedComparables.length > 0
      ? yaml(dossier.userProvidedComparables)
      : "Aucun lien fourni par le propriétaire.";

  return `# Bien à estimer
${yaml(dossier.bien)}

# Adresse normalisée et secteur
${yaml(dossier.geo)}

# Diagnostic énergétique du bien (si trouvé)
${dossier.dpeBien ? yaml(dossier.dpeBien) : `Non trouvé dans la base ADEME — DPE déclaré : ${dossier.bien.dpe ?? "inconnu"}`}

# Analyse des photos par IA vision
${yaml(dossier.photoAnalysis)}

# Comparables fournis par le propriétaire ⭐ PRIORITÉ HAUTE
Ces biens ont été sélectionnés par le propriétaire comme représentatifs de ce qu'il considère comme similaire à son bien. Pondère-les fortement dans ton raisonnement.
${userProvidedSection}

# Comparables transactions DVF (${dossier.dvfComparables.length} ventes des 5 dernières années)
${yaml(dossier.dvfComparables)}

# Comparables marché actif (${dossier.activeComparables.length} annonces SeLoger + Leboncoin)
${yaml(dossier.activeComparables)}

# Contexte démographique du quartier (IRIS INSEE)
${yaml(dossier.irisContext)}

# Marché locatif local (OLL)
${yaml(dossier.rentalMarket)}

# DPE moyen du secteur
${yaml(dossier.dpeSector)}

# Risques environnementaux (Géorisques)
${yaml(dossier.georisques)}

# Transports et services
${yaml(dossier.transports)}

# Carte scolaire
${yaml(dossier.schools)}

# Bruit (Lden)
${yaml(dossier.noise)}

# Tendance prix du secteur sur 5 ans
${yaml(dossier.prixTrend)}

# Méthodologie attendue

1. Établis un prix m² médian pondéré à partir des DVF retenus, avec décote temporelle
2. Compare avec le prix m² des annonces actives → en déduire la tension du marché
3. **Examine les comparables fournis par le propriétaire en priorité** : ils captent une connaissance fine du micro-marché que les algos manquent
4. Applique les ajustements bien-spécifiques (état réel selon photos, étage, expo, DPE vs secteur)
5. Applique les ajustements secteur (risques, transport, écoles, bruit, démographie)
6. Sors une fourchette basse-centrale-haute reflétant l'incertitude réelle
7. Indique un niveau de confiance (0 à 1) qui dépend de :
   - Nombre de comparables retenus (>= 15 → confiance haute)
   - Cohérence DVF vs annonces actives
   - Comparables user fournis et leur pertinence
   - Qualité de l'analyse photos
   - Stabilité du marché secteur`;
}

// ──────────────────────────────────────────────────────────────────
// Callable abstrait — injecté par le worker
// ──────────────────────────────────────────────────────────────────

export interface ClaudeStructuredCaller {
  <T extends z.ZodType>(opts: {
    system: string;
    user: string;
    schema: T;
    toolName: string;
    toolDescription: string;
    maxTokens?: number;
  }): Promise<{ data: z.infer<T>; tokensUsed: number; model: string }>;
}

/**
 * Appelle Claude via le caller injecté et valide la sortie.
 *
 * Le worker fournit le caller (qui sait quel modèle, quelle clé, quel
 * tool_use mécanisme). Ici on reste agnostique pour permettre le test
 * unitaire (mock du caller) sans dépendre du SDK Anthropic.
 */
export async function claudeValorisation(
  dossier: DossierEstimation,
  caller: ClaudeStructuredCaller,
): Promise<{ valo: ValorisationOutput; tokensUsed: number; model: string }> {
  const user = buildValorisationPrompt(dossier);
  const result = await caller({
    system: VALORISATION_SYSTEM_PROMPT,
    user,
    schema: ValorisationOutputSchema,
    toolName: "valorisation_immobiliere",
    toolDescription:
      "Retourne la valorisation argumentée du bien selon les sources fournies (DVF, annonces actives, comparables user, IRIS, OLL, DPE secteur, géorisques, transports, écoles, bruit, tendance).",
    maxTokens: 4096,
  });
  return { valo: result.data, tokensUsed: result.tokensUsed, model: result.model };
}
