import type { Area, Direction, PartyMember, Point, Polygon, State, World } from "./types";
import {
  distance,
  distanceToPolygon,
  pointInPolygon,
  resolveCollision,
  resolveMove,
  validResolved,
} from "./geometry";

export const DASH_SPEED_MULTIPLIER = 1.45;

export const DEFAULT_PUSHABLE_RADIUS = 20;
export const DEFAULT_PLATE_RADIUS = 28;
const DEFAULT_RECEIVER_RADIUS = 28;
const DEFAULT_LANTERN_RANGE = 240;
const DEFAULT_BELL_RADIUS = 130;

const MIRROR_CONFIRM_RANGE = 72;
const PLATE_CONFIRM_RANGE = 76;
const BELL_CONFIRM_RANGE = 72;
const PRISM_MAX_BOUNCES = 8;
const PRISM_MIRROR_HIT_RADIUS = 20;

export type PushableKind = "rock" | "crate" | "snowball";
export type PushableDef = {
  id: string;
  kind: PushableKind;
  x: number;
  y: number;
  radius?: number;
  slides?: boolean;
  lassoable?: boolean;
};

export type PressurePlateDef = {
  id: string;
  x: number;
  y: number;
  radius?: number;
  companionHold?: boolean;
  preferredCompanion?: string;
};

export type PrismOrientation = "ne" | "se" | "sw" | "nw";

export type PrismEmitterDef = {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  requiresLantern?: boolean;
  lanternRange?: number;
};

export type PrismMirrorDef = {
  id: string;
  x: number;
  y: number;
  orientation: PrismOrientation;
};

export type PrismReceiverDef = {
  id: string;
  x: number;
  y: number;
  radius?: number;
};

export type ResonanceBellStyle = "bell" | "seashell" | "shrine";
export type ResonanceBellDef = {
  id: string;
  x: number;
  y: number;
  sequence: Direction[];
  hintLabel?: string;
  radius?: number;
  style?: ResonanceBellStyle;
};

export type GrapplePostKind = "post" | "lever" | "swing";
export type GrapplePostDef = {
  id: string;
  kind: GrapplePostKind;
  x: number;
  y: number;
  range?: number;
  requiresLasso?: boolean;
  landA?: Point;
  landB?: Point;
};

export type VineBridgeStyle = "vine" | "barrier";
export type VineBridgeDef = {
  id: string;
  style?: VineBridgeStyle;
  opensOn: string;
  polygon: Polygon;
  visualPoint?: Point;
};

export type SteppingStoneGroupDef = {
  id: string;
  gapPolygon: Polygon;
  stones: Point[];
  lanternRange?: number;
  permanentOnPuzzle?: string;
  overridesCrossing?: string;
};

export type PuzzleGoalDef = {
  id: string;
  requirePlates?: string[];
  requireReceivers?: string[];
  requireBells?: string[];
  requireLevers?: string[];
  requireSteppingStones?: string[];
  requirePuzzles?: string[];
  inkVariable?: string;
  rewardCoins?: number;
};

export type AreaPuzzles = {
  pushables?: PushableDef[];
  plates?: PressurePlateDef[];
  emitters?: PrismEmitterDef[];
  mirrors?: PrismMirrorDef[];
  receivers?: PrismReceiverDef[];
  bells?: ResonanceBellDef[];
  grapples?: GrapplePostDef[];
  bridges?: VineBridgeDef[];
  steppingStones?: SteppingStoneGroupDef[];
  goals?: PuzzleGoalDef[];
};

export type PushableLiveState = {
  x: number;
  y: number;
  sliding?: { dx: number; dy: number };
};

export type LassoArcState = {
  from: Point;
  to: Point;
  tick: number;
  duration: number;
  kind: "swing" | "pull" | "rotate" | "yank" | "miss";
  targetId?: string;
  landFrom?: Point;
  landTo?: Point;
};

export type FluteWheelState = {
  bellId: string;
  entered: Direction[];
  status: "listening" | "matched" | "wrong";
  statusTicks: number;
  lastNote?: Direction;
  noteSeq: number;
};

export type AreaPuzzleState = {
  pushables?: Record<string, PushableLiveState>;
  mirrors?: Record<string, PrismOrientation>;
  pulledLevers?: string[];
  heldPlates?: Record<string, string>;
  solvedBells?: string[];
  steppedGroups?: string[];
  lasso?: LassoArcState;
  fluteWheel?: FluteWheelState;
  recentChime?: { note: Direction; tick: number };
  lastSolved?: { id: string; tick: number };
};

export type PrismBeamSegment = { from: Point; to: Point };

export type PuzzleActionTarget = {
  kind: "rotate-mirror" | "hold-plate" | "release-plate" | "play-bell";
  id: string;
  point: Point;
  prompt: string;
};

export function directionVector(dir: Direction): Point {
  if (dir === "up") return { x: 0, y: -1 };
  if (dir === "down") return { x: 0, y: 1 };
  if (dir === "left") return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

export function facingBetween(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

export function rotateOrientation(orientation: PrismOrientation): PrismOrientation {
  if (orientation === "ne") return "se";
  if (orientation === "se") return "sw";
  if (orientation === "sw") return "nw";
  return "ne";
}

export function reflectDirection(
  incoming: Direction,
  orientation: PrismOrientation,
): Direction | null {
  if (orientation === "ne") {
    if (incoming === "down") return "right";
    if (incoming === "left") return "up";
    return null;
  }
  if (orientation === "se") {
    if (incoming === "up") return "right";
    if (incoming === "left") return "down";
    return null;
  }
  if (orientation === "sw") {
    if (incoming === "up") return "left";
    if (incoming === "right") return "down";
    return null;
  }
  if (incoming === "down") return "left";
  if (incoming === "right") return "up";
  return null;
}

export function pushablePosition(area: Area, state: State, def: PushableDef): Point {
  const live = state.area === area.id ? state.puzzleArea?.pushables?.[def.id] : undefined;
  return live === undefined ? { x: def.x, y: def.y } : { x: live.x, y: live.y };
}

export function mirrorOrientation(
  area: Area,
  state: State,
  def: PrismMirrorDef,
): PrismOrientation {
  const live = state.area === area.id ? state.puzzleArea?.mirrors?.[def.id] : undefined;
  return live ?? def.orientation;
}

export function isPuzzleSolved(world: World, state: State, puzzleId: string): boolean {
  if (state.puzzles?.[puzzleId] === true) return true;
  const current = world.areas[state.area];
  const goal =
    current?.puzzles?.goals?.find((item) => item.id === puzzleId) ??
    Object.values(world.areas)
      .flatMap((area) => area.puzzles?.goals ?? [])
      .find((item) => item.id === puzzleId);
  if (
    goal?.inkVariable !== undefined &&
    world.storyVariable(state.ink, goal.inkVariable) === true
  ) {
    return true;
  }
  return false;
}

export function isSteppingStoneGroupLit(
  world: World,
  state: State,
  group: SteppingStoneGroupDef,
): boolean {
  if (
    group.permanentOnPuzzle !== undefined &&
    isPuzzleSolved(world, state, group.permanentOnPuzzle)
  ) {
    return true;
  }
  if (!state.lantern) return false;
  const range = group.lanternRange ?? DEFAULT_LANTERN_RANGE;
  if (group.stones.some((stone) => distance(state.player, stone) <= range)) return true;
  return (
    pointInPolygon(state.player, group.gapPolygon) ||
    distanceToPolygon(state.player, group.gapPolygon) <= range
  );
}

export function isPressurePlateActive(
  area: Area,
  state: State,
  plate: PressurePlateDef,
): boolean {
  const radius = plate.radius ?? DEFAULT_PLATE_RADIUS;
  if (state.area === area.id && distance(state.player, plate) <= radius) return true;
  if (state.area === area.id) {
    const holderId = state.puzzleArea?.heldPlates?.[plate.id];
    if (holderId !== undefined) {
      const holder = state.party.find((member) => member.id === holderId);
      if (holder !== undefined && distance(holder, plate) <= radius + 8) return true;
    }
  }
  for (const def of area.puzzles?.pushables ?? []) {
    const pos = pushablePosition(area, state, def);
    const pr = def.radius ?? DEFAULT_PUSHABLE_RADIUS;
    if (distance(pos, plate) <= radius + pr * 0.35) return true;
  }
  return false;
}

export function pushableFootprint(center: Point, radius: number): Polygon {
  const cut = radius * 0.414;
  return [
    [center.x - cut, center.y - radius],
    [center.x + cut, center.y - radius],
    [center.x + radius, center.y - cut],
    [center.x + radius, center.y + cut],
    [center.x + cut, center.y + radius],
    [center.x - cut, center.y + radius],
    [center.x - radius, center.y + cut],
    [center.x - radius, center.y - cut],
  ];
}

export function overriddenCrossingIds(world: World, state: State, area: Area): Set<string> {
  const result = new Set<string>();
  const groups = area.puzzles?.steppingStones;
  if (groups === undefined) return result;
  for (const group of groups) {
    if (group.overridesCrossing !== undefined && isSteppingStoneGroupLit(world, state, group)) {
      result.add(group.overridesCrossing);
    }
  }
  return result;
}

export function puzzleSolidPolygons(
  world: World,
  state: State,
  area: Area,
  excludePushableId?: string,
): Polygon[] {
  const puzzles = area.puzzles;
  if (puzzles === undefined) return [];
  const polygons: Polygon[] = [];
  for (const def of puzzles.pushables ?? []) {
    if (def.id === excludePushableId) continue;
    const pos = pushablePosition(area, state, def);
    polygons.push(pushableFootprint(pos, def.radius ?? DEFAULT_PUSHABLE_RADIUS));
  }
  for (const bridge of puzzles.bridges ?? []) {
    if (!isPuzzleSolved(world, state, bridge.opensOn)) {
      polygons.push(bridge.polygon);
    }
  }
  for (const group of puzzles.steppingStones ?? []) {
    if (!isSteppingStoneGroupLit(world, state, group)) {
      const coveredByClosedCrossing =
        group.overridesCrossing !== undefined &&
        (area.crossings ?? []).some(
          (crossing) =>
            crossing.id === group.overridesCrossing &&
            world.storyVariable(state.ink, crossing.opens) !== true,
        );
      if (!coveredByClosedCrossing) polygons.push(group.gapPolygon);
    }
  }
  return polygons;
}

function rayPolygonHits(origin: Point, vec: Point, polygon: Polygon): number[] {
  const hits: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (start === undefined || end === undefined) continue;
    const ex = end[0] - start[0];
    const ey = end[1] - start[1];
    const denom = vec.x * ey - vec.y * ex;
    if (Math.abs(denom) <= 0.0000001) continue;
    const dx = start[0] - origin.x;
    const dy = start[1] - origin.y;
    const t = (dx * ey - dy * ex) / denom;
    const s = (dx * vec.y - dy * vec.x) / denom;
    if (t > 0.001 && s >= -0.0001 && s <= 1.0001) hits.push(t);
  }
  return hits;
}

function rayWallDistance(area: Area, state: State, origin: Point, vec: Point): number {
  const candidates = rayPolygonHits(origin, vec, area.walkable);
  for (const blocker of area.blockers) {
    candidates.push(...rayPolygonHits(origin, vec, blocker));
  }
  candidates.sort((a, b) => a - b);
  let wallT = Math.max(area.width, area.height);
  for (const hitT of candidates) {
    const probe = {
      x: origin.x + vec.x * (hitT + 0.75),
      y: origin.y + vec.y * (hitT + 0.75),
    };
    const blocked =
      !pointInPolygon(probe, area.walkable) ||
      area.blockers.some((blocker) => pointInPolygon(probe, blocker));
    if (blocked) {
      wallT = hitT;
      break;
    }
  }
  for (const def of area.puzzles?.pushables ?? []) {
    const pos = pushablePosition(area, state, def);
    const radius = def.radius ?? DEFAULT_PUSHABLE_RADIUS;
    const dx = pos.x - origin.x;
    const dy = pos.y - origin.y;
    const along = dx * vec.x + dy * vec.y;
    const perp = Math.abs(dx * -vec.y + dy * vec.x);
    if (along > 0.001 && perp <= radius) {
      const chord = Math.sqrt(Math.max(0, radius * radius - perp * perp));
      const hitT = Math.max(0.001, along - chord);
      if (hitT < wallT) wallT = hitT;
    }
  }
  return wallT;
}

export function tracePrismBeams(
  area: Area,
  state: State,
): { segments: PrismBeamSegment[]; energizedReceivers: string[]; activeEmitters: string[] } {
  const puzzles = area.puzzles;
  const emitters = puzzles?.emitters ?? [];
  if (puzzles === undefined || emitters.length === 0) {
    return { segments: [], energizedReceivers: [], activeEmitters: [] };
  }
  const mirrors = puzzles.mirrors ?? [];
  const receivers = puzzles.receivers ?? [];
  const segments: PrismBeamSegment[] = [];
  const energizedSet = new Set<string>();
  const activeEmitters: string[] = [];

  for (const emitter of emitters) {
    const lanternNeeded = emitter.requiresLantern === true;
    const range = emitter.lanternRange ?? DEFAULT_LANTERN_RANGE;
    const active =
      !lanternNeeded ||
      (state.lantern && state.area === area.id && distance(state.player, emitter) <= range);
    if (!active) continue;
    activeEmitters.push(emitter.id);

    let origin: Point = { x: emitter.x, y: emitter.y };
    let dir: Direction = emitter.direction;
    let lastMirrorId: string | undefined;

    for (let bounce = 0; bounce <= PRISM_MAX_BOUNCES; bounce += 1) {
      const vec = directionVector(dir);
      const wallT = rayWallDistance(area, state, origin, vec);

      let nearestMirror: { def: PrismMirrorDef; along: number } | undefined;
      for (const mirror of mirrors) {
        if (mirror.id === lastMirrorId) continue;
        const dx = mirror.x - origin.x;
        const dy = mirror.y - origin.y;
        const along = dx * vec.x + dy * vec.y;
        const perp = Math.abs(dx * -vec.y + dy * vec.x);
        if (along > 4 && along <= wallT && perp <= PRISM_MIRROR_HIT_RADIUS) {
          if (nearestMirror === undefined || along < nearestMirror.along) {
            nearestMirror = { def: mirror, along };
          }
        }
      }

      let nearestReceiver: { def: PrismReceiverDef; along: number } | undefined;
      for (const receiver of receivers) {
        const radius = receiver.radius ?? DEFAULT_RECEIVER_RADIUS;
        const dx = receiver.x - origin.x;
        const dy = receiver.y - origin.y;
        const along = dx * vec.x + dy * vec.y;
        const perp = Math.abs(dx * -vec.y + dy * vec.x);
        if (along > 4 && along <= wallT && perp <= radius) {
          if (nearestReceiver === undefined || along < nearestReceiver.along) {
            nearestReceiver = { def: receiver, along };
          }
        }
      }

      if (
        nearestReceiver !== undefined &&
        (nearestMirror === undefined || nearestReceiver.along <= nearestMirror.along)
      ) {
        segments.push({
          from: origin,
          to: {
            x: origin.x + vec.x * nearestReceiver.along,
            y: origin.y + vec.y * nearestReceiver.along,
          },
        });
        energizedSet.add(nearestReceiver.def.id);
        break;
      }

      if (nearestMirror !== undefined) {
        const hitPoint = { x: nearestMirror.def.x, y: nearestMirror.def.y };
        segments.push({ from: origin, to: hitPoint });
        const nextDir = reflectDirection(dir, mirrorOrientation(area, state, nearestMirror.def));
        if (nextDir === null) break;
        origin = hitPoint;
        dir = nextDir;
        lastMirrorId = nearestMirror.def.id;
        continue;
      }

      segments.push({
        from: origin,
        to: { x: origin.x + vec.x * wallT, y: origin.y + vec.y * wallT },
      });
      break;
    }
  }

  return { segments, energizedReceivers: [...energizedSet], activeEmitters };
}

export function availableHoldCompanion(
  state: State,
  plate: PressurePlateDef,
): PartyMember | undefined {
  const heldIds = new Set(Object.values(state.puzzleArea?.heldPlates ?? {}));
  if (plate.preferredCompanion !== undefined && !heldIds.has(plate.preferredCompanion)) {
    const preferred = state.party.find((member) => member.id === plate.preferredCompanion);
    if (preferred !== undefined) return preferred;
  }
  return state.party.find((member) => !heldIds.has(member.id));
}

export function targetPuzzleAction(
  world: World,
  state: State,
): PuzzleActionTarget | undefined {
  if (
    state.transition !== null ||
    state.dialogue !== null ||
    state.battle !== null ||
    state.arcade !== null ||
    state.journalOpen ||
    state.finale !== null ||
    state.puzzleArea?.fluteWheel !== undefined ||
    state.puzzleArea?.lasso?.kind === "swing"
  ) {
    return undefined;
  }
  const area = world.areas[state.area];
  const puzzles = area?.puzzles;
  if (area === undefined || puzzles === undefined) return undefined;

  const facing = directionVector(state.facing);
  const candidates: { target: PuzzleActionTarget; dist: number }[] = [];

  for (const mirror of puzzles.mirrors ?? []) {
    const dx = mirror.x - state.player.x;
    const dy = mirror.y - state.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MIRROR_CONFIRM_RANGE) continue;
    const dot = dist === 0 ? 1 : (dx * facing.x + dy * facing.y) / dist;
    if (dist <= 36 || dot >= 0.2) {
      candidates.push({
        dist,
        target: {
          kind: "rotate-mirror",
          id: mirror.id,
          point: { x: mirror.x, y: mirror.y },
          prompt: "Rotate",
        },
      });
    }
  }

  if (state.party.length > 0) {
    for (const plate of puzzles.plates ?? []) {
      if (plate.companionHold !== true) continue;
      const dist = distance(state.player, plate);
      if (dist > PLATE_CONFIRM_RANGE) continue;
      const holderId = state.puzzleArea?.heldPlates?.[plate.id];
      const holderPresent =
        holderId !== undefined && state.party.some((member) => member.id === holderId);
      if (holderPresent) {
        candidates.push({
          dist,
          target: {
            kind: "release-plate",
            id: plate.id,
            point: { x: plate.x, y: plate.y },
            prompt: "Call Back",
          },
        });
      } else if (availableHoldCompanion(state, plate) !== undefined) {
        candidates.push({
          dist,
          target: {
            kind: "hold-plate",
            id: plate.id,
            point: { x: plate.x, y: plate.y },
            prompt: "Hold",
          },
        });
      }
    }
  }

  if (world.storyVariable(state.ink, "has_flute") === true) {
    for (const bell of puzzles.bells ?? []) {
      const dist = distance(state.player, bell);
      if (dist > BELL_CONFIRM_RANGE) continue;
      candidates.push({
        dist,
        target: {
          kind: "play-bell",
          id: bell.id,
          point: { x: bell.x, y: bell.y },
          prompt: "Play",
        },
      });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0]?.target;
}

export function nearbyResonanceBell(area: Area, point: Point): ResonanceBellDef | undefined {
  const bells = area.puzzles?.bells;
  if (bells === undefined || bells.length === 0) return undefined;
  let best: { bell: ResonanceBellDef; dist: number } | undefined;
  for (const bell of bells) {
    const dist = distance(point, bell);
    if (dist <= (bell.radius ?? DEFAULT_BELL_RADIUS)) {
      if (best === undefined || dist < best.dist) best = { bell, dist };
    }
  }
  return best?.bell;
}

export function clearPuzzleArea(state: State): State {
  if (state.puzzleArea === undefined) return state;
  const { puzzleArea: _cleared, ...rest } = state;
  return rest;
}

export function areaWithoutOverriddenCrossings(world: World, state: State, area: Area): Area {
  const overridden = overriddenCrossingIds(world, state, area);
  if (overridden.size === 0) return area;
  return {
    ...area,
    crossings: (area.crossings ?? []).filter((crossing) => !overridden.has(crossing.id)),
  };
}

export function resolveOverworldMove(
  previous: Point,
  move: Point,
  dashing: boolean,
  speed: number,
  solid: Area,
  radius: number,
): Point {
  const length = Math.sqrt(move.x * move.x + move.y * move.y);
  const scale = length > 1 ? 1 / length : 1;
  if (dashing && length > 0) {
    const halfStep = (speed * DASH_SPEED_MULTIPLIER) / 2;
    const dx = move.x * scale * halfStep;
    const dy = move.y * scale * halfStep;
    const mid = resolveMove(previous, { x: previous.x + dx, y: previous.y + dy }, solid, radius);
    return resolveMove(mid, { x: mid.x + dx, y: mid.y + dy }, solid, radius);
  }
  return resolveMove(
    previous,
    { x: previous.x + move.x * scale * speed, y: previous.y + move.y * scale * speed },
    solid,
    radius,
  );
}

export function nudgeOutOfUnlitGaps(
  world: World,
  area: Area,
  solid: Area,
  state: State,
): State {
  const groups = area.puzzles?.steppingStones;
  if (groups === undefined || groups.length === 0) return state;
  const radius = world.tunables.playerRadius;
  const followRadius = world.tunables.follow.radius;

  const overlapsUnlit = (point: Point, r: number): boolean =>
    groups.some(
      (group) =>
        !isSteppingStoneGroupLit(world, state, group) &&
        (pointInPolygon(point, group.gapPolygon) ||
          distanceToPolygon(point, group.gapPolygon) < r),
    );

  let player = state.player;
  let movedAny = false;
  if (overlapsUnlit(player, radius)) {
    const nudged = resolveCollision(player, solid, radius);
    if (validResolved(nudged, solid, radius)) {
      player = nudged;
      movedAny = true;
    }
  }
  const party = state.party.map((member) => {
    if (!overlapsUnlit(member, followRadius)) return member;
    const nudged = resolveCollision(member, solid, followRadius);
    if (!validResolved(nudged, solid, followRadius)) return member;
    movedAny = true;
    return { ...member, x: nudged.x, y: nudged.y, trail: [nudged, player] };
  });
  return movedAny ? { ...state, player, party } : state;
}
