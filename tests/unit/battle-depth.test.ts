import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  battleView,
  blankInput,
  calmExperience,
  createCheck,
  createState,
  levelForXp,
  setInkVariables,
  soundCues,
  statsForCommand,
  step,
  type Battle,
  type Grade,
  type State,
} from "../../src/core";
import { loadContent, parseBattleContent } from "../../src/content/load";

const content = loadContent();
const world = content.world;
const rawBattle: unknown = JSON.parse(readFileSync("content/battle.json", "utf8"));

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error(`expected object for ${label}`);
  return Object.fromEntries(Object.entries(value));
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

function finishRing(state: State, target: "great" | "good" | "miss"): State {
  let current = state;
  const spec = current.battle?.check;
  if (spec === null || spec === undefined || spec.kind !== "ring")
    throw new Error("expected ring check");
  const hitTick = target === "great"
    ? spec.spec.targetTick
    : target === "good"
      ? spec.spec.targetTick + spec.spec.goodWindow
      : -1;
  while (current.battle?.phase === "check") {
    const nextTick = (current.battle.check?.tick ?? 0) + 1;
    const press = nextTick === hitTick;
    current = step(world, current, { ...blankInput(), confirm: press }).state;
  }
  return current;
}

function finishChain(state: State, hits: number): State {
  let current = state;
  const check = current.battle?.check;
  if (check === null || check === undefined || check.kind !== "chain")
    throw new Error("expected chain check");
  const targets = new Set(check.spec.arrivals.slice(0, hits));
  while (current.battle?.phase === "check") {
    const nextTick = (current.battle.check?.tick ?? 0) + 1;
    const press = targets.has(nextTick);
    current = step(world, current, { ...blankInput(), confirm: press }).state;
  }
  return current;
}

describe("battle depth content validation", () => {
  it("loads together and fluteAssist from content/battle.json", () => {
    const parsed = parseBattleContent(rawBattle, "content/battle.json");
    expect(parsed.together.chargeMax).toBe(3);
    expect(parsed.together.label).toBe("Together!");
    expect(parsed.together.check.kind).toBe("chain");
    expect(parsed.together.check.look).toBe("star");
    expect(parsed.fluteAssist.pupCalm).toBe(25);
    expect(parsed.fluteAssist.squirrelEnergy).toBe(1);
    expect(parsed.fluteAssist.squirrelSoften).toBe(1);
  });

  it("rejects malformed together config", () => {
    const base = asObject(rawBattle, "battle");
    const together = asObject(base.together, "together");
    expect(() => parseBattleContent({ ...base, together: undefined }, "b.json"))
      .toThrow(/together/);
    expect(() => parseBattleContent({
      ...base, together: { ...together, chargeMax: 0 },
    }, "b.json")).toThrow(/together\.chargeMax/);
    expect(() => parseBattleContent({
      ...base, together: { ...together, label: "  " },
    }, "b.json")).toThrow(/together\.label/);
    expect(() => parseBattleContent({
      ...base, together: { ...together, hint: "" },
    }, "b.json")).toThrow(/together\.hint/);
    expect(() => parseBattleContent({
      ...base,
      together: {
        ...together,
        check: { kind: "ring", ticks: 60, targetTick: 39, greatWindow: 5, goodWindow: 11 },
      },
    }, "b.json")).toThrow(/together\.check\.kind/);
    expect(() => parseBattleContent({
      ...base,
      together: { ...together, lines: { great: "", good: "ok", miss: "ok" } },
    }, "b.json")).toThrow(/together\.lines/);
  });

  it("rejects malformed fluteAssist config", () => {
    const base = asObject(rawBattle, "battle");
    const assist = asObject(base.fluteAssist, "fluteAssist");
    const lines = asObject(assist.lines, "fluteAssist.lines");
    expect(() => parseBattleContent({ ...base, fluteAssist: undefined }, "b.json"))
      .toThrow(/fluteAssist/);
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, pupCalm: 0 },
    }, "b.json")).toThrow(/fluteAssist\.pupCalm/);
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, squirrelEnergy: -1 },
    }, "b.json")).toThrow(/fluteAssist\.squirrelEnergy/);
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, squirrelSoften: 1.5 },
    }, "b.json")).toThrow(/fluteAssist\.squirrelSoften/);
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, lines: { ...lines, both: "" } },
    }, "b.json")).toThrow(/fluteAssist\.lines\.both/);
  });
});

describe("sparkle charge meter", () => {
  it("stays off with Maddie alone (even with Pond Pup along)", () => {
    const solo = commandBattle("plaza");
    expect(battleView(world, solo)?.sparkle).toBeNull();
    const chosen = step(world, solo, { ...blankInput(), choose: 0 }).state;
    const ended = finishRing(chosen, "great");
    expect(ended.battle?.sparkle).toBeUndefined();

    const first = solo.party[0];
    if (first === undefined) throw new Error("maddie missing");
    const withPup: State = { ...solo, party: [first, { ...first, id: "pond-pup" }] };
    expect(battleView(world, withPup)?.sparkle).toBeNull();
    const endedPup = finishRing(
      step(world, withPup, { ...blankInput(), choose: 0 }).state,
      "great",
    );
    expect(endedPup.battle?.sparkle).toBeUndefined();
  });

  it("charges +1 on GREAT command and GREAT burst, caps at 3, ignores GOOD and MISS", () => {
    const start = commandBattle("plaza-party");
    expect(battleView(world, start)?.sparkle).toEqual({ count: 0, max: 3, ready: false });

    // GOOD and MISS do not charge.
    const goodEnd = finishRing(step(world, start, { ...blankInput(), choose: 0 }).state, "good");
    expect(goodEnd.battle?.sparkle).toBeUndefined();
    const missEnd = finishRing(step(world, start, { ...blankInput(), choose: 0 }).state, "miss");
    expect(missEnd.battle?.sparkle).toBeUndefined();

    // GREAT command charges 0 -> 1.
    const one = finishRing(step(world, start, { ...blankInput(), choose: 0 }).state, "great");
    expect(one.battle?.sparkle).toBe(1);

    // GREAT enemy burst charges 1 -> 2.
    const frog = world.critters["fountain-frog"];
    if (frog === undefined || frog.burst.check.kind !== "chain")
      throw new Error("frog chain burst missing");
    const burstState: State = {
      ...one,
      battle: {
        ...one.battle!,
        phase: "check",
        check: createCheck(frog.burst.check, "fae"),
      },
    };
    const two = finishChain(burstState, frog.burst.check.arrivals.length);
    expect(two.battle?.lastGrade).toBe("great");
    expect(two.battle?.sparkle).toBe(2);

    // GREAT command at 2 -> 3 (ready), and at 3 stays capped at 3.
    const atTwo = commandBattle("plaza-party", "fountain-frog", { sparkle: 2 });
    const three = finishRing(step(world, atTwo, { ...blankInput(), choose: 0 }).state, "great");
    expect(three.battle?.sparkle).toBe(3);

    const ready = commandBattle("plaza-party", "fountain-frog", { sparkle: 3 });
    expect(battleView(world, ready)?.sparkle).toEqual({ count: 3, max: 3, ready: true });
    const capped = finishRing(step(world, ready, { ...blankInput(), choose: 0 }).state, "great");
    expect(capped.battle?.sparkle).toBe(3);
  });
});

describe("Together! party finisher", () => {
  it("activates on cancel when charged, resets sparkle, pops wind-ups, and ticks rest", () => {
    const start = commandBattle("plaza-party", "gull", {
      sparkle: 3,
      rest: { play: 2, cast: 1 },
      windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 1 },
    });
    const launched = step(world, start, { ...blankInput(), cancel: true }).state;
    expect(launched.battle?.phase).toBe("check");
    expect(launched.battle?.command).toBe("together");
    expect(launched.battle?.sparkle).toBeUndefined();
    expect(launched.battle?.answered).toBe(true);
    expect(launched.battle?.rest).toEqual({ play: 1 });
    expect(launched.battle?.windUp?.popped).toEqual([true, true]);
    expect(launched.battle?.check).toMatchObject({
      kind: "chain",
      side: "critter",
      spec: world.battle.together.check,
    });
    expect(battleView(world, launched)?.hint).toBe(world.battle.together.hint);
    expect(soundCues(start, launched, world)).toContain("battle-together");
    expect(soundCues(start, launched, world)).not.toContain("battle-command");

    // Gentle timing widens Together! check window.
    const gentle = step(world, start, { ...blankInput(), cancel: true }, {
      gentleTiming: true,
    }).state;
    expect(gentle.battle?.check?.kind === "chain" ? gentle.battle.check.spec.hitWindow : 0)
      .toBeGreaterThan(world.battle.together.check.hitWindow);

    // Completing Together! on the last wind-up turn fizzles the mini-boss (no burst).
    const afterCheck = finishChain(launched, 3);
    expect(afterCheck.battle?.phase).toBe("result");
    expect(afterCheck.battle?.sparkle).toBeUndefined();
    const revealed: State = {
      ...afterCheck,
      battle: { ...afterCheck.battle!, revealed: afterCheck.battle!.message.length },
      previousInput: blankInput(),
    };
    const afterResult = step(world, revealed, { ...blankInput(), confirm: true }).state;
    expect(afterResult.battle?.phase).toBe("fizzle");
  });

  it("scales calm for great/good/miss and clamps on Talk bosses", () => {
    const base = commandBattle("plaza-party", "gull", { sparkle: 3, calm: 0 });
    const teamPower =
      statsForCommand(world.levels, "soothe", levelForXp(world.levels, base.xp)).power +
      statsForCommand(world.levels, "play", levelForXp(world.levels, base.party[0]?.xp ?? 0))
        .power +
      statsForCommand(world.levels, "cast", levelForXp(world.levels, base.party[1]?.xp ?? 0))
        .power;

    const cases: { grade: Grade; hits: number; expected: number }[] = [
      { grade: "great", hits: 3, expected: teamPower + world.battle.feelingBonus },
      { grade: "good", hits: 2, expected: Math.round(teamPower * 0.75) },
      { grade: "miss", hits: 0, expected: Math.round(teamPower * 0.5) },
    ];
    for (const item of cases) {
      const launched = step(world, base, { ...blankInput(), cancel: true }).state;
      const done = finishChain(launched, item.hits);
      expect(done.battle?.lastGrade).toBe(item.grade);
      expect(done.battle?.calm).toBe(item.expected);
      expect(done.battle?.message).toBe(world.battle.together.lines[item.grade]);
    }

    // Talk boss clamps to calmMax - 1 and hides sparkle once calm >= talkAt.
    const kid = world.critters["hooded-kid"];
    if (kid === undefined || kid.talk === null) throw new Error("hooded-kid missing");
    const preTalk = commandBattle("plaza-party", "hooded-kid", {
      sparkle: 3,
      calm: kid.calmMax - 5,
      talkMode: false,
    });
    expect(battleView(world, preTalk)?.sparkle).toBeNull();
    const blocked = step(world, preTalk, { ...blankInput(), cancel: true }).state;
    expect(blocked.battle?.phase).toBe("command");

    const beforeTalkAt = commandBattle("plaza-party", "hooded-kid", {
      sparkle: 3,
      calm: kid.talk.talkAt - 1,
    });
    const kidBig = finishChain(
      step(world, beforeTalkAt, { ...blankInput(), cancel: true }).state,
      3,
    );
    expect(kidBig.battle?.calm).toBeLessThanOrEqual(kid.calmMax - 1);
  });

  it("shares XP with all battle party members (excluding flute friends) on reward", () => {
    const base = commandBattle(
      "plaza-party",
      "fountain-frog",
      {
        phase: "reward",
        command: "together",
        message: "reward",
        revealed: 6,
      },
      { pup_with_me: true },
    );
    const first = base.party[0];
    if (first === undefined) throw new Error("maddie missing");
    const state: State = {
      ...base,
      party: [
        ...base.party,
        { ...first, id: "jordan", xp: 0 },
        { ...first, id: "pond-pup", xp: 0 },
      ],
    };
    const after = step(world, state, { ...blankInput(), confirm: true }).state;
    const xp = calmExperience(world.levels, "fountain-frog", false, false);
    expect(after.xp).toBe(base.xp + xp);
    expect(after.party.find((m) => m.id === "maddie")?.xp).toBe(xp);
    expect(after.party.find((m) => m.id === "sue")?.xp).toBe(xp);
    expect(after.party.find((m) => m.id === "jordan")?.xp).toBe(xp);
    expect(after.party.find((m) => m.id === "pond-pup")?.xp).toBe(0);
  });
});

describe("Flute Friends in battle", () => {
  it("is unavailable without flute or befriended animals", () => {
    const noFlute = commandBattle("plaza-party", "fountain-frog", {}, { pup_friend: true });
    expect(battleView(world, noFlute)?.fluteAssist).toBeNull();
    expect(step(world, noFlute, { ...blankInput(), flute: true }).state.battle?.fluteUsed)
      .toBeUndefined();

    const noFriend = commandBattle("plaza-party", "fountain-frog", {}, { has_flute: true });
    expect(battleView(world, noFriend)?.fluteAssist).toBeNull();
    expect(step(world, noFriend, { ...blankInput(), flute: true }).state.battle?.fluteUsed)
      .toBeUndefined();
  });

  it("calls Pond Pup for +25 calm once per battle without ending the turn, or soothes", () => {
    const state = commandBattle(
      "plaza-party",
      "fountain-frog",
      { calm: 20 },
      { has_flute: true, pup_friend: true },
    );
    expect(battleView(world, state)?.fluteAssist).toEqual({
      available: true,
      label: "Pond Pup",
      kind: "pup",
    });
    const called = step(world, state, { ...blankInput(), flute: true }).state;
    expect(called.battle?.phase).toBe("command");
    expect(called.battle?.calm).toBe(20 + world.battle.fluteAssist.pupCalm);
    expect(called.battle?.fluteUsed).toBe(true);
    expect(called.battle?.message).toBe(world.battle.fluteAssist.lines.pup);
    expect(soundCues(state, called, world)).toContain("flute");
    expect(battleView(world, called)?.fluteAssist?.available).toBe(false);

    // Second flute press does nothing.
    const revealed: State = {
      ...called,
      battle: { ...called.battle!, revealed: called.battle!.message.length },
      previousInput: blankInput(),
    };
    const again = step(world, revealed, { ...blankInput(), flute: true }).state;
    expect(again.battle?.calm).toBe(called.battle?.calm);

    // Soothes directly when reaching calmMax.
    const almost = commandBattle(
      "plaza-party",
      "fountain-frog",
      { calm: 80 },
      { has_flute: true, pup_friend: true },
    );
    const soothed = step(world, almost, { ...blankInput(), flute: true }).state;
    expect(soothed.battle?.phase).toBe("soothed");
    expect(soothed.battle?.calm).toBe(100);
  });

  it("calls Acorn Squirrel for +1 leaf (capped) and softens next damaging burst", () => {
    const state = commandBattle(
      "plaza-party",
      "fountain-frog",
      { energy: 3 },
      { has_flute: true, squirrel_friend: true },
    );
    expect(battleView(world, state)?.fluteAssist).toEqual({
      available: true,
      label: "Acorn Squirrel",
      kind: "squirrel",
    });
    const called = step(world, state, { ...blankInput(), flute: true }).state;
    expect(called.battle?.energy).toBe(4);
    expect(called.battle?.burstSoften).toBe(1);
    expect(called.battle?.message).toBe(world.battle.fluteAssist.lines.squirrel);
    expect(battleView(world, called)?.burstSoften).toBe(1);

    // GREAT burst deals 0 damage and keeps burstSoften active.
    const frog = world.critters["fountain-frog"];
    if (frog === undefined || frog.burst.check.kind !== "chain")
      throw new Error("frog chain burst missing");
    const greatBurst = finishChain(
      {
        ...called,
        battle: {
          ...called.battle!,
          phase: "check",
          check: createCheck(frog.burst.check, "fae", false),
        },
      },
      frog.burst.check.arrivals.length,
    );
    expect(greatBurst.battle?.energy).toBe(4);
    expect(greatBurst.battle?.burstSoften).toBe(1);

    // Missed big burst (raw 2 damage) is softened to 1 damage and clears burstSoften.
    const bigSpec = frog.burst.big;
    if (bigSpec === undefined || bigSpec.kind !== "chain") throw new Error("frog big burst");
    const missBurst = finishChain(
      {
        ...greatBurst,
        battle: {
          ...greatBurst.battle!,
          phase: "check",
          check: createCheck(bigSpec, "fae", true),
        },
      },
      0,
    );
    expect(missBurst.battle?.energy).toBe(3);
    expect(missBurst.battle?.burstSoften).toBeUndefined();
  });

  it("calls both Flute Friends together and blocks during Talk phase", () => {
    const both = commandBattle(
      "plaza-party",
      "gull",
      { calm: 10, energy: 4 },
      { has_flute: true, pup_friend: true, squirrel_friend: true },
    );
    expect(battleView(world, both)?.fluteAssist).toEqual({
      available: true,
      label: "Flute Friends",
      kind: "both",
    });
    const called = step(world, both, { ...blankInput(), flute: true }).state;
    expect(called.battle?.calm).toBe(10 + world.battle.fluteAssist.pupCalm);
    expect(called.battle?.energy).toBe(5);
    expect(called.battle?.burstSoften).toBe(1);
    expect(called.battle?.message).toBe(world.battle.fluteAssist.lines.both);

    const kidTalk = commandBattle(
      "plaza-party",
      "hooded-kid",
      { calm: 100, talkMode: true },
      { has_flute: true, pup_friend: true, squirrel_friend: true },
    );
    expect(battleView(world, kidTalk)?.fluteAssist?.available).toBe(false);
    const ignored = step(world, kidTalk, { ...blankInput(), flute: true }).state;
    expect(ignored.battle?.fluteUsed).toBeUndefined();
  });
});
