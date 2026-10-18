import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("art teacher replay", () => {
  it("finds Ms. Rowan, opens the art room, and reads its four look points", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const field = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/pass-party/field.json", "utf8")), "field.json");
    const fieldEnd = field.reduce((sum, segment) => sum + segment.ticks, 0);
    const areas: string[] = [];
    const knots: string[] = [];
    const battles: string[] = [];
    const path = "tests/sim/scripts/pass-party/art.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= fieldEnd) continue;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) knots.push(knot);
        if (before.battle === null && state.battle !== null) battles.push(state.battle.critterId);
      }
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(areas).toEqual(["field", "gym", "east-hall", "art-room"]);
    expect(knots).toEqual(["art_room", "art_teacher", "art_easels", "art_paintings",
      "art_sink", "art_markers"]);
    expect(battles).toEqual(["art-teacher"]);
    expect({ stash: story("stash_found"), out: story("art_teacher_out"), open: story("art_open") })
      .toEqual({ stash: true, out: true, open: true });
    expect(state.stickers).toContain("art-teacher");
    expect(state.coins).toBe(90);
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "art-room", dialogue: null, battle: null });
  }, 30_000);
});
