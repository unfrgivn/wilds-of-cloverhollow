import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  pointInPolygon,
  presentCritters,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Battle,
  type Direction,
  type Point,
  type State,
  everyPropFootprint,
} from "../../src/core";
import { createInkState, inkVariable, runInk } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 29: the first person under the chaos spell. The
// claimed clubhouse holds the hooded kid's note ("NEXT STOP: THE ARCADE"),
// and the plaza's arcade door, locked until then, opens. Inside, Mr. Pip the
// arcade keeper is a mini-boss set piece: walking into him starts a battle
// with the gull's numbers. Calmed, he pays 25 coins and his sticker, and tells
// what the hooded kid did: a fizzy soda, and scribbled-out high score initials.

const content = loadContent();
const world = content.world;
const story = world.story;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const arcade = areaFor("arcade");
const plaza = areaFor("plaza");

// Plays a knot to its end (choices: the first), returning its lines and state.
function play(ink: string, knot: string, calmed: Record<string, boolean> = {}): {
  lines: string[];
  ink: string;
} {
  const lines: string[] = [];
  let result = runInk(story, ink, { type: "start", knot }, { calmed, coins: 0 });
  for (let count = 0; count < 30; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.ended) break;
    result = result.choices.length > 0
      ? runInk(story, result.ink, { type: "choose", index: 0 }, { calmed, coins: 0 })
      : runInk(story, result.ink, { type: "next" }, { calmed, coins: 0 });
  }
  return { lines, ink: result.ink };
}

const fresh = createInkState(story, 1);
const claimed = play(fresh, "clubhouse", { owl: true }).ink;

// Fae at `feet` in `area`, facing `facing`, with the story `ink`.
function at(area: string, spawn: string, feet: Point, facing: Direction, ink: string): State {
  return { ...createState(world, { area, spawn, seed: 1 }), player: feet, facing, ink };
}

// Holds one direction until the area changes or a dialogue opens.
function walk(state: State, move: Point, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks && next.dialogue === null && next.transition === null; tick += 1)
    next = step(world, next, press({ move })).state;
  return next;
}

describe("the clubhouse's note", () => {
  it("points to the arcade once the clubhouse is claimed", () => {
    const lines = play(fresh, "clubhouse", { owl: true }).lines;
    expect(lines.slice(-2)).toEqual([
      "Hey, there's a note under the comics: \"NEXT STOP: THE ARCADE. FIZZ THE HIGH SCORES!\"",
      "The arcade back in Cloverhollow? We'd better hurry!",
    ]);
    expect(inkVariable(story, claimed, "clubhouse_claimed")).toBe(true);
  });
});

describe("the arcade's door in the plaza", () => {
  const door = plaza.triggers.find((trigger) => trigger.id === "arcade-door");
  const spawn = plaza.spawns["arcade-door"];

  it("leads into the arcade, and the arcade's door leads back to it", () => {
    expect(door?.target).toEqual({ area: "arcade", spawn: "door" });
    expect(door?.requires).toEqual({ variable: "clubhouse_claimed", knot: "arcade_closed" });
    expect(spawn?.facing).toBe("down");
    expect(arcade.triggers.find((trigger) => trigger.id === "door")?.target)
      .toEqual({ area: "plaza", spawn: "arcade-door" });
    expect({ name: arcade.name, land: arcade.land })
      .toEqual({ name: "Cloverhollow Arcade", land: "cloverhollow" });
  });

  it("is locked until the clubhouse is claimed: walking in reads the sign", () => {
    if (spawn === undefined) throw new Error("no arcade-door spawn");
    const locked = walk(at("plaza", "arcade-door", spawn, "up", fresh), { x: 0, y: -1 }, 60);
    expect(locked.area).toBe("plaza");
    expect(locked.dialogue).toMatchObject({ knot: "arcade_closed",
      text: "The arcade's door is locked. A sign says BACK SOON!" });
    const open = walk(at("plaza", "arcade-door", spawn, "up", claimed), { x: 0, y: -1 }, 60);
    expect(open.transition?.target).toEqual({ area: "arcade", spawn: "door" });
  });
});

describe("Mr. Pip, the arcade keeper", () => {
  const keeper = world.critters["arcade-keeper"];
  const placed = arcade.critters.find((piece) => piece.id === "arcade-keeper");

  it("is a mini-boss set piece with the gull's numbers, a person, and his own sticker", () => {
    expect(keeper).toMatchObject({
      species: "arcade-keeper", name: "Fizzy Mr. Pip", calmName: "Mr. Pip",
      touchRadius: 85, calmMax: 160, energyMax: 6, coins: 25, battleHeight: 280,
      overworldHeight: 160, calmKnot: "arcade_keeper",
      sticker: { id: "arcade-keeper", name: "Mr. Pip", frame: "calm_idle_01" },
    });
    expect(keeper?.burst.bigChance).toBe(0.5);
    expect(placed).toBeDefined();
    expect(world.stickers.catalogue.map((sticker) => sticker.id)).toContain("arcade-keeper");
    const state = at("arcade", "door", arcade.spawns["door"] ?? { x: 0, y: 0 }, "up", claimed);
    expect(presentCritters(world, state).map((critter) => critter.key))
      .toEqual(["arcade-keeper"]);
    expect(state.critters["arcade-keeper"]).toBe("chaos");
  });

  it("starts a battle when Fae walks into him", () => {
    if (placed === undefined || keeper === undefined) throw new Error("no keeper");
    const start: Point = { x: placed.point.x, y: placed.point.y + keeper.touchRadius + 30 };
    const state = walk(at("arcade", "door", start, "up", claimed), { x: 0, y: -1 }, 30);
    expect(state.battle).toMatchObject({ critterId: "arcade-keeper", den: null });
  });

  it("pays 25 coins and his sticker when calmed, and tells what the hooded kid did", () => {
    if (placed === undefined || keeper === undefined) throw new Error("no keeper");
    const battle: Battle = {
      critterId: "arcade-keeper", den: null, entry: placed.point, phase: "soothed",
      message: keeper.lines.soothed, revealed: keeper.lines.soothed.length, selected: 0,
      command: null, energy: 6, calm: keeper.calmMax, rest: {}, aim: null, lastGrade: null,
      rewardSticker: null, aimTick: 0, phaseTicks: 0,
    };
    let state: State = { ...at("arcade", "door", placed.point, "up", claimed), battle };
    const lines: string[] = [];
    for (let count = 0; count < 20 && state.battle !== null; count += 1) {
      state = step(world, state, press({ confirm: true })).state;
      if (state.battle !== null && lines.at(-1) !== state.battle.message)
        lines.push(state.battle.message);
      state = step(world, state, blankInput()).state;
    }
    expect(lines).toEqual(["New sticker: Mr. Pip! +25 coins."]);
    expect({ coins: state.coins, stickers: state.stickers, mood: state.critters["arcade-keeper"] })
      .toEqual({ coins: 25, stickers: ["arcade-keeper"], mood: "calm" });
    const talk = play(state.ink, "arcade_keeper", { "arcade-keeper": true });
    expect(talk.lines).toEqual([
      "Whoa... what happened? My head was all fizzy, like a shaken-up soda!",
      "A kid in a purple hood played every game in here this morning.",
      "They gave me a purple fizzy soda to say thanks. " +
        "One sip, and all I wanted was the high score!",
      "So the fizz works on people too...",
      "That kid set a new record on Star Racer, " +
        "then scribbled out their initials in purple marker. Sneaky!",
      "Thank you, Fae. You and your friends can play here any time.",
    ]);
    expect(play(talk.ink, "arcade_keeper", { "arcade-keeper": true }).lines)
      .toEqual(["Mr. Pip polishes the claw machine. \"Come back and play any time!\""]);
  });

  it("is someone to talk to, once calm, from where Fae can stand", () => {
    if (placed === undefined) throw new Error("no keeper");
    const base = at("arcade", "door", placed.point, "up", claimed);
    const calm: State = { ...base, critters: { ...base.critters, "arcade-keeper": "calm" } };
    const radius = world.tunables.playerRadius;
    const standable = (feet: Point): boolean => pointInPolygon(feet, arcade.walkable) &&
      distanceToPolygon(feet, arcade.walkable) >= radius &&
      [...arcade.blockers, ...everyPropFootprint(arcade)].every((polygon) =>
        !pointInPolygon(feet, polygon) && distanceToPolygon(feet, polygon) >= radius);
    const spots: [number, number, Direction][] =
      [[0, 45, "up"], [-45, 0, "right"], [45, 0, "left"], [0, -45, "down"]];
    const talkable = spots.some(([dx, dy, facing]) => {
      const feet = { x: placed.point.x + dx, y: placed.point.y + dy };
      return standable(feet) && targetInteractable(world, { ...calm, player: feet, facing })?.id ===
        "critter:arcade-keeper";
    });
    expect(talkable).toBe(true);
  });
});

describe("the arcade's things to look at, and the journal", () => {
  it("has the claw machine, the ticket counter, and Star Racer", () => {
    expect(arcade.interactables.map((item) => [item.id, item.knot, item.prompt])).toEqual(
      expect.arrayContaining([
        ["claw-machine", "claw_machine", "Look"],
        ["ticket-counter", "ticket_counter", "Look"],
        ["star-racer", "star_racer", "Look"],
      ]));
    expect(play(fresh, "star_racer").lines).toEqual(["STAR RACER. HIGH SCORES!",
      "The screen is fizzing with purple scribbles."]);
    expect(play(fresh, "star_racer", { "arcade-keeper": true }).lines).toEqual([
      "STAR RACER. HIGH SCORES!", "The top score's initials are scribbled out in purple marker."]);
  });

  it("notes the arcade once the clubhouse is claimed, and Mr. Pip's story once he's calm", () => {
    const base = createState(world, { area: "plaza", spawn: "fountain", seed: 1 });
    expect(journalNotes(world, { ...base, ink: claimed })[0]).toBe(
      "A note in the clubhouse said \"NEXT STOP: THE ARCADE.\" " +
        "The arcade is in the plaza, back home.");
    const calm: State = { ...base, ink: claimed,
      critters: { ...base.critters, "arcade-keeper": "calm" } };
    // Newest first: the school chapter's "back to school" note, then his.
    const notes = journalNotes(world, calm);
    expect(notes[0]).toBe("Ms. Maple said to be back in time for story time. Back to school!");
    expect(notes.slice(1, 3)).toEqual([
      "Mr. Pip, the arcade keeper, drank a fizzy soda from the kid in the purple hood. " +
        "The spell works on people too!",
      "The hooded kid scribbled out their initials on the Star Racer high score. " +
        "Someone from school again...",
    ]);
    expect(notes.join(" ")).not.toContain("NEXT STOP");
  });
});
