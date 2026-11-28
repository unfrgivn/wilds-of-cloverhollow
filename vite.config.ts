import { defineConfig } from "vite";

export interface ChunkGroup {
  name: string;
  test: RegExp;
  priority: number;
  includeDependenciesRecursively?: boolean;
}

export const chunkGroups: ChunkGroup[] = [
  { name: "vendor-pixi", test: /node_modules\/pixi\.js\//, priority: 30 },
  { name: "vendor-ink", test: /node_modules\/inkjs\//, priority: 25 },
  { name: "story-content", test: /\/content\/story\/main\.ink\.json/, priority: 22 },
  { name: "area-content", test: /\/content\/(areas|props)\//, priority: 20 },
  { name: "audio-scores", test: /\/src\/platform\/scores(-[a-z]+)?\.ts/, priority: 18 },
  {
    name: "render-engine",
    test: /\/src\/render\//,
    priority: 16,
    includeDependenciesRecursively: false,
  },
  { name: "world-content", test: /\/content\/(?!qa\/)/, priority: 15 },
];

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
    // PixiJS 8 is one atomic ~610 kB (176 kB gzip) vendor chunk that cannot be
    // split internally without circular class-extends errors; all app and
    // content chunks stay below 500 kB.
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      input: mode === "development" || mode === "harness"
        ? { game: "index.html", gallery: "ui-gallery.html" }
        : undefined,
      output: {
        codeSplitting: { groups: chunkGroups },
      },
    },
  },
}));
