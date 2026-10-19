import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
describe("lifeguard replay", () => {
  it("replays the bay run and calms Ms. Coral", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.bay;
    if (fixture === undefined) throw new Error("bay fixture missing");
    let state: State = createState(world, fixture);
    const path = "tests/sim/scripts/bay/lifeguard.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1)
        state = step(world, state, segment.frame).state;
    expect(state.area).toBe("bay");
    expect(state.critters.lifeguard).toBe("calm");
    expect(state.stickers).toContain("lifeguard");
    expect(journalNotes(world, state)).toContain(
      "I calmed Ms. Coral, the lifeguard at Bubblegum Bay. She shared her watermelon!");
  }, 30_000);
});
