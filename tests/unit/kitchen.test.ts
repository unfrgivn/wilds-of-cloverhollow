import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  journalNotes,
  propState,
  propStateName,
  step,
  type ActionFrame,
  type Area,
  type State,
  type World,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 52, the clubhouse kitchen. Once the club is claimed,
// Mom gives it her old microwave and her old toy chest. Her freezer has dino
// nuggets and mac n cheese, a box at a time, to cook in the microwave on top of
// the clubhouse fridge (the cooking game, src/core/cook.ts). The chest holds
// what Fae has found along the way, read from what the story already knows.

const content = loadContent();
const world = content.world;
const story = world.story;
const facts = (coins = 0, snacks = 0): InkFacts =>
  ({ calmed: {}, coins, snacks, prizes: [], plushesLeft: 0, tickets: 0 });

const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);

type Played = { lines: string[]; tags: string[][]; choices: string[][]; ink: string };
function play(ink: string, knot: string, choices: number[] = [], with_ = facts()): Played {
  const lines: string[] = [];
  const tags: string[][] = [];
  const offered: string[][] = [];
  let result = runInk(story, ink, { type: "start", knot }, with_);
  let choice = 0;
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) {
      lines.push(result.line.text);
      tags.push(result.line.tags);
    }
    if (result.choices.length > 0) offered.push(result.choices);
    if (result.ended) break;
    result = result.choices.length > 0
      ? runInk(story, result.ink, { type: "choose", index: choices[choice++] ?? 0 }, with_)
      : runInk(story, result.ink, { type: "next" }, with_);
  }
  return { lines, tags, choices: offered, ink: result.ink };
}
// A story where these variables are already true, set in its saved state (the
// moments that set them are other milestones' and are tested there).
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
function storyWith(...names: string[]): string {
  const saved: unknown = JSON.parse(createInkState(story, 1));
  if (!isRecord(saved) || !isRecord(saved.variablesState))
    throw new Error("no variables in the saved story");
  const variables: Record<string, unknown> = { ...saved.variablesState };
  for (const name of names) {
    if (variable(createInkState(story, 1), name) !== false) throw new Error(`no flag ${name}`);
    variables[name] = true;
  }
  return JSON.stringify({ ...saved, variablesState: variables });
}

describe("Mom's gift", () => {
  it("waits until the club is claimed", () => {
    const fresh = createInkState(story, 1);
    expect(play(fresh, "mom", [0]).lines[0])
      .toBe("Morning, sleepyhead! Blueberry pancakes are almost ready.");
    const breakfast = play(fresh, "mom", [0]).ink;
    expect(play(breakfast, "mom").lines).toEqual(["Have a good day, sweetie. Stay curious!"]);
  });

  it("is the microwave and the chest, once", () => {
    const claimed = storyWith("clubhouse_claimed");
    const gift = play(claimed, "mom");
    expect(gift.lines).toEqual([
      "Fae! A little bird told me you and your friends have a clubhouse now.",
      "Every clubhouse needs a kitchen. Take my old microwave!",
      "And the old toy chest from the hall, for your treasures.",
      "Thanks, Mom! Jordan and Sue can help me carry them up the ladder.",
      "There are dino nuggets and mac n cheese in the freezer. Take a box whenever you like!",
    ]);
    expect([variable(gift.ink, "has_microwave"), variable(gift.ink, "has_chest")])
      .toEqual([true, true]);
    // Then Mom is Mom again (here, before breakfast: this chain skipped it).
    expect(play(gift.ink, "mom").lines[0])
      .toBe("Morning, sleepyhead! Blueberry pancakes are almost ready.");
  });
});

describe("Mom's freezer", () => {
  const gifted = play(storyWith("clubhouse_claimed"), "mom").ink;

  it("is just the fridge before the microwave", () => {
    expect(play(createInkState(story, 1), "fridge").lines).toEqual([
      "The fridge is covered in drawings, shopping lists, and one very proud glittery family " +
      "photo.",
    ]);
  });

  it("gives a box at a time", () => {
    const open = play(gifted, "fridge", [0]);
    expect(open.choices[0]).toEqual(["Take the dino nuggets", "Take the mac n cheese",
      "Leave them"]);
    expect(open.lines).toEqual(["The freezer's full of dino nuggets and mac n cheese!",
      "A box of dino nuggets. Off to the clubhouse microwave!"]);
    expect(variable(open.ink, "has_nuggets")).toBe(true);
    // With a box in hand, no second one.
    const again = play(open.ink, "fridge");
    expect(again.choices).toEqual([]);
    expect(again.lines[0]).toBe("I've already got a box for the clubhouse microwave.");
    const mac = play(gifted, "fridge", [1]);
    expect([variable(mac.ink, "has_mac"), variable(mac.ink, "has_nuggets")])
      .toEqual([true, false]);
    const left = play(gifted, "fridge", [2]);
    expect([variable(left.ink, "has_mac"), variable(left.ink, "has_nuggets")])
      .toEqual([false, false]);
  });
});

describe("the keepsake chest", () => {
  it("is drawings on the wall until Mom's chest comes", () => {
    expect(play(storyWith("clubhouse_claimed"), "club_chest").lines).toEqual([
      "Drawings pinned to the wall: a kid with a big smile, and hearts and flowers.",
    ]);
  });

  it("holds the club's note, and whatever else Fae has found, oldest first", () => {
    const opened = "Fae lifts the lid of the old toy chest. Everything she's found on her " +
      "adventures is in here!";
    const note = "The note from under the comics: \"NEXT STOP: THE ARCADE. FIZZ THE HIGH " +
      "SCORES!\"";
    const closed = "Fae closes the lid gently.";
    expect(play(storyWith("clubhouse_claimed", "has_chest"), "club_chest").lines)
      .toEqual([opened, note, closed]);
    const everything = storyWith("clubhouse_claimed", "has_chest", "saw_hood", "stash_found",
      "pond_tin", "has_map", "kite_returned");
    // The pup's thread comes with his first calm talk (a visit to `pup_calm`).
    const thread = play(everything, "pup_calm").ink;
    expect(play(thread, "club_chest").lines).toEqual([
      opened,
      "The purple thread from the Pond Pup's tennis ball. It came from a purple hood!",
      note,
      "The purple marker the hooded kid dropped at school.",
      "The Star Racer token from the hooded kid's stash. I'll give it back when I find them!",
      "The old tin the Pond Pup fetched out of the park pond.",
      "The treasure map from the bottle by Sue's dock. X marked the spot!",
      "A bow from the tail of Rosie's kite. She gave it to me for getting it down!",
      closed,
    ]);
  });
});

describe("the kitchen in the clubhouse", () => {
  const shown = (id: string, ink: string): string => {
    const prop = world.areas.clubhouse?.props.find((item) => item.id === id);
    if (prop === undefined) throw new Error(`no ${id}`);
    return propStateName(world, ink, prop);
  };

  it("is there from Mom's gift: the microwave on the fridge, the chest by the wall", () => {
    const before = storyWith("clubhouse_claimed");
    const after = play(before, "mom").ink;
    expect([shown("microwave", before), shown("chest", before)]).toEqual(["default", "default"]);
    expect([shown("microwave", after), shown("chest", after)]).toEqual(["there", "there"]);
    const club = world.areas.clubhouse;
    const chest = club?.props.find((item) => item.id === "chest");
    const microwave = club?.props.find((item) => item.id === "microwave");
    if (chest === undefined || microwave === undefined) throw new Error("no kitchen props");
    expect(propState(world, before, chest).hidden).toBe(true);
    // The chest stands on the floor (solid); the microwave sits on the fridge,
    // sorted just in front of it.
    expect(propState(world, after, chest).footprint.length).toBe(1);
    expect(propState(world, after, microwave).footprint).toEqual([]);
    const fridge = club?.props.find((item) => item.id === "fridge");
    if (fridge === undefined) throw new Error("no fridge");
    const front = Math.max(...propState(world, after, fridge).front.ys);
    expect(Math.min(...propState(world, after, microwave).front.ys)).toBeGreaterThan(front);
  });
});

describe("the journal", () => {
  const notes = (ink: string): string[] => journalNotes(world,
    { ...createState(world, { area: "harness", spawn: "start", seed: 1 }), ink });

  it("tells of the freezer, the box in hand, and the chest", () => {
    const gifted = play(storyWith("clubhouse_claimed"), "mom").ink;
    expect(notes(gifted)).toEqual(expect.arrayContaining([
      "Mom's freezer has dino nuggets and mac n cheese for the clubhouse microwave.",
      "Mom gave our club her old toy chest. My treasures from my adventures are in it!",
    ]));
    const box = play(gifted, "fridge", [0]).ink;
    expect(notes(box)).toContain("I've got a box of dino nuggets. To the clubhouse microwave!");
    expect(notes(box)).not.toContain(
      "Mom's freezer has dino nuggets and mac n cheese for the clubhouse microwave.");
    expect(notes(storyWith("clubhouse_claimed")).join(" ")).not.toMatch(/microwave|chest/);
  });
});

describe("cooking a box", () => {
  const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
  // The harness with one look point running `knot`, straight ahead of its spawn.
  function roomWith(knot: string): { world: World; state: (ink: string) => State } {
    const harness = world.areas.harness;
    const spawn = harness?.spawns.start;
    if (harness === undefined || spawn === undefined) throw new Error("no harness");
    const room: Area = { ...harness, interactables: [
      { id: "here", knot, point: { x: spawn.x, y: spawn.y - 45 }, prompt: "Look" },
    ] };
    const testWorld: World = { ...world, areas: { ...world.areas, harness: room } };
    return {
      world: testWorld,
      state: (ink) => ({ ...createState(testWorld, { area: "harness", spawn: "start", seed: 1 }),
        facing: "up", ink }),
    };
  }
  // Talks it through with real ticks, picking `picks` in turn, until it closes.
  function converse(on: World, state: State, picks: number[]): State {
    let next = step(on, state, press({ confirm: true })).state;
    const queue = picks.slice();
    for (let count = 0; count < 900 && next.dialogue !== null; count += 1) {
      const dialogue = next.dialogue;
      if (dialogue.revealed >= dialogue.text.length && dialogue.choices.length > 0) {
        next = step(on, next, press({ choose: queue.shift() ?? 0 })).state;
        next = step(on, next, press({})).state;
      } else next = step(on, next, press({ confirm: count % 2 === 0 })).state;
    }
    return next;
  }

  it("opens the microwave as the talk closes, free, and uses the box up", () => {
    const box = storyWith("clubhouse_claimed", "has_microwave", "has_nuggets");
    const offered = play(box, "club_fridge");
    expect(offered.lines[0]).toBe("Mom's microwave is up on top of the fridge, ready to go!");
    expect(offered.choices[0]).toEqual(["Cook the dino nuggets", "Open the fridge"]);
    const kitchen = roomWith("club_fridge");
    const before = kitchen.state(box);
    const after = converse(kitchen.world, before, [0]);
    const open = after.arcade;
    expect(open?.game === "cook" ? [open.dish, open.phase] : null).toEqual(["nuggets", "ready"]);
    expect(after.coins).toBe(before.coins);
    // (The story reads numbers back as text.)
    expect([variable(after.ink, "has_nuggets"), variable(after.ink, "meals_cooked")])
      .toEqual([false, "1"]);
    // The mac n cheese opens its own dish.
    const mac = converse(kitchen.world, kitchen.state(storyWith("clubhouse_claimed",
      "has_microwave", "has_mac")), [0]);
    expect(mac.arcade?.game === "cook" ? mac.arcade.dish : null).toBe("mac");
  });

  it("leaves the fridge one choice away with a box in hand", () => {
    const box = storyWith("clubhouse_claimed", "has_microwave", "has_nuggets");
    const fridge = play(box, "club_fridge", [1]);
    expect(fridge.lines.slice(1)).toEqual([
      "An old fridge with its door hanging open. Inside, it's as warm as toast.",
      "Leave it to me! I keep the cooler on my dad's boat running.",
      "Sue wiggles the plug, gives the door a bump with her hip, and...",
      "Hummmm! The door clicks shut, the old fridge shivers, and a cool glow comes on.",
      "Ta-da! Cold and humming. Now the club needs something to keep in it.",
      "Jordan, didn't you bring seeds?",
    ]);
    expect(variable(fridge.ink, "has_nuggets")).toBe(true);
    // Before the first cook, without a box, the fridge points at Mom's freezer.
    expect(play(storyWith("clubhouse_claimed", "has_microwave"), "club_fridge").lines[0])
      .toBe("Mom's microwave is up on top. With a box from her freezer, I can cook!");
  });
});

