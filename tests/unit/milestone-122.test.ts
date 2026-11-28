import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  newComet,
  newCook,
  newFish,
  newMole,
  newSkee,
  startBattle,
  type Event,
  type State,
} from "../../src/core";
import {
  defaultMinigameRecords,
  recordMinigameResult,
  type MinigameKey,
} from "../../src/platform/minigame-records";
import {
  buildSoundContext,
  collectLevelUpNotices,
  hapticForTick,
  petEffectForCompanion,
  resolveArcadeOutcome,
  type ArcadeRecordsStore,
} from "../../src/shell/feedback";
import {
  createSaveStore,
  shouldShowSaveToast,
  type SaveStorageAdapter,
} from "../../src/shell/save-storage";
import { journalControlsLines } from "../../src/ui/journal";

const { world, fixtures } = loadContent();

function freshState(): State {
  const fixture = fixtures["new-game"];
  if (fixture === undefined) throw new Error("Missing new-game fixture");
  return createState(world, fixture, 1);
}

function firstCritter() {
  const critter = Object.values(world.critters)[0];
  if (critter === undefined) throw new Error("Missing critter");
  return critter;
}

function makeMemoryRecords(): ArcadeRecordsStore {
  let records = defaultMinigameRecords();
  return {
    bestOf: (game: MinigameKey) => records[game],
    submit: (game: MinigameKey, score: number) => {
      const result = recordMinigameResult(records, game, score);
      records = result.records;
      return { best: result.best, isNewBest: result.isNewBest };
    },
  };
}

describe("Milestone 122: Resilient Save Queue & Error Recovery", () => {
  it("recovers cleanly after a rejected set() and preserves FIFO write order", async () => {
    const order: string[] = [];
    const stored = new Map<string, string>();
    const pending: { resolve: () => void; reject: (err: Error) => void }[] = [];

    const adapter: SaveStorageAdapter = {
      get: async (key) => stored.get(key) ?? null,
      set: (key, value) => {
        order.push(`start:${value}`);
        return new Promise<void>((resolve, reject) => {
          pending.push({
            resolve: () => {
              stored.set(key, value);
              order.push(`done:${value}`);
              resolve();
            },
            reject: (err) => {
              order.push(`fail:${value}`);
              reject(err);
            },
          });
        });
      },
      remove: async (key) => {
        order.push("remove");
        stored.delete(key);
      },
    };

    const store = createSaveStore("cloverhollow-save", adapter);
    store.setLoaded({ tick: 10, hash: "boot-hash" });
    expect(store.loaded()).toEqual({ tick: 10, hash: "boot-hash" });
    expect(store.last()).toEqual({ tick: 10, hash: "boot-hash" });

    const w1 = store.write("payload-1", { tick: 20, hash: "h1" });
    const w2 = store.write("payload-2", { tick: 30, hash: "h2" });
    const w3 = store.write("payload-3", { tick: 40, hash: "h3" });

    // Only write #1 has started; #2 and #3 wait strictly behind it in FIFO order.
    await Promise.resolve();
    expect(order).toEqual(["start:payload-1"]);

    // Reject write #1 (simulating Safari Private Mode / quota error).
    pending[0]?.reject(new Error("QuotaExceededError"));
    expect(await w1).toBe(false);
    // Failed write must NOT clobber last() or poison write #2.
    expect(store.last()).toEqual({ tick: 10, hash: "boot-hash" });

    // Write #2 now runs and succeeds.
    await Promise.resolve();
    expect(order).toEqual(["start:payload-1", "fail:payload-1", "start:payload-2"]);
    pending[1]?.resolve();
    expect(await w2).toBe(true);
    expect(store.last()).toEqual({ tick: 30, hash: "h2" });

    // Write #3 now runs and succeeds.
    await Promise.resolve();
    expect(order).toEqual([
      "start:payload-1",
      "fail:payload-1",
      "start:payload-2",
      "done:payload-2",
      "start:payload-3",
    ]);
    pending[2]?.resolve();
    expect(await w3).toBe(true);
    expect(store.last()).toEqual({ tick: 40, hash: "h3" });
    expect(store.loaded()).toEqual({ tick: 10, hash: "boot-hash" });
    expect(await store.load()).toBe("payload-3");
  });

  it("returns null on get() rejection and clears last() safely when remove() rejects", async () => {
    const adapter: SaveStorageAdapter = {
      get: () => Promise.reject(new Error("storage blocked")),
      set: () => Promise.resolve(),
      remove: () => Promise.reject(new Error("remove blocked")),
    };
    const store = createSaveStore("cloverhollow-save", adapter);
    store.setLoaded({ tick: 5, hash: "loaded-hash" });

    expect(await store.load()).toBeNull();
    expect(await store.write("ok", { tick: 15, hash: "saved-hash" })).toBe(true);
    expect(store.last()).toEqual({ tick: 15, hash: "saved-hash" });

    await expect(store.clear()).resolves.toBeUndefined();
    expect(store.last()).toBeNull();
    expect(store.loaded()).toEqual({ tick: 5, hash: "loaded-hash" });
  });

  it("gates saveToast strictly on successful live unobstructed overworld writes", () => {
    const base = {
      wrote: true,
      silent: false,
      documentHidden: false,
      paused: false,
      harnessStepping: false,
      qaActive: false,
      titleOpen: false,
      area: "plaza",
      photoMode: false,
      inBattle: false,
      journalOpen: false,
      inFinale: false,
    };
    expect(shouldShowSaveToast(base)).toBe(true);
    expect(shouldShowSaveToast({ ...base, wrote: false })).toBe(false);
    expect(shouldShowSaveToast({ ...base, silent: true })).toBe(false);
    expect(shouldShowSaveToast({ ...base, documentHidden: true })).toBe(false);
    expect(shouldShowSaveToast({ ...base, area: "harness" })).toBe(false);
    expect(shouldShowSaveToast({ ...base, photoMode: true })).toBe(false);
    expect(shouldShowSaveToast({ ...base, inBattle: true })).toBe(false);
    expect(shouldShowSaveToast({ ...base, journalOpen: true })).toBe(false);
  });
});

describe("Milestone 122: Adaptive Gamepad Controls Reference in Journal OPTIONS", () => {
  it("returns exact default keyboard controls matching existing journal-options baselines", () => {
    const primary = "Move: Arrows / WASD · Dash: Shift · Talk: Z · Journal: J · Mute: M";
    expect(
      journalControlsLines("keyboard", { hasLantern: false, hasFlute: false, hasLasso: false }),
    ).toEqual({
      primary,
      tools: "",
    });
    expect(
      journalControlsLines("keyboard", { hasLantern: true, hasFlute: false, hasLasso: false }),
    ).toEqual({
      primary,
      tools: "Lantern: L",
    });
    expect(
      journalControlsLines("keyboard", { hasLantern: true, hasFlute: true, hasLasso: false }),
    ).toEqual({
      primary,
      tools: "Lantern: L · Flute: F",
    });
    expect(
      journalControlsLines("keyboard", { hasLantern: true, hasFlute: true, hasLasso: true }),
    ).toEqual({
      primary,
      tools: "Lantern: L · Flute: F · Lasso: R",
    });
  });

  it("returns exact gamepad controller reference for all tool unlock combinations", () => {
    const primary = "Move: Stick / D-Pad · Talk: A · Dash / Back: B · Journal: Y";
    expect(
      journalControlsLines("gamepad", { hasLantern: false, hasFlute: false, hasLasso: false }),
    ).toEqual({ primary, tools: "Photo / Guide: View" });
    expect(
      journalControlsLines("gamepad", { hasLantern: true, hasFlute: false, hasLasso: false }),
    ).toEqual({ primary, tools: "Lantern: X · Photo / Guide: View" });
    expect(
      journalControlsLines("gamepad", { hasLantern: false, hasFlute: true, hasLasso: false }),
    ).toEqual({ primary, tools: "Flute: RB · Photo / Guide: View" });
    expect(
      journalControlsLines("gamepad", { hasLantern: false, hasFlute: false, hasLasso: true }),
    ).toEqual({ primary, tools: "Lasso: LB · Photo / Guide: View" });
    expect(
      journalControlsLines("gamepad", { hasLantern: true, hasFlute: true, hasLasso: true }),
    ).toEqual({ primary, tools: "Lantern: X · Flute: RB · Lasso: LB · Photo / Guide: View" });
  });
});

describe("Milestone 122: Shell Feedback & Arcade Outcome Extraction", () => {
  it("maps companion ids to their exact pet audio effect", () => {
    expect(petEffectForCompanion("pond-pup")).toBe("pet-pup");
    expect(petEffectForCompanion("acorn-squirrel")).toBe("pet-squirrel");
    expect(petEffectForCompanion("ribbon-bunny")).toBe("pet-bunny");
    expect(petEffectForCompanion("maddie")).toBe("pet-cat");
    expect(petEffectForCompanion("unknown")).toBe("pet-cat");
  });

  it("maps tick transitions, cues, and golden-cook to exact haptic kinds", () => {
    const idle = freshState();
    const battle = startBattle(world, idle, firstCritter());
    const inBattle: State = { ...idle, battle };
    const soothed: State = { ...idle, battle: { ...battle, phase: "soothed" } };
    const greatHit: State = { ...idle, battle: { ...battle, lastGrade: "great" } };
    const goodHit: State = { ...idle, battle: { ...battle, lastGrade: "good" } };

    expect(hapticForTick(idle, idle, [], { goldenCooked: true })).toBe("celebrate");
    expect(hapticForTick(inBattle, soothed, [])).toBe("celebrate");
    expect(hapticForTick(soothed, soothed, [])).toBeNull();
    expect(hapticForTick(inBattle, inBattle, ["battle-together"])).toBe("celebrate");
    expect(hapticForTick(idle, idle, ["prize-won"])).toBe("celebrate");
    expect(hapticForTick(idle, idle, ["fish-catch"])).toBe("celebrate");

    expect(hapticForTick(inBattle, greatHit, ["battle-hit"])).toBe("medium");
    expect(hapticForTick(inBattle, goodHit, ["battle-hit"])).toBeNull();

    expect(hapticForTick(idle, idle, ["claw-grab"])).toBe("light");
    expect(hapticForTick(idle, idle, ["mole-boop"])).toBe("light");
    expect(hapticForTick(idle, idle, ["fish-bite"])).toBe("light");
    expect(hapticForTick(idle, idle, ["choice-move"])).toBeNull();
  });

  it("builds sound context from overworld dialogue, battle talk, and battle menu state", () => {
    const idle = freshState();
    expect(buildSoundContext(idle)).toEqual({
      speaker: null,
      text: undefined,
      revealed: undefined,
      choiceIndex: 0,
    });

    const dialogueState: State = {
      ...idle,
      dialogue: {
        speaker: "Maddie",
        text: "Meow!",
        revealed: 5,
        choices: ["Pet", "Snack"],
        selected: 1,
        knot: "test",
        ended: false,
      },
    };
    expect(buildSoundContext(dialogueState)).toEqual({
      speaker: "Maddie",
      text: "Meow!",
      revealed: 5,
      choiceIndex: 1,
    });

    const battle = startBattle(world, idle, firstCritter());
    expect(buildSoundContext({ ...idle, battle: { ...battle, selected: 2 } })).toEqual({
      speaker: null,
      text: undefined,
      revealed: undefined,
      choiceIndex: 2,
    });
  });

  it("collects formatted level-up notices for Fae and party friends", () => {
    const events: Event[] = [
      { type: "button", button: "confirm" },
      {
        type: "level-up",
        member: "fae",
        from: 1,
        to: 2,
        deltas: { power: 2, magic: 1, life: 4, guard: 1 },
      },
      {
        type: "level-up",
        member: "maddie",
        from: 1,
        to: 2,
        deltas: { power: 1, magic: 2, life: 0, guard: 0 },
      },
    ];
    const notices = collectLevelUpNotices(world, events);
    expect(notices).toHaveLength(2);
    expect(notices[0]).toContain("Fae");
    expect(notices[0]).toContain("level 2");
    expect(notices[1]).toContain(world.party.maddie?.name ?? "Maddie");
    expect(notices[1]).toContain("level 2");
  });

  it("resolves Skee-Ball, Boop-a-Mole, Comet Cruise, Fishing, and Golden Chef outcomes", () => {
    const records = makeMemoryRecords();
    const base = freshState();

    // Skee-Ball
    const skeeBase = newSkee(world.arcade.skee);
    const skeePrev: State = { ...base, arcade: { ...skeeBase, phase: "scored" } };
    const skeeNext: State = {
      ...base,
      arcade: {
        ...skeeBase,
        phase: "result",
        throws: [
          { x: 0, y: 0, points: 50 },
          { x: 0, y: 0, points: 100 },
        ],
      },
    };
    const skeeOut = resolveArcadeOutcome(world, skeePrev, skeeNext, false, records, 0);
    expect(skeeOut).toEqual({
      record: { best: 150, isNewBest: true },
      fishStreak: 0,
      goldenCooked: false,
    });
    // Subsequent tick while still in result phase preserves active badge.
    expect(
      resolveArcadeOutcome(world, skeeNext, skeeNext, false, records, 0, skeeOut.record),
    ).toEqual({
      record: { best: 150, isNewBest: true },
      fishStreak: 0,
      goldenCooked: false,
    });

    // Boop-a-Mole
    const [moleBase] = newMole(world.arcade.mole, base);
    const molePrev: State = { ...base, arcade: { ...moleBase, phase: "playing" } };
    const moleNext: State = { ...base, arcade: { ...moleBase, phase: "result", booped: 12 } };
    expect(resolveArcadeOutcome(world, molePrev, moleNext, false, records, 0)).toEqual({
      record: { best: 12, isNewBest: true },
      fishStreak: 0,
      goldenCooked: false,
    });

    // Comet Cruise
    const [cometBase] = newComet(world.arcade.comet, base);
    const cometPrev: State = { ...base, arcade: { ...cometBase, phase: "playing" } };
    const cometNext: State = { ...base, arcade: { ...cometBase, phase: "result", caught: 9 } };
    expect(resolveArcadeOutcome(world, cometPrev, cometNext, false, records, 0)).toEqual({
      record: { best: 9, isNewBest: true },
      fishStreak: 0,
      goldenCooked: false,
    });

    // Fishing: two catches build streak, miss resets streak and keeps best, area change resets
    const fishBase = newFish(world.arcade.fish);
    const fishPrev: State = { ...base, arcade: { ...fishBase, phase: "reeling" } };
    const fishCatch: State = {
      ...base,
      arcade: { ...fishBase, phase: "result", caught: world.arcade.fish.catches[0]?.id ?? "bass" },
    };
    const catch1 = resolveArcadeOutcome(world, fishPrev, fishCatch, false, records, 0);
    expect(catch1).toEqual({
      record: { best: 1, isNewBest: true },
      fishStreak: 1,
      goldenCooked: false,
    });
    const catch2 = resolveArcadeOutcome(
      world,
      fishPrev,
      fishCatch,
      false,
      records,
      catch1.fishStreak,
    );
    expect(catch2).toEqual({
      record: { best: 2, isNewBest: true },
      fishStreak: 2,
      goldenCooked: false,
    });
    const fishMiss: State = { ...base, arcade: { ...fishBase, phase: "result", caught: null } };
    expect(resolveArcadeOutcome(world, fishPrev, fishMiss, false, records, catch2.fishStreak))
      .toEqual({
        record: { best: 2, isNewBest: false },
        fishStreak: 0,
        goldenCooked: false,
      });
    // Area transition resets carried streak even outside arcade.
    expect(
      resolveArcadeOutcome(world, base, { ...base, area: "bay" }, false, records, 2),
    ).toEqual({
      record: null,
      fishStreak: 0,
      goldenCooked: false,
    });

    // Microwave Golden Chef: golden sets goldenCooked = true & increments count; burnt keeps best
    const dishId = "nuggets";
    const dishSpec = world.arcade.cook.dishes[dishId];
    const goldenTicks = Math.round(dishSpec.time * world.arcade.cook.ticksPerSecond);
    const burntTicks = Math.round((dishSpec.burnt + 2) * world.arcade.cook.ticksPerSecond);
    const cookPrev: State = { ...base, arcade: { ...newCook(dishId), phase: "ding" } };
    const cookGolden: State = {
      ...base,
      arcade: { ...newCook(dishId), phase: "result", cooked: goldenTicks },
    };
    const cookBurnt: State = {
      ...base,
      arcade: { ...newCook(dishId), phase: "result", cooked: burntTicks },
    };
    expect(resolveArcadeOutcome(world, cookPrev, cookGolden, false, records, 0)).toEqual({
      record: { best: 1, isNewBest: true },
      fishStreak: 0,
      goldenCooked: true,
    });
    expect(resolveArcadeOutcome(world, cookPrev, cookBurnt, false, records, 0)).toEqual({
      record: { best: 1, isNewBest: false },
      fishStreak: 0,
      goldenCooked: false,
    });
  });
});
