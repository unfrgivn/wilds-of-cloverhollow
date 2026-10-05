import { Capacitor } from "@capacitor/core";
import { blankInput, type ActionFrame, type Point } from "../core";
import { stickVector } from "./stick";

const RADIUS = 56;
const BUTTONS = ["confirm", "cancel", "menu"] as const;
type Button = (typeof BUTTONS)[number];

export class TouchInput {
  private readonly buttons = new Set<Button>();
  private readonly tapped = new Set<Button>();
  private stickId: number | undefined;
  private origin: Point | undefined;
  private move: Point = { x: 0, y: 0 };

  frame(): ActionFrame {
    return {
      ...blankInput(),
      move: this.move,
      confirm: this.hasButton("confirm"),
      cancel: this.hasButton("cancel"),
      menu: this.hasButton("menu"),
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

  setButton(button: Button, pressed: boolean): void {
    if (pressed) this.buttons.add(button);
    else this.buttons.delete(button);
  }

  sample(): ActionFrame {
    const frame = this.frame();
    this.tapped.clear();
    return frame;
  }

  tapButton(button: Button): void {
    this.tapped.add(button);
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
