import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded Bubblegum Bay fishing run (tools/sim/record-fish.ts): chains
// from golden-bay.json, walks out to Sue's dock, opens fishing, casts, waits
// through nibbles to the splash bite, reels in a Sunny Perch, confirms the
// catch card, and steps back onto the dock.
describe("Bubblegum Bay fishing replay", () => {
  it("plays all fishing phases, awards coins/snacks/caughtFish, and emits all 5 cues", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures["new-game"];
    if (fixture === undefined) throw new Error("missing the new-game fixture");
    const path = "tests/sim/scripts/new-game/fish.json";
    let state: State = createState(world, fixture);
    const phases: string[] = [];
    const cues: string[] = [];
    let coinsBefore = 0;
    let snacksBefore = 0;

    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path)) {
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.arcade === null && state.arcade?.game === "fish") {
          coinsBefore = before.coins;
          snacksBefore = before.snacks;
        }
        if (state.arcade?.game === "fish" && phases.at(-1) !== state.arcade.phase) {
          phases.push(state.arcade.phase);
        }
        if (before.arcade?.game === "fish" || state.arcade?.game === "fish") {
          cues.push(
            ...soundCues(before, state, world).filter((cue) => cue.startsWith("fish-")),
          );
        }
      }
    }

    expect(phases).toEqual(["aim", "casting", "waiting", "bite", "reeling", "result"]);
    expect(cues).toContain("fish-cast");
    expect(cues).toContain("fish-nibble");
    expect(cues).toContain("fish-bite");
    expect(cues).toContain("fish-reel");
    expect(cues).toContain("fish-catch");
    expect(state.area).toBe("bay");
    expect(state.arcade).toBeNull();
    expect(state.dialogue).toBeNull();
    expect(state.caughtFish).toEqual({ shell: 1 });
    expect(state.coins).toBe(coinsBefore + 8);
    expect(state.snacks).toBe(snacksBefore);
  });
});
