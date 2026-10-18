import { defineConfig } from "@playwright/test";

const webkitSpecs = [
  "title", "title-gallery", "ui-gallery", "journal-save", "dialogue",
  "battle-scene", "sound", "harness", "gamepad",
];
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["**/*.spec.ts"],
  timeout: process.env.CI === "true" ? 90_000 : 30_000,
  // CI's Linux runner has no GPU, so headless Chromium renders in software
  // (SwiftShader), each GPU process taking up to three cores: one worker per
  // shard keeps them from starving each other on the four-vCPU runner. A Mac
  // draws on its GPU (the chromium project below), so local runs use half the
  // cores.
  workers: process.env.CI === "true" ? 1 : "50%",
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
      use: {
        browserName: "chromium",
        // On a Mac, WebGL draws on the GPU through Metal, and the screenshot
        // baselines are drawn that way. Headless Chromium otherwise renders
        // in software (SwiftShader): every step's draw cost 60 to 160 ms of
        // CPU, and its GPU processes starved everything else on the machine.
        launchOptions: process.platform === "darwin" ? { args: ["--use-angle=metal"] } : {},
      },
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
