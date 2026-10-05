import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: mode === "harness" ? "dist-harness" : "dist" },
}));
