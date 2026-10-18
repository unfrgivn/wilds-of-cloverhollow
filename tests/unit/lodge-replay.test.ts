import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, propStateName, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 57: the recorded lodge keeper, on from Jordan's run
// (Pinecone Pass, the hamster calm). The note leads on and the keeper comes
// home fizzy; she's calmed in battle and opens her lodge; in through its door,
// the fire, the cocoa, and Biscuit.
describe("lodge replay", () => {
  it("brings the keeper home, calms her, and goes into her lodge", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const jordan = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/pass-party/jordan.json", "utf8")), "jordan.json");
    const jordanEnd = jordan.reduce((sum, segment) => sum + segment.ticks, 0);
    const areas: string[] = [];
    const knots: string[] = [];
    const battles: string[] = [];
    const door: string[] = [];
    const prop = world.areas.pass?.props.find((item) => item.id === "lodge-door");
    if (prop === undefined) throw new Error("no lodge door");
    const path = "tests/sim/scripts/pass-party/lodge.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= jordanEnd) continue;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) knots.push(knot);
        if (before.battle === null && state.battle !== null) battles.push(state.battle.critterId);
        const shown = propStateName(world, state.ink, prop);
        if (door.at(-1) !== shown) door.push(shown);
      }
    expect(areas).toEqual(["pass", "lodge"]);
    expect(knots).toEqual(["lodge_door", "lodge_keeper", "lodge_fire", "lodge_cocoa",
      "lodge_hamster"]);
    expect(battles).toEqual(["lodge-keeper"]);
    // The door is shut until she opens the lodge.
    expect(door).toEqual(["default", "open"]);
    expect(state.critters["lodge-keeper"]).toBe("calm");
    expect(state.stickers).toContain("lodge-keeper");
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect([story("keeper_back"), story("lodge_open"), story("lodge_cocoa_had")])
      .toEqual([true, true, true]);
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "lodge", dialogue: null, battle: null });
    expect(journalNotes(world, state)).toContain(
      "I calmed Mrs. Flurry, the lodge keeper at Pinecone Pass. Her lodge is open, and the " +
      "fire's lit!");
  }, 30_000);
});
