import type {
  BattleCheckView,
  BattleContent,
  BeatResult,
  CheckSide,
  CheckSpec,
  CheckState,
  Grade,
} from "./types";

// Which way Fae leans: back (-1), neither, or forward into the wind (1).
export type Lean = -1 | 0 | 1;

// What one tick of input means to a check: a fresh confirm press, confirm
// held, the catch lane the stick or arrows point at, and the way they lean.
export type CheckInput = {
  confirmEdge: boolean;
  confirmHeld: boolean;
  lane: number;
  lean: Lean;
  pointer?: { x: number; y: number };
  move?: { x: number; y: number };
};

// Fae's balance in a lean runs from -100 (blown over backward) to 100
// (leaned over forward); 0 is standing straight.
const balanceEnd = 100;

/**
 * Creates the tick-zero state for a check. A catch's toys need their lanes
 * and a lean's puffs their forces, picked by the caller from the seeded PRNG
 * (`checkDraws`, `pickFromDraw`).
 */
export function createCheck(
  spec: CheckSpec,
  side: CheckSide,
  big = false,
  picks: number[] = [],
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
      lanes: spec.arrivals.map((_, index) => picks[index] ?? 1),
      catcher: 1,
      results: spec.arrivals.map(() => "pending"),
      big,
    };
  if (spec.kind === "lean")
    return {
      kind: "lean",
      side,
      tick: 0,
      spec: { ...spec, starts: [...spec.starts], forces: [...spec.forces] },
      strengths: spec.starts.map((_, index) => picks[index] ?? spec.forces[0] ?? 0),
      balance: 0,
      results: spec.starts.map(() => "pending"),
      big,
    };
  if (spec.kind === "trace") {
    const path = spec.paths[picks[0] ?? 0] ?? spec.paths[0] ?? { id: "", points: [] };
    const points = path?.points ?? [];
    return {
      kind: "trace",
      side,
      tick: 0,
      spec: { ...spec, paths: spec.paths.map((item) => ({ ...item, points: [...item.points] })) },
      path: { ...path, points: [...points] },
      checkpoint: 0,
      brush: { ...(points[0] ?? { x: 0, y: 0 }) },
      results: points.map(() => "pending"),
      big,
    };
  }
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
  if (check.kind === "lean") return stepLean(check, tick, input.lean);
  if (check.kind === "trace") return stepTrace(check, tick, input.pointer, input.move);
  return stepChain(check, tick, input.confirmEdge);
}

function distance(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function stepTrace(
  check: Extract<CheckState, { kind: "trace" }>,
  tick: number,
  pointer: { x: number; y: number } | undefined,
  move: { x: number; y: number } | undefined,
): { check: CheckState; grade: Grade | null } {
  const results = [...check.results];
  let checkpoint = check.checkpoint;
  // The brush is authored on the first point, so the first point is resolved
  // on the first tick even if the player's first movement leaves it.
  const startedAtFirst = checkpoint === 0 && results[0] === "pending";
  if (startedAtFirst) {
    results[0] = "hit";
    checkpoint = 1;
  }
  const target = pointer ?? move ?? { x: 0, y: 0 };
  const dx = target.x - check.brush.x;
  const dy = target.y - check.brush.y;
  const magnitude = pointer === undefined ? distance(target.x, target.y) : distance(dx, dy);
  const scale = magnitude === 0 ? 0 : pointer === undefined
    ? (magnitude > 1 ? 1 / magnitude : 1) * check.spec.brushSpeed
    : Math.min(check.spec.brushSpeed, magnitude) / magnitude;
  const nextBrush = pointer === undefined
    ? { x: check.brush.x + target.x * scale, y: check.brush.y + target.y * scale }
    : { x: check.brush.x + dx * scale, y: check.brush.y + dy * scale };
  const brush = {
    x: Math.max(0, Math.min(1000, nextBrush.x)),
    y: Math.max(0, Math.min(1000, nextBrush.y)),
  };
  if (!startedAtFirst && results.some((result) => result === "pending") &&
      checkpoint < check.path.points.length) {
    const point = check.path.points[checkpoint];
    if (point !== undefined &&
        distance(brush.x - point.x, brush.y - point.y) <= check.spec.reachRadius) {
      results[checkpoint] = "hit";
      checkpoint += 1;
    }
  }
  const dried = tick >= check.spec.dryTicks;
  if (dried) {
    for (let index = 0; index < results.length; index += 1)
      if (results[index] === "pending") results[index] = "miss";
  }
  const grade = results.some((result) => result === "pending") ? null : gradeHits(results);
  return { check: { ...check, tick, brush, checkpoint, results }, grade };
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

/**
 * Blows the puff in play (one still pending), then leans Fae the way the
 * player holds; with no puff and no lean she settles back toward straight.
 * Reaching either end in a puff loses it: the puff stops and she stands
 * straight again. A puff that blows its whole time without that is held.
 *
 *   -100 <-- a puff pushes her back --- 0 --- leaning pulls her forward --> 100
 *   blown over                       straight                   leaned over
 */
export function stepLean(
  check: Extract<CheckState, { kind: "lean" }>,
  tick: number,
  lean: Lean,
): { check: CheckState; grade: Grade | null } {
  const { puffTicks, starts, steer, spring } = check.spec;
  const puff = starts.findIndex((start, index) =>
    check.results[index] === "pending" && tick >= start && tick < start + puffTicks);
  const force = puff < 0 ? 0 : (check.strengths[puff] ?? 0);
  const settling = puff < 0 && lean === 0;
  const moved = settling
    ? check.balance - Math.sign(check.balance) * Math.min(spring, Math.abs(check.balance))
    : check.balance - force + lean * steer;
  const balance = Math.max(-balanceEnd, Math.min(balanceEnd, moved));
  const over = puff >= 0 && Math.abs(balance) >= balanceEnd;
  const results = check.results.map((result, index): BeatResult =>
    index !== puff
      ? result
      : over
        ? "miss"
        : tick === (starts[index] ?? 0) + puffTicks - 1
          ? "hit"
          : result);
  return {
    check: { ...check, tick, balance: over ? 0 : balance, results },
    grade: gradeHits(results),
  };
}

/** The catch lane a stick or arrow points at: 0 high, 1 middle, 2 low. */
export function laneFromStick(moveY: number): number {
  return moveY < -0.5 ? 0 : moveY > 0.5 ? 2 : 1;
}

/** Which way a stick or arrow leans Fae: right is forward, into the wind. */
export function leanFromStick(moveX: number): Lean {
  return moveX < -0.5 ? -1 : moveX > 0.5 ? 1 : 0;
}

/** A toy's lane from one seeded PRNG draw in 0..1, spread over the three. */
export function laneFromDraw(value: number): number {
  return Math.min(2, Math.floor(value * 3));
}

/** How many seeded draws a check takes as it starts: one per catch toy or lean puff. */
export function checkDraws(spec: CheckSpec): number {
  return spec.kind === "catch"
    ? spec.arrivals.length
    : spec.kind === "lean"
      ? spec.starts.length
      : spec.kind === "trace"
        ? 1
      : 0;
}

/**
 * What one draw in 0..1 picks: a lean puff's force (each of `forces` as
 * likely), or a catch toy's lane.
 */
export function pickFromDraw(spec: CheckSpec, value: number): number {
  if (spec.kind === "trace")
    return Math.min(spec.paths.length - 1, Math.floor(value * spec.paths.length));
  if (spec.kind !== "lean") return laneFromDraw(value);
  const index = Math.min(spec.forces.length - 1, Math.floor(value * spec.forces.length));
  return spec.forces[index] ?? 0;
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
  if (check.kind === "lean") {
    const { starts, puffTicks, steer } = check.spec;
    return {
      kind: "lean",
      side: check.side,
      balance: check.balance / balanceEnd,
      puffs: starts.map((start, index) => {
        const result = check.results[index] ?? "pending";
        return {
          // A pending puff resolves by its last tick, so started is blowing.
          blowing: result === "pending" && check.tick >= start,
          progress: Math.max(0, Math.min(1, (check.tick - start) / puffTicks)),
          force: (check.strengths[index] ?? 0) / steer,
          result,
        };
      }),
    };
  }
  if (check.kind === "trace")
    return {
      kind: "trace",
      side: check.side,
      brush: check.brush,
      path: check.path,
      checkpoint: check.checkpoint,
      results: check.results,
      dry: Math.max(0, Math.min(1, check.tick / check.spec.dryTicks)),
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
 * press, a chain or catch before its first landing, a lean before its first
 * puff.
 */
export function checkHint(check: CheckState, hints: BattleContent["hints"]): string | null {
  if (check.kind === "charge") return check.held === 0 ? hints.charge : null;
  if (check.kind === "chain" || check.kind === "catch")
    return check.tick < (check.spec.arrivals[0] ?? 0) ? hints[check.kind] : null;
  if (check.kind === "lean")
    return check.tick < (check.spec.starts[0] ?? 0) ? hints.lean : null;
  if (check.kind === "trace") return check.results[1] === "pending" ? hints.trace : null;
  return null;
}

/** A finished chain, catch, or lean: every one a hit is great, half good. */
function gradeHits(results: BeatResult[]): Grade | null {
  if (results.some((result) => result === "pending")) return null;
  const hits = results.filter((result) => result === "hit").length;
  return hits === results.length ? "great" : hits * 2 >= results.length ? "good" : "miss";
}

export function gradeAim(delta: number, great: number, good: number): Grade {
  const absolute = Math.abs(delta);
  return absolute <= great ? "great" : absolute <= good ? "good" : "miss";
}
