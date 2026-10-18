import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // Whole-world checks and replays take a few seconds on a laptop and
    // several times that on CI's four-core runner: tests that passed here
    // timed out there at Vitest's 5 s default, each fixed by hand.
    testTimeout: 30_000,
  },
});
