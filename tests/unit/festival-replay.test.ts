import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Post-Finale Sunny Cloverhollow Sanctuary Festival playthrough
// (tools/sim/record-festival.ts): chains directly from golden-kid.json (in the
// restored Enchanted Forest with milo_revealed = true and forest_fizzy = false),
// walks out to Cloverhollow Plaza, Meadow Park, Clover Hills, and into the
// sunlit Wildlife Sanctuary, talks to Dad, Milo, Rosie (+1 snack), and Chef Bea
// (honey-clover tart), shares the post-finale Picnic Blanket with Milo (+1
// snack), and raises Ranger Fern's Sunny Cloverhollow Festival Toast (+25/+30
// coins and +2/+2 snacks, setting festival_toast_done = true).

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

describe("the Sunny Cloverhollow Sanctuary Festival recording", () => {
  it("walks from the restored forest to Sanctuary, chats with all 4 guests, and toasts", () => {
    const state = replay("tests/sim/scripts/new-game/festival.json");
    expect(state.tick).toBe(36709);
    expect(state.area).toBe("sanctuary");
    expect(state.coins).toBe(318);
    expect(state.snacks).toBe(8);
    expect(world.storyVariable(state.ink, "milo_revealed")).toBe(true);
    expect(world.storyVariable(state.ink, "forest_fizzy")).toBe(false);
    expect(world.storyVariable(state.ink, "festival_dad_talked")).toBe(true);
    expect(world.storyVariable(state.ink, "festival_milo_talked")).toBe(true);
    expect(world.storyVariable(state.ink, "festival_rosie_gift")).toBe(true);
    expect(world.storyVariable(state.ink, "festival_chef_talked")).toBe(true);
    expect(world.storyVariable(state.ink, "sanctuary_picnic_basket")).toBe(true);
    expect(world.storyVariable(state.ink, "sanctuary_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "festival_toast_done")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes[0]).toContain("Sunny Cloverhollow Festival Toast");
    expect(notes[0]).toContain("Milo");
  });
});
