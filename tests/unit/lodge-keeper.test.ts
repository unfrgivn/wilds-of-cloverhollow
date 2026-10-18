import { describe, expect, it } from "vitest";
import { createState, journalNotes, presentCritters, type State } from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { areaConnectionErrors, hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 57, the lodge keeper: the first of more people under
// the chaos spell. Once Fae has calmed a hamster at Pinecone Pass, the lodge's
// note leads on: its keeper, Mrs. Flurry, is home and fizzy, flinging
// snowballs from her porch. Calmed, she opens the lodge, a new room.

const content = loadContent();
const world = content.world;
const story = world.story;
const facts = (calmed: Record<string, boolean> = {}): InkFacts =>
  ({ calmed, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 });
const hamsterCalm = facts({ hamster: true });

type Played = { lines: string[]; tags: string[][]; ink: string };
function play(ink: string, knot: string, with_ = facts()): Played {
  const lines: string[] = [];
  const tags: string[][] = [];
  let result = runInk(story, ink, { type: "start", knot }, with_);
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) {
      lines.push(result.line.text);
      tags.push(result.line.tags);
    }
    if (result.ended) break;
    result = runInk(story, result.ink, result.choices.length > 0
      ? { type: "choose", index: 0 } : { type: "next" }, with_);
  }
  return { lines, tags, ink: result.ink };
}
const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);
const fresh = createInkState(story, 1);
const note = "The lodge is locked. A note says: \"Back soon, gone looking for a runaway hamster.\"";

describe("the lodge's note", () => {
  it("is just the note until Fae has calmed a hamster", () => {
    expect(play(fresh, "lodge_door").lines).toEqual([note]);
    expect(variable(play(fresh, "lodge_door").ink, "keeper_back")).toBe(false);
  });

  it("then leads on: a snowball, and the keeper home and fizzy", () => {
    const back = play(fresh, "lodge_door", hamsterCalm);
    expect(back.lines).toEqual([
      note,
      "A runaway hamster? We calmed a hamster up here!",
      "WHOOSH! A snowball whizzes right past Fae's ear.",
      "Hee hee hee! NOBODY gets in MY lodge!",
      "It's the lodge keeper, and she's all fizzy!",
    ]);
    expect(variable(back.ink, "keeper_back")).toBe(true);
    expect(play(back.ink, "lodge_door", hamsterCalm).lines).toEqual([
      "The lodge is locked tight. The lodge keeper is out on her porch, flinging snowballs!",
    ]);
  });
});

describe("Mrs. Flurry", () => {
  const back = play(fresh, "lodge_door", hamsterCalm).ink;
  const passState = (ink: string): State =>
    ({ ...createState(world, { area: "pass", spawn: "bus", seed: 1 }), ink });
  const keeper = (state: State) =>
    presentCritters(world, state).find((critter) => critter.kind.id === "lodge-keeper");

  it("is on her porch from then, fizzy, and nowhere before", () => {
    expect(keeper(passState(fresh))).toBeUndefined();
    const there = keeper(passState(back));
    expect(there?.mood).toBe("chaos");
    expect(there?.point).toEqual({ x: 1300, y: 590 });
  });

  it("is a person under the spell: snowballs to catch and a giant one to wind up", () => {
    const kind = world.critters["lodge-keeper"];
    if (kind === undefined) throw new Error("no lodge keeper");
    expect([kind.name, kind.calmName, kind.calmKnot]).toEqual(
      ["Fizzy Mrs. Flurry", "Mrs. Flurry", "lodge_keeper"]);
    expect(kind.burst.check.kind).toBe("catch");
    const toys = kind.burst.check.kind === "catch" ? kind.burst.check.toys : [];
    expect(toys).toEqual(["snowball-05", "snowball-06", "snowball-07"]);
    expect(kind.windUp?.lines.start).toContain("snowball");
    expect(world.stickers.catalogue.map((sticker) => sticker.id)).toContain("lodge-keeper");
  });

  it("calmed, remembers the soda, and opens the lodge", () => {
    const calm = play(back, "lodge_keeper");
    expect(calm.lines).toEqual([
      "Oh my stars... what happened? My head was all fizzy, like a shaken-up soda!",
      "My hamster Biscuit ran off this morning. While I was out looking for him, a kid in a " +
      "purple hood gave me a fizzy purple soda.",
      "One sip, and I didn't want ANYONE in my lodge. I'm so sorry about the snowballs, dears!",
      "Biscuit came home all by himself, calm as can be. Somebody must have been kind to him.",
      "That was us!",
      "Then come in, come in, all of you! Warm up by the fire.",
    ]);
    expect(variable(calm.ink, "lodge_open")).toBe(true);
    expect(play(calm.ink, "lodge_keeper").lines).toEqual([
      "Mrs. Flurry sweeps the snow off her porch. \"The fire's lit, dears. Come in and warm up!\"",
    ]);
    expect(play(calm.ink, "lodge_door").lines).toEqual([
      "The lodge door is open. Warm air and the smell of cocoa drift out.",
    ]);
  });
});

describe("the lodge", () => {
  const lodge = world.areas.lodge;
  const pass = world.areas.pass;
  if (lodge === undefined || pass === undefined) throw new Error("no lodge or pass");

  it("opens off the pass's porch once she's calm, and back out to it", () => {
    const door = pass.triggers.find((trigger) => trigger.id === "lodge");
    expect(door?.target).toEqual({ area: "lodge", spawn: "door" });
    expect(door?.requires).toEqual({ variable: "lodge_open", knot: "lodge_door" });
    expect(lodge.triggers.map((trigger) => trigger.target))
      .toEqual([{ area: "pass", spawn: "lodge" }]);
    expect([lodge.land, content.fixtures.lodge?.area]).toEqual(["pass", "lodge"]);
  });

  it("has a fire, cocoa once, a guestbook with a clue, and Biscuit", () => {
    expect(play(fresh, "lodge_fire").lines[0])
      .toBe("The fire crackles and pops. Fae holds her hands out to it. Toasty!");
    const cocoa = play(fresh, "lodge_cocoa");
    expect(cocoa.tags.at(-1)).toContain("gift: snack 1");
    expect(play(cocoa.ink, "lodge_cocoa").lines)
      .toEqual(["The cocoa pot is still warm. Mmm, marshmallows."]);
    expect(play(fresh, "lodge_guestbook").lines).toEqual([
      "The lodge's guestbook, full of happy skiers' names.",
      "On today's page, somebody signed in purple marker, then scribbled their name out.",
      "There's a little paper plane doodled in the corner.",
    ]);
    expect(play(fresh, "lodge_hamster").lines[1])
      .toBe("That must be Biscuit! He's snoring tiny squeaks.");
  });

  it("passes the area checks: the floor, the look points, nobody hidden", () => {
    expect(lodge.interactables.map((item) => item.knot))
      .toEqual(["lodge_fire", "lodge_cocoa", "lodge_guestbook", "lodge_hamster"]);
    expect(lodge.props.map((prop) => prop.id)).toEqual(["counter", "fireplace",
      "armchair-left", "side-table", "armchair-right", "hamster-house"]);
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party)
      .filter((error) => /^(lodge|pass):/.test(error))).toEqual([]);
    expect(hiddenPositions(lodge, world.tunables.playerRadius)).toEqual([]);
  }, 30_000);
});

describe("the journal", () => {
  // A set piece's calm is its mood in the state, as the story reads it.
  const notes = (ink: string, calm = false): string[] => {
    const start = createState(world, { area: "harness", spawn: "start", seed: 1 });
    return journalNotes(world, { ...start, ink, critters: { ...start.critters,
      ...(calm ? { "lodge-keeper": "calm" } : {}) } });
  };

  it("tells of the fizzy keeper, then of her open lodge", () => {
    const back = play(fresh, "lodge_door", hamsterCalm).ink;
    expect(notes(back)).toContain(
      "The lodge keeper at Pinecone Pass is fizzy, and flinging snowballs from her porch!");
    const calm = notes(back, true);
    expect(calm).toContain(
      "I calmed Mrs. Flurry, the lodge keeper at Pinecone Pass. Her lodge is open, and the " +
      "fire's lit!");
    expect(calm.join(" ")).not.toContain("flinging snowballs");
    expect(notes(fresh).join(" ")).not.toMatch(/lodge keeper|Mrs\. Flurry/);
  });
});
