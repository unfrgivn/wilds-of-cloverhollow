import type { Area, Direction, Point, State, World } from "./types";
import { distance, pointInPolygon, resolveCollision, validResolved } from "./geometry";
import { setInkVariables } from "./ink";
import { faeBox, partyContent, restingParty, visibleFollowerSlot } from "./party";
import {
  DEFAULT_PLATE_RADIUS,
  DEFAULT_PUSHABLE_RADIUS,
  availableHoldCompanion,
  directionVector,
  facingBetween,
  isPressurePlateActive,
  isPuzzleSolved,
  isSteppingStoneGroupLit,
  mirrorOrientation,
  nearbyResonanceBell,
  nudgeOutOfUnlitGaps,
  pushablePosition,
  rotateOrientation,
  targetPuzzleAction,
  tracePrismBeams,
  type AreaPuzzleState,
  type FluteWheelState,
  type LassoArcState,
  type PressurePlateDef,
  type PushableLiveState,
  type PuzzleActionTarget,
  type ResonanceBellDef,
} from "./puzzles-queries";

export * from "./puzzles-queries";

const DEFAULT_GRAPPLE_RANGE = 260;
const LASSO_SWING_TICKS = 16;
const LASSO_ACTION_TICKS = 12;
const LASSO_MISS_TICKS = 12;
const LASSO_CORRIDOR_HALF = 56;
const LASSO_YANK_DISTANCE = 52;
const LASSO_MISS_REACH = 110;
const FLUTE_WHEEL_STATUS_TICKS = 24;
const PUSH_WALK_SPEED = 2.4;
const PUSH_DASH_SPEED = 3.2;
const SNOWBALL_SLIDE_SPEED = 6.0;
const SNOWBALL_PLATE_SNAP = 14;

function pruneAreaState(areaState: AreaPuzzleState): AreaPuzzleState | undefined {
  return Object.keys(areaState).length === 0 ? undefined : areaState;
}

function frozenBase(state: State, input: State["previousInput"]): State {
  return {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    motion: { ...state.motion, moving: false },
    party: restingParty(state.party),
  };
}

export function evaluatePuzzleGoals(world: World, area: Area, state: State): State {
  const goals = area.puzzles?.goals;
  if (goals === undefined || goals.length === 0) return state;

  let next = state;
  const beams =
    (area.puzzles?.receivers?.length ?? 0) > 0
      ? tracePrismBeams(area, next)
      : { segments: [], energizedReceivers: [], activeEmitters: [] };

  let changed = true;
  while (changed) {
    changed = false;
    for (const goal of goals) {
      if (next.puzzles?.[goal.id] === true) continue;
      const reqPlates = goal.requirePlates ?? [];
      const reqReceivers = goal.requireReceivers ?? [];
      const reqBells = goal.requireBells ?? [];
      const reqLevers = goal.requireLevers ?? [];
      const reqStepping = goal.requireSteppingStones ?? [];
      const reqPuzzles = goal.requirePuzzles ?? [];
      const totalReqs =
        reqPlates.length + reqReceivers.length + reqBells.length +
        reqLevers.length + reqStepping.length + reqPuzzles.length;
      if (totalReqs === 0) continue;
      if (totalReqs === reqPuzzles.length &&
          !reqPuzzles.some((id) => next.puzzles?.[id] === true)) continue;

      const platesOk = reqPlates.every((id) => {
        const plate = area.puzzles?.plates?.find((item) => item.id === id);
        return plate !== undefined && isPressurePlateActive(area, next, plate);
      });
      if (!platesOk) continue;
      if (!reqReceivers.every((id) => beams.energizedReceivers.includes(id))) continue;
      const solvedBells = next.puzzleArea?.solvedBells ?? [];
      if (!reqBells.every((id) => solvedBells.includes(id))) continue;
      const pulledLevers = next.puzzleArea?.pulledLevers ?? [];
      if (!reqLevers.every((id) => pulledLevers.includes(id))) continue;
      const steppedGroups = next.puzzleArea?.steppedGroups ?? [];
      if (!reqStepping.every((id) => steppedGroups.includes(id))) continue;
      if (!reqPuzzles.every((id) => isPuzzleSolved(world, next, id))) continue;

      const alreadyInInk =
        goal.inkVariable !== undefined &&
        world.storyVariable(next.ink, goal.inkVariable) === true;
      const ink =
        goal.inkVariable !== undefined && !alreadyInInk
          ? setInkVariables(next.ink, { [goal.inkVariable]: true })
          : next.ink;
      const reward =
        goal.rewardCoins !== undefined && goal.rewardCoins > 0 && !alreadyInInk
          ? goal.rewardCoins
          : 0;
      next = {
        ...next,
        ink,
        coins: next.coins + reward,
        puzzles: { ...(next.puzzles ?? {}), [goal.id]: true },
        puzzleArea: {
          ...(next.puzzleArea ?? {}),
          lastSolved: { id: goal.id, tick: next.tick },
        },
      };
      changed = true;
    }
  }
  return next;
}

export function openFluteWheel(
  state: State,
  input: State["previousInput"],
  bell: ResonanceBellDef,
): State {
  const wheel: FluteWheelState = {
    bellId: bell.id,
    entered: [],
    status: "listening",
    statusTicks: 0,
    noteSeq: 0,
  };
  return {
    ...frozenBase(state, input),
    puzzleArea: { ...(state.puzzleArea ?? {}), fluteWheel: wheel },
  };
}

function chooseToDirection(choose: number | undefined): Direction | undefined {
  if (choose === 0) return "up";
  if (choose === 1) return "right";
  if (choose === 2) return "down";
  if (choose === 3) return "left";
  return undefined;
}

export function stepFluteWheel(
  world: World,
  area: Area,
  state: State,
  input: State["previousInput"],
): State {
  const wheel = state.puzzleArea?.fluteWheel;
  if (wheel === undefined) return state;
  const previous = state.previousInput;
  const base = frozenBase(state, input);
  const closeWheel = (): State => {
    const { fluteWheel: _closed, ...restArea } = base.puzzleArea ?? {};
    return { ...base, puzzleArea: pruneAreaState(restArea) };
  };

  if ((input.cancel && !previous.cancel) || (input.flute === true && previous.flute !== true)) {
    return closeWheel();
  }
  if (wheel.status === "matched") {
    const ticks = wheel.statusTicks + 1;
    return ticks >= FLUTE_WHEEL_STATUS_TICKS
      ? closeWheel()
      : {
          ...base,
          puzzleArea: { ...(base.puzzleArea ?? {}), fluteWheel: { ...wheel, statusTicks: ticks } },
        };
  }
  if (wheel.status === "wrong") {
    const ticks = wheel.statusTicks + 1;
    const nextWheel: FluteWheelState =
      ticks >= FLUTE_WHEEL_STATUS_TICKS
        ? { ...wheel, entered: [], status: "listening", statusTicks: 0 }
        : { ...wheel, statusTicks: ticks };
    return { ...base, puzzleArea: { ...(base.puzzleArea ?? {}), fluteWheel: nextWheel } };
  }

  let note =
    input.choose !== undefined && input.choose !== previous.choose
      ? chooseToDirection(input.choose)
      : undefined;
  if (note === undefined) {
    if (input.move.y < -0.5 && previous.move.y >= -0.5) note = "up";
    else if (input.move.x > 0.5 && previous.move.x <= 0.5) note = "right";
    else if (input.move.y > 0.5 && previous.move.y <= 0.5) note = "down";
    else if (input.move.x < -0.5 && previous.move.x >= -0.5) note = "left";
  }
  if (note === undefined) return base;

  const entered = [...wheel.entered, note];
  const bell = area.puzzles?.bells?.find((item) => item.id === wheel.bellId);
  let nextWheel: FluteWheelState = {
    ...wheel,
    entered,
    lastNote: note,
    noteSeq: wheel.noteSeq + 1,
  };
  let solvedBells = base.puzzleArea?.solvedBells;

  if (bell !== undefined && entered.length >= bell.sequence.length) {
    const matched =
      entered.length === bell.sequence.length &&
      entered.every((item, index) => item === bell.sequence[index]);
    if (matched) {
      nextWheel = { ...nextWheel, status: "matched", statusTicks: 0 };
      if (!(solvedBells ?? []).includes(bell.id)) solvedBells = [...(solvedBells ?? []), bell.id];
    } else {
      nextWheel = { ...nextWheel, status: "wrong", statusTicks: 0 };
    }
  }

  const updated: State = {
    ...base,
    puzzleArea: {
      ...(base.puzzleArea ?? {}),
      fluteWheel: nextWheel,
      recentChime: { note, tick: base.tick },
      ...(solvedBells === undefined ? {} : { solvedBells }),
    },
  };
  return nextWheel.status === "matched" ? evaluatePuzzleGoals(world, area, updated) : updated;
}

export function applyPuzzleConfirm(
  world: World,
  area: Area,
  state: State,
  input: State["previousInput"],
  action: PuzzleActionTarget,
): State {
  if (action.kind === "play-bell") {
    const bell = area.puzzles?.bells?.find((item) => item.id === action.id);
    return bell === undefined ? state : openFluteWheel(state, input, bell);
  }

  if (action.kind === "rotate-mirror") {
    const mirror = area.puzzles?.mirrors?.find((item) => item.id === action.id);
    if (mirror === undefined) return state;
    const rotated = rotateOrientation(mirrorOrientation(area, state, mirror));
    return evaluatePuzzleGoals(world, area, {
      ...frozenBase(state, input),
      puzzleArea: {
        ...(state.puzzleArea ?? {}),
        mirrors: { ...(state.puzzleArea?.mirrors ?? {}), [mirror.id]: rotated },
      },
    });
  }

  const plate = area.puzzles?.plates?.find((item) => item.id === action.id);
  if (plate === undefined) return state;

  if (action.kind === "release-plate") {
    const held = { ...(state.puzzleArea?.heldPlates ?? {}) };
    delete held[plate.id];
    const nextPuzzleArea: AreaPuzzleState = { ...(state.puzzleArea ?? {}) };
    if (Object.keys(held).length === 0) delete nextPuzzleArea.heldPlates;
    else nextPuzzleArea.heldPlates = held;
    return { ...frozenBase(state, input), puzzleArea: pruneAreaState(nextPuzzleArea) };
  }

  const companion = availableHoldCompanion(state, plate);
  if (companion === undefined) return state;
  const platePoint = { x: plate.x, y: plate.y };
  const party = state.party.map((member) =>
    member.id === companion.id
      ? {
          ...member,
          x: platePoint.x,
          y: platePoint.y,
          facing: facingBetween(platePoint, state.player),
          motion: { ...member.motion, moving: false },
          trail: [platePoint],
        }
      : member,
  );
  return evaluatePuzzleGoals(world, area, {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    motion: { ...state.motion, moving: false },
    party,
    puzzleArea: {
      ...(state.puzzleArea ?? {}),
      heldPlates: { ...(state.puzzleArea?.heldPlates ?? {}), [plate.id]: companion.id },
    },
  });
}

export function tryPuzzleConfirm(
  world: World,
  area: Area,
  state: State,
  input: State["previousInput"],
): State | undefined {
  const action = targetPuzzleAction(world, state);
  return action === undefined ? undefined : applyPuzzleConfirm(world, area, state, input, action);
}

function pickNearestLassoTarget<T>(
  origin: Point,
  facing: Point,
  items: readonly T[],
  pointOf: (item: T) => Point,
  rangeOf: (item: T) => number,
): { item: T; pos: Point; dist: number } | undefined {
  let best: { item: T; pos: Point; dist: number } | undefined;
  for (const item of items) {
    const pos = pointOf(item);
    const maxRange = rangeOf(item);
    const dx = pos.x - origin.x;
    const dy = pos.y - origin.y;
    const along = dx * facing.x + dy * facing.y;
    const perp = Math.abs(dx * -facing.y + dy * facing.x);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (along > 0 && along <= maxRange && dist <= maxRange && perp <= LASSO_CORRIDOR_HALF) {
      if (best === undefined || dist < best.dist) best = { item, pos, dist };
    }
  }
  return best;
}

function makeLassoArc(
  from: Point,
  to: Point,
  duration: number,
  kind: LassoArcState["kind"],
  targetId?: string,
): LassoArcState {
  return {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    tick: 0,
    duration,
    kind,
    ...(targetId === undefined ? {} : { targetId }),
  };
}

export function triggerLasso(
  world: World,
  area: Area,
  solidForPushable: (excludeId?: string) => Area,
  state: State,
  input: State["previousInput"],
): State {
  const base = frozenBase(state, input);
  const facing = directionVector(state.facing);
  const puzzles = area.puzzles;
  const grapples = puzzles?.grapples ?? [];

  const swing = pickNearestLassoTarget(
    state.player,
    facing,
    grapples.filter((p) => p.kind === "swing" && p.landA !== undefined && p.landB !== undefined),
    (p) => p,
    (p) => p.range ?? DEFAULT_GRAPPLE_RANGE,
  );
  if (swing?.item.landA !== undefined && swing.item.landB !== undefined) {
    const landFrom = { x: state.player.x, y: state.player.y };
    const landTo = distance(state.player, swing.item.landA) <=
      distance(state.player, swing.item.landB)
      ? { ...swing.item.landB }
      : { ...swing.item.landA };
    const lasso: LassoArcState = {
      ...makeLassoArc(landFrom, swing.item, LASSO_SWING_TICKS, "swing", swing.item.id),
      landFrom,
      landTo,
    };
    return { ...base, puzzleArea: { ...(base.puzzleArea ?? {}), lasso } };
  }

  const post = pickNearestLassoTarget(
    state.player,
    facing,
    grapples.filter((p) => p.kind !== "swing"),
    (p) => p,
    (p) => p.range ?? DEFAULT_GRAPPLE_RANGE,
  );
  if (post !== undefined) {
    const existing = base.puzzleArea?.pulledLevers ?? [];
    const pulledLevers = existing.includes(post.item.id) ? existing : [...existing, post.item.id];
    const lasso = makeLassoArc(state.player, post.item, LASSO_ACTION_TICKS, "pull", post.item.id);
    return evaluatePuzzleGoals(world, area, {
      ...base,
      puzzleArea: { ...(base.puzzleArea ?? {}), pulledLevers, lasso },
    });
  }

  const mirror = pickNearestLassoTarget(
    state.player,
    facing,
    puzzles?.mirrors ?? [],
    (m) => m,
    () => DEFAULT_GRAPPLE_RANGE,
  );
  if (mirror !== undefined) {
    const rotated = rotateOrientation(mirrorOrientation(area, state, mirror.item));
    const lasso = makeLassoArc(
      state.player,
      mirror.item,
      LASSO_ACTION_TICKS,
      "rotate",
      mirror.item.id,
    );
    return evaluatePuzzleGoals(world, area, {
      ...base,
      puzzleArea: {
        ...(base.puzzleArea ?? {}),
        mirrors: { ...(base.puzzleArea?.mirrors ?? {}), [mirror.item.id]: rotated },
        lasso,
      },
    });
  }

  const push = pickNearestLassoTarget(
    state.player,
    facing,
    (puzzles?.pushables ?? []).filter((d) => d.lassoable !== false),
    (d) => pushablePosition(area, state, d),
    () => DEFAULT_GRAPPLE_RANGE,
  );
  if (push !== undefined) {
    const { item: def, pos } = push;
    const vx = state.player.x - pos.x;
    const vy = state.player.y - pos.y;
    const len = Math.sqrt(vx * vx + vy * vy);
    const radius = def.radius ?? DEFAULT_PUSHABLE_RADIUS;
    let live: PushableLiveState;
    if (def.slides === true) {
      const sdx = Math.abs(vx) >= Math.abs(vy) ? (vx >= 0 ? 1 : -1) : 0;
      const sdy = Math.abs(vx) >= Math.abs(vy) ? 0 : vy >= 0 ? 1 : -1;
      live = { x: pos.x, y: pos.y, sliding: { dx: sdx, dy: sdy } };
    } else {
      const pullDist = Math.max(
        0,
        Math.min(LASSO_YANK_DISTANCE, len - (world.tunables.playerRadius + radius + 6)),
      );
      const ux = len > 0.001 ? vx / len : 0;
      const uy = len > 0.001 ? vy / len : 0;
      const pushSolid = solidForPushable(def.id);
      let current = pos;
      for (let stepIdx = 0; stepIdx < 4 && pullDist > 0; stepIdx += 1) {
        const resolved = resolveCollision(
          { x: current.x + (ux * pullDist) / 4, y: current.y + (uy * pullDist) / 4 },
          pushSolid,
          radius,
        );
        if (!validResolved(resolved, pushSolid, radius)) break;
        current = resolved;
      }
      live = { x: current.x, y: current.y };
    }
    const lasso = makeLassoArc(state.player, live, LASSO_ACTION_TICKS, "yank", def.id);
    return evaluatePuzzleGoals(world, area, {
      ...base,
      puzzleArea: {
        ...(base.puzzleArea ?? {}),
        pushables: { ...(base.puzzleArea?.pushables ?? {}), [def.id]: live },
        lasso,
      },
    });
  }

  const missTo = {
    x: state.player.x + facing.x * LASSO_MISS_REACH,
    y: state.player.y + facing.y * LASSO_MISS_REACH,
  };
  const lasso = makeLassoArc(state.player, missTo, LASSO_MISS_TICKS, "miss");
  return { ...base, puzzleArea: { ...(base.puzzleArea ?? {}), lasso } };
}

export function stepLassoSwing(
  world: World,
  area: Area,
  solid: Area,
  state: State,
  input: State["previousInput"],
): State {
  const lasso = state.puzzleArea?.lasso;
  if (lasso === undefined || lasso.kind !== "swing") return state;
  const from = lasso.landFrom ?? lasso.from;
  const to = lasso.landTo ?? lasso.to;
  const nextArcTick = lasso.tick + 1;
  const t = Math.min(1, nextArcTick / lasso.duration);
  const inv = 1 - t;
  const ctrl: Point = { x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 - 24 };
  const arcPoint: Point = {
    x: inv * inv * from.x + 2 * inv * t * ctrl.x + t * t * to.x,
    y: inv * inv * from.y + 2 * inv * t * ctrl.y + t * t * to.y,
  };
  const finished = nextArcTick >= lasso.duration;
  const openArea = { ...area, blockers: [] };
  const player = finished
    ? resolveCollision(to, solid, world.tunables.playerRadius)
    : resolveCollision(arcPoint, openArea, world.tunables.playerRadius);
  const facing = facingBetween(from, to);

  const heldIds = new Set(Object.values(state.puzzleArea?.heldPlates ?? {}));
  let party = state.party;
  if (finished) {
    const ahead = [{ point: player, box: faeBox }];
    let leader = player;
    party = state.party.map((member, index) => {
      if (heldIds.has(member.id)) return member;
      const content = partyContent(world, member.id);
      const slot =
        visibleFollowerSlot(
          solid,
          leader,
          leader,
          world.tunables.follow,
          content.box,
          ahead,
          index > 0,
        ) ?? resolveCollision(player, solid, world.tunables.follow.radius);
      ahead.push({ point: slot, box: content.box });
      leader = slot;
      return {
        ...member,
        x: slot.x,
        y: slot.y,
        facing,
        motion: { ...member.motion, moving: false },
        stillTicks: 0,
        trail: [slot, player],
      };
    });
  } else {
    party = state.party.map((member) => {
      if (heldIds.has(member.id)) return member;
      const resolved = resolveCollision(
        { x: member.x + (player.x - member.x) * 0.2, y: member.y + (player.y - member.y) * 0.2 },
        openArea,
        world.tunables.follow.radius,
      );
      return {
        ...member,
        x: resolved.x,
        y: resolved.y,
        facing,
        motion: { ...member.motion, moving: false },
      };
    });
  }

  const nextAreaState: AreaPuzzleState = { ...(state.puzzleArea ?? {}) };
  if (finished) delete nextAreaState.lasso;
  else nextAreaState.lasso = { ...lasso, tick: nextArcTick };
  return {
    ...state,
    tick: state.tick + 1,
    player,
    facing,
    previousInput: { ...input },
    motion: { ...state.motion, moving: false },
    party,
    puzzleArea: pruneAreaState(nextAreaState),
  };
}

export function stepPuzzleIntercept(
  world: World,
  area: Area,
  solidFor: (targetState: State, excludeId?: string) => Area,
  state: State,
  input: State["previousInput"],
): State | undefined {
  if (state.transition !== null) return undefined;
  if (state.puzzleArea?.fluteWheel !== undefined) return stepFluteWheel(world, area, state, input);
  if (state.puzzleArea?.lasso?.kind === "swing") {
    return stepLassoSwing(world, area, solidFor(state), state, input);
  }
  if (state.finale !== null) return undefined;

  const lanternEdge = input.lantern === true && state.previousInput.lantern !== true;
  if (lanternEdge && world.storyVariable(state.ink, "has_lantern") === true) {
    const toggled: State = {
      ...state,
      tick: state.tick + 1,
      lantern: !state.lantern,
      previousInput: { ...input },
    };
    if (area.puzzles === undefined) return toggled;
    return toggled.lantern
      ? evaluatePuzzleGoals(world, area, toggled)
      : nudgeOutOfUnlitGaps(world, area, solidFor(toggled), toggled);
  }

  const fluteEdge = input.flute === true && state.previousInput.flute !== true;
  if (fluteEdge && world.storyVariable(state.ink, "has_flute") === true) {
    const bell = nearbyResonanceBell(area, state.player);
    return bell === undefined ? undefined : openFluteWheel(state, input, bell);
  }

  const lassoEdge = input.lasso === true && state.previousInput.lasso !== true;
  if (
    lassoEdge &&
    state.puzzleArea?.lasso === undefined &&
    world.storyVariable(state.ink, "has_lasso") === true
  ) {
    return triggerLasso(world, area, (excludeId) => solidFor(state, excludeId), state, input);
  }
  return undefined;
}

function plateOccupiedByOther(
  area: Area,
  state: State,
  plate: PressurePlateDef,
  excludePushableId: string,
): boolean {
  const holderId = state.puzzleArea?.heldPlates?.[plate.id];
  if (holderId !== undefined && state.party.some((m) => m.id === holderId)) return true;
  const radius = plate.radius ?? DEFAULT_PLATE_RADIUS;
  for (const other of area.puzzles?.pushables ?? []) {
    if (other.id === excludePushableId) continue;
    if (distance(pushablePosition(area, state, other), plate) <= radius) return true;
  }
  return false;
}

export function stepPuzzles(
  world: World,
  area: Area,
  solidForPushable: (excludeId?: string) => Area,
  state: State,
  input: State["previousInput"],
): State {
  let next = state;
  let areaState: AreaPuzzleState | undefined = state.puzzleArea;
  let dirtyAreaState = false;
  const ensureAreaState = (): AreaPuzzleState => {
    if (areaState === undefined) areaState = {};
    dirtyAreaState = true;
    return areaState;
  };

  if (areaState?.lasso !== undefined && areaState.lasso.kind !== "swing") {
    const nextArcTick = areaState.lasso.tick + 1;
    const target = ensureAreaState();
    if (nextArcTick >= areaState.lasso.duration) {
      const { lasso: _done, ...rest } = target;
      areaState = pruneAreaState(rest);
    } else {
      areaState = {
        ...target,
        lasso: {
          ...areaState.lasso,
          from: { x: next.player.x, y: next.player.y },
          tick: nextArcTick,
        },
      };
    }
  }

  const puzzles = area.puzzles;
  if (puzzles === undefined) return dirtyAreaState ? { ...next, puzzleArea: areaState } : next;

  const moveLen = Math.sqrt(input.move.x * input.move.x + input.move.y * input.move.y);
  const pushables = puzzles.pushables ?? [];
  if (pushables.length > 0) {
    let liveMap = areaState?.pushables;

    if (moveLen > 0.001) {
      const scale = moveLen > 1 ? 1 / moveLen : 1;
      const ux = input.move.x * scale;
      const uy = input.move.y * scale;
      const pushSpeed = input.dash === true ? PUSH_DASH_SPEED : PUSH_WALK_SPEED;

      for (const def of pushables) {
        const currentLive = liveMap?.[def.id];
        if (currentLive?.sliding !== undefined) continue;
        const pos = currentLive === undefined
          ? { x: def.x, y: def.y }
          : { x: currentLive.x, y: currentLive.y };
        const radius = def.radius ?? DEFAULT_PUSHABLE_RADIUS;
        const dx = pos.x - next.player.x;
        const dy = pos.y - next.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > world.tunables.playerRadius + radius + 4 || dist < 0.001) continue;
        if ((dx * ux + dy * uy) / dist < 0.55) continue;

        const ax = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : -1) : 0;
        const ay = Math.abs(dx) >= Math.abs(dy) ? 0 : dy >= 0 ? 1 : -1;

        if (def.slides === true) {
          liveMap = {
            ...(liveMap ?? {}),
            [def.id]: { x: pos.x, y: pos.y, sliding: { dx: ax, dy: ay } },
          };
          areaState = { ...ensureAreaState(), pushables: liveMap };
          next = { ...next, puzzleArea: areaState };
        } else {
          const pushSolid = solidForPushable(def.id);
          const resolved = resolveCollision(
            { x: pos.x + ax * pushSpeed, y: pos.y + ay * pushSpeed },
            pushSolid,
            radius,
          );
          const progress = (resolved.x - pos.x) * ax + (resolved.y - pos.y) * ay;
          if (validResolved(resolved, pushSolid, radius) && progress > 0.01) {
            liveMap = { ...(liveMap ?? {}), [def.id]: { x: resolved.x, y: resolved.y } };
            areaState = { ...ensureAreaState(), pushables: liveMap };
            next = { ...next, puzzleArea: areaState };
          }
        }
      }
    }

    for (const def of pushables) {
      const currentLive = liveMap?.[def.id];
      if (currentLive?.sliding === undefined) continue;
      const { dx: ax, dy: ay } = currentLive.sliding;
      const radius = def.radius ?? DEFAULT_PUSHABLE_RADIUS;
      const pushSolid = solidForPushable(def.id);
      let cur: Point = { x: currentLive.x, y: currentLive.y };
      let stillSliding = true;

      for (let half = 0; half < 2 && stillSliding; half += 1) {
        const stepDist = SNOWBALL_SLIDE_SPEED / 2;
        const candidate = { x: cur.x + ax * stepDist, y: cur.y + ay * stepDist };

        let snapped = false;
        for (const plate of puzzles.plates ?? []) {
          if (plateOccupiedByOther(area, next, plate, def.id)) continue;
          const distAfter = distance(candidate, plate);
          if (distAfter <= SNOWBALL_PLATE_SNAP && distAfter < distance(cur, plate)) {
            cur = { x: plate.x, y: plate.y };
            stillSliding = false;
            snapped = true;
            break;
          }
        }
        if (snapped) break;

        const resolved = resolveCollision(candidate, pushSolid, radius);
        const progress = (resolved.x - cur.x) * ax + (resolved.y - cur.y) * ay;
        if (!validResolved(resolved, pushSolid, radius) || progress < stepDist * 0.5) {
          if (validResolved(resolved, pushSolid, radius) && progress > 0.05) cur = resolved;
          stillSliding = false;
          break;
        }
        cur = resolved;
      }

      const updatedLive: PushableLiveState = stillSliding
        ? { x: cur.x, y: cur.y, sliding: { dx: ax, dy: ay } }
        : { x: cur.x, y: cur.y };
      liveMap = { ...(liveMap ?? {}), [def.id]: updatedLive };
      areaState = { ...ensureAreaState(), pushables: liveMap };
      next = { ...next, puzzleArea: areaState };
    }
  }

  for (const group of puzzles.steppingStones ?? []) {
    if ((areaState?.steppedGroups ?? []).includes(group.id)) continue;
    if (
      group.permanentOnPuzzle !== undefined &&
      isPuzzleSolved(world, next, group.permanentOnPuzzle)
    ) continue;
    if (!isSteppingStoneGroupLit(world, next, group)) continue;
    const onGroup =
      pointInPolygon(next.player, group.gapPolygon) ||
      group.stones.some((stone) => distance(next.player, stone) <= 24);
    if (onGroup) {
      const target = ensureAreaState();
      areaState = { ...target, steppedGroups: [...(target.steppedGroups ?? []), group.id] };
      next = { ...next, puzzleArea: areaState };
    }
  }

  if (dirtyAreaState) next = { ...next, puzzleArea: areaState };
  return evaluatePuzzleGoals(world, area, next);
}
