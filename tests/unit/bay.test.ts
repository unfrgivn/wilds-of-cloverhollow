import { describe, expect, it } from "vitest";
import {
  blankInput,
  createInkState,
  createState,
  distanceToPolygon,
  journalNotes,
  pointInPolygon,
  runInk,
  step,
  type ActionFrame,
  type Area,
  type Grade,
  type InkCommand,
  type Point,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 19 (Bubblegum Bay). The plaza's east road opens once
// the tree house club is open, and leads to the bay: a sandy cove with a dock,
// where Sue is fishing at the far end. Whatever Fae says, Sue joins. A fizzy
// bluebird is loose on the beach.

const content = loadContent();
const world = content.world;
const radius = world.tunables.playerRadius;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

// Where Fae's feet can stand: on the floor with her radius clear of its edge,
// of every blocker, and of every person.
function standable(area: Area, point: Point): boolean {
  if (!pointInPolygon(point, area.walkable)) return false;
  if (distanceToPolygon(point, area.walkable) < radius) return false;
  return (
    area.blockers.every(
      (blocker) => !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius,
    ) && area.npcs.every((npc) => !pointInPolygon(point, npc.footprint))
  );
}

function blocked(area: Area, point: Point): boolean {
  return area.blockers.some((blocker) => pointInPolygon(point, blocker));
}

// Plays a knot from its start to its end, taking `choices` in order (then 0).
function play(ink: string, knot: string, choices: number[] = []): string {
  const queue = [...choices];
  let result = runInk(world.story, ink, { type: "start", knot });
  for (let count = 0; count < 60 && !result.ended; count += 1)
    result = result.choices.length > 0
      ? runInk(world.story, result.ink, { type: "choose", index: queue.shift() ?? 0 })
      : runInk(world.story, result.ink, { type: "next" });
  if (!result.ended) throw new Error(`${knot} never ended`);
  return result.ink;
}

// Every way through a knot: the end states of all choice paths.
function endings(ink: string, knot: string): string[] {
  const found: string[] = [];
  const walk = (result: ReturnType<typeof runInk>, depth: number): void => {
    if (depth > 60) throw new Error(`${knot} is too deep`);
    if (result.ended) {
      found.push(result.ink);
      return;
    }
    if (result.choices.length === 0) {
      walk(runInk(world.story, result.ink, { type: "next" }), depth + 1);
      return;
    }
    result.choices.forEach((_, index) =>
      walk(runInk(world.story, result.ink, { type: "choose", index }), depth + 1),
    );
  };
  walk(runInk(world.story, ink, { type: "start", knot }), 0);
  return found;
}

const fresh = createInkState(world.story, 1);
const clubOpen = play(play(fresh, "raccoon", [0]), "tree_house");

describe("the bay's geometry follows its painting", () => {
  const bay = areaFor("bay");

  it("is a 1750 x 1100 painted area called Bubblegum Bay", () => {
    expect({ id: bay.id, name: bay.name, width: bay.width, height: bay.height, ground: bay.ground })
      .toEqual({ id: "bay", name: "Bubblegum Bay", width: 1750, height: 1100, ground: "bay" });
  });

  // Points read off the painting (units; 2 source px each), by colour.
  const sand: [string, Point][] = [
    ["the entry path at the left edge", { x: 90, y: 545 }],
    ["the path", { x: 300, y: 555 }],
    ["the sand below the picnic", { x: 620, y: 530 }],
    ["the sand in the path's dip", { x: 520, y: 760 }],
    ["the open beach, bottom middle", { x: 700, y: 950 }],
    ["the open beach, right", { x: 1100, y: 820 }],
    ["the sand right of the bucket", { x: 1250, y: 700 }],
    ["the dock's near end", { x: 900, y: 560 }],
    ["the middle of the dock", { x: 1150, y: 380 }],
    ["the dock's far end", { x: 1430, y: 235 }],
  ];
  for (const [what, point] of sand)
    it(`lets Fae stand on ${what}`, () => expect(standable(bay, point)).toBe(true));

  const water: [string, Point][] = [
    ["the bay above the beach", { x: 900, y: 150 }],
    ["the water south of the dock", { x: 1450, y: 450 }],
    ["the shallows beside the dock's foot", { x: 980, y: 300 }],
    ["the water under the dock's south rail", { x: 1300, y: 520 }],
    ["the rocks along the top", { x: 300, y: 20 }],
    ["the rocks at the right", { x: 1700, y: 600 }],
  ];
  for (const [what, point] of water)
    it(`keeps Fae out of ${what}`, () => expect(pointInPolygon(point, bay.walkable)).toBe(false));

  const things: [string, Point][] = [
    ["the picnic blanket", { x: 590, y: 405 }],
    ["the sign's left post", { x: 143, y: 452 }],
    ["the sign's right post", { x: 259, y: 472 }],
    ["the driftwood log at the bottom left", { x: 330, y: 1010 }],
    ["the driftwood log at the bottom right", { x: 1380, y: 1030 }],
    ["the bucket", { x: 1093, y: 690 }],
  ];
  for (const [what, point] of things)
    it(`makes ${what} solid`, () => expect(blocked(bay, point)).toBe(true));

  it("keeps the palm's trunk at the top left solid", () => {
    expect(standable(bay, { x: 40, y: 420 })).toBe(false);
  });
});

describe("the east road", () => {
  const plaza = areaFor("plaza");
  const bay = areaFor("bay");

  it("joins the plaza's east road and the bay's entry path both ways", () => {
    expect(plaza.triggers.find((trigger) => trigger.id === "bay-road")).toMatchObject({
      target: { area: "bay", spawn: "plaza-road" },
      requires: { variable: "club_open", knot: "bay_road_closed" },
    });
    expect(plaza.spawns["bay-road"]?.facing).toBe("left");
    expect(bay.triggers.find((trigger) => trigger.id === "plaza-road")).toMatchObject({
      target: { area: "plaza", spawn: "bay-road" },
    });
    const arrival = bay.spawns["plaza-road"];
    if (arrival === undefined) throw new Error("no plaza-road spawn in the bay");
    expect(arrival.facing).toBe("right");
    expect(arrival.x).toBeLessThan(200);
    expect(arrival.y).toBeGreaterThan(480);
    expect(arrival.y).toBeLessThan(610);
  });

  function walkEast(ink: string): State {
    const start = createState(world, { area: "plaza", spawn: "bay-road", seed: 1 });
    let state: State = { ...start, ink };
    for (let tick = 0; tick < 300; tick += 1) {
      if (state.dialogue !== null || state.area !== "plaza") break;
      state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    }
    for (let tick = 0; tick < 120 && state.transition !== null; tick += 1)
      state = step(world, state, blankInput()).state;
    return state;
  }

  it("stays closed until the club is open", () => {
    const state = walkEast(fresh);
    expect(state.area).toBe("plaza");
    expect(state.dialogue?.knot).toBe("bay_road_closed");
  });

  it("leads to the bay once the club is open", () => {
    expect(world.storyVariable(clubOpen, "club_open")).toBe(true);
    const state = walkEast(clubOpen);
    expect(state.area).toBe("bay");
    const arrival = bay.spawns["plaza-road"];
    expect(state.player).toEqual({ x: arrival?.x, y: arrival?.y });
    expect(state.party.map((member) => member.id)).toEqual(["maddie"]);
  });
});

describe("Sue at the end of the dock", () => {
  const bay = areaFor("bay");

  it("stands fishing at the dock's far end", () => {
    const sue = bay.npcs.find((npc) => npc.id === "sue");
    if (sue === undefined) throw new Error("Sue isn't in the bay");
    expect({ knot: sue.knot, prompt: sue.prompt }).toEqual({ knot: "sue", prompt: "Talk" });
    expect(sue.visibleWhile).toBeUndefined();
    // Past x 1300 and above y 330 the only floor is the dock's far end.
    expect(sue.point.x).toBeGreaterThanOrEqual(1300);
    expect(sue.point.y).toBeLessThanOrEqual(330);
    expect(pointInPolygon(sue.point, bay.walkable)).toBe(true);
    expect(pointInPolygon(sue.point, sue.footprint)).toBe(true);
    // Fae can stand close enough to talk to her.
    const reach = world.tunables.interact.range - 5;
    const spots: Point[] = [];
    for (let dx = -reach; dx <= reach; dx += 5)
      for (let dy = -reach; dy <= reach; dy += 5)
        if (Math.hypot(dx, dy) <= reach) spots.push({ x: sue.point.x + dx, y: sue.point.y + dy });
    expect(spots.some((spot) => standable(bay, spot))).toBe(true);
  });

  it("joins whatever Fae says", () => {
    for (const start of [fresh, clubOpen]) {
      const ends = endings(start, "sue");
      expect(ends.length).toBeGreaterThanOrEqual(1);
      for (const ink of ends) expect(world.storyVariable(ink, "sue_joined")).toBe(true);
    }
  });
});

describe("the fizzy bluebird", () => {
  const bay = areaFor("bay");

  it("is a generic critter on the bay's sand", () => {
    const critter = world.critters["bluebird"];
    if (critter === undefined) throw new Error("no bluebird");
    expect(critter.atlas).toBe("assets/critters/bluebird/bluebird.json");
    expect(critter.auraCentre).toEqual({ x: 172, y: 189 });
    expect(critter.bodyCentre).toEqual({ x: 239, y: 316 });
    const placed = bay.critters.find((item) => item.id === "bluebird");
    if (placed === undefined) throw new Error("the bluebird isn't in the bay");
    expect(standable(bay, placed.point)).toBe(true);
    expect(placed.point.y).toBeGreaterThan(600);
    expect(world.stickers.catalogue.some((sticker) =>
      sticker.id === critter.sticker.id && sticker.critter === "bluebird")).toBe(true);
    const start: InkCommand = { type: "start", knot: critter.calmKnot };
    const calm = runInk(world.story, fresh, start, { bluebird: true });
    expect(calm.line?.text.length ?? 0).toBeGreaterThan(0);
    const grades: Grade[] = ["great", "good", "miss"];
    for (const grade of grades)
      expect(critter.lines.friends["play"]?.[grade]).toMatch(/Maddie/);
  });

  it("starts in chaos in a new game", () => {
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("new-game fixture missing");
    const state = createState(world, fixture);
    expect(state.critters["bluebird"]).toBe("chaos");
  });
});

describe("the journal", () => {
  function notes(ink: string): string[] {
    const state = createState(world, { area: "plaza", spawn: "fountain", seed: 1 });
    const critters: State["critters"] = { frog: "calm", pup: "calm", bluebird: "chaos" };
    return journalNotes(world, { ...state, ink, critters });
  }

  it("points to Bubblegum Bay once the club is open, and remembers Sue once she joins", () => {
    expect(notes(fresh).join(" ")).not.toMatch(/Bubblegum Bay/);
    // Chapter one ends on the hood's name tag (chapter-one.test.ts pins it as
    // the newest note); the way to the bay comes right after it.
    expect(notes(clubOpen).slice(0, 2).join(" ")).toMatch(/Bubblegum Bay/);
    const joined = play(clubOpen, "sue");
    expect(notes(joined)[0]).toMatch(/Sue/);
  });
});
