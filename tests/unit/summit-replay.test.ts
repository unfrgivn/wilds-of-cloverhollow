import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Alpine Summit Overlook & Rideable Pinecone Pass Ski Lift
// playthrough (tools/sim/record-summit.ts): chains from golden-lodge.json,
// exits Mountain Lodge onto Pinecone Pass, clears roaming pass critters, rides
// the ski lift up to Alpine Summit Overlook, uses the Panoramic Valley
// Telescope to look east over Bubblegum Bay (+10 coins, summit_visited), grabs
// Mrs. Flurry's warm cocoa from the bench thermos (+2 snacks,
// summit_cocoa_taken), turns on the blacklight lantern to read the glowing
// Aurora Cairn (+15 coins, summit_aurora_read), and rides the ski lift cleanly
// back down to Pinecone Pass (pass.ski-lift).

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

describe("the Alpine Summit Overlook & Ski Lift recording", () => {
  it("rides the ski lift up, explores telescope, cocoa, aurora cairn, and glides back down", () => {
    const state = replay("tests/sim/scripts/new-game/summit.json");
    expect(state.tick).toBe(11800);
    expect(state.area).toBe("pass");
    expect(state.player).toEqual({ x: 485, y: 490 });
    expect(state.coins).toBe(122);
    expect(state.snacks).toBe(5);
    expect(state.lantern).toBe(false);
    expect(world.storyVariable(state.ink, "summit_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "summit_telescope_used")).toBe(true);
    expect(world.storyVariable(state.ink, "summit_cocoa_taken")).toBe(true);
    expect(world.storyVariable(state.ink, "summit_aurora_read")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I rode the Pinecone Pass ski lift up to Alpine Summit Overlook and gazed across " +
        "Cloverhollow through the brass valley telescope!",
    );
    expect(notes).toContain(
      "Under Jordan's blacklight lantern, ancient aurora runes on Alpine Summit's stone cairn " +
        "lit up with a valley legend!",
    );
  });
});
