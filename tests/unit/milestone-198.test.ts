import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLUBHOUSE_PRIZES_ALIAS as directAlias,
  ClubhouseDisplayRenderer as directRenderer,
} from "../../src/render/clubhouse-display-render";
import {
  CLUBHOUSE_PRIZES_ALIAS,
  ClubhouseDisplayRenderer,
} from "../../src/render/overworld-effects";
import { chunkGroups } from "../../vite.config";

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

describe("Milestone 198: Chunk Budget Diet, Modal Overlay Hygiene & Clubhouse Render Split", () => {
  it("enforces 100% -webkit-touch-callout: none parity across every src/ui/*.css file", () => {
    const cssFiles = readdirSync("src/ui")
      .filter((name) => name.endsWith(".css"))
      .sort();
    expect(cssFiles.length).toBeGreaterThanOrEqual(27);

    const missing: string[] = [];
    for (const file of cssFiles) {
      const css = readFileSync(join("src/ui", file), "utf8");
      if (!css.includes("-webkit-touch-callout: none")) {
        missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });

  it("defensively hides overworld chrome under shrine, decor, and flute-wheel flags", () => {
    const flags = ["data-shrine", "data-decor", "data-flute-wheel"] as const;
    const cssChecks: readonly {
      file: string;
      targetSuffix: (flag: string) => readonly string[];
    }[] = [
        {
          file: "src/ui/qa.css",
          targetSuffix: (flag) => [`:root[${flag}="open"] .qa-touch-trigger:not([hidden])`],
        },
        {
          file: "src/ui/npc-chatter.css",
          targetSuffix: (flag) => [`:root[${flag}="open"] .npc-chatter`],
        },
        {
          file: "src/ui/hud-hints.css",
          targetSuffix: (flag) => [`:root[${flag}="open"] .hud-hints`],
        },
        {
          file: "src/ui/save-toast.css",
          targetSuffix: (flag) => [`:root[${flag}="open"] .save-toast`],
        },
        {
          file: "src/ui/sticker.css",
          targetSuffix: (flag) => [
            `:root[${flag}="open"] .save-toast`,
            `:root[${flag}="open"] .sticker-prompt`,
            `:root[${flag}="open"] .hud-hints`,
            `:root[${flag}="open"] .notice-marks`,
          ],
        },
      ];

    for (const { file, targetSuffix } of cssChecks) {
      const css = readFileSync(file, "utf8");
      for (const flag of flags) {
        for (const selector of targetSuffix(flag)) {
          expect(css, `${file} missing ${selector}`).toContain(selector);
        }
        const guard = new RegExp(`:root\\[${flag}="open"\\][^{]*\\{[^}]*display:\\s*none;`);
        expect(css, `${file} ${flag} rule must apply display: none`).toMatch(guard);
      }
    }

    const decorCss = readFileSync("src/ui/decor-picker.css", "utf8");
    expect(decorCss).toContain(':root[data-touch="on"] .decor-close-btn');
    expect(decorCss).toContain(':root[data-touch="on"] .decor-btn');
    expect(decorCss).toContain(':root[data-touch="on"] .decor-prize-pill');
    expect(decorCss).toMatch(
      /:root\[data-touch="on"\] \.decor-close-btn[^{]*\{[^}]*min-height:\s*44px;/,
    );
  });

  it("preserves modular chunk groups, ClubhouseDisplayRenderer identity, and budgets", () => {
    const names = chunkGroups.map((group) => group.name);
    expect(names).toContain("critter-content");
    expect(names).toContain("ui-overlays");
    expect(names).toContain("render-engine");
    expect(names).toContain("world-content");

    expect(routeModule("/repo/content/critters/fountain-frog.json")).toBe("critter-content");
    expect(routeModule("/repo/src/ui/decor-picker.ts")).toBe("ui-overlays");
    expect(routeModule("/repo/src/render/clubhouse-display-render.ts")).toBe("render-engine");

    const uiGroup = chunkGroups.find((group) => group.name === "ui-overlays");
    expect(uiGroup?.includeDependenciesRecursively).toBe(false);

    expect(CLUBHOUSE_PRIZES_ALIAS).toBe(directAlias);
    expect(ClubhouseDisplayRenderer).toBe(directRenderer);

    expect(lineCount("src/render/overworld-effects.ts")).toBeLessThan(690);
    expect(lineCount("src/render/clubhouse-display-render.ts")).toBeLessThan(340);
    expect(lineCount("src/main.ts")).toBeLessThan(890);
  });
});
