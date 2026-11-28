import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMOTE_TEXTURE_KEYS, type EmoteTextureKey } from "../../src/render/emote-textures";
import * as restorationMath from "../../src/render/restoration-math";
import * as restorationZones from "../../src/render/restoration-zones";
import {
  EMOTE_TEXTURE_KEYS as VFX_EMOTE_TEXTURE_KEYS,
  type EmoteTextureKey as VfxEmoteTextureKey,
  type VfxTextureKey,
} from "../../src/render/vfx-textures";
import * as journalMap from "../../src/ui/journal-map";
import * as journalMapHelpers from "../../src/ui/journal-map-helpers";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 220: Atlas Keyboard Parity & < 800-Line Render/UI Modularization", () => {
  it("preserves reference-identical re-exports and Pixi/DOM purity for extracted modules", () => {
    // Reference-identical re-exports through src/ui/journal-map.ts.
    expect(journalMap.busStopIcon).toBe(journalMapHelpers.busStopIcon);
    expect(journalMap.busRoutePath).toBe(journalMapHelpers.busRoutePath);

    // Reference-identical re-exports through src/render/restoration-math.ts.
    expect(restorationMath.RESTORATION_ZONE_IDS).toBe(restorationZones.RESTORATION_ZONE_IDS);
    expect(restorationMath.RESTORATION_ZONES).toBe(restorationZones.RESTORATION_ZONES);
    expect(restorationMath.isRestorationZoneId).toBe(restorationZones.isRestorationZoneId);

    // Reference-identical emote keys across emote-textures.ts and vfx-textures.ts.
    const expectedEmotes: readonly EmoteTextureKey[] = [
      "emoteQuestion",
      "emoteExclaim",
      "emoteNote",
      "emoteZzz",
      "emoteHeart",
      "emoteSparkle",
      "emoteWave",
      "emoteWorry",
    ];
    expect(EMOTE_TEXTURE_KEYS).toEqual(expectedEmotes);
    expect(VFX_EMOTE_TEXTURE_KEYS).toBe(EMOTE_TEXTURE_KEYS);
    const asVfxKeys: readonly VfxTextureKey[] = expectedEmotes;
    const asReexported: readonly VfxEmoteTextureKey[] = expectedEmotes;
    expect(asVfxKeys).toHaveLength(8);
    expect(asReexported).toHaveLength(8);

    // Pixi-free and DOM-free purity for src/render/restoration-zones.ts.
    const zonesSrc = readFileSync("src/render/restoration-zones.ts", "utf8");
    const zonesCode = zonesSrc.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(zonesCode).not.toMatch(/from\s+["']pixi\.js["']/);
    expect(zonesCode).not.toMatch(/\b(document|window|HTMLElement)\b/);
  });

  it("enforces the global < 800-line architecture gate across every src/ui and src/render file",
    () => {
      for (const dir of ["src/ui", "src/render"] as const) {
        const tsFiles = readdirSync(dir)
          .filter((name) => name.endsWith(".ts"))
          .sort();
        expect(tsFiles.length).toBeGreaterThan(0);
        for (const name of tsFiles) {
          const filePath = join(dir, name);
          expect(lineCount(filePath), `${filePath} exceeded 800-line gate`).toBeLessThan(800);
        }
      }

      // Specific Milestone 220 modular line budgets.
      expect(lineCount("src/ui/journal-map.ts")).toBeLessThan(560);
      expect(lineCount("src/ui/journal-map-helpers.ts")).toBeLessThan(290);
      expect(lineCount("src/render/vfx-textures.ts")).toBeLessThan(510);
      expect(lineCount("src/render/emote-textures.ts")).toBeLessThan(340);
      expect(lineCount("src/render/restoration-math.ts")).toBeLessThan(430);
      expect(lineCount("src/render/restoration-zones.ts")).toBeLessThan(340);
    });
});
