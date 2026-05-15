import "dotenv/config";
import { checkBan } from "./lib/ban.js";
import { checkCadastre } from "./lib/cadastre.js";
import { checkGpu } from "./lib/gpu.js";

/**
 * Ping les 3 APIs critiques et affiche l'état de chacune.
 * À exécuter en premier — si une API a changé d'endpoint, on le sait tout de suite.
 *
 * Usage :
 *   pnpm run check:apis
 */
async function main() {
  console.log("🔎 Health check des APIs publiques...\n");

  const checks = [
    { name: "BAN (api-adresse.data.gouv.fr)", fn: checkBan },
    { name: "Cadastre (apicarto.ign.fr/cadastre)", fn: checkCadastre },
    { name: "GPU (apicarto.ign.fr/gpu)", fn: checkGpu },
  ];

  let allOk = true;
  for (const c of checks) {
    process.stdout.write(`  ${c.name}... `);
    const result = await c.fn();
    if (result.ok) {
      console.log(`✅ ${result.message}`);
    } else {
      console.log(`❌ ${result.message}`);
      allOk = false;
    }
  }

  console.log();
  if (allOk) {
    console.log("✅ Toutes les APIs répondent. Tu peux lancer `pnpm run measure:coverage`.");
    process.exit(0);
  } else {
    console.log(
      "❌ Au moins une API ne répond pas comme attendu. Lis les messages ci-dessus et vérifie les endpoints dans `src/lib/`. Ne pas lancer le batch tant que ce n'est pas vert.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(2);
});
