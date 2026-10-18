import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, propStateName, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("hooded kid replay", () => {
  it("traces, talks, reveals Milo, and restores the forest", () => {
    const content = loadContent();
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(content.world, fixture);
    const path = "tests/sim/scripts/pass-party/kid.json";
    const knots: string[] = [];
    const grades: string[] = [];
    const messages = new Set<string>();
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(content.world, state, segment.frame).state;
        const knot = state.dialogue?.knot ?? state.battle?.talk?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
        if (state.battle !== null) messages.add(state.battle.message);
        const grade = state.battle?.lastGrade;
        if (grade !== null && grade !== undefined && grades.at(-1) !== grade)
          grades.push(grade);
      }
    const story = (name: string): unknown => content.world.storyVariable(state.ink, name);
    expect(state.tick).toBe(19034);
    expect(state.area).toBe("enchanted");
    expect(state.dialogue).toBeNull();
    expect(state.battle).toBeNull();
    expect(knots).toEqual(expect.arrayContaining([
      "kid_talk_1", "kid_talk_2", "kid_talk_3", "milo_calm",
    ]));
    expect(grades).toEqual(expect.arrayContaining(["great", "good"]));
    // Talk's turns open with the kid listening, not the button's label.
    expect(messages.has("The kid stops scribbling... and listens.")).toBe(true);
    expect(messages.has("Talk")).toBe(false);
    expect(state.critters["hooded-kid"]).toBe("calm");
    expect(state.stickers).toContain("hooded-kid");
    expect(state.coins).toBe(159);
    expect(story("forest_fizzy")).toBe(false);
    expect(state.player).toEqual({ x: 1125.3605536091736, y: 775.5211655955634 });
    const area = content.world.areas.enchanted;
    if (area === undefined) throw new Error("enchanted area missing");
    const overlays = area.props.filter((item) =>
      item.id.endsWith("scribbles") || item.id === "pond-fizz");
    for (const prop of overlays)
      expect(propStateName(content.world, state.ink, prop)).not.toBe("fizzy");
    expect(content.world.storyVariable(state.ink, "milo_revealed")).toBe(true);
  }, 30_000);
});
