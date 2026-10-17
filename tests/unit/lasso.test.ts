import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  journalNotes,
  propCovers,
  propState,
  propStateName,
  step,
  type ActionFrame,
  type Area,
  type State,
  type World,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { areaConnectionErrors, hiddenPositions } from "../../src/content/area-checks";
import { loadContent, storyTagErrors } from "../../src/content/load";
import { parsePropCatalogue } from "../../src/content/props";

// Contract for Milestone 49, lasso spots. Once Fae has Coach Ash's lasso,
// three things are stuck out of reach in places she knows: Rosie's kite on the
// park's play tower, a bottle with a treasure map past the end of Sue's dock,
// and the cocoa seller's scarf on a ski-lift chair. Each is an added prop, cut
// from an edit of its area's painting: hidden by default, shown once Fae has
// the lasso, and hidden again once it's lassoed down.

const content = loadContent();
const world = content.world;
const story = world.story;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const facts = (coins = 0, snacks = 0): InkFacts =>
  ({ calmed: {}, coins, snacks, prizes: [], plushesLeft: 0, tickets: 0 });

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
const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);

// The lasso comes from Coach Ash, for real: the stopwatch's pup calm, the
// clipboard seen on the hoop, then his lend.
const fresh = createInkState(story, 1);
const pupCalm: InkFacts = { ...facts(), calmed: { "gym-pup": true } };
const quest = play(fresh, "coach", [0], pupCalm).ink;
const seen = play(quest, "hoop", [], pupCalm).ink;
const withLasso = play(seen, "coach", [], pupCalm).ink;

describe("the lasso", () => {
  it("comes from Coach Ash before any of this", () => {
    expect(variable(fresh, "has_lasso")).toBe(false);
    expect(variable(withLasso, "has_lasso")).toBe(true);
  });
});

describe("Rosie's kite", () => {
  it("is just the play tower before the lasso", () => {
    expect(play(fresh, "tower").lines)
      .toEqual(["The play tower, with its patched flag flapping on top."]);
  });

  it("comes down with the lasso, and goes back to Rosie for her arcade coins", () => {
    const look = play(withLasso, "tower", [0]);
    expect(look.choices[0]).toEqual(["Lasso it down", "Leave it"]);
    expect(look.lines).toEqual([
      "A kite is caught on top of the play tower, hanging down the wall!",
      "Fae twirls the lasso once, twice... and loops it right over the kite's string.",
      "A gentle tug, and the kite flutters down into Fae's arms.",
      "There's a name on the crossbar, in green marker: ROSIE. Rosie from my class!",
      "I'll take it back to her at school.",
    ]);
    expect(variable(look.ink, "kite_down")).toBe(true);
    expect(play(look.ink, "tower").lines)
      .toEqual(["The play tower, with its patched flag flapping on top."]);
    // Rosie, after her first talk (the hood), gets her kite back.
    const met = play(look.ink, "rosie").ink;
    const back = play(met, "rosie");
    expect(back.lines).toEqual([
      "My kite! The wind snatched it right out of my hands at the park.",
      "You're the best, Fae! Here, take my arcade coins. All six of them!",
    ]);
    expect(back.tags[1]).toContain("gift: coins 6");
    expect(variable(back.ink, "kite_returned")).toBe(true);
    expect(play(back.ink, "rosie").lines[0]).not.toContain("My kite!");
  });

  it("stays up if Fae leaves it", () => {
    const left = play(withLasso, "tower", [1]);
    expect(variable(left.ink, "kite_down")).toBe(false);
    expect(variable(left.ink, "kite_seen")).toBe(true);
  });
});

describe("the bottle by the dock", () => {
  it("is just the dock's end before the lasso", () => {
    expect(play(fresh, "dock_end").lines)
      .toEqual(["The end of Sue's dock. The water sparkles all the way to the sky."]);
    expect(play(fresh, "palms").lines)
      .toEqual(["Two palm trees lean together beside the big driftwood log."]);
  });

  it("holds a treasure map, and X marks the spot between the palms", () => {
    const reel = play(withLasso, "dock_end", [0]);
    expect(reel.lines).toEqual([
      "A bottle is bobbing in the water past the end of the dock! There's a rolled-up paper " +
      "inside.",
      "Fae loops the lasso around the bottle's neck and reels it in, hand over hand.",
      "She pulls out the cork. The paper is an old treasure map!",
      "Two palm trees, a big log, and an X right between them. That's the beach, by the big " +
      "driftwood log!",
    ]);
    expect(variable(reel.ink, "has_map")).toBe(true);
    const dig = play(reel.ink, "palms", [0]);
    expect(dig.choices[0]).toEqual(["Dig", "Not now"]);
    expect(dig.lines).toEqual([
      "X marks the spot: right here, between the two palms!",
      "Fae borrows a spade from the beach toys and digs, and digs...",
      "Clunk! A little tin chest, full of shiny gold coins!",
      "Real pirate treasure! Wait till I tell Sue.",
    ]);
    expect(dig.tags[2]).toContain("gift: coins 20");
    expect(play(dig.ink, "palms").lines)
      .toEqual(["The sand between the palms is all smoothed back over."]);
    expect(play(dig.ink, "dock_end").lines)
      .toEqual(["The end of Sue's dock. The water sparkles all the way to the sky."]);
  });
});

describe("the cocoa seller's scarf", () => {
  it("is just the ski lift before the lasso", () => {
    expect(play(fresh, "ski_lift").lines)
      .toEqual(["The ski lift creaks along its cable, the empty chairs swinging."]);
    expect(play(fresh, "cocoa_stand", [], facts(0)).lines).toEqual([
      "The cocoa stand steams beside the snowy trail.",
      "A mug of cocoa costs 5 coins. Maybe calm a critter first?",
    ]);
  });

  it("is missed at the stand, lassoed off the chair, and given back for free cocoa", () => {
    expect(play(withLasso, "cocoa_stand", [], facts(0)).lines[1])
      .toBe("The wind blew my favourite scarf right onto the ski lift! Brrr.");
    const down = play(withLasso, "ski_lift", [0]);
    expect(down.lines).toEqual([
      "A long red scarf is caught on the pink lift chair, flapping in the wind.",
      "Fae aims, throws... and the lasso loops right over the dangling scarf.",
      "One tug, and the scarf slips free. It's soft and warm, and it smells like cocoa.",
    ]);
    expect(variable(down.ink, "scarf_down")).toBe(true);
    const back = play(down.ink, "cocoa_stand", [], facts(0));
    expect(back.lines).toEqual([
      "My scarf! You got it down from the ski lift?",
      "Thank you, Fae! A mug of cocoa, on the house.",
    ]);
    expect(back.tags[1]).toContain("gift: snack 1");
    // Then the stand sells as ever, with no word of the scarf.
    expect(play(back.ink, "cocoa_stand", [1], facts(5)).lines).toEqual([
      "The cocoa stand steams beside the snowy trail.",
      "All right! Stay cozy out there.",
    ]);
  });
});

describe("the stuck things in the scenery", () => {
  const shown = (area: string, id: string, ink: string): string => {
    const prop = world.areas[area]?.props.find((item) => item.id === id);
    if (prop === undefined) throw new Error(`no ${id} in ${area}`);
    return propStateName(world, ink, prop);
  };

  it("are hidden until Fae has the lasso, and gone once they're down", () => {
    expect([shown("park", "kite", fresh), shown("bay", "bottle", fresh),
      shown("pass", "scarf", fresh)]).toEqual(["default", "default", "default"]);
    expect([shown("park", "kite", withLasso), shown("bay", "bottle", withLasso),
      shown("pass", "scarf", withLasso)]).toEqual(["stuck", "bobbing", "stuck"]);
    const down = play(play(play(withLasso, "tower", [0]).ink, "dock_end", [0]).ink,
      "ski_lift", [0]).ink;
    expect([shown("park", "kite", down), shown("bay", "bottle", down),
      shown("pass", "scarf", down)]).toEqual(["default", "default", "default"]);
    for (const [area, id] of [["park", "kite"], ["bay", "bottle"], ["pass", "scarf"]] as const) {
      const prop = world.areas[area]?.props.find((item) => item.id === id);
      if (prop === undefined) throw new Error(`no ${id}`);
      expect(propState(world, fresh, prop).hidden).toBe(true);
      expect(propState(world, withLasso, prop).hidden).toBe(false);
      expect(propState(world, withLasso, prop).footprint).toEqual([]);
    }
  });

  it("hide nobody while hidden, and are drawn where their paintings put them", () => {
    const kite = world.areas.park?.props.find((item) => item.id === "kite");
    if (kite === undefined) throw new Error("no kite");
    const hidden = propState(world, fresh, kite);
    const stuck = propState(world, withLasso, kite);
    // Hanging on the tower's front wall, the kite draws over someone behind
    // the tower, where the kite is: and while it's hidden, over nobody.
    const feet = { x: 1015, y: 470 };
    expect(propCovers(hidden, feet, { width: 40, height: 140 })).toBe(0);
    expect(propCovers(stuck, feet, { width: 40, height: 140 })).toBeGreaterThan(0);
    // It sorts with the tower: its home's y (the tower's foot, 570) everywhere.
    expect(new Set(stuck.front.ys)).toEqual(new Set([570]));
  });

  it("pass the area checks: the look points within reach, nobody hidden", () => {
    const look = (area: string): [string, string][] =>
      (world.areas[area]?.interactables ?? []).map((item) => [item.id, item.knot]);
    expect(look("park")).toContainEqual(["tower", "tower"]);
    expect(look("bay")).toEqual(expect.arrayContaining([["dock-end", "dock_end"],
      ["palms", "palms"]]));
    expect(look("pass")).toContainEqual(["ski-lift", "ski_lift"]);
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party)
      .filter((error) => /^(park|bay|pass):/.test(error))).toEqual([]);
    for (const id of ["park", "bay", "pass"]) {
      const area: Area | undefined = world.areas[id];
      if (area === undefined) throw new Error(`no ${id}`);
      expect(hiddenPositions(area, world.tunables.playerRadius), id).toEqual([]);
    }
  }, 30_000);
});

describe("the hidden prop state", () => {
  const base = { canopy: false, painted: false, home: [0, 0], states: {} };
  const drawn = { frame: "f", shadow: null, footprint: [],
    silhouette: { left: 0, step: 5, columns: ["0 10"] } };

  it("is only ever { hidden: true }, and a prop must be there in some state", () => {
    const ok = parsePropCatalogue({ atlases: [], props: { kite: { ...base,
      states: { default: { hidden: true }, stuck: drawn } } } }, "kite.json");
    expect(ok.props.kite?.states.default?.hidden).toBe(true);
    expect(ok.props.kite?.states.stuck?.hidden).toBe(false);
    expect(() => parsePropCatalogue({ atlases: [], props: { kite: { ...base,
      states: { default: { hidden: true, frame: "f" }, stuck: drawn } } } }, "kite.json"))
      .toThrow(/hidden state/);
    expect(() => parsePropCatalogue({ atlases: [], props: { kite: { ...base,
      states: { default: { hidden: true } } } } }, "kite.json"))
      .toThrow(/never there/);
  });
});

describe("the rewards, through the core", () => {
  // A room with one look point running `knot`, straight ahead of the spawn.
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

  it("pays the treasure's twenty coins and the cocoa seller's snack", () => {
    const map = play(withLasso, "dock_end", [0]).ink;
    const palms = roomWith("palms");
    const start = palms.state(map);
    expect(converse(palms.world, start, [0]).coins).toBe(start.coins + 20);
    const down = play(withLasso, "ski_lift", [0]).ink;
    const stand = roomWith("cocoa_stand");
    const before = stand.state(down);
    expect(converse(stand.world, before, []).snacks).toBe(before.snacks + 1);
  });

  it("allows coins as a gift, and only whole ones", () => {
    expect(storyTagErrors(["gift: coins 20", "gift: coins 6"], {})).toEqual([]);
    expect(storyTagErrors(["gift: coins 0"], {})).toEqual(['invalid gift tag "gift: coins 0"']);
  });
});

describe("the journal", () => {
  const notes = (ink: string): string[] => journalNotes(world,
    { ...createState(world, { area: "harness", spawn: "start", seed: 1 }), ink });

  it("tells each errand once it's been seen, then how it ended", () => {
    const kiteSeen = play(withLasso, "tower", [1]).ink;
    expect(notes(kiteSeen)).toContain(
      "A kite is tangled on top of the park's play tower. My lasso could reach it!");
    const kiteDown = play(kiteSeen, "tower", [0]).ink;
    expect(notes(kiteDown)).toContain(
      "I got Rosie's kite down from the play tower. I should take it back to her at school.");
    const bottleSeen = play(kiteDown, "dock_end", [1]).ink;
    expect(notes(bottleSeen))
      .toContain("A bottle with a paper inside is bobbing past the end of Sue's dock.");
    const found = play(play(bottleSeen, "dock_end", [0]).ink, "palms", [0]).ink;
    expect(notes(found)).toContain("I dug up pirate treasure on the beach!");
    const scarfDown = play(found, "ski_lift", [0]).ink;
    expect(notes(scarfDown))
      .toContain("I got a red scarf down from the ski lift. It smells like cocoa...");
    const done = play(play(play(scarfDown, "cocoa_stand").ink, "rosie").ink, "rosie").ink;
    const all = notes(done);
    expect(all).toEqual(expect.arrayContaining([
      "I lassoed Rosie's kite down from the park's play tower, and she gave me her arcade coins!",
      "I dug up pirate treasure on the beach!",
      "I lassoed the cocoa seller's scarf off the ski lift. Free cocoa!",
    ]));
    expect(all.join(" ")).not.toContain("tangled");
    // Nothing of it before the lasso.
    expect(notes(fresh).join(" ")).not.toMatch(/kite|bottle|scarf|treasure/);
  });
});
