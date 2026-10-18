import { describe, expect, it } from "vitest";
import {
  battleParty,
  blankInput,
  createState,
  journalNotes,
  presentCritters,
  step,
  type ActionFrame,
  type PartyMember,
  type State,
  type Wild,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 60, a second flute friend. Once Fae has the flute, a
// calm Acorn Squirrel (the trail's) she gives a chin scratch and a snack is her
// friend (`squirrel_friend`), the way the Pond Pup's bond works. The flute
// calls either friend, or both, and sends either home; with only the pup a
// friend, its choices are what they were. The squirrel climbs: in the woods,
// he fetches a golden acorn and hazelnuts from the big oak's knothole.
const content = loadContent();
const world = content.world;
const story = world.story;
const facts = (snacks: number, calmed: Record<string, boolean> = {}): InkFacts =>
  ({ calmed, coins: 0, snacks, prizes: [], plushesLeft: 0, tickets: 0 });
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
// The flute from the music room's song, played for real (as in flute-friends).
const fresh = createInkState(story, 1);
const withFlute = play(fresh, "xylophone", [0, 1, 3, 0], facts(0, { "music-bird": true })).ink;
const metSquirrel = play(withFlute, "squirrel_calm").ink;
// A chin scratch, then a snack.
const squirrelFriend = play(metSquirrel, "squirrel_calm", [0, 0], facts(1)).ink;
// The pup a friend too, the flute run's way.
const metPup = play(squirrelFriend, "pup_calm").ink;
const bothFriends = play(metPup, "pup_calm", [0, 0], facts(1)).ink;

describe("the Acorn Squirrel's bond", () => {
  it("needs the flute: before it, his later talks are as they were", () => {
    const met = play(fresh, "squirrel_calm").ink;
    const again = play(met, "squirrel_calm");
    expect(again.lines).toEqual(["I'm saving my acorns for winter now. Nobody gets bonked!"]);
    expect(again.choices).toEqual([]);
  });

  it("is a chin scratch and a snack, in either order", () => {
    // A chin scratch, then a wave bye: not a friend yet.
    const first = play(metSquirrel, "squirrel_calm", [0, 1], facts(1));
    expect(first.choices).toEqual([["Scratch his chin", "Share a snack", "Wave bye"],
      ["Share a snack", "Wave bye"]]);
    expect(first.lines).toEqual([
      "I'm saving my acorns for winter now. Nobody gets bonked!",
      "Fae scratches under his chin. His eyes go all squinty and happy.",
      "Chitter!",
    ]);
    expect(variable(first.ink, "squirrel_friend")).toBe(false);
    const fed = play(metSquirrel, "squirrel_calm", [1, 0], facts(1));
    expect(fed.tags.flat()).toContain("feed: snack 1");
    expect(fed.lines.slice(-2)).toEqual([
      "The Acorn Squirrel hops right up onto Fae's shoe and chitters.",
      "He's my friend now! When I play my flute, he'll come scampering.",
    ]);
    expect(variable(fed.ink, "squirrel_friend")).toBe(true);
    expect(variable(squirrelFriend, "squirrel_friend")).toBe(true);
  });

  it("needs a snack to share", () => {
    const out = play(metSquirrel, "squirrel_calm", [1], facts(0));
    expect(out.lines.at(-1)).toBe(
      "I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries.");
    expect(variable(out.ink, "squirrel_fed")).toBe(false);
  });

  it("then greets Fae as a friend", () => {
    expect(play(squirrelFriend, "squirrel_calm").lines).toEqual([
      "Chitter! This squirrel flicks his tail at me like we're old friends. Word gets around!",
    ]);
  });
});

describe("the flute with two friends", () => {
  const flute = (ink: string, choices: number[] = []): Played => play(ink, "flute", choices);

  it("calls the squirrel alone when he's the only friend, and sends him home", () => {
    const call = flute(squirrelFriend, [0]);
    expect(call.choices[0]).toEqual(["Call the Acorn Squirrel", "Just play"]);
    expect(call.lines.at(-1))
      .toBe("Chitter-chitter! The Acorn Squirrel scampers down a tree and hops along!");
    expect(variable(call.ink, "squirrel_with_me")).toBe(true);
    const home = flute(call.ink, [0]);
    expect(home.choices[0]).toEqual(["Send the Acorn Squirrel home", "Just play"]);
    expect(variable(home.ink, "squirrel_with_me")).toBe(false);
  });

  it("offers each friend, the pup's first, and both can come along", () => {
    expect(flute(bothFriends).choices[0])
      .toEqual(["Call the Pond Pup", "Call the Acorn Squirrel", "Just play"]);
    const squirrel = flute(bothFriends, [1]).ink;
    expect(flute(squirrel).choices[0])
      .toEqual(["Call the Pond Pup", "Send the Acorn Squirrel home", "Just play"]);
    const both = flute(squirrel, [0]).ink;
    expect([variable(both, "pup_with_me"), variable(both, "squirrel_with_me")])
      .toEqual([true, true]);
    expect(flute(both).choices[0])
      .toEqual(["Send the Pond Pup home", "Send the Acorn Squirrel home", "Just play"]);
  });
});

describe("the squirrel along", () => {
  const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
  // Talks it through with real ticks, picking `picks` in turn, until it closes.
  function converse(state: State, picks: number[]): State {
    let next = state;
    const queue = picks.slice();
    for (let count = 0; count < 900 && next.dialogue !== null; count += 1) {
      const dialogue = next.dialogue;
      if (dialogue.revealed >= dialogue.text.length && dialogue.choices.length > 0) {
        next = step(world, next, press({ choose: queue.shift() ?? 0 })).state;
        next = step(world, next, press({})).state;
      } else next = step(world, next, press({ confirm: count % 2 === 0 })).state;
    }
    return next;
  }
  const fluted = (state: State, pick: number): State =>
    converse(step(world, state, press({ flute: true })).state, [pick]);

  it("is a flute friend of the squirrel kind with no battle command", () => {
    expect(world.party["acorn-squirrel"]).toMatchObject({ id: "acorn-squirrel",
      name: "Acorn Squirrel", atlas: "assets/characters/acorn-squirrel/acorn-squirrel.json",
      flute: true, critter: "squirrel", command: null, joins: "squirrel_with_me",
      start: false, sits: true });
  });

  it("is the calm trail squirrel right here, if there is one: it steps out of the area", () => {
    const trail = world.areas.trail;
    const spawn = trail?.spawns.pass;
    if (trail === undefined || spawn === undefined) throw new Error("no trail");
    const onTrail = { area: "trail", spawn: "pass", seed: 1, party: ["maddie", "sue"] };
    const start = createState(world, onTrail);
    const at = { x: start.player.x + 60, y: start.player.y + 40 };
    const squirrel: Wild = { kind: "squirrel", den: 0, mood: "calm", ...at, target: at,
      pauseTicks: 0, cooldownTicks: 0, facing: "down", moving: false, notice: 0 };
    const before: State = { ...start, ink: squirrelFriend, wild: [squirrel] };
    expect(presentCritters(world, before).filter((critter) => critter.wild !== null)
      .map((critter) => critter.kind.id)).toEqual(["squirrel"]);
    const called = fluted(before, 0);
    const friend = called.party.find((member) => member.id === "acorn-squirrel");
    expect(friend === undefined ? undefined : { x: friend.x, y: friend.y }).toEqual(at);
    expect(called.wild).toEqual([]);
    const home = fluted(called, 0);
    expect(home.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
  });

  it("sits battles out, like the pup", () => {
    const start = createState(world, { area: "harness", spawn: "start", seed: 1 });
    const maddie = start.party[0];
    if (maddie === undefined) throw new Error("no Maddie");
    const squirrel: PartyMember = { ...maddie, id: "acorn-squirrel" };
    const pup: PartyMember = { ...maddie, id: "pond-pup" };
    expect(battleParty(world, [maddie, squirrel, pup]).map((member) => member.id))
      .toEqual(["maddie"]);
  });
});

describe("the big oak's knothole", () => {
  it("is out of reach without him", () => {
    const look = play(fresh, "oak_knothole");
    expect(look.lines).toEqual([
      "High up the big oak, there's a dark knothole. Something rattles inside it when the " +
      "wind blows.",
      "It's much too high to climb, and too small for my hand.",
    ]);
    expect(variable(look.ink, "knothole_seen")).toBe(true);
  });

  it("gives up a golden acorn and hazelnuts to him, once", () => {
    const along = play(squirrelFriend, "flute", [0]).ink;
    const climb = play(along, "oak_knothole", [0]);
    expect(climb.choices[0]).toEqual(["Up you go!", "Not now"]);
    expect(climb.lines.slice(1)).toEqual([
      "Chitter! The Acorn Squirrel zips up the trunk and pops into the knothole.",
      "He scampers back down with a golden acorn, and a whole pile of hazelnuts!",
      "A golden acorn! It shines like a little sun.",
    ]);
    expect(climb.tags[2]).toContain("gift: snack 3");
    expect(play(climb.ink, "oak_knothole").lines)
      .toEqual(["The knothole high up the big oak is empty now."]);
  });

  it("is a look point at the oak's foot, in reach", () => {
    expect(world.areas.woods?.interactables.find((item) => item.id === "knothole"))
      .toMatchObject({ knot: "oak_knothole", point: { x: 400, y: 635 } });
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party)
      .filter((error) => error.startsWith("woods:"))).toEqual([]);
  }, 30_000);
});

describe("the journal and the chest", () => {
  const notes = (ink: string): string[] => journalNotes(world,
    { ...createState(world, { area: "harness", spawn: "start", seed: 1 }), ink });

  it("tells of the friend, the knothole, and the golden acorn", () => {
    expect(notes(squirrelFriend)).toContain(
      "The Acorn Squirrel is my friend! When I play my flute, he comes scampering.");
    const seen = play(squirrelFriend, "oak_knothole").ink;
    expect(notes(seen)).toContain(
      "There's a knothole high up the big oak in the woods. Something rattles inside!");
    const found = play(play(squirrelFriend, "flute", [0]).ink, "oak_knothole", [0]).ink;
    expect(notes(found)).toContain("The Acorn Squirrel climbed the big oak in the woods and " +
      "found a golden acorn in its knothole!");
    expect(notes(found).join(" ")).not.toContain("Something rattles");
  });
});
