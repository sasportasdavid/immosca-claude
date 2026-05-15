import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import pdfParse from "pdf-parse";
import { downloadReglementPdf } from "./lib/gpu.js";
import { callClaudeStructured } from "./lib/claude.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompts/reglement-extraction.js";
import { reglementExtractionSchema } from "./types.js";

/**
 * Teste l'extraction Claude sur 1-N règlements PDF.
 *
 * Usage :
 *   pnpm run extract:reglement -- --pdf <urlOrPath> --zone UB1 --commune Gagny --surface 350 --bati 80
 *
 * Plusieurs runs en série pour ne pas exploser le rate limit Anthropic.
 *
 * Output : un fichier JSON par run dans results/extractions/<timestamp>-<commune>-<zone>.json
 */

const RESULTS_DIR = resolve(import.meta.dirname, "..", "results");

interface CliArgs {
  pdf: string; // URL ou chemin local
  zone: string;
  commune: string;
  surface: number; // m² parcelle
  bati: number; // m² emprise existante
  hauteurExistante?: number;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      pdf: { type: "string" },
      zone: { type: "string" },
      commune: { type: "string" },
      surface: { type: "string" },
      bati: { type: "string" },
      "hauteur-existante": { type: "string" },
    },
  });

  for (const k of ["pdf", "zone", "commune", "surface", "bati"] as const) {
    if (!values[k]) {
      throw new Error(`Argument --${k} manquant. Voir le README.`);
    }
  }

  return {
    pdf: values.pdf!,
    zone: values.zone!,
    commune: values.commune!,
    surface: Number(values.surface),
    bati: Number(values.bati),
    hauteurExistante: values["hauteur-existante"]
      ? Number(values["hauteur-existante"])
      : undefined,
  };
}

async function loadPdfBytes(pdfArg: string): Promise<Buffer> {
  if (pdfArg.startsWith("http://") || pdfArg.startsWith("https://")) {
    console.log(`  📥 Téléchargement ${pdfArg}...`);
    const { bytes } = await downloadReglementPdf(pdfArg);
    return Buffer.from(bytes);
  }
  console.log(`  📂 Lecture locale ${pdfArg}...`);
  return readFile(pdfArg);
}

async function main() {
  const args = parseCliArgs();
  console.log(
    `🧪 Extraction PLU pour ${args.commune}, zone ${args.zone}, parcelle ${args.surface} m², bâti ${args.bati} m²\n`,
  );

  const pdfBytes = await loadPdfBytes(args.pdf);
  console.log(`  📄 PDF chargé : ${(pdfBytes.length / 1024).toFixed(1)} KB`);

  console.log("  🔡 Extraction texte du PDF...");
  const parsed = await pdfParse(pdfBytes);
  const text = parsed.text;
  console.log(`  📝 ${text.length} caractères extraits (~${Math.round(text.length / 4)} tokens)`);

  if (text.length > 400_000) {
    console.warn(
      `  ⚠️  Règlement très long (${text.length} chars). Claude Opus a une fenêtre de 200k tokens. Tronquage recommandé en pré-traitement, ou prompt en deux passes.`,
    );
  }

  console.log("  🤖 Appel Claude...");
  const start = Date.now();
  const result = await callClaudeStructured({
    system: SYSTEM_PROMPT,
    user: buildUserMessage({
      zoneCible: args.zone,
      communeName: args.commune,
      surfaceParcelleM2: args.surface,
      surfaceExistanteM2: args.bati,
      hauteurExistanteM: args.hauteurExistante ?? null,
      reglementText: text,
    }),
    schema: reglementExtractionSchema,
    schemaName: "extract_plu_rules",
    schemaDescription:
      "Extrait de manière rigoureuse les règles applicables d'une zone PLU à partir du texte du règlement.",
    maxTokens: 4096,
  });
  const elapsed = Date.now() - start;

  console.log(`\n  ✅ Extraction réussie en ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  💰 Coût : ${result.cost_estimate_eur.toFixed(4)} €`);
  console.log(`  🔢 Tokens : ${result.input_tokens} in / ${result.output_tokens} out`);
  console.log(`  🎯 Confiance déclarée par Claude : ${result.data.confidence}`);

  console.log("\n--- Résultat ---");
  console.log(JSON.stringify(result.data, null, 2));

  // Persistance
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fname = `${timestamp}-${args.commune}-${args.zone}.json`;
  const outPath = resolve(RESULTS_DIR, "extractions", fname);
  await writeFile(
    outPath,
    JSON.stringify(
      {
        meta: {
          commune: args.commune,
          zone: args.zone,
          surface_parcelle_m2: args.surface,
          surface_bati_m2: args.bati,
          hauteur_existante_m: args.hauteurExistante,
          pdf_source: args.pdf,
          extracted_at: new Date().toISOString(),
          model: result.model,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
          cost_eur: result.cost_estimate_eur,
          latency_ms: elapsed,
        },
        extraction: result.data,
      },
      null,
      2,
    ),
  );

  console.log(`\n  💾 Sauvegardé : ${outPath}`);
  console.log(
    `\n  ➡️  Maintenant ouvre le PDF, vérifie chaque chiffre, et note les écarts dans data/manual-eval-template.md`,
  );
}

// p-limit n'est pas utile ici (1 PDF par run), mais on garde la cohérence
main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
