import { describe, expect, it } from "vitest";
import {
  checkDraws, checkHint, createCheck, pickFromDraw, stepCheck, viewCheck,
} from "../../src/core/checks";
import type { CheckState, TracePoint, TraceSpec } from "../../src/core";
import { isActionFrame, parseScript } from "../../src/content/script";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "../../tools/sim/recorder";
import { createState, nextRandom, step, type Battle, type State } from "../../src/core";

const spec: TraceSpec = {
  kind: "trace", dryTicks: 20, brushSpeed: 10, reachRadius: 5,
  paths: [{ id: "a", points: [
    { x: 100, y: 100 }, { x: 120, y: 100 }, { x: 140, y: 100 }, { x: 160, y: 100 },
  ] }],
};
const input = (move = { x: 0, y: 0 }, pointer?: { x: number; y: number }) => ({
  confirmEdge: false, confirmHeld: false, lane: 1, lean: 0 as const, move, pointer,
});
function traceState(state: CheckState): Extract<CheckState, { kind: "trace" }> {
  if (state.kind !== "trace") throw new Error("expected trace");
  return state;
}

describe("trace check", () => {
  it("normalizes diagonal stick movement and resolves one checkpoint per tick", () => {
    let check = createCheck(spec, "critter");
    const first = stepCheck(check, input({ x: 1, y: 1 }));
    check = traceState(first.check);
    expect(check.brush.x).toBeCloseTo(107.071, 2);
    expect(check.brush.y).toBeCloseTo(107.071, 2);
    expect(check.results[0]).toBe("hit");
    const one = traceState(stepCheck({ ...check, brush: { x: 120, y: 100 } }, input()).check);
    expect(one.results.filter((result) => result === "hit")).toHaveLength(2);
  });

  it("keeps a light tilt slow while diagonal keys use full speed", () => {
    const light = traceState(stepCheck(
      createCheck(spec, "critter"), input({ x: 0.3, y: 0 })).check);
    expect(light.brush.x).toBeCloseTo(103, 5);
    const diagonal = traceState(stepCheck(
      createCheck(spec, "critter"), input({ x: 1, y: 1 })).check);
    expect(diagonal.brush.x).toBeCloseTo(100 + 10 / Math.sqrt(2), 5);
    expect(diagonal.brush.y).toBeCloseTo(100 + 10 / Math.sqrt(2), 5);
  });

  it("resolves no more than one checkpoint per tick", () => {
    const close: TraceSpec = {
      ...spec, reachRadius: 10,
      paths: [{ id: "close", points: [
        { x: 100, y: 100 }, { x: 104, y: 100 }, { x: 108, y: 100 }, { x: 200, y: 100 },
      ] }],
    };
    let check = traceState(stepCheck(createCheck(close, "critter"), input()).check);
    expect(check.results.slice(0, 3)).toEqual(["hit", "pending", "pending"]);
    check = traceState(stepCheck(check, input()).check);
    expect(check.results.slice(0, 3)).toEqual(["hit", "hit", "pending"]);
  });

  it("grades all, half, and fewer than half as great, good, and miss", () => {
    const reach: TraceSpec = { ...spec, brushSpeed: 100, dryTicks: 10 };
    const play = (points: TracePoint[]): string | null => {
      let check = createCheck(reach, "critter");
      let grade: string | null = null;
      for (const point of points) {
        const stepped = stepCheck(check, input({ x: 0, y: 0 }, point));
        check = stepped.check;
        grade = stepped.grade;
      }
      while (grade === null) {
        const stepped = stepCheck(check, input());
        check = stepped.check;
        grade = stepped.grade;
      }
      return grade;
    };
    const points = spec.paths[0]?.points;
    if (points === undefined) throw new Error("trace points missing");
    expect(play(points)).toBe("great");
    expect(play(points.slice(0, 2))).toBe("good");
    expect(play(points.slice(0, 1))).toBe("miss");
  });

  it("shows the hint until the second point is hit", () => {
    const hints = { charge: "c", chain: "c", catch: "c", lean: "l", trace: "trace" };
    let check = createCheck({ ...spec, brushSpeed: 100 }, "critter");
    expect(checkHint(check, hints)).toBe("trace");
    check = traceState(stepCheck(check, input()).check);
    expect(checkHint(check, hints)).toBe("trace");
    check = traceState(stepCheck(check, input({ x: 0, y: 0 }, { x: 120, y: 100 })).check);
    expect(checkHint(check, hints)).toBe(null);
  });

  it("caps pointer pulls, clamps at the edge, and respects the radius edge", () => {
    let check = createCheck(spec, "critter");
    check = traceState(stepCheck(check, input({ x: 0, y: 0 }, { x: 1000, y: 1000 })).check);
    expect(check.brush.x).toBe(107.07106781186548);
    expect(check.brush.y).toBe(107.07106781186548);
    const edge = traceState(stepCheck(
      { ...check, brush: { x: 115, y: 100 }, checkpoint: 1 }, input()).check);
    expect(edge.results[1]).toBe("hit");
    const outside = traceState(stepCheck(
      { ...check, brush: { x: 114.99, y: 100 }, checkpoint: 1 }, input()).check);
    expect(outside.results[1]).toBe("pending");
    const clamped = traceState(stepCheck(
      { ...check, brush: { x: 995, y: 995 }, checkpoint: 1 }, input({ x: 1, y: 1 })).check);
    expect(clamped.brush).toEqual({ x: 1000, y: 1000 });
  });

  it("dries unresolved points and grades the hit ratio", () => {
    let check = createCheck(spec, "critter");
    for (let tick = 0; tick < spec.dryTicks; tick += 1)
      check = traceState(stepCheck(check, input()).check);
    const dried = traceState(check);
    expect(dried.results).toEqual(["hit", "miss", "miss", "miss"]);
    expect(stepCheck(dried, input()).grade).toBe("miss");
    expect(checkHint(dried, {
      charge: "c", chain: "c", catch: "c", lean: "l", trace: "t",
    })).toBe(null);
    expect(viewCheck(dried, null)).toMatchObject({ kind: "trace", dry: 1 });
  });

  it("draws one path after the burst roll", () => {
    expect(checkDraws(spec)).toBe(1);
    const first = spec.paths[0];
    if (first === undefined) throw new Error("trace path missing");
    expect(pickFromDraw({
      ...spec, paths: [...spec.paths, { id: "b", points: first.points }],
    }, 0.99)).toBe(1);
  });

  it("parses only in-range integer pointer coordinates", () => {
    const frame = {
      move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false,
      pointer: { x: 500, y: 1000 },
    };
    expect(isActionFrame(frame)).toBe(true);
    expect(parseScript([{ frame, ticks: 1 }])).toEqual([{ frame, ticks: 1 }]);
    expect(isActionFrame({ ...frame, pointer: { x: 1001, y: 0 } })).toBe(false);
    expect(isActionFrame({ ...frame, pointer: { x: 1.5, y: 0 } })).toBe(false);
  });

  it("uses the recorder's arrow player to finish a real Trace burst greatly", () => {
    const content = loadContent();
    const original = content.world.critters["fountain-frog"];
    const fixture = content.fixtures.plaza;
    if (original === undefined || fixture === undefined) throw new Error("Trace fixture missing");
    const path = (id: string): { id: string; points: TracePoint[] } => ({
      id, points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }, { x: 400, y: 100 }],
    });
    const small: TraceSpec = {
      kind: "trace", dryTicks: 40, brushSpeed: 100, reachRadius: 5, paths: [path("small")],
    };
    const big: TraceSpec = {
      ...small, paths: [path("big-a"), path("big-b")],
    };
    const world = {
      ...content.world,
      critters: {
        ...content.world.critters,
        [original.id]: {
          ...original, burst: { ...original.burst, bigChance: 1, check: small, big },
        },
      },
    };
    const base = createState(world, fixture);
    const battle: Battle = {
      critterId: original.id, den: null, entry: base.player, phase: "burst",
      message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
      rest: {}, check: null, lastGrade: null, feelings: [], answered: false,
      lanternPeek: false, turn: 1, windUp: null, rewardSticker: null, phaseTicks: 0,
    };
    const initial: State = { ...base, battle, rng: 1 };
    const recorder = createRecorder(world, initial);
    recorder.battle([]);
    let replay = initial;
    const first = nextRandom(initial)[1];
    const expectedPath = Math.min(1, Math.floor(nextRandom(first)[0] * 2));
    // The seeded burst roll is consumed before the path draw.
    let sawGreat = false;
    for (const segment of recorder.script) {
      for (let count = 0; count < segment.ticks; count += 1) {
        replay = step(world, replay, segment.frame).state;
        if (replay.battle?.phase === "burstResult" && replay.battle.lastGrade === "great") {
          const check = replay.battle.check;
          if (!sawGreat && check?.kind === "trace") {
            sawGreat = true;
            expect(check.path.id).toBe(expectedPath === 0 ? "big-a" : "big-b");
            expect(check.tick).toBeLessThan(check.spec.dryTicks);
          }
        }
      }
    }
    expect(sawGreat).toBe(true);
  });

  it("makes every hooded-kid scribble a careful great", () => {
    const content = loadContent();
    const kid = content.world.critters["hooded-kid"];
    if (kid === undefined) throw new Error("hooded kid missing");
    const specs = [kid.burst.check, kid.burst.big];
    for (const candidate of specs) {
      if (candidate?.kind !== "trace") throw new Error("kid trace missing");
      for (const path of candidate.paths) {
        let check = createCheck({ ...candidate, paths: [path] }, "critter");
        let grade: string | null = null;
        for (const [index, point] of path.points.entries()) {
          const previous = path.points[index - 1] ?? point;
          const distance = Math.sqrt(
            (point.x - previous.x) * (point.x - previous.x) +
            (point.y - previous.y) * (point.y - previous.y),
          );
          const ticks = Math.ceil(distance / candidate.brushSpeed) + 2;
          for (let tick = 0; tick < ticks && grade === null; tick += 1) {
            const stepped = stepCheck(check, input({ x: 0, y: 0 }, point));
            check = stepped.check;
            grade = stepped.grade;
          }
        }
        expect(grade, path.id).toBe("great");
      }
    }
  });
});
