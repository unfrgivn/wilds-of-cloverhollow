import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded shop run (tools/sim/record-bakery.ts): coins from the frog buy
// a snack at the bakery, and the pup's battle eats it.
describe("bakery replay", () => {
  it("earns, buys, and spends in that order", () => {
    const content = loadContent();
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const path = "tests/sim/scripts/plaza/bakery.json";
    let state = createState(content.world, fixture);
    const purse: string[] = [`${state.coins} coins, ${state.snacks} snacks`];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(content.world, state, segment.frame).state;
        const now = `${state.coins} coins, ${state.snacks} snacks`;
        if (purse.at(-1) !== now) purse.push(now);
      }
    expect(purse).toEqual([
      "0 coins, 2 snacks",
      "8 coins, 2 snacks",
      "3 coins, 3 snacks",
      "3 coins, 2 snacks",
      "11 coins, 2 snacks",
    ]);
    expect(state.area).toBe("park");
    expect(state.stickers).toEqual(["fountain-frog", "pond-pup"]);
    expect(journalNotes(content.world, state))
      .toContain("I have coins! The bakery in the plaza sells snacks for 5 coins.");
  });
});
