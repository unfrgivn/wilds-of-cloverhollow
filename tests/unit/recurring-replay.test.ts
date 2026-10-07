import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded recurring-critters run (tools/sim/record-recurring.ts): a pup
// calmed in Meadow Park, a step out to the plaza and back, and a fresh fizzy
// pup by the pond, calmed again.
describe("recurring critters replay", () => {
  it("rolls a fresh pup on return, pays every calm, and gives the sticker once", () => {
    const content = loadContent();
    const fixture = content.fixtures.park;
    if (fixture === undefined) throw new Error("park fixture missing");
    const path = "tests/sim/scripts/park/recurring.json";
    let state: State = createState(content.world, fixture);
    const pupMood = (): string =>
      state.wild.find((critter) => critter.kind === "pup")?.mood ?? "none";
    // What the pond's pup is, each time it changes, and where Fae is.
    const seen: string[] = [`${state.area}: ${pupMood()} pup`];
    const rewards: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state.battle;
        state = step(content.world, state, segment.frame).state;
        const now = `${state.area}: ${pupMood()} pup`;
        if (seen.at(-1) !== now) seen.push(now);
        if (state.battle?.phase === "reward" && before?.phase !== "reward")
          rewards.push(state.battle.message);
      }
    expect(seen).toEqual([
      "park: chaos pup",
      "park: calm pup",
      // The plaza is quiet until its fountain frog is calm.
      "plaza: none pup",
      "park: chaos pup",
      "park: calm pup",
    ]);
    expect(rewards).toEqual(["New sticker: Pond Pup! +8 coins.", "+8 coins!"]);
    expect({ coins: state.coins, stickers: state.stickers })
      .toEqual({ coins: 16, stickers: ["pond-pup"] });
  });
});
