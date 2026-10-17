import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, propStateName, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 43: the recorded clubhouse fix-up, on from the woods
// run. Up the ladder, the fridge fixed and the garden planted; down in the
// woods, critters calmed (climbing up and back down for fresh ones) until the
// strawberries are ripe; up again, the strawberries into the fridge and three
// snacks out of it.
describe("clubhouse replay", () => {
  it("fixes the fridge, grows the garden by calming critters, and packs the snacks", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const areas: string[] = [];
    const knots: string[] = [];
    const calmsAfterBattles: unknown[] = [];
    const path = "tests/sim/scripts/pass-party/clubhouse.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
        if (before.battle !== null && state.battle === null &&
            world.storyVariable(state.ink, "clubhouse_claimed") === true)
          calmsAfterBattles.push(world.storyVariable(state.ink, "garden_calms"));
      }
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    // It ends up the ladder, after a last trip down.
    expect(areas.slice(-5)).toEqual(["clubhouse", "woods", "clubhouse", "woods", "clubhouse"]);
    expect(knots.slice(-2)).toEqual(["club_garden", "club_fridge"]);
    expect(knots).toContain("clubhouse");
    // The calm hook counted every calm after the planting, up to ripe (3).
    expect(calmsAfterBattles.slice(-4)).toEqual(["1", "2", "3", "3"]);
    const club = world.areas.clubhouse;
    if (club === undefined) throw new Error("no clubhouse");
    const shown = (id: string): string | undefined => {
      const prop = club.props.find((item) => item.id === id);
      return prop === undefined ? undefined : propStateName(world, state.ink, prop);
    };
    expect({ fridge: shown("fridge"), garden: shown("garden") })
      .toEqual({ fridge: "fixed", garden: "growing" });
    expect({ fixed: story("fridge_fixed"), planted: story("garden_planted"),
      baskets: story("fridge_baskets"), ripe: story("garden_ripe") })
      .toEqual({ fixed: true, planted: true, baskets: "0", ripe: false });
    // Two snacks at the start, three from the fridge.
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle,
      snacks: state.snacks })
      .toEqual({ area: "clubhouse", dialogue: null, battle: null, snacks: 5 });
    expect(journalNotes(world, state)).toContain(
      "Jordan planted strawberries on the clubhouse deck. Every critter I calm helps them grow.");
  });
});
