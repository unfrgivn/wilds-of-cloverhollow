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
    const knots = new Set<string>();
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(content.world, state, segment.frame).state;
        if (state.dialogue !== null) knots.add(state.dialogue.knot);
      }
    // The doodle on the north lift tower and the arrow on the west pines.
    expect([...knots]).toEqual(expect.arrayContaining(["lift_note", "old_trail_marker"]));
    expect(state.lantern).toBe(false);
    expect(content.world.storyVariable(state.ink, "found_old_trail")).toBe(true);
    const note = journalNotes(content.world, state)
      .find((item) => item.includes("Whispering Woods"));
    expect(note).toContain("Whispering Woods");
  });
});
