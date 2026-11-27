import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Starlight Island & Bubblegum Bay Rowboat Crossing playthrough
// (tools/sim/record-island.ts): chains from golden-flute.json (in Meadow Park
// with Maddie, Sue, Jordan, blacklight lantern, and silver flute), exits to
// Cloverhollow Plaza, rides the bus to Bubblegum Bay, clears roaming bay
// critters, rows out to Starlight Island from bay-boats, plays the 4-note
// Seashell Chime puzzle with the silver flute harmony (+20 coins,
// island_shells_solved), visits the coral-striped Tide-Pool Lighthouse for the
// Sea-Breeze Snack Tin (+2 snacks, island_visited, island_lighthouse_checked),
// uncorks the SE Message-in-a-Bottle (+15 coins, island_bottle_found), turns
// on Jordan's blacklight lantern to read the glowing Starlight Runes (+10
// coins, island_glow_read), and rows cleanly back to Bubblegum Bay (bay.boats).

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

describe("the Starlight Island & Rowboat Crossing recording", () => {
  it("rows out to Starlight Island, solves shells, visits lighthouse, bottle, glow & returns",
    () => {
      const state = replay("tests/sim/scripts/new-game/island.json");
      expect(state.tick).toBe(23464);
      expect(state.area).toBe("bay");
      expect(state.player).toEqual({ x: 1450, y: 685 });
      expect(state.coins).toBe(210);
      expect(state.snacks).toBe(3);
      expect(state.lantern).toBe(false);
      expect(world.storyVariable(state.ink, "island_visited")).toBe(true);
      expect(world.storyVariable(state.ink, "island_shells_solved")).toBe(true);
      expect(world.storyVariable(state.ink, "island_lighthouse_checked")).toBe(true);
      expect(world.storyVariable(state.ink, "island_bottle_found")).toBe(true);
      expect(world.storyVariable(state.ink, "island_glow_read")).toBe(true);
      const notes = journalNotes(world, state);
      expect(notes).toContain(
        "I rowed out across Bubblegum Bay to Starlight Island and visited the coral-striped " +
          "Tide-Pool Lighthouse!",
      );
      expect(notes).toContain(
        "I played the four giant pastel seashells in harmony by Starlight Island's tide pool " +
          "and uncovered a Tide-Pool Pearl Cache!",
      );
    });
});
