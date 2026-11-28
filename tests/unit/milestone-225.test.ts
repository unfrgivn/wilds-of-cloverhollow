import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KEEPSAKE_TEXTURE_KEYS,
  type KeepsakeTextureKey,
} from "../../src/render/keepsake-textures";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function listTsFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => join(dir, name));
}

describe("Milestone 225: 7-of-7 Minigame WCAG 4.1.3 Parity & <700-Line Render/UI Gate", () => {
  it("declares modal dialog and polite atomic live regions on all 7 minigames and Shrine", () => {
    const minigames = [
      "src/ui/claw.ts",
      "src/ui/skee.ts",
      "src/ui/mole.ts",
      "src/ui/comet.ts",
      "src/ui/cook.ts",
      "src/ui/fish.ts",
      "src/ui/taco.ts",
    ] as const;

    for (const file of minigames) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} role="dialog"`).toContain('setAttribute("role", "dialog")');
      expect(source, `${file} aria-modal="true"`).toContain('setAttribute("aria-modal", "true")');
      expect(source, `${file} aria-live="polite"`).toContain('setAttribute("aria-live", "polite")');
      expect(source, `${file} aria-atomic="true"`).toContain('setAttribute("aria-atomic", "true")');
    }

    const shrine = readFileSync("src/ui/encore-shrine.ts", "utf8");
    expect(shrine).toContain('rewardPreview.setAttribute("aria-live", "polite")');
    expect(shrine).toContain('rewardPreview.setAttribute("aria-atomic", "true")');
  });

  it("keeps every .ts file across src/ui/ and src/render/ strictly under 700 lines", () => {
    const uiFiles = listTsFiles("src/ui");
    const renderFiles = listTsFiles("src/render");
    expect(uiFiles.length).toBeGreaterThan(20);
    expect(renderFiles.length).toBeGreaterThan(20);

    for (const file of [...uiFiles, ...renderFiles]) {
      const lines = lineCount(file);
      expect(lines, `${file} must be < 700 lines (got ${lines})`).toBeLessThan(700);
    }

    expect(lineCount("src/render/keepsake-textures.ts")).toBeLessThan(440);
    expect(lineCount("src/render/keepsake-textures-valley.ts")).toBeLessThan(440);
    expect(lineCount("src/render/keepsake-textures-expansion.ts")).toBeLessThan(380);
    expect(lineCount("src/ui/encore-shrine.ts")).toBeLessThan(700);
  });

  it("preserves all 13 canonical KEEPSAKE_TEXTURE_KEYS in exact order", () => {
    const expected: readonly KeepsakeTextureKey[] = [
      "keepsakeCrystal",
      "keepsakePin",
      "keepsakeGeode",
      "keepsakeFeather",
      "keepsakeTaco",
      "keepsakeWreath",
      "keepsakeCompass",
      "keepsakeClover",
      "keepsakeWhistle",
      "keepsakeSketch",
      "keepsakeAurora",
      "keepsakeShell",
      "keepsakeRibbon",
    ];
    expect(KEEPSAKE_TEXTURE_KEYS).toEqual(expected);
    expect(KEEPSAKE_TEXTURE_KEYS).toHaveLength(13);
  });
});
