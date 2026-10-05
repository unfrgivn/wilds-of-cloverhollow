import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command:
      "bun run build:harness && bunx vite preview --outDir dist-harness --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
});
