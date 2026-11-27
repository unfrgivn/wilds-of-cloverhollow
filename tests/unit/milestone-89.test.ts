import { describe, expect, it } from "vitest";
import {
  createState,
  targetInteractable,
  type Direction,
  type Point,
  type Polygon,
  type State,
} from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { evaluateClubhouseDisplay } from "../../src/render/clubhouse-display";
import {
  findPettableCompanion,
  findRestSpot,
  PETTABLE_IDS,
  REST_SPOTS,
} from "../../src/render/companions";

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

describe("Milestone 89: Living Clubhouse display", () => {
  const allPrizeIds = world.arcade.prizes.map((entry) => entry.id);

  it("returns empty display lists outside clubhouse even with every prize and keepsake", () => {
    const plaza = stateIn(
      "plaza",
      { prizes: allPrizeIds, stickers: ["starry-owl", "taco-chef"] },
      { cavern_chime_rung: true, spice_returned: true, gem_reward_all: true },
    );
    expect(evaluateClubhouseDisplay(world, plaza)).toEqual({ prizes: [], keepsakes: [] });
  });

  it("maps all 13 catalogue prizes onto non-blocking Clubhouse perches", () => {
    const clubState = stateIn("clubhouse", { prizes: allPrizeIds });
    const display = evaluateClubhouseDisplay(world, clubState);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(0);

    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("Missing clubhouse area");
    const propSilhouettes = clubhouse.props.flatMap((prop) => {
      const propState = prop.states.there ?? prop.states.default;
      return propState === undefined ? [] : [propState];
    });

    const knownFrames = new Set(world.arcade.prizes.map((entry) => entry.frame));
    for (const prize of display.prizes) {
      expect(knownFrames.has(prize.frame), `${prize.id} frame`).toBe(true);
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
      expect(
        !inWalkable || onProp || nearWall,
        `${prize.id} at (${prize.x}, ${prize.y}) should not block open walking floor`,
      ).toBe(true);
    }
  });

  it("activates all 5 shimmering quest keepsakes when their story or sticker flags hold", () => {
    const empty = stateIn("clubhouse");
    expect(evaluateClubhouseDisplay(world, empty).keepsakes).toEqual([]);

    const full = stateIn(
      "clubhouse",
      { prizes: allPrizeIds, stickers: ["starry-owl", "taco-chef"] },
      { cavern_chime_rung: true, spice_returned: true, gem_reward_all: true },
    );
    const display = evaluateClubhouseDisplay(world, full);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes.map((item) => item.id)).toEqual([
      "star-crystal",
      "star-pin",
      "star-geode",
      "moon-feather",
      "taco-badge",
    ]);
    expect(display.keepsakes.map((item) => item.texture)).toEqual([
      "keepsakeCrystal",
      "keepsakePin",
      "keepsakeGeode",
      "keepsakeFeather",
      "keepsakeTaco",
    ]);
  });

  it("adds warm pollen sparkles over the Clubhouse planter deck when the garden blooms", () => {
    const plain = evaluateAtmosphere("clubhouse", 1200, 800, 120);
    const blooming = evaluateAtmosphere("clubhouse", 1200, 800, 120, { clubhouseBloom: true });
    expect(blooming.length).toBe(plain.length + 8);
    const added = blooming.slice(plain.length);
    for (const mote of added) {
      expect(mote.x).toBeGreaterThanOrEqual(720);
      expect(mote.x).toBeLessThanOrEqual(920);
      expect(mote.y).toBeGreaterThanOrEqual(560);
      expect(mote.y).toBeLessThanOrEqual(660);
    }
  });
});

describe("Milestone 89: Companion petting & cozy resting", () => {
  it("finds Maddie and Flute Friends in range, preferring the companion in front", () => {
    const base = stateIn("clubhouse");
    const player = { x: 640, y: 490 };
    const maddie = base.party[0];
    if (maddie === undefined) throw new Error("Missing party member");

    // Maddie in front (right, 65u away), pond-pup behind (left, 40u away): prefers Maddie.
    const state: State = {
      ...base,
      player,
      facing: "right",
      party: [
        { ...maddie, id: "maddie", x: 705, y: 490 },
        { ...maddie, id: "pond-pup", x: 600, y: 490 },
        { ...maddie, id: "sue", x: 660, y: 490 },
      ],
    };
    expect(findPettableCompanion(world, state)?.id).toBe("maddie");

    // Turn left: now pond-pup is in front!
    expect(findPettableCompanion(world, { ...state, facing: "left" })?.id).toBe("pond-pup");

    // Non-pettable human party members are ignored even at 10u.
    const humansOnly: State = {
      ...base,
      player,
      facing: "right",
      party: [
        { ...maddie, id: "sue", x: 650, y: 490 },
        { ...maddie, id: "jordan", x: 630, y: 490 },
      ],
    };
    expect(findPettableCompanion(world, humansOnly)).toBeNull();

    // All 4 pettable IDs are accepted.
    for (const id of PETTABLE_IDS) {
      const single: State = {
        ...base,
        player,
        facing: "up",
        party: [{ ...maddie, id, x: 640, y: 450 }],
      };
      expect(findPettableCompanion(world, single)?.id).toBe(id);
    }
  });

  it("yields to real interactables and active overlays", () => {
    const base = stateIn("clubhouse");
    const maddie = base.party[0];
    if (maddie === undefined) throw new Error("Missing maddie");

    // Facing club-fridge (585, 390) from (585, 425): targetInteractable wins!
    const atFridge: State = {
      ...base,
      player: { x: 585, y: 425 },
      facing: "up",
      party: [{ ...maddie, x: 585, y: 410 }],
    };
    expect(targetInteractable(world, atFridge)?.id).toBe("club-fridge");
    expect(findPettableCompanion(world, atFridge)).toBeNull();

    // Open journal or dialogue suppresses petting.
    const free: State = {
      ...base,
      player: { x: 640, y: 490 },
      facing: "left",
      party: [{ ...maddie, x: 605, y: 490 }],
    };
    expect(findPettableCompanion(world, free)?.id).toBe("maddie");
    expect(findPettableCompanion(world, { ...free, journalOpen: true })).toBeNull();
    expect(
      findPettableCompanion(world, {
        ...free,
        dialogue: {
          knot: "test",
          speaker: "Maddie",
          text: "Meow!",
          revealed: 5,
          choices: [],
          selected: 0,
          ended: false,
        },
      }),
    ).toBeNull();
  });

  it("resolves curated rest spots across all 6 areas and yields to interactables and pets", () => {
    const areaDirections: Record<string, Direction> = {
      plaza: "down",
      park: "down",
      bay: "down",
      cafe: "right",
      lodge: "down",
      clubhouse: "right",
    };

    for (const spot of REST_SPOTS) {
      const base = stateIn(spot.area);
      const facing = areaDirections[spot.area] ?? "down";
      const clearState: State = {
        ...base,
        player: { x: spot.x, y: spot.y },
        facing,
        party: [],
      };
      expect(targetInteractable(world, clearState), `${spot.id} interactable`).toBeUndefined();
      expect(findRestSpot(world, clearState)?.id, spot.id).toBe(spot.id);
    }

    // In park at (740, 480) facing up targets tree-house -> findRestSpot yields.
    const parkBase = stateIn("park");
    const facingTreeHouse: State = {
      ...parkBase,
      player: { x: 740, y: 480 },
      facing: "up",
      party: [],
    };
    expect(targetInteractable(world, facingTreeHouse)?.id).toBe("tree-house");
    expect(findRestSpot(world, facingTreeHouse)).toBeNull();

    // In clubhouse right at beanbag (790, 470) with Maddie at heel (738, 470) behind Fae:
    // Fae can still sit on the beanbag!
    const clubBase = stateIn("clubhouse");
    const maddie = clubBase.party[0];
    if (maddie === undefined) throw new Error("Missing maddie");
    const atBeanbag: State = {
      ...clubBase,
      player: { x: 790, y: 470 },
      facing: "right",
      party: [{ ...maddie, id: "maddie", x: 738, y: 470 }],
    };
    expect(findRestSpot(world, atBeanbag)?.id).toBe("clubhouse-beanbag");

    // Turn around to face Maddie right in front: petting Maddie takes priority over resting!
    const facingMaddie: State = { ...atBeanbag, facing: "left" };
    expect(findRestSpot(world, facingMaddie)).toBeNull();
    expect(findPettableCompanion(world, facingMaddie)?.id).toBe("maddie");
  });

  it("QA console keepsakes command toggles the closed keepsake story variables", () => {
    const context: ConsoleContext = {
      story: world.story,
      stickerIds: world.stickers.catalogue.map((sticker) => sticker.id),
      prizeIds: world.arcade.prizes.map((prize) => prize.id),
      treatIds: world.treats.map((treat) => treat.id),
      thresholds: world.levels.thresholds,
    };
    const start = stateIn("clubhouse");
    const on = runConsoleCommand(context, start, "keepsakes on");
    expect(on.kind).toBe("applied");
    if (on.kind !== "applied") return;
    expect(world.storyVariable(on.state.ink, "cavern_chime_rung")).toBe(true);
    expect(world.storyVariable(on.state.ink, "spice_returned")).toBe(true);
    expect(world.storyVariable(on.state.ink, "gem_reward_all")).toBe(true);
    expect(evaluateClubhouseDisplay(world, on.state).keepsakes).toHaveLength(3);

    const off = runConsoleCommand(context, on.state, "keepsakes off");
    expect(off.kind).toBe("applied");
    if (off.kind !== "applied") return;
    expect(evaluateClubhouseDisplay(world, off.state).keepsakes).toHaveLength(0);
    expect(runConsoleCommand(context, start, "keepsakes maybe").kind).toBe("error");
  });
});
