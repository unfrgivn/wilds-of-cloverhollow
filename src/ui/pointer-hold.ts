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
