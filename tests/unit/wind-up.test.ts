import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  battleCommands,
  battleView,
  blankInput,
  createState,
  step,
  type Battle,
  type State,
} from "../../src/core";
import { windUpStarts } from "../../src/core/feelings";
import { loadContent, parseCritter } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

const content = loadContent();

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clone(value: unknown): Record<string, unknown> {
  const copy: unknown = JSON.parse(JSON.stringify(value));
  if (!record(copy)) throw new Error("fixture is not an object");
  return copy;
}

function nested(root: Record<string, unknown>, ...names: string[]): Record<string, unknown> {
  let current = root;
  for (const name of names) {
    const next = current[name];
    if (!record(next)) throw new Error(`missing fixture field ${name}`);
    current = next;
  }
  return current;
}

function battleState(fixtureName: string, critterId = "gull"): State {
  const fixture = content.fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`${fixtureName} fixture missing`);
  const state = createState(content.world, fixture);
  const battle: Battle = {
    critterId,
    den: null,
    entry: state.player,
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["grumpy", "hungry", "bored"],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
  };
  return { ...state, battle };
}

function nextRng(rng: number): number {
  return (Math.imul(rng, 1664525) + 1013904223) >>> 0;
}

function atMessageEnd(state: State): State {
  let current = step(content.world, state, blankInput()).state;
  let guard = 0;
  while (current.battle?.revealed !== current.battle?.message.length) {
    current = step(content.world, current, blankInput()).state;
    guard += 1;
    if (guard > 100) throw new Error("message did not reveal");
  }
  return current;
}

function confirmMessage(state: State): State {
  const phase = state.battle?.phase;
  if (phase === undefined) throw new Error("battle missing");
  let current = atMessageEnd(state);
  let guard = 0;
  while (current.battle?.phase === phase) {
    current = step(content.world, current, { ...blankInput(), confirm: true }).state;
    if (current.battle?.phase !== phase) return current;
    current = step(content.world, current, blankInput()).state;
    guard += 1;
    if (guard > 100) throw new Error("message did not advance");
  }
  return current;
}

function boundaryState(battle: Partial<Battle>): State {
  const base = battleState("plaza-party");
  return {
    ...base,
    battle: {
      ...base.battle!,
      phase: "burstResult",
      message: "done",
      revealed: 4,
      ...battle,
    },
  };
}

function withJordan(state: State): State {
  const maddie = state.party[0];
  if (maddie === undefined) throw new Error("Maddie missing");
  return { ...state, party: [...state.party, { ...maddie, id: "jordan" }] };
}

describe("wind-up scheduling and drawing", () => {
  it("starts on the configured turn and repeats every configured interval", () => {
    const windUp = { start: 2, every: 3, bubbles: 2, lines: {
      start: "start", puffing: "puff", fizzle: "fizzle",
    } };

    expect([1, 2, 3, 4, 5, 6, 7, 8].map((turn) => windUpStarts(windUp, turn)))
      .toEqual([false, true, false, false, true, false, false, true]);
    expect(windUpStarts(null, 2)).toBe(false);
  });

  it("draws distinct answerable gull feelings on turn two without moving the queue", () => {
    const before = boundaryState({ turn: 1, feelings: ["bored", "grumpy", "hungry"] });
    const expectedRng = nextRng(nextRng(before.rng));
    const after = step(content.world, before, { ...blankInput(), confirm: true }).state;

    expect(after.rng).toBe(expectedRng);
    expect(after.battle).toMatchObject({
      turn: 2,
      phase: "command",
      message: content.world.critters.gull?.windUp?.lines.start,
      feelings: ["bored", "grumpy", "hungry"],
      windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 2 },
    });
  });

  it("draws fewer bubbles when Snack is unavailable", () => {
    const before = boundaryState({ turn: 1, feelings: [], windUp: null });
    const noSnacks: State = { ...before, snacks: 0 };
    const after = step(content.world, noSnacks, { ...blankInput(), confirm: true }).state;

    expect(after.battle?.windUp?.feelings).toEqual(["grumpy"]);
    expect(after.battle?.windUp?.left).toBe(1);
  });
});

describe("wind-up commands and burst rules", () => {
  function activeWindUp(overrides: Partial<Battle> = {}): State {
    return boundaryState({
      phase: "command",
      message: "",
      revealed: 0,
      windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 2 },
      ...overrides,
    });
  }

  it("pops the first matching bubble and adds the feeling bonus", () => {
    const selected = step(content.world, activeWindUp(), { ...blankInput(), choose: 0 }).state;
    const after = step(content.world, selected, { ...blankInput(), confirm: true }).state;

    expect(after.battle?.answered).toBe(true);
    expect(after.battle?.windUp?.popped).toEqual([true, false]);
    expect(after.battle?.calm).toBe(20 + content.world.battle.feelingBonus);
  });

  it("leaves an unmatched command unpopped and without a feeling bonus", () => {
    const selected = step(content.world, activeWindUp(), { ...blankInput(), choose: 4 }).state;
    const after = step(content.world, selected, { ...blankInput(), confirm: true }).state;

    expect(after.battle?.answered).toBe(false);
    expect(after.battle?.windUp?.popped).toEqual([false, false]);
    expect(after.battle?.calm).toBe(0);
  });

  it("badges every command matching an unpopped bubble and removes popped badges", () => {
    const state = withJordan(activeWindUp({
      windUp: { feelings: ["grumpy", "hungry", "curious"], popped: [true, false, false], left: 3 },
    }));
    const commands = battleCommands(content.world, state);

    expect(commands.find((command) => command.id === "soothe")?.feeling).toBe(null);
    expect(commands.find((command) => command.id === "snack")?.feeling).toBe("hungry");
    expect(commands.find((command) => command.id === "cast")?.feeling).toBe("curious");
  });

  it("puffs to the next command without checking for a burst", () => {
    const before = activeWindUp({
      turn: 2,
      phase: "result",
      message: "result",
      revealed: 6,
      windUp: { feelings: ["grumpy", "hungry"], popped: [true, false], left: 2 },
      lastGrade: "miss",
    });
    const after = confirmMessage(before);

    expect(after.battle).toMatchObject({
      phase: "command",
      turn: 3,
      message: content.world.critters.gull?.windUp?.lines.puffing,
      windUp: { popped: [true, false], left: 1 },
      check: null,
      lastGrade: null,
    });
  });

  it("fizzles after every bubble is popped and starts a normal next turn", () => {
    const before = activeWindUp({
      turn: 2,
      phase: "result",
      message: "result",
      revealed: 6,
      windUp: { feelings: ["grumpy", "hungry"], popped: [true, true], left: 1 },
    });
    const fizzle = confirmMessage(before);
    expect(fizzle.battle).toMatchObject({
      phase: "fizzle",
      message: content.world.critters.gull?.windUp?.lines.fizzle,
      windUp: null,
      check: null,
      lastGrade: null,
    });

    const next = confirmMessage(fizzle);
    expect(next.battle).toMatchObject({
      phase: "command",
      turn: 3,
      windUp: null,
      feelings: ["hungry", "bored", "grumpy"],
    });
  });

  it("lets go with a small burst after any bubble is left unpopped", () => {
    const before = activeWindUp({
      phase: "result",
      message: "result",
      revealed: 6,
      windUp: { feelings: ["grumpy", "hungry"], popped: [true, false], left: 1 },
    });
    const burst = confirmMessage(before);
    const rngBeforeCheck = burst.rng;
    const check = confirmMessage(burst);

    expect(burst.battle).toMatchObject({
      phase: "burst",
      message: content.world.critters.gull?.lines.burst,
      windUp: { popped: [true, false] },
      check: null,
      lastGrade: null,
    });
    // Small, and no big roll: just the two puffs' forces are drawn.
    expect(check.battle?.check).toMatchObject({ kind: "lean", big: false });
    expect(check.battle?.windUp).toBe(null);
    expect(check.rng).toBe(nextRng(nextRng(rngBeforeCheck)));
  });

  it("lets go with a big burst when nothing was popped", () => {
    const gull = content.world.critters.gull;
    if (gull?.burst.big?.kind !== "lean") throw new Error("the gull's big lean is missing");
    const before = activeWindUp({
      phase: "result",
      message: "result",
      revealed: 6,
      windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 1 },
    });
    const burst = confirmMessage(before);
    const check = confirmMessage(burst);

    // Big without a roll: only the big lean's three puffs are drawn.
    expect(check.battle?.check).toMatchObject({ kind: "lean", big: true, spec: gull.burst.big });
    expect(check.rng).toBe(nextRng(nextRng(nextRng(burst.rng))));
  });
});

describe("the last check and its grade", () => {
  // A finished ring and its GREAT, as a check leaves the battle at its result.
  const finished = (): Pick<Battle, "check" | "lastGrade"> => ({
    check: { kind: "ring", side: "fae", tick: 44, big: false,
      spec: { kind: "ring", ticks: 60, targetTick: 45, greatWindow: 5, goodWindow: 11 } },
    lastGrade: "great",
  });

  it("go when an ordinary critter's next turn opens its menu", () => {
    const before = boundaryState({ critterId: "owl", feelings: [], ...finished() });
    const after = confirmMessage(before);

    expect(after.battle).toMatchObject({
      phase: "command",
      turn: 2,
      windUp: null,
      check: null,
      lastGrade: null,
    });
  });

  it("go when the critter is soothed", () => {
    const gull = content.world.critters.gull;
    if (gull === undefined) throw new Error("gull missing");
    const before = boundaryState({
      phase: "result",
      message: "result",
      revealed: 6,
      calm: gull.calmMax,
      ...finished(),
    });
    const after = confirmMessage(before);

    expect(after.battle).toMatchObject({ phase: "soothed", check: null, lastGrade: null });
  });
});

describe("wind-up views", () => {
  it("shows bubbles only in command and result, with puff count", () => {
    const state = boundaryState({
      phase: "command",
      message: "",
      revealed: 0,
      windUp: { feelings: ["grumpy", "hungry"], popped: [false, true], left: 1 },
    });
    const command = battleView(content.world, state);
    expect(command?.windUp).toEqual({ bubbles: [
      { id: "grumpy", label: "Grumpy", popped: false },
      { id: "hungry", label: "Hungry", popped: true },
    ] });
    expect(command?.feelings).toBe(null);
    expect(command?.puff).toBe(2);

    const result = battleView(content.world, {
      ...state,
      battle: { ...state.battle!, phase: "result" },
    });
    expect(result?.windUp).toEqual(command?.windUp);

    const check = battleView(content.world, {
      ...state,
      battle: { ...state.battle!, phase: "check" },
    });
    expect(check?.windUp).toBe(null);
    expect(check?.puff).toBe(2);
  });
});

describe("wind-up content validation", () => {
  it("accepts absent and null wind-ups", () => {
    const absent = clone(content.world.critters.gull);
    delete absent.windUp;
    expect(() => parseCritter(absent, "critters/gull.json")).not.toThrow();
    const nullable = clone(content.world.critters.gull);
    nullable.windUp = null;
    expect(() => parseCritter(nullable, "critters/gull.json")).not.toThrow();
  });

  it.each([
    ["start", 1],
    ["bubbles", 0],
    ["every", 2],
    ["start", 1.5],
    ["every", 2.5],
    ["bubbles", 2.5],
  ])("rejects an invalid windUp.%s", (field, value) => {
    const critter = clone(content.world.critters.gull);
    nested(critter, "windUp")[field] = value;
    expect(() => parseCritter(critter, "critters/gull.json"))
      .toThrow(/critters\/gull\.json.*windUp\./);
  });

  it("rejects too many bubbles and every no greater than bubbles", () => {
    const tooMany = clone(content.world.critters.gull);
    nested(tooMany, "windUp").bubbles = 4;
    expect(() => parseCritter(tooMany, "critters/gull.json"))
      .toThrow(/critters\/gull\.json.*windUp\.bubbles/);

    const tooSoon = clone(content.world.critters.gull);
    nested(tooSoon, "windUp").every = 2;
    expect(() => parseCritter(tooSoon, "critters/gull.json"))
      .toThrow(/critters\/gull\.json.*windUp\.every/);
  });

  it.each(["start", "puffing", "fizzle"]) ("rejects an empty windUp.lines.%s", (line) => {
    const critter = clone(content.world.critters.gull);
    nested(critter, "windUp", "lines")[line] = "";
    expect(() => parseCritter(critter, "critters/gull.json"))
      .toThrow(new RegExp(`critters/gull\\.json.*windUp\\.lines\\.${line}`));
  });
});

describe("a wind-up's end", () => {
  it("is over when the critter is soothed mid-wind-up, so it's its own size again", () => {
    const gull = content.world.critters.gull;
    if (gull === undefined) throw new Error("gull missing");
    const before = boundaryState({
      phase: "result",
      message: "result",
      revealed: 6,
      calm: gull.calmMax,
      windUp: { feelings: ["grumpy", "hungry"], popped: [true, false], left: 2 },
    });
    expect(battleView(content.world, before)?.puff).toBe(1);
    const soothed = confirmMessage(before);

    expect(soothed.battle).toMatchObject({ phase: "soothed", windUp: null });
    expect(battleView(content.world, soothed)?.puff).toBe(0);
  });

  it("leaves the lantern dark while a wind-up's bubbles show", () => {
    // Jordan's run ends with the lantern in Fae's backpack.
    const path = "tests/sim/scripts/pass-party/jordan.json";
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let lit = createState(content.world, fixture);
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1)
        lit = step(content.world, lit, segment.frame).state;
    expect(content.world.storyVariable(lit.ink, "has_lantern")).toBe(true);
    const menu = (windUp: Battle["windUp"]): State => {
      const base = battleState("pass-party");
      return {
        ...lit,
        previousInput: blankInput(),
        battle: { ...base.battle!, message: "menu", revealed: 4, windUp },
      };
    };
    const lantern = { ...blankInput(), lantern: true };

    const puffing = menu({ feelings: ["grumpy", "bored"], popped: [false, false], left: 2 });
    const pressed = step(content.world, puffing, lantern).state;
    expect(pressed.battle?.lanternPeek).toBe(false);
    expect(pressed.rng).toBe(puffing.rng);
    // Outside one, the same press peeks.
    expect(step(content.world, menu(null), lantern).state.battle?.lanternPeek).toBe(true);
  });
});
