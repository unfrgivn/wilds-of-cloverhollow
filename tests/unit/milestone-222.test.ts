import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as assetTouch from "../../src/shell/asset-touch";
import * as shellAssets from "../../src/shell/assets";

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 222: battle-check-choreography.ts & asset-touch.ts Splits", () => {
  it("re-exports asset-touch constants and helpers identically from src/shell/assets.ts", () => {
    expect(shellAssets.MOLE_ATLAS).toBe(assetTouch.MOLE_ATLAS);
    expect(shellAssets.FOOD_ATLAS).toBe(assetTouch.FOOD_ATLAS);
    expect(shellAssets.FISH_ATLAS).toBe(assetTouch.FISH_ATLAS);
    expect(shellAssets.TACO_ATLAS).toBe(assetTouch.TACO_ATLAS);
    expect(shellAssets.COMET_ATLAS).toBe(assetTouch.COMET_ATLAS);
    expect(shellAssets.FAE_ATLAS).toBe(assetTouch.FAE_ATLAS);
    expect(shellAssets.BATTLE_CHECKS_V2_ATLAS).toBe(assetTouch.BATTLE_CHECKS_V2_ATLAS);
    expect(shellAssets.bindBattleCheckTouch).toBe(assetTouch.bindBattleCheckTouch);
    expect(shellAssets.createTacoToppingHandler).toBe(assetTouch.createTacoToppingHandler);
    expect(shellAssets.createMoleHoleHandler).toBe(assetTouch.createMoleHoleHandler);
    expect(shellAssets.areaMediaAtlases).toBe(assetTouch.areaMediaAtlases);
    expect(shellAssets.ownedJournalAtlases).toBe(assetTouch.ownedJournalAtlases);
    expect(shellAssets.battlePortraitAtlases).toBe(assetTouch.battlePortraitAtlases);
  });

  it("keeps battle-check-choreography.ts and asset-touch.ts Pixi-free and lean", () => {
    const checkSrc = readFileSync("src/render/battle-check-choreography.ts", "utf8");
    const touchSrc = readFileSync("src/shell/asset-touch.ts", "utf8");
    expect(checkSrc).not.toMatch(/from\s+["']pixi\.js["']/);
    expect(checkSrc).not.toMatch(/\b(document|window)\b/);
    expect(touchSrc).not.toMatch(/from\s+["']pixi\.js["']/);

    expect(lineCount("src/render/battle-choreography.ts")).toBeLessThan(480);
    expect(lineCount("src/render/battle-check-choreography.ts")).toBeLessThan(400);
    expect(lineCount("src/shell/assets.ts")).toBeLessThan(600);
    expect(lineCount("src/shell/asset-touch.ts")).toBeLessThan(240);
  });
});
