import path from "node:path";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  // Charge .env.local depuis la racine du repo plutôt que apps/web/.
  // Permet à plusieurs worktrees / clones de partager un seul .env.local
  // sans symlink ad-hoc. Si tu préfères un fichier par app, supprime
  // cette ligne et place les VITE_* dans apps/web/.env.local.
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
