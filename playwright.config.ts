import { defineConfig } from "@playwright/test";

const webkitSpecs = [
  "title", "title-gallery", "ui-gallery", "ui-gallery-checks", "journal-save", "dialogue",
  "battle-scene", "sound", "harness", "gamepad", "qa",
];
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["**/*.spec.ts"],
  timeout: process.env.CI === "true" ? 90_000 : 30_000,
  // CI shards run one worker each. On a three-core macOS runner (Chromium, on
  // its GPU) a second or third worker made every test 1.5 to 2.7 times slower
  // for almost no more throughput; Linux runners render WebKit in software.
  // Local runs use half the cores.
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
        // baselines are drawn that way; CI's macOS runners (a paravirtual
        // Metal GPU) match them. Headless Chromium otherwise renders in
        // software (SwiftShader): every step's draw cost 60 to 160 ms of CPU,
        // and its GPU processes starved everything else on the machine.
        launchOptions: process.platform === "darwin" ? { args: ["--use-angle=metal"] } : {},
      },
    },
    // Chromium runs everything. WebKit (the iOS engine) runs the layout, UI,
    // and input-device specs plus the gameplay flows tagged @smoke: core
    // determinism across engines is already checked by the Bun hash in each
    // flow (spec 3.1), so WebKit replaying every walk only doubled the suite.
    // WebKit draws text and images with the operating system's own libraries,
    // so its baselines hold for the macOS they were drawn on: CI (Linux)
    // runs its assertions and leaves its screenshots to local runs.
    {
      name: "webkit",
      use: { browserName: "webkit" },
      ignoreSnapshots: process.env.CI === "true",
      grep: new RegExp(
        ["@smoke", ...webkitSpecs.map((name) => `\\b${name}\\.spec\\.ts`)].join("|"),
      ),
    },
  ],
});
