import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 60: the recorded second flute friend, on from the
// kitchen run (the clubhouse). Down to the woods, through the pass to the
// trail; a squirrel calmed, his tale, a chin scratch and a snack; the flute
// calls him; back in the woods he climbs the big oak to its knothole.
describe("squirrel replay", () => {
  it("befriends a trail squirrel, calls him, and finds the golden acorn", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const kitchen = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/pass-party/kitchen.json", "utf8")), "kitchen.json");
    const kitchenEnd = kitchen.reduce((sum, segment) => sum + segment.ticks, 0);
    const areas: string[] = [];
    const knots: string[] = [];
    const battles: string[] = [];
    const joined: string[] = [];
    const paid: { knot: string | undefined; snacks: number }[] = [];
    const path = "tests/sim/scripts/pass-party/squirrel.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= kitchenEnd) continue;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) knots.push(knot);
        if (before.battle === null && state.battle !== null) battles.push(state.battle.critterId);
        for (const member of state.party)
          if (!before.party.some((item) => item.id === member.id)) joined.push(member.id);
        if (state.snacks !== before.snacks)
          paid.push({ knot, snacks: state.snacks - before.snacks });
      }
    expect(areas).toEqual(["clubhouse", "woods", "pass", "trail", "pass", "woods"]);
    expect(battles).toEqual(["squirrel"]);
    // His tale and his bond (two talks), the flute, and the knothole.
    expect(knots).toEqual(["squirrel_calm", "squirrel_calm", "flute", "oak_knothole"]);
    expect(joined).toEqual(["acorn-squirrel"]);
    // A snack shared, and three hazelnuts back.
    expect(paid).toEqual([{ knot: "squirrel_calm", snacks: -1 },
      { knot: "oak_knothole", snacks: 3 }]);
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(["squirrel_friend", "squirrel_with_me", "acorn_found", "pup_with_me"].map(story))
      .toEqual([true, true, true, false]);
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "woods", dialogue: null, battle: null });
    expect(journalNotes(world, state).slice(0, 2)).toEqual([
      "The Acorn Squirrel climbed the big oak in the woods and found a golden acorn in its " +
      "knothole!",
      "The Acorn Squirrel is my friend! When I play my flute, he comes scampering.",
    ]);
  }, 30_000);
});
