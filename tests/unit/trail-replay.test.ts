import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("Cliffside Trail replay", () => {
  it("calms the bunny, runs from the squirrel, and stops at the closed bay path", () => {
    const content = loadContent();
    const fixture = content.fixtures.pass;
    if (fixture === undefined) throw new Error("pass fixture missing");
    const path = "tests/sim/scripts/pass/trail.json";
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    let state: State = createState(content.world, fixture);
    for (const segment of script)
      for (let tick = 0; tick < segment.ticks; tick += 1)
        state = step(content.world, state, segment.frame).state;
    expect(state.area).toBe("bay");
    expect(state.dialogue?.knot).toBe("bay_cliff_path");
    expect(state.transition).toBeNull();
    // Calmed a bunny, ran from a squirrel (left behind on the trail).
    expect(state.stickers).toEqual(["ribbon-bunny"]);
  });

  // tools/sim/record-lookout.ts: from the beach over the footbridge to the
  // lookout's bench, then down into the bay holding down the whole way.
  it("crosses the bridge to the bench, and holding down in the bay doesn't bounce Fae back", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures.trail;
    if (fixture === undefined) throw new Error("trail fixture missing");
    const path = "tests/sim/scripts/trail/lookout.json";
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    let state: State = createState(world, fixture);
    const knots = new Set<string>();
    const areas: string[] = [];
    for (const segment of script)
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(world, state, segment.frame).state;
        if (state.dialogue !== null) knots.add(state.dialogue.knot);
        if (areas.at(-1) !== state.area) areas.push(state.area);
      }
    expect(areas).toEqual(["trail", "bay"]);
    expect([...knots]).toEqual(["lookout_bench", "bay_cliff_path"]);
    expect({ area: state.area, knot: state.dialogue?.knot, transition: state.transition })
      .toEqual({ area: "bay", knot: "bay_cliff_path", transition: null });
  });
});
