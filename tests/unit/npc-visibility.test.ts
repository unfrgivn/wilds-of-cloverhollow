import { describe, expect, it } from "vitest";
import {
  createState,
  npcVisible,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
  type World,
} from "../../src/core";
import { createInkState, inkVariable, runInk } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Milestone 15 contract: people come and go with the story. An area person
// may have `visibleWhile: <Ink VAR>`; while that variable isn't true they
// aren't drawn, can't be talked to, and aren't solid. Each person's solid
// footprint is their own `footprint` polygon (moved out of the area's
// blockers), solid only while they're visible. `npcVisible(world, state, npc)`
// is the rule. Real content: Mom, here shown only once Fae has had breakfast.

const content = loadContent();
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const kitchen = content.world.areas.kitchen;
if (kitchen === undefined) throw new Error("kitchen missing");
const mom = kitchen.npcs.find((npc) => npc.id === "mom");
if (mom === undefined) throw new Error("mom missing");

const world: World = {
  ...content.world,
  areas: {
    ...content.world.areas,
    kitchen: {
      ...kitchen,
      npcs: kitchen.npcs.map((npc) =>
        npc.id === "mom" ? { ...npc, visibleWhile: "ate_breakfast" } : npc),
    },
  },
};
const story = content.world.story;
const fed = runInk(story,
  runInk(story, createInkState(story, 1), { type: "start", knot: "mom" }).ink,
  { type: "choose", index: 0 }).ink;

function inKitchen(x: number, y: number, facing: State["facing"], ink?: string): State {
  const state = createState(world, { area: "kitchen", spawn: "stairs", seed: 1 }, 1);
  return { ...state, player: { x, y }, facing, ink: ink ?? state.ink };
}

function walkLeft(state: State, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks; tick += 1)
    next = step(world, next, { ...none, move: { x: -1, y: 0 } }).state;
  return next;
}

describe("people who come and go with the story", () => {
  it("every person's footprint is their own, and no area blocker duplicates one", () => {
    for (const area of Object.values(content.world.areas))
      for (const npc of area.npcs) {
        expect(npc.footprint.length, `${area.id}/${npc.id}`).toBeGreaterThanOrEqual(3);
        for (const blocker of area.blockers)
          expect(blocker, `${area.id}/${npc.id}`).not.toEqual(npc.footprint);
      }
  });

  it("hidden, a person can't be talked to and isn't solid", () => {
    const below = inKitchen(mom.point.x, mom.point.y + 55, "up");
    expect(npcVisible(world, below, { ...mom, visibleWhile: "ate_breakfast" })).toBe(false);
    expect(targetInteractable(world, below)?.id).not.toBe("npc:mom");
    const walker = walkLeft(inKitchen(mom.point.x + 45, mom.point.y, "left"), 40);
    expect(walker.player.x, "walks through where she'd stand").toBeLessThanOrEqual(605);
  });

  it("visible, the same person talks and is solid", () => {
    const below = inKitchen(mom.point.x, mom.point.y + 55, "up", fed);
    expect(npcVisible(world, below, { ...mom, visibleWhile: "ate_breakfast" })).toBe(true);
    expect(targetInteractable(world, below)?.id).toBe("npc:mom");
    const walker = walkLeft(inKitchen(mom.point.x + 45, mom.point.y, "left", fed), 40);
    expect(walker.player.x, "stopped by her footprint").toBeGreaterThanOrEqual(645);
  });

  it("people without visibleWhile are always there; every visibleWhile is a story variable", () => {
    const state = inKitchen(500, 650, "right");
    for (const area of Object.values(content.world.areas))
      for (const npc of area.npcs) {
        if (npc.visibleWhile === undefined) {
          expect(npcVisible(content.world, state, npc), `${area.id}/${npc.id}`).toBe(true);
          continue;
        }
        expect(inkVariable(story, state.ink, npc.visibleWhile), `${area.id}/${npc.id}`)
          .toBeDefined();
      }
  });
});
