import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as areaParsers from "../../src/content/area-parsers";
import * as battleParsers from "../../src/content/battle-parsers";
import * as contentLoad from "../../src/content/load";
import * as storyChecks from "../../src/content/story-checks";
import { createState } from "../../src/core";
import { openArcade } from "../../src/core/arcade";
import { startBattle } from "../../src/core/battle";
import {
  canPhotoFromJournal,
  canPhotoMode,
  type OverlayGateContext,
} from "../../src/shell/input-shortcuts";
import { buildJournalView, type JournalViewParams } from "../../src/shell/view-models";
import {
  bindOptionsCallbacks,
  defaultOptionsCallbacks,
} from "../../src/ui/journal-options";
import { cameraIcon } from "../../src/ui/postcard";
import { MAX_APP_CHUNK_BYTES, oversizedAppChunks } from "../../tools/check-dist";
import { chunkGroups } from "../../vite.config";

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

function makeGateContext(
  overrides?: Partial<Omit<OverlayGateContext, "photoMode" | "state">> & {
    state?: Partial<OverlayGateContext["state"]>;
  },
): Omit<OverlayGateContext, "photoMode"> {
  return {
    titleMode: overrides?.titleMode ?? null,
    qaMenuOpen: overrides?.qaMenuOpen ?? false,
    qaConsoleOpen: overrides?.qaConsoleOpen ?? false,
    qaBlocked: overrides?.qaBlocked ?? false,
    loading: overrides?.loading ?? false,
    state: {
      dialogue: null,
      battle: null,
      arcade: null,
      journalOpen: true,
      transition: null,
      finale: null,
      ...overrides?.state,
    },
  };
}

describe("Milestone 154: Vite Chunk-Budget Future-Proofing & Check-Dist Gate", () => {
  it("routes vendor, area, audio-score, render-engine, and world modules cleanly", () => {
    expect(routeModule("/repo/node_modules/pixi.js/lib/index.mjs")).toBe("vendor-pixi");
    expect(routeModule("/repo/node_modules/inkjs/dist/ink.mjs")).toBe("vendor-ink");
    expect(chunkGroups.some((group) => group.name === "story-content")).toBe(false);
    expect(routeModule("/repo/content/areas/summit.json")).toBe("area-content");
    expect(routeModule("/repo/content/props/island.json")).toBe("area-content");
    expect(routeModule("/repo/src/platform/scores.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/scores-helpers.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/scores-town.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/scores-wilds.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/scores-interiors.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/scores-expansion.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/platform/scores-school.ts")).toBe("audio-scores");
    expect(routeModule("/repo/src/render/view.ts")).toBe("render-engine");
    expect(routeModule("/repo/src/ui/encore-shrine.ts")).toBe("ui-overlays");
    expect(routeModule("/repo/content/critters/fountain-frog.json")).toBe("critter-content");
    expect(routeModule("/repo/content/fixtures/new-game.json")).toBe("critter-content");
    expect(routeModule("/repo/content/npc-profiles.json")).toBe("world-content");
    expect(routeModule("/repo/content/tunables.json")).toBe("world-content");
  });

  it("never leaks content/qa/ or general app modules into content chunks", () => {
    expect(routeModule("/repo/content/qa/saves.json")).toBeNull();
    expect(routeModule("/repo/content/qa/saves/golden-jordan.json")).toBeNull();
    expect(routeModule("/repo/src/platform/audio.ts")).toBeNull();
    expect(routeModule("/repo/src/platform/music.ts")).toBeNull();
    expect(routeModule("/repo/src/core/sim.ts")).toBeNull();
    expect(routeModule("/repo/src/main.ts")).toBeNull();
  });

  it("orders specific content chunk priorities above world-content", () => {
    const priorityOf = (name: string): number => {
      const group = chunkGroups.find((item) => item.name === name);
      if (group === undefined) throw new Error(`Missing chunk group ${name}`);
      return group.priority;
    };
    expect(priorityOf("vendor-pixi")).toBeGreaterThan(priorityOf("vendor-ink"));
    expect(priorityOf("vendor-ink")).toBeGreaterThan(priorityOf("area-content"));
    expect(priorityOf("area-content")).toBeGreaterThan(priorityOf("critter-content"));
    expect(priorityOf("critter-content")).toBeGreaterThan(priorityOf("audio-scores"));
    expect(priorityOf("audio-scores")).toBeGreaterThan(priorityOf("ui-overlays"));
    expect(priorityOf("ui-overlays")).toBeGreaterThan(priorityOf("render-engine"));
    expect(priorityOf("render-engine")).toBeGreaterThan(priorityOf("world-content"));
  });

  it("oversizedAppChunks exempts vendor chunks and non-JS assets while gating app chunks", () => {
    expect(MAX_APP_CHUNK_BYTES).toBe(512_000);

    const healthy = oversizedAppChunks([
      { name: "vendor-pixi-abc123.js", bytes: 640 * 1024 },
      { name: "vendor-ink-def456.js", bytes: 530 * 1024 },
      { name: "index-111111.js", bytes: 462 * 1024 },
      { name: "story-content-222222.js", bytes: MAX_APP_CHUNK_BYTES },
      { name: "area-content-333333.js", bytes: 256 * 1024 },
      { name: "audio-scores-444444.js", bytes: 46 * 1024 },
      { name: "world-content-555555.js", bytes: 340 * 1024 },
      { name: "index-666666.css", bytes: 700 * 1024 },
    ]);
    expect(healthy).toEqual([]);

    const flagged = oversizedAppChunks([
      { name: "vendor-pixi-abc123.js", bytes: 650 * 1024 },
      { name: "assets/vendor-ink-def456.js", bytes: 600 * 1024 },
      { name: "story-content-exact.js", bytes: MAX_APP_CHUNK_BYTES },
      { name: "index-too-big.js", bytes: MAX_APP_CHUNK_BYTES + 1 },
      { name: "area-content-huge.js", bytes: 540 * 1024 },
    ]);
    expect(flagged).toEqual([
      "index-too-big.js (500.0 kB)",
      "area-content-huge.js (540.0 kB)",
    ]);

    const customBudget = oversizedAppChunks(
      [
        { name: "audio-scores-test.js", bytes: 101 * 1024 },
        { name: "world-content-test.js", bytes: 99 * 1024 },
      ],
      100 * 1024,
    );
    expect(customBudget).toEqual(["audio-scores-test.js (101.0 kB)"]);
  });
});

describe("Milestone 154: Touch-Device Photo Mode Launcher in Journal OPTIONS", () => {
  it("gates canPhotoFromJournal cleanly across overworld, journal, and blocking overlays", () => {
    const journalOpenFree = makeGateContext();
    expect(canPhotoFromJournal(journalOpenFree)).toBe(true);
    expect(canPhotoMode(journalOpenFree)).toBe(false);

    const journalClosedFree = makeGateContext({ state: { journalOpen: false } });
    expect(canPhotoFromJournal(journalClosedFree)).toBe(true);
    expect(canPhotoMode(journalClosedFree)).toBe(true);

    expect(canPhotoFromJournal(makeGateContext({ titleMode: "fresh" }))).toBe(false);
    expect(canPhotoFromJournal(makeGateContext({ titleMode: "continue" }))).toBe(false);
    expect(canPhotoFromJournal(makeGateContext({ qaMenuOpen: true }))).toBe(false);
    expect(canPhotoFromJournal(makeGateContext({ qaConsoleOpen: true }))).toBe(false);
    expect(canPhotoFromJournal(makeGateContext({ qaBlocked: true }))).toBe(false);
    expect(canPhotoFromJournal(makeGateContext({ loading: true }))).toBe(false);

    expect(
      canPhotoFromJournal(
        makeGateContext({
          state: {
            dialogue: {
              knot: "maddie",
              speaker: "Maddie",
              text: "Hi!",
              revealed: 3,
              choices: [],
              selected: 0,
              ended: false,
            },
          },
        }),
      ),
    ).toBe(false);

    expect(
      canPhotoFromJournal(
        makeGateContext({
          state: {
            transition: {
              phase: "out",
              elapsed: 1,
              target: { area: "bay", spawn: "south" },
            },
          },
        }),
      ),
    ).toBe(false);

    expect(canPhotoFromJournal(makeGateContext({ state: { finale: "credits" } }))).toBe(false);
    expect(canPhotoFromJournal(makeGateContext({ state: { finale: "morning" } }))).toBe(false);

    const { world, fixtures } = contentLoad.loadContent();
    const fixture = fixtures["new-game"];
    const critter = Object.values(world.critters)[0];
    expect(fixture).toBeDefined();
    expect(critter).toBeDefined();
    if (fixture !== undefined && critter !== undefined) {
      const base = createState(world, fixture);
      const battle = startBattle(world, base, critter);
      expect(canPhotoFromJournal(makeGateContext({ state: { battle } }))).toBe(false);

      const withArcade = openArcade(world, base, "claw", 0);
      expect(canPhotoFromJournal(makeGateContext({ state: { arcade: withArcade.arcade } }))).toBe(
        false,
      );
    }
  });

  it("wires defaultOptionsCallbacks and bindOptionsCallbacks for onEnterPhotoMode", () => {
    const callbacks = defaultOptionsCallbacks();
    expect(typeof callbacks.onEnterPhotoMode).toBe("function");
    expect(callbacks.onEnterPhotoMode()).toBeUndefined();

    const binders = bindOptionsCallbacks(callbacks);
    let entered = 0;
    binders.onEnterPhotoMode(() => {
      entered += 1;
    });
    callbacks.onEnterPhotoMode();
    expect(entered).toBe(1);
  });

  it("exports shared cameraIcon() with zero <text> SVG elements", () => {
    expect(typeof cameraIcon).toBe("function");
    const postcardSource = readFileSync("src/ui/postcard.ts", "utf8");
    const match = postcardSource.match(
      /export function cameraIcon\(\): SVGSVGElement \{[\s\S]*?\n\}/,
    );
    expect(match).not.toBeNull();
    const body = match?.[0] ?? "";
    expect(body).toContain('svgElement("svg", "photo-touch-camera-icon")');
    expect(body).toContain('svgElement("path", "photo-camera-body"');
    expect(body).toContain('svgElement("circle", "photo-camera-lens"');
    expect(body).not.toMatch(/["']text["']|<text\b/);
  });

  it("passes optional canPhoto cleanly through buildJournalView without changing defaults", () => {
    const { world, fixtures } = contentLoad.loadContent();
    const fixture = fixtures["new-game"];
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const state = { ...createState(world, fixture), journalOpen: true };
    const shared: JournalViewParams = {
      world,
      state,
      notes: [],
      mapCentres: {},
      art: { stickerArt: () => null, prizeArt: () => null, fishArt: () => null },
      muted: false,
      level: 1,
      musicMuted: false,
      musicLevel: 0.75,
      ambienceMuted: false,
      nowPlaying: "Cloverhollow",
      gentleTiming: false,
      keyHints: true,
      textSpeed: "cozy",
      reducedMotion: false,
      hasLantern: false,
      hasFlute: false,
      hasLasso: false,
    };

    const omitted = buildJournalView(shared);
    expect("canPhoto" in omitted).toBe(false);

    const enabled = buildJournalView({ ...shared, canPhoto: true });
    expect(enabled.canPhoto).toBe(true);

    const disabled = buildJournalView({ ...shared, canPhoto: false });
    expect(disabled.canPhoto).toBe(false);
  });

  it("guards touch-only styling, reduced-motion, tap-selection hygiene, and file budgets", () => {
    const css = readFileSync("src/ui/journal.css", "utf8");
    expect(css).toContain(".journal-photo-btn {\n  display: none;\n}");
    expect(css).toContain(':root[data-touch="on"] .journal-photo-btn:not([hidden])');
    expect(css).toContain(':root[data-touch="on"] .journal-controls-card.has-photo');
    expect(css).toContain(':root[data-reduced-motion="on"] .journal-photo-btn:not([hidden])');
    expect(css).toContain(':root[data-reduced-motion="on"] .journal-photo-btn:active');
    expect(css).toContain("user-select: none;");
    expect(css).toContain("-webkit-user-select: none;");
    expect(css).toContain("-webkit-touch-callout: none;");

    expect(lineCount("src/main.ts")).toBeLessThan(1000);
    expect(lineCount("src/ui/journal.ts")).toBeLessThan(680);
    expect(lineCount("src/ui/journal-options.ts")).toBeLessThan(500);
  });
});

describe("Milestone 154: Pure src/content/area-parsers.ts Modular Extraction", () => {
  it("re-exports every area/world parser identically from src/content/load.ts", () => {
    expect(contentLoad.parseTunables).toBe(areaParsers.parseTunables);
    expect(contentLoad.parseArea).toBe(areaParsers.parseArea);
    expect(contentLoad.parseLands).toBe(areaParsers.parseLands);
    expect(contentLoad.parseFixture).toBe(areaParsers.parseFixture);
    expect(contentLoad.parseGroundManifest).toBe(areaParsers.parseGroundManifest);
    expect(contentLoad.parseMapCentres).toBe(areaParsers.parseMapCentres);
    expect(contentLoad.parseCharacters).toBe(areaParsers.parseCharacters);
    expect(contentLoad.completeSurfaceMaps).toBe(areaParsers.completeSurfaceMaps);

    expect(contentLoad.parseStoryJson).toBe(storyChecks.parseStoryJson);
    expect(contentLoad.storyTags).toBe(storyChecks.storyTags);
    expect(contentLoad.storyTagErrors).toBe(storyChecks.storyTagErrors);
    expect(contentLoad.endingContentErrors).toBe(storyChecks.endingContentErrors);
    expect(contentLoad.talkErrors).toBe(battleParsers.talkErrors);

    const battleExports = new Set(Object.keys(battleParsers));
    for (const key of Object.keys(areaParsers)) {
      expect(battleExports.has(key), `duplicate export ${key}`).toBe(false);
    }
  });

  it("parses content/lands.json and keeps all 36 areas intact in loadContent()", () => {
    const rawLands: unknown = JSON.parse(readFileSync("content/lands.json", "utf8"));
    const parsedLands = areaParsers.parseLands(rawLands, "content/lands.json");
    const { world } = contentLoad.loadContent();
    expect(parsedLands).toEqual(world.lands);
    expect(Object.keys(world.areas)).toHaveLength(36);
    for (const id of [
      "milo-house", "rosie-cottage", "summit", "island", "market", "parlor",
      "lane", "crossing", "boardwalk",
    ]) {
      expect(world.areas[id], `missing area ${id}`).toBeDefined();
    }
    expect(world.areas.bay?.spawns["bus-stop"]).toEqual({ x: 355, y: 545, facing: "down" });
    expect(() => areaParsers.parseLands({ bad: true }, "lands.json")).toThrow(
      "lands.json: invalid lands",
    );
  });

  it("keeps src/content/load.ts cleanly under 600 lines", () => {
    expect(lineCount("src/content/load.ts")).toBeLessThan(600);
    expect(lineCount("src/content/area-parsers.ts")).toBeLessThan(600);
  });
});
