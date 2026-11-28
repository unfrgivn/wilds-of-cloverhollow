import type { Point } from "../core";

export const DEFAULT_OVERWORLD_DEAD_RADIUS = 18;
export const DEFAULT_OVERWORLD_RAMP_RADIUS = 64;
export const DEFAULT_OVERWORLD_TAP_DRAG = 12;
export const DEFAULT_OVERWORLD_TAP_DURATION_MS = 260;
export const DEFAULT_OVERWORLD_TAP_RADIUS = 96;
export const DEFAULT_OVERWORLD_TAP_PLAYER_TRAVEL = 20;

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
      | "lostpointercapture"
      | "contextmenu",
    listener: (event: OverworldPointerEvent) => void,
  ) => void;
  setPointerCapture?: (pointerId: number) => void;
};

export type OverworldPointerSteerOptions = {
  canvas: OverworldPointerTarget;
  canSteer: () => boolean;
  playerScreen: () => Point | null;
  playerWorld?: () => Point | null;
  onMove: (dir: Point) => void;
  onTapNearPlayer?: () => void;
  onTapGround?: (screenPoint: Point) => void;
  isPhotoMode?: () => boolean;
  isTouchUi?: () => boolean;
  onPhotoSnap?: () => void;
  onPhotoExit?: () => void;
  now?: () => number;
  deadRadius?: number;
  rampRadius?: number;
};

export type PhotoModePointerActionOptions = {
  photoMode: boolean;
  touchUiActive: boolean;
  pointerType: string;
  button: number;
  eventType: "pointerup" | "contextmenu";
};

export type PhotoModePointerAction = "snap" | "exit" | null;

/**
 * Classifies desktop canvas pointer gestures while Photo Mode is active: primary
 * mouse/pen clicks snap a postcard and right-click contextmenu exits Photo Mode.
 * Touch UI and touch pointers always return null (handled by .photo-touch-bar).
 */
export function photoModePointerAction(
  options: PhotoModePointerActionOptions,
): PhotoModePointerAction {
  if (!options.photoMode || options.touchUiActive || options.pointerType === "touch") {
    return null;
  }
  if (options.eventType === "pointerup" && options.button === 0) return "snap";
  if (options.eventType === "contextmenu") return "exit";
  return null;
}

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
 * Returns true when a pointerdown/pointerup pair qualifies as an open-ground
 * click-to-walk tap: brief, low-drag, outside the near-player pet/rest radius,
 * and without hold-steering already walking Fae while the button was held.
 */
export function isOverworldGroundTap(
  downPoint: Point,
  upPoint: Point,
  elapsedMs: number,
  downPlayer: Point | null,
  upPlayer: Point | null,
  options?: {
    maxDurationMs?: number;
    maxDrag?: number;
    maxPlayerTravel?: number;
  },
): boolean {
  const maxDurationMs = options?.maxDurationMs ?? DEFAULT_OVERWORLD_TAP_DURATION_MS;
  const maxDrag = options?.maxDrag ?? DEFAULT_OVERWORLD_TAP_DRAG;
  const maxPlayerTravel = options?.maxPlayerTravel ?? DEFAULT_OVERWORLD_TAP_PLAYER_TRAVEL;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > maxDurationMs) {
    return false;
  }
  const drag = Math.hypot(upPoint.x - downPoint.x, upPoint.y - downPoint.y);
  if (!Number.isFinite(drag) || drag > maxDrag) return false;
  if (downPlayer === null || upPlayer === null) return false;
  const playerTravel = Math.hypot(upPlayer.x - downPlayer.x, upPlayer.y - downPlayer.y);
  if (!Number.isFinite(playerTravel) || playerTravel > maxPlayerTravel) return false;
  if (isOverworldTap(downPoint, upPoint, elapsedMs, upPlayer, maxDrag, maxDurationMs)) {
    return false;
  }
  return true;
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
  let downPlayer: Point | null = null;
  let downWorld: Point | null = null;
  let downTime = 0;
  let lastMoveEvent: OverworldPointerEvent | null = null;
  let photoPointerId: number | null = null;
  let photoDownPoint: Point = { x: 0, y: 0 };

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

  const clearPhotoPointer = (): void => {
    photoPointerId = null;
  };

  const release = (): void => {
    if (options.isPhotoMode?.() !== true) photoPointerId = null;
    if (activePointerId === null) return;
    activePointerId = null;
    downPlayer = null;
    downWorld = null;
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
    if (options.isPhotoMode?.() === true) {
      if (
        !(options.isTouchUi?.() ?? false) &&
        event.pointerType !== "touch" &&
        event.button === 0
      ) {
        event.preventDefault();
        photoPointerId = event.pointerId;
        photoDownPoint = { x: event.clientX, y: event.clientY };
      }
      return;
    }
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
    downPlayer = options.playerScreen();
    downWorld = options.playerWorld?.() ?? null;
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
    if (photoPointerId !== null && event.pointerId === photoPointerId) {
      photoPointerId = null;
      const drag = Math.hypot(
        event.clientX - photoDownPoint.x,
        event.clientY - photoDownPoint.y,
      );
      const action = photoModePointerAction({
        photoMode: options.isPhotoMode?.() ?? false,
        touchUiActive: options.isTouchUi?.() ?? false,
        pointerType: event.pointerType,
        button: event.button,
        eventType: "pointerup",
      });
      if (action === "snap" && Number.isFinite(drag) && drag <= DEFAULT_OVERWORLD_TAP_DRAG) {
        options.onPhotoSnap?.();
      }
      return;
    }
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    const upPoint: Point = { x: event.clientX, y: event.clientY };
    const elapsedMs = now() - downTime;
    const canSteerNow = options.canSteer();
    const player = canSteerNow ? options.playerScreen() : null;
    const upWorld = canSteerNow ? (options.playerWorld?.() ?? null) : null;
    const worldTravel =
      downWorld !== null && upWorld !== null
        ? Math.hypot(upWorld.x - downWorld.x, upWorld.y - downWorld.y)
        : 0;
    const nearTap = canSteerNow && isOverworldTap(downPoint, upPoint, elapsedMs, player);
    const groundTap =
      canSteerNow &&
      Number.isFinite(worldTravel) &&
      worldTravel <= DEFAULT_OVERWORLD_TAP_PLAYER_TRAVEL &&
      isOverworldGroundTap(downPoint, upPoint, elapsedMs, downPlayer, player);
    release();
    if (nearTap) options.onTapNearPlayer?.();
    else if (groundTap) options.onTapGround?.(upPoint);
  };

  const onPointerCancel = (event: OverworldPointerEvent): void => {
    if (photoPointerId !== null && event.pointerId === photoPointerId) {
      photoPointerId = null;
    }
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    release();
  };

  const onContextMenu = (event: OverworldPointerEvent): void => {
    const pointerType =
      typeof event.pointerType === "string" && event.pointerType.length > 0
        ? event.pointerType
        : "mouse";
    const action = photoModePointerAction({
      photoMode: options.isPhotoMode?.() ?? false,
      touchUiActive: options.isTouchUi?.() ?? false,
      pointerType,
      button: event.button,
      eventType: "contextmenu",
    });
    if (action === "exit") {
      event.preventDefault();
      photoPointerId = null;
      options.onPhotoExit?.();
    }
  };

  options.canvas.addEventListener("pointerdown", onPointerDown);
  options.canvas.addEventListener("pointermove", onPointerMove);
  options.canvas.addEventListener("pointerup", onPointerUp);
  options.canvas.addEventListener("pointercancel", onPointerCancel);
  options.canvas.addEventListener("lostpointercapture", onPointerCancel);
  options.canvas.addEventListener("contextmenu", onContextMenu);

  if (typeof window !== "undefined") {
    window.addEventListener("blur", () => {
      clearPhotoPointer();
      release();
    });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearPhotoPointer();
        release();
      }
    });
  }

  return { sync, release, isActive };
}
