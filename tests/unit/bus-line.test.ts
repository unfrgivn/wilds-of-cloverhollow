import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  pointInPolygon,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Point,
  type State,
  everyPropFootprint,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { readStorySources } from "../../tools/ink/compile";

// Contract for Milestone 24 (the bus line and the map), updated for discover-on-foot
// travel. The bus stops in all three towns: Cloverhollow's plaza, Bubblegum Bay
// (by the welcome sign), and Pinecone Pass. From any stop it goes to any other
// town Fae has already reached on foot (`visited_bay` / `sue_joined` for the bay,
// `visited_pass` / `rode_bus` for the pass), and always home to Cloverhollow.

const content = loadContent();
const world = content.world;
const radius = world.tunables.playerRadius;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

function standable(area: Area, point: Point): boolean {
  if (!pointInPolygon(point, area.walkable)) return false;
  if (distanceToPolygon(point, area.walkable) < radius) return false;
  const solid = [...area.blockers, ...everyPropFootprint(area),
    ...area.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

// Fae in front of an area's bus stop, facing it, with optional Ink variables.
function atStop(
  area: string,
  stickers: string[],
  options?: { ink?: State["ink"]; variables?: Record<string, boolean> },
): State {
  const spawn = areaFor(area).spawns[area === "pass" ? "bus" : "bus-stop"];
  if (spawn === undefined) throw new Error(`no bus spawn in ${area}`);
  const start = createState(world, {
    area,
    spawn: area === "pass" ? "bus" : "bus-stop",
    ...(options?.variables === undefined ? {} : { variables: options.variables }),
  });
  const feet = area === "pass" ? { x: 1017, y: 975 } : { x: spawn.x, y: spawn.y };
  return {
    ...start,
    player: feet,
    facing: "up",
    stickers,
    ...(options?.ink === undefined ? {} : { ink: options.ink }),
  };
}

// Talks to what Fae faces; at the first choice records the choices offered and
// takes `choice`. Returns the choices and the state at the talk's close.
function ride(state: State, choice: number): { choices: string[]; state: State } {
  let choices: string[] = [];
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  if (state.dialogue === null) throw new Error("the talk did not open");
  for (let tick = 0; tick < 900 && state.dialogue !== null; tick += 1) {
    const dialogue = state.dialogue;
    if (dialogue.choices.length > 0 && choices.length === 0) choices = [...dialogue.choices];
    const frame = dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length
      ? press({ choose: choice })
      : press({ confirm: tick % 2 === 1 });
    state = step(world, state, frame).state;
  }
  if (state.dialogue !== null) throw new Error("the talk never closed");
  return { choices, state };
}

const calm = ["fountain-frog", "pond-pup", "bay-bluebird"];
const bluebirdFizzy = ["fountain-frog", "pond-pup"];

describe("the lands", () => {
  it("are the seven lands of the painted map, in order", () => {
    expect(world.lands.map((land) => land.id))
      .toEqual(["cloverhollow", "bay", "pass", "trail", "forest", "enchanted", "hills"]);
    expect(world.lands.map((land) => land.name)).toEqual([
      "Cloverhollow", "Bubblegum Bay", "Pinecone Pass", "Cliffside Trail", "The Forest",
      "The Enchanted Forest", "Clover Hills",
    ]);
  });

  it("put every area in a land, except the test harness", () => {
    const lands: Record<string, string> = {
      bedroom: "cloverhollow", kitchen: "cloverhollow", cafe: "cloverhollow",
      market: "cloverhollow", parlor: "cloverhollow",
      arcade: "cloverhollow", classroom: "cloverhollow",
      "east-hall": "cloverhollow", "art-room": "cloverhollow", music: "cloverhollow",
      gym: "cloverhollow", field: "cloverhollow", clubhouse: "forest", lodge: "pass",
      plaza: "cloverhollow", park: "cloverhollow", school: "cloverhollow", woods: "forest",
      lane: "cloverhollow", crossing: "hills", boardwalk: "trail",
      "milo-house": "cloverhollow", "rosie-cottage": "cloverhollow",
      bay: "bay", island: "bay", "sue-cottage": "bay", pass: "pass", summit: "pass",
      "jordan-cabin": "pass",
      cavern: "pass", trail: "trail", mist: "enchanted",
      enchanted: "enchanted", hills: "hills", sanctuary: "hills",
    };
    for (const area of Object.values(world.areas)) {
      if (area.id === "harness") {
        expect(area.land, area.id).toBeUndefined();
        continue;
      }
      // An area missing from this table fails here, so a new area can't slip
      // through without a land (undefined would otherwise equal undefined).
      expect(lands[area.id], `${area.id} is missing from this table`).toBeDefined();
      expect(area.land, area.id).toBe(lands[area.id]);
    }
  });

  it("each have a centre on the painted map", () => {
    const value: unknown = JSON.parse(readFileSync("public/assets/ui/map/world-map.json", "utf8"));
    if (typeof value !== "object" || value === null || !("lands" in value) ||
      !Array.isArray(value.lands)) throw new Error("world-map.json has no lands");
    const centres: unknown[] = value.lands;
    for (const land of world.lands)
      expect(centres.some((centre) => typeof centre === "object" && centre !== null &&
        "id" in centre && centre.id === land.id), land.id).toBe(true);
  });
});

describe("the bus line", () => {
  const bay = areaFor("bay");

  it("stops in Bubblegum Bay by the welcome sign, where the road from town comes in", () => {
    const stop = bay.npcs.find((npc) => npc.id === "bus-stop");
    if (stop === undefined) throw new Error("no bus stop in the bay");
    expect({ knot: stop.knot, prompt: stop.prompt, facing: stop.facing })
      .toEqual({ knot: "bay_bus_stop", prompt: "Look", facing: "down" });
    expect(stop.point).toEqual({ x: 355, y: 505 });
    expect(stop.footprint).toEqual([[303, 463], [407, 463], [407, 485], [303, 485]]);
    expect(bay.spawns["bus-stop"]).toEqual({ x: 355, y: 545, facing: "down" });
    expect(standable(bay, { x: 355, y: 545 })).toBe(true);
    expect(stop.visibleWhile).toBeUndefined();
  });

  it("goes from the plaza only to towns discovered on foot", () => {
    const before = ride(atStop("plaza", calm, { variables: { club_open: true } }), 0);
    expect(before.choices).toEqual([]);
    expect(before.state.transition).toBeNull();
    const bayOnly = ride(atStop("plaza", calm, { variables: { visited_bay: true } }), 0);
    expect(bayOnly.choices).toEqual(["Bubblegum Bay!", "Not yet."]);
    expect(bayOnly.state.transition?.target).toEqual({ area: "bay", spawn: "bus-stop" });
    const both = ride(
      atStop("plaza", calm, { variables: { visited_bay: true, visited_pass: true } }),
      1,
    );
    expect(both.choices).toEqual(["Pinecone Pass!", "Bubblegum Bay!", "Not yet."]);
    expect(both.state.transition?.target).toEqual({ area: "bay", spawn: "bus-stop" });
  });

  it("goes from the bay home to the plaza any time", () => {
    const { choices, state } = ride(atStop("bay", bluebirdFizzy), 0);
    expect(choices).toEqual(["Cloverhollow!", "Not yet."]);
    expect(state.transition?.target).toEqual({ area: "plaza", spawn: "bus-stop" });
  });

  it("goes from the bay up to the pass once Pinecone Pass has been discovered", () => {
    const start = atStop("bay", calm, { variables: { visited_bay: true, visited_pass: true } });
    expect(world.storyVariable(start.ink, "rode_bus")).toBe(false);
    const { choices, state } = ride(start, 1);
    expect(choices).toEqual(["Cloverhollow!", "Pinecone Pass!", "Not yet."]);
    expect(state.transition?.target).toEqual({ area: "pass", spawn: "bus" });
    expect(world.storyVariable(state.ink, "rode_bus")).toBe(true);
  });

  it("goes from the pass home to the plaza or down to the bay once discovered", () => {
    const vars = { visited_bay: true, visited_pass: true };
    const home = ride(atStop("pass", calm, { variables: vars }), 0);
    expect(home.choices).toEqual(["Cloverhollow!", "Bubblegum Bay!", "Not yet."]);
    expect(home.state.transition?.target).toEqual({ area: "plaza", spawn: "bus-stop" });
    const beach = ride(atStop("pass", calm, { variables: vars }), 1);
    expect(beach.state.transition?.target).toEqual({ area: "bay", spawn: "bus-stop" });
  });

  it("offers the same rides on every visit, however often Fae rides", () => {
    // Ink choices are once-only unless sticky; the stops' were once-only
    // until Milestone 28, so each ride could be taken only once a game.
    let ink = atStop("plaza", calm, {
      variables: { visited_bay: true, visited_pass: true },
    }).ink;
    for (let trip = 0; trip < 3; trip += 1) {
      const up = ride(atStop("plaza", calm, { ink }), 0);
      expect(up.choices, `trip ${trip}`).toEqual(["Pinecone Pass!", "Bubblegum Bay!", "Not yet."]);
      const down = ride(atStop("pass", calm, { ink: up.state.ink }), 0);
      expect(down.choices, `trip ${trip}`)
        .toEqual(["Cloverhollow!", "Bubblegum Bay!", "Not yet."]);
      ink = down.state.ink;
    }
  });

  it("only ever sends Fae to a place that exists", () => {
    const source = readStorySources();
    const targets = [...new Set([...source.matchAll(/#\s*travel:\s*([^\s#]+)/g)]
      .map((match) => match[1] ?? ""))].sort();
    // The buses, the old oak's branch across the playing field's creek, ski lift, and rowboat.
    expect(targets).toEqual([
      "bay.boats", "bay.bus-stop", "field.east-bank", "island.pier", "mist.stones", "pass.bus",
      "pass.ski-lift", "plaza.bus-stop", "summit.lift-top",
    ]);
    for (const target of targets) {
      const [area, spawn] = target.split(".");
      expect(areaFor(area ?? "").spawns[spawn ?? ""], target).toBeDefined();
    }
  });

  it("lets Fae stand where the bus drops her, and face each stop", () => {
    const arrivals: [string, string][] = [["plaza", "bus-stop"], ["bay", "bus-stop"],
      ["pass", "bus"]];
    for (const [area, spawn] of arrivals) {
      const point = areaFor(area).spawns[spawn];
      if (point === undefined) throw new Error(`${area}.${spawn} missing`);
      expect(standable(areaFor(area), point), `${area}.${spawn}`).toBe(true);
    }
    const stops: [string, string][] = [["plaza", "npc:bus-stop"], ["bay", "npc:bus-stop"],
      ["pass", "pass-bus-stop"]];
    for (const [area, id] of stops) {
      const state = atStop(area, calm);
      expect(standable(areaFor(area), state.player), area).toBe(true);
      expect(targetInteractable(world, state)?.id, area).toBe(id);
    }
  });
});
