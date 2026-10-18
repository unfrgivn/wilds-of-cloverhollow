import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, propState, propStateName, soundCues, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

describe("mist replay", () => {
  it("crosses the band and gully and opens the seal", () => {
    const content = loadContent();
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(content.world, fixture);
    const path = "tests/sim/scripts/pass-party/mist.json";
    const knots: string[] = [];
    const sounds: string[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(content.world, state, segment.frame).state;
        sounds.push(...soundCues(before, state, content.world));
        const knot = state.dialogue?.knot;
        if (knot !== undefined && knots.at(-1) !== knot) knots.push(knot);
      }
    const story = (name: string): unknown => content.world.storyVariable(state.ink, name);
    expect(state.tick).toBe(18164);
    expect(state.area).toBe("mist");
    expect(state.dialogue).toBeNull();
    expect(knots).toEqual(expect.arrayContaining(["mist_flowers", "gully_bridge", "mist_seal"]));
    expect({ way: story("found_mist_way"), bridge: story("rope_bridge"), seal: story("seal_open") })
      .toEqual({ way: true, bridge: true, seal: true });
    const area = content.world.areas.mist;
    if (area === undefined) throw new Error("mist area missing");
    const fresh = createState(content.world, { ...fixture, area: "mist", spawn: "field" });
    const freshState = (id: string): string => {
      const prop = area.props.find((item) => item.id === id);
      if (prop === undefined) throw new Error(`missing prop ${id}`);
      return propStateName(content.world, fresh.ink, prop);
    };
    const freshStones = area.props.find((item) => item.id === "mist-stones");
    const freshSeal = area.props.find((item) => item.id === "seal-open");
    if (freshStones === undefined || freshSeal === undefined)
      throw new Error("missing added props");
    expect({ rope: freshState("rope-bridge"), stones: freshState("mist-stones"),
      seal: freshState("seal-open"),
      stonesHidden: propState(content.world, fresh.ink, freshStones).hidden,
      sealHidden: propState(content.world, fresh.ink, freshSeal).hidden })
      .toEqual({ rope: "default", stones: "default", seal: "default",
        stonesHidden: true, sealHidden: true });
    const shown = (id: string): string => {
      const prop = area.props.find((item) => item.id === id);
      if (prop === undefined) throw new Error(`missing prop ${id}`);
      return propStateName(content.world, state.ink, prop);
    };
    expect({ rope: shown("rope-bridge"), stones: shown("mist-stones"), seal: shown("seal-open") })
      .toEqual({ rope: "across", stones: "found", seal: "open" });
    expect(sounds).toEqual(expect.arrayContaining(["flute-red", "flute-yellow",
      "flute-green", "flute-blue"]));
  }, 30_000);
});
