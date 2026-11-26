import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Crystal Cavern playthrough (tools/sim/record-cavern.ts):
// chains from golden-flute.json, enters Crystal Cavern via Pinecone Pass's
// north mountain gap, calms Duzzy Bat, lights the crystal stepping stones
// with the blacklight lantern mural, crosses to calm Glimmer Mole, lassos
// the Star Chime Geode, calls Pond Pup at the crystal spring, and returns.

const { world, fixtures } = loadContent();

function replay(path: string): State {
  const fixture = fixtures["new-game"];
  if (fixture === undefined) throw new Error("new-game fixture missing");
  let state: State = createState(world, fixture);
  for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
    for (let tick = 0; tick < segment.ticks; tick += 1)
      state = step(world, state, segment.frame).state;
  return state;
}

describe("the Crystal Cavern recording", () => {
  it("completes the full cavern loop and returns to Pinecone Pass", () => {
    const state = replay("tests/sim/scripts/new-game/cavern.json");
    expect(state.tick).toBe(23604);
    expect(state.area).toBe("pass");
    expect(state.stickers).toContain("cozy-bat");
    expect(state.stickers).toContain("gem-mole");
    expect(world.storyVariable(state.ink, "cavern_bridge_lit")).toBe(true);
    expect(world.storyVariable(state.ink, "cavern_chime_rung")).toBe(true);
    expect(world.storyVariable(state.ink, "cavern_spring_found")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "Reading the glowing fairy mural in Crystal Cavern lit three crystal stepping stones " +
        "across the stream!",
    );
    expect(notes).toContain(
      "I lassoed the golden star chime in Crystal Cavern and caught a shimmering star " +
        "crystal!",
    );
    expect(notes).toContain(
      "The Pond Pup dove into Crystal Cavern's glowing spring and fetched a pouch of snacks " +
        "and coins!",
    );
  });
});
