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
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 24 (the bus line and the map). The bus now stops in
// all three towns: Cloverhollow's plaza, Bubblegum Bay (by the welcome sign,
// where the road from town comes in), and Pinecone Pass. From any stop it goes
// to any other the story has opened: the bay once the east road is open
// (`club_open`), the pass once the bluebird has pointed Fae toward the
// mountains (riding there counts as the first ride, `rode_bus`). Every area
// belongs to one of the six lands on the journal's painted map, which marks
// where Fae is.

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
  const solid = [...area.blockers, ...area.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

// The story at the end of chapter one: the tree house club is open, so the
// east road to the bay is too.
function chapterOneInk(): State["ink"] {
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("new-game fixture missing");
  const path = "tests/sim/scripts/new-game/chapter-one.json";
  const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
  let state = createState(world, fixture);
  for (const segment of script)
    for (let tick = 0; tick < segment.ticks; tick += 1)
      state = step(world, state, segment.frame).state;
  if (world.storyVariable(state.ink, "club_open") !== true) throw new Error("club not open");
  return state.ink;
}

// Fae in front of an area's bus stop, facing it.
function atStop(area: string, critters: State["critters"], ink?: State["ink"]): State {
  const spawn = areaFor(area).spawns[area === "pass" ? "bus" : "bus-stop"];
  if (spawn === undefined) throw new Error(`no bus spawn in ${area}`);
  const start = createState(world, { area, spawn: area === "pass" ? "bus" : "bus-stop" });
  const feet = area === "pass" ? { x: 1017, y: 975 } : { x: spawn.x, y: spawn.y };
  return {
    ...start,
    player: feet,
    facing: "up",
    critters: { ...start.critters, ...critters },
    ...(ink === undefined ? {} : { ink }),
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

const calm: State["critters"] = { frog: "calm", pup: "calm", bluebird: "calm" };
const bluebirdFizzy: State["critters"] = { frog: "calm", pup: "calm", bluebird: "chaos" };

describe("the lands", () => {
  it("are the six lands of the painted map, in order", () => {
    expect(world.lands.map((land) => land.id))
      .toEqual(["cloverhollow", "bay", "pass", "trail", "forest", "enchanted"]);
    expect(world.lands.map((land) => land.name)).toEqual([
      "Cloverhollow", "Bubblegum Bay", "Pinecone Pass", "Cliffside Trail", "The Forest",
      "The Enchanted Forest",
    ]);
  });

  it("put every area in a land, except the test harness", () => {
    const lands: Record<string, string> = {
      bedroom: "cloverhollow", kitchen: "cloverhollow", plaza: "cloverhollow",
      park: "cloverhollow", school: "cloverhollow", bay: "bay", pass: "pass", trail: "trail",
    };
    for (const area of Object.values(world.areas))
      expect(area.land, area.id).toBe(area.id === "harness" ? undefined : lands[area.id]);
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

  it("goes from the plaza to the pass, and to the bay once the east road is open", () => {
    const before = ride(atStop("plaza", calm), 1);
    expect(before.choices).toEqual(["Pinecone Pass!", "Not yet."]);
    expect(before.state.transition).toBeNull();
    const after = ride(atStop("plaza", calm, chapterOneInk()), 1);
    expect(after.choices).toEqual(["Pinecone Pass!", "Bubblegum Bay!", "Not yet."]);
    expect(after.state.transition?.target).toEqual({ area: "bay", spawn: "bus-stop" });
  });

  it("goes from the bay home to the plaza any time", () => {
    const { choices, state } = ride(atStop("bay", bluebirdFizzy, chapterOneInk()), 0);
    expect(choices).toEqual(["Cloverhollow!", "Not yet."]);
    expect(state.transition?.target).toEqual({ area: "plaza", spawn: "bus-stop" });
  });

  it("goes from the bay up to the pass once the bluebird is calm: the first ride", () => {
    const start = atStop("bay", calm, chapterOneInk());
    expect(world.storyVariable(start.ink, "rode_bus")).toBe(false);
    const { choices, state } = ride(start, 1);
    expect(choices).toEqual(["Cloverhollow!", "Pinecone Pass!", "Not yet."]);
    expect(state.transition?.target).toEqual({ area: "pass", spawn: "bus" });
    expect(world.storyVariable(state.ink, "rode_bus")).toBe(true);
  });

  it("goes from the pass home to the plaza or down to the bay", () => {
    const home = ride(atStop("pass", calm, chapterOneInk()), 0);
    expect(home.choices).toEqual(["Cloverhollow!", "Bubblegum Bay!", "Not yet."]);
    expect(home.state.transition?.target).toEqual({ area: "plaza", spawn: "bus-stop" });
    const beach = ride(atStop("pass", calm, chapterOneInk()), 1);
    expect(beach.state.transition?.target).toEqual({ area: "bay", spawn: "bus-stop" });
  });

  it("only ever sends Fae to a place that exists", () => {
    const source = readFileSync("content/story/main.ink", "utf8");
    const targets = [...new Set([...source.matchAll(/#\s*travel:\s*([^\s#]+)/g)]
      .map((match) => match[1] ?? ""))].sort();
    expect(targets).toEqual(["bay.bus-stop", "pass.bus", "plaza.bus-stop"]);
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
