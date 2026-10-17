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

function battleState(fixtureName: string, critterId = "fountain-frog"): State {
  const fixture = content.fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`${fixtureName} fixture missing`);
  const state = createState(content.world, fixture);
  const battle: Battle = {
    critterId, den: null, entry: state.player, phase: "command",
    message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
    rest: {}, check: null, lastGrade: null, feelings: [], answered: false, lanternPeek: false,
    turn: 1, windUp: null,
    rewardSticker: null, phaseTicks: 0,
  };
  return { ...state, battle };
}

function choose(state: State, index: number): State {
  return step(content.world, state, { ...blankInput(), choose: index }).state;
}

function nextRng(rng: number): number {
  return (Math.imul(rng, 1664525) + 1013904223) >>> 0;
}

describe("battle check wiring", () => {
  it("starts Soothe and Play with their ring checks and Cast with its charge check", () => {
    const state = battleState("plaza-party");
    expect(choose(state, 0).battle?.check).toMatchObject({
      kind: "ring", spec: content.world.battle.commands.soothe.check,
    });
    expect(choose(state, 1).battle?.check).toMatchObject({
      kind: "ring", spec: content.world.party.maddie?.command?.check,
    });
    expect(choose(state, 2).battle?.check).toMatchObject({
      kind: "charge", spec: content.world.party.sue?.command?.check,
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
      kind: "chain", spec: content.world.party.jordan?.command?.check,
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
      battle: { ...state.battle!, critterId: "owl", phase: "burst" },
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

  it("creates a big pup catch with one PRNG draw per toy after its big roll", () => {
    const before: State = {
      ...battleState("plaza-party", "pup"),
      rng: 1,
      battle: { ...battleState("plaza-party", "pup").battle!, phase: "burst" },
    };
    const after = step(content.world, before, { ...blankInput(), confirm: true }).state;
    const pup = content.world.critters.pup;
    if (pup === undefined || pup.burst.big?.kind !== "catch") throw new Error("pup catch missing");
    let expected = nextRng(before.rng);
    const bigValue = expected / 4294967296;
    expect(bigValue).toBeLessThan(pup.burst.bigChance);
    for (const _toy of pup.burst.big.arrivals) expected = nextRng(expected);
    expect(after.rng).toBe(expected);
    expect(after.battle?.check).toMatchObject({ kind: "catch", spec: pup.burst.big });
  });

  it("creates a bluebird lean with one PRNG draw per puff (a force) after its big roll", () => {
    const bluebird = content.world.critters.bluebird;
    if (bluebird === undefined) throw new Error("bluebird missing");
    for (const rng of [1000, 1]) {
      const before: State = {
        ...battleState("plaza-party", "bluebird"),
        rng,
        battle: { ...battleState("plaza-party", "bluebird").battle!, phase: "burst" },
      };
      const after = step(content.world, before, { ...blankInput(), confirm: true }).state;
      let expected = nextRng(before.rng);
      const big = expected / 4294967296 < bluebird.burst.bigChance;
      const spec = big ? bluebird.burst.big : bluebird.burst.check;
      if (spec?.kind !== "lean") throw new Error("bluebird lean missing");
      const strengths = spec.starts.map(() => {
        expected = nextRng(expected);
        return spec.forces[Math.floor(expected / 4294967296 * spec.forces.length)];
      });
      expect(after.rng).toBe(expected);
      expect(after.battle?.check).toMatchObject({ kind: "lean", spec, strengths, balance: 0, big });
    }
  });

  it("charges two energy for a big lean Fae never leans into", () => {
    let state: State = {
      ...battleState("plaza-party", "bluebird"),
      rng: 1,
      battle: { ...battleState("plaza-party", "bluebird").battle!, phase: "burst" },
    };
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    expect(state.battle?.check).toMatchObject({ kind: "lean", big: true });
    while (state.battle?.phase === "check") state = step(content.world, state, blankInput()).state;
    expect(state.battle?.check).toMatchObject({ results: ["miss", "miss", "miss"] });
    expect(state.battle?.lastGrade).toBe("miss");
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    expect(state.battle?.energy).toBe(3);
  });

  it("holds every bluebird puff leaning back toward straight, costing nothing", () => {
    let state: State = {
      ...battleState("plaza-party", "bluebird"),
      rng: 1000,
      battle: { ...battleState("plaza-party", "bluebird").battle!, phase: "burst" },
    };
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    while (state.battle?.phase === "check") {
      const check = state.battle.check;
      const balance = check?.kind === "lean" ? check.balance : 0;
      const x = balance <= -5 ? 1 : balance >= 5 ? -1 : 0;
      state = step(content.world, state, { ...blankInput(), move: { x, y: 0 } }).state;
    }
    expect(state.battle?.lastGrade).toBe("great");
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    expect(state.battle?.energy).toBe(5);
  });

  it("charges two energy for missing every catch toy", () => {
    let state: State = {
      ...battleState("plaza-party", "pup"),
      rng: 1,
      battle: { ...battleState("plaza-party", "pup").battle!, phase: "burst" },
    };
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    while (state.battle?.phase === "check") {
      const check = state.battle.check;
      const pending = check?.kind === "catch"
        ? check.results.findIndex((result) => result === "pending")
        : -1;
      const lane = check?.kind === "catch" && pending >= 0
        ? ((check.lanes[pending] ?? 0) + 1) % 3
        : 1;
      state = step(content.world, state, { ...blankInput(), move: { x: 0, y: lane - 1 } }).state;
    }
    expect(state.battle?.lastGrade).toBe("miss");
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    expect(state.battle?.energy).toBe(3);
  });

  it("catches every pup toy in its rolled lane without spending energy", () => {
    let state: State = {
      ...battleState("plaza-party", "pup"),
      rng: 1,
      battle: { ...battleState("plaza-party", "pup").battle!, phase: "burst" },
    };
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    const check = state.battle?.check;
    if (check === null || check === undefined || check.kind !== "catch")
      throw new Error("catch check missing");
    for (const [index, arrival] of check.spec.arrivals.entries()) {
      const lane = check.lanes[index];
      if (lane === undefined) throw new Error("catch lane missing");
      while (state.battle?.check?.tick !== arrival - 1)
        state = step(content.world, state, { ...blankInput(), move: { x: 0, y: lane - 1 } }).state;
      state = step(content.world, state, { ...blankInput(), move: { x: 0, y: lane - 1 } }).state;
    }
    expect(state.battle?.lastGrade).toBe("great");
    state = step(content.world, state, { ...blankInput(), confirm: true }).state;
    expect(state.battle?.energy).toBe(5);
  });

  it("keeps frog and bunny bursts to one PRNG draw", () => {
    for (const critterId of ["fountain-frog", "bunny"]) {
      const base = battleState("plaza-party", critterId);
      const before: State = { ...base, rng: 1, battle: { ...base.battle!, phase: "burst" } };
      const after = step(content.world, before, { ...blankInput(), confirm: true }).state;
      expect(after.rng).toBe(nextRng(before.rng));
    }
  });
});
