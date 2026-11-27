import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, stableHash, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Deterministic Living NPCs & Organic World Intelligence tour
// (tools/sim/record-living-npcs.ts): chains from golden-bay.json, visits
// Captain Sal, Kai, and Nora in Bubblegum Bay, takes the Star Bus to
// Cloverhollow Plaza to visit Flora, Mailman Gus, and Sammy, then walks down
// to Meadow Park to solve Pippa's riddle and visit Grandma Hazel.

const { world, fixtures } = loadContent();

type ReplayTrace = {
  state: State;
  knots: Set<string>;
  salSueInterjection: boolean;
  floraSueInterjection: boolean;
};

function replay(path: string): ReplayTrace {
  const fixture = fixtures["new-game"];
  if (fixture === undefined) throw new Error("new-game fixture missing");
  let state: State = createState(world, fixture);
  const knots = new Set<string>();
  let salSueInterjection = false;
  let floraSueInterjection = false;

  for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path)) {
    for (let tick = 0; tick < segment.ticks; tick += 1) {
      state = step(world, state, segment.frame).state;
      const dialogue = state.dialogue;
      if (dialogue === null) continue;
      knots.add(dialogue.knot);
      if (
        dialogue.knot === "npc_sal" &&
        dialogue.speaker === "Sue" &&
        dialogue.text.includes("Captain Sal")
      ) {
        salSueInterjection = true;
      }
      if (
        dialogue.knot === "npc_flora" &&
        dialogue.speaker === "Sue" &&
        dialogue.text.includes("tulips")
      ) {
        floraSueInterjection = true;
      }
    }
  }
  return { state, knots, salSueInterjection, floraSueInterjection };
}

describe("the Living NPCs tour recording", () => {
  it("visits all eight new townspeople across bay, plaza, and park deterministically", () => {
    const baseline = replay("tests/sim/scripts/new-game/golden-bay.json").state;
    const run = replay("tests/sim/scripts/new-game/living-npcs.json");
    const { state } = run;

    expect(state.area).toBe("park");
    for (const knot of [
      "npc_sal",
      "npc_kai",
      "npc_nora",
      "npc_flora",
      "npc_gus",
      "npc_sammy_plaza",
      "npc_pippa",
      "npc_hazel",
    ]) {
      expect(run.knots.has(knot), `expected to visit ${knot}`).toBe(true);
    }

    expect(run.salSueInterjection).toBe(true);
    expect(run.floraSueInterjection).toBe(true);

    expect(state.coins).toBe(53);
    expect(state.snacks).toBe(7);
    expect(state.coins - baseline.coins).toBe(5);
    expect(state.snacks - baseline.snacks).toBe(5);
    expect(state.tick).toBe(9193);
    expect(stableHash(state)).toBe("19875e33");
  });
});
