import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded claw machine run (tools/sim/record-claw.ts): Mr. Pip calmed,
// then four games, one for each outcome, then the machine looked at again.
describe("claw machine replay", () => {
  it("is stuck on the raccoon, wins the pup, misses, and wins the cat", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.arcade;
    if (fixture === undefined) throw new Error("missing the arcade fixture");
    const path = "tests/sim/scripts/arcade/claw.json";
    const claw = world.arcade.claw;
    let state: State = createState(world, fixture);
    const results: string[] = [];
    const cues: string[] = [];
    const coinsAtOpen: number[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.arcade === null && state.arcade !== null)
          coinsAtOpen.push(before.coins - state.coins);
        if (before.arcade?.phase !== "result" && state.arcade?.phase === "result")
          results.push(state.arcade.message);
        if (before.arcade !== null || state.arcade !== null)
          cues.push(...soundCues(before, state, world).filter((cue) =>
            cue.startsWith("claw-") || cue === "prize-won"));
      }

    expect(results).toEqual([claw.lines.stuck, "You won the Pup Plush!", claw.lines.missed,
      "You won the Cat Plush!"]);
    // Every game cost the tagged 2 coins, paid as the conversation closed.
    expect(coinsAtOpen).toEqual([2, 2, 2, 2]);
    // Two holds a game, then the drop, the grab or the miss, and a prize.
    const game = (grabbed: boolean): string[] => ["claw-move", "claw-move", "claw-drop",
      grabbed ? "claw-grab" : "claw-miss", ...(grabbed ? ["prize-won"] : [])];
    expect(cues).toEqual([...game(false), ...game(true), ...game(false), ...game(true)]);
    expect({
      tick: state.tick, area: state.area, arcade: state.arcade, dialogue: state.dialogue,
      prizes: state.prizes, coins: state.coins, keeper: state.critters["arcade-keeper"],
    }).toEqual({
      tick: 3199, area: "arcade", arcade: null, dialogue: null,
      prizes: ["pup-plush", "cat-plush"], coins: 17, keeper: "calm",
    });
    expect(state.stickers).toContain("arcade-keeper");
  });
});
