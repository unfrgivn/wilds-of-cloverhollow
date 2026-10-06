import { describe, expect, it } from "vitest";
import {
  createState,
  npcFacing,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { createInkState, runInk } from "../../src/core/ink";
import { loadContent, parseCharacters } from "../../src/content/load";

const content = loadContent();
const world = content.world;
const kitchen = world.areas.kitchen;
if (kitchen === undefined) throw new Error("kitchen missing");
const maybeMom = kitchen.npcs.find((npc) => npc.id === "mom");
if (maybeMom === undefined) throw new Error("mom missing");
const mom = maybeMom;
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };

function inKitchen(x: number, y: number, facing: State["facing"]): State {
  const state = createState(world, { area: "kitchen", spawn: "stairs", seed: 1 }, 1);
  return { ...state, player: { x, y }, facing };
}

describe("people in areas", () => {
  it("targets Mom from in front, with her Talk prompt and knot", () => {
    const below = inKitchen(mom.point.x, mom.point.y + 55, "up");
    expect(targetInteractable(world, below)).toMatchObject({
      id: "npc:mom", knot: "mom", prompt: "Talk",
    });
    expect(targetInteractable(world, { ...below, facing: "down" }),
      "facing away, nothing").toBeUndefined();
    expect(targetInteractable(world, inKitchen(mom.point.x, mom.point.y + 90, "up")),
      "out of range").toBeUndefined();
  });

  it("faces Fae only while she talks to them, along the larger gap", () => {
    const talking = (x: number, y: number): State => ({
      ...inKitchen(x, y, "up"),
      dialogue: { knot: "mom", speaker: "Mom", text: "Hi", revealed: 2, choices: [],
        selected: 0, ended: false },
    });
    expect(npcFacing(inKitchen(mom.point.x + 40, mom.point.y, "left"), mom))
      .toBe(mom.facing);
    expect(npcFacing(talking(mom.point.x, mom.point.y + 55), mom)).toBe("down");
    expect(npcFacing(talking(mom.point.x + 40, mom.point.y + 5), mom)).toBe("right");
    expect(npcFacing(talking(mom.point.x - 40, mom.point.y - 5), mom)).toBe("left");
    expect(npcFacing(talking(mom.point.x + 5, mom.point.y - 40), mom)).toBe("up");
    const otherTalk = { ...talking(mom.point.x + 40, mom.point.y),
      dialogue: { knot: "oliver", speaker: "Oliver", text: "Ba!", revealed: 3, choices: [],
        selected: 0, ended: false } };
    expect(npcFacing(otherTalk, mom), "another conversation").toBe(mom.facing);
  });

  it("opens Mom's conversation and blocks Fae from walking through her", () => {
    let state = inKitchen(mom.point.x, mom.point.y + 55, "up");
    state = step(world, state, { ...none, confirm: true }).state;
    expect(state.dialogue?.knot).toBe("mom");
    expect(state.dialogue?.speaker).toBe("Mom");
    let walker = inKitchen(mom.point.x + 45, mom.point.y, "left");
    for (let tick = 0; tick < 30; tick += 1)
      walker = step(world, walker, { ...none, move: { x: -1, y: 0 } }).state;
    expect(walker.player.x, "stopped by her footprint").toBeGreaterThanOrEqual(645);
  });

  it("has a story knot for every person, and Mom remembers breakfast", () => {
    for (const area of Object.values(world.areas)) {
      for (const npc of area.npcs) {
        const result = runInk(world.story, createInkState(world.story, 1),
          { type: "start", knot: npc.knot });
        expect(result.line, `${area.id}/${npc.id}`).not.toBeNull();
      }
    }
    let ink = createInkState(world.story, 1);
    let result = runInk(world.story, ink, { type: "start", knot: "mom" });
    for (let count = 0; count < 10 && result.choices.length === 0; count += 1)
      result = runInk(world.story, result.ink, { type: "next" });
    expect(result.choices).toEqual(["Eat a pancake", "Give Mom a hug"]);
    ink = runInk(world.story, result.ink, { type: "choose", index: 1 }).ink;
    const again = runInk(world.story, ink, { type: "start", knot: "mom" });
    expect(again.line?.text).toBe("Have a good day, sweetie. Stay curious!");
  });

  it("people are solid for Maddie too", () => {
    // Fae stands just above Mom (her footprint is x 600-630, y 520-545) and
    // Maddie just below, too far away to stay put: she heads for Fae, and Mom
    // is in the way. She never overlaps Mom's footprint on the way.
    let state: State = inKitchen(615, 480, "down");
    state = { ...state, maddie: { ...state.maddie, x: 615, y: 600 }, trail: [] };
    const radius = world.tunables.follow.radius;
    for (let tick = 0; tick < 120; tick += 1) {
      state = step(world, state, none).state;
      const { x, y } = state.maddie;
      const overlaps = x > 600 - radius && x < 630 + radius && y > 520 - radius && y < 545 + radius;
      expect(overlaps, `tick ${tick}: ${JSON.stringify({ x, y })}`).toBe(false);
    }
  });

  it("validates the characters file", () => {
    expect(() => parseCharacters({ mom: { atlas: "a.json", idleTicks: [180, 8] } }, "c.json"))
      .not.toThrow();
    expect(() => parseCharacters({ mom: { atlas: "a.json", idleTicks: [] } }, "c.json"))
      .toThrow(/c.json/);
    expect(() => parseCharacters({ mom: { atlas: "a.json", idleTicks: [0] } }, "c.json"))
      .toThrow(/c.json/);
    expect(() => parseCharacters({ mom: { idleTicks: [8] } }, "c.json")).toThrow(/c.json/);
    for (const area of Object.values(world.areas))
      for (const npc of area.npcs)
        expect(world.characters[npc.id], `${npc.id} has an atlas`).toBeDefined();
  });
});
