import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: process.env.CI === "true" ? 90_000 : 30_000,
  // Headless Chromium renders in software (SwiftShader), each GPU process
  // taking up to three cores; the default half-the-cores workers (5 on a
  // 10-core laptop) starved them and timed out the long real-key flows.
  workers: process.env.CI === "true" ? undefined : "30%",
  expect: { timeout: 10_000 },
  webServer: {
    command:
      "bun run build:harness && bunx vite preview --outDir dist-harness " +
        "--host 127.0.0.1 --base /cloverhollow/",
    url: `http://127.0.0.1:${process.env.CLOVERHOLLOW_E2E_PORT ?? "4173"}/cloverhollow/`,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://127.0.0.1:${process.env.CLOVERHOLLOW_E2E_PORT ?? "4173"}/cloverhollow/`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    {
      name: "webkit",
      use: { browserName: "webkit" },
    },
  ],
});
