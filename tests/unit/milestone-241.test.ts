import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 241: Field Treasures/Album Touch Parity & < 600-Line Render/UI Gate", () => {
  it("declares :root[data-touch=\"on\"] >= 44 px rules across all 6 launcher stylesheets", () => {
    const launcherSheets: readonly { file: string; selectors: readonly string[] }[] = [
      { file: "src/ui/journal-ribbons.css", selectors: [".journal-ribbons-btn"] },
      { file: "src/ui/journal-weather.css", selectors: [".journal-weather-btn"] },
      { file: "src/ui/journal-hearts.css", selectors: [".journal-hearts-btn"] },
      { file: "src/ui/journal-encore.css", selectors: [".journal-encore-btn"] },
      { file: "src/ui/journal-postcards.css", selectors: [".journal-postcards-btn"] },
      {
        file: "src/ui/journal-jukebox.css",
        selectors: [
          ".journal-album-btn",
          ".journal-album-filter",
          ".journal-album-reset",
          ".journal-album-shuffle",
          ".journal-album-home-btn",
        ],
      },
    ];

    for (const { file, selectors } of launcherSheets) {
      const css = readFileSync(file, "utf8");
      const compactIdx = css.indexOf("@media (max-height: 500px)");
      expect(compactIdx, `${file} missing compact media query`).toBeGreaterThan(-1);
      const afterCompact = css.slice(compactIdx);
      for (const sel of selectors) {
        const touchSel = `:root[data-touch="on"] ${sel}`;
        expect(afterCompact, `${file} missing ${touchSel} after compact media`).toContain(touchSel);
        const escaped = sel.replace(".", "\\.");
        const rule = new RegExp(
          `:root\\[data-touch="on"\\]\\s+${escaped}[^{]*\\{[^}]*min-height:\\s*44px;`,
        );
        expect(afterCompact, `${file} ${touchSel} must set min-height: 44px`).toMatch(rule);
      }
      expect(css, `${file} missing -webkit-touch-callout: none`).toContain(
        "-webkit-touch-callout: none;",
      );
      expect(css, `${file} missing reduced-motion parity`).toContain(
        ':root[data-reduced-motion="on"]',
      );
    }
  });

  it("enforces lean line budgets across src/ui/ (< 600) and src/render/ (< 620)", () => {
    expect(lineCount("src/render/view.ts")).toBeLessThan(580);
    expect(lineCount("src/render/lantern-layer.ts")).toBeLessThan(160);

    for (const [dir, cap] of [["src/ui", 600], ["src/render", 620]] as const) {
      const files = readdirSync(dir)
        .filter((name) => name.endsWith(".ts"))
        .sort()
        .map((name) => join(dir, name));
      expect(files.length, `${dir} should contain modular TS files`).toBeGreaterThan(20);
      for (const file of files) {
        const lines = lineCount(file);
        expect(lines, `${file} must be < ${cap} lines (got ${lines})`).toBeLessThan(cap);
      }
    }
  });
});
