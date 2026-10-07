import { readFileSync } from "node:fs";
import { Compiler } from "inkjs/full";
import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  createStoryReader,
  step,
  type ActionFrame,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Story travel (spec 7): the target of a `# travel:` line is kept until the
// conversation closes, even when more lines follow it.

const content = loadContent();
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function worldWith(knot: string): World {
  const compiler = new Compiler(`${readFileSync("content/story/main.ink", "utf8")}\n${knot}\n`);
  compiler.Compile();
  if ((compiler.errors ?? []).length > 0) throw new Error((compiler.errors ?? []).join("\n"));
  const json = compiler.runtimeStory?.ToJson();
  if (typeof json !== "string") throw new Error("no story");
  const story: unknown = JSON.parse(json);
  if (!isRecord(story)) throw new Error("story is not an object");
  return { ...content.world, story, storyVariable: createStoryReader(story) };
}

function talkThrough(world: World, state: State, knot: string): State {
  const harness = world.areas["harness"];
  if (harness === undefined) throw new Error("no harness");
  const look: "Look" = "Look";
  const sign = { id: "sign", knot, point: { x: 300, y: 540 }, prompt: look };
  world = { ...world, areas: { ...world.areas, harness: { ...harness, interactables: [sign] } } };
  state = { ...state, player: { x: 300, y: 590 }, facing: "up" };
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  if (state.dialogue === null) throw new Error("the talk did not open");
  for (let tick = 0; tick < 600 && state.dialogue !== null; tick += 1)
    state = step(world, state, press({ confirm: tick % 2 === 1 })).state;
  return state;
}

describe("story travel", () => {
  it("keeps the target through the lines after the tagged one", () => {
    const knot = [
      "=== ride ===",
      "All aboard! # travel: plaza.bus-stop",
      "The bus rumbles off down the mountain. # speaker: Fae",
      "-> DONE",
    ].join("\n");
    const world = worldWith(knot);
    const start = createState(world, { area: "harness", spawn: "start", seed: 1 });
    const state = talkThrough(world, start, "ride");
    expect(state.dialogue).toBeNull();
    expect(state.transition?.target).toEqual({ area: "plaza", spawn: "bus-stop" });
  });

  it("goes nowhere without a tag", () => {
    const knot = ["=== stay ===", "Nothing to see here. # speaker: Fae", "-> DONE"].join("\n");
    const world = worldWith(knot);
    const start = createState(world, { area: "harness", spawn: "start", seed: 1 });
    const state = talkThrough(world, start, "stay");
    expect(state.dialogue).toBeNull();
    expect(state.transition).toBeNull();
  });
});
