import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded Boop-a-Mole run (tools/sim/record-mole.ts): Mr. Pip calmed, a
// round with most moles booped (one while it was still rising), two let go,
// and two squeaks, then the cabinet looked at again.
describe("Boop-a-Mole replay", () => {
  it("boops 14 of 16 moles, squeaks twice, and pays 28 tickets once", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.arcade;
    if (fixture === undefined) throw new Error("missing the arcade fixture");
    const path = "tests/sim/scripts/arcade/mole.json";
    const mole = world.arcade.mole;
    let state: State = createState(world, fixture);
    const results: string[] = [];
    const cues: string[] = [];
    const coinsAtOpen: number[] = [];
    const ticketsPaid: number[] = [];
    // Each boop: the stage the mole was in when the hammer hit it.
    const boopedWhile: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.arcade === null && state.arcade !== null)
          coinsAtOpen.push(before.coins - state.coins);
        const was = before.arcade;
        const game = state.arcade;
        if (was?.game === "mole" && game?.game === "mole" && game.booped > was.booped)
          boopedWhile.push(was.stage);
        if (game?.game === "mole" && was?.phase !== "result" && game.phase === "result")
          results.push(game.message);
        if (state.tickets !== before.tickets) ticketsPaid.push(state.tickets - before.tickets);
        if (before.arcade !== null || state.arcade !== null)
          cues.push(...soundCues(before, state, world).filter((cue) =>
            cue.startsWith("mole-") || cue === "tickets-won"));
      }

    expect(results).toEqual([mole.lines.result.replace("{booped}", "14")
      .replace("{moles}", String(mole.moles))
      .replace("{tickets}", String(14 * mole.ticketsPerBoop))]);
    expect(results).toEqual(["You booped 14 of 16 moles! +28 tickets."]);
    expect(coinsAtOpen).toEqual([2]);
    expect(ticketsPaid).toEqual([14 * mole.ticketsPerBoop]);
    // Every boop hit a mole that was out: thirteen up, one still rising.
    expect(boopedWhile.filter((stage) => stage === "up")).toHaveLength(13);
    expect(boopedWhile.filter((stage) => stage === "rising")).toHaveLength(1);
    const count = (cue: string): number => cues.filter((item) => item === cue).length;
    expect({ pops: count("mole-pop"), boops: count("mole-boop"), whiffs: count("mole-whiff"),
      tickets: count("tickets-won") }).toEqual({ pops: 16, boops: 14, whiffs: 2, tickets: 1 });
    expect(cues.at(-1)).toBe("tickets-won");
    expect({
      tick: state.tick, area: state.area, arcade: state.arcade, dialogue: state.dialogue,
      tickets: state.tickets, coins: state.coins, keeper: state.critters["arcade-keeper"],
    }).toEqual({
      tick: 2065, area: "arcade", arcade: null, dialogue: null, tickets: 28, coins: 23,
      keeper: "calm",
    });
  });
});
