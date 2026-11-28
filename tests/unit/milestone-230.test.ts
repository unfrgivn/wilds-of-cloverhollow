import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as areaChecks from "../../src/content/area-checks";
import * as areaConnectionChecks from "../../src/content/area-connection-checks";
import {
  LASSO_RAINBOW,
  mirrorArms,
  NOTE_COLORS,
  polygonCenter,
  pushableFrame,
  SPARKLE_TINTS,
} from "../../src/render/puzzles-render-fx";
import { chunkGroups } from "../../vite.config";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

describe("Milestone 230: Album Toolbar Focus, S Shuffle & Modular Splits (Track E19R)", () => {
  it("routes home-record-prefs.ts cleanly into audio-scores", () => {
    const audioGroup = chunkGroups.find((group) => group.name === "audio-scores");
    expect(audioGroup).toBeDefined();
    expect(audioGroup?.priority).toBe(18);
    expect(audioGroup?.includeDependenciesRecursively).toBe(false);

    expect(routeModule("/repo/src/platform/home-record-prefs.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/audio-settings.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/weather-ambience.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/weather-prefs.ts")).toBe("render-engine");
    expect(routeModule("/repo/src/platform/reduced-motion.ts")).toBe("render-engine");
    expect(routeModule("/repo/src/core/music.ts")).toBeNull();
    expect(routeModule("/repo/src/main.ts")).toBeNull();
  });

  it("re-exports areaConnectionErrors and navigationQualityErrors identically and enforces caps",
    () => {
      expect(areaChecks.areaConnectionErrors).toBe(areaConnectionChecks.areaConnectionErrors);
      expect(areaChecks.navigationQualityErrors).toBe(areaConnectionChecks.navigationQualityErrors);

      const caps: readonly [string, number][] = [
        ["src/render/puzzles-render.ts", 460],
        ["src/render/puzzles-render-fx.ts", 320],
        ["src/content/area-checks.ts", 420],
        ["src/content/area-connection-checks.ts", 280],
        ["src/ui/journal-jukebox.ts", 360],
      ];
      for (const [file, cap] of caps) {
        const lines = lineCount(file);
        expect(lines, `${file} (${lines} lines) must stay < ${cap}`).toBeLessThan(cap);
      }
    });

  it("preserves puzzle FX geometry and palette helpers in puzzles-render-fx.ts", () => {
    expect(LASSO_RAINBOW).toHaveLength(5);
    expect(SPARKLE_TINTS).toHaveLength(5);
    expect(Object.keys(NOTE_COLORS).sort()).toEqual(["down", "left", "right", "up"]);
    expect(polygonCenter([])).toEqual({ x: 0, y: 0 });
    expect(polygonCenter([[0, 0], [10, 0], [10, 20], [0, 20]])).toEqual({ x: 5, y: 10 });
    expect(pushableFrame("rock")).toBe("push-rock");
    expect(pushableFrame("snowball")).toBe("push-snowball");
    expect(pushableFrame("crate")).toBe("push-crate");
    expect(mirrorArms("ne")).toEqual([{ x: 0, y: -1 }, { x: 1, y: 0 }]);
    expect(mirrorArms("se")).toEqual([{ x: 0, y: 1 }, { x: 1, y: 0 }]);
    expect(mirrorArms("sw")).toEqual([{ x: 0, y: 1 }, { x: -1, y: 0 }]);
    expect(mirrorArms("nw")).toEqual([{ x: 0, y: -1 }, { x: -1, y: 0 }]);
  });

  it("wires enabled-only toolbar focus, Home/End, and S Shuffle shortcut in journal-jukebox.ts",
    () => {
      const jukeboxSrc = readFileSync("src/ui/journal-jukebox.ts", "utf8");
      expect(jukeboxSrc).toContain(".filter((btn) => !btn.disabled && !btn.hidden)");
      expect(jukeboxSrc).toContain('key === "Home"');
      expect(jukeboxSrc).toContain('key === "End"');
      expect(jukeboxSrc).toContain('key === "s" || key === "S"');
      expect(jukeboxSrc).toContain("shuffleBtn.click()");
    });
});
