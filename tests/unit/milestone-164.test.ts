import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  journalKeepsakes,
  journalProgress,
  pointInPolygon,
  setInkVariables,
  treasuresSummary,
  valleyCompletion,
  type KeepsakeId,
  type State,
} from "../../src/core";
import { inkVariable } from "../../src/core/ink";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";
import { evaluateClubhouseDisplay } from "../../src/render/clubhouse-display";
import { KEEPSAKE_TEXTURE_KEYS, type KeepsakeTextureKey } from "../../src/render/keepsake-textures";
import { keepsakeIcon, keepsakeMarkup } from "../../src/ui/icons";

const { world, fixtures } = loadContent();

const ALL_KEEPSAKE_IDS: readonly KeepsakeId[] = [
  "star-crystal",
  "star-pin",
  "star-geode",
  "moon-feather",
  "taco-badge",
  "clover-wreath",
  "sea-compass",
  "alpine-clover",
  "star-whistle",
  "loft-sketch",
  "aurora-rubbing",
  "shell-shard",
  "festival-ribbon",
];

const EXPANSION_KEEPSAKE_IDS: readonly KeepsakeId[] = [
  "loft-sketch",
  "aurora-rubbing",
  "shell-shard",
  "festival-ribbon",
];

const ALL_KEEPSAKE_VARS: Record<string, boolean> = {
  cavern_chime_rung: true,
  spice_returned: true,
  gem_reward_all: true,
  sanctuary_reward_14: true,
  sue_compass: true,
  jordan_clover: true,
  buster_reward: true,
  milo_loft_visited: true,
  rosie_cottage_visited: true,
  summit_aurora_read: true,
  island_shells_solved: true,
  festival_toast_done: true,
};

const consoleContext: ConsoleContext = {
  story: world.story,
  stickerIds: world.stickers.catalogue.map((sticker) => sticker.id),
  prizeIds: world.arcade.prizes.map((prize) => prize.id),
  treatIds: world.treats.map((treat) => treat.id),
  fishIds: world.arcade.fish.catches.map((item) => item.id),
  thresholds: world.levels.thresholds,
};

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, ink, ...overrides };
}

describe("Milestone 164: Complete 13-Keepsake Showcase & 26-Item Living Clubhouse Museum", () => {
  it("registers all 13 keepsakes across journal, treasures, SVG charms & VFX", () => {
    const empty = stateIn("clubhouse");
    const journalList = journalKeepsakes(world, empty);
    const treasures = treasuresSummary(world, empty);

    expect(journalList.map((entry) => entry.id)).toEqual(ALL_KEEPSAKE_IDS);
    expect(treasures.keepsakes.map((entry) => entry.id)).toEqual(ALL_KEEPSAKE_IDS);
    expect(treasures.totalKeepsakes).toBe(13);
    expect(KEEPSAKE_TEXTURE_KEYS).toHaveLength(13);
    expect(KEEPSAKE_TEXTURE_KEYS.slice(-4)).toEqual([
      "keepsakeSketch",
      "keepsakeAurora",
      "keepsakeShell",
      "keepsakeRibbon",
    ] satisfies readonly KeepsakeTextureKey[]);

    expect(typeof keepsakeIcon).toBe("function");
    for (const id of ALL_KEEPSAKE_IDS) {
      const markup = keepsakeMarkup[id];
      expect(markup.length, `${id} SVG markup`).toBeGreaterThan(80);
      expect(markup.toLowerCase(), `${id} zero <text> nodes`).not.toContain("<text");
      expect(markup.toLowerCase(), `${id} warm-brown ink`).toContain("#47321f");
    }

    const fullProgress = journalProgress(
      world,
      stateIn("plaza", { stickers: ["starry-owl", "taco-chef"] }, ALL_KEEPSAKE_VARS),
    );
    expect(fullProgress.keepsakes).toEqual({ owned: 13, total: 13 });
    expect(valleyCompletion(fullProgress).total).toBe(63);
  });

  it("gates loft-sketch on BOTH milo_loft_visited and rosie_cottage_visited", () => {
    const onlyMilo = stateIn("clubhouse", {}, { milo_loft_visited: true });
    const onlyRosie = stateIn("clubhouse", {}, { rosie_cottage_visited: true });
    const both = stateIn("clubhouse", {}, {
      milo_loft_visited: true,
      rosie_cottage_visited: true,
    });

    for (const partial of [onlyMilo, onlyRosie]) {
      expect(
        journalKeepsakes(world, partial).find((item) => item.id === "loft-sketch")?.owned,
      ).toBe(false);
      expect(
        treasuresSummary(world, partial).keepsakes.find((item) => item.id === "loft-sketch")
          ?.unlocked,
      ).toBe(false);
      const displayed = evaluateClubhouseDisplay(world, partial).keepsakes;
      expect(displayed.some((item) => item.id === "loft-sketch")).toBe(false);
    }

    expect(
      journalKeepsakes(world, both).find((item) => item.id === "loft-sketch")?.owned,
    ).toBe(true);
    expect(
      treasuresSummary(world, both).keepsakes.find((item) => item.id === "loft-sketch")?.unlocked,
    ).toBe(true);
    expect(
      evaluateClubhouseDisplay(world, both).keepsakes.some((item) => item.id === "loft-sketch"),
    ).toBe(true);
  });

  it("places all 26 Clubhouse items non-blocking with >= 44 px clearance for new items", () => {
    const allPrizes = world.arcade.prizes.map((entry) => entry.id);
    const full = stateIn(
      "clubhouse",
      { prizes: allPrizes, stickers: ["starry-owl", "taco-chef"] },
      ALL_KEEPSAKE_VARS,
    );
    const display = evaluateClubhouseDisplay(world, full);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(13);
    expect(display.prizes.length + display.keepsakes.length).toBe(26);

    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("Missing clubhouse area");
    for (const keepsake of display.keepsakes) {
      expect(
        pointInPolygon({ x: keepsake.x, y: keepsake.y }, clubhouse.walkable),
        `${keepsake.id} (${keepsake.x}, ${keepsake.y}) must stay outside walkable floor`,
      ).toBe(false);
    }

    const allItems = [
      ...display.prizes.map((item) => ({ id: item.id, x: item.x, y: item.y })),
      ...display.keepsakes.map((item) => ({ id: item.id, x: item.x, y: item.y })),
    ];
    for (const newId of EXPANSION_KEEPSAKE_IDS) {
      const target = display.keepsakes.find((item) => item.id === newId);
      if (target === undefined) throw new Error(`Missing placement for ${newId}`);
      for (const other of allItems) {
        if (other.id === newId) continue;
        const dist = Math.hypot(target.x - other.x, target.y - other.y);
        expect(dist, `${newId} <-> ${other.id} distance`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it("toggles all 5 expansion story variables cleanly via QA console keepsakes on|off", () => {
    const expansionVars = [
      "milo_loft_visited",
      "rosie_cottage_visited",
      "summit_aurora_read",
      "island_shells_solved",
      "festival_toast_done",
    ] as const;
    const start = stateIn("clubhouse");
    const on = runConsoleCommand(consoleContext, start, "keepsakes on");
    expect(on.kind).toBe("applied");
    if (on.kind !== "applied") return;
    for (const variable of expansionVars) {
      expect(inkVariable(world.story, on.state.ink, variable), `${variable} on`).toBe(true);
    }
    expect(evaluateClubhouseDisplay(world, on.state).keepsakes).toHaveLength(11);

    const off = runConsoleCommand(consoleContext, on.state, "keepsakes off");
    expect(off.kind).toBe("applied");
    if (off.kind !== "applied") return;
    for (const variable of expansionVars) {
      expect(inkVariable(world.story, off.state.ink, variable), `${variable} off`).toBe(false);
    }
    expect(evaluateClubhouseDisplay(world, off.state).keepsakes).toHaveLength(0);
  });

  it("keeps every modified implementation file strictly under 1,000 lines (icons.ts < 400)", () => {
    const files = [
      ["src/core/journal.ts", 1000],
      ["src/core/treasures.ts", 1000],
      ["src/ui/icons.ts", 400],
      ["src/render/keepsake-textures.ts", 1000],
      ["src/render/keepsake-textures-expansion.ts", 1000],
      ["src/render/clubhouse-display.ts", 1000],
      ["src/dev/console.ts", 1000],
    ] as const;
    for (const [file, limit] of files) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} line count`).toBeLessThan(limit);
    }
  });
});
