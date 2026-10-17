import { describe, expect, it } from "vitest";
import {
  battleCommands,
  battleParty,
  blankInput,
  createState,
  feelingsOn,
  journalNotes,
  presentCritters,
  step,
  type ActionFrame,
  type Area,
  type PartyMember,
  type State,
  type Wild,
  type World,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import {
  loadContent,
  parsePartyMember,
  partyErrors,
  storyTagErrors,
} from "../../src/content/load";
import {
  combineInputFrames,
  gamepadFrame,
  GamepadLatch,
  type StandardGamepad,
} from "../../src/platform/gamepad";

// Contract for Milestone 47, flute friends. Once Fae has the flute, a calm
// Pond Pup she pets and shares a snack with is her friend (`pup_friend`). The
// flute (F) plays the `flute` knot: it calls him to her side (`pup_with_me`),
// where he follows like the party, or sends him home. A flute friend gives no
// battle command and sits battles out. In the park, he swims out into the pond
// and fetches an old tin of twelve coins.

const content = loadContent();
const world = content.world;
const story = world.story;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const facts = (snacks: number, calmed: Record<string, boolean> = {}): InkFacts =>
  ({ calmed, coins: 0, snacks });

type Played = { lines: string[]; tags: string[][]; choices: string[][]; ink: string };
function play(ink: string, knot: string, choices: number[] = [], with_ = facts(0)): Played {
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

// The flute comes from the music room's song (Milestone 38), played for real.
const fresh = createInkState(story, 1);
const withFlute = play(fresh, "xylophone", [0, 1, 3, 0], facts(0, { "music-bird": true })).ink;
// A first talk with a calm pup tells the purple thread; the bond is after it.
const metPup = play(withFlute, "pup_calm").ink;
const befriended = play(play(metPup, "pup_calm", [0], facts(1)).ink, "pup_calm", [0], facts(1)).ink;
const called = play(befriended, "flute", [0]).ink;

// Plays an open conversation through the core: confirm edges, and each choice
// in `picks` taken by index, the way a tap picks one.
function converse(state: State, picks: number[] = [], on: World = world): State {
  let next = state;
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

describe("the bond", () => {
  it("needs the flute: before it, a calm pup only wants to play fetch", () => {
    const before = play(play(fresh, "pup_calm").ink, "pup_calm");
    expect(before.lines).toEqual(["Woof! The Pond Pup wants to play fetch."]);
    expect(before.choices).toEqual([]);
  });

  it("is a pat and a snack, in either order", () => {
    const offer = play(metPup, "pup_calm", [2], facts(1));
    expect(offer.lines[0]).toBe("Woof! The Pond Pup wants to play fetch.");
    expect(offer.choices[0]).toEqual(["Pet him", "Share a snack", "Wave bye"]);
    const patFirst = play(metPup, "pup_calm", [0, 0, 1], facts(1));
    expect(patFirst.lines).toEqual([
      "Woof! The Pond Pup wants to play fetch.",
      "Fae scratches behind his floppy ears. His back leg thumps the ground.",
      "Fae shares a snack. Crunch, crunch, gone! He licks her nose.",
      "The Pond Pup's tail wags so hard that his whole body wiggles.",
      "He's my friend now! When I play my flute, he'll come running.",
    ]);
    // After the pat, only the snack and goodbye are left.
    expect(patFirst.choices[1]).toEqual(["Share a snack", "Wave bye"]);
    expect(patFirst.tags[2]).toContain("feed: snack 1");
    expect(variable(patFirst.ink, "pup_friend")).toBe(true);
    const snackFirst = play(metPup, "pup_calm", [1, 0], facts(1));
    expect(variable(snackFirst.ink, "pup_friend")).toBe(true);
    // A friend's pups greet Fae from then on.
    expect(play(patFirst.ink, "pup_calm").lines)
      .toEqual(["Woof! This pup wags at me like we're old friends. Word gets around!"]);
  });

  it("can't share a snack Fae doesn't have, and keeps a half-made bond", () => {
    const out = play(metPup, "pup_calm", [1], facts(0));
    expect(out.lines.at(-1)).toBe("I'm out of snacks. The bakery sells them, and the " +
      "clubhouse garden grows strawberries.");
    expect(variable(out.ink, "pup_fed")).toBe(false);
    const petted = play(metPup, "pup_calm", [0, 1], facts(0));
    expect(variable(petted.ink, "pup_petted")).toBe(true);
    expect(variable(petted.ink, "pup_friend")).toBe(false);
    // Next time, with a snack: just the snack is left to give.
    const later = play(petted.ink, "pup_calm", [0], facts(1));
    expect(later.choices[0]).toEqual(["Share a snack", "Wave bye"]);
    expect(variable(later.ink, "pup_friend")).toBe(true);
  });

  it("takes the snack through the core as the line is shown", () => {
    const room = roomWith("pup_calm");
    const start = room.state(metPup);
    const snacks = start.snacks;
    const open = step(room.world, start, press({ confirm: true })).state;
    expect(open.dialogue?.choices).toEqual(["Pet him", "Share a snack", "Wave bye"]);
    const done = converse(open, [1, 0], room.world);
    expect(done.snacks).toBe(snacks - 1);
    expect(variable(done.ink, "pup_friend")).toBe(true);
  });
});

describe("the flute", () => {
  it("plays its knot on F once Fae has it, and not before", () => {
    const at = (ink: string): State =>
      ({ ...createState(world, { area: "harness", spawn: "start", seed: 1 }), ink });
    expect(step(world, at(fresh), press({ flute: true })).state.dialogue).toBeNull();
    const played = step(world, at(withFlute), press({ flute: true })).state;
    expect(played.dialogue?.knot).toBe("flute");
    expect(played.dialogue?.text).toBe("Fae plays a little tune on her painted flute.");
    expect(played.dialogue?.sound).toBe("flute");
    // Held from before, it doesn't play again: only a press does.
    const held = { ...at(withFlute), previousInput: press({ flute: true }) };
    expect(step(world, held, press({ flute: true })).state.dialogue).toBeNull();
  });

  it("calls nobody before Fae has a friend", () => {
    expect(play(withFlute, "flute").lines).toEqual([
      "Fae plays a little tune on her painted flute.",
      "Nobody comes... yet. Animal friends come running, Ms. Willow said. I need to make " +
      "one first!",
    ]);
  });

  it("calls the Pond Pup, then sends him home", () => {
    const call = play(befriended, "flute", [0]);
    expect(call.choices[0]).toEqual(["Call the Pond Pup", "Just play"]);
    expect(call.lines.at(-1)).toBe("Woof! Woof! The Pond Pup comes running!");
    expect(variable(call.ink, "pup_with_me")).toBe(true);
    const home = play(call.ink, "flute", [0]);
    expect(home.choices[0]).toEqual(["Send the Pond Pup home", "Just play"]);
    expect(home.lines.at(-1)).toBe("Good boy! The Pond Pup trots off home, wagging.");
    expect(variable(home.ink, "pup_with_me")).toBe(false);
    expect(variable(play(befriended, "flute", [1]).ink, "pup_with_me")).toBe(false);
  });
});

describe("a flute friend", () => {
  const ids = (state: State): string[] => state.party.map((member) => member.id);
  const fluted = (state: State, pick: number): State =>
    converse(step(world, state, press({ flute: true })).state, [pick]);

  it("is a party member with no battle command, joined and sent home by its variable", () => {
    expect(world.party["pond-pup"]).toMatchObject({
      id: "pond-pup", name: "Pond Pup", atlas: "assets/characters/pond-pup/pond-pup.json",
      sits: true, start: false, joins: "pup_with_me", flute: true, command: null,
    });
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("no pass-party fixture");
    const start: State = { ...createState(world, fixture), ink: befriended };
    expect(ids(start)).toEqual(["maddie", "sue"]);
    const with_ = fluted(start, 0);
    expect(ids(with_)).toEqual(["maddie", "sue", "pond-pup"]);
    // He follows: Fae walks (whichever way is open), and he walks after her.
    const pup = (state: State): PartyMember | undefined =>
      state.party.find((member) => member.id === "pond-pup");
    const ways = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const walks = ways.map((move) => {
      let walked = with_;
      for (let tick = 0; tick < 120; tick += 1) walked = step(world, walked, press({ move })).state;
      return walked;
    });
    const far = (state: State): number =>
      Math.hypot(state.player.x - with_.player.x, state.player.y - with_.player.y);
    const walked = walks.find((state) => far(state) > 120);
    if (walked === undefined) throw new Error("Fae can't walk anywhere here");
    const moved = (state: State): number => {
      const before = pup(with_); const after = pup(state);
      if (before === undefined || after === undefined) return 0;
      return Math.hypot(after.x - before.x, after.y - before.y);
    };
    expect(moved(walked)).toBeGreaterThan(60);
    const home = fluted(walked, 0);
    expect(ids(home)).toEqual(["maddie", "sue"]);
    // The fixture's Sue never had her join variable set: only a flute friend
    // leaves with its variable.
    expect(world.storyVariable(home.ink, "sue_joined")).toBe(false);
  });

  it("is the calm pup right here, if there is one: it steps out of the area", () => {
    const park = world.areas.park;
    const spawn = park?.spawns["plaza-path"];
    if (park === undefined || spawn === undefined) throw new Error("no park");
    const at = { x: spawn.x + 120, y: spawn.y - 60 };
    const pup: Wild = { kind: "pup", den: 0, mood: "calm", ...at, target: at, pauseTicks: 0,
      cooldownTicks: 0, facing: "down", moving: false };
    const inPark = { area: "park", spawn: "plaza-path", seed: 1, party: ["maddie", "sue"] };
    const start: State = { ...createState(world, inPark), ink: befriended, wild: [pup] };
    expect(presentCritters(world, start).map((critter) => critter.key)).toEqual(["wild:0"]);
    const called = fluted(start, 0);
    const friend = called.party.find((member) => member.id === "pond-pup");
    expect(friend === undefined ? undefined : { x: friend.x, y: friend.y }).toEqual(at);
    expect(called.wild).toEqual([]);
    expect(presentCritters(world, called)).toEqual([]);
    // A chaos pup isn't him: he comes running from elsewhere, and it stays.
    const chaos: State = { ...start, wild: [{ ...pup, mood: "chaos" }] };
    const along = fluted(chaos, 0);
    expect(along.party.map((member) => member.id)).toContain("pond-pup");
    expect(along.wild.map((item) => item.mood)).toEqual(["chaos"]);
  });

  it("sits battles out: no command, and not in the battle party", () => {
    const loaded = loadContent();
    const frog = loaded.world.critters["fountain-frog"];
    const plaza = loaded.world.areas.plaza;
    const fixture = loaded.fixtures.plaza;
    if (frog === undefined || plaza === undefined || fixture === undefined)
      throw new Error("content missing");
    const testWorld: World = { ...loaded.world,
      critters: { ...loaded.world.critters, "test-frog": { ...frog, id: "test-frog" } },
      areas: { ...loaded.world.areas, plaza: { ...plaza,
        critters: [...plaza.critters, { id: "test-frog", point: { x: 500, y: 850 } }] } } };
    const meet = (party: PartyMember[]): State => step(testWorld,
      { ...createState(testWorld, fixture), party, player: { x: 574, y: 850 } },
      press({ move: { x: -1, y: 0 } })).state;
    const base = createState(testWorld, fixture).party;
    const first = base[0];
    if (first === undefined) throw new Error("no party");
    const withPup = [...base, { ...first, id: "pond-pup" }];
    const alone = meet(base);
    const along = meet(withPup);
    expect(along.battle).not.toBeNull();
    expect(battleCommands(testWorld, along)).toEqual(battleCommands(testWorld, alone));
    expect(battleParty(testWorld, along.party).map((member) => member.id))
      .toEqual(base.map((member) => member.id));
  });

  it("doesn't count toward feelings: Maddie and the Pond Pup are one fighter", () => {
    const start = createState(world, { area: "harness", spawn: "start", seed: 1 });
    const maddie = start.party[0];
    if (maddie === undefined) throw new Error("no Maddie");
    const pup: PartyMember = { ...maddie, id: "pond-pup" };
    const sue: PartyMember = { ...maddie, id: "sue" };
    expect(feelingsOn(world, { ...start, party: [maddie, pup] })).toBe(false);
    expect(feelingsOn(world, { ...start, party: [maddie, sue] })).toBe(true);
    expect(feelingsOn(world, { ...start, party: [maddie, sue, pup] })).toBe(true);
  });
});

describe("the pond", () => {
  it("glints out of reach until the Pond Pup is along, then he fetches the tin", () => {
    const look = play(befriended, "pond");
    expect(look.lines).toEqual([
      "The pond is cool and clear. Something glints at the bottom, out past the middle rock.",
      "It's too far to reach, and too cold to wade in.",
    ]);
    expect(variable(look.ink, "pond_seen")).toBe(true);
    const fetch = play(called, "pond", [0]);
    expect(fetch.choices[0]).toEqual(["Fetch, boy!", "Not now"]);
    expect(fetch.lines.slice(1)).toEqual([
      "Splash! The Pond Pup paddles out past the rock and dives.",
      "He swims back with an old tin in his mouth. Inside: twelve shiny coins, and a note " +
      "that says \"For whoever finds this!\"",
      "Good boy! Pond Pups really can swim.",
    ]);
    expect(fetch.tags[2]).toContain("gift: coins 12");
    expect(play(fetch.ink, "pond").lines)
      .toEqual(["The pond is cool and clear. Nothing glints at the bottom now."]);
    // Not now leaves it there.
    expect(variable(play(called, "pond", [1]).ink, "pond_tin")).toBe(false);
  });

  it("pays the twelve coins through the core", () => {
    const room = roomWith("pond");
    const start = room.state(called);
    const done = converse(step(room.world, start, press({ confirm: true })).state, [0], room.world);
    expect(done.coins).toBe(start.coins + 12);
    expect(variable(done.ink, "pond_tin")).toBe(true);
  });

  it("is a look point at the park pond's south rim", () => {
    const pond = world.areas.park?.interactables.find((item) => item.id === "pond");
    expect(pond).toEqual({ id: "pond", knot: "pond", point: { x: 930, y: 838 }, prompt: "Look" });
  });
});

describe("the journal", () => {
  const notes = (ink: string): string[] => journalNotes(world,
    { ...createState(world, { area: "harness", spawn: "start", seed: 1 }), ink });

  it("tells of the friend, the glint, and the tin, newest first", () => {
    expect(notes(befriended)[0])
      .toBe("The Pond Pup is my friend! When I play my flute, he comes running.");
    const seen = play(befriended, "pond").ink;
    expect(notes(seen).slice(0, 2)).toEqual([
      "Something glints at the bottom of the park pond, too far out to reach.",
      "The Pond Pup is my friend! When I play my flute, he comes running.",
    ]);
    const found = play(play(seen, "flute", [0]).ink, "pond", [0]).ink;
    expect(notes(found).slice(0, 2)).toEqual([
      "The Pond Pup swam out into the park pond and fetched an old tin of coins!",
      "The Pond Pup is my friend! When I play my flute, he comes running.",
    ]);
  });
});

describe("the content rules", () => {
  const pup = {
    id: "pup", name: "Pup", atlas: "a.json", box: { width: 40, height: 50 },
    walkCycleUnits: 84, sits: true, start: false, joins: "pup_with_me", flute: true,
    command: null,
  };
  const command = { id: "bark", label: "Bark", resting: "napping",
    check: { kind: "ring", ticks: 60, targetTick: 39, greatWindow: 5, goodWindow: 11 } };

  it("gives a flute friend no command and a joins variable, and everyone else a command", () => {
    expect(parsePartyMember(pup, "pup.json").command).toBeNull();
    expect(() => parsePartyMember({ ...pup, command }, "pup.json")).toThrow(/command/);
    expect(() => parsePartyMember({ ...pup, joins: null, start: true }, "pup.json"))
      .toThrow(/flute\/joins/);
    const friend = { id: "friend", name: "Friend", atlas: "f.json", box: { width: 40, height: 50 },
      walkCycleUnits: 84, sits: false, start: false, joins: "friend_joined", command: null };
    expect(() => parsePartyMember(friend, "friend.json")).toThrow(/command/);
    expect(parsePartyMember({ ...friend, command }, "friend.json").flute).toBe(false);
  });

  it("lets only a flute friend be a critter kind, and only a real one", () => {
    expect(parsePartyMember({ ...pup, critter: "pup" }, "pup.json").critter).toBe("pup");
    expect(parsePartyMember(pup, "pup.json").critter).toBeNull();
    const friend = { ...pup, flute: false, command, critter: "pup" };
    expect(() => parsePartyMember(friend, "friend.json")).toThrow(/critter/);
    const ghost = parsePartyMember({ ...pup, critter: "ghost" }, "pup.json");
    expect(partyErrors({ [ghost.id]: ghost }, world.critters))
      .toEqual(["party pup: no critter ghost"]);
    expect(world.party["pond-pup"]?.critter).toBe("pup");
  });

  it("allows coins as a gift, and feeds only whole snacks", () => {
    expect(storyTagErrors(["gift: coins 12", "feed: snack 1"], {})).toEqual([]);
    const wrong = ["gift: coins 0", "feed: snack 0", "feed: coins 2", "feed: snack"];
    expect(storyTagErrors(wrong, {})).toEqual([
        'invalid gift tag "gift: coins 0"',
        'invalid feed tag "feed: snack 0"',
        'invalid feed tag "feed: coins 2"',
        'invalid feed tag "feed: snack"',
      ]);
  });
});

describe("the flute's input", () => {
  const pad = (buttons: number[]): StandardGamepad => ({
    mapping: "standard",
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, index) =>
      ({ pressed: buttons.includes(index), value: buttons.includes(index) ? 1 : 0 })),
  });

  it("is the gamepad's right shoulder, present only while pressed", () => {
    expect(gamepadFrame([pad([5])]).flute).toBe(true);
    expect("flute" in combineInputFrames(blankInput(), blankInput(), gamepadFrame([pad([])])))
      .toBe(false);
    expect(combineInputFrames(blankInput(), blankInput(), gamepadFrame([pad([5])])).flute)
      .toBe(true);
    const latch = new GamepadLatch();
    latch.update({ ...blankInput(), flute: true });
    latch.update(blankInput());
    expect(latch.frame().flute).toBe(true);
    expect(latch.frame().flute).toBeUndefined();
  });
});
