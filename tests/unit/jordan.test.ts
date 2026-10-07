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
  type Den,
  type Fixture,
  type Grade,
  type Point,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Contract for Jordan's milestone. At Pinecone Pass, Jordan is trying to
// catch a fizzy hamster; he joins whatever Fae says and brings Juggle. Calmed,
// the hamster says the kid in the purple hood took a trail that only shows at
// night, and Jordan gives Fae his blacklight lantern (`has_lantern`). Since
// Milestone 28 the pass's hamsters are recurring: a den by the clearing always
// has one out.

const content = loadContent();
const world = content.world;
const tune = world.tunables.follow;
const radius = world.tunables.playerRadius;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const pass = areaFor("pass");

function standable(point: Point): boolean {
  if (!pointInPolygon(point, pass.walkable)) return false;
  if (distanceToPolygon(point, pass.walkable) < radius) return false;
  const solid = [...pass.blockers, ...pass.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

function atPass(feet: Point, facing: State["facing"], party: string[]): State {
  const fixture: Fixture = { area: "pass", spawn: "bus", seed: 1, party };
  return { ...createState(world, fixture), player: feet, facing };
}

// Opens the talk with a confirm edge and presses through to its close, taking
// `choice` (by touch) at every choice.
function talk(state: State, choice: number): State {
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  if (state.dialogue === null) throw new Error("the talk did not open");
  for (let tick = 0; tick < 900 && state.dialogue !== null; tick += 1) {
    const dialogue = state.dialogue;
    const frame = dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length
      ? press({ choose: choice })
      : press({ confirm: tick % 2 === 1 });
    state = step(world, state, frame).state;
  }
  if (state.dialogue !== null) throw new Error("the talk never closed");
  return state;
}

describe("Jordan in the roster", () => {
  it("rosters Jordan after Sue: joins with jordan_joined and brings Juggle", () => {
    expect(Object.keys(world.party)).toEqual(["maddie", "sue", "jordan"]);
    expect(world.party["jordan"]).toEqual({
      id: "jordan",
      name: "Jordan",
      atlas: "assets/characters/jordan/jordan.json",
      box: { width: 50, height: 140 },
      walkCycleUnits: 126,
      sits: false,
      start: false,
      joins: "jordan_joined",
      command: { id: "juggle", label: "Juggle", resting: "finding pinecones" },
    });
  });

  it("every critter answers Juggle with lines about Jordan", () => {
    for (const critter of Object.values(world.critters)) {
      expect(Object.keys(critter.commands.friends)).toEqual(["play", "cast", "juggle"]);
      expect(critter.commands.friends["juggle"]).toEqual({ calm: 30, great: 15, good: 5, rest: 2 });
      const lines = critter.lines.friends["juggle"];
      if (lines === undefined) throw new Error(`${critter.id} has no Juggle lines`);
      const grades: Grade[] = ["great", "good", "miss"];
      for (const grade of grades) expect(lines[grade], `${critter.id} ${grade}`).toMatch(/Jordan/);
    }
  });

  it("fits the whole party of three at every spawn of every area", () => {
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

// The clearing's den: the story needs a hamster there (its talk brings the
// lantern), so it always has one out.
function clearingDen(): Den {
  const den = pass.recurring?.dens[0];
  if (den === undefined) throw new Error("the pass has no den");
  return den;
}

describe("the hamster hiker", () => {
  it("is a generic critter with a den in the pass's clearing", () => {
    const critter = world.critters["hamster"];
    if (critter === undefined) throw new Error("no hamster");
    expect(critter.atlas).toBe("assets/critters/hamster/hamster.json");
    expect(critter.calmKnot).toBe("hamster_calm");
    const den = clearingDen();
    expect(den).toMatchObject({ kinds: ["hamster"], chance: 1 });
    expect(standable(den.point)).toBe(true);
    expect(den.point.x).toBeGreaterThanOrEqual(450);
    expect(den.point.x).toBeLessThanOrEqual(900);
    expect(den.point.y).toBeGreaterThanOrEqual(560);
    expect(den.point.y).toBeLessThanOrEqual(760);
    expect(world.stickers.catalogue.some((sticker) =>
      sticker.id === critter.sticker.id && sticker.critter === "hamster")).toBe(true);
  });

  it("is out, in chaos, whenever Fae arrives", () => {
    expect(atPass({ x: 930, y: 1015 }, "up", ["maddie"]).wild
      .find((critter) => critter.den === 0)).toMatchObject({ kind: "hamster", mood: "chaos" });
  });
});

describe("meeting Jordan", () => {
  const jordan = pass.npcs.find((npc) => npc.id === "jordan");

  it("stands by the clearing, near the hamster, out of its way", () => {
    if (jordan === undefined) throw new Error("Jordan isn't at the pass");
    expect({ knot: jordan.knot, prompt: jordan.prompt })
      .toEqual({ knot: "jordan", prompt: "Talk" });
    expect(jordan.visibleWhile).toBeUndefined();
    const hamster = clearingDen();
    const gap = Math.hypot(jordan.point.x - hamster.point.x, jordan.point.y - hamster.point.y);
    expect(gap).toBeLessThanOrEqual(260);
    const touch = world.critters["hamster"]?.touchRadius ?? 0;
    expect(gap).toBeGreaterThan(touch + 60);
    expect(world.characters["jordan"]?.atlas).toBe("assets/characters/jordan/jordan.json");
  });

  for (const choice of [0, 1])
    it(`joins whatever Fae says (answer ${choice}) and Juggle joins the battle menu`, () => {
      if (jordan === undefined) throw new Error("Jordan isn't at the pass");
      // Fae just south of him, facing up at him.
      let state = atPass({ x: jordan.point.x, y: jordan.point.y + 45 }, "up", ["maddie", "sue"]);
      expect(standable(state.player)).toBe(true);
      expect(targetInteractable(world, state)?.id).toBe("npc:jordan");
      state = talk(state, choice);
      expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue", "jordan"]);
      expect(world.storyVariable(state.ink, "jordan_joined")).toBe(true);
    });
});

describe("the hamster's clue and the lantern", () => {
  it("gives Fae the lantern when she talks to the calm hamster", () => {
    const hamster = clearingDen().point;
    let state = atPass({ x: hamster.x, y: hamster.y + 45 }, "up",
      ["maddie", "sue", "jordan"]);
    state = { ...state, wild: state.wild.map((critter) =>
      critter.den === 0 ? { ...critter, mood: "calm" } : critter) };
    expect(targetInteractable(world, state)?.id).toBe("critter:wild:0");
    expect(world.storyVariable(state.ink, "has_lantern")).toBe(false);
    state = talk(state, 0);
    expect(world.storyVariable(state.ink, "has_lantern")).toBe(true);
    expect(journalNotes(world, state)[0]).toMatch(/lantern/i);
  });
});
