import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("Pinecone Pass bus replay", () => {
  it("calms the bluebird, rides up, looks at the sign, and rides home", () => {
    const content = loadContent();
    const path = "tests/sim/scripts/bay/bus.json";
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    const fixture = content.fixtures.bay;
    if (fixture === undefined) throw new Error("bay fixture missing");
    let state: State = createState(content.world, fixture);
    for (const segment of script)
      for (let tick = 0; tick < segment.ticks; tick += 1)
        state = step(content.world, state, segment.frame).state;
    expect(state.area).toBe("plaza");
    expect(state.player).toEqual({ x: 878, y: 985 });
    expect(state.critters.bluebird).toBe("calm");
    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    expect(content.world.storyVariable(state.ink, "rode_bus")).toBe(true);
  });
});
