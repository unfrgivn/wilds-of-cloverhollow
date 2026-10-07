import { describe, expect, it } from "vitest";
import {
  battleView,
  inkFacts,
  createState,
  step,
  targetInteractable,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

describe("generic critter battle content", () => {
  it("starts from a second content critter id and reports its atlas centroids", () => {
    const loaded = loadContent();
    const frog = loaded.world.critters.frog;
    const area = loaded.world.areas.plaza;
    const fixture = loaded.fixtures.plaza;
    if (frog === undefined || area === undefined || fixture === undefined)
      throw new Error("content missing");
    const pup = {
      ...frog,
      id: "test-critter",
      name: "Test Critter",
      calmName: "Calm Test Critter",
      sticker: { ...frog.sticker, id: "test-sticker" },
      auraCentre: { x: 250, y: 270 },
      bodyCentre: { x: 245, y: 305 },
    };
    const world = {
      ...loaded.world,
      critters: { frog, "test-critter": pup },
      areas: {
        ...loaded.world.areas,
        plaza: {
          ...area,
          critters: [
            ...area.critters,
            { id: "test-critter", point: { x: 500, y: 850 } },
          ],
        },
      },
    };
    const start = {
      ...createState(world, fixture),
      player: { x: 574, y: 850 },
    };
    const result = step(world, start, {
      move: { x: -1, y: 0 },
      confirm: false,
      cancel: false,
      menu: false,
    }).state;
    expect(result.battle?.critterId).toBe("test-critter");
    const view = battleView(world, result);
    expect(view?.critterName).toBe("Test Critter");
    expect(view?.auraCentre).toEqual({ x: 250, y: 270 });
    expect(view?.bodyCentre).toEqual({ x: 245, y: 305 });

    // Win it: a Soothe aim one good press short of calm, pressed on target,
    // then confirm through the messages and the reward.
    const none = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
    const battle = result.battle;
    if (battle === null) throw new Error("no battle");
    let state: State = {
      ...result,
      battle: {
        ...battle,
        phase: "aim",
        message: "",
        revealed: 0,
        command: "soothe",
        calm: pup.calmMax - 1,
        aim: { side: "critter", ticks: 60, targetTick: 39, greatWindow: 5, goodWindow: 11 },
        aimTick: 38,
      },
    };
    state = step(world, state, none).state;
    state = step(world, state, { ...none, confirm: true }).state;
    expect(state.battle?.rewardSticker).toBe("test-sticker");
    for (let count = 0; count < 400 && state.battle !== null; count += 1) {
      state = step(world, state, none).state;
      state = step(world, state, { ...none, confirm: true }).state;
    }
    expect(state.battle).toBeNull();
    expect(state.stickers).toEqual(["test-sticker"]);
    expect(state.critters).toMatchObject({ "test-critter": "calm", frog: "chaos" });
    expect(inkFacts(state).calmed).toMatchObject({ "test-critter": true, frog: false });
    // Calm now: facing it gives its calm talk, not a battle.
    const facing: State = { ...state, player: { x: 545, y: 850 }, facing: "left" };
    expect(targetInteractable(world, facing)).toMatchObject({
      id: "critter:test-critter", knot: pup.calmKnot, prompt: pup.calmPrompt,
    });
    expect(step(world, facing, { ...none, move: { x: -1, y: 0 } }).state.battle).toBeNull();
  });
});
