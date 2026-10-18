import { Capacitor } from "@capacitor/core";
import { blankInput, type ActionFrame, type Point } from "../core";
import { stickVector } from "./stick";

const RADIUS = 56;
const BUTTONS = ["confirm", "cancel", "menu", "lantern", "flute"] as const;
type Button = (typeof BUTTONS)[number];
export type TraceRect = { x: number; y: number; width: number; height: number };

/** Maps a CSS pointer position into the check's authored 0..1000 square. */
export function tracePointer(point: Point, rect: TraceRect): Point {
  const clamp = (value: number): number => Math.max(0, Math.min(1000, value));
  return {
    x: Math.round(clamp((point.x - rect.x) / rect.width * 1000)),
    y: Math.round(clamp((point.y - rect.y) / rect.height * 1000)),
  };
}

export class TouchInput {
  setTraceElement: (rect: TraceRect | undefined) => void = () => undefined;
  private readonly buttons = new Set<Button>();
  private readonly tapped = new Set<Button>();
  private choice: number | undefined;
  private stickId: number | undefined;
  private origin: Point | undefined;
  private move: Point = { x: 0, y: 0 };
  // A check's arrow sticker while one is held (a catch's up or down, a
  // lean's back or forward, a Boop-a-Mole hole), as a step along one axis;
  // the stick is hidden in battle and in the arcade, so the two never fight.
  private arrow: Point = { x: 0, y: 0 };
  // An arrow tapped since the last sample: like a tapped button, it counts
  // for the next frame even if let go before it.
  private arrowTap: Point | undefined;
  private traceId: number | undefined;
  private traceRect: TraceRect | undefined;
  private tracePoint: Point | undefined;
  private traceTap: Point | undefined;

  frame(): ActionFrame {
    const arrowHeld = this.arrow.x !== 0 || this.arrow.y !== 0;
    const arrow = arrowHeld ? this.arrow : this.arrowTap;
    return {
      ...blankInput(),
      move: this.stickId === undefined && arrow !== undefined ? arrow : this.move,
      pointer: this.traceId === undefined ? this.traceTap : this.tracePoint,
      confirm: this.hasButton("confirm"),
      cancel: this.hasButton("cancel"),
      menu: this.hasButton("menu"),
      lantern: this.hasButton("lantern"),
      flute: this.hasButton("flute"),
      choose: this.choice,
    };
  }

  private hasButton(button: Button): boolean {
    return this.buttons.has(button) || this.tapped.has(button);
  }

  beginStick(event: PointerEvent): void {
    if (this.stickId !== undefined || event.clientX > window.innerWidth * 0.45) return;
    this.stickId = event.pointerId;
    this.origin = { x: event.clientX, y: event.clientY };
    this.move = { x: 0, y: 0 };
  }

  moveStick(event: PointerEvent): void {
    if (event.pointerId !== this.stickId || this.origin === undefined) return;
    this.move = stickVector(this.origin, { x: event.clientX, y: event.clientY }, RADIUS);
  }

  endStick(event: PointerEvent): void {
    if (event.pointerId !== this.stickId) return;
    this.stickId = undefined;
    this.origin = undefined;
    this.move = { x: 0, y: 0 };
  }

  setTraceRect(rect: TraceRect | undefined): void { this.traceRect = rect; }
  beginTrace(event: PointerEvent): void {
    if (this.traceId !== undefined || this.traceRect === undefined) return;
    this.traceId = event.pointerId;
    this.traceTap = undefined;
    this.tracePoint = tracePointer({ x: event.clientX, y: event.clientY }, this.traceRect);
  }
  moveTrace(event: PointerEvent): void {
    if (event.pointerId !== this.traceId || this.traceRect === undefined) return;
    this.tracePoint = tracePointer({ x: event.clientX, y: event.clientY }, this.traceRect);
  }
  endTrace(event: PointerEvent): void {
    if (event.pointerId !== this.traceId) return;
    this.traceTap = this.tracePoint;
    this.traceId = undefined;
    this.tracePoint = undefined;
  }

  setButton(button: Button, pressed: boolean): void {
    if (pressed) this.buttons.add(button);
    else this.buttons.delete(button);
  }

  sample(): ActionFrame {
    const frame = this.frame();
    this.tapped.clear();
    this.arrowTap = undefined;
    this.traceTap = undefined;
    this.choice = undefined;
    return frame;
  }

  tapButton(button: Button): void {
    this.tapped.add(button);
  }

  tapChoice(index: number): void {
    this.choice = index;
  }

  /** Holds a check's arrow: a step along one axis, like the stick's. */
  holdArrow(direction: Point): void {
    this.arrow = { x: Math.sign(direction.x), y: Math.sign(direction.y) };
  }

  /** Taps an arrow: it counts for the next frame however quickly it's let go. */
  tapArrow(direction: Point): void {
    this.arrowTap = { x: Math.sign(direction.x), y: Math.sign(direction.y) };
  }

  /** Lets go of an arrow, unless another finger has since held a different one. A
   * tap of it still counts for the next frame. */
  releaseArrow(direction: Point): void {
    if (this.arrow.x === Math.sign(direction.x) && this.arrow.y === Math.sign(direction.y))
      this.arrow = { x: 0, y: 0 };
  }

  /** Lets go of every arrow, taps included, as the shell does outside a catch, a lean,
   * or a round of Boop-a-Mole or Comet Cruise. */
  releaseArrows(): void {
    this.arrow = { x: 0, y: 0 };
    this.arrowTap = undefined;
  }
}

function touchForced(): boolean | undefined {
  const value = new URLSearchParams(window.location.search).get("touch");
  return value === "1" ? true : value === "0" ? false : undefined;
}

export function shouldShowTouchControls(): boolean {
  const forced = touchForced();
  if (forced !== undefined) return forced;
  return Capacitor.isNativePlatform() || window.matchMedia("(pointer: coarse)").matches;
}
