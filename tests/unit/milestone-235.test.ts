import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AMBIENCE_ACCENT_CADENCE_MS,
  ambiencePan,
  createAmbiencePlayer,
} from "../../src/platform/ambience";
import { createAmbienceAccents } from "../../src/platform/ambience-accents";
import { createDecorPicker, decorFeedbackEffect } from "../../src/ui/decor-picker";
import {
  buildDecorHeader,
  buildPedestalsSection,
  buildShelfSection,
  buildSwatchesSection,
  buildVisitorsSection,
} from "../../src/ui/decor-picker-sections";
import { chunkGroups } from "../../vite.config";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

describe("Milestone 235: 6-of-6 Journal Tile Parity & Decor/Ambience Modular Splits", () => {
  it("declares list/listitem, tabIndex=0, aria-label & :focus-visible on Ribbons & Gems", () => {
    const ribbonsTs = readFileSync("src/ui/journal-ribbons.ts", "utf8");
    const ribbonsCss = readFileSync("src/ui/journal-ribbons.css", "utf8");
    const gemsTs = readFileSync("src/ui/journal-gems-ledger.ts", "utf8");
    const journalCss = readFileSync("src/ui/journal.css", "utf8");

    expect(ribbonsTs).toContain('setAttribute(grid, "role", "list")');
    expect(ribbonsTs).toContain('setAttribute(tile, "role", "listitem")');
    expect(ribbonsTs).toContain("tile.tabIndex = 0;");
    expect(ribbonsTs).toContain('setAttribute(tile, "aria-label"');
    expect(ribbonsTs).toContain('key === "ArrowRight"');
    expect(ribbonsTs).toContain('key === "ArrowDown"');
    expect(ribbonsCss).toContain(".journal-ribbon-tile:focus-visible");

    expect(gemsTs).toContain('grid.setAttribute("role", "list")');
    expect(gemsTs).toContain('setAttribute(tile, "role", "listitem")');
    expect(gemsTs).toContain("tile.tabIndex = 0;");
    expect(gemsTs).toContain('setAttribute(tile, "aria-label"');
    expect(gemsTs).toContain('key === "ArrowRight"');
    expect(gemsTs).toContain('key === "ArrowDown"');
    expect(journalCss).toContain(".journal-gem-tile:focus-visible");
  });

  it("routes ambience-accents.ts into audio-scores and decor-picker-sections.ts to ui", () => {
    expect(routeModule("/repo/src/platform/ambience.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/weather-ambience.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/ambience-accents.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/ui/decor-picker.ts")).toBe("ui-overlays");
    expect(routeModule("/repo/src/ui/decor-picker-sections.ts")).toBe("ui-overlays");
  });

  it("preserves decor-picker & ambience public exports and meets strict line budgets", () => {
    expect(typeof createDecorPicker).toBe("function");
    expect(decorFeedbackEffect("open")).toBe("card-open");
    expect(decorFeedbackEffect("buy")).toBe("tool-sparkle");
    expect(typeof buildDecorHeader).toBe("function");
    expect(typeof buildSwatchesSection).toBe("function");
    expect(typeof buildPedestalsSection).toBe("function");
    expect(typeof buildShelfSection).toBe("function");
    expect(typeof buildVisitorsSection).toBe("function");

    expect(typeof createAmbiencePlayer).toBe("function");
    expect(typeof createAmbienceAccents).toBe("function");
    expect(Object.keys(AMBIENCE_ACCENT_CADENCE_MS)).toHaveLength(9);
    expect(ambiencePan("none", 0)).toBe(0);

    expect(lineCount("src/ui/decor-picker.ts")).toBeLessThan(380);
    expect(lineCount("src/ui/decor-picker-sections.ts")).toBeLessThan(370);
    expect(lineCount("src/platform/ambience.ts")).toBeLessThan(360);
    expect(lineCount("src/platform/ambience-accents.ts")).toBeLessThan(360);
  });
});
