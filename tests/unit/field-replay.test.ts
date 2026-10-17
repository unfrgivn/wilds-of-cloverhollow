import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, propStateName, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 39: the recorded recess run, on from the music run.
// Out the gym's back door, the oak squirrel calmed, the swing across the
// creek on the old oak's branch, the hooded kid's stash, the lever, and the
// walk back over the footbridge it lays down.
describe("field replay", () => {
  it("swings across the creek, finds the stash, and walks back over the bridge", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const areas: string[] = [];
    const knots: string[] = [];
    const battles: string[] = [];
    let swungFrom: number | undefined;
    let landedAt: number | undefined;
    // The run holds every run chained before it, from the fixture on.
    const path = "tests/sim/scripts/pass-party/field.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (before.battle === null && state.battle !== null) battles.push(state.battle.critterId);
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
        // The swing: a fade within the field, from the near bank to the far one.
        if (before.transition === null && state.transition?.target.spawn === "east-bank")
          swungFrom = before.player.x;
        if (before.transition !== null && state.transition === null && state.area === "field")
          landedAt = state.player.x;
      }
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(areas.slice(-4)).toEqual(["music", "east-hall", "gym", "field"]);
    expect(knots.slice(-4))
      .toEqual(["oak_squirrel_calm", "oak_branch", "hood_stash", "bridge_lever"]);
    expect(battles.at(-1)).toBe("oak-squirrel");
    expect(state.critters["oak-squirrel"]).toBe("calm");
    expect(swungFrom).toBeLessThan(1100);
    expect(landedAt).toBeGreaterThan(1250);
    expect({ recess: story("recess"), swung: story("swung"), stash: story("stash_found"),
      bridge: story("bridge_down") })
      .toEqual({ recess: true, swung: true, stash: true, bridge: true });
    const field = world.areas.field;
    if (field === undefined) throw new Error("no field");
    const shown = (id: string): string | undefined => {
      const prop = field.props.find((item) => item.id === id);
      return prop === undefined ? undefined : propStateName(world, state.ink, prop);
    };
    expect({ bridge: shown("bridge"), lever: shown("lever") })
      .toEqual({ bridge: "lowered", lever: "pulled" });
    // Back over the footbridge: on the near bank, west of the creek.
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "field", dialogue: null, battle: null });
    expect(state.player.x).toBeLessThan(1000);
    expect(journalNotes(world, state)[0]).toBe(
      "I pulled the old footbridge's lever with the lasso, and the bridge swung down " +
      "across the creek!",
    );
  // A long replay of the pass-party chain: room for a busy machine.
  }, 20_000);
});
