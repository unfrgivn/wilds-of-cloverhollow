import { describe, expect, it } from "vitest";
import {
  battleView,
  battleCommands,
  createState,
  gradeAim,
  step,
  targetInteractable,
  type State,
} from "../../src/core";
import {
  loadContent,
  parseBattleContent,
  parseCritter,
} from "../../src/content/load";
import { createInkState, runInk } from "../../src/core/ink";

const content = loadContent();
function plazaFixture() {
  const fixture = content.fixtures.plaza;
  if (fixture === undefined) throw new Error("plaza fixture missing");
  return fixture;
}
const none = {
  move: { x: 0, y: 0 },
  confirm: false,
  cancel: false,
  menu: false,
};
function battleState(): State {
  return {
    ...createState(content.world, plazaFixture()),
    battle: {
      critterId: "frog",
      entry: { x: 500, y: 500 },
      phase: "command",
      message: "",
      revealed: 0,
      selected: 0,
      command: null,
      energy: 5,
      calm: 0,
      snacks: 2,
      rest: {},
      aim: null,
      lastGrade: null,
      rewardSticker: null,
      aimTick: 0,
      phaseTicks: 0,
    },
  };
}
function press(state: State): State {
  const released = step(content.world, state, none).state;
  return step(content.world, released, { ...none, confirm: true }).state;
}
function aimState(
  state: State,
  command: "soothe" | "play",
  calm: number,
  gradeTick: number,
): State {
  return {
    ...state,
    battle: {
      ...state.battle!,
      phase: "aim",
      message: "",
      revealed: 0,
      command,
      calm,
      aim: {
        side: "critter",
        ticks: 60,
        targetTick: 39,
        greatWindow: 5,
        goodWindow: 11,
      },
      aimTick: gradeTick - 1,
    },
  };
}

describe("calm-down battle core", () => {
  it("grades exact timing windows and a no-press miss", () => {
    expect(gradeAim(0, 5, 11)).toBe("great");
    expect(gradeAim(5, 5, 11)).toBe("great");
    expect(gradeAim(6, 5, 11)).toBe("good");
    expect(gradeAim(11, 5, 11)).toBe("good");
    expect(gradeAim(12, 5, 11)).toBe("miss");
  });

  it("applies Soothe and Play calm math with clamping", () => {
    for (const [command, expected] of [
      ["soothe", 100],
      ["play", 100],
    ] as const) {
      const state = aimState(battleState(), command, 95, 39);
      const result = step(content.world, state, {
        ...none,
        confirm: true,
      }).state;
      expect(result.battle?.calm).toBe(expected);
    }
    expect(
      step(content.world, aimState(battleState(), "soothe", 0, 39), {
        ...none,
        confirm: true,
      }).state.battle?.calm,
    ).toBe(30);
    expect(
      step(content.world, aimState(battleState(), "soothe", 0, 45), {
        ...none,
        confirm: true,
      }).state.battle?.calm,
    ).toBe(25);
    expect(
      step(content.world, aimState(battleState(), "soothe", 0, 51), {
        ...none,
        confirm: true,
      }).state.battle?.calm,
    ).toBe(20);
    expect(
      step(content.world, aimState(battleState(), "play", 0, 39), {
        ...none,
        confirm: true,
      }).state.battle?.calm,
    ).toBe(40);
    expect(
      step(content.world, aimState(battleState(), "play", 0, 45), {
        ...none,
        confirm: true,
      }).state.battle?.calm,
    ).toBe(35);
    expect(
      step(content.world, aimState(battleState(), "play", 0, 51), {
        ...none,
        confirm: true,
      }).state.battle?.calm,
    ).toBe(30);
  });

  it("clamps Snack energy, consumes snacks, and disables at zero", () => {
    let state = battleState();
    state = { ...state, battle: { ...state.battle!, selected: 2, energy: 4 } };
    state = press(state);
    expect(state.battle?.energy).toBe(5);
    expect(state.battle?.calm).toBe(5);
    expect(state.battle?.snacks).toBe(1);
    state = { ...state, battle: { ...state.battle!, snacks: 0 } };
    expect(battleCommands(content.world, state)[2]).toMatchObject({
      disabled: true,
      detail: "×0",
    });
  });

  it("skips disabled Play and Snack commands in both menu directions", () => {
    let state = battleState();
    state = { ...state, battle: { ...state.battle!, rest: { play: 1 }, snacks: 0 } };
    state = step(content.world, state, { ...none, move: { x: 0, y: 1 } }).state;
    expect(state.battle?.selected).toBe(3);
    state = step(content.world, state, {
      ...none,
      move: { x: 0, y: -1 },
    }).state;
    expect(state.battle?.selected).toBe(0);
  });

  it("touch choose starts an enabled command and ignores disabled choices", () => {
    let state = battleState();
    state = step(content.world, state, { ...none, choose: 1 }).state;
    expect(state.battle?.phase).toBe("aim");
    state = { ...battleState(), battle: { ...battleState().battle!, rest: { play: 1 } } };
    expect(
      step(content.world, state, { ...none, choose: 1 }).state.battle?.phase,
    ).toBe("command");
  });

  it("grades burst damage for all grades and both PRNG base damages", () => {
    const burst = (seed: number, gradeTick: number): number => {
      const aimed = aimState(
        { ...battleState(), rng: seed },
        "soothe",
        0,
        gradeTick,
      );
      const state: State = {
        ...aimed,
        battle: {
          ...aimed.battle!,
          aim: {
            side: "fae",
            ticks: 60,
            targetTick: 45,
            greatWindow: 5,
            goodWindow: 11,
          },
        },
      };
      return (
        step(content.world, state, { ...none, confirm: true }).state.battle
          ?.energy ?? -1
      );
    };
    expect(burst(1, 45)).toBe(5);
    expect(burst(1, 51)).toBe(4);
    expect(burst(1, 57)).toBe(3);
    expect(burst(1000, 57)).toBe(4);
  });

  it("shows Run before ending and restores entry without retriggering", () => {
    let state = battleState();
    state = {
      ...state,
      facing: "left",
      battle: { ...state.battle!, selected: 3 },
    };
    state = press(state);
    expect(state.battle?.message).toBe(content.world.critters.frog?.lines.run);
    state = press(state);
    state = press(state);
    expect(state.battle).toBeNull();
    expect(state.player).toEqual({ x: 500, y: 500 });
    expect(state.facing).toBe("right");
    expect(step(content.world, state, none).state.battle).toBeNull();
  });

  it("returns to the safe spot on rest without changing progress", () => {
    const start = battleState();
    let state: State = {
      ...start,
      battle: {
        ...start.battle!,
        phase: "burstResult",
        message: "",
        revealed: 0,
        energy: 0,
      },
      stickers: ["other"],
      ink: start.ink,
    };
    state = press(state);
    state = press(state);
    state = press(state);
    expect(state.battle).toBeNull();
    expect(state.transition?.target).toEqual(state.safeSpot);
    for (let i = 0; i < content.world.tunables.doorFadeTicks * 2 + 1; i += 1)
      state = step(content.world, state, none).state;
    expect(state.area).toBe("plaza");
    expect(state.critters.frog).toBe("chaos");
    expect(state.stickers).toEqual(["other"]);
  });

  it("uses the chosen command id and sets Play rest", () => {
    let state = battleState();
    state = step(content.world, state, { ...none, move: { x: 0, y: 1 } }).state;
    state = press(state);
    expect(state.battle?.command).toBe("play");
    expect(state.battle?.rest).toEqual({ play: 1 });
    expect(battleCommands(content.world, state)[1]?.disabled).toBe(true);
  });

  it("expires Play rest after a command turn", () => {
    let state = battleState();
    state = { ...state, battle: { ...state.battle!, rest: { play: 1 } } };
    expect(battleCommands(content.world, state)[1]?.disabled).toBe(true);
    state = press(state);
    expect(state.battle?.rest).toEqual({});
  });

  it("shows the burst warning before entering the Fae aim", () => {
    let state = battleState();
    state = {
      ...state,
      battle: {
        ...state.battle!,
        phase: "result",
        calm: 0,
        message: "",
        revealed: 0,
      },
    };
    state = press(state);
    expect(state.battle?.phase).toBe("burst");
    expect(state.battle?.message).toBe(
      content.world.critters.frog?.lines.burst,
    );
    state = press(state);
    state = press(state);
    expect(state.battle?.phase).toBe("aim");
    expect(state.battle?.aim?.side).toBe("fae");
  });

  it("increments Maddie's settling time while Fae is frozen", () => {
    const state = battleState();
    const next = step(content.world, state, none).state;
    expect(next.party[0]?.stillTicks).toBe((state.party[0]?.stillTicks ?? NaN) + 1);
  });

  it("returns a UI-shaped derived aim and nullable details", () => {
    let state = battleState();
    state = press(state);
    const view = battleView(content.world, state);
    expect(view?.commands[0]?.detail).toBeNull();
    expect(view?.aim?.side).toBe("critter");
  });

  it("validates battle content and critter content", () => {
    expect(() => parseBattleContent({ commands: {} }, "battle.json")).toThrow(
      /battle.json/,
    );
    expect(() => parseCritter({ id: "frog" }, "frog.json")).toThrow(
      /frog.json/,
    );
  });

  it("targets the calm frog knot and never starts a battle", () => {
    let state = battleState();
    state = {
      ...state,
      critters: { frog: "calm" },
      player: { x: 1000, y: 820 },
      facing: "right",
      battle: null,
    };
    expect(targetInteractable(content.world, state)?.knot).toBe("frog_calm");
    expect(
      step(content.world, state, { ...none, move: { x: 0, y: 0 } }).state
        .battle,
    ).toBeNull();
  });

  it("changes the fountain line from calmed frog facts", () => {
    const ink = createInkState(content.world.story, 1);
    const chaos = runInk(content.world.story, ink, {
      type: "start",
      knot: "fountain",
    }, { frog: false });
    const calm = runInk(content.world.story, ink, {
      type: "start",
      knot: "fountain",
    }, { frog: true });
    expect(chaos.line?.text).toContain("Pink bubbles");
    expect(calm.line?.text).toBe("The bubbles are gone. The fountain sparkles like new!");
  });
});
