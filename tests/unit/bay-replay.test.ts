import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("Bubblegum Bay replay", () => {
  it("joins Sue, casts for the bluebird, and records the mountain clue", () => {
    const content = loadContent();
    const fixture = content.fixtures.bay;
    if (fixture === undefined) throw new Error("bay fixture missing");
    let state: State = createState(content.world, fixture);
    let castUsed = false;
    const raw: unknown = JSON.parse(
      readFileSync("tests/sim/scripts/bay/bay.json", "utf8"),
    );
    for (const segment of parseScript(raw, "tests/sim/scripts/bay/bay.json"))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(content.world, state, segment.frame).state;
        if (state.battle?.command === "cast") castUsed = true;
      }
    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    expect(state.wild.find((critter) => critter.kind === "bluebird")?.mood).toBe("calm");
    expect(state.stickers).toContain("bay-bluebird");
    expect(castUsed).toBe(true);
    const note = journalNotes(content.world, state)
      .find((item) => item.includes("mountains"));
    expect(note).toMatch(/mountains/);
  });
});
