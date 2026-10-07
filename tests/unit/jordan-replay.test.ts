import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded meeting with Jordan (`tools/sim/record-jordan.ts`): from the
// pass's bus stop with Maddie and Sue, Jordan joins, Juggle helps calm the
// hamster, and the calm hamster gets Jordan to hand Fae his lantern.
describe("Jordan replay", () => {
  it("ends with Jordan in the party, the hamster calm, and the lantern", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/jordan.json";
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    let state = createState(world, fixture);
    for (const segment of script)
      for (let tick = 0; tick < segment.ticks; tick += 1)
        state = step(world, state, segment.frame).state;
    expect({ area: state.area, battle: state.battle, dialogue: state.dialogue })
      .toEqual({ area: "pass", battle: null, dialogue: null });
    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue", "jordan"]);
    expect(state.wild.find((critter) => critter.kind === "hamster")?.mood).toBe("calm");
    expect(state.stickers).toContain("hiker-hamster");
    expect(world.storyVariable(state.ink, "jordan_joined")).toBe(true);
    expect(world.storyVariable(state.ink, "has_lantern")).toBe(true);
    expect(journalNotes(world, state).find((note) => note.includes("lantern"))).toBeDefined();
  });
});
