import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";
import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  createStoryReader,
  distanceToPolygon,
  faeBox,
  hiddenFraction,
  journalNotes,
  npcVisible,
  parseSave,
  partySlots,
  pointInPolygon,
  serializeSave,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Box,
  type Fixture,
  type Npc,
  type Point,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 18 (Sue). Sue joins the roster: she isn't in the
// party at a new game, she joins when the story sets `sue_joined`, and she
// brings Cast. The meeting itself is Milestone 19 (Bubblegum Bay); here a test
// knot appended to the real story stands in for it.

const content = loadContent();
const world = content.world;
const tune = world.tunables.follow;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

function fixtureFor(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`fixture ${name} missing`);
  return fixture;
}

function areaFor(world: World, id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

function boxFor(id: string): Box {
  const member = world.party[id];
  if (member === undefined) throw new Error(`party member ${id} missing`);
  return member.box;
}

function validFollowerPoint(world: World, state: State, point: Point): boolean {
  const area = areaFor(world, state.area);
  const clear = tune.radius - 0.01;
  if (!pointInPolygon(point, area.walkable)) return false;
  if (distanceToPolygon(point, area.walkable) < clear) return false;
  return area.blockers.every(
    (blocker) => !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= clear,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compileStory(source: string): Record<string, unknown> {
  const compiler = new Compiler(source);
  compiler.Compile();
  const errors = compiler.errors ?? [];
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const runtime = compiler.runtimeStory;
  if (runtime === null) throw new Error("no story");
  const json = runtime.ToJson();
  if (typeof json !== "string") throw new Error("story did not serialize");
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) throw new Error("story is not an object");
  return parsed;
}

describe("Sue in the roster", () => {
  it("rosters Sue after Maddie: not there at the start, joins with sue_joined, brings Cast", () => {
    expect(Object.keys(world.party)).toEqual(["maddie", "sue", "jordan"]);
    expect(world.party["sue"]).toEqual({
      id: "sue",
      name: "Sue",
      atlas: "assets/characters/sue/sue.json",
      box: { width: 50, height: 140 },
      walkCycleUnits: 126,
      sits: false,
      start: false,
      joins: "sue_joined",
      command: { id: "cast", label: "Cast", resting: "reeling in" },
    });
    expect(world.party["maddie"]?.joins).toBeNull();
    const fresh = createState(world, fixtureFor("new-game"));
    expect(fresh.party.map((member) => member.id)).toEqual(["maddie"]);
    expect(world.storyVariable(fresh.ink, "sue_joined")).toBe(false);
  });

  it("every critter answers Cast with its own gentle lines", () => {
    for (const critter of Object.values(world.critters)) {
      expect(Object.keys(critter.commands.friends)).toEqual(["play", "cast", "juggle"]);
      expect(critter.commands.friends["cast"]).toEqual({ calm: 35, great: 10, good: 5, rest: 2 });
      const lines = critter.lines.friends["cast"];
      if (lines === undefined) throw new Error(`${critter.id} has no Cast lines`);
      for (const grade of ["great", "good", "miss"] as const) {
        expect(lines[grade], `${critter.id} ${grade}`).toMatch(/Sue/);
        expect(lines[grade].toLowerCase(), `${critter.id} ${grade}`).not.toMatch(/hook/);
      }
    }
  });

  it("fits the whole roster at every spawn of every area", () => {
    const roster = Object.values(world.party);
    for (const area of Object.values(world.areas))
      for (const [name, spawn] of Object.entries(area.spawns)) {
        const slots = partySlots(area, spawn, tune, roster);
        expect(
          slots.length === roster.length && slots.every((slot) => slot.slot !== undefined),
          `${area.id}.${name}`,
        ).toBe(true);
      }
  });
});

describe("joining", () => {
  // The real story plus one test knot that sets sue_joined before its line,
  // so the variable is already true while the talk is open.
  const testKnot = [
    "=== sue_test ===",
    "~ sue_joined = true",
    "I'm coming with you! # speaker: Sue",
    "-> DONE",
  ].join("\n");
  const story = compileStory(
    `${readFileSync("content/story/main.ink", "utf8")}\n${testKnot}\n`,
  );
  const harness = areaFor(world, "harness");
  const sueNpc: Npc = {
    id: "sue",
    point: { x: 300, y: 420 },
    facing: "down",
    footprint: [[285, 410], [315, 410], [315, 430], [285, 430]],
    knot: "sue_test",
    prompt: "Talk",
  };
  const storyWorld: World = { ...world, story, storyVariable: createStoryReader(story) };
  const npcWorld: World = {
    ...storyWorld,
    areas: { ...world.areas, harness: { ...harness, npcs: [...harness.npcs, sueNpc] } },
  };
  const bellWorld: World = {
    ...storyWorld,
    areas: {
      ...world.areas,
      harness: {
        ...harness,
        interactables: [
          ...harness.interactables,
          { id: "bell", knot: "sue_test", point: { x: 300, y: 420 }, prompt: "Look" },
        ],
      },
    },
  };

  function walkUntilTarget(world: World, state: State, id: string): State {
    for (let tick = 0; tick < 300; tick += 1) {
      if (targetInteractable(world, state)?.id === id) return state;
      state = step(world, state, press({ move: { x: 0, y: -1 } })).state;
    }
    throw new Error(`never targeted ${id}`);
  }

  // Opens the talk with a confirm edge and presses through to the close. While
  // the talk is open nobody joins, even though sue_joined is already true.
  function talk(world: World, state: State): State {
    state = step(world, state, blankInput()).state;
    state = step(world, state, press({ confirm: true })).state;
    if (state.dialogue === null) throw new Error("the talk did not open");
    for (let tick = 0; tick < 600 && state.dialogue !== null; tick += 1) {
      expect(state.party.map((member) => member.id)).toEqual(["maddie"]);
      state = step(world, state, press({ confirm: tick % 2 === 1 })).state;
    }
    if (state.dialogue !== null) throw new Error("the talk never closed");
    return state;
  }

  it("brings Sue in where she stood, once the talk closes, and she follows", () => {
    let state = createState(npcWorld, fixtureFor("harness"));
    expect(npcVisible(npcWorld, state, sueNpc)).toBe(true);
    state = walkUntilTarget(npcWorld, state, "npc:sue");
    state = talk(npcWorld, state);

    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    const joined = state.party[1];
    if (joined === undefined) throw new Error("Sue missing");
    expect({ x: joined.x, y: joined.y }).toEqual(sueNpc.point);
    expect(npcVisible(npcWorld, state, sueNpc), "a party member isn't also a person").toBe(false);
    expect(targetInteractable(npcWorld, state)?.id).not.toBe("npc:sue");

    for (let tick = 0; tick < 40; tick += 1)
      state = step(npcWorld, state, press({ move: { x: 0, y: -1 } })).state;
    expect(state.player.y, "her old spot is no longer solid").toBeLessThan(380);

    const start = { x: joined.x, y: joined.y };
    for (let tick = 0; tick < 330; tick += 1) {
      state = step(npcWorld, state, press({ move: { x: tick < 240 ? 1 : 0, y: 0 } })).state;
      expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
      for (const member of state.party)
        expect(validFollowerPoint(npcWorld, state, member), `${member.id} at ${state.tick}`)
          .toBe(true);
    }
    const [maddie, sue] = state.party;
    if (maddie === undefined || sue === undefined) throw new Error("party short");
    expect(distance(sue, start)).toBeGreaterThan(500);
    expect(distance(sue, maddie)).toBeLessThanOrEqual(tune.distance * 1.5);

    const template = createState(npcWorld, fixtureFor("harness"));
    expect(parseSave(serializeSave(state), template)).toEqual(state);
  });

  it("brings Sue in at a slot behind the last member when she has no spot here", () => {
    let state = createState(bellWorld, fixtureFor("harness"));
    state = walkUntilTarget(bellWorld, state, "bell");
    state = talk(bellWorld, state);
    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    const [maddie, sue] = state.party;
    if (maddie === undefined || sue === undefined) throw new Error("party short");
    expect(validFollowerPoint(bellWorld, state, sue)).toBe(true);
    expect(distance(sue, maddie)).toBeLessThanOrEqual(tune.heel + 10);
    expect(distance(sue, maddie)).toBeGreaterThanOrEqual(tune.radius * 2);
    expect(distance(sue, state.player)).toBeGreaterThanOrEqual(tune.radius * 2);
  });
});

describe("a party with Sue", () => {
  function replay(fixture: Fixture, path: string, each: (state: State) => void): State {
    let state = createState(world, fixture);
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(world, state, segment.frame).state;
        each(state);
      }
    return state;
  }

  const scripts: [string, string][] = [
    ["harness", "harness-600.json"],
    ["harness", "concave-corners.json"],
    ["plaza", "maddie-loop.json"],
    ["plaza", "explore.json"],
  ];
  for (const [folder, file] of scripts) {
    it(`walks ${folder}/${file} and settles where everyone can be seen`, () => {
      const fixture = { ...fixtureFor(folder), party: ["maddie", "sue"] };
      let state = replay(fixture, join("tests/sim/scripts", folder, file), (state) => {
        for (const member of state.party)
          expect(validFollowerPoint(world, state, member), `${member.id} at ${state.tick}`)
            .toBe(true);
      });
      for (let tick = 0; tick < 150; tick += 1) state = step(world, state, blankInput()).state;
      // Once everyone stands still, nobody in the party is more than a quarter
      // hidden by anyone ahead of them, or hides more than a quarter of them.
      const people = [
        { id: "fae", point: state.player, box: faeBox },
        ...state.party.map((member) => ({ id: member.id, point: member, box: boxFor(member.id) })),
      ];
      for (let behind = 1; behind < people.length; behind += 1)
        for (let ahead = 0; ahead < behind; ahead += 1) {
          const a = people[ahead];
          const b = people[behind];
          if (a === undefined || b === undefined) throw new Error("missing person");
          expect(hiddenFraction(b.point, b.box, a.point, a.box), `${b.id} behind ${a.id}`)
            .toBeLessThanOrEqual(0.25);
          expect(hiddenFraction(a.point, a.box, b.point, b.box), `${a.id} behind ${b.id}`)
            .toBeLessThanOrEqual(0.25);
        }
    });
  }
});

describe("the journal", () => {
  it("points to the park once the frog is calm, wherever Fae is and whatever she read", () => {
    const fresh = createState(world, fixtureFor("plaza"));
    const state: State = { ...fresh, critters: { ...fresh.critters, "fountain-frog": "calm" },
      stickers: ["fountain-frog"] };
    expect(journalNotes(world, state).slice(0, 2)).toEqual([
      "Purple fizz drips lead out of the plaza to Meadow Park.",
      "The Fountain Frog is calm. Something purple fizzed into his fountain.",
    ]);
  });
});
