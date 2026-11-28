import type {
  Area,
  Critter,
  Direction,
  Point,
  Polygon,
  PresentCritter,
  PropState,
  SetPiece,
  State,
  Wild,
  World,
} from "./types";
import { effectiveRoamTunables } from "./blessings";
import { availableFishToTrade, effectiveAreaNpcs } from "./decor";
import { totalTreatCount } from "./battle-view";
import { nextNotice, noticed } from "./encounter";
import {
  distance,
  distanceToPolygon,
  pointInPolygon,
  resolveCollision,
  resolveMove,
} from "./geometry";
import type { InkFacts } from "./ink";
import { levelForXp } from "./levels";
import { bossesCalmedCount, npcVisible } from "./party";
import { propCovers, propState, sceneryArea } from "./props";
import { nextRandom } from "./random";

export { nextNotice, noticed };

export function calmedCritters(world: World, state: State): Record<string, boolean> {
  const calmed: Record<string, boolean> = {};
  for (const kind of Object.values(world.critters))
    if (state.stickers.includes(kind.sticker.id) || (state.calms[kind.species] ?? 0) > 0)
      calmed[kind.species] = true;
  for (const area of Object.values(world.areas))
    for (const piece of area.critters) {
      const pieceCalm = state.critters[piece.id] === "calm";
      calmed[piece.id] = calmed[piece.id] === true || pieceCalm;
      if (pieceCalm) {
        const kind = world.critters[piece.id];
        if (kind !== undefined) calmed[kind.species] = true;
      }
    }
  return calmed;
}

// What the story's externals answer from (spec 7, 8): coins() from Fae's
// purse, and calmed(name) for a species once she owns its sticker (she has
// calmed one of them, anywhere) and for a set piece by its own mood.
export function inkFacts(world: World, state: State): InkFacts {
  const areaCalm = presentCritters(world, state).every((critter) => critter.mood === "calm");
  return {
    calmed: calmedCritters(world, state),
    coins: state.coins,
    snacks: state.snacks,
    prizes: state.prizes,
    tickets: state.tickets,
    plushesLeft: world.arcade.claw.heap.filter((plush) => !state.prizes.includes(plush.prize))
      .length,
    party: state.party.map((member) => member.id),
    lantern: state.lantern,
    areaCalm,
    level: levelForXp(world.levels, state.xp),
    stickers: state.stickers.length,
    treats: totalTreatCount(state.treats),
    bossesCalmed: bossesCalmedCount(world, state),
    fishCount: availableFishToTrade(state),
  };
}

const WILD_GRID = 25;
const WILD_BOX = { width: 50, height: 70 };
const WILD_ATTEMPTS = 32;
const WILD_FACINGS: readonly Direction[] = ["up", "down", "left", "right"];

type GridBounds = {
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
  cols: number;
  rows: number;
};

type SolidBox = {
  poly: Polygon;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type ReachabilityGrid = {
  bounds: GridBounds;
  passable: Int8Array;
  area: Area;
  solids: readonly SolidBox[];
  radius: number;
  components: Uint8Array[];
};

type OccludingProp = { state: PropState; left: number; right: number };

function solidBox(poly: Polygon): SolidBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [vx, vy] of poly) {
    if (vx < minX) minX = vx;
    if (vx > maxX) maxX = vx;
    if (vy < minY) minY = vy;
    if (vy > maxY) maxY = vy;
  }
  return { poly, minX, maxX, minY, maxY };
}

function pointClearOfSolids(
  point: Point,
  walkable: Polygon,
  solids: readonly SolidBox[],
  walkableMargin: number,
  solidMargin: number,
): boolean {
  if (!pointInPolygon(point, walkable) || distanceToPolygon(point, walkable) < walkableMargin)
    return false;
  for (const solid of solids) {
    if (
      point.x < solid.minX - solidMargin ||
      point.x > solid.maxX + solidMargin ||
      point.y < solid.minY - solidMargin ||
      point.y > solid.maxY + solidMargin
    )
      continue;
    if (pointInPolygon(point, solid.poly) || distanceToPolygon(point, solid.poly) < solidMargin)
      return false;
  }
  return true;
}

function cellPassable(grid: ReachabilityGrid, gx: number, gy: number): boolean {
  const { minGx, maxGx, minGy, maxGy, cols } = grid.bounds;
  if (gx < minGx || gx > maxGx || gy < minGy || gy > maxGy) return false;
  const idx = (gy - minGy) * cols + (gx - minGx);
  const cached = grid.passable[idx];
  if (cached !== 0) return cached === 1;
  const ok = pointClearOfSolids(
    { x: gx * WILD_GRID, y: gy * WILD_GRID },
    grid.area.walkable,
    grid.solids,
    grid.radius,
    grid.radius,
  );
  grid.passable[idx] = ok ? 1 : -1;
  return ok;
}

function segmentClear(
  a: Point,
  b: Point,
  walkable: Polygon,
  solids: readonly SolidBox[],
  margin: number,
): boolean {
  for (const ratio of [0.25, 0.5, 0.75]) {
    const sample = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    if (!pointClearOfSolids(sample, walkable, solids, margin, margin)) return false;
  }
  return true;
}

function segmentInsideClear(
  a: Point,
  b: Point,
  walkable: Polygon,
  solids: readonly SolidBox[],
): boolean {
  for (const ratio of [0.25, 0.5, 0.75]) {
    const sample = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    if (!pointInPolygon(sample, walkable)) return false;
    for (const solid of solids) {
      if (
        sample.x < solid.minX ||
        sample.x > solid.maxX ||
        sample.y < solid.minY ||
        sample.y > solid.maxY
      )
        continue;
      if (pointInPolygon(sample, solid.poly)) return false;
    }
  }
  return true;
}

function reachableFrom(grid: ReachabilityGrid, start: Point): Uint8Array | null {
  const { minGx, minGy, cols, rows } = grid.bounds;
  const startGx = Math.round(start.x / WILD_GRID);
  const startGy = Math.round(start.y / WILD_GRID);
  let seedGx: number | undefined;
  let seedGy: number | undefined;
  if (cellPassable(grid, startGx, startGy)) {
    const cellPt = { x: startGx * WILD_GRID, y: startGy * WILD_GRID };
    if (segmentInsideClear(start, cellPt, grid.area.walkable, grid.solids)) {
      seedGx = startGx;
      seedGy = startGy;
    }
  }
  if (seedGx === undefined) {
    let bestDist = Infinity;
    for (let ring = 1; ring <= 2 && seedGx === undefined; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const gx = startGx + dx;
          const gy = startGy + dy;
          if (!cellPassable(grid, gx, gy)) continue;
          const cellPt = { x: gx * WILD_GRID, y: gy * WILD_GRID };
          if (!segmentInsideClear(start, cellPt, grid.area.walkable, grid.solids)) continue;
          const gap = distance(start, cellPt);
          if (gap < bestDist) {
            bestDist = gap;
            seedGx = gx;
            seedGy = gy;
          }
        }
      }
    }
  }
  if (seedGx === undefined || seedGy === undefined) return null;
  const startIdx = (seedGy - minGy) * cols + (seedGx - minGx);
  for (const cached of grid.components) {
    if (cached[startIdx] === 1) return cached;
  }
  const visited = new Uint8Array(cols * rows);
  visited[startIdx] = 1;
  const queue: number[] = [startIdx];
  const dirs: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head] ?? 0;
    head += 1;
    const gx = minGx + (idx % cols);
    const gy = minGy + Math.floor(idx / cols);
    const curPt = { x: gx * WILD_GRID, y: gy * WILD_GRID };
    for (const [dx, dy] of dirs) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (!cellPassable(grid, nx, ny)) continue;
      const nIdx = (ny - minGy) * cols + (nx - minGx);
      if (visited[nIdx] === 1) continue;
      const mid = { x: curPt.x + dx * (WILD_GRID / 2), y: curPt.y + dy * (WILD_GRID / 2) };
      if (!pointClearOfSolids(mid, grid.area.walkable, grid.solids, grid.radius, grid.radius))
        continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  grid.components.push(visited);
  return visited;
}

function isReachablePoint(grid: ReachabilityGrid, visited: Uint8Array, point: Point): boolean {
  const { minGx, maxGx, minGy, maxGy, cols } = grid.bounds;
  const gx = Math.round(point.x / WILD_GRID);
  const gy = Math.round(point.y / WILD_GRID);
  if (gx >= minGx && gx <= maxGx && gy >= minGy && gy <= maxGy) {
    if (visited[(gy - minGy) * cols + (gx - minGx)] === 1) {
      const cellPt = { x: gx * WILD_GRID, y: gy * WILD_GRID };
      if (segmentClear(point, cellPt, grid.area.walkable, grid.solids, grid.radius)) return true;
    }
  }
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < minGx || nx > maxGx || ny < minGy || ny > maxGy) continue;
      if (visited[(ny - minGy) * cols + (nx - minGx)] !== 1) continue;
      const cellPt = { x: nx * WILD_GRID, y: ny * WILD_GRID };
      if (segmentClear(point, cellPt, grid.area.walkable, grid.solids, grid.radius)) return true;
    }
  }
  return false;
}

function sceneryHidden(point: Point, occluding: readonly OccludingProp[]): boolean {
  const halfWidth = WILD_BOX.width / 2;
  const left = point.x - halfWidth;
  const right = point.x + halfWidth;
  let covered = 0;
  for (const prop of occluding) {
    if (prop.right < left || prop.left > right) continue;
    covered += propCovers(prop.state, point, WILD_BOX);
    if (covered > 0.5) return true;
  }
  return false;
}

/*
 * The recurring critters out in an area this visit (spec 6), rolled on every
 * arrival. Each den, in order, draws twice from the state's PRNG (is one out,
 * and which kind), so how many draws an arrival takes depends only on the
 * content, never on how the rolls came out. Until `after` is calm the area is
 * quiet and draws nothing; a den's own `after` keeps that den quiet alone.
 * Each spawning critter then rolls a walkable visit location, initial facing,
 * and initial pause from a deterministic local PRNG sub-stream derived from
 * the post-pick RNG state and den index, falling back to `den.point`.
 */
export function rollWild(world: World, state: State, area: Area): Pick<State, "wild" | "rng"> {
  const recurring = area.recurring;
  if (recurring === undefined) return { wild: [], rng: state.rng };
  const calmed = calmedCritters(world, state);
  if (recurring.after !== undefined && calmed[recurring.after] !== true)
    return { wild: [], rng: state.rng };
  const playerRadius = world.tunables.playerRadius;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [vx, vy] of area.walkable) {
    if (vx < minX) minX = vx;
    if (vx > maxX) maxX = vx;
    if (vy < minY) minY = vy;
    if (vy > maxY) maxY = vy;
  }
  const boxLeft = minX + playerRadius;
  const boxTop = minY + playerRadius;
  const boxWidth = Math.max(0, maxX - playerRadius - boxLeft);
  const boxHeight = Math.max(0, maxY - playerRadius - boxTop);
  const scenery = sceneryArea(world, state.ink, area);
  const visibleNpcs = effectiveAreaNpcs(world, state, area).filter(
    (npc) => npcVisible(world, state, npc),
  );
  const solids: SolidBox[] = [
    ...scenery.blockers.map(solidBox),
    ...visibleNpcs.map((npc) => solidBox(npc.footprint)),
  ];
  const activePieces = area.critters.filter((piece) => setPieceOut(world, state, piece));
  const occludingProps: OccludingProp[] = [];
  for (const prop of area.props) {
    if (prop.canopy) continue;
    const ps = propState(world, state.ink, prop);
    if (ps.flat || ps.hidden || ps.silhouette.columns.length === 0) continue;
    const left = ps.silhouette.left;
    const right = left + ps.silhouette.columns.length * ps.silhouette.step;
    occludingProps.push({ state: ps, left, right });
  }
  let reachabilityGrid: ReachabilityGrid | null = null;
  const ensureGrid = (): ReachabilityGrid | null => {
    if (reachabilityGrid !== null) return reachabilityGrid;
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    const minGx = Math.floor(minX / WILD_GRID);
    const maxGx = Math.ceil(maxX / WILD_GRID);
    const minGy = Math.floor(minY / WILD_GRID);
    const maxGy = Math.ceil(maxY / WILD_GRID);
    const cols = maxGx - minGx + 1;
    const rows = maxGy - minGy + 1;
    reachabilityGrid = {
      bounds: { minGx, maxGx, minGy, maxGy, cols, rows },
      passable: new Int8Array(cols * rows),
      area,
      solids,
      radius: playerRadius,
      components: [],
    };
    return reachabilityGrid;
  };
  let random = state;
  const wild: Wild[] = [];
  recurring.dens.forEach((den, index) => {
    if (den.after !== undefined && calmed[den.after] !== true) return;
    const [out, drawn] = nextRandom(random);
    const [pick, picked] = nextRandom(drawn);
    random = picked;
    const kind = den.kinds[Math.floor(pick * den.kinds.length)];
    const touch = Math.max(...den.kinds.map((id) => world.critters[id]?.touchRadius ?? 70));
    const clear = world.tunables.roam.sight + touch;
    if (out >= den.chance || kind === undefined || distance(state.player, den.point) <= clear)
      return;
    let mixed = (picked.rng ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0;
    mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35) >>> 0;
    let localRng = (mixed ^ (mixed >>> 16)) >>> 0;
    const drawLocal = (): number => {
      localRng = (Math.imul(localRng, 1664525) + 1013904223) >>> 0;
      return localRng / 4294967296;
    };
    const grid = ensureGrid();
    const reachable = grid === null ? null : reachableFrom(grid, den.point);
    const doorClear = touch + 60;
    let chosen: Point | undefined;
    if (boxWidth > 0 && boxHeight > 0 && grid !== null && reachable !== null) {
      for (let attempt = 0; attempt < WILD_ATTEMPTS; attempt += 1) {
        const candidate: Point = {
          x: boxLeft + drawLocal() * boxWidth,
          y: boxTop + drawLocal() * boxHeight,
        };
        if (
          !pointClearOfSolids(
            candidate,
            area.walkable,
            solids,
            playerRadius + 8,
            playerRadius,
          )
        )
          continue;
        if (distance(state.player, candidate) <= clear) continue;
        if (
          area.triggers.some(
            (trigger) =>
              pointInPolygon(candidate, trigger.polygon) ||
              distanceToPolygon(candidate, trigger.polygon) <= doorClear,
          )
        )
          continue;
        if (sceneryHidden(candidate, occludingProps)) continue;
        if (activePieces.some((piece) => distance(candidate, piece.point) < 180)) continue;
        if (visibleNpcs.some((npc) => distance(candidate, npc.point) < 100)) continue;
        if (wild.some((other) => distance(candidate, other) < 220)) continue;
        if (!isReachablePoint(grid, reachable, candidate)) continue;
        chosen = candidate;
        break;
      }
    }
    const spot: Point = chosen ?? { ...den.point };
    const facing = WILD_FACINGS[Math.floor(drawLocal() * WILD_FACINGS.length)] ?? "down";
    const pauseTicks = Math.floor(drawLocal() * (world.tunables.roam.pauseTicks + 1));
    wild.push({
      kind,
      den: index,
      mood: "chaos",
      x: spot.x,
      y: spot.y,
      home: { x: spot.x, y: spot.y },
      target: { x: spot.x, y: spot.y },
      pauseTicks,
      cooldownTicks: 0,
      facing,
      moving: false,
      notice: 0,
    });
  });
  return { wild, rng: random.rng };
}

export function chooseRoamTarget(
  world: World,
  state: State,
  area: Area,
  home: Point,
  radius: number,
): { target: Point; state: State } {
  const first = nextRandom(state);
  const second = nextRandom(first[1]);
  const third = nextRandom(second[1]);
  const rawX = first[0] * 2 - 1;
  const rawY = second[0] * 2 - 1;
  const length = Math.sqrt(rawX * rawX + rawY * rawY);
  const unitX = length === 0 ? 1 : rawX / length;
  const unitY = length === 0 ? 0 : rawY / length;
  const targetRadius = third[0] * radius;
  const candidate = {
    x: home.x + unitX * targetRadius,
    y: home.y + unitY * targetRadius,
  };
  const resolved = resolveCollision(candidate, area, world.tunables.follow.radius);
  const gap = distance(home, resolved);
  const target = gap <= radius
    ? resolved
    : {
        x: home.x + (resolved.x - home.x) * radius / gap,
        y: home.y + (resolved.y - home.y) * radius / gap,
      };
  return { target, state: third[1] };
}

// This visit's recurring critters for one tick (spec 8): while Fae is free,
// each chaos one wanders inside its den, pausing between seeded random
// targets, or chases her once it has noticed her in its sight (Milestone 51),
// giving up beyond its leash; one cooling down (after a battle or a run)
// heads home. Calm ones stand still.
export function stepWild(
  world: World,
  state: State,
  area: Area,
  player: Point,
  active: boolean,
): Pick<State, "wild" | "rng"> {
  let randomState = state;
  const roam = world.tunables.roam;
  const effectiveRoam = state.wild.length > 0 ? effectiveRoamTunables(world, state) : roam;
  const scenery = sceneryArea(world, state.ink, area);
  const wild = state.wild.map((previous): Wild => {
    const den = area.recurring?.dens[previous.den];
    const cooldownTicks = Math.max(0, previous.cooldownTicks - 1);
    if (den === undefined || !active || previous.mood === "calm")
      return { ...previous, cooldownTicks, moving: false };
    const home = previous.home ?? den.point;
    const leash = den.radius + roam.sight * 2;
    const inSight = cooldownTicks === 0 && distance(previous, player) <= roam.sight &&
      distance(home, player) <= leash;
    const notice = nextNotice(previous, inSight, effectiveRoam);
    const chasing = noticed({ ...previous, notice }, effectiveRoam);
    let target = previous.target;
    let pauseTicks = previous.pauseTicks;
    if (chasing) target = player;
    else if (cooldownTicks > 0) target = home;
    else if (pauseTicks > 0) pauseTicks -= 1;
    else if (distance(previous, target) <= 0.5) {
      const picked = chooseRoamTarget(world, randomState, scenery, home, den.radius);
      target = picked.target;
      randomState = picked.state;
      pauseTicks = roam.pauseTicks;
    }
    const speed = chasing ? roam.chaseSpeed : roam.wanderSpeed;
    const gap = distance(previous, target);
    const amount = Math.min(speed, gap);
    const candidate = gap === 0
      ? { x: previous.x, y: previous.y }
      : {
          x: previous.x + (target.x - previous.x) * amount / gap,
          y: previous.y + (target.y - previous.y) * amount / gap,
        };
    const position = resolveMove(previous, candidate, scenery, world.tunables.follow.radius);
    const dx = position.x - previous.x;
    const dy = position.y - previous.y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const facing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? "left" : dx > 0 ? "right" : previous.facing)
      : (dy < 0 ? "up" : "down");
    return {
      ...previous,
      x: position.x,
      y: position.y,
      target,
      pauseTicks,
      cooldownTicks,
      facing,
      moving: moved > 0.0001,
      notice,
    };
  });
  return { wild, rng: randomState.rng };
}

// A recurring critter heads home and leaves Fae alone for a while: after a
// battle with it, or once she runs (spec 8).
export function sendHome(world: World, area: Area, critter: Wild, back: boolean): Wild {
  const home = critter.home ??
    area.recurring?.dens[critter.den]?.point ?? { x: critter.x, y: critter.y };
  return {
    ...critter,
    ...(back ? { x: home.x, y: home.y } : {}),
    cooldownTicks: world.tunables.roam.cooldownTicks,
    target: { ...home },
    notice: 0,
  };
}

// Whether a set piece is out (spec 8): always, or while its `visibleWhile`
// story variable is true.
export function setPieceOut(world: World, state: State, piece: SetPiece): boolean {
  return piece.visibleWhile === undefined ||
    world.storyVariable(state.ink, piece.visibleWhile) === true;
}

// Every critter out in Fae's area (spec 8): its set pieces that are out, then
// this visit's recurring critters. `key` names one in targets and render
// info: a set piece's id, or `wild:<den>`.
export function presentCritters(world: World, state: State): PresentCritter[] {
  const area = world.areas[state.area];
  if (area === undefined) return [];
  const pieces = area.critters.flatMap((piece): PresentCritter[] => {
    const kind = world.critters[piece.id];
    return kind === undefined || !setPieceOut(world, state, piece)
      ? []
      : [{ key: piece.id, kind, point: piece.point,
          mood: state.critters[piece.id] ?? "chaos", wild: null }];
  });
  const wild = state.wild.flatMap((critter): PresentCritter[] => {
    const kind = world.critters[critter.kind];
    return kind === undefined
      ? []
      : [{ key: `wild:${critter.den}`, kind, point: { x: critter.x, y: critter.y },
          mood: critter.mood, wild: critter }];
  });
  return [...pieces, ...wild];
}

// The critter Fae is battling, as it stands in the area.
export function battleFoe(world: World, state: State): PresentCritter | undefined {
  const battle = state.battle;
  if (battle === null) return undefined;
  const key = battle.den === null ? battle.critterId : `wild:${battle.den}`;
  return presentCritters(world, state).find((critter) => critter.key === key);
}

// A touch is an outside-to-inside crossing of a critter's touch circle
// (spec 8): by Fae or, for a recurring critter, by either of them.
export function touchingCritter(
  world: World,
  state: State,
  movedWild: readonly Wild[],
  player: Point,
): { critter: Critter; wildTouch: Wild | undefined } | undefined {
  const wildTouch = movedWild.find((next, index) => {
    const old = state.wild[index];
    const touch = world.critters[next.kind]?.touchRadius;
    return old !== undefined && touch !== undefined && next.mood === "chaos" &&
      next.cooldownTicks === 0 && distance(state.player, old) > touch &&
      distance(player, next) <= touch;
  });
  if (wildTouch !== undefined) {
    const critter = world.critters[wildTouch.kind];
    if (critter !== undefined) return { critter, wildTouch };
  }
  const pieceTouch = presentCritters(world, state).find((item) =>
    item.wild === null && item.mood === "chaos" &&
    distance(state.player, item.point) > item.kind.touchRadius &&
    distance(player, item.point) <= item.kind.touchRadius);
  return pieceTouch === undefined ? undefined : { critter: pieceTouch.kind, wildTouch: undefined };
}
