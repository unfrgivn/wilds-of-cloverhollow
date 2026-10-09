import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("music replay", () => {
  it("replays the east hall, bird, song, and flute run", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/music.json";
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
    expect(areas.slice(-4)).toEqual(["east-hall", "gym", "east-hall", "music"]);
    expect(knots.slice(-4)).toEqual([
      "back_door", "music_teacher", "music_bird_calm", "xylophone",
    ]);
    expect(battles).toContain("music-bird");
    expect(state.critters["music-bird"]).toBe("calm");
    expect({ music: story("music_time"), quest: story("music_quest"),
      heard: story("heard_bird"), flute: story("has_flute") })
      .toEqual({ music: true, quest: true, heard: true, flute: true });
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "music", dialogue: null, battle: null });
    expect(journalNotes(world, state)).toContain(
      "Ms. Willow gave me her very first flute! When I play it, animal friends come running.",
    );
  });
});
