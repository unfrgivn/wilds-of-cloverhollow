import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, propStateName, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 49: the recorded lasso spots, on from the flute run
// (Meadow Park, with the lasso and the hall pass). Rosie's kite off the play
// tower; the bus up to the pass, the scarf off the lift chair and back to the
// cocoa seller; the trail down to the bay, the bottle past the dock's end and
// the treasure between the palms; the bay road home, and the kite to Rosie.
describe("lasso replay", () => {
  it("brings down the kite, the scarf, and the bottle, and finds the treasure", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const flute = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/pass-party/flute.json", "utf8")), "flute.json");
    const fluteEnd = flute.reduce((sum, segment) => sum + segment.ticks, 0);
    const areas: string[] = [];
    const knots: string[] = [];
    const paid: { knot: string | undefined; coins: number; snacks: number }[] = [];
    const shown: Record<string, string[]> = { kite: [], bottle: [], scarf: [] };
    const where: Record<string, string> = { kite: "park", bottle: "bay", scarf: "pass" };
    const path = "tests/sim/scripts/pass-party/lasso.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= fluteEnd) continue;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) knots.push(knot);
        if (state.coins !== before.coins || state.snacks !== before.snacks)
          paid.push({ knot, coins: state.coins - before.coins,
            snacks: state.snacks - before.snacks });
        // Each stuck thing as it's drawn, while Fae is in its area.
        for (const [id, area] of Object.entries(where)) {
          if (state.area !== area) continue;
          const prop = world.areas[area]?.props.find((item) => item.id === id);
          if (prop === undefined) throw new Error(`no ${id}`);
          const name = propStateName(world, state.ink, prop);
          const seen = shown[id];
          if (seen !== undefined && seen.at(-1) !== name) seen.push(name);
        }
      }
    expect(areas).toEqual(["park", "plaza", "pass", "trail", "bay", "plaza", "school",
      "classroom"]);
    expect(knots).toEqual(["tower", "bus_stop", "ski_lift", "cocoa_stand", "dock_end", "palms",
      "rosie"]);
    // Up, then down; each was there until it was lassoed.
    expect(shown).toEqual({ kite: ["stuck", "default"], bottle: ["bobbing", "default"],
      scarf: ["stuck", "default"] });
    // Free cocoa, twenty coins of treasure, and Rosie's six arcade coins.
    expect(paid).toEqual([
      { knot: "cocoa_stand", coins: 0, snacks: 1 },
      { knot: "palms", coins: 20, snacks: 0 },
      { knot: "rosie", coins: 6, snacks: 0 },
    ]);
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(["kite_returned", "treasure_found", "scarf_returned"].map(story))
      .toEqual([true, true, true]);
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "classroom", dialogue: null, battle: null });
    expect(journalNotes(world, state)).toEqual(expect.arrayContaining([
      "I lassoed Rosie's kite down from the park's play tower, and she gave me her arcade coins!",
      "I dug up pirate treasure on the beach!",
      "I lassoed the cocoa seller's scarf off the ski lift. Free cocoa!",
    ]));
    // A long replay (the field, flute, and lasso runs): room on a busy machine.
  }, 30_000);
});
