import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { journalNotes, createState, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The three Milestone 69 recordings (tools/sim/record-crab.ts,
// record-penguin.ts, record-principal.ts): each chains from a golden
// checkpoint, opens its new den or set piece the way a player would, and
// calms the new bad guy. Every run ends exactly where its recorder asserted.

const content = loadContent();
const world = content.world;

function replay(path: string): State {
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("new-game fixture missing");
  let state: State = createState(world, fixture);
  for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
    for (let tick = 0; tick < segment.ticks; tick += 1)
      state = step(world, state, segment.frame).state;
  return state;
}

describe("the crab recording", () => {
  it("calms Ms. Coral, re-enters the bay, and calms a Snappy Crab", () => {
    const state = replay("tests/sim/scripts/new-game/crab.json");
    expect(state.tick).toBe(8130);
    expect(state.area).toBe("bay");
    expect(state.critters.lifeguard).toBe("calm");
    expect(state.wild.find((critter) => critter.kind === "crab")?.mood).toBe("calm");
    expect(state.stickers).toContain("sandy-crab");
    expect(state.stickers).toContain("lifeguard");
    // Her watermelon gift and the crab's coins.
    expect(state.snacks).toBeGreaterThanOrEqual(3);
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I calmed Ms. Coral, the lifeguard at Bubblegum Bay. She shared her watermelon!");
  });
});

describe("the penguin recording", () => {
  it("leaves Mrs. Flurry's lodge and calms a Slippy Penguin on the pass", () => {
    const state = replay("tests/sim/scripts/new-game/penguin.json");
    expect(state.tick).toBe(10490);
    expect(state.area).toBe("pass");
    expect(state.critters["lodge-keeper"]).toBe("calm");
    expect(state.wild.find((critter) => critter.kind === "penguin")?.mood).toBe("calm");
    expect(state.stickers).toContain("waddle-penguin");
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I calmed Mrs. Flurry, the lodge keeper at Pinecone Pass. Her lodge is open, " +
      "and the fire's lit!");
  });
});

describe("the principal recording", () => {
  it("reads the megaphone and calms Mr. Bell in the school hall", () => {
    const state = replay("tests/sim/scripts/new-game/principal.json");
    expect(state.tick).toBe(13795);
    expect(state.area).toBe("school");
    expect(state.critters.principal).toBe("calm");
    expect(state.stickers).toContain("principal");
    const notes = journalNotes(world, state);
    expect(notes).toContain(
      "I calmed Mr. Bell, the principal! Morning announcements sound like morning again.");
    expect(notes).not.toContain(
      "Mr. Bell the principal is fizzy in the hall, blaring announcements at everybody!");
  });
});
