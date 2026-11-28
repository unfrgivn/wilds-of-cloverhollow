import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Cloverhollow's Final Two Plaza Shops playthrough
// (tools/sim/record-plaza-shops.ts): chains from golden-arcade.json, exits
// out onto Cloverhollow Plaza, visits Cloverhollow Grocery Market (Grocer
// Pippin's free apple sample, Orchard Apple purchase, and blacklight recipe
// note), exits safely back onto Cloverhollow Plaza, visits Sweet Scoop Ice
// Cream Parlor (Scooper Penny's free Strawberry Swirl Dream Sundae, Berry
// Swirl Cone purchase, and blacklight Secret Sundae Club doodle), and exits
// back onto Cloverhollow Plaza.

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

describe("the Cloverhollow Plaza Shops recording", () => {
  it("visits Cloverhollow Grocery Market and Sweet Scoop Ice Cream Parlor with blacklights", () => {
    const state = replay("tests/sim/scripts/new-game/plaza-shops.json");
    expect(state.tick).toBe(13297);
    expect(state.area).toBe("plaza");
    expect(state.coins).toBe(99);
    expect(state.snacks).toBe(4);
    expect(state.treats).toEqual({
      "orchard-apple": 1,
      "berry-cone": 1,
    });
    expect(world.storyVariable(state.ink, "market_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "market_note_read")).toBe(true);
    expect(world.storyVariable(state.ink, "parlor_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "parlor_note_read")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes.some((line) => line.includes("Cloverhollow Grocery Market"))).toBe(true);
    expect(notes.some((line) => line.includes("Sweet Scoop Ice Cream Parlor"))).toBe(true);
  });
});
