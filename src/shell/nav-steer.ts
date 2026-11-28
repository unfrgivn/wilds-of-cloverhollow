import {
  buildNavField,
  distance,
  findPath,
  propStateName,
  sceneryArea,
  type ActionFrame,
  type Area,
  type NavField,
  type Point,
  type State,
  type World,
} from "../core";

const WAYPOINT_ADVANCE_RADIUS = 14;
const GOAL_STOP_RADIUS = 8;
const FINAL_SLOW_RADIUS = 18;
const MIN_FINAL_MAGNITUDE = 0.45;
const STALL_PROGRESS_DISTANCE = 3;
const STALL_MAX_TICKS = 24;

export type NavPathSnapshot = {
  goal: Point;
  waypoints: readonly Point[];
  area: string;
};

export type NavPathFollower = {
  getField: (state: State) => NavField | null;
  setTarget: (state: State, worldPoint: Point) => boolean;
  clear: () => void;
  snapshot: () => NavPathSnapshot | null;
  stepMove: (state: State) => Point;
};

type ActivePath = {
  area: string;
  goal: Point;
  waypoints: Point[];
  waypointIndex: number;
  stallTicks: number;
  lastProgressPos: Point;
};

function navCacheKey(world: World, ink: string, area: Area): string {
  const openCrossings = (area.crossings ?? [])
    .map((crossing) => (world.storyVariable(ink, crossing.opens) === true ? "1" : "0"))
    .join("");
  const propStates = area.props
    .map((prop) => propStateName(world, ink, prop))
    .join(",");
  return `${area.id}|${openCrossings}|${propStates}`;
}

export function createNavPathFollower(world: World): NavPathFollower {
  let cached: { key: string; field: NavField } | null = null;
  let active: ActivePath | null = null;

  const clear = (): void => {
    active = null;
  };

  const getField = (state: State): NavField | null => {
    const area = world.areas[state.area];
    if (area === undefined) return null;
    const key = navCacheKey(world, state.ink, area);
    if (cached !== null && cached.key === key) return cached.field;
    const field = buildNavField(
      sceneryArea(world, state.ink, area),
      world.tunables.playerRadius,
    );
    cached = { key, field };
    return field;
  };

  const setTarget = (state: State, worldPoint: Point): boolean => {
    const field = getField(state);
    if (field === null) {
      clear();
      return false;
    }
    const waypoints = findPath(field, state.player, worldPoint);
    const goal = waypoints[waypoints.length - 1];
    if (waypoints.length === 0 || goal === undefined) {
      clear();
      return false;
    }
    active = {
      area: state.area,
      goal,
      waypoints,
      waypointIndex: 0,
      stallTicks: 0,
      lastProgressPos: { x: state.player.x, y: state.player.y },
    };
    return true;
  };

  const snapshot = (): NavPathSnapshot | null => {
    if (active === null) return null;
    return {
      goal: active.goal,
      waypoints: active.waypoints.slice(active.waypointIndex),
      area: active.area,
    };
  };

  const stepMove = (state: State): Point => {
    if (active === null) return { x: 0, y: 0 };
    if (
      state.area !== active.area ||
      state.transition !== null ||
      state.dialogue !== null ||
      state.battle !== null ||
      state.arcade !== null ||
      state.finale !== null
    ) {
      clear();
      return { x: 0, y: 0 };
    }

    while (active.waypointIndex < active.waypoints.length - 1) {
      const current = active.waypoints[active.waypointIndex];
      if (current === undefined || distance(state.player, current) > WAYPOINT_ADVANCE_RADIUS) {
        break;
      }
      active.waypointIndex += 1;
    }

    const wp = active.waypoints[active.waypointIndex];
    if (wp === undefined) {
      clear();
      return { x: 0, y: 0 };
    }

    const isLast = active.waypointIndex === active.waypoints.length - 1;
    const dx = wp.x - state.player.x;
    const dy = wp.y - state.player.y;
    const len = Math.hypot(dx, dy);
    if (isLast && len <= GOAL_STOP_RADIUS) {
      clear();
      return { x: 0, y: 0 };
    }

    if (distance(state.player, active.lastProgressPos) >= STALL_PROGRESS_DISTANCE) {
      active.lastProgressPos = { x: state.player.x, y: state.player.y };
      active.stallTicks = 0;
    } else {
      active.stallTicks += 1;
      if (active.stallTicks >= STALL_MAX_TICKS) {
        clear();
        return { x: 0, y: 0 };
      }
    }

    if (len === 0) return { x: 0, y: 0 };
    const rampSpan = FINAL_SLOW_RADIUS - GOAL_STOP_RADIUS;
    const mag = isLast && len < FINAL_SLOW_RADIUS
      ? MIN_FINAL_MAGNITUDE +
        (1 - MIN_FINAL_MAGNITUDE) * Math.max(0, (len - GOAL_STOP_RADIUS) / rampSpan)
      : 1;
    return {
      x: (dx / len) * mag,
      y: (dy / len) * mag,
    };
  };

  return { getField, setTarget, clear, snapshot, stepMove };
}

export function mergeNavSteerInput(
  combined: ActionFrame,
  pointerActive: boolean,
  canSteer: boolean,
  navFollower: NavPathFollower,
  state: State,
): ActionFrame {
  const hasManualMove = combined.move.x !== 0 || combined.move.y !== 0 || pointerActive;
  const hasButtonPress = combined.confirm || combined.cancel || combined.menu;
  if (hasManualMove || hasButtonPress || !canSteer) {
    navFollower.clear();
    return combined;
  }
  if (navFollower.snapshot() === null) return combined;
  return { ...combined, move: navFollower.stepMove(state) };
}
