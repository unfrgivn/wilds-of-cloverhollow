import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded skee-ball run (tools/sim/record-skee.ts): Mr. Pip calmed, a game
// with a ball for each kind of score, and the tickets traded at the counter.
describe("skee-ball replay", () => {
  it("scores 50, a corner's 100, the floor, 40, and 20, then trades for the pinwheel", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.arcade;
    if (fixture === undefined) throw new Error("missing the arcade fixture");
    const path = "tests/sim/scripts/arcade/skee.json";
    const skee = world.arcade.skee;
    let state: State = createState(world, fixture);
    const landed: number[] = [];
    const results: string[] = [];
    const cues: string[] = [];
    const coinsAtOpen: number[] = [];
    const ticketsPaid: number[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.arcade === null && state.arcade !== null)
          coinsAtOpen.push(before.coins - state.coins);
        const game = state.arcade;
        if (game?.game === "skee" && before.arcade?.phase !== "scored" && game.phase === "scored")
          landed.push(game.throws.at(-1)?.points ?? -1);
        if (game?.game === "skee" && before.arcade?.phase !== "result" && game.phase === "result")
          results.push(game.message);
        if (state.tickets !== before.tickets) ticketsPaid.push(state.tickets - before.tickets);
        if (before.arcade !== null || state.arcade !== null)
          cues.push(...soundCues(before, state, world).filter((cue) =>
            cue.startsWith("skee-") || cue === "tickets-won"));
      }

    const ring = (index: number): number => skee.rings[index]?.points ?? -1;
    expect(landed).toEqual([ring(0), skee.corners.points, skee.floor, ring(1), ring(3)]);
    const score = landed.reduce((sum, points) => sum + points, 0);
    const paid = Math.floor(score / skee.pointsPerTicket);
    expect(results).toEqual([skee.lines.result.replace("{score}", String(score))
      .replace("{tickets}", String(paid))]);
    expect(results).toEqual(["You scored 220! +22 tickets."]);
    // The game cost its tagged 2 coins; it paid its tickets once, at the
    // result, and the counter took the pinwheel's 20.
    expect(coinsAtOpen).toEqual([2]);
    expect(ticketsPaid).toEqual([22, -20]);
    const ball = (points: string): string[] => ["skee-aim", "skee-roll", points];
    expect(cues).toEqual([...ball("skee-score"), ...ball("skee-hundred"),
      ...ball("skee-score"), ...ball("skee-score"), ...ball("skee-score"), "tickets-won"]);
    expect({
      tick: state.tick, area: state.area, arcade: state.arcade, dialogue: state.dialogue,
      prizes: state.prizes, tickets: state.tickets, coins: state.coins,
      keeper: state.critters["arcade-keeper"],
    }).toEqual({
      tick: 2212, area: "arcade", arcade: null, dialogue: null, prizes: ["pinwheel"],
      tickets: 2, coins: 23, keeper: "calm",
    });
  });
});
