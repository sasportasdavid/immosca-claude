import fs from "node:fs";
import path from "node:path";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const valueWebSrc = path.resolve(__dirname, "./src");
const webSrc = path.resolve(__dirname, "../web/src");

// Résolution custom : un import `@/X` cherche d'abord dans
// apps/value-web/src/X, puis fallback dans apps/web/src/X. Ce fallback
// permet aux composants ui d'apps/web (qui font `import { Label } from
// "@/components/ui/label"`) de résoudre depuis le contexte value-web.
// Sans ce fallback, les composants ui partagés ne pourraient importer
// que via chemins relatifs.
function resolveAtAlias(): {
  name: string;
  resolveId(id: string): string | null;
} {
  return {
    name: "value-web-at-alias-fallback",
    resolveId(id: string) {
      if (!id.startsWith("@/")) return null;
      const rel = id.slice(2);
      // Essaie value-web/src d'abord, puis apps/web/src.
      const candidates = [valueWebSrc, webSrc];
      const exts = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
      for (const base of candidates) {
        for (const ext of exts) {
          const full = path.join(base, rel + ext);
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            return full;
          }
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [TanStackRouterVite(), resolveAtAlias(), react()],
  // Charge .env.local depuis la racine du repo (même convention qu'apps/web).
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      // @web pointe explicitement sur apps/web/src — pour les imports
      // intentionnels comme `import { Button } from "@web/components/ui/button"`.
      "@web": webSrc,
      // @ pointe sur value-web/src par défaut. Le plugin resolveAtAlias
      // gère le fallback vers apps/web/src quand le fichier n'existe pas
      // localement (nécessaire pour les composants ui partagés).
      "@": valueWebSrc,
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
