import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded school run (tools/sim/record-school.ts): from the arcade's
// ending, back to school for story time, the classroom, a glimpse of the kid
// in the purple hood running off toward the gym, and the gym doors, locked
// during story time.
describe("school replay", () => {
  it("goes from the arcade to story time and a glimpse of the purple hood", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/school.json";
    let state: State = createState(world, fixture);
    const areas: string[] = [];
    const knots: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(world, state, segment.frame).state;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
      }
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(areas.slice(-5)).toEqual(["plaza", "school", "classroom", "school", "east-hall"]);
    expect(knots.slice(-7)).toEqual(["teacher", "rosie", "milo", "art_wall",
      "classroom_teacher", "hood_glimpse", "gym_hall"]);
    expect({ storyTime: story("story_time"), inHall: story("maple_in_hall"),
      waiting: story("hood_waiting"), saw: story("saw_hood") })
      .toEqual({ storyTime: true, inHall: false, waiting: false, saw: true });
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "east-hall", dialogue: null, battle: null });
    const notes = journalNotes(world, state);
    expect(notes[0]).toBe(
      "The gym doors are locked during story time. Ms. Maple will know when it's over.");
    expect(notes[1]).toMatch(/^A kid in a purple hood ran off/);
  });
});
