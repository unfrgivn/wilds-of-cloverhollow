import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Milestone 170: QA Touch Trigger Overlay Guard", () => {
  it("hides .qa-touch-trigger with matching specificity across all 7 overlays", () => {
    const css = readFileSync("src/ui/qa.css", "utf8");
    expect(css).toContain(':root[data-touch="on"] .qa-touch-trigger:not([hidden])');
    for (const overlay of [
      'data-photo="on"',
      'data-credits="open"',
      'data-title="open"',
      'data-battle="open"',
      'data-journal="open"',
      'data-arcade="open"',
      'data-qa-console="open"',
    ]) {
      expect(css, `qa.css must suppress .qa-touch-trigger under ${overlay}`).toContain(
        `:root[${overlay}] .qa-touch-trigger:not([hidden])`,
      );
    }
  });
});
