import type {
  BattleCheckView,
  BattleContent,
  BeatResult,
  CheckSide,
  CheckSpec,
  CheckState,
  EchoNote,
  Grade,
  PeekabooState,
  PeekabooStatus,
} from "./types";
import {
  checkDrawsV2,
  checkHintV2,
  createCheckV2,
  gentleCheckV2Spec,
  pickFromDrawV2,
  stepCheckV2,
  viewCheckV2,
} from "./checks-v2";

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
  previousMove?: { x: number; y: number };
  choose?: number;
  echoNote?: EchoNote | null;
};

// Fae's balance in a lean runs from -100 (blown over backward) to 100
// (leaned over forward); 0 is standing straight.
const balanceEnd = 100;

/**
 * Returns a gentler copy of a check spec with wider timing windows, slower
 * incoming toys, softer wind puffs, and more generous trace reach and dry time.
 * Keeps every timing invariant valid for the simulation.
 */
export function gentleCheckSpec(spec: CheckSpec): CheckSpec {
  if (spec.kind === "ring") {
    const maxWin = Math.max(
      1,
      Math.min(spec.targetTick - 1, spec.ticks - 1 - spec.targetTick),
    );
    const greatWindow = Math.min(
      maxWin,
      Math.max(spec.greatWindow + 1, Math.round(spec.greatWindow * 1.6)),
    );
    const goodWindow = Math.min(
      maxWin,
      Math.max(greatWindow, Math.round(spec.goodWindow * 1.5)),
    );
    return { ...spec, greatWindow, goodWindow };
  }
  if (spec.kind === "charge") {
    const maxWin = Math.max(
      1,
      Math.min(spec.targetTick - 1, spec.maxTicks - 1 - spec.targetTick),
    );
    const greatWindow = Math.min(
      maxWin,
      Math.max(spec.greatWindow + 1, Math.round(spec.greatWindow * 1.6)),
    );
    const goodWindow = Math.min(
      maxWin,
      Math.max(greatWindow, Math.round(spec.goodWindow * 1.5)),
    );
    return { ...spec, greatWindow, goodWindow };
  }
  if (spec.kind === "chain") {
    let minGap = Infinity;
    for (let index = 1; index < spec.arrivals.length; index += 1) {
      const previous = spec.arrivals[index - 1];
      const current = spec.arrivals[index];
      if (previous !== undefined && current !== undefined)
        minGap = Math.min(minGap, current - previous);
    }
    const maxHit =
      minGap === Infinity
        ? spec.hitWindow * 2
        : Math.max(spec.hitWindow, Math.floor((minGap - 2) / 2));
    const hitWindow = Math.min(
      maxHit,
      Math.max(spec.hitWindow + 1, Math.round(spec.hitWindow * 1.5)),
    );
    return { ...spec, arrivals: [...spec.arrivals], hitWindow };
  }
  if (spec.kind === "catch") {
    const travelTicks = Math.round(spec.travelTicks * 1.2);
    const shift = travelTicks - spec.travelTicks;
    const arrivals: number[] = [];
    spec.arrivals.forEach((arrival, index) => {
      if (index === 0) {
        arrivals.push(Math.max(travelTicks, arrival + shift));
      } else {
        const previousOriginal = spec.arrivals[index - 1] ?? arrival;
        const previousGentle = arrivals[index - 1] ?? travelTicks;
        arrivals.push(previousGentle + (arrival - previousOriginal) + 4);
      }
    });
    return { ...spec, travelTicks, arrivals, toys: [...spec.toys] };
  }
  if (spec.kind === "lean") {
    return {
      ...spec,
      starts: [...spec.starts],
      forces: spec.forces.map((force) => Math.max(1, force - 1)),
      steer: spec.steer + 1,
      spring: spec.spring + 1,
    };
  }
  if (spec.kind === "peekaboo") {
    const goal = spec.goal >= 20
      ? Math.max(20, Math.round(spec.goal * 0.78))
      : Math.max(1, Math.round(spec.goal * 0.78));
    return {
      ...spec,
      warningTicks: Math.min(28, spec.warningTicks + 6),
      graceTicks: Math.min(10, spec.graceTicks + 5),
      goal,
      peeks: spec.peeks.map((peek) => ({ ...peek })),
    };
  }
  if (spec.kind === "echo") {
    return {
      ...spec,
      demoTicks: spec.demoTicks + 4,
      inputTicks: spec.inputTicks + 36,
    };
  }
  if (spec.kind === "which-one" || spec.kind === "whack" || spec.kind === "spin-snag") {
    return gentleCheckV2Spec(spec);
  }
  return {
    ...spec,
    reachRadius: Math.round(spec.reachRadius * 1.35),
    brushSpeed: Math.round(spec.brushSpeed * 1.2),
    dryTicks: Math.round(spec.dryTicks * 1.4),
    paths: spec.paths.map((item) => ({ ...item, points: [...item.points] })),
  };
}

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
  gentle = false,
): CheckState {
  const effective = gentle ? gentleCheckSpec(spec) : spec;
  if (effective.kind === "ring")
    return { kind: "ring", side, tick: 0, spec: { ...effective }, big };
  if (effective.kind === "charge")
    return { kind: "charge", side, tick: 0, spec: { ...effective }, held: 0, big };
  if (effective.kind === "catch")
    return {
      kind: "catch",
      side,
      tick: 0,
      spec: { ...effective, arrivals: [...effective.arrivals], toys: [...effective.toys] },
      lanes: effective.arrivals.map((_, index) => picks[index] ?? 1),
      catcher: 1,
      results: effective.arrivals.map(() => "pending"),
      big,
    };
  if (effective.kind === "lean")
    return {
      kind: "lean",
      side,
      tick: 0,
      spec: { ...effective, starts: [...effective.starts], forces: [...effective.forces] },
      strengths: effective.starts.map((_, index) => picks[index] ?? effective.forces[0] ?? 0),
      balance: 0,
      results: effective.starts.map(() => "pending"),
      big,
    };
  if (effective.kind === "trace") {
    const path = effective.paths[picks[0] ?? 0] ?? effective.paths[0] ?? { id: "", points: [] };
    const points = path?.points ?? [];
    return {
      kind: "trace",
      side,
      tick: 0,
      spec: {
        ...effective,
        paths: effective.paths.map((item) => ({ ...item, points: [...item.points] })),
      },
      path: { ...path, points: [...points] },
      checkpoint: 0,
      brush: { ...(points[0] ?? { x: 0, y: 0 }) },
      results: points.map(() => "pending"),
      big,
    };
  }
  if (effective.kind === "peekaboo") {
    return {
      kind: "peekaboo",
      side,
      tick: 0,
      spec: {
        ...effective,
        peeks: effective.peeks.map((peek) => ({ ...peek })),
      },
      progress: 0,
      spotted: effective.peeks.map(() => 0),
      peeksCleared: 0,
      result: null,
      big,
    };
  }
  if (effective.kind === "echo") {
    const sequence: EchoNote[] = Array.from({ length: effective.notes }, (_, index) =>
      toEchoNote(picks[index] ?? 0));
    return {
      kind: "echo",
      side,
      tick: 0,
      spec: { ...effective },
      sequence,
      results: sequence.map(() => "pending"),
      entered: 0,
      activeNote: null,
      activeTicks: 0,
      big,
    };
  }
  if (effective.kind === "which-one" || effective.kind === "whack" ||
      effective.kind === "spin-snag") {
    return createCheckV2(effective, side, big, picks);
  }
  return {
    kind: "chain",
    side,
    tick: 0,
    spec: { ...effective, arrivals: [...effective.arrivals] },
    results: effective.arrivals.map(() => "pending"),
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
  if (check.kind === "peekaboo") return stepPeekaboo(check, tick, input.confirmHeld);
  if (check.kind === "echo") return stepEcho(check, tick, input.echoNote ?? null);
  if (check.kind === "which-one" || check.kind === "whack" || check.kind === "spin-snag") {
    return stepCheckV2(check, tick, input);
  }
  return stepChain(check, tick, input.confirmEdge);
}

/** Whether a peekaboo check is currently safe, telegraphing a turn, or watching. */
export function peekabooStatus(check: PeekabooState): PeekabooStatus {
  const { tick, spec } = check;
  if (spec.peeks.some((peek) => tick >= peek.start && tick < peek.end)) return "watching";
  if (spec.peeks.some((peek) => tick >= peek.start - spec.warningTicks && tick < peek.start))
    return "warning";
  return "safe";
}

/**
 * Red-light green-light peekaboo check: hold confirm while the critter looks
 * away to tiptoe toward `goal`, and freeze while it watches (with `graceTicks`
 * reaction buffer at the start of each peek window).
 */
export function stepPeekaboo(
  check: PeekabooState,
  tick: number,
  confirmHeld: boolean,
): { check: PeekabooState; grade: Grade | null } {
  const { spec } = check;
  const spotted = [...check.spotted];
  let progress = check.progress;
  let peeksCleared = check.peeksCleared;
  const watchingIndex = spec.peeks.findIndex((peek) => tick >= peek.start && tick < peek.end);
  if (watchingIndex >= 0) {
    const peek = spec.peeks[watchingIndex];
    if (
      peek !== undefined &&
      confirmHeld &&
      tick >= peek.start + spec.graceTicks &&
      spotted[watchingIndex] === 0
    ) {
      spotted[watchingIndex] = 1;
      progress = Math.max(0, progress - 8);
    }
  } else if (confirmHeld) {
    progress = Math.min(spec.goal, progress + 1);
  }
  spec.peeks.forEach((peek, index) => {
    if (tick === peek.end && spotted[index] === 0) peeksCleared += 1;
  });
  let result: Grade | null = null;
  if (progress >= spec.goal && spotted.every((item) => item === 0)) {
    result = "great";
  } else if (tick >= spec.ticks) {
    const spots = spotted.filter((item) => item === 1).length;
    if (spots === 0 && progress >= spec.goal) result = "great";
    else if (spots <= 1 && progress >= Math.ceil(spec.goal * 0.55)) result = "good";
    else result = "miss";
  }
  return {
    check: { ...check, tick, progress, spotted, peeksCleared, result },
    grade: result,
  };
}

/**
 * Plays a chime demo, then scores each echoed directional note against the
 * sequence until every note is entered or the input window expires.
 */
export function stepEcho(
  check: Extract<CheckState, { kind: "echo" }>,
  tick: number,
  echoNote: EchoNote | null,
): { check: CheckState; grade: Grade | null } {
  const { spec } = check;
  const stride = spec.demoTicks + spec.gapTicks;
  const demoEnd = spec.notes * stride;
  if (tick <= demoEnd) {
    const slot = Math.floor((tick - 1) / stride);
    const inSlot = (tick - 1) % stride;
    const activeNote = inSlot < spec.demoTicks ? (check.sequence[slot] ?? null) : null;
    const activeTicks = inSlot < spec.demoTicks ? inSlot + 1 : 0;
    return { check: { ...check, tick, activeNote, activeTicks }, grade: null };
  }
  let activeTicks = check.activeTicks > 0 ? check.activeTicks - 1 : 0;
  let activeNote = activeTicks > 0 ? check.activeNote : null;
  const results = [...check.results];
  let entered = check.entered;
  if (echoNote !== null && entered < check.sequence.length) {
    results[entered] = echoNote === check.sequence[entered] ? "hit" : "miss";
    entered += 1;
    activeNote = echoNote;
    activeTicks = 14;
  }
  const finished = entered >= check.sequence.length || tick >= demoEnd + spec.inputTicks;
  if (finished) {
    for (let index = 0; index < results.length; index += 1)
      if (results[index] === "pending") results[index] = "miss";
  }
  const next: Extract<CheckState, { kind: "echo" }> = {
    ...check,
    tick,
    results,
    entered,
    activeNote,
    activeTicks,
  };
  return { check: next, grade: finished ? gradeHits(results) : null };
}

/** Fresh directional edge mapped to an echo chime (up 0, right 1, down 2, left 3). */
export function echoNoteFromEdge(
  previousMove: { x: number; y: number },
  move: { x: number; y: number },
): EchoNote | null {
  if (move.y < -0.5 && previousMove.y >= -0.5) return 0;
  if (move.x > 0.5 && previousMove.x <= 0.5) return 1;
  if (move.y > 0.5 && previousMove.y <= 0.5) return 2;
  if (move.x < -0.5 && previousMove.x >= -0.5) return 3;
  return null;
}

function toEchoNote(value: number): EchoNote {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  return 0;
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

/** How many seeded draws a check takes as it starts: one per toy, puff, or chime. */
export function checkDraws(spec: CheckSpec): number {
  if (spec.kind === "which-one" || spec.kind === "whack" || spec.kind === "spin-snag") {
    return checkDrawsV2(spec);
  }
  return spec.kind === "catch"
    ? spec.arrivals.length
    : spec.kind === "lean"
      ? spec.starts.length
      : spec.kind === "trace"
        ? 1
        : spec.kind === "echo"
          ? spec.notes
          : 0;
}

/**
 * What one draw in 0..1 picks: a lean puff's force, a trace path index, an
 * echo chime note (0..3), a whack slot (0..4), or a catch/cup index (0..2).
 */
export function pickFromDraw(spec: CheckSpec, value: number): number {
  if (spec.kind === "which-one" || spec.kind === "whack" || spec.kind === "spin-snag") {
    return pickFromDrawV2(spec, value);
  }
  if (spec.kind === "trace")
    return Math.min(spec.paths.length - 1, Math.floor(value * spec.paths.length));
  if (spec.kind === "echo") return Math.min(3, Math.floor(value * 4));
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
  if (check.kind === "peekaboo")
    return {
      kind: "peekaboo",
      side: check.side,
      progress: Math.max(0, Math.min(1, check.progress / Math.max(1, check.spec.goal))),
      status: peekabooStatus(check),
      peeks: check.spec.peeks.map((peek, index) =>
        check.spotted[index] === 1
          ? "spotted"
          : check.tick >= peek.end
            ? "cleared"
            : "pending",
      ),
    };
  if (check.kind === "echo") {
    const stride = check.spec.demoTicks + check.spec.gapTicks;
    const demoEnd = check.spec.notes * stride;
    const inDemo = check.tick <= demoEnd;
    const slot = check.tick > 0 ? Math.floor((check.tick - 1) / stride) : -1;
    const inSlot = check.tick > 0 ? (check.tick - 1) % stride : stride;
    const demoIndex = inDemo && inSlot < check.spec.demoTicks ? slot : -1;
    const remaining = 1 - (check.tick - demoEnd) / Math.max(1, check.spec.inputTicks);
    return {
      kind: "echo",
      side: check.side,
      phase: inDemo ? "demo" : "input",
      sequence: [...check.sequence],
      results: [...check.results],
      litNote: check.activeNote,
      demoIndex,
      entered: check.entered,
      time: inDemo ? 0 : Math.max(0, Math.min(1, remaining)),
    };
  }
  if (check.kind === "which-one" || check.kind === "whack" || check.kind === "spin-snag") {
    return viewCheckV2(check);
  }
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
 * puff, a peekaboo before Fae starts tiptoeing, an echo until her first chime.
 */
export function checkHint(
  check: CheckState,
  hints: Partial<BattleContent["hints"]>,
): string | null {
  if (check.kind === "charge") return check.held === 0 ? (hints.charge ?? null) : null;
  if (check.kind === "chain" || check.kind === "catch")
    return check.tick < (check.spec.arrivals[0] ?? 0) ? (hints[check.kind] ?? null) : null;
  if (check.kind === "lean")
    return check.tick < (check.spec.starts[0] ?? 0) ? (hints.lean ?? null) : null;
  if (check.kind === "trace") return check.results[1] === "pending" ? (hints.trace ?? null) : null;
  if (check.kind === "peekaboo")
    return check.tick < 28 && check.progress === 0 ? (hints.peekaboo ?? null) : null;
  if (check.kind === "echo") {
    const demoEnd = check.spec.notes * (check.spec.demoTicks + check.spec.gapTicks);
    return check.tick <= demoEnd || check.entered === 0 ? (hints.echo ?? null) : null;
  }
  if (check.kind === "which-one" || check.kind === "whack" || check.kind === "spin-snag") {
    return checkHintV2(check, hints);
  }
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
