import { describe, expect, it } from "vitest";
import {
  createState,
  journalFish,
  journalKeepsakes,
  journalProgress,
  STAR_GEM_VARIABLES,
  type Point,
  type Polygon,
  type State,
} from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";
import { evaluateClubhouseDisplay } from "../../src/render/clubhouse-display";

const { world, fixtures } = loadContent();

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

function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (pi === undefined || pj === undefined) continue;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const crosses = (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("Milestone 95: Complete Journal Collection Showcase", () => {
  it("journalKeepsakes returns all 6 keepsakes in canonical order and tracks each unlock", () => {
    const empty = stateIn("plaza");
    const initial = journalKeepsakes(world, empty);
    expect(initial).toEqual([
      { id: "star-crystal", name: "Star Crystal", source: "Crystal Cavern", owned: false },
      { id: "star-pin", name: "Bon Appetit Star Pin", source: "Bon Appetit Café", owned: false },
      { id: "star-geode", name: "Rainbow Star Geode", source: "7 Star Gems", owned: false },
      { id: "moon-feather", name: "Moon Feather", source: "Starry Owl", owned: false },
      { id: "taco-badge", name: "Golden Taco Badge", source: "Chef Mateo", owned: false },
      {
        id: "clover-wreath",
        name: "Sanctuary Clover Wreath",
        source: "Wildlife Sanctuary",
        owned: false,
      },
    ]);

    const checks: {
      id: string;
      overrides?: Partial<State>;
      variables?: Record<string, boolean>;
    }[] = [
      { id: "star-crystal", variables: { cavern_chime_rung: true } },
      { id: "star-pin", variables: { spice_returned: true } },
      { id: "star-geode", variables: { gem_reward_all: true } },
      { id: "moon-feather", overrides: { stickers: ["starry-owl"] } },
      { id: "taco-badge", overrides: { stickers: ["taco-chef"] } },
      { id: "clover-wreath", variables: { sanctuary_reward_14: true } },
    ];
    for (const check of checks) {
      const state = stateIn("plaza", check.overrides, check.variables);
      const ownedIds = journalKeepsakes(world, state)
        .filter((item) => item.owned)
        .map((item) => item.id);
      expect(ownedIds, check.id).toEqual([check.id]);
    }
  });

  it("journalFish maps all 6 Bubblegum Bay catches against state.caughtFish", () => {
    const empty = stateIn("plaza");
    const none = journalFish(world, empty);
    expect(none).toHaveLength(6);
    expect(none.map((item) => item.id)).toEqual(
      world.arcade.fish.catches.map((item) => item.id),
    );
    expect(none.every((item) => !item.owned)).toBe(true);
    expect(none.filter((item) => item.rare).map((item) => item.id)).toEqual(["jelly", "starfish"]);

    const partial = stateIn("plaza", {
      caughtFish: { minnow: 3, starfish: 1, koi: 0 },
    });
    const list = journalFish(world, partial);
    expect(list.filter((item) => item.owned).map((item) => item.id)).toEqual([
      "minnow",
      "starfish",
    ]);
    expect(list.find((item) => item.id === "starfish")).toEqual({
      id: "starfish",
      name: "Golden Starfish Crown",
      frame: "starfish",
      owned: true,
      rare: true,
    });
  });

  it("journalProgress tallies stickers, prizes, fish, keepsakes, and gems cleanly", () => {
    const empty = stateIn("plaza");
    expect(journalProgress(world, empty)).toEqual({
      stickers: { owned: 0, total: world.stickers.catalogue.length },
      prizes: { owned: 0, total: world.arcade.prizes.length },
      fish: { owned: 0, total: 6 },
      keepsakes: { owned: 0, total: 6 },
      gems: { owned: 0, total: 7 },
    });

    const allStickers = world.stickers.catalogue.map((entry) => entry.id);
    const allPrizes = world.arcade.prizes.map((entry) => entry.id);
    const allFish = Object.fromEntries(world.arcade.fish.catches.map((item) => [item.id, 1]));
    const allGemVars = Object.fromEntries(STAR_GEM_VARIABLES.map((key) => [key, true]));
    const full = stateIn(
      "plaza",
      {
        stickers: allStickers,
        prizes: allPrizes,
        caughtFish: allFish,
      },
      {
        ...allGemVars,
        cavern_chime_rung: true,
        spice_returned: true,
        gem_reward_all: true,
        sanctuary_reward_14: true,
      },
    );
    expect(journalProgress(world, full)).toEqual({
      stickers: { owned: allStickers.length, total: allStickers.length },
      prizes: { owned: allPrizes.length, total: allPrizes.length },
      fish: { owned: 6, total: 6 },
      keepsakes: { owned: 6, total: 6 },
      gems: { owned: 7, total: 7 },
    });
  });

  it("Clubhouse display places all 6 keepsakes (19 total) strictly outside walkable floor", () => {
    const allPrizes = world.arcade.prizes.map((entry) => entry.id);
    const full = stateIn(
      "clubhouse",
      { prizes: allPrizes, stickers: ["starry-owl", "taco-chef"] },
      {
        cavern_chime_rung: true,
        spice_returned: true,
        gem_reward_all: true,
        sanctuary_reward_14: true,
      },
    );
    const display = evaluateClubhouseDisplay(world, full);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(6);
    expect(display.prizes.length + display.keepsakes.length).toBe(19);

    const wreath = display.keepsakes.find((item) => item.id === "clover-wreath");
    expect(wreath).toEqual({
      id: "clover-wreath",
      texture: "keepsakeWreath",
      x: 468,
      y: 314,
      zIndex: 320,
      scale: 0.78,
      sparkleTint: 0xa8e6cf,
    });

    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("Missing clubhouse area");
    for (const keepsake of display.keepsakes) {
      expect(
        pointInPolygon({ x: keepsake.x, y: keepsake.y }, clubhouse.walkable),
        `${keepsake.id} at (${keepsake.x}, ${keepsake.y}) must stay outside walkable floor`,
      ).toBe(false);
    }
  });
});
