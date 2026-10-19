import { describe, expect, it } from "vitest";
import { createState, journalNotes, presentCritters, type State } from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { areaConnectionErrors, hiddenPositions } from "../../src/content/area-checks";
import { loadContent, parseCritter } from "../../src/content/load";
import lifeguardData from "../../content/critters/lifeguard.json";

// Contract for Milestone 64, the lifeguard at Bubblegum Bay.

const content = loadContent();
const world = content.world;
const facts = (calmed: Record<string, boolean> = {}): InkFacts =>
  ({ calmed, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 });
const sue = facts();
type Played = { lines: string[]; tags: string[][]; ink: string };
function play(ink: string, knot: string, with_ = sue): Played {
  const lines: string[] = []; const tags: string[][] = [];
  let result = runInk(world.story, ink, { type: "start", knot }, with_);
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) { lines.push(result.line.text); tags.push(result.line.tags); }
    if (result.ended) break;
    result = runInk(world.story, result.ink, result.choices.length > 0
      ? { type: "choose", index: 0 } : { type: "next" }, with_);
  }
  return { lines, tags, ink: result.ink };
}
const variable = (ink: string, name: string): unknown => inkVariable(world.story, ink, name);
const fresh = createInkState(world.story, 1);

describe("the bay picnic", () => {
  it("keeps the old picnic before Sue joins", () => {
    expect(play(fresh, "bay_picnic").lines).toEqual([
      "A beach picnic: watermelon slices, a sun hat, and a sandy towel.",
      "Everything's covered in sand. That bluebird again!",
    ]);
    expect(variable(play(fresh, "bay_picnic").ink, "lifeguard_back")).toBe(false);
  });
  it("calls back the lifeguard after Sue joins", () => {
    let joined = runInk(world.story, fresh, { type: "start", knot: "sue" }, sue);
    for (let count = 0; count < 20 && joined.choices.length === 0 && !joined.ended; count += 1)
      joined = runInk(world.story, joined.ink, { type: "next" }, sue);
    joined = runInk(world.story, joined.ink, { type: "choose", index: 0 }, sue);
    const result = play(joined.ink, "bay_picnic", sue);
    expect(result.lines).toEqual([
      "A sharp whistle cuts across the bay. \"TWEEEET!\"",
      "\"NOBODY splashes on MY beach!\"",
      "It's the lifeguard, and she's all fizzy!",
    ]);
    expect(variable(result.ink, "lifeguard_back")).toBe(true);
  });
});

describe("Ms. Coral", () => {
  it("is a bay set piece with catch toys and scaled balls", () => {
    const kind = world.critters.lifeguard;
    if (kind === undefined) throw new Error("lifeguard missing");
    expect(kind.toyScale).toBe(0.5);
    expect(kind.burst.check.kind).toBe("catch");
    if (kind.burst.check.kind === "catch")
      expect(kind.burst.check.toys).toEqual(["beach-ball-01", "beach-ball-02",
        "beach-ball-03"]);
    expect(kind.feelings).toEqual(["grumpy", "hungry", "curious"]);
    expect(world.stickers.catalogue.map((sticker) => sticker.id)).toContain("lifeguard");
    const area = world.areas.bay;
    expect(area?.critters).toEqual([{ id: "lifeguard", point: { x: 760, y: 590 },
      visibleWhile: "lifeguard_back" }]);
  });
  it("gives three snacks once when talked to", () => {
    const result = play(fresh, "lifeguard");
    expect(result.tags.flat()).toContain("gift: snack 3");
    expect(play(result.ink, "lifeguard").tags.flat()).not.toContain("gift: snack 3");
  });
});

describe("toyScale validation", () => {
  it("rejects zero, negative, and non-numbers", () => {
    for (const value of [0, -1, "small"])
      expect(() => parseCritter({ ...lifeguardData, toyScale: value }, "test.json"))
        .toThrow();
  });
});
