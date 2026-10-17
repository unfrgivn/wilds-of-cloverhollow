import type { CheckSide, CheckSpec, CheckState, Grade } from "./types";

/** Creates the tick-zero state for a check. */
export function createCheck(
  spec: CheckSpec,
  side: CheckSide,
  big = false,
): CheckState {
  if (spec.kind === "ring")
    return { kind: "ring", side, tick: 0, spec: { ...spec }, big };
  if (spec.kind === "charge")
    return { kind: "charge", side, tick: 0, spec: { ...spec }, held: 0, big };
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
  confirmEdge: boolean,
  confirmHeld: boolean,
): { check: CheckState; grade: Grade | null } {
  const tick = check.tick + 1;
  if (check.kind === "ring") {
    const grade = confirmEdge
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
    return stepCharge(check, tick, confirmEdge, confirmHeld);
  return stepChain(check, tick, confirmEdge);
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
  const next = { ...check, tick, results };
  if (results.some((result) => result === "pending"))
    return { check: next, grade: null };
  const hits = results.filter((result) => result === "hit").length;
  return {
    check: next,
    grade:
      hits === results.length
        ? "great"
        : hits * 2 >= results.length
          ? "good"
          : "miss",
  };
}

export function gradeAim(delta: number, great: number, good: number): Grade {
  const absolute = Math.abs(delta);
  return absolute <= great ? "great" : absolute <= good ? "good" : "miss";
}
