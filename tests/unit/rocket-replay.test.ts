import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The recorded rocket cabinet run (tools/sim/record-rocket.ts): Fae looks at
// the arcade's new cabinet while Mr. Pip's spell still fizzes on it, calms
// him, and looks again (Milestone 58).
describe("rocket cabinet replay", () => {
  it("shows the fizzy line before Mr. Pip is calm and the twinkling one after", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.arcade;
    if (fixture === undefined) throw new Error("missing the arcade fixture");
    const path = "tests/sim/scripts/arcade/rocket.json";
    let state: State = createState(world, fixture);
    const lines: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        const line = state.dialogue;
        if (line?.knot === "rocket_cabinet" && line.text !== before.dialogue?.text)
          lines.push(line.text);
      }
    expect(lines).toEqual([
      "A purple cabinet with a rocket on its side, all fizzy with purple scribbles.",
      "A purple cabinet with a neon rocket on its side. Stars twinkle across its screen.",
    ]);
    expect({
      tick: state.tick, area: state.area, dialogue: state.dialogue,
      keeper: state.critters["arcade-keeper"],
    }).toEqual({ tick: 1086, area: "arcade", dialogue: null, keeper: "calm" });
  });
});
