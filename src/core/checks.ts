import type {
  BattleCheckView,
  BattleContent,
  BeatResult,
  CheckSide,
  CheckSpec,
  CheckState,
  Grade,
} from "./types";

// What one tick of input means to a check: a fresh confirm press, confirm
// held, and the catch lane the stick or arrows point at.
export type CheckInput = { confirmEdge: boolean; confirmHeld: boolean; lane: number };

/**
 * Creates the tick-zero state for a check. A catch needs its toys' lanes,
 * drawn by the caller from the seeded PRNG (`laneFromDraw`).
 */
export function createCheck(
  spec: CheckSpec,
  side: CheckSide,
  big = false,
  lanes: number[] = [],
): CheckState {
  if (spec.kind === "ring")
    return { kind: "ring", side, tick: 0, spec: { ...spec }, big };
  if (spec.kind === "charge")
    return { kind: "charge", side, tick: 0, spec: { ...spec }, held: 0, big };
  if (spec.kind === "catch")
    return {
      kind: "catch",
      side,
      tick: 0,
      spec: { ...spec, arrivals: [...spec.arrivals], toys: [...spec.toys] },
      lanes: spec.arrivals.map((_, index) => lanes[index] ?? 1),
      catcher: 1,
      results: spec.arrivals.map(() => "pending"),
      big,
    };
  return {
    kind: "chain",
    side,
    tick: 0,
    spec: { ...spec, arrivals: [...spec.arrivals] },
    results: spec.arrivals.map(() => "pending"),
    big,
  };
}

/** Advances a check one tick and returns a grade only when it ends. */
export function stepCheck(
  check: CheckState,
  input: CheckInput,
): { check: CheckState; grade: Grade | null } {
  const tick = check.tick + 1;
  if (check.kind === "ring") {
    const grade = input.confirmEdge
      ? gradeAim(
          tick - check.spec.targetTick,
          check.spec.greatWindow,
          check.spec.goodWindow,
        )
      : tick >= check.spec.ticks
        ? "miss"
        : null;
    return { check: { ...check, tick }, grade };
  }
  if (check.kind === "charge")
    return stepCharge(check, tick, input.confirmEdge, input.confirmHeld);
  if (check.kind === "catch") return stepCatch(check, tick, input.lane);
  return stepChain(check, tick, input.confirmEdge);
}

/** Grades charge release, timeout, and overwind without accepting menu input. */
export function stepCharge(
  check: Extract<CheckState, { kind: "charge" }>,
  tick: number,
  confirmEdge: boolean,
  confirmHeld: boolean,
): { check: CheckState; grade: Grade | null } {
  const held =
    check.held === 0
      ? confirmEdge
        ? 1
        : 0
      : confirmHeld
        ? check.held + 1
        : check.held;
  const next = { ...check, tick, held };
  // A press on the last waiting tick still starts the charge.
  const grade =
    check.held > 0 && !confirmHeld
      ? gradeAim(
          check.held - check.spec.targetTick,
          check.spec.greatWindow,
          check.spec.goodWindow,
        )
      : held >= check.spec.maxTicks
        ? "miss"
        : held === 0 && tick >= check.spec.waitTicks
          ? "miss"
          : null;
  return { check: next, grade };
}

/** Resolves visible chain beats, then grades the completed hit ratio. */
export function stepChain(
  check: Extract<CheckState, { kind: "chain" }>,
  tick: number,
  confirmEdge: boolean,
): { check: CheckState; grade: Grade | null } {
  const results = [...check.results];
  check.spec.arrivals.forEach((arrival, index) => {
    if (results[index] === "pending" && tick > arrival + check.spec.hitWindow)
      results[index] = "miss";
  });
  if (confirmEdge) {
    let nearest = -1;
    check.spec.arrivals.forEach((arrival, index) => {
      const current = nearest < 0 ? undefined : check.spec.arrivals[nearest];
      if (
        current === undefined ||
        Math.abs(tick - arrival) < Math.abs(tick - current)
      )
        nearest = index;
    });
    const arrival = nearest < 0 ? undefined : check.spec.arrivals[nearest];
    if (
      nearest >= 0 &&
      arrival !== undefined &&
      results[nearest] === "pending" &&
      tick >= arrival - check.spec.travelTicks
    )
      results[nearest] =
        Math.abs(tick - arrival) <= check.spec.hitWindow ? "hit" : "miss";
  }
  return { check: { ...check, tick, results }, grade: gradeHits(results) };
}

/**
 * Moves the catch to this tick's lane, then each toy landing now is caught
 * if the catch is in its lane, else missed. No button is pressed: holding
 * up reaches high, down low, and neither stays in the middle.
 */
export function stepCatch(
  check: Extract<CheckState, { kind: "catch" }>,
  tick: number,
  lane: number,
): { check: CheckState; grade: Grade | null } {
  const results = check.results.map((result, index) =>
    result === "pending" && tick >= (check.spec.arrivals[index] ?? 0)
      ? check.lanes[index] === lane
        ? "hit"
        : "miss"
      : result,
  );
  return { check: { ...check, tick, catcher: lane, results }, grade: gradeHits(results) };
}

/** The catch lane a stick or arrow points at: 0 high, 1 middle, 2 low. */
export function laneFromStick(moveY: number): number {
  return moveY < -0.5 ? 0 : moveY > 0.5 ? 2 : 1;
}

/** A toy's lane from one seeded PRNG draw in 0..1, spread over the three. */
export function laneFromDraw(value: number): number {
  return Math.min(2, Math.floor(value * 3));
}

/** A thing in flight: 0 when it appears, 1 as it lands (clamped). */
function flight(tick: number, arrival: number, travelTicks: number): number {
  return Math.max(0, Math.min(1, (tick - (arrival - travelTicks)) / travelTicks));
}

/**
 * What the screen shows of a check (spec 8.1), as 0..1 numbers the render
 * places. `actor` is the friend acting in a Fae-side check (null for Soothe
 * and bursts).
 */
export function viewCheck(check: CheckState, actor: number | null): BattleCheckView {
  if (check.kind === "ring")
    return {
      kind: "ring",
      side: check.side,
      progress: check.tick / check.spec.ticks,
      target: check.spec.targetTick / check.spec.ticks,
    };
  if (check.kind === "charge") {
    const { maxTicks, targetTick, greatWindow, goodWindow } = check.spec;
    return {
      kind: "charge",
      side: check.side,
      actor,
      waiting: check.held === 0,
      fill: check.held / maxTicks,
      great: [(targetTick - greatWindow) / maxTicks, (targetTick + greatWindow) / maxTicks],
      good: [(targetTick - goodWindow) / maxTicks, (targetTick + goodWindow) / maxTicks],
    };
  }
  if (check.kind === "catch")
    return {
      kind: "catch",
      side: check.side,
      catcher: check.catcher,
      toys: check.spec.arrivals.map((arrival, index) => ({
        appeared: check.tick >= arrival - check.spec.travelTicks,
        progress: flight(check.tick, arrival, check.spec.travelTicks),
        lane: check.lanes[index] ?? 1,
        frame: check.spec.toys[index % check.spec.toys.length] ?? "",
        result: check.results[index] ?? "pending",
      })),
    };
  return {
    kind: "chain",
    side: check.side,
    actor,
    look: check.spec.look,
    beats: check.spec.arrivals.map((arrival, index) => ({
      appeared: check.tick >= arrival - check.spec.travelTicks,
      progress: flight(check.tick, arrival, check.spec.travelTicks),
      result: check.results[index] ?? "pending",
    })),
  };
}

/**
 * The hint while a check waits for the player: a charge before its first
 * press, a chain or catch before its first landing.
 */
export function checkHint(check: CheckState, hints: BattleContent["hints"]): string | null {
  if (check.kind === "charge") return check.held === 0 ? hints.charge : null;
  if (check.kind === "chain" || check.kind === "catch")
    return check.tick < (check.spec.arrivals[0] ?? 0) ? hints[check.kind] : null;
  return null;
}

/** A finished chain or catch: every one a hit is great, half good. */
function gradeHits(results: BeatResult[]): Grade | null {
  if (results.some((result) => result === "pending")) return null;
  const hits = results.filter((result) => result === "hit").length;
  return hits === results.length ? "great" : hits * 2 >= results.length ? "good" : "miss";
}

export function gradeAim(delta: number, great: number, good: number): Grade {
  const absolute = Math.abs(delta);
  return absolute <= great ? "great" : absolute <= good ? "good" : "miss";
}
