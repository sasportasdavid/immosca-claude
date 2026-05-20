// Wrapper Claude vision (image input) pour ImmoValue.
//
// Deux usages :
//   1. `analyzePhotos(urls)` — analyse complète d'une série de photos
//      (état, luminosité, finitions, type de pièce) pour alimenter le
//      dossier d'estimation (§3.4 source #4).
//   2. `detectOutdoor(url)` — détection binaire extérieur/intérieur,
//      utilisée par `value-flout-photos` pour décider du traitement
//      à appliquer (blur fort pour extérieur identifiable, strip
//      EXIF + watermark pour intérieur).
//
// Modèle : claude-sonnet-4-6 (image input natif, latence < 2s/photo en
// batch). Pas d'Opus ici, on veut du volume / vitesse, pas de la qualité
// rédactionnelle.
//
// Coût indicatif : ~0.005€/photo (Sonnet image + 200 tokens output).
// Pour 8 photos en moyenne → ~4 centimes/bien.

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL_SONNET } from "@immoscan/shared";
import {
  type PhotoAnalysis,
  PhotoAnalysisSchema,
} from "@immoscan/shared/value";
import PQueue from "p-queue";
import { z } from "zod";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

// Limite douce : 5 photos en parallèle. Au-delà, on peut hit le rate
// limit Anthropic (50 req/min Sonnet sur les comptes standard).
const VISION_QUEUE = new PQueue({ concurrency: 5 });

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Télécharge l'image et la convertit en base64 pour l'envoyer à Claude.
 *
 * Le SDK Anthropic 0.32 ne supporte que le mode `base64` (le mode `url`
 * arrive en SDK 0.40+). On télécharge donc l'image côté worker avant
 * l'appel — coût réseau supplémentaire mais on garde la compat SDK.
 *
 * Limite : on cap à 5 Mo par photo (au-delà on skip — un listing
 * pourrait avoir une photo HD 20 Mo, on évite de saturer la RAM).
 */
async function fetchImageAsBase64(url: string): Promise<{
  data: string;
  media_type: ImageMediaType;
} | null> {
  const res = await fetch(url, {
    headers: { "user-agent": "ImmoValue/1.0 (Vision)" },
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const media_type: ImageMediaType = contentType.includes("png")
    ? "image/png"
    : contentType.includes("webp")
      ? "image/webp"
      : contentType.includes("gif")
        ? "image/gif"
        : "image/jpeg";
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 5 * 1024 * 1024) return null;
  const data = Buffer.from(buf).toString("base64");
  return { data, media_type };
}

const photoAnalysisFromClaudeSchema = PhotoAnalysisSchema.omit({ url: true });

// Schéma simple pour la détection outdoor (un seul boolean)
const outdoorSchema = z.object({
  is_outdoor: z.boolean(),
});

/**
 * Analyse une photo unique via Claude vision. Renvoie un
 * `PhotoAnalysis`. Throw si la photo n'est pas accessible ou que Claude
 * échoue (le caller wrappe en Promise.allSettled).
 */
async function analyzeSinglePhoto(url: string): Promise<PhotoAnalysis> {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY manquant — Claude vision indisponible");
  }

  const image = await fetchImageAsBase64(url);
  if (!image) {
    throw new Error(`Image inaccessible ou trop volumineuse: ${url}`);
  }

  const inputSchema = {
    type: "object",
    properties: {
      type_piece: {
        type: ["string", "null"],
        enum: [
          "salon",
          "cuisine",
          "chambre",
          "salle_de_bain",
          "wc",
          "entree",
          "couloir",
          "balcon",
          "terrasse",
          "jardin",
          "garage",
          "cave",
          "vue_exterieure",
          "facade",
          "exterieur",
          "autre",
          null,
        ],
      },
      is_outdoor: { type: "boolean" },
      etat_general: {
        type: ["string", "null"],
        enum: ["a_renover", "rafraichir", "bon", "tres_bon", "neuf_renove", null],
      },
      luminosite: {
        type: ["string", "null"],
        enum: ["sombre", "moyen", "lumineux", "tres_lumineux", null],
      },
      qualite_finitions: {
        type: ["string", "null"],
        enum: ["basique", "standard", "qualite", "haut_de_gamme", null],
      },
      remarques: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "type_piece",
      "is_outdoor",
      "etat_general",
      "luminosite",
      "qualite_finitions",
      "remarques",
    ],
  } as const;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL_SONNET,
    max_tokens: 600,
    system:
      "Tu es expert en évaluation immobilière. Tu analyses une photo de bien immobilier et tu remplis le formulaire d'analyse de manière objective et concise (1-3 remarques max).",
    tools: [
      {
        name: "photo_analysis",
        description:
          "Analyse cette photo de bien immobilier. is_outdoor = true si la prise de vue est en extérieur (façade, jardin, rue), false sinon. Remarques courtes (parquet abîmé, cuisine équipée, vue dégagée, etc.) max 3.",
        input_schema: inputSchema as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "photo_analysis" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.media_type,
              data: image.data,
            },
          },
          {
            type: "text",
            text: "Analyse cette photo de bien immobilier.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `Claude vision n'a pas retourné de tool_use. Stop reason: ${response.stop_reason}`,
    );
  }
  const parsed = photoAnalysisFromClaudeSchema.parse(toolUse.input);
  return { url, ...parsed };
}

/**
 * Analyse une série de photos en parallèle (5 max simultanées).
 * Best-effort : si une photo échoue (URL morte, format inconnu),
 * on retourne quand même les autres avec un fallback minimal pour
 * la photo en erreur.
 */
export async function analyzePhotos(
  urls: string[],
): Promise<PhotoAnalysis[]> {
  if (urls.length === 0) return [];
  if (!anthropic) {
    // En dev sans clé Claude, retourne des stubs pour ne pas planter
    // tout le pipeline value-build-estimation.
    return urls.map((url) => ({
      url,
      type_piece: null,
      is_outdoor: false,
      etat_general: null,
      luminosite: null,
      qualite_finitions: null,
      remarques: [],
    }));
  }

  const tasks = urls.map((url) =>
    VISION_QUEUE.add<PhotoAnalysis>(async () => {
      try {
        return await analyzeSinglePhoto(url);
      } catch (err) {
        console.warn(`analyzePhotos failed for ${url}:`, err);
        // Fallback neutre — Claude reasoner pourra travailler sans cette
        // photo mais ne plantera pas sur un undefined.
        return {
          url,
          type_piece: null,
          is_outdoor: false,
          etat_general: null,
          luminosite: null,
          qualite_finitions: null,
          remarques: ["analyse vision indisponible"],
        };
      }
    }),
  );
  // PQueue.add peut retourner undefined si la queue est cleared ;
  // ici on ne clear jamais, donc les valeurs sont garanties non-undefined.
  const results = (await Promise.all(tasks)).filter(
    (r): r is PhotoAnalysis => r !== undefined,
  );
  return results;
}

/**
 * Détecte si une photo est prise en extérieur. Utilisé par le worker
 * `value-flout-photos` pour décider du traitement (blur fort ou EXIF
 * strip + watermark).
 *
 * Retourne `false` par défaut si Claude indisponible (côté safe :
 * traite la photo comme intérieur, donc strip + watermark).
 */
export async function detectOutdoor(url: string): Promise<boolean> {
  if (!anthropic) return false;

  try {
    const image = await fetchImageAsBase64(url);
    if (!image) return false;
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 100,
      system: "Tu analyses des photos de biens immobiliers.",
      tools: [
        {
          name: "outdoor_detection",
          description:
            "Détecte si la photo est prise en extérieur (rue, façade, jardin, vue extérieure) ou en intérieur (pièce du logement).",
          input_schema: {
            type: "object",
            properties: {
              is_outdoor: { type: "boolean" },
            },
            required: ["is_outdoor"],
          } as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: "outdoor_detection" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.media_type,
                data: image.data,
              },
            },
            { type: "text", text: "Cette photo est-elle prise en extérieur ?" },
          ],
        },
      ],
    });
    const toolUse = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    if (!toolUse) return false;
    return outdoorSchema.parse(toolUse.input).is_outdoor;
  } catch (err) {
    console.warn(`detectOutdoor failed for ${url}:`, err);
    return false;
  }
}
