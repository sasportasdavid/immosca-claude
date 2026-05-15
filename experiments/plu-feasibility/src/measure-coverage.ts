import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pLimit from "p-limit";
import { geocodeAddress } from "./lib/ban.js";
import { getParcelleAtPoint } from "./lib/cadastre.js";
import { downloadReglementPdf, getGpuZoneAtPoint } from "./lib/gpu.js";
import type { CoverageResult } from "./types.js";

/**
 * Pour chaque adresse du CSV, on exécute le pipeline complet :
 *   1. BAN : adresse → (lat, lng)
 *   2. Cadastre : (lat, lng) → parcelle
 *   3. GPU : (lat, lng) → zone PLU + URL règlement
 *   4. Download du règlement PDF
 *
 * On mesure la latence de chaque étape et on agrège dans results/coverage.json.
 * Le rapport texte est généré dans results/coverage-summary.md.
 *
 * Usage :
 *   pnpm run measure:coverage
 */

const ADDRESSES_CSV = resolve(import.meta.dirname, "..", "data", "sample-addresses.csv");
const RESULTS_JSON = resolve(import.meta.dirname, "..", "results", "coverage.json");
const RESULTS_SUMMARY = resolve(import.meta.dirname, "..", "results", "coverage-summary.md");

const CONCURRENCY = Number(process.env.BATCH_CONCURRENCY ?? 5);

interface AddressRow {
  address: string;
  expected_city: string;
}

function parseCsv(content: string): AddressRow[] {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return [];
  // header
  const header = lines[0]?.toLowerCase().split(",").map((h) => h.trim());
  if (!header || !header.includes("address") || !header.includes("expected_city")) {
    throw new Error(
      `Header CSV attendu : 'address,expected_city'. Trouvé : '${lines[0]}'`,
    );
  }
  const addressIdx = header.indexOf("address");
  const cityIdx = header.indexOf("expected_city");

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      address: cells[addressIdx] ?? "",
      expected_city: cells[cityIdx] ?? "",
    };
  });
}

function parseCsvLine(line: string): string[] {
  // CSV simple : virgules, support des guillemets pour les valeurs avec virgule
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

async function processAddress(row: AddressRow): Promise<CoverageResult> {
  const result: Partial<CoverageResult> = {
    raw_address: row.address,
    expected_city: row.expected_city,
    full_pipeline_ok: false,
  };

  // Étape 1 : BAN
  let banStart = Date.now();
  try {
    const ban = await geocodeAddress(row.address);
    if (!ban) {
      result.step_ban = { ok: false, error: "Aucun résultat BAN", latency_ms: Date.now() - banStart };
      return result as CoverageResult;
    }
    result.step_ban = { ok: true, data: ban, latency_ms: Date.now() - banStart };

    // Étape 2 : Cadastre
    let cadastreStart = Date.now();
    try {
      const parcelle = await getParcelleAtPoint(ban.lat, ban.lng);
      if (!parcelle) {
        result.step_cadastre = {
          ok: false,
          error: "Aucune parcelle au point géocodé",
          latency_ms: Date.now() - cadastreStart,
        };
      } else {
        result.step_cadastre = {
          ok: true,
          data: parcelle,
          latency_ms: Date.now() - cadastreStart,
        };
      }
    } catch (err) {
      result.step_cadastre = {
        ok: false,
        error: (err as Error).message,
        latency_ms: Date.now() - cadastreStart,
      };
    }

    // Étape 3 : GPU
    let gpuStart = Date.now();
    let reglementUrl: string | undefined;
    try {
      const zone = await getGpuZoneAtPoint(ban.lat, ban.lng);
      if (!zone) {
        result.step_gpu_zone = {
          ok: false,
          error: "Aucune zone PLU au point (commune sans PLU sur GPU ?)",
          latency_ms: Date.now() - gpuStart,
        };
      } else {
        result.step_gpu_zone = { ok: true, data: zone, latency_ms: Date.now() - gpuStart };
        reglementUrl = zone.reglement_pdf_url;
      }
    } catch (err) {
      result.step_gpu_zone = {
        ok: false,
        error: (err as Error).message,
        latency_ms: Date.now() - gpuStart,
      };
    }

    // Étape 4 : téléchargement règlement
    if (reglementUrl) {
      let dlStart = Date.now();
      try {
        const { size } = await downloadReglementPdf(reglementUrl);
        result.step_reglement_download = {
          ok: true,
          pdf_size_bytes: size,
          latency_ms: Date.now() - dlStart,
        };
      } catch (err) {
        result.step_reglement_download = {
          ok: false,
          error: (err as Error).message,
          latency_ms: Date.now() - dlStart,
        };
      }
    }
  } catch (err) {
    result.step_ban = {
      ok: false,
      error: (err as Error).message,
      latency_ms: Date.now() - banStart,
    };
  }

  result.full_pipeline_ok =
    result.step_ban?.ok === true &&
    result.step_cadastre?.ok === true &&
    result.step_gpu_zone?.ok === true;

  return result as CoverageResult;
}

function buildSummary(results: CoverageResult[]): string {
  const total = results.length;
  const banOk = results.filter((r) => r.step_ban.ok).length;
  const cadastreOk = results.filter((r) => r.step_cadastre?.ok).length;
  const gpuOk = results.filter((r) => r.step_gpu_zone?.ok).length;
  const dlOk = results.filter((r) => r.step_reglement_download?.ok).length;
  const fullOk = results.filter((r) => r.full_pipeline_ok).length;

  // Par ville
  const byCity = new Map<string, { total: number; gpuOk: number }>();
  for (const r of results) {
    const c = r.expected_city;
    const entry = byCity.get(c) ?? { total: 0, gpuOk: 0 };
    entry.total++;
    if (r.step_gpu_zone?.ok) entry.gpuOk++;
    byCity.set(c, entry);
  }

  const cityRows = Array.from(byCity.entries())
    .map(([city, s]) => `| ${city} | ${s.gpuOk}/${s.total} | ${pct(s.gpuOk, s.total)} |`)
    .join("\n");

  return `# Spike PLU — Résumé de couverture

Mesure exécutée sur ${total} adresses.

## Taux de hit par étape du pipeline

| Étape | Hit | Taux |
|---|---|---|
| BAN géocodage | ${banOk}/${total} | ${pct(banOk, total)} |
| Cadastre (parcelle) | ${cadastreOk}/${total} | ${pct(cadastreOk, total)} |
| GPU (zone PLU) | ${gpuOk}/${total} | ${pct(gpuOk, total)} |
| Règlement PDF téléchargé | ${dlOk}/${total} | ${pct(dlOk, total)} |
| **Pipeline complet OK** | **${fullOk}/${total}** | **${pct(fullOk, total)}** |

## Taux GPU par ville

| Ville | Hit | Taux |
|---|---|---|
${cityRows}

## Critères de décision (rappel)

- **Go PR7 PLU Lite** si pipeline complet >= 70%
- **No-go** si < 50%
- **Zone grise (50-70%)** : lire les cas d'échec, possiblement restreindre le scope

Voir \`results/coverage.json\` pour le détail par adresse.
`;
}

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return `${((a / b) * 100).toFixed(1)}%`;
}

async function main() {
  console.log("📐 Mesure de la couverture du pipeline PLU sur l'échantillon...\n");

  const csv = await readFile(ADDRESSES_CSV, "utf-8");
  const rows = parseCsv(csv);
  console.log(`  ${rows.length} adresses chargées depuis ${ADDRESSES_CSV}`);
  console.log(`  Concurrence : ${CONCURRENCY}\n`);

  const limit = pLimit(CONCURRENCY);
  let done = 0;
  const results: CoverageResult[] = await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const r = await processAddress(row);
        done++;
        const status = r.full_pipeline_ok ? "✅" : "❌";
        const zone = r.step_gpu_zone?.ok ? r.step_gpu_zone.data.zone_libelle : "—";
        console.log(`  [${done}/${rows.length}] ${status} ${row.address} → zone ${zone}`);
        return r;
      }),
    ),
  );

  await writeFile(RESULTS_JSON, JSON.stringify(results, null, 2));
  const summary = buildSummary(results);
  await writeFile(RESULTS_SUMMARY, summary);

  console.log(`\n✅ Résultats détaillés : ${RESULTS_JSON}`);
  console.log(`✅ Résumé : ${RESULTS_SUMMARY}\n`);

  // Petit résumé à la console
  const fullOk = results.filter((r) => r.full_pipeline_ok).length;
  console.log(`📊 Pipeline complet : ${fullOk}/${results.length} (${pct(fullOk, results.length)})`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
