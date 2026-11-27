import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Other Kids' Houses playthrough (tools/sim/record-friend-homes.ts):
// chains from golden-lantern.json, walks west into Jordan's Mountain Cabin,
// inspects the botany/cocoa table for the Pressed Alpine Clover & cocoa snack,
// turns on the blacklight lantern to read Jordan's glowing trail-blaze map,
// exits to Pinecone Pass, rides the Star Bus to Bubblegum Bay, walks NW into
// Sue's Beach Cottage, inspects the tackle workbench for the Sea-Glass Compass
// & coins, grabs coastal snacks from the wicker basket, reads Sue's glowing
// Bay Explorers Club star chart under the blacklight lantern, and exits back
// onto Bubblegum Bay.

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

describe("the Other Kids' Houses recording", () => {
  it("visits Jordan's Mountain Cabin and Sue's Beach Cottage with blacklight secrets", () => {
    const state = replay("tests/sim/scripts/new-game/friend-homes.json");
    expect(state.tick).toBe(11334);
    expect(state.area).toBe("bay");
    expect(state.coins).toBe(94);
    expect(state.snacks).toBe(5);
    expect(state.lantern).toBe(false);
    expect(world.storyVariable(state.ink, "jordan_cabin_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "jordan_clover")).toBe(true);
    expect(world.storyVariable(state.ink, "jordan_note_read")).toBe(true);
    expect(world.storyVariable(state.ink, "sue_cottage_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "sue_compass")).toBe(true);
    expect(world.storyVariable(state.ink, "sue_basket_taken")).toBe(true);
    expect(world.storyVariable(state.ink, "sue_note_read")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I visited Jordan's timber cabin along the west trail at Pinecone Pass! He shared hot " +
        "cocoa and his grandma's Pressed Alpine Clover.",
    );
    expect(notes).toContain(
      "I visited Sue's mint-green beach cottage up the cove at Bubblegum Bay! She gave me her " +
        "Sea-Glass Compass and a tip for catching the Golden Starfish Crown.",
    );
  });
});
