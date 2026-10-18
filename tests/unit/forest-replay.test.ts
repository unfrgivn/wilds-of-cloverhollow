import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, propStateName, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("forest replay", () => {
  it("opens the forest and records its story beats", () => {
    const content = loadContent();
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(content.world, fixture);
    const path = "tests/sim/scripts/pass-party/forest.json";
    const knots: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(content.world, state, segment.frame).state;
        const knot = state.dialogue?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
      }
    const story = (name: string): unknown => content.world.storyVariable(state.ink, name);
    expect(state.tick).toBe(18648);
    expect(state.area).toBe("enchanted");
    expect(state.dialogue).toBeNull();
    expect(knots).toEqual(expect.arrayContaining([
      "fairy_lavender", "mystic_pond", "ancient_tree", "forest_kid",
    ]));
    expect({ seal: story("seal_open"), wish: story("heard_wish"), kid: story("saw_tree_kid"),
      fizzy: story("forest_fizzy") }).toEqual({ seal: true, wish: true, kid: true, fizzy: true });
    const area = content.world.areas.enchanted;
    if (area === undefined) throw new Error("enchanted area missing");
    const states = Object.fromEntries(["tree-scribbles", "pond-fizz"].map((id) => {
      const prop = area.props.find((item) => item.id === id);
      if (prop === undefined) throw new Error(`missing prop ${id}`);
      return [id, propStateName(content.world, state.ink, prop)];
    }));
    expect(states).toEqual({ "tree-scribbles": "fizzy", "pond-fizz": "fizzy" });
  }, 30_000);
});
