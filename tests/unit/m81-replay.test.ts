import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState,
  journalNotes,
  peekabooStatus,
  step,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Milestone 81 playthrough (tools/sim/record-m81.ts):
// chains from golden-clubhouse.json, summons and calms Starey Owl in Whispering
// Woods via Peekaboo bursts, walks south into Clover Hills, summons and calms
// Chef Mateo through Part 1 + all 3 Talk knots, collects his taco snacks and
// buys a 4-coin crispy taco, and verifies both stickers and journal notes.

const { world, fixtures } = loadContent();

describe("the Milestone 81 Peekaboo & Taco Truck recording", () => {
  it("calms Starry Owl via Peekaboo and Chef Mateo via Talk, collecting both stickers", () => {
    const fixture = fixtures["new-game"];
    if (fixture === undefined) throw new Error("new-game fixture missing");
    let state: State = createState(world, fixture);
    const path = "tests/sim/scripts/new-game/m81-festival.json";
    let sawPeekabooSafe = false;
    let sawPeekabooWatching = false;
    let sawMateoTalk = false;
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path)) {
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(world, state, segment.frame).state;
        const check = state.battle?.check;
        if (check?.kind === "peekaboo") {
          const status = peekabooStatus(check);
          if (status === "safe" && check.progress > 0) sawPeekabooSafe = true;
          if (status === "watching") sawPeekabooWatching = true;
        }
        if (
          state.battle?.critterId === "taco-chef" &&
          state.battle.phase === "talk" &&
          (state.battle.talk?.choices.length ?? 0) === 3
        ) {
          sawMateoTalk = true;
        }
      }
    }
    expect(state.tick).toBe(14492);
    expect(state.area).toBe("hills");
    expect(sawPeekabooSafe).toBe(true);
    expect(sawPeekabooWatching).toBe(true);
    expect(sawMateoTalk).toBe(true);
    expect(state.stickers).toContain("starry-owl");
    expect(state.stickers).toContain("taco-chef");
    expect(state.critters["moon-owl"]).toBe("calm");
    expect(state.critters["taco-chef"]).toBe("calm");
    expect(world.storyVariable(state.ink, "moon_owl_out")).toBe(true);
    expect(world.storyVariable(state.ink, "taco_chef_out")).toBe(true);
    expect(world.storyVariable(state.ink, "mateo_snacks_given")).toBe(true);
    expect(state.coins).toBe(150);
    expect(state.snacks).toBe(8);
    const notes = journalNotes(world, state);
    expect(notes.some((line) => line.includes("Starry Owl"))).toBe(true);
    expect(notes.some((line) => line.includes("Chef Mateo"))).toBe(true);
  });
});
