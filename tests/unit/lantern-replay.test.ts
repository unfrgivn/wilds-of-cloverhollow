import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("lantern replay", () => {
  it("reads the pass secrets and ends with the lantern off", () => {
    const content = loadContent();
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/lantern.json";
    let state = createState(content.world, fixture);
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1)
        state = step(content.world, state, segment.frame).state;
    expect(state.lantern).toBe(false);
    expect(content.world.storyVariable(state.ink, "found_old_trail")).toBe(true);
    expect(journalNotes(content.world, state)[0]).toContain("Whispering Woods");
  });
});
