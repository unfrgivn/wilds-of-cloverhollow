import { defineConfig } from "@playwright/test";

const webkitSpecs = [
  "title", "title-gallery", "ui-gallery", "journal-save", "dialogue",
  "battle-scene", "sound", "harness", "gamepad",
];
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["**/*.spec.ts"],
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
    // Chromium runs everything. WebKit (the iOS engine) runs the layout, UI,
    // and input-device specs plus the gameplay flows tagged @smoke: core
    // determinism across engines is already checked by the Bun hash in each
    // flow (spec 3.1), so WebKit replaying every walk only doubled the suite.
    {
      name: "webkit",
      use: { browserName: "webkit" },
      grep: new RegExp(
        ["@smoke", ...webkitSpecs.map((name) => `\\b${name}\\.spec\\.ts`)].join("|"),
      ),
    },
  ],
});
