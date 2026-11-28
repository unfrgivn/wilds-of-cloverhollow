import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, pointInPolygon, type Point, type Polygon, type State } from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { effectRecipe, soundCueRecipe, type AudioSegment } from "../../src/platform/audio";
import { evaluateClubhouseDisplay } from "../../src/render/clubhouse-display";
import { classifyBattlePopup, type BattlePopupSnapshot } from "../../src/ui/battle";
import { postcardMetadata } from "../../src/ui/postcard";

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

function distanceToPolygonEdges(point: Point, polygon: Polygon): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j];
    const b = polygon[i];
    if (a === undefined || b === undefined) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / lenSq));
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    min = Math.min(min, Math.hypot(point.x - px, point.y - py));
  }
  return min;
}

function recipeDuration(segments: readonly AudioSegment[]): number {
  return Math.max(...segments.map((segment) => segment.offset + segment.duration));
}

describe("Milestone 104: Paper-Mario Battle Popups", () => {
  const base: BattlePopupSnapshot = {
    battleKey: "frog",
    calm: 20,
    energy: 3,
    poppedCount: 0,
    message: "What will Fae do?",
    tick: 100,
  };

  it("classifies normal, big, favourite, wind-up POP!, and energy popups", () => {
    expect(classifyBattlePopup(base, { ...base, calm: 38, tick: 101 })).toEqual([
      { kind: "normal", text: "+18", side: "critter" },
    ]);

    expect(classifyBattlePopup(base, { ...base, calm: 55, tick: 101 })).toEqual([
      { kind: "big", text: "+35 ★", side: "critter" },
    ]);

    expect(classifyBattlePopup(base, { ...base, calm: 70, tick: 101 })).toEqual([
      { kind: "fav", text: "+50 ♥", side: "critter" },
    ]);

    expect(
      classifyBattlePopup(base, {
        ...base,
        calm: 42,
        message: "Crunchy Fish Crackers! Their favourite!",
        tick: 101,
      }),
    ).toEqual([{ kind: "fav", text: "+22 ♥", side: "critter" }]);

    expect(classifyBattlePopup(base, { ...base, poppedCount: 1, tick: 101 })).toEqual([
      { kind: "pop", text: "POP!", side: "critter" },
    ]);

    expect(classifyBattlePopup(base, { ...base, energy: 5, tick: 101 })).toEqual([
      { kind: "energy", text: "+2 ⚡", side: "fae" },
    ]);

    expect(
      classifyBattlePopup(base, {
        ...base,
        calm: 65,
        energy: 5,
        poppedCount: 1,
        message: "Their favourite treat!",
        tick: 102,
      }),
    ).toEqual([
      { kind: "fav", text: "+45 ♥", side: "critter" },
      { kind: "pop", text: "POP!", side: "critter" },
      { kind: "energy", text: "+2 ⚡", side: "fae" },
    ]);
  });

  it("emits zero spurious popups on open, close, critter switch, rewind, or zero delta", () => {
    expect(classifyBattlePopup(null, base)).toEqual([]);
    expect(classifyBattlePopup(base, null)).toEqual([]);
    expect(classifyBattlePopup(base, { ...base, battleKey: "gull", calm: 80 })).toEqual([]);
    expect(classifyBattlePopup(base, { ...base, calm: 80, tick: 50 })).toEqual([]);
    expect(classifyBattlePopup(base, { ...base, tick: 101 })).toEqual([]);
    expect(classifyBattlePopup(base, { ...base, calm: 10, energy: 2, tick: 101 })).toEqual([]);
  });
});

describe("Milestone 104: Photo Mode Postcard Metadata", () => {
  it("formats clean slugged filenames, captions, and subcaptions across areas and lands", () => {
    expect(postcardMetadata("woods", "Whispering Woods", "Whispering Woods")).toEqual({
      filename: "cloverhollow-postcard-woods.png",
      caption: "Whispering Woods · Wilds of Cloverhollow",
      subcaption: "Whispering Woods",
    });

    expect(postcardMetadata("sue-cottage", "Sue's Beach Cottage", "Bubblegum Bay")).toEqual({
      filename: "cloverhollow-postcard-sue-cottage.png",
      caption: "Sue's Beach Cottage · Wilds of Cloverhollow",
      subcaption: "Bubblegum Bay",
    });

    expect(postcardMetadata("  Bay / Pier! ", "Bubblegum Bay", "  Bubblegum Bay  ")).toEqual({
      filename: "cloverhollow-postcard-bay-pier.png",
      caption: "Bubblegum Bay · Wilds of Cloverhollow",
      subcaption: "Bubblegum Bay",
    });

    expect(postcardMetadata("   ", "", "")).toEqual({
      filename: "cloverhollow-postcard-cloverhollow.png",
      caption: "Cloverhollow · Wilds of Cloverhollow",
      subcaption: "",
    });
  });
});

describe("Milestone 104: Lush Celebration Fanfares & Camera Shutter Audio", () => {
  it("synthesizes a 6-note storybook harp/celesta sticker flourish (~0.48s)", () => {
    const recipe = soundCueRecipe("sticker");
    expect(recipe).toHaveLength(6);
    const pitches = recipe
      .filter((segment) => segment.wave !== "noise")
      .map((segment) => segment.frequency);
    expect(pitches).toEqual([523.25, 659.25, 783.99, 987.77, 1046.5, 2093]);
    const span = recipeDuration(recipe);
    expect(span).toBeGreaterThanOrEqual(0.45);
    expect(span).toBeLessThanOrEqual(0.52);
  });

  it("synthesizes a 7-note RPG level-up arpeggio with bass root & shimmer (~0.55s)", () => {
    const recipe = soundCueRecipe("level-up");
    expect(recipe.length).toBeGreaterThanOrEqual(8);
    const pitches = recipe
      .filter((segment) => segment.wave !== "noise")
      .map((segment) => segment.frequency);
    expect(pitches).toEqual([261.63, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.51, 2093]);
    const span = recipeDuration(recipe);
    expect(span).toBeGreaterThanOrEqual(0.52);
    expect(span).toBeLessThanOrEqual(0.58);
  });

  it("synthesizes a crisp dual-transient camera-shutter click + soft lens whirr (~0.12s)", () => {
    const recipe = effectRecipe("camera-shutter");
    expect(recipe.length).toBeGreaterThanOrEqual(4);
    expect(recipe.filter((segment) => segment.wave === "noise").length).toBeGreaterThanOrEqual(3);
    const span = recipeDuration(recipe);
    expect(span).toBeGreaterThanOrEqual(0.1);
    expect(span).toBeLessThanOrEqual(0.14);
  });
});

describe("Milestone 104: Living Clubhouse 26-Item Museum Diorama Spacing", () => {
  const allPrizeIds = world.arcade.prizes.map((entry) => entry.id);

  it("keeps all 26 perches non-blocking and generously separated across every shelf & nook", () => {
    const full = stateIn(
      "clubhouse",
      { prizes: allPrizeIds, stickers: ["starry-owl", "taco-chef"] },
      {
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
      },
    );
    const display = evaluateClubhouseDisplay(world, full);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(13);

    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("Missing clubhouse area");
    const propSilhouettes = clubhouse.props.flatMap((prop) => {
      const propState = prop.states.there ?? prop.states.default;
      return propState === undefined ? [] : [propState];
    });

    for (const keepsake of display.keepsakes) {
      expect(
        pointInPolygon({ x: keepsake.x, y: keepsake.y }, clubhouse.walkable),
        `${keepsake.id} must stay strictly outside walkable floor`,
      ).toBe(false);
    }

    for (const prize of display.prizes) {
      const inWalkable = pointInPolygon({ x: prize.x, y: prize.y }, clubhouse.walkable);
      const onProp = propSilhouettes.some((propState) => {
        const inFootprint = propState.footprint.some((poly) =>
          pointInPolygon({ x: prize.x, y: prize.y }, poly),
        );
        const colIdx = Math.floor(
          (prize.x - propState.silhouette.left) / propState.silhouette.step,
        );
        const col = propState.silhouette.columns[colIdx];
        const inSil =
          col !== undefined && col.some(([top, bot]) => prize.y >= top && prize.y <= bot);
        return inFootprint || inSil;
      });
      const nearWall = distanceToPolygonEdges({ x: prize.x, y: prize.y }, clubhouse.walkable) <= 24;
      expect(!inWalkable || onProp || nearWall, `${prize.id} should not block walking floor`).toBe(
        true,
      );
    }

    const byId = new Map<string, { x: number; y: number }>([
      ...display.prizes.map((item): [string, { x: number; y: number }] => [
        item.id,
        { x: item.x, y: item.y },
      ]),
      ...display.keepsakes.map((item): [string, { x: number; y: number }] => [
        item.id,
        { x: item.x, y: item.y },
      ]),
    ]);
    const dist = (aId: string, bId: string): number => {
      const a = byId.get(aId);
      const b = byId.get(bId);
      if (a === undefined || b === undefined) throw new Error(`Missing perch ${aId} or ${bId}`);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    // Upper right shelf: zero blade/fin overlap.
    expect(dist("pinwheel", "bouncy-ball")).toBeGreaterThanOrEqual(40);
    expect(dist("bouncy-ball", "toy-rocket")).toBeGreaterThanOrEqual(40);

    // Beanbag 2x2 cuddle arc: rear pair clearly visible behind front pair.
    expect(dist("bunny-plush", "pup-plush")).toBeGreaterThanOrEqual(54);
    expect(dist("frog-plush", "cat-plush")).toBeGreaterThanOrEqual(75);
    expect(dist("bunny-plush", "frog-plush")).toBeGreaterThanOrEqual(52);
    expect(dist("pup-plush", "cat-plush")).toBeGreaterThanOrEqual(50);

    // Crate front keepsake row: zero rim-to-facet collision, >= 45 px clear of star-whistle.
    expect(dist("moon-feather", "star-crystal")).toBeGreaterThanOrEqual(38);
    expect(dist("star-crystal", "sea-compass")).toBeGreaterThanOrEqual(38);
    expect(dist("sea-compass", "star-whistle")).toBeGreaterThanOrEqual(45);

    // Lower right shelf: geode and mini arcade cabinet cleanly separated.
    expect(dist("star-geode", "star-racer-keychain")).toBeGreaterThanOrEqual(50);

    // Left floor: squirrel tail clear of owl.
    expect(dist("squirrel-plush", "owl-plush")).toBeGreaterThanOrEqual(50);

    // Preserved wall / sill anchors remain untouched.
    expect(byId.get("clover-wreath")).toEqual({ x: 468, y: 314 });
    expect(byId.get("alpine-clover")).toEqual({ x: 516, y: 308 });
    expect(byId.get("star-whistle")).toEqual({ x: 805, y: 259 });
  });
});
