import { describe, expect, it } from "vitest";
import {
  blankInput, createState, journalNotes, presentCritters, step,
  targetInteractable, type InkFacts, type Point, type State,
} from "../../src/core";
import { createInkState, inkVariable, runInk } from "../../src/core/ink";
import { areaConnectionErrors, hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

const content = loadContent();
const { world } = content;
const facts = (calmed: Record<string, boolean> = {}): InkFacts =>
  ({ calmed, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 });

type Played = { lines: string[]; ink: string };
function play(ink: string, knot: string, with_ = facts()): Played {
  const lines: string[] = [];
  let result = runInk(world.story, ink, { type: "start", knot }, with_);
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.ended) break;
    result = runInk(world.story, result.ink, result.choices.length > 0
      ? { type: "choose", index: 0 } : { type: "next" }, with_);
  }
  return { lines, ink: result.ink };
}

function at(
  area: string, spawn: string, ink: string, player?: Point,
  facing: State["facing"] = "right",
): State {
  const state = createState(world, { area, spawn, seed: 1 });
  return { ...state, ink, ...(player === undefined ? {} : { player }), facing };
}

function walk(state: State, move: Point, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks && next.dialogue === null &&
    next.transition === null && next.battle === null; tick += 1)
    next = step(world, next, { ...blankInput(), move }).state;
  return next;
}

describe("Ms. Rowan's art-room door", () => {
  it("stays locked before the stash, then brings Ms. Rowan out", () => {
    const fresh = createInkState(world.story, 1);
    const locked = play(fresh, "art_room");
    expect(locked.lines).toEqual([
      "A paint palette on the door. The art room, maybe? It's locked.",
    ]);
    expect(inkVariable(world.story, locked.ink, "art_teacher_out")).toBe(false);

    const stash = play(fresh, "hood_stash");
    const paint = play(stash.ink, "art_room");
    expect(paint.lines).toEqual([
      "Purple paint seeps under the door. A paintbrush clatters, and a teacher " +
      "steps into the hall!",
    ]);
    expect(inkVariable(world.story, paint.ink, "art_teacher_out")).toBe(true);
    expect(play(paint.ink, "art_room").lines).toEqual([
      "The door's still locked, and Ms. Rowan is swishing purple paint all over the hall!",
    ]);
    const open = play(play(paint.ink, "art_teacher").ink, "art_room");
    expect(open.lines).toEqual([
      "The art room door stands open. It smells like paint and glue sticks!",
    ]);
  });
});

describe("Ms. Rowan", () => {
  const out = play(play(createInkState(world.story, 1), "hood_stash").ink, "art_room").ink;
  const hallSpawn = world.areas["east-hall"]?.spawns["art-room"];

  it("is hidden until the door story variable, then becomes a solid battle target", () => {
    const hidden = at("east-hall", "art-room", createInkState(world.story, 1));
    expect(presentCritters(world, hidden)
      .some((critter) => critter.key === "art-teacher")).toBe(false);
    expect(targetInteractable(world,
      { ...hidden, player: { x: 990, y: 500 }, facing: "right" })?.id)
      .not.toBe("critter:art-teacher");

    if (hallSpawn === undefined) throw new Error("art-room hall spawn missing");
    const visible = at("east-hall", "art-room", out, hallSpawn, "right");
    const teacher = presentCritters(world, visible)
      .find((critter) => critter.key === "art-teacher");
    expect(teacher?.mood).toBe("chaos");
    expect(walk({ ...visible, player: { x: 900, y: 500 }, facing: "right" },
      { x: 1, y: 0 }, 100).battle?.critterId).toBe("art-teacher");

    const calmState: State = {
      ...visible, critters: { ...visible.critters, "art-teacher": "calm" },
    };
    expect(presentCritters(world, calmState).find((critter) => critter.key === "art-teacher")?.mood)
      .toBe("calm");
    expect(targetInteractable(world,
      { ...calmState, player: { x: 990, y: 500 }, facing: "right" })?.id)
      .toBe("critter:art-teacher");
    const calmTalk = play(out, "art_teacher", facts({ "art-teacher": true }));
    expect(play(calmTalk.ink, "art_teacher", facts({ "art-teacher": true })).lines).toEqual([
      "Welcome back, Fae! The easels are ready for you.",
    ]);
  });

  it("has the person battle contract and album slot", () => {
    const teacher = world.critters["art-teacher"];
    if (teacher === undefined) throw new Error("Ms. Rowan missing");
    expect({ feelings: teacher.feelings, calmKnot: teacher.calmKnot, coins: teacher.coins,
      sticker: teacher.sticker.id, windUp: teacher.windUp?.lines.fizzle }).toEqual({
      feelings: ["curious", "zoomy", "grumpy"], calmKnot: "art_teacher", coins: 25,
      sticker: "art-teacher",
      windUp: "Pop-pop! Fae pops every paint bubble, and the bucket fizzles.",
    });
    expect(teacher.burst.check.kind).toBe("trace");
    expect(teacher.burst.big?.kind).toBe("trace");
    expect(teacher.burst.check.kind === "trace"
      ? teacher.burst.check.paths.map((path) => path.id) : [])
      .toEqual(["flower", "spiral", "rainbow"]);
    expect(teacher.burst.big?.kind === "trace"
      ? teacher.burst.big.paths.map((path) => path.id) : [])
      .toEqual(["big-flower", "big-rainbow"]);
    expect(teacher.lines.command).toContain("calm Ms. Rowan");
    expect(teacher.lines.intro).toContain("NOBODY touches MY paints!");
    expect(teacher.lines).not.toHaveProperty("talk");
    expect(world.stickers.catalogue.map((sticker) => sticker.id)).toContain("art-teacher");
    expect(world.stickers.slots).toBe(world.stickers.catalogue.length);
  });
});

describe("the art room route and contents", () => {
  it("blocks the door until calm, then routes both ways through real steps", () => {
    const hall = world.areas["east-hall"];
    const room = world.areas["art-room"];
    if (hall === undefined || room === undefined) throw new Error("art areas missing");
    const locked = walk(at("east-hall", "art-room", createInkState(world.story, 1),
      hall.spawns["art-room"], "right"), { x: 1, y: 0 }, 100);
    expect(locked.dialogue?.knot).toBe("art_room");
    const openedInk = play(
      play(createInkState(world.story, 1), "hood_stash").ink, "art_room").ink;
    const calmInk = play(openedInk, "art_teacher", facts({ "art-teacher": true })).ink;
    const open = walk(at("east-hall", "art-room", calmInk, hall.spawns["art-room"], "right"),
      { x: 1, y: 0 }, 100);
    expect(open.transition?.target).toEqual({ area: "art-room", spawn: "door" });
    const back = walk(
      at("art-room", "door", calmInk, room.spawns.door, "left"), { x: -1, y: -1 }, 140);
    expect(back.transition?.target).toEqual({ area: "east-hall", spawn: "art-room" });
  });

  it("has a live story knot for every look point and passes area checks", () => {
    const room = world.areas["art-room"];
    if (room === undefined) throw new Error("art room missing");
    const fresh = createInkState(world.story, 1);
    for (const item of room.interactables)
      expect(play(fresh, item.knot).lines.length, item.knot).toBeGreaterThan(0);
    expect(hiddenPositions(room, world.tunables.playerRadius)).toEqual([]);
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party)
      .filter((error) => /^(art-room|east-hall):/.test(error))).toEqual([]);
  });
});

describe("Ms. Rowan's journal note", () => {
  it("reports the fizzy teacher, then the calm teacher", () => {
    const start = createState(world, { area: "harness", spawn: "start", seed: 1 });
    const teacherOut = play(
      play(createInkState(world.story, 1), "hood_stash").ink, "art_room").ink;
    const fizzy = journalNotes(world, { ...start, ink: teacherOut });
    expect(fizzy).toContain("Ms. Rowan is fizzy in the east hall, swishing wild purple paint.");
    const calm = journalNotes(world, { ...start, ink: teacherOut,
      critters: { ...start.critters, "art-teacher": "calm" } });
    expect(calm).toContain(
      "I calmed Ms. Rowan, the art teacher. Her room is open, and every purple marker is missing!",
    );
    expect(calm).not.toContain("Ms. Rowan is fizzy");
  });
});
