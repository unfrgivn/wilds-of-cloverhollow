import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded Comet Cruise run (tools/sim/record-comet.ts): Mr. Pip calmed,
// then a run with fourteen stars caught, two let go, and one rock bumped, and
// its result closed.
describe("Comet Cruise replay", () => {
  it("catches 14 of 16 stars, bumps one rock, and pays 28 tickets once", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.arcade;
    if (fixture === undefined) throw new Error("missing the arcade fixture");
    const path = "tests/sim/scripts/arcade/comet.json";
    const comet = world.arcade.comet;
    let state: State = createState(world, fixture);
    const results: string[] = [];
    const cues: string[] = [];
    const coinsAtOpen: number[] = [];
    const ticketsPaid: number[] = [];
    const tally = { caught: 0, letGo: 0, bumps: 0, moves: 0 };
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.arcade === null && state.arcade !== null)
          coinsAtOpen.push(before.coins - state.coins);
        const was = before.arcade;
        const game = state.arcade;
        if (was?.game === "comet" && game?.game === "comet") {
          if (game.lane !== was.lane) tally.moves += 1;
          if (was.phase !== "result" && game.phase === "result") {
            results.push(game.message);
            tally.caught = game.caught;
            tally.letGo = game.letGo;
            tally.bumps = game.bumps;
          }
        }
        if (state.tickets !== before.tickets) ticketsPaid.push(state.tickets - before.tickets);
        if (before.arcade !== null || state.arcade !== null)
          cues.push(...soundCues(before, state, world).filter((cue) =>
            cue.startsWith("comet-") || cue === "tickets-won"));
      }

    expect(results).toEqual([comet.lines.result.replace("{stars}", "14")
      .replace("{total}", String(comet.stars))
      .replace("{tickets}", String(14 * comet.ticketsPerStar))]);
    expect(results).toEqual(["You caught 14 of 16 stars! +28 tickets."]);
    expect(coinsAtOpen).toEqual([2]);
    expect(ticketsPaid).toEqual([14 * comet.ticketsPerStar]);
    expect({ caught: tally.caught, letGo: tally.letGo, bumps: tally.bumps })
      .toEqual({ caught: 14, letGo: 2, bumps: 1 });
    const count = (cue: string): number => cues.filter((item) => item === cue).length;
    expect({ moves: count("comet-move"), stars: count("comet-star"),
      bumps: count("comet-bump"), tickets: count("tickets-won") })
      .toEqual({ moves: tally.moves, stars: 14, bumps: 1, tickets: 1 });
    expect(tally.moves).toBeGreaterThan(0);
    expect(cues.at(-1)).toBe("tickets-won");
    expect({
      tick: state.tick, area: state.area, arcade: state.arcade, dialogue: state.dialogue,
      tickets: state.tickets, coins: state.coins, keeper: state.critters["arcade-keeper"],
    }).toEqual({
      tick: 2227, area: "arcade", arcade: null, dialogue: null, tickets: 28, coins: 23,
      keeper: "calm",
    });
  });
});
