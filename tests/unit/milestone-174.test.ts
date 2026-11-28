import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as BattleChoreo from "../../src/render/battle-choreography";
import * as BattleTheater from "../../src/render/battle-theater";
import * as BattleVfx from "../../src/render/battle-vfx";

function collectTsFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 174: Modular src/render/battle-theater.ts Extraction", () => {
  it("re-exports all battle-theater symbols identically from battle-vfx and choreography", () => {
    expect(BattleVfx.classifySnackTheater).toBe(BattleTheater.classifySnackTheater);
    expect(BattleVfx.isTalkTheater).toBe(BattleTheater.isTalkTheater);
    expect(BattleVfx.isRecoverTheater).toBe(BattleTheater.isRecoverTheater);
    expect(BattleVfx.RECOVER_SPARKLE_TINTS).toBe(BattleTheater.RECOVER_SPARKLE_TINTS);
    expect(BattleVfx.applyTalkTheater).toBe(BattleTheater.applyTalkTheater);
    expect(BattleVfx.applySnackTheater).toBe(BattleTheater.applySnackTheater);
    expect(BattleVfx.applyRecoverTheater).toBe(BattleTheater.applyRecoverTheater);
    expect(BattleVfx.applySoothedAndReward).toBe(BattleTheater.applySoothedAndReward);
    expect(BattleVfx.RAINBOW_HEARTS).toBe(BattleTheater.RAINBOW_HEARTS);
    expect(BattleVfx.SPARKLE_TINTS).toBe(BattleTheater.SPARKLE_TINTS);
    expect(BattleVfx.RELIEF_PETALS).toBe(BattleTheater.RELIEF_PETALS);
    expect(BattleVfx.radialBurst).toBe(BattleTheater.radialBurst);
    expect(BattleVfx.clamp01).toBe(BattleTheater.clamp01);

    expect(BattleChoreo.classifySnackTheater).toBe(BattleTheater.classifySnackTheater);
    expect(BattleChoreo.isTalkTheater).toBe(BattleTheater.isTalkTheater);
    expect(BattleChoreo.isRecoverTheater).toBe(BattleTheater.isRecoverTheater);
    expect(BattleChoreo.RECOVER_SPARKLE_TINTS).toBe(BattleTheater.RECOVER_SPARKLE_TINTS);
    expect(BattleChoreo.RAINBOW_HEARTS).toBe(BattleTheater.RAINBOW_HEARTS);
    expect(BattleChoreo.SPARKLE_TINTS).toBe(BattleTheater.SPARKLE_TINTS);
    expect(BattleChoreo.RELIEF_PETALS).toBe(BattleTheater.RELIEF_PETALS);
    expect(BattleChoreo.radialBurst).toBe(BattleTheater.radialBurst);
  });

  it("keeps battle-theater.ts Pixi-free with zero runtime cycle and enforces src/ budgets", () => {
    const theaterSource = readFileSync("src/render/battle-theater.ts", "utf8");
    expect(theaterSource).not.toMatch(/from\s+["']pixi\.js["']/);
    expect(theaterSource).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+["']\.\/battle-vfx["']/m);

    expect(lineCount("src/render/battle-vfx.ts")).toBeLessThan(650);
    expect(lineCount("src/render/battle-theater.ts")).toBeLessThan(500);

    const files = collectTsFiles("src").filter((file) => file !== "src/core/types.ts");
    const overLimit = files
      .map((file) => ({ file, lines: lineCount(file) }))
      .filter(({ lines }) => lines >= 960);
    expect(overLimit).toEqual([]);
  });
});
