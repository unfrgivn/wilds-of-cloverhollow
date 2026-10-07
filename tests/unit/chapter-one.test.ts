import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The whole story so far, played from a new game (recorded by
// tools/sim/chapter-one.ts). If a story or map change breaks the route, rerun
// the recorder; it names the step that no longer fits.
describe("chapter one", () => {
  it("plays from the bedroom to the purple hood in the tree house", () => {
    const content = loadContent();
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("new-game fixture missing");
    const path = "tests/sim/scripts/new-game/chapter-one.json";
    let state: State = createState(content.world, fixture);
    const visited = new Set<string>([state.area]);
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(content.world, state, segment.frame).state;
        visited.add(state.area);
      }
    const story = (name: string): unknown => content.world.storyVariable(state.ink, name);
    expect([...visited].sort()).toEqual(["bedroom", "kitchen", "park", "plaza", "school"]);
    expect(state.area).toBe("park");
    expect(state.battle).toBeNull();
    expect(state.dialogue).toBeNull();
    expect(state.critters)
      .toEqual({ frog: "calm", pup: "calm", bluebird: "chaos", bunny: "chaos", squirrel: "chaos" });
    expect(state.stickers).toEqual(["fountain-frog", "pond-pup"]);
    expect({
      plan: story("plan"),
      ate_breakfast: story("ate_breakfast"),
      hall_pass: story("hall_pass"),
      raccoon_waiting: story("raccoon_waiting"),
      knows_password: story("knows_password"),
      club_open: story("club_open"),
    }).toEqual({
      plan: "now", ate_breakfast: true, hall_pass: true, raccoon_waiting: false,
      knows_password: true, club_open: true,
    });
    expect(journalNotes(content.world, state)[0])
      .toBe("The purple hood in the tree house has a Cloverhollow School name tag. Whose is it?");
  });
});
