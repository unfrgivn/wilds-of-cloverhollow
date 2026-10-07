import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  partySlots,
  pointInPolygon,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Point,
  type State,
} from "../../src/core";
import { hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

// Contract for the Cliffside Trail, the first trail between lands, walked
// EarthBound style. It climbs from Bubblegum Bay (the beach at its bottom
// right) up to Pinecone Pass (the snowy path at its top left). A bunny and a
// squirrel roam its two meadows and come after Fae. From the bay the path
// opens once Fae has ridden the bus up the mountain (`rode_bus`); from the
// pass it's always open. Arriving through a way in, Fae can keep holding the
// direction she was walking without being sent straight back.

const content = loadContent();
const world = content.world;
const radius = world.tunables.playerRadius;
const range = world.tunables.interact.range;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const moves: Record<State["facing"], Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const trail = areaFor("trail");
const bay = areaFor("bay");
const pass = areaFor("pass");

function standable(area: Area, point: Point): boolean {
  if (!pointInPolygon(point, area.walkable)) return false;
  if (distanceToPolygon(point, area.walkable) < radius) return false;
  const solid = [...area.blockers, ...area.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

function triggerOf(area: Area, id: string): Area["triggers"][number] {
  const found = area.triggers.find((item) => item.id === id);
  if (found === undefined) throw new Error(`${area.id} has no trigger ${id}`);
  return found;
}

function bounds(polygon: [number, number][]): { x0: number; x1: number; y0: number; y1: number } {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function middle(polygon: [number, number][]): Point {
  const box = bounds(polygon);
  return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
}

// Some standable point inside a trigger, on a 5-unit grid.
function reachable(area: Area, polygon: [number, number][]): boolean {
  const box = bounds(polygon);
  for (let y = box.y0; y <= box.y1; y += 5)
    for (let x = box.x0; x <= box.x1; x += 5)
      if (pointInPolygon({ x, y }, polygon) && standable(area, { x, y })) return true;
  return false;
}

function at(area: string, feet: Point, facing: State["facing"], ink?: State["ink"]): State {
  const start = createState(world, { area, spawn: Object.keys(areaFor(area).spawns)[0] ?? "" });
  return { ...start, player: feet, facing, ...(ink === undefined ? {} : { ink }) };
}

// Holds a direction for some ticks.
function hold(state: State, facing: State["facing"], ticks: number): State {
  for (let tick = 0; tick < ticks; tick += 1)
    state = step(world, state, press({ move: moves[facing] })).state;
  return state;
}

// Walks through a way in holding `facing`, and keeps holding it for `after`
// ticks once Fae has arrived (the fade done).
function through(state: State, facing: State["facing"], after: number): State {
  const from = state.area;
  for (let tick = 0; tick < 600; tick += 1) {
    state = step(world, state, press({ move: moves[facing] })).state;
    if (state.area !== from && state.transition === null) return hold(state, facing, after);
  }
  throw new Error(`Fae never got out of ${from} going ${facing}`);
}

// The story after the first bus ride up the mountain (Milestone 20).
function riddenInk(): State["ink"] {
  const start = createState(world, { area: "plaza", spawn: "bus-stop" });
  const critters: State["critters"] = { ...start.critters, frog: "calm", pup: "calm",
    bluebird: "calm" };
  let state: State = { ...start, player: { x: 878, y: 985 }, facing: "up", critters };
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  for (let tick = 0; tick < 600 && state.dialogue !== null; tick += 1) {
    const dialogue = state.dialogue;
    const frame = dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length
      ? press({ choose: 0 })
      : press({ confirm: tick % 2 === 1 });
    state = step(world, state, frame).state;
  }
  if (world.storyVariable(state.ink, "rode_bus") !== true) throw new Error("no bus ride");
  return state.ink;
}

describe("the trail follows its painting", () => {
  it("is a 1750 x 1100 painted area called Cliffside Trail", () => {
    const { id, name, width, height, ground } = trail;
    expect({ id, name, width, height, ground })
      .toEqual({ id: "trail", name: "Cliffside Trail", width: 1750, height: 1100,
        ground: "trail" });
  });

  // Points read off the painting (units; 2 px each).
  const floor: [string, Point][] = [
    ["the snowy path at the top left", { x: 400, y: 205 }],
    ["the path along the top", { x: 700, y: 140 }],
    ["the path's east bend", { x: 1000, y: 330 }],
    ["the path through the middle", { x: 500, y: 500 }],
    ["the path's west bend", { x: 300, y: 700 }],
    ["the path along the bottom", { x: 700, y: 950 }],
    ["the beach", { x: 1300, y: 850 }],
    ["the upper meadow", { x: 650, y: 280 }],
    ["the lower meadow", { x: 650, y: 760 }],
    ["the middle of the bridge", { x: 1265, y: 560 }],
    ["the lookout, in front of the bench", { x: 1530, y: 500 }],
  ];
  for (const [what, point] of floor)
    it(`lets Fae stand on ${what}`, () => expect(standable(trail, point)).toBe(true));

  const off: [string, Point][] = [
    ["the sea at the top right", { x: 1400, y: 200 }],
    ["the sea at the bottom right", { x: 1700, y: 1060 }],
    ["the stream above the bridge", { x: 1230, y: 450 }],
    ["the stream below the bridge", { x: 1450, y: 630 }],
    ["the cliff below the lookout", { x: 1645, y: 560 }],
    ["the snowy pines at the top left", { x: 150, y: 60 }],
  ];
  for (const [what, point] of off)
    it(`keeps Fae out of ${what}`, () => expect(pointInPolygon(point, trail.walkable)).toBe(false));

  it("never lets an occluder hide most of Fae", () => {
    expect(hiddenPositions(trail, radius)).toEqual([]);
  }, 60_000);
});

describe("the ways in and out", () => {
  // [area, trigger, its target, the arrival spawn's facing, where the trigger lies]
  const links: [Area, string, { area: string; spawn: string }, State["facing"], string][] = [
    [bay, "trail", { area: "trail", spawn: "bay" }, "up", "bottom"],
    [trail, "bay", { area: "bay", spawn: "trail" }, "up", "bottom"],
    [pass, "trail", { area: "trail", spawn: "pass" }, "right", "right"],
    [trail, "pass", { area: "pass", spawn: "trail" }, "left", "left"],
  ];
  for (const [area, id, target, facing, edge] of links)
    it(`${area.id}'s way to ${target.area} is at its ${edge} edge, reachable, and lands well`,
      () => {
        const way = triggerOf(area, id);
        expect(way.target).toEqual(target);
        const box = bounds(way.polygon);
        // A thin strip on the floor's outer edge: nowhere to stand beyond it.
        const depth = edge === "bottom" ? box.y1 - box.y0 : box.x1 - box.x0;
        expect(depth, "a thin strip").toBeLessThanOrEqual(edge === "bottom" ? 40 : 60);
        const beyond: Point[] = [];
        if (edge === "bottom")
          for (let y = box.y1 + 5; y <= area.height; y += 5)
            for (let x = box.x0; x <= box.x1; x += 5) beyond.push({ x, y });
        else
          for (let y = box.y0; y <= box.y1; y += 5)
            for (let x = edge === "right" ? box.x1 + 5 : 0;
              x <= (edge === "right" ? area.width : box.x0 - 5); x += 5) beyond.push({ x, y });
        expect(beyond.filter((point) => standable(area, point)), "the floor's edge").toEqual([]);
        expect(reachable(area, way.polygon), "Fae can step into it").toBe(true);
        const destination = areaFor(target.area);
        const arrival = destination.spawns[target.spawn];
        if (arrival === undefined) throw new Error(`no spawn ${target.spawn}`);
        expect(arrival.facing).toBe(facing);
        expect(standable(destination, arrival), "the arrival is standable").toBe(true);
        const roster = Object.values(world.party);
        const slots = partySlots(destination, arrival, world.tunables.follow, roster);
        expect(slots.every((slot) => slot.slot !== undefined), "the party fits").toBe(true);
      });

  it("puts the trail's snowy end at the left edge and its beach end at the bottom", () => {
    const fromPass = trail.spawns["pass"];
    const fromBay = trail.spawns["bay"];
    if (fromPass === undefined || fromBay === undefined) throw new Error("trail spawns missing");
    expect(fromPass.x).toBeLessThanOrEqual(150);
    expect(fromPass.y).toBeGreaterThanOrEqual(175);
    expect(fromPass.y).toBeLessThanOrEqual(215);
    expect(fromBay.x).toBeGreaterThanOrEqual(1180);
    expect(fromBay.x).toBeLessThanOrEqual(1480);
    expect(fromBay.y).toBeGreaterThanOrEqual(950);
    expect(triggerOf(pass, "trail").requires).toBeUndefined();
    expect(triggerOf(trail, "bay").requires).toBeUndefined();
    expect(triggerOf(trail, "pass").requires).toBeUndefined();
  });

  it("keeps the cliff path closed from the bay before the bus ride", () => {
    const way = triggerOf(bay, "trail");
    expect(way.requires).toEqual({ variable: "rode_bus", knot: "bay_cliff_path" });
    const centre = middle(way.polygon);
    const start = { x: centre.x, y: centre.y - 70 };
    expect(standable(bay, start)).toBe(true);
    let state = at("bay", start, "down");
    for (let tick = 0; tick < 60 && state.dialogue === null; tick += 1)
      state = step(world, state, press({ move: moves.down })).state;
    expect(state.dialogue?.knot).toBe("bay_cliff_path");
    expect(state.transition).toBeNull();
    expect(state.area).toBe("bay");
  });

  it("opens from the bay after the bus ride, and holding down doesn't bounce Fae back", () => {
    const centre = middle(triggerOf(bay, "trail").polygon);
    let state = at("bay", { x: centre.x, y: centre.y - 70 }, "down", riddenInk());
    state = through(state, "down", 90);
    expect({ area: state.area, transition: state.transition })
      .toEqual({ area: "trail", transition: null });
    // Let go, step back up, and walk down into the beach's way out: the bay.
    state = step(world, state, blankInput()).state;
    state = hold(state, "up", 25);
    state = through(state, "down", 90);
    expect({ area: state.area, transition: state.transition })
      .toEqual({ area: "bay", transition: null });
  });

  it("joins the pass's east edge and the trail's snowy path, both ways", () => {
    const centre = middle(triggerOf(pass, "trail").polygon);
    const start = { x: centre.x - 70, y: centre.y };
    expect(standable(pass, start)).toBe(true);
    let state = at("pass", start, "right");
    state = through(state, "right", 45);
    expect({ area: state.area, transition: state.transition })
      .toEqual({ area: "trail", transition: null });
    state = step(world, state, blankInput()).state;
    state = through(state, "left", 90);
    expect({ area: state.area, transition: state.transition })
      .toEqual({ area: "pass", transition: null });
  });
});

describe("the trail's roaming critters", () => {
  const meadows: [string, string, Point][] = [
    ["bunny", "the upper meadow", { x: 650, y: 280 }],
    ["squirrel", "the lower meadow", { x: 650, y: 760 }],
  ];
  for (const [id, where, centre] of meadows) {
    it(`has the ${id} roaming ${where}`, () => {
      const critter = world.critters[id];
      if (critter === undefined) throw new Error(`no ${id}`);
      expect(critter.atlas).toBe(`assets/critters/${id}/${id}.json`);
      expect(critter.calmKnot).toBe(`${id}_calm`);
      expect(Object.keys(critter.commands.friends)).toEqual(["play", "cast"]);
      const placed = trail.critters.find((item) => item.id === id);
      if (placed === undefined) throw new Error(`the ${id} isn't on the trail`);
      const roam = placed.roam?.radius ?? 0;
      expect(roam).toBeGreaterThanOrEqual(80);
      expect(roam).toBeLessThanOrEqual(150);
      const fromCentre = Math.hypot(placed.point.x - centre.x, placed.point.y - centre.y);
      expect(fromCentre).toBeLessThanOrEqual(150);
      expect(standable(trail, placed.point)).toBe(true);
      expect(world.stickers.catalogue.some((sticker) =>
        sticker.id === critter.sticker.id && sticker.critter === id)).toBe(true);
      const fixture = content.fixtures["new-game"];
      if (fixture === undefined) throw new Error("new-game fixture missing");
      expect(createState(world, fixture).critters[id]).toBe("chaos");
    });

    it(`lets Fae talk to the ${id} once it's calm`, () => {
      const placed = trail.critters.find((item) => item.id === id);
      if (placed === undefined) throw new Error(`the ${id} isn't on the trail`);
      const start = createState(world, { area: "trail", spawn: "pass" });
      const critters: State["critters"] = { ...start.critters, [id]: "calm" };
      let state: State = { ...start, critters, facing: "up",
        player: { x: placed.point.x, y: placed.point.y + 45 } };
      expect(targetInteractable(world, state)?.id).toBe(`critter:${id}`);
      state = step(world, state, blankInput()).state;
      state = step(world, state, press({ confirm: true })).state;
      expect(state.dialogue?.knot).toBe(`${id}_calm`);
    });
  }

  it("writes a journal note once both are calm", () => {
    const start = createState(world, { area: "trail", spawn: "pass" });
    const critters: State["critters"] = { ...start.critters, bunny: "calm", squirrel: "calm" };
    expect(journalNotes(world, { ...start, critters })[0]).toMatch(/Cliffside Trail/);
  });
});

describe("things to look at on the trail", () => {
  const looks: [string, string][] = [
    ["trail-signpost", "trail_signpost"],
    ["lookout-bench", "lookout_bench"],
  ];
  for (const [id, knot] of looks)
    it(`has the ${id} to look at, within reach`, () => {
      const thing = trail.interactables.find((item) => item.id === id);
      if (thing === undefined) throw new Error(`no ${id}`);
      expect({ knot: thing.knot, prompt: thing.prompt }).toEqual({ knot, prompt: "Look" });
      const around: [number, number, State["facing"]][] =
        [[0, 45, "up"], [45, 0, "left"], [-45, 0, "right"], [0, -45, "down"]];
      const spot = around.find(([dx, dy]) =>
        standable(trail, { x: thing.point.x + dx, y: thing.point.y + dy }) &&
        Math.hypot(dx, dy) <= range);
      if (spot === undefined) throw new Error(`nowhere to stand to look at ${id}`);
      const [dx, dy, facing] = spot;
      const state = at("trail", { x: thing.point.x + dx, y: thing.point.y + dy }, facing);
      expect(targetInteractable(world, state)?.id).toBe(id);
    });
});
