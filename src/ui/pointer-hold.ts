import type { Point } from "../core";
import type { BattleCheckView } from "./battle-checks";

const INTERACTIVE_SELECTOR = "button, a, input, textarea";

export type PointerHoldEvent = {
  pointerId: number;
  pointerType: string;
  button: number;
  target: EventTarget | null;
  preventDefault: () => void;
};

export type PointerHoldTarget = {
  addEventListener: (
    type: "pointerdown" | "pointerup" | "pointercancel" | "lostpointercapture",
    listener: (event: PointerHoldEvent) => void,
  ) => void;
  setPointerCapture?: (pointerId: number) => void;
};

export type PointerMoveHoldEvent = PointerHoldEvent & {
  clientX: number;
  clientY: number;
};

export type PointerMoveHoldTarget = {
  addEventListener: (
    type:
      | "pointerdown"
      | "pointermove"
      | "pointerup"
      | "pointercancel"
      | "lostpointercapture",
    listener: (event: PointerMoveHoldEvent) => void,
  ) => void;
  setPointerCapture?: (pointerId: number) => void;
};

/**
 * Returns true for battle timing checks driven by confirm press/hold
 * (`ring`, `charge`, `chain`, `peekaboo`), and false for directional/trace/echo
 * checks or absent views.
 */
export function isConfirmCheckKind(
  kind: BattleCheckView["kind"] | null | undefined,
): boolean {
  return (
    kind === "ring" ||
    kind === "charge" ||
    kind === "chain" ||
    kind === "peekaboo"
  );
}

/**
 * Returns true for battle timing checks driven by directional press/hold
 * (`catch`, `lean`), and false for confirm, trace, echo, or absent views.
 */
export function isDirectionalCheckKind(
  kind: BattleCheckView["kind"] | null | undefined,
): boolean {
  return kind === "catch" || kind === "lean";
}

/**
 * Maps a pointer Y coordinate across `[laneTop, laneBottom]` onto the catch
 * check's hold vector (`{ x: 0, y: -1 }` high, `{ x: 0, y: 0 }` middle,
 * `{ x: 0, y: 1 }` low), matching `laneFromStick` in `src/core/checks.ts`.
 */
export function resolveCatchDirection(
  pointerY: number,
  laneTop: number,
  laneBottom: number,
  laneCount = 3,
): Point {
  if (laneBottom <= laneTop || laneCount <= 1) return { x: 0, y: 0 };
  const ratio = (pointerY - laneTop) / (laneBottom - laneTop);
  const targetLane = Math.max(0, Math.min(laneCount - 1, Math.floor(ratio * laneCount)));
  const centerLane = Math.floor(laneCount / 2);
  if (targetLane < centerLane) return { x: 0, y: -1 };
  if (targetLane > centerLane) return { x: 0, y: 1 };
  return { x: 0, y: 0 };
}

/**
 * Maps a pointer X coordinate relative to the lean track centre:
 * left of centre leans back (`-1`), at or right of centre leans forward (`1`).
 */
export function resolveLeanDirection(pointerX: number, trackCenterX: number): Point {
  return pointerX < trackCenterX ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

/**
 * Divides Comet Cruise's playfield into 3 equal horizontal lanes (`0`, `1`, `2`)
 * and returns the single-lane step (`-1`, `0`, or `1`) toward the clicked lane.
 */
export function resolveCometLaneStep(
  pointerX: number,
  fieldLeft: number,
  fieldWidth: number,
  rocketLane: number,
): -1 | 0 | 1 {
  if (fieldWidth <= 0) return 0;
  const ratio = (pointerX - fieldLeft) / fieldWidth;
  const targetLane = Math.max(0, Math.min(2, Math.floor(ratio * 3)));
  if (targetLane < rocketLane) return -1;
  if (targetLane > rocketLane) return 1;
  return 0;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (target === null) return false;
  if (typeof Element !== "undefined") {
    return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
  }
  if (
    typeof target === "object" &&
    "closest" in target &&
    typeof target.closest === "function"
  ) {
    return target.closest(INTERACTIVE_SELECTOR) !== null;
  }
  return false;
}

/**
 * Sticky-proof pointer press-and-hold helper: tracks one active `pointerId`,
 * ignores secondary mouse buttons and interactive controls, captures pointer
 * events cleanly, and releases idempotently on pointer end, lost capture,
 * window blur, or manual `release()`.
 */
export function bindPointerHold(
  target: PointerHoldTarget,
  onHold: (held: boolean) => void,
  canStart: () => boolean,
): { release: () => void } {
  let activePointerId: number | null = null;

  const release = (): void => {
    if (activePointerId === null) return;
    activePointerId = null;
    onHold(false);
  };

  const onPointerDown = (event: PointerHoldEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;
    if (activePointerId !== null || !canStart()) return;
    event.preventDefault();
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic or detached pointer events may reject capture; window listeners still release.
    }
    activePointerId = event.pointerId;
    onHold(true);
  };

  const onPointerEnd = (event: PointerHoldEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    release();
  };

  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointerup", onPointerEnd);
  target.addEventListener("pointercancel", onPointerEnd);
  target.addEventListener("lostpointercapture", onPointerEnd);

  if (typeof window !== "undefined") {
    window.addEventListener("blur", release);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }

  return { release };
}

/**
 * Sticky-proof directional pointer press/move/hold helper: tracks one active
 * `pointerId` and last pointer coordinates, ignores secondary mouse buttons and
 * interactive controls, refreshes on demand while held, and releases
 * idempotently to `{ x: 0, y: 0 }` on pointer end, lost capture, window blur,
 * or programmatic `release()`.
 */
export function bindPointerMoveHold(
  target: PointerMoveHoldTarget,
  onDirection: (dir: Point) => void,
  resolve: (clientX: number, clientY: number) => Point,
  canStart: () => boolean,
): { release: () => void; refresh: () => void } {
  let activePointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let lastMoveEvent: PointerMoveHoldEvent | null = null;

  const release = (): void => {
    if (activePointerId === null) return;
    activePointerId = null;
    lastMoveEvent = null;
    onDirection({ x: 0, y: 0 });
  };

  const refresh = (): void => {
    if (activePointerId === null) return;
    onDirection(resolve(lastX, lastY));
  };

  const onPointerDown = (event: PointerMoveHoldEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;
    if (activePointerId !== null || !canStart()) return;
    event.preventDefault();
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic or detached pointer events may reject capture; window listeners still release.
    }
    activePointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveEvent = null;
    onDirection(resolve(lastX, lastY));
  };

  const onPointerMove = (event: PointerMoveHoldEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    if (event === lastMoveEvent) return;
    lastMoveEvent = event;
    lastX = event.clientX;
    lastY = event.clientY;
    onDirection(resolve(lastX, lastY));
  };

  const onPointerEnd = (event: PointerMoveHoldEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    release();
  };

  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointermove", onPointerMove);
  target.addEventListener("pointerup", onPointerEnd);
  target.addEventListener("pointercancel", onPointerEnd);
  target.addEventListener("lostpointercapture", onPointerEnd);

  if (typeof window !== "undefined") {
    window.addEventListener("blur", release);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }

  return { release, refresh };
}
