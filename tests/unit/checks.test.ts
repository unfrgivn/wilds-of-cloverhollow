import { describe, expect, it } from "vitest";
import { createCheck, laneFromDraw, laneFromStick, stepCheck } from "../../src/core/checks";
import type { CheckSpec, CheckState } from "../../src/core";

const ring: CheckSpec = {
  kind: "ring", ticks: 20, targetTick: 10, greatWindow: 2, goodWindow: 4,
};
const charge: CheckSpec = {
  kind: "charge", waitTicks: 5, maxTicks: 23, targetTick: 10,
  greatWindow: 0, goodWindow: 6,
};
const chain: CheckSpec = {
  kind: "chain", travelTicks: 5, hitWindow: 2, arrivals: [10, 20, 30],
  look: "pinecone",
};

function advance(
  state: CheckState,
  tick: number,
  edge = false,
  held = false,
): { check: CheckState; grade: string | null } {
  while (state.tick < tick - 1)
    state = stepCheck(state, { confirmEdge: false, confirmHeld: false, lane: 1 }).check;
  return stepCheck(state, { confirmEdge: edge, confirmHeld: held, lane: 1 });
}

function edgeAt(state: CheckState, tick: number): { check: CheckState; grade: string | null } {
  return advance(state, tick, true, true);
}

function chargeHeld(state: CheckState): number {
  if (state.kind !== "charge") throw new Error("expected charge check");
  return state.held;
}

function chainResults(state: CheckState): string[] {
  if (state.kind !== "chain") throw new Error("expected chain check");
  return state.results;
}

describe("battle check rules", () => {
  it("grades a ring press from its tick-zero origin and misses at its end", () => {
    const started = createCheck(ring, "critter");

    expect(advance(started, 10, true, true).grade).toBe("great");
    expect(advance(started, 14, true, true).grade).toBe("good");
    expect(advance(started, 20).grade).toBe("miss");
  });

  it("grades exact charge hold, six late as good, and twelve late as miss", () => {
    const run = (heldTicks: number): string | null => {
      let state = createCheck(charge, "critter");
      ({ check: state } = edgeAt(state, 1));
      for (let tick = 2; tick <= heldTicks; tick += 1)
        ({ check: state } = advance(state, tick, false, true));
      return advance(state, heldTicks + 1, false, false).grade;
    };

    expect(run(10)).toBe("great");
    expect(run(16)).toBe("good");
    expect(run(22)).toBe("miss");
  });

  it("does not start a charge from the command-choosing confirm edge", () => {
    let state = createCheck(charge, "critter");
    ({ check: state } = stepCheck(state, { confirmEdge: true, confirmHeld: true, lane: 1 }));
    expect(chargeHeld(state)).toBe(1);
  });

  it("requires a fresh press after holding through a charge", () => {
    let state = createCheck(charge, "critter");
    ({ check: state } = stepCheck(state, { confirmEdge: false, confirmHeld: true, lane: 1 }));
    ({ check: state } = stepCheck(state, { confirmEdge: false, confirmHeld: true, lane: 1 }));
    expect(chargeHeld(state)).toBe(0);
    expect(stepCheck(state, {
      confirmEdge: false, confirmHeld: false, lane: 1,
    }).grade).toBeNull();
    expect(chargeHeld(stepCheck(state, {
      confirmEdge: true, confirmHeld: true, lane: 1,
    }).check)).toBe(1);
  });

  it("misses an untouched charge at waitTicks but accepts an edge on waitTicks", () => {
    expect(advance(createCheck(charge, "critter"), 5).grade).toBe("miss");
    let state = createCheck(charge, "critter");
    ({ check: state } = edgeAt(state, 5));
    expect(chargeHeld(state)).toBe(1);
  });

  it("misses an overwound charge at maxTicks", () => {
    let state = createCheck(charge, "critter");
    ({ check: state } = edgeAt(state, 1));
    for (let tick = 2; tick <= charge.maxTicks; tick += 1)
      ({ check: state } = advance(state, tick, false, true));
    expect(state.tick).toBe(charge.maxTicks);
    expect(chargeHeld(state)).toBe(charge.maxTicks);
  });

  it("grades every chain arrival great", () => {
    let state = createCheck(chain, "critter");
    for (const arrival of chain.arrivals) {
      const result = edgeAt(state, arrival);
      state = result.check;
      if (arrival !== chain.arrivals.at(-1)) expect(result.grade).toBeNull();
      else expect(result.grade).toBe("great");
    }
  });

  it("grades a chain with half its beats hit as good and none as miss", () => {
    let state = createCheck(chain, "critter");
    state = edgeAt(state, 10).check;
    state = edgeAt(state, 20).check;
    expect(edgeAt(state, 33).grade).toBe("good");

    state = createCheck(chain, "critter");
    expect(advance(state, 33).grade).toBe("miss");
  });

  it("does not turn mashing into chain hits", () => {
    const spec: CheckSpec = {
      kind: "chain", travelTicks: 3, hitWindow: 1, arrivals: [8, 18, 28],
      look: "dust",
    };
    let state = createCheck(spec, "critter");
    for (let tick = 1; tick <= 29; tick += 1)
      ({ check: state } = advance(state, tick, tick % 2 === 1, tick % 2 === 1));
    expect(chainResults(state)).toEqual(["miss", "miss", "miss"]);
  });

  it("does not let a late press resolve the next beat", () => {
    let state = createCheck(chain, "critter");
    state = advance(state, 13, true, true).check;
    expect(chainResults(advance(state, 20, true, true).check)[1]).toBe("hit");
  });

  it("does nothing when pressed before a chain beat appears", () => {
    let state = createCheck(chain, "critter");
    state = edgeAt(state, 4).check;
    expect(chainResults(state)[0]).toBe("pending");
  });

  it("includes both edges of a chain hit window", () => {
    expect(edgeAt(createCheck(chain, "critter"), 8).grade).toBeNull();
    expect(edgeAt(createCheck(chain, "critter"), 12).grade).toBeNull();
  });

  it("resolves at most one chain beat for each edge", () => {
    const spec: CheckSpec = {
      kind: "chain", travelTicks: 2, hitWindow: 1, arrivals: [8, 14], look: "bubble",
    };
    const state = edgeAt(createCheck(spec, "critter"), 8).check;
    expect(chainResults(state)).toEqual(["hit", "pending"]);
  });
});

describe("catch check rules", () => {
  const catchSpec: CheckSpec = {
    kind: "catch", travelTicks: 2, arrivals: [3, 11, 19], toys: ["ball", "duck"],
  };

  function catchAt(
    state: CheckState,
    tick: number,
    lane: number,
  ): { check: CheckState; grade: string | null } {
    while (state.tick < tick - 1)
      state = stepCheck(state, { confirmEdge: false, confirmHeld: false, lane: 1 }).check;
    return stepCheck(state, { confirmEdge: false, confirmHeld: false, lane });
  }

  it("catches every toy in its lane and grades all hits great", () => {
    let state = createCheck(catchSpec, "critter", false, [0, 1, 2]);
    state = catchAt(state, 3, 0).check;
    state = catchAt(state, 11, 1).check;
    const result = catchAt(state, 19, 2);

    expect(result.grade).toBe("great");
    expect(result.check.kind === "catch" ? result.check.results : []).toEqual([
      "hit", "hit", "hit",
    ]);
  });

  it("grades at least half the toys good", () => {
    let state = createCheck(catchSpec, "critter", false, [0, 0, 2]);
    state = catchAt(state, 3, 0).check;
    state = catchAt(state, 11, 0).check;
    expect(catchAt(state, 19, 0).grade).toBe("good");
  });

  it("grades fewer than half the toys miss", () => {
    let state = createCheck(catchSpec, "critter", false, [0, 1, 2]);
    state = catchAt(state, 3, 1).check;
    state = catchAt(state, 11, 0).check;
    expect(catchAt(state, 19, 1).grade).toBe("miss");
  });

  it("resolves toys on their arrival tick and requires the lane that tick", () => {
    let state = createCheck(catchSpec, "critter", false, [0, 2, 1]);
    state = catchAt(state, 2, 0).check;
    expect(state.kind === "catch" ? state.results : []).toEqual(["pending", "pending", "pending"]);
    state = catchAt(state, 3, 1).check;
    expect(state.kind === "catch" ? state.results[0] : "pending").toBe("miss");
  });

  it("follows the stick on the same tick as an arrival", () => {
    const state = createCheck(catchSpec, "critter", false, [2, 1, 0]);
    const result = catchAt(state, 3, 2);

    expect(result.check.kind === "catch" ? result.check.results[0] : "pending").toBe("hit");
  });

  it("maps stick thresholds to high, middle, and low lanes", () => {
    expect(laneFromStick(-0.5001)).toBe(0);
    expect(laneFromStick(-0.5)).toBe(1);
    expect(laneFromStick(0.5)).toBe(1);
    expect(laneFromStick(0.5001)).toBe(2);
  });

  it("maps draw boundaries to the three lanes", () => {
    expect(laneFromDraw(0)).toBe(0);
    expect(laneFromDraw(0.3333)).toBe(0);
    expect(laneFromDraw(0.6667)).toBe(2);
    expect(laneFromDraw(0.9999)).toBe(2);
  });
});
