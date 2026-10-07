import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  journalNotes,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Fixture,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 20 (the bus to Pinecone Pass). A story line tagged
// `travel: <area>.<spawn>` takes Fae there when the conversation closes, with
// the same fade as a door. The town's bus stop stands in the plaza; once the
// bluebird is calm (it pointed toward the mountains), Fae can ride it up to
// Pinecone Pass, and ride home again from the stop up there.

const content = loadContent();
const world = content.world;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

function fixtureFor(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`fixture ${name} missing`);
  return fixture;
}

// The stickers of every species the story asks about so far.
const allCalm = ["fountain-frog", "pond-pup", "bay-bluebird"];

// Fae a few steps in front of a talk target, facing it, with the stickers of
// the species she has calmed (the story asks calmed() of a species).
function before(
  area: string,
  feet: { x: number; y: number },
  facing: State["facing"],
  stickers: string[],
): State {
  const start = createState(world, { area, spawn: Object.keys(areaFor(area).spawns)[0] ?? "" });
  return { ...start, player: feet, facing, stickers };
}

// Opens the talk with a confirm edge and presses through to its close,
// taking `choice` (by touch) at every choice. Returns the lines shown.
function talk(state: State, choice: number): { state: State; lines: string[] } {
  const lines: string[] = [];
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  if (state.dialogue === null) throw new Error("the talk did not open");
  for (let tick = 0; tick < 600 && state.dialogue !== null; tick += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed >= dialogue.text.length && lines.at(-1) !== dialogue.text)
      lines.push(dialogue.text);
    const frame = dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length
      ? press({ choose: choice })
      : press({ confirm: tick % 2 === 1 });
    state = step(world, state, frame).state;
  }
  if (state.dialogue !== null) throw new Error("the talk never closed");
  return { state, lines };
}

function settle(state: State): State {
  for (let tick = 0; tick < 120 && state.transition !== null; tick += 1)
    state = step(world, state, blankInput()).state;
  return state;
}

describe("the town's bus stop", () => {
  const plaza = areaFor("plaza");

  it("stands between the plaza's lower flower boxes, solid, with a Look", () => {
    const stop = plaza.npcs.find((npc) => npc.id === "bus-stop");
    if (stop === undefined) throw new Error("no bus stop in the plaza");
    expect({ knot: stop.knot, prompt: stop.prompt, facing: stop.facing })
      .toEqual({ knot: "bus_stop", prompt: "Look", facing: "down" });
    expect(stop.point).toEqual({ x: 878, y: 945 });
    expect(stop.footprint).toEqual([[828, 903], [932, 903], [932, 925], [828, 925]]);
    expect(world.characters["bus-stop"]?.atlas).toBe("assets/characters/bus-stop/bus-stop.json");
    const arrival = plaza.spawns["bus-stop"];
    expect(arrival).toEqual({ x: 878, y: 985, facing: "down" });
  });

  it("goes nowhere before the bluebird is calm", () => {
    const state = before("plaza", { x: 878, y: 985 }, "up", ["fountain-frog", "pond-pup"]);
    expect(targetInteractable(world, state)?.id).toBe("npc:bus-stop");
    const { state: after, lines } = talk(state, 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(settle(after).area).toBe("plaza");
  });

  it("stays in town when Fae says not yet", () => {
    const state = before("plaza", { x: 878, y: 985 }, "up", allCalm);
    const { state: after } = talk(state, 1);
    expect(after.transition).toBeNull();
    expect(settle(after).area).toBe("plaza");
  });

  it("rides up to Pinecone Pass, party and all", () => {
    let state = before("plaza", { x: 878, y: 985 }, "up", allCalm);
    state = { ...state, party: createState(world, { ...fixtureFor("plaza-party") }).party };
    const { state: after } = talk(state, 0);
    expect(after.transition?.target).toEqual({ area: "pass", spawn: "bus" });
    state = settle(after);
    const pass = areaFor("pass");
    expect(state.area).toBe("pass");
    expect(state.player).toEqual({ x: pass.spawns["bus"]?.x, y: pass.spawns["bus"]?.y });
    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    expect(state.safeSpot).toEqual({ area: "pass", spawn: "bus" });
    expect(world.storyVariable(state.ink, "rode_bus")).toBe(true);
  });
});

describe("the bus home", () => {
  it("rides back from the pass's stop to the plaza's", () => {
    const pass = areaFor("pass");
    const stop = pass.interactables.find((item) => item.id === "pass-bus-stop");
    if (stop === undefined) throw new Error("no bus stop at the pass");
    expect(stop.knot).toBe("pass_bus_stop");
    const state = before("pass", { x: stop.point.x, y: stop.point.y + 40 }, "up", allCalm);
    expect(targetInteractable(world, state)?.id).toBe("pass-bus-stop");
    const { state: after } = talk(state, 0);
    expect(after.transition?.target).toEqual({ area: "plaza", spawn: "bus-stop" });
    const home = settle(after);
    expect(home.area).toBe("plaza");
    expect(home.player).toEqual({ x: 878, y: 985 });
  });
});

describe("story travel", () => {
  it("only ever sends Fae to a place that exists", () => {
    const source = readFileSync("content/story/main.ink", "utf8");
    const targets = [...source.matchAll(/#\s*travel:\s*([^\s#]+)/g)].map((match) => match[1] ?? "");
    expect([...new Set(targets)].sort()).toEqual(["bay.bus-stop", "pass.bus", "plaza.bus-stop"]);
    for (const target of targets) {
      const [area, spawn] = target.split(".");
      expect(areaFor(area ?? "").spawns[spawn ?? ""], target).toBeDefined();
    }
  });
});

describe("the journal", () => {
  it("points to the bus once the bluebird is calm, and to the pass once Fae rides it", () => {
    let state = before("plaza", { x: 878, y: 985 }, "up", allCalm);
    expect(journalNotes(world, state)[0]).toBe(
      "The bus at the plaza's star sign goes up into the mountains, to Pinecone Pass!");
    state = settle(talk(state, 0).state);
    expect(journalNotes(world, state)[0]).toMatch(/Pinecone Pass/);
    expect(journalNotes(world, state)[0]).not.toMatch(/bus/i);
  });
});
