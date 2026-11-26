import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, starGemsFound, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 80: chained from golden-squirrel.json, Fae walks to
// Cliffside Trail, calms & befriends Ribbon Bunny, calls her with the flute,
// hops her into the rocky burrow for the Citrine Star Gem, calls Flute Assist
// in battle for +40 calm and +1 Together sparkle star, and finishes the battle.
describe("bunny & star gems replay", () => {
  it("befriends Ribbon Bunny, collects the Citrine Star Gem, and uses Flute Assist", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("new-game fixture missing");
    let state: State = createState(world, fixture);
    const base = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/new-game/golden-squirrel.json", "utf8",
    )), "golden-squirrel.json");
    const baseEnd = base.reduce((sum, segment) => sum + segment.ticks, 0);
    const knots: string[] = [];
    const joined: string[] = [];
    let fluteAssistSeen = false;
    let sparkleFromAssist = 0;
    const path = "tests/sim/scripts/new-game/bunny-gems.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= baseEnd) continue;
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) knots.push(knot);
        for (const member of state.party)
          if (!before.party.some((item) => item.id === member.id)) joined.push(member.id);
        if (before.battle?.fluteUsed !== true && state.battle?.fluteUsed === true) {
          fluteAssistSeen = true;
          sparkleFromAssist = state.battle.sparkle ?? 0;
        }
      }
    expect(knots).toEqual(["bunny_calm", "bunny_calm", "flute", "trail_gem"]);
    expect(joined).toEqual(["ribbon-bunny"]);
    expect(fluteAssistSeen).toBe(true);
    expect(sparkleFromAssist).toBeGreaterThanOrEqual(1);
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(["bunny_friend", "bunny_with_me", "gem_trail"].map(story))
      .toEqual([true, true, true]);
    expect(starGemsFound(world, state)).toEqual({ found: 1, total: 7 });
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "trail", dialogue: null, battle: null });
    expect(journalNotes(world, state).slice(0, 2)).toEqual([
      "I've found 1 of Cloverhollow's 7 Star Gems! Grandpa Barnaby at Bon Appetit Cafe loves " +
        "hearing about them.",
      "Ribbon Bunny is my friend! When I play my flute, she comes hopping right over.",
    ]);
  }, 30_000);
});
