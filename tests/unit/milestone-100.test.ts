import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  revealCharacters,
  setInkVariables,
  stableHash,
  startDialogue,
  step,
  treasuresSummary,
  type State,
} from "../../src/core";
import {
  readGamePreferences,
  writeGamePreferences,
} from "../../src/platform/game-settings";

const { world, fixtures } = loadContent();

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, ink, ...overrides };
}

function enterFrogBattle(start: State): State {
  let state = start;
  const run = (move: { x: number; y: number }, ticks: number): void => {
    for (let index = 0; index < ticks; index += 1) {
      if (state.battle !== null) return;
      state = step(world, state, { ...blankInput(), move }).state;
    }
  };
  run({ x: 0, y: 1 }, 25);
  run({ x: -1, y: 0 }, 15);
  run({ x: 0, y: 1 }, 50);
  run({ x: -1, y: 0 }, 35);
  if (state.battle === null) throw new Error("Never entered fountain-frog battle");
  return state;
}

describe("Milestone 93: Dialogue & Battle Text Speed", () => {
  it("computes revealCharacters cleanly for cozy, brisk, instant, and undefined", () => {
    const rate = world.tunables.interact.revealPerTick;
    expect(revealCharacters(world, undefined, 0, 40)).toBe(rate);
    expect(revealCharacters(world, "cozy", 0, 40)).toBe(rate);
    expect(revealCharacters(world, "brisk", 0, 40)).toBe(rate * 2.5);
    expect(revealCharacters(world, "instant", 0, 40)).toBe(40);
    expect(revealCharacters(world, "brisk", 39, 40)).toBe(40);
  });

  it("reveals dialogue at cozy (bit-exact with default), brisk (2.5x), and instant", () => {
    const windowKnot = world.areas.bedroom?.interactables[0]?.knot;
    if (windowKnot === undefined) throw new Error("Missing bedroom interactable knot");
    const started = startDialogue(world, stateIn("new-game"), windowKnot);
    const textLength = started.dialogue?.text.length ?? 0;
    expect(textLength).toBeGreaterThan(15);

    const defTick = step(world, started, blankInput()).state;
    const cozyTick = step(world, started, blankInput(), { textSpeed: "cozy" }).state;
    const briskTick = step(world, started, blankInput(), { textSpeed: "brisk" }).state;
    const instantTick = step(world, started, blankInput(), { textSpeed: "instant" }).state;

    expect(stableHash(cozyTick)).toBe(stableHash(defTick));
    expect(cozyTick.dialogue?.revealed).toBe(world.tunables.interact.revealPerTick);
    expect(briskTick.dialogue?.revealed).toBe(
      Math.min(textLength, world.tunables.interact.revealPerTick * 2.5),
    );
    expect(instantTick.dialogue?.revealed).toBe(textLength);
  });

  it("reveals battle messages and battle Talk-phase lines with cozy, brisk, and instant", () => {
    const inBattle = enterFrogBattle(stateIn("plaza"));
    const messageLen = inBattle.battle?.message.length ?? 0;
    expect(messageLen).toBeGreaterThan(10);
    expect(inBattle.battle?.revealed).toBe(0);

    const defBattle = step(world, inBattle, blankInput()).state;
    const cozyBattle = step(world, inBattle, blankInput(), { textSpeed: "cozy" }).state;
    const briskBattle = step(world, inBattle, blankInput(), { textSpeed: "brisk" }).state;
    const instantBattle = step(world, inBattle, blankInput(), { textSpeed: "instant" }).state;

    expect(stableHash(cozyBattle)).toBe(stableHash(defBattle));
    expect(cozyBattle.battle?.revealed).toBe(world.tunables.interact.revealPerTick);
    expect(briskBattle.battle?.revealed).toBe(
      Math.min(messageLen, world.tunables.interact.revealPerTick * 2.5),
    );
    expect(instantBattle.battle?.revealed).toBe(messageLen);

    // Battle Talk phase (hooded-kid at calm >= talkAt -> select Talk -> reveal Talk line).
    const kidCritter = world.critters["hooded-kid"];
    if (kidCritter === undefined || kidCritter.talk === null) {
      throw new Error("Missing hooded-kid Talk content");
    }
    const baseBattle = inBattle.battle;
    if (baseBattle === null) throw new Error("Missing fountain-frog battle");
    const talkReady: State = {
      ...inBattle,
      battle: {
        ...baseBattle,
        critterId: "hooded-kid",
        phase: "command",
        message: kidCritter.talk.prompt,
        revealed: kidCritter.talk.prompt.length,
        calm: kidCritter.talk.talkAt,
        talkMode: true,
        talk: null,
        talkTurns: 0,
        selected: 0,
      },
    };
    const openedCozy = step(
      world,
      talkReady,
      { ...blankInput(), confirm: true },
      { textSpeed: "cozy" },
    ).state;
    const openedInstant = step(
      world,
      talkReady,
      { ...blankInput(), confirm: true },
      { textSpeed: "instant" },
    ).state;
    const talkLen = openedCozy.battle?.talk?.text.length ?? 0;
    expect(talkLen).toBeGreaterThan(10);
    expect(openedCozy.battle?.talk?.revealed).toBe(0);
    expect(openedInstant.battle?.talk?.revealed).toBe(talkLen);

    const talkDefaultTick = step(world, openedCozy, blankInput()).state;
    const talkCozyTick = step(world, openedCozy, blankInput(), { textSpeed: "cozy" }).state;
    const talkBriskTick = step(world, openedCozy, blankInput(), { textSpeed: "brisk" }).state;
    const talkInstantTick = step(world, openedCozy, blankInput(), { textSpeed: "instant" }).state;

    expect(stableHash(talkCozyTick)).toBe(stableHash(talkDefaultTick));
    expect(talkCozyTick.battle?.talk?.revealed).toBe(world.tunables.interact.revealPerTick);
    expect(talkBriskTick.battle?.talk?.revealed).toBe(
      Math.min(talkLen, world.tunables.interact.revealPerTick * 2.5),
    );
    expect(talkInstantTick.battle?.talk?.revealed).toBe(talkLen);
  });
});

describe("Milestone 93: Game Preferences Upgrade & Validation", () => {
  it("upgrades legacy JSON cleanly and falls back to cozy on invalid textSpeed", () => {
    expect(readGamePreferences('{"gentleTiming":true,"keyHints":true}')).toEqual({
      gentleTiming: true,
      keyHints: true,
      textSpeed: "cozy",
      reducedMotion: false,
    });
    expect(readGamePreferences('{"textSpeed":"warp","reducedMotion":true}')).toEqual({
      gentleTiming: false,
      keyHints: false,
      textSpeed: "cozy",
      reducedMotion: true,
    });
    expect(readGamePreferences('{"textSpeed":123,"reducedMotion":"yes"}')).toEqual({
      gentleTiming: false,
      keyHints: false,
      textSpeed: "cozy",
      reducedMotion: false,
    });

    for (const speed of ["cozy", "brisk", "instant"] as const) {
      const encoded = writeGamePreferences({
        gentleTiming: false,
        keyHints: true,
        textSpeed: speed,
        reducedMotion: speed === "instant",
      });
      expect(readGamePreferences(encoded)).toEqual({
        gentleTiming: false,
        keyHints: true,
        textSpeed: speed,
        reducedMotion: speed === "instant",
      });
    }
  });
});

describe("Milestone 93: Pure treasuresSummary()", () => {
  it("reports hasAny=false on a fresh game state", () => {
    const summary = treasuresSummary(world, stateIn("new-game"));
    expect(summary.hasAny).toBe(false);
    expect(summary.stamps).toEqual({
      started: false,
      bay: false,
      pass: false,
      complete: false,
    });
    expect(summary.unlockedKeepsakes).toBe(0);
    expect(summary.totalKeepsakes).toBe(13);
    expect(summary.keepsakes.every((item) => !item.unlocked)).toBe(true);
    expect(summary.caughtFish).toBe(0);
    expect(summary.totalFish).toBe(6);
    expect(summary.catches.every((item) => !item.caught)).toBe(true);
  });

  it("tracks partial Star-Line Stamp Card progress and Bubblegum Bay catches", () => {
    const partial = stateIn(
      "bay",
      { caughtFish: { minnow: 2, starfish: 1 } },
      { buster_quest: true, stamp_bay: true },
    );
    const summary = treasuresSummary(world, partial);
    expect(summary.hasAny).toBe(true);
    expect(summary.stamps).toEqual({
      started: true,
      bay: true,
      pass: false,
      complete: false,
    });
    expect(summary.unlockedKeepsakes).toBe(0);
    expect(summary.caughtFish).toBe(2);
    expect(summary.catches.map((item) => item.id)).toEqual(
      world.arcade.fish.catches.map((item) => item.id),
    );
    expect(summary.catches.find((item) => item.id === "minnow")).toMatchObject({
      name: "Bubblegum Minnow",
      rare: false,
      caught: true,
    });
    expect(summary.catches.find((item) => item.id === "starfish")).toMatchObject({
      name: "Golden Starfish Crown",
      rare: true,
      caught: true,
    });
    expect(summary.catches.find((item) => item.id === "jelly")).toMatchObject({
      name: "Moonlight Jelly",
      rare: true,
      caught: false,
    });
  });

  it("reports 13/13 keepsakes, 6/6 Catch Book, and completed Star-Line Stamp Card", () => {
    const allFish = Object.fromEntries(
      world.arcade.fish.catches.map((entry) => [entry.id, 1]),
    );
    const full = stateIn(
      "clubhouse",
      {
        stickers: ["starry-owl", "taco-chef"],
        caughtFish: allFish,
      },
      {
        buster_quest: true,
        stamp_bay: true,
        stamp_pass: true,
        buster_reward: true,
        cavern_chime_rung: true,
        spice_returned: true,
        gem_reward_all: true,
        sanctuary_reward_14: true,
        sue_compass: true,
        jordan_clover: true,
        milo_loft_visited: true,
        rosie_cottage_visited: true,
        summit_aurora_read: true,
        island_shells_solved: true,
        festival_toast_done: true,
      },
    );
    const summary = treasuresSummary(world, full);
    expect(summary.hasAny).toBe(true);
    expect(summary.stamps).toEqual({
      started: true,
      bay: true,
      pass: true,
      complete: true,
    });
    expect(summary.unlockedKeepsakes).toBe(13);
    expect(summary.totalKeepsakes).toBe(13);
    expect(summary.keepsakes.map((item) => item.id)).toEqual([
      "star-crystal",
      "star-pin",
      "star-geode",
      "moon-feather",
      "taco-badge",
      "clover-wreath",
      "sea-compass",
      "alpine-clover",
      "star-whistle",
      "loft-sketch",
      "aurora-rubbing",
      "shell-shard",
      "festival-ribbon",
    ]);
    expect(summary.keepsakes.every((item) => item.unlocked)).toBe(true);
    expect(summary.caughtFish).toBe(6);
    expect(summary.totalFish).toBe(6);
    expect(summary.catches.every((item) => item.caught)).toBe(true);
  });
});
