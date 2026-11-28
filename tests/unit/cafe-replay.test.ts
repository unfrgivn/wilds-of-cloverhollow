import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Bon Appetit Café & Town Life playthrough
// (tools/sim/record-cafe.ts): chains from golden-bay.json, takes the bus home
// to Town Plaza, steps through the teal café door, chats with Dad, Toby, Bree,
// Grandpa Barnaby, and Chef Bea, fetches Chef Bea's Star Cinnamon tin from
// Meadow Park, completes the errand (and buys a warm cinnamon bun), and steps
// back out to the plaza.

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

describe("the Bon Appetit Café recording", () => {
  it("completes Dad's visit, all five townspeople, and Chef Bea's Star Cinnamon errand", () => {
    const state = replay("tests/sim/scripts/new-game/cafe.json");
    expect(state.tick).toBe(8461);
    expect(state.area).toBe("plaza");
    expect(state.coins).toBe(75);
    expect(state.snacks).toBe(6);
    expect(world.storyVariable(state.ink, "met_dad")).toBe(true);
    expect(world.storyVariable(state.ink, "spice_quest")).toBe(true);
    expect(world.storyVariable(state.ink, "spice_found")).toBe(true);
    expect(world.storyVariable(state.ink, "spice_returned")).toBe(true);
    expect(world.storyVariable(state.ink, "barnaby_gift")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I bumped into Dad at Bon Appetit Cafe! He gave me a warm cinnamon bun and ten coins for " +
        "my adventure.",
    );
    expect(notes).toContain(
      "I found Chef Bea's Star Cinnamon tin in Meadow Park and earned a golden Bon Appetit " +
        "Star Pin!",
    );
  });
});
