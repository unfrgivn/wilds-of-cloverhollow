import type { Direction, Npc, NpcStroll, Point, Polygon, State } from "./types";

export type NpcStrollPose = {
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
  distance: number;
};

type StrollSegment = {
  from: Point;
  to: Point;
  length: number;
  moveTicks: number;
  facing: Direction;
  pauseFacing: Direction;
  startDistance: number;
};

type CompiledStroll = {
  segments: StrollSegment[];
  totalCycleTicks: number;
};

const compiledCache = new WeakMap<NpcStroll, CompiledStroll>();

function travelFacing(dx: number, dy: number, fallback: Direction): Direction {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function compileStroll(stroll: NpcStroll): CompiledStroll {
  const cached = compiledCache.get(stroll);
  if (cached !== undefined) return cached;
  const count = stroll.waypoints.length;
  const rawFacings: Direction[] = [];
  const lengths: number[] = [];
  const moveTicksList: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const from = stroll.waypoints[i];
    const to = stroll.waypoints[(i + 1) % count];
    if (from === undefined || to === undefined) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    lengths.push(length);
    moveTicksList.push(Math.max(1, Math.ceil(length / stroll.speed)));
    rawFacings.push(travelFacing(dx, dy, "down"));
  }

  const segments: StrollSegment[] = [];
  let totalCycleTicks = 0;
  let walked = 0;
  for (let i = 0; i < count; i += 1) {
    const from = stroll.waypoints[i];
    const to = stroll.waypoints[(i + 1) % count];
    const length = lengths[i];
    const moveTicks = moveTicksList[i];
    const facing = rawFacings[i];
    if (
      from === undefined ||
      to === undefined ||
      length === undefined ||
      moveTicks === undefined ||
      facing === undefined
    ) {
      continue;
    }
    const pauseFacing: Direction = i === 0 ? "down" : (rawFacings[i - 1] ?? "down");
    segments.push({
      from,
      to,
      length,
      moveTicks,
      facing,
      pauseFacing,
      startDistance: walked,
    });
    totalCycleTicks += stroll.pauseTicks + moveTicks;
    walked += length;
  }
  const compiled: CompiledStroll = { segments, totalCycleTicks };
  compiledCache.set(stroll, compiled);
  return compiled;
}

export function npcStrollCycleTicks(stroll: NpcStroll): number {
  if (stroll.waypoints.length < 2) return Math.max(1, stroll.pauseTicks);
  return compileStroll(stroll).totalCycleTicks;
}

export function npcStrollAt(stroll: NpcStroll, tick: number): NpcStrollPose {
  const first = stroll.waypoints[0];
  if (first === undefined) {
    return { x: 0, y: 0, facing: "down", moving: false, distance: 0 };
  }
  if (stroll.waypoints.length < 2 || stroll.speed <= 0) {
    return { x: first.x, y: first.y, facing: "down", moving: false, distance: 0 };
  }
  const { segments, totalCycleTicks } = compileStroll(stroll);
  if (segments.length === 0 || totalCycleTicks <= 0) {
    return { x: first.x, y: first.y, facing: "down", moving: false, distance: 0 };
  }

  const wholeTick = Math.floor(tick);
  let remaining = ((wholeTick % totalCycleTicks) + totalCycleTicks) % totalCycleTicks;
  for (const segment of segments) {
    if (remaining < stroll.pauseTicks) {
      return {
        x: segment.from.x,
        y: segment.from.y,
        facing: segment.pauseFacing,
        moving: false,
        distance: segment.startDistance,
      };
    }
    remaining -= stroll.pauseTicks;
    if (remaining < segment.moveTicks) {
      const progress = (remaining + 1) / segment.moveTicks;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * progress,
        y: segment.from.y + (segment.to.y - segment.from.y) * progress,
        facing: segment.facing,
        moving: true,
        distance: segment.startDistance + segment.length * progress,
      };
    }
    remaining -= segment.moveTicks;
  }

  return { x: first.x, y: first.y, facing: "down", moving: false, distance: 0 };
}

export function npcLivePoint(state: State, npc: Npc): NpcStrollPose {
  if (npc.stroll === undefined) {
    return {
      x: npc.point.x,
      y: npc.point.y,
      facing: npc.facing,
      moving: false,
      distance: 0,
    };
  }
  if (
    state.dialogue !== null &&
    state.dialogue.knot === npc.knot &&
    state.dialogue.partnerPoint !== undefined
  ) {
    const frozen = state.dialogue.partnerPoint;
    const dx = state.player.x - frozen.x;
    const dy = state.player.y - frozen.y;
    const facing =
      dx === 0 && dy === 0
        ? npc.facing
        : Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";
    return {
      x: frozen.x,
      y: frozen.y,
      facing,
      moving: false,
      distance: 0,
    };
  }
  return npcStrollAt(npc.stroll, state.tick);
}

export function npcLiveFootprint(npc: Npc, point: Point): Polygon {
  const dx = point.x - npc.point.x;
  const dy = point.y - npc.point.y;
  if (dx === 0 && dy === 0) return npc.footprint;
  return npc.footprint.map(([x, y]) => [x + dx, y + dy]);
}
