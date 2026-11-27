import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded Chef Mateo's Taco Truck Kitchen run (tools/sim/record-taco.ts):
// chains from m81-festival.json in Clover Hills, talks to calmed Chef Mateo,
// opens the Taco Truck kitchen, plays a spotless 3/3 shift with real directional
// presses, earns +20 coins and +2 snacks, and steps back into Clover Hills.
describe("Chef Mateo's Taco Truck Kitchen replay", () => {
  it("plays a spotless 3/3 shift, pays +20 coins and +2 snacks, and emits crisp cues", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures["new-game"];
    if (fixture === undefined) throw new Error("missing the new-game fixture");
    const path = "tests/sim/scripts/new-game/taco.json";
    let state: State = createState(world, fixture);
    const phases: string[] = [];
    const cues: string[] = [];
    let coinsBefore = 0;
    let snacksBefore = 0;

    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path)) {
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.arcade === null && state.arcade?.game === "taco") {
          coinsBefore = before.coins;
          snacksBefore = before.snacks;
        }
        if (state.arcade?.game === "taco" && phases.at(-1) !== state.arcade.phase) {
          phases.push(state.arcade.phase);
        }
        if (before.arcade?.game === "taco" || state.arcade?.game === "taco") {
          cues.push(...soundCues(before, state, world));
        }
      }
    }

    expect(phases).toEqual([
      "ready",
      "serving",
      "order-clear",
      "serving",
      "order-clear",
      "serving",
      "order-clear",
      "result",
    ]);
    expect(cues).toContain("mole-boop");
    expect(cues).toContain("cook-ding");
    expect(cues).toContain("prize-won");
    expect(cues).toContain("coin");
    expect(cues).toContain("item");
    expect(state.area).toBe("hills");
    expect(state.arcade).toBeNull();
    expect(state.dialogue).toBeNull();
    expect(state.coins).toBe(coinsBefore + 20);
    expect(state.snacks).toBe(snacksBefore + 2);
  });
});
