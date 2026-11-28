import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  battleView,
  blankInput,
  createState,
  jukeboxTracks,
  nextRandom,
  setInkVariables,
  soundCues,
  step,
  trackTitles,
  type Battle,
  type State,
} from "../../src/core";
import { loadContent, parseBattleContent } from "../../src/content/load";
import { isActionFrame } from "../../src/content/script";
import { keyboardFrame } from "../../src/platform/keyboard";
import {
  combineInputFrames,
  gamepadFrame,
  GamepadLatch,
  type StandardGamepad,
} from "../../src/platform/gamepad";
import { TouchInput } from "../../src/platform/touch";

const content = loadContent();
const world = content.world;
const rawBattle: unknown = JSON.parse(readFileSync("content/battle.json", "utf8"));

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error(`expected object for ${label}`);
  return Object.fromEntries(Object.entries(value));
}

function pad(buttons: readonly number[] = [], mapping = "standard"): StandardGamepad {
  return {
    mapping,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: buttons.includes(index),
      value: buttons.includes(index) ? 1 : 0,
    })),
  };
}

function commandBattle(
  fixtureName: string,
  critterId = "fountain-frog",
  overrides: Partial<Battle> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = content.fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`${fixtureName} fixture missing`);
  const base = createState(world, fixture);
  const critter = world.critters[critterId];
  if (critter === undefined) throw new Error(`unknown critter ${critterId}`);
  const battle: Battle = {
    critterId,
    den: null,
    entry: base.player,
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: critter.energyMax,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["grumpy", "zoomy", "curious"],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
  return {
    ...base,
    ink: setInkVariables(base.ink, variables),
    battle,
  };
}

describe("lassoAssist content validation", () => {
  it("loads lassoAssist from content/battle.json", () => {
    const parsed = parseBattleContent(rawBattle, "content/battle.json");
    expect(parsed.lassoAssist.calm).toBe(15);
    expect(parsed.lassoAssist.coins).toBe(4);
    expect(parsed.lassoAssist.lines.windUp).toContain("wind-up bubble");
    expect(parsed.lassoAssist.lines.snag).toContain("+4 coins");
  });

  it("rejects malformed lassoAssist config", () => {
    const base = asObject(rawBattle, "battle");
    const lasso = asObject(base.lassoAssist, "lassoAssist");
    const lines = asObject(lasso.lines, "lassoAssist.lines");
    expect(() => parseBattleContent({ ...base, lassoAssist: undefined }, "b.json"))
      .toThrow(/lassoAssist/);
    expect(() => parseBattleContent({ ...base, lassoAssist: { ...lasso, calm: 0 } }, "b.json"))
      .toThrow(/lassoAssist\.calm/);
    expect(() => parseBattleContent({ ...base, lassoAssist: { ...lasso, coins: -1 } }, "b.json"))
      .toThrow(/lassoAssist\.coins/);
    expect(() => parseBattleContent({
      ...base,
      lassoAssist: { ...lasso, lines: { ...lines, windUp: "   " } },
    }, "b.json")).toThrow(/lassoAssist\.lines\.windUp/);
    expect(() => parseBattleContent({
      ...base,
      lassoAssist: { ...lasso, lines: { ...lines, snag: "" } },
    }, "b.json")).toThrow(/lassoAssist\.lines\.snag/);
  });
});

describe("lasso input mapping", () => {
  it("maps KeyR, gamepad LB/L1 (button 4), and touch tapButton without polluting blank frames",
    () => {
      expect(keyboardFrame(new Set(["KeyR"])).lasso).toBe(true);
      expect("lasso" in keyboardFrame(new Set())).toBe(false);

      expect(gamepadFrame([pad([4])]).lasso).toBe(true);
      expect("lasso" in gamepadFrame([pad([])])).toBe(false);
      // Merges with OR across connected standard pads.
      expect(gamepadFrame([pad([]), pad([4])]).lasso).toBe(true);

      const latch = new GamepadLatch();
      latch.update(gamepadFrame([pad([4])]));
      latch.update(blankInput());
      expect(latch.frame().lasso).toBe(true);
      expect("lasso" in latch.frame()).toBe(false);

      const touch = new TouchInput();
      touch.tapButton("lasso");
      expect(touch.sample().lasso).toBe(true);
      expect("lasso" in touch.sample()).toBe(false);

      const emptyCombined = combineInputFrames(blankInput(), blankInput(), blankInput());
      expect("lasso" in emptyCombined).toBe(false);
      expect(
        combineInputFrames(blankInput(), blankInput(), { ...blankInput(), lasso: true }).lasso,
      ).toBe(true);

      expect(isActionFrame({ ...blankInput(), lasso: true })).toBe(true);
      expect(isActionFrame({ ...blankInput(), lasso: "yes" })).toBe(false);
    });
});

describe("Coach Ash's rainbow lasso in battle", () => {
  it("is unavailable without has_lasso and does nothing on a fresh press", () => {
    const start = commandBattle("plaza-party", "fountain-frog", {}, { has_lasso: false });
    expect(battleView(world, start)?.lassoAssist).toBeNull();
    const after = step(world, start, { ...blankInput(), lasso: true }).state;
    expect(after.battle?.lassoUsed).toBeUndefined();
    expect(after.battle?.calm).toBe(0);
    expect(after.coins).toBe(start.coins);
  });

  it("is blocked during Talk mode and active Talk dialogue", () => {
    const talkReady = commandBattle(
      "plaza-party",
      "hooded-kid",
      { talkMode: true, calm: 80 },
      { has_lasso: true },
    );
    expect(battleView(world, talkReady)?.lassoAssist).toEqual({ available: false, windUp: false });
    const after = step(world, talkReady, { ...blankInput(), lasso: true }).state;
    expect(after.battle?.lassoUsed).toBeUndefined();
    expect(after.battle?.calm).toBe(80);
  });

  it("performs Steady Snag once per battle: +15 calm, +4 coins, lassoSteady, and cues", () => {
    const start = commandBattle("plaza-party", "fountain-frog", {}, { has_lasso: true });
    expect(battleView(world, start)?.lassoAssist).toEqual({ available: true, windUp: false });
    expect(battleView(world, start)?.lassoSteady).toBe(false);

    const after = step(world, start, { ...blankInput(), lasso: true }).state;
    expect(after.battle?.phase).toBe("command");
    expect(after.battle?.calm).toBe(15);
    expect(after.coins).toBe(start.coins + 4);
    expect(after.battle?.lassoUsed).toBe(true);
    expect(after.battle?.lassoSteady).toBe(true);
    expect(after.battle?.message).toBe(world.battle.lassoAssist.lines.snag);
    expect(battleView(world, after)?.lassoAssist).toEqual({ available: false, windUp: false });
    expect(battleView(world, after)?.lassoSteady).toBe(true);

    const cues = soundCues(start, after, world);
    expect(cues).toContain("lasso-twirl");
    expect(cues).toContain("coin");

    // A second press after release does nothing once lassoUsed is true.
    const revealed = step(world, after, { ...blankInput(), confirm: true }).state;
    const second = step(world, revealed, { ...blankInput(), lasso: true }).state;
    expect(second.battle?.calm).toBe(15);
    expect(second.coins).toBe(start.coins + 4);
  });

  it("prevents the next burst from upgrading to big without altering PRNG draws", () => {
    const critter = world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("fountain-frog missing");
    // Find a seed whose nextRandom roll strictly triggers a big burst (< bigChance).
    let bigSeed = 1;
    for (let candidate = 1; candidate < 500; candidate += 1) {
      const probe = commandBattle("plaza-party", "fountain-frog", {}, { has_lasso: true });
      const [roll] = nextRandom({ ...probe, rng: candidate });
      if (roll < critter.burst.bigChance) {
        bigSeed = candidate;
        break;
      }
    }
    const baseBurst = {
      ...commandBattle("plaza-party", "fountain-frog", { phase: "burst" }, { has_lasso: true }),
      rng: bigSeed,
    };
    const normalAfter = step(world, baseBurst, { ...blankInput(), confirm: true }).state;
    expect(normalAfter.battle?.check?.big).toBe(true);

    const steadyBurst: State = {
      ...baseBurst,
      battle: baseBurst.battle === null ? null : { ...baseBurst.battle, lassoSteady: true },
    };
    const steadyAfter = step(world, steadyBurst, { ...blankInput(), confirm: true }).state;
    expect(steadyAfter.battle?.check?.big).toBe(false);
    expect(steadyAfter.battle?.lassoSteady).toBeUndefined();
    // Both paths consumed the same bigChance roll (fountain-frog's chain burst has 0 checkDraws).
    expect(steadyAfter.rng).toBe(normalAfter.rng);
  });

  it("pops one active wind-up bubble + adds calm on a mini-boss wind-up", () => {
    const start = commandBattle(
      "bay",
      "gull",
      {
        windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 2 },
      },
      { has_lasso: true },
    );
    expect(battleView(world, start)?.lassoAssist).toEqual({ available: true, windUp: true });
    const after = step(world, start, { ...blankInput(), lasso: true }).state;
    expect(after.battle?.phase).toBe("command");
    expect(after.battle?.calm).toBe(15);
    expect(after.coins).toBe(start.coins);
    expect(after.battle?.windUp?.popped).toEqual([true, false]);
    expect(after.battle?.lassoUsed).toBe(true);
    expect(after.battle?.lassoSteady).toBeUndefined();
    expect(after.battle?.message).toBe(world.battle.lassoAssist.lines.windUp);
    const cues = soundCues(start, after, world);
    expect(cues).toContain("lasso-twirl");
    expect(cues).not.toContain("coin");
  });

  it("can soothe cleanly when calm reaches calmMax, clearing any wind-up", () => {
    const critter = world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("fountain-frog missing");
    const start = commandBattle(
      "plaza-party",
      "fountain-frog",
      { calm: critter.calmMax - 5 },
      { has_lasso: true },
    );
    const after = step(world, start, { ...blankInput(), lasso: true }).state;
    expect(after.battle?.phase).toBe("soothed");
    expect(after.battle?.calm).toBe(critter.calmMax);
    expect(after.battle?.windUp).toBeNull();
    expect(after.coins).toBe(start.coins + 4);
  });
});

describe("Journal Music Box jukeboxTracks", () => {
  it("lists every non-silent MusicTrack once with a valid non-empty title", () => {
    const expectedNonSilent = Object.keys(trackTitles).filter((track) => track !== "silent");
    expect(jukeboxTracks).toHaveLength(32);
    expect(new Set(jukeboxTracks).size).toBe(32);
    expect([...jukeboxTracks].sort()).toEqual([...expectedNonSilent].sort());
    for (const track of jukeboxTracks) {
      expect(trackTitles[track].trim().length).toBeGreaterThan(0);
    }
  });
});
