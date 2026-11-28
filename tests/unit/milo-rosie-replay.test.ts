import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Milo's Sketch Loft & Rosie's Flower Cottage playthrough
// (tools/sim/record-milo-rosie.ts): chains from golden-arcade.json, exits onto
// Cloverhollow Plaza, walks into Meadow Park, enters Milo's Sketch Loft via the
// WNW fence gap, inspects Milo's art desk (+10 coins, milo_loft_visited), turns
// on the blacklight lantern to read Milo's glowing rocket margin note (+10 coins),
// exits to Meadow Park, enters Rosie's Flower Cottage via the NNW sunlit gap,
// talks to Rosie (+1 Sunlit Clover Tea Snack, rosie_cottage_visited), reads
// Rosie's glowing Four-Leaf Clover Fairy Doodle (+10 coins), and exits back
// onto Meadow Park.

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

describe("the Milo's Sketch Loft & Rosie's Flower Cottage recording", () => {
  it("visits both Meadow Park neighborhood homes with Rosie talk and blacklight secrets", () => {
    const state = replay("tests/sim/scripts/new-game/milo-rosie.json");
    expect(state.tick).toBe(15042);
    expect(state.area).toBe("park");
    expect(state.coins).toBe(150);
    expect(state.snacks).toBe(3);
    expect(state.lantern).toBe(false);
    expect(world.storyVariable(state.ink, "milo_loft_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "milo_desk_checked")).toBe(true);
    expect(world.storyVariable(state.ink, "milo_loft_glow_read")).toBe(true);
    expect(world.storyVariable(state.ink, "rosie_cottage_visited")).toBe(true);
    expect(world.storyVariable(state.ink, "rosie_cottage_glow_read")).toBe(true);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I visited Milo's sunlit sketch loft beside Meadow Park! His desk is covered in rocket " +
        "watercolor comics and a jar of Star Racer tokens.",
    );
    expect(notes).toContain(
      "I visited Rosie's flower cottage by Meadow Park! She showed off her pressed-clover " +
        "bookmarks and shared a Sunlit Clover Tea Snack.",
    );
  });
});
