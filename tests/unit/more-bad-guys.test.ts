import { describe, expect, it } from "vitest";
import {
  createState,
  journalNotes,
  nextRandom,
  presentCritters,
  rollWild,
  type State,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 69, more bad guys. Two new casual species join the
// thinnest lands through dens of their own, gated on a `calmed()` fact no
// recorded run has at any arrival in their area, so the golden chain replays
// unchanged: the bay's crabs wait for its lifeguard and the pass's penguins
// for the lodge keeper. A new people mini-boss, the principal, waits behind
// a megaphone read: like Ms. Rowan, he is out only once the story says so.

const content = loadContent();
const world = content.world;
const story = world.story;

const facts = (calmed: Record<string, boolean> = {}): InkFacts =>
  ({ calmed, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 });
type Played = { lines: string[]; ink: string };
function play(ink: string, knot: string, with_ = facts()): Played {
  const lines: string[] = [];
  let result = runInk(story, ink, { type: "start", knot }, with_);
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.ended) break;
    result = runInk(story, result.ink, result.choices.length > 0
      ? { type: "choose", index: 0 } : { type: "next" }, with_);
  }
  return { lines, ink: result.ink };
}
const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);
const fresh = createInkState(story, 1);

const bay = world.areas.bay;
const pass = world.areas.pass;
const school = world.areas.school;
if (bay === undefined || pass === undefined || school === undefined)
  throw new Error("bay, pass, or school area missing");

const bayBase = createState(world, { area: "bay", spawn: "trail", seed: 5 });
const passBase = createState(world, { area: "pass", spawn: "trail", seed: 5 });

describe("a den gated on its own calm fact", () => {
  it("the bay's crab den draws nothing until the lifeguard is calm", () => {
    if (bay.recurring === undefined) throw new Error("bay has no dens");
    expect(bay.recurring.dens.length).toBe(3);
    expect(bay.recurring.dens[2]?.kinds).toEqual(["crab"]);
    expect(bay.recurring.dens[2]?.after).toBe("lifeguard");

    // Gated shut: only the bluebird and frog dens draw, four draws in all,
    // and no crab is out.
    const shut = rollWild(world, bayBase, bay);
    let expected = bayBase;
    for (let draw = 0; draw < 4; draw += 1) expected = nextRandom(expected)[1];
    expect(shut.rng).toBe(expected.rng);
    expect(shut.wild.every((critter) => critter.kind !== "crab")).toBe(true);

    // The two dens before it roll exactly what they rolled before the crab
    // den existed, whatever the gate.
    const open = rollWild(world,
      { ...bayBase, critters: { ...bayBase.critters, lifeguard: "calm" } }, bay);
    const firstTwo = (rolled: ReturnType<typeof rollWild>): string[] =>
      rolled.wild.filter((critter) => critter.den < 2).map((critter) => critter.kind);
    expect(firstTwo(open)).toEqual(firstTwo(shut));
    // Open: six draws now (a gated den skips none of its own once it's due).
    let spent = bayBase;
    for (let draw = 0; draw < 6; draw += 1) spent = nextRandom(spent)[1];
    // Open: the crab den draws too, six draws in all, and it draws the same
    // six whatever the rolls before it came out as.
    expect(open.rng).toBe(spent.rng);
  });

  it("the pass's penguin den draws nothing until the lodge keeper is calm", () => {
    if (pass.recurring === undefined) throw new Error("pass has no dens");
    expect(pass.recurring.dens.length).toBe(3);
    expect(pass.recurring.dens[2]?.kinds).toEqual(["penguin"]);
    expect(pass.recurring.dens[2]?.after).toBe("lodge-keeper");

    const shut = rollWild(world, passBase, pass);
    let expected = passBase;
    for (let draw = 0; draw < 4; draw += 1) expected = nextRandom(expected)[1];
    expect(shut.rng).toBe(expected.rng);
    expect(shut.wild.every((critter) => critter.kind !== "penguin")).toBe(true);
    const open = rollWild(world,
      { ...passBase, critters: { ...passBase.critters, "lodge-keeper": "calm" } }, pass);
    expect(open.wild.some((critter) => critter.kind === "penguin")).toBe(true);
  });

  it("the dens stay appended last, so the golden replays' draws are a prefix", () => {
    // The recorded runs' PRNG streams only stay exact if the new dens are the
    // last in their areas and gated shut for them.
    expect(bay.recurring?.dens[2]?.after).toBeDefined();
    expect(pass.recurring?.dens[2]?.after).toBeDefined();
  });
});

describe("the principal behind the megaphone", () => {
  const schoolBase: State = createState(world, { area: "school", spawn: "front-doors", seed: 5 });

  it("the megaphone read brings him out, and only then", () => {
    expect(presentCritters(world, schoolBase).some((c) => c.key === "principal"))
      .toBe(false);
    const read = play(fresh, "megaphone");
    expect(read.lines).toEqual([
      "A silver megaphone leans against the lockers, fizzing tiny purple bubbles.",
      "Somebody shouts \"GOOD MORNING, CLOVERHOLLOW!\" and the principal marches out!",
    ]);
    const out: State = { ...schoolBase, ink: read.ink };
    expect(variable(read.ink, "principal_out")).toBe(true);
    expect(presentCritters(world, out).some((c) => c.key === "principal")).toBe(true);
    // Reading it again says so, without resummoning anything.
    expect(play(read.ink, "megaphone").lines).toEqual([
      "Mr. Bell is stomping up and down the hall, announcing EVERYTHING at once!",
    ]);
  });

  it("calmed, he clears his head, and the journal follows", () => {
    const read = play(fresh, "megaphone");
    const out: State = { ...schoolBase, ink: read.ink };
    expect(journalNotes(world, out)).toContain(
      "Mr. Bell the principal is fizzy in the hall, blaring announcements at everybody!");
    const calm: State =
      { ...out, critters: { ...out.critters, principal: "calm" } };
    const notes = journalNotes(world, calm);
    expect(notes).toContain(
      "I calmed Mr. Bell, the principal! Morning announcements sound like morning again.");
    expect(notes).not.toContain(
      "Mr. Bell the principal is fizzy in the hall, blaring announcements at everybody!");
    // His calm knot carries the soda story and a principal's again-line.
    const soothed = play(read.ink, "principal", facts({ principal: true }));
    expect(soothed.lines[0]).toBe("Oh my stars. My head is clear, and my voice is my own again!");
    expect(play(soothed.ink, "principal", facts({ principal: true })).lines)
      .toEqual(["Lunch today is tacos. That is all."]);
    // And the megaphone itself reads calm once he is.
    expect(play(read.ink, "megaphone", facts({ principal: true })).lines).toEqual([
      "The megaphone is quiet now. It smells like cocoa and chalk dust.",
    ]);
  });
});

describe("the two new species' content", () => {
  it("carry their own stickers, calm knots, and numbers", () => {
    for (const [id, calm, sticker, coins, level] of [
      ["crab", "Sandy Crab", "sandy-crab", 8, 5],
      ["penguin", "Waddle Penguin", "waddle-penguin", 8, 6],
    ] as const) {
      const kind = world.critters[id];
      if (kind === undefined) throw new Error(`${id} missing`);
      expect(kind.calmName).toBe(calm);
      expect(kind.sticker.id).toBe(sticker);
      expect(kind.coins).toBe(coins);
      expect(kind.level).toBe(level);
      expect(kind.calmKnot).toBe(`${id}_calm`);
      expect(kind.lines.friends.juggle).toBeTruthy();
    }
    const bell = world.critters.principal;
    if (bell === undefined) throw new Error("principal missing");
    expect(bell.calmName).toBe("Mr. Bell");
    expect(bell.coins).toBe(25);
    expect(bell.touchRadius).toBe(85);
    expect(bell.calmMax).toBe(160);
    expect(bell.windUp).toBeDefined();
  });
});
