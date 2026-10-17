import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  battleView,
  blankInput,
  createState,
  step,
  soundCues,
  type Battle,
  type State,
} from "../../src/core";
import { feelingFromDraw, feelingsOn } from "../../src/core/feelings";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

const content = loadContent();

function introState(fixtureName: string): State {
  const fixture = content.fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`${fixtureName} fixture missing`);
  const state = createState(content.world, fixture);
  const battle: Battle = {
    critterId: "fountain-frog", den: null, entry: state.player, phase: "intro",
    message: "intro", revealed: 5, selected: 0, command: null, energy: 5, calm: 0,
    rest: {}, check: null, lastGrade: null, feelings: [], answered: false,
    lanternPeek: false, rewardSticker: null, phaseTicks: 0,
  };
  return { ...state, battle };
}

function nextRng(rng: number): number {
  return (Math.imul(rng, 1664525) + 1013904223) >>> 0;
}

function commandState(fixtureName: string, feelings: Battle["feelings"], calm = 0): State {
  const state = introState(fixtureName);
  return {
    ...state,
    battle: {
      ...state.battle!, phase: "command", message: "", revealed: 0, feelings,
      calm, energy: 5,
    },
  };
}

describe("battle feelings", () => {
  it("keeps feelings off and the PRNG untouched for a solo party", () => {
    const before = introState("plaza");
    const after = step(content.world, before, { ...blankInput(), confirm: true }).state;

    expect(after.rng).toBe(before.rng);
    expect(after.battle?.feelings).toEqual([]);
  });

  it("counts only friends with a battle command toward turning feelings on", () => {
    const state = introState("plaza-party");
    expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    expect(feelingsOn(content.world, state)).toBe(true);
    // A party member the roster gives no battle command doesn't count.
    const { sue: _sue, ...withoutSue } = content.world.party;
    expect(feelingsOn({ ...content.world, party: withoutSue }, state)).toBe(false);
  });

  it("draws exactly three answerable feelings when the intro ends", () => {
    const before = introState("plaza-party");
    const critter = content.world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("fountain frog missing");

    const expected: (typeof critter.feelings[number] | null)[] = [];
    let rng = before.rng;
    for (let index = 0; index < 3; index += 1) {
      rng = nextRng(rng);
      expected.push(feelingFromDraw(content.world, { ...before, rng }, critter, rng / 4294967296));
    }

    const after = step(content.world, before, { ...blankInput(), confirm: true }).state;

    expect(after.rng).toBe(rng);
    expect(after.battle?.feelings).toEqual(expected);
  });

  it("filters feelings by the commands and snack currently available", () => {
    const solo = introState("plaza");
    const bunny = content.world.critters.bunny;
    if (bunny === undefined) throw new Error("bunny missing");
    const pick = (state: State, value: number) =>
      feelingFromDraw(content.world, state, bunny, value);

    expect(pick(solo, 0)).toBe("zoomy");
    expect(pick(solo, 0.99)).toBe("grumpy");
    expect(pick(solo, 0.5)).not.toBe("curious");
    expect(pick({ ...solo, snacks: 1 }, 0.5)).toBe("hungry");
    expect(pick({ ...solo, party: [], snacks: 0 }, 0)).toBe("grumpy");
    expect(pick({ ...solo, snacks: 0, party: [] }, 0.5)).toBe("grumpy");
    expect(feelingFromDraw(content.world, solo, { ...bunny, feelings: [] }, 0.5)).toBe(null);
  });

  it("moves the row and draws exactly one feeling at the turn boundary", () => {
    const before = introState("plaza-party");
    const state = step(content.world, before, { ...blankInput(), confirm: true }).state;
    const battle = state.battle;
    if (battle === null) throw new Error("battle missing");
    const boundary: State = {
      ...state,
      battle: {
        ...battle, phase: "burstResult", message: "", revealed: 0, answered: true, energy: 5,
      },
    };
    const expectedRng = nextRng(state.rng);
    const revealed = step(content.world, boundary, { ...blankInput(), confirm: true }).state;
    const after = step(content.world, revealed, { ...blankInput(), confirm: false }).state;
    const final = step(content.world, after, { ...blankInput(), confirm: true }).state;

    expect(final.rng).toBe(expectedRng);
    expect(final.battle?.feelings).toEqual([
      battle.feelings[1], battle.feelings[2],
      feelingFromDraw(content.world, boundary, content.world.critters["fountain-frog"] ??
        (() => { throw new Error("fountain frog missing"); })(), expectedRng / 4294967296),
    ]);
    expect(final.battle?.answered).toBe(false);
  });

  it("adds the bonus immediately for an answered Snack and clamps calm", () => {
    const state = commandState("plaza-party", ["hungry", "grumpy", null], 95);
    const after = step(
      content.world, { ...state, snacks: 1 }, { ...blankInput(), choose: 3 },
    ).state;

    expect(after.battle?.answered).toBe(true);
    expect(after.battle?.calm).toBe(content.world.critters["fountain-frog"]?.calmMax ?? 100);
  });

  it("adds the bonus for a Soothe check even when the check misses", () => {
    const state = commandState("plaza-party", ["grumpy", null, null], 0);
    const selected = step(content.world, state, { ...blankInput(), choose: 0 }).state;
    let current = selected;
    while (current.battle?.phase === "check")
      current = step(content.world, current, blankInput()).state;

    expect(current.battle?.lastGrade).toBe("miss");
    expect(current.battle?.calm).toBe(content.world.battle.feelingBonus +
      (content.world.critters["fountain-frog"]?.commands.soothe.calm ?? 0));
  });

  it("marks only the answering command and exposes feelings in command and result", () => {
    const state = commandState("plaza-party", ["grumpy", "hungry", null]);
    const commandView = battleView(content.world, state);
    if (commandView === null) throw new Error("battle view missing");
    expect(commandView.feelings).toEqual({
      now: { id: "grumpy", label: content.world.battle.feelings.grumpy.label },
      next: "hungry", later: null, answered: false,
    });
    expect(commandView.commands.find((command) => command.id === "soothe")?.feeling)
      .toBe("grumpy");
    expect(commandView.commands.find((command) => command.id === "snack")?.feeling)
      .toBe(null);
    expect(commandView.commands.find((command) => command.id === "run")?.feeling)
      .toBe(null);

    const result = battleView(content.world, {
      ...state,
      battle: { ...state.battle!, phase: "result", answered: true },
    });
    expect(result?.feelings?.answered).toBe(true);
  });

  it("gives every critter at least one Soothe, Play, or Cast feeling", () => {
    const answers = new Set(["soothe", "play", "cast"]);
    for (const critter of Object.values(content.world.critters))
      expect(critter.feelings.some((id) => answers.has(content.world.battle.feelings[id].answer)),
        critter.id).toBe(true);
  });

  it("peeks the later feeling with the real lantern and never consumes a draw", () => {
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/jordan.json";
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    let state = createState(content.world, fixture);
    for (const segment of script)
      for (let tick = 0; tick < segment.ticks; tick += 1)
        state = step(content.world, state, segment.frame).state;
    const battle: Battle = {
      critterId: "fountain-frog", den: null, entry: state.player, phase: "command",
      message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
      rest: {}, check: null, lastGrade: null, feelings: ["grumpy", "hungry", "zoomy"],
      answered: false, lanternPeek: false, rewardSticker: null, phaseTicks: 0,
    };
    const before = { ...state, battle, lantern: false };
    const after = step(content.world, before, { ...blankInput(), lantern: true }).state;

    expect(after.battle?.lanternPeek).toBe(true);
    expect(after.rng).toBe(before.rng);
    expect(after.lantern).toBe(false);
    expect(soundCues(before, after, content.world)).toContain("lantern-on");
    expect(battleView(content.world, after)?.feelings?.later).toBe("zoomy");

    const again = step(
      content.world,
      { ...after, previousInput: { ...after.previousInput, lantern: false } },
      { ...blankInput(), lantern: true },
    ).state;
    expect(again.rng).toBe(after.rng);
    expect(again.battle?.lanternPeek).toBe(true);
  });

  it("does not peek without the edge, before typing, outside command, or when off", () => {
    const base = commandState("plaza-party", ["grumpy", "hungry", "zoomy"]);
    const noLantern = step(content.world, base, { ...blankInput(), lantern: true }).state;
    expect(noLantern.battle?.lanternPeek).toBe(false);

    const typing: State = {
      ...base,
      ink: base.ink,
      battle: { ...base.battle!, message: "still typing", revealed: 0 },
    };
    expect(
      step(content.world, typing, { ...blankInput(), lantern: true }).state.battle?.lanternPeek,
    ).toBe(false);

    const outside: State = {
      ...base,
      battle: { ...base.battle!, phase: "check", message: "", revealed: 0 },
    };
    expect(
      step(content.world, outside, { ...blankInput(), lantern: true }).state.battle?.lanternPeek,
    ).toBe(false);

    const off: State = {
      ...base,
      party: base.party.slice(0, 1),
      battle: { ...base.battle!, feelings: [] },
    };
    expect(step(content.world, off, { ...blankInput(), lantern: true }).state.battle?.lanternPeek)
      .toBe(false);
  });
});
