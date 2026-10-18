// Modelled players for Trace tuning tests. Each one steers the brush through
// the real check (`stepCheck`) and takes the real grade it returns.
import {
  createCheck, stepCheck, type CheckState, type Grade, type TraceSpec,
} from "../../src/core";

type Trace = Extract<CheckState, { kind: "trace" }>;
type Move = { x: number; y: number };

export type TracePlayer = {
  /** Ticks between the brush moving and the player reacting (8 is about an eighth of a second). */
  lag: number;
  /** Drags a finger toward the next checkpoint as well as holding the arrows. */
  pointer?: boolean;
  /** Presses nothing at all. */
  idle?: boolean;
};

function trace(check: CheckState): Trace {
  if (check.kind !== "trace") throw new Error("expected Trace");
  return check;
}

function arrow(check: Trace): Move {
  const target = check.path.points[check.checkpoint];
  if (target === undefined) return { x: 0, y: 0 };
  const dx = target.x - check.brush.x;
  const dy = target.y - check.brush.y;
  return Math.sqrt(dx * dx + dy * dy) <= check.spec.reachRadius
    ? { x: 0, y: 0 }
    : { x: Math.sign(dx), y: Math.sign(dy) };
}

function finger(decision: Trace, brush: Move): Move | undefined {
  const target = decision.path.points[decision.checkpoint];
  if (target === undefined) return undefined;
  const dx = target.x - brush.x;
  const dy = target.y - brush.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 10) return target;
  return { x: brush.x + dx * 10 / distance, y: brush.y + dy * 10 / distance };
}

/** Plays one Trace check to the end and returns its grade. */
export function playTrace(spec: TraceSpec, player: TracePlayer): Grade {
  let check = trace(createCheck(spec, "critter"));
  const seen: Trace[] = [];
  for (let tick = 0; tick < spec.dryTicks + 2; tick += 1) {
    const decision = seen[tick - player.lag] ?? check;
    const stepped = stepCheck(check, {
      confirmEdge: false,
      confirmHeld: false,
      lane: 1,
      lean: 0,
      move: player.idle === true ? { x: 0, y: 0 } : arrow(decision),
      pointer: player.pointer === true ? finger(decision, check.brush) : undefined,
    });
    check = trace(stepped.check);
    seen.push(check);
    if (stepped.grade !== null) return stepped.grade;
  }
  throw new Error(`Trace did not finish: ${check.results.join(",")}`);
}
