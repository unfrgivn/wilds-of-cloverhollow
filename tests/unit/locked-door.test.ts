import { describe, expect, it } from "vitest";
import { createState, step, type ActionFrame, type State, type World } from "../../src/core";
import { createInkState, runInk } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Milestone 14 contract: a door trigger can require a story variable,
// `requires: { variable, knot }`. While the variable is false, crossing into
// the trigger plays `knot` as a dialogue and Fae stays where she is; crossing
// in again plays it again. Once the variable is true, the door works as usual.
// Real content: the bedroom door, locked here until breakfast (ate_breakfast,
// set by Mom's conversation).

const content = loadContent();
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const fixture = content.fixtures["new-game"];
const bedroom = content.world.areas.bedroom;
if (fixture === undefined || bedroom === undefined) throw new Error("content missing");

const world: World = {
  ...content.world,
  areas: {
    ...content.world.areas,
    bedroom: {
      ...bedroom,
      triggers: bedroom.triggers.map((trigger) => trigger.id === "hall-door"
        ? { ...trigger, requires: { variable: "ate_breakfast", knot: "fridge" } }
        : trigger),
    },
  },
};

function hold(state: State, y: number, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks; tick += 1)
    next = step(world, next, { ...none, move: { x: 0, y } }).state;
  return next;
}

function closeDialogue(state: State): State {
  let next = state;
  for (let count = 0; count < 20 && next.dialogue !== null; count += 1) {
    next = step(world, next, none).state;
    next = step(world, next, { ...none, confirm: true }).state;
  }
  return next;
}

describe("a door that needs a story variable", () => {
  it("plays its knot instead while the variable is false, every time Fae walks in", () => {
    let state = hold(createState(world, fixture), -1, 30);
    expect(state.area).toBe("bedroom");
    expect(state.transition).toBeNull();
    expect(state.dialogue?.knot).toBe("fridge");
    state = closeDialogue(state);
    expect(state.dialogue).toBeNull();
    state = hold(state, -1, 20);
    expect(state.dialogue, "still inside the doorway: nothing new").toBeNull();
    expect(state.area).toBe("bedroom");
    state = hold(state, 1, 15);
    state = hold(state, -1, 20);
    expect(state.dialogue?.knot, "walking in again").toBe("fridge");
    expect(state.area).toBe("bedroom");
  });

  it("works as a door once the variable is true", () => {
    const story = content.world.story;
    const greeting = runInk(story, createInkState(story, 1), { type: "start", knot: "mom" });
    const ink = runInk(story, greeting.ink, { type: "choose", index: 0 }).ink;
    let state: State = { ...createState(world, fixture), ink };
    state = hold(state, -1, 30);
    expect(state.dialogue).toBeNull();
    for (let tick = 0; tick < 60; tick += 1) state = step(world, state, none).state;
    expect(state.area).toBe("kitchen");
  });
});
