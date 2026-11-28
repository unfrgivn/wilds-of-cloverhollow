import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Wildlife Sanctuary playthrough (tools/sim/record-sanctuary.ts):
// chains from m81-festival.json (in Clover Hills with Maddie, Sue, Jordan, and
// 8 calmed valley animals), walks east into the Wildlife Sanctuary, talks to
// Ranger Fern for the 8+ calmed-animal milestone reward (+25 coins, +2 snacks),
// reads the Sanctuary Board, pets Fountain Frog and Starry Owl, enjoys the
// Sanctuary Meadow Picnic (+1 snack), and walks back out to Clover Hills.

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

describe("the Wildlife Sanctuary recording", () => {
  it("visits Ranger Fern, pets calmed visitors, shares a picnic, and returns to hills", () => {
    const state = replay("tests/sim/scripts/new-game/sanctuary.json");
    expect(state.tick).toBe(14814);
    expect(state.area).toBe("hills");
    expect(state.coins).toBe(175);
    expect(state.snacks).toBe(11);
    expect(world.storyVariable(state.ink, "sanctuary_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "sanctuary_reward_3")).toBe(true);
    expect(world.storyVariable(state.ink, "sanctuary_reward_8")).toBe(true);
    expect(world.storyVariable(state.ink, "sanctuary_picnic_basket")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I found the Wildlife Sanctuary east of Clover Hills! Ranger Fern looks after every " +
        "calm animal who visits the meadow.",
    );
  });
});
