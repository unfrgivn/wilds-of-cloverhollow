import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/dist/**", "**/dist-harness/**", "**/ios/**",
      "**/.derived-data/**", "**/art/scratch/**", "**/art/review/**"] },
  },
  preview: { port: Number(process.env.CLOVERHOLLOW_E2E_PORT ?? 4173), strictPort: true },
  build: {
    outDir: mode === "harness" ? "dist-harness" : "dist",
    rollupOptions: mode === "development" || mode === "harness"
      ? { input: { game: "index.html", gallery: "ui-gallery.html" } }
      : undefined,
  },
}));
