import { describe, expect, it } from "vitest";
import { createCheck, stepCheck } from "../../src/core/checks";
import { loadContent } from "../../src/content/load";
import type { CheckState, TracePoint, TraceSpec } from "../../src/core";

type Trace = Extract<CheckState, { kind: "trace" }>;
type Move = { x: number; y: number };

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

function play(spec: TraceSpec, lag: number, pointer = false, idle = false): string {
  let check = trace(createCheck(spec, "critter"));
  const history: Trace[] = [];
  for (let tick = 0; tick < spec.dryTicks + 2; tick += 1) {
    const decision = history[tick - lag] ?? check;
    const move = idle ? { x: 0, y: 0 } : arrow(decision);
    const target = pointer ? decision.path.points[decision.checkpoint] : undefined;
    const pointerTarget = target === undefined ? undefined : (() => {
      const dx = target.x - check.brush.x;
      const dy = target.y - check.brush.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= 10 ? target : {
        x: check.brush.x + dx * 10 / distance,
        y: check.brush.y + dy * 10 / distance,
      };
    })();
    const stepped = trace(stepCheck(check, {
      confirmEdge: false, confirmHeld: false, lane: 1, lean: 0, move, pointer: pointerTarget,
    }).check);
    check = stepped;
    history.push(check);
    if (stepped.results.every((result) => result !== "pending")) {
      const hits = stepped.results.filter((result) => result === "hit").length;
      return hits === stepped.results.length ? "great" :
        hits * 2 >= stepped.results.length ? "good" : "miss";
    }
  }
  throw new Error("Trace did not finish");
}

function paths(spec: TraceSpec): Array<{ id: string; points: TracePoint[] }> {
  return spec.paths.map((path) => ({ id: path.id, points: path.points }));
}

describe("hooded kid Trace tuning", () => {
  it("keeps every kid path playable for careful, late, and pointer players", () => {
    const kid = loadContent().world.critters["hooded-kid"];
    if (kid === undefined || kid.burst.check?.kind !== "trace" || kid.burst.big?.kind !== "trace")
      throw new Error("hooded kid Trace content missing");
    const specs: ReadonlyArray<readonly [string, TraceSpec]> = [
      ["normal", kid.burst.check], ["big", kid.burst.big],
    ];
    for (const [name, spec] of specs) {
      for (const path of paths(spec)) {
        const one = { ...spec, paths: [path] };
        expect(play(one, 0), `${name} ${path.id} careful`).toBe("great");
        expect(play(one, 8), `${name} ${path.id} 8 ticks late`).not.toBe("miss");
        if (name === "normal") expect(play(one, 15), `${path.id} 15 ticks late`).not.toBe("miss");
        expect(play(one, 0, true), `${name} ${path.id} pointer`).toBe("great");
        expect(play(one, 0, false, true), `${name} ${path.id} idle`).toBe("miss");
      }
    }
  });
});
