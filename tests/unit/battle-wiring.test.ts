import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  step,
  type Battle,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const content = loadContent();

function battleState(fixtureName: string): State {
  const fixture = content.fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`${fixtureName} fixture missing`);
  const state = createState(content.world, fixture);
  const battle: Battle = {
    critterId: "fountain-frog", den: null, entry: state.player, phase: "command",
    message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
    rest: {}, check: null, lastGrade: null, rewardSticker: null, phaseTicks: 0,
  };
  return { ...state, battle };
}

function choose(state: State, index: number): State {
  return step(content.world, state, { ...blankInput(), choose: index }).state;
}

describe("battle check wiring", () => {
  it("starts Soothe and Play with their ring checks and Cast with its charge check", () => {
    const state = battleState("plaza-party");
    expect(choose(state, 0).battle?.check).toMatchObject({
      kind: "ring", spec: content.world.battle.commands.soothe.check,
    });
    expect(choose(state, 1).battle?.check).toMatchObject({
      kind: "ring", spec: content.world.party.maddie?.command.check,
    });
    expect(choose(state, 2).battle?.check).toMatchObject({
      kind: "charge", spec: content.world.party.sue?.command.check,
    });
  });

  it("starts Juggle with Jordan's chain check", () => {
    const base = battleState("pass-party");
    const first = base.party[0];
    if (first === undefined) throw new Error("party member missing");
    const state: State = {
      ...base,
      party: [...base.party, { ...first, id: "jordan" }],
    };
    expect(choose(state, 3).battle?.check).toMatchObject({
      kind: "chain", spec: content.world.party.jordan?.command.check,
    });
  });

  it("creates the fountain frog burst check and consumes one PRNG draw at creation", () => {
    const state = battleState("plaza-party");
    const burst: Battle = { ...state.battle!, phase: "burst" };
    const before = { ...state, battle: burst };
    const next = step(content.world, before, { ...blankInput(), confirm: true }).state;
    expect(next.rng).not.toBe(before.rng);
    expect(next.battle?.check?.kind).toBe("chain");
    const createdRng = next.rng;
    let resolved = next;
    while (resolved.battle?.phase === "check")
      resolved = step(content.world, resolved, blankInput()).state;
    resolved = step(content.world, resolved, { ...blankInput(), confirm: true }).state;
    expect(resolved.rng).toBe(createdRng);
  });

  it("uses a big burst chain and costs two energy when every beat is missed", () => {
    const state = battleState("plaza-party");
    const before: State = { ...state, battle: { ...state.battle!, phase: "burst" }, rng: 1 };
    let current = step(content.world, before, { ...blankInput(), confirm: true }).state;
    const critter = content.world.critters["fountain-frog"];
    if (critter === undefined || critter.burst.big === undefined)
      throw new Error("big burst missing");
    if (critter.burst.big.kind !== "chain") throw new Error("big burst is not a chain");
    expect(current.battle?.check).toMatchObject({
      spec: { arrivals: critter.burst.big.arrivals },
    });
    while (current.battle?.phase === "check")
      current = step(content.world, current, blankInput()).state;
    expect(current.battle?.lastGrade).toBe("miss");
    current = step(content.world, current, { ...blankInput(), confirm: true }).state;
    expect(current.battle?.energy).toBe(3);
  });

  it("missed small ring bursts cost one energy after one deterministic draw", () => {
    const state = battleState("plaza-party");
    const before: State = {
      ...state,
      battle: { ...state.battle!, critterId: "pup", phase: "burst" },
      rng: 1000,
    };
    let current = step(content.world, before, { ...blankInput(), confirm: true }).state;
    expect(current.battle?.check?.kind).toBe("ring");
    while (current.battle?.phase === "check")
      current = step(content.world, current, blankInput()).state;
    expect(current.battle?.lastGrade).toBe("miss");
    current = step(content.world, current, { ...blankInput(), confirm: true }).state;
    expect(current.battle?.energy).toBe(4);
  });
});
