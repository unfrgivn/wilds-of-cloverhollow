import type { Point } from "../core";

export const DEFAULT_OVERWORLD_DEAD_RADIUS = 18;
export const DEFAULT_OVERWORLD_RAMP_RADIUS = 64;
export const DEFAULT_OVERWORLD_TAP_DRAG = 12;
export const DEFAULT_OVERWORLD_TAP_DURATION_MS = 260;
export const DEFAULT_OVERWORLD_TAP_RADIUS = 96;

export type OverworldPointerEvent = {
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};

export type OverworldPointerTarget = {
  addEventListener: (
    type:
      | "pointerdown"
      | "pointermove"
      | "pointerup"
      | "pointercancel"
      | "lostpointercapture",
    listener: (event: OverworldPointerEvent) => void,
  ) => void;
  setPointerCapture?: (pointerId: number) => void;
};

export type OverworldPointerSteerOptions = {
  canvas: OverworldPointerTarget;
  canSteer: () => boolean;
  playerScreen: () => Point | null;
  onMove: (dir: Point) => void;
  onTapNearPlayer?: () => void;
  now?: () => number;
  deadRadius?: number;
  rampRadius?: number;
};

export type OverworldPointerSteer = {
  sync: () => void;
  release: () => void;
  isActive: () => boolean;
};

/**
 * Maps a screen-space pointer and player position into a smooth overworld move
 * vector: zero inside `deadRadius` so Fae stops cleanly beside the cursor, and
 * linearly ramped along the unit direction up to full stride at `rampRadius`.
 */
export function computeOverworldSteer(
  pointer: Point,
  player: Point,
  deadRadius = DEFAULT_OVERWORLD_DEAD_RADIUS,
  rampRadius = DEFAULT_OVERWORLD_RAMP_RADIUS,
): Point {
  const dx = pointer.x - player.x;
  const dy = pointer.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= deadRadius || distance === 0) {
    return { x: 0, y: 0 };
  }
  const span = Math.max(1, rampRadius - deadRadius);
  const magnitude = Math.min(1, (distance - deadRadius) / span);
  return {
    x: (dx / distance) * magnitude,
    y: (dy / distance) * magnitude,
  };
}

/**
 * Returns true when a pointerdown/pointerup pair is a brief, low-drag click
 * within `nearPlayerRadius` of Fae's screen anchor, qualifying for quick
 * overworld companion petting or bench resting without accidental steering.
 */
export function isOverworldTap(
  downPoint: Point,
  upPoint: Point,
  elapsedMs: number,
  playerScreen: Point | null,
  maxDragPx = DEFAULT_OVERWORLD_TAP_DRAG,
  maxDurationMs = DEFAULT_OVERWORLD_TAP_DURATION_MS,
  nearPlayerRadius = DEFAULT_OVERWORLD_TAP_RADIUS,
): boolean {
  if (playerScreen === null) return false;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > maxDurationMs) {
    return false;
  }
  const drag = Math.hypot(upPoint.x - downPoint.x, upPoint.y - downPoint.y);
  if (!Number.isFinite(drag) || drag > maxDragPx) return false;
  const distanceFromPlayer = Math.hypot(
    upPoint.x - playerScreen.x,
    upPoint.y - playerScreen.y,
  );
  return Number.isFinite(distanceFromPlayer) && distanceFromPlayer <= nearPlayerRadius;
}

/**
 * Sticky-proof desktop mouse/pen press-and-hold overworld steering on the game
 * canvas. Ignores touch pointers (leaving the virtual joystick untouched) and
 * secondary mouse buttons, tracks one active pointer, recomputes per tick via
 * `sync()` so Fae decelerates to a clean stop beside the cursor, fires
 * `onTapNearPlayer` on crisp clicks near Fae, and releases idempotently on
 * pointer end, lost capture, blur, hidden tab, or overlay open.
 */
export function bindOverworldPointerSteer(
  options: OverworldPointerSteerOptions,
): OverworldPointerSteer {
  const now = options.now ?? (() => performance.now());
  let activePointerId: number | null = null;
  let lastPointer: Point = { x: 0, y: 0 };
  let downPoint: Point = { x: 0, y: 0 };
  let downTime = 0;
  let lastMoveEvent: OverworldPointerEvent | null = null;

  const emitSteer = (): void => {
    const player = options.playerScreen();
    if (player === null) {
      options.onMove({ x: 0, y: 0 });
      return;
    }
    options.onMove(
      computeOverworldSteer(
        lastPointer,
        player,
        options.deadRadius,
        options.rampRadius,
      ),
    );
  };

  const release = (): void => {
    if (activePointerId === null) return;
    activePointerId = null;
    lastMoveEvent = null;
    options.onMove({ x: 0, y: 0 });
  };

  const sync = (): void => {
    if (activePointerId === null) return;
    if (!options.canSteer()) {
      release();
      return;
    }
    emitSteer();
  };

  const isActive = (): boolean => activePointerId !== null;

  const onPointerDown = (event: OverworldPointerEvent): void => {
    if (
      (event.pointerType !== "mouse" && event.pointerType !== "pen") ||
      event.button !== 0
    ) {
      return;
    }
    if (activePointerId !== null || !options.canSteer()) return;
    event.preventDefault();
    try {
      options.canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic or detached events may reject capture; window listeners still release.
    }
    activePointerId = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    downPoint = { x: event.clientX, y: event.clientY };
    downTime = now();
    lastMoveEvent = null;
    emitSteer();
  };

  const onPointerMove = (event: OverworldPointerEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    if (event === lastMoveEvent) return;
    lastMoveEvent = event;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (!options.canSteer()) {
      release();
      return;
    }
    emitSteer();
  };

  const onPointerUp = (event: OverworldPointerEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    const shouldTap =
      options.onTapNearPlayer !== undefined &&
      options.canSteer() &&
      isOverworldTap(
        downPoint,
        { x: event.clientX, y: event.clientY },
        now() - downTime,
        options.playerScreen(),
      );
    release();
    if (shouldTap) options.onTapNearPlayer?.();
  };

  const onPointerCancel = (event: OverworldPointerEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    release();
  };

  options.canvas.addEventListener("pointerdown", onPointerDown);
  options.canvas.addEventListener("pointermove", onPointerMove);
  options.canvas.addEventListener("pointerup", onPointerUp);
  options.canvas.addEventListener("pointercancel", onPointerCancel);
  options.canvas.addEventListener("lostpointercapture", onPointerCancel);

  if (typeof window !== "undefined") {
    window.addEventListener("blur", release);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) release();
    });
  }

  return { sync, release, isActive };
}
