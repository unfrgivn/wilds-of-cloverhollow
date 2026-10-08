import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded gym run (tools/sim/record-gym.ts): from the school run's end
// at the locked gym doors, back to Ms. Maple (time for PE), through the gym
// doors to Coach Ash, the fizzy pup with his stopwatch, the clipboard on the
// hoop, his lasso, and the back door the kid in the purple hood ran out of.
describe("gym replay", () => {
  it("goes from story time to PE, Coach Ash's hunt, and the lasso", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/gym.json";
    let state: State = createState(world, fixture);
    const areas: string[] = [];
    const knots: string[] = [];
    const battles: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state.battle;
        state = step(world, state, segment.frame).state;
        if (before === null && state.battle !== null) battles.push(state.battle.critterId);
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
      }
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(areas.slice(-4)).toEqual(["school", "classroom", "school", "gym"]);
    expect(knots.slice(-9)).toEqual(["gym_hall", "classroom_teacher", "coach", "gym_pup_calm",
      "hoop", "coach", "hoop", "coach", "back_door"]);
    expect(battles.filter((id) => id === "gym-pup")).toEqual(["gym-pup"]);
    expect(state.critters["gym-pup"]).toBe("calm");
    expect({ pe: story("pe_time"), quest: story("gym_quest"), lasso: story("has_lasso"),
      clipboard: story("found_clipboard"), thanked: story("coach_thanked") })
      .toEqual({ pe: true, quest: true, lasso: true, clipboard: true, thanked: true });
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "gym", dialogue: null, battle: null });
    expect(journalNotes(world, state)[0]).toMatch(/^Coach Ash gave me his lasso!/);
  });
});
