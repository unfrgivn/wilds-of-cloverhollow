import { blankInput, type ActionFrame } from "../core";
import type { Point } from "../core";
import type { JournalNavDirection } from "../ui/journal-nav";

export type StandardGamepad = {
  mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
};

function pressed(pad: StandardGamepad, index: number): boolean {
  const button = pad.buttons[index];
  return button !== undefined && (button.pressed || button.value >= 0.5);
}

function stick(axes: readonly number[], deadZone = 0.25): Point {
  const x = axes[0] ?? 0;
  const y = axes[1] ?? 0;
  const distance = Math.sqrt(x * x + y * y);
  if (distance <= deadZone) return { x: 0, y: 0 };
  const magnitude = Math.min((distance - deadZone) / (1 - deadZone), 1);
  return { x: (x / distance) * magnitude, y: (y / distance) * magnitude };
}

function padFrame(pad: StandardGamepad): ActionFrame {
  const dpad = {
    x: Number(pressed(pad, 15)) - Number(pressed(pad, 14)),
    y: Number(pressed(pad, 13)) - Number(pressed(pad, 12)),
  };
  const stickMove = stick(pad.axes);
  const move = dpad.x !== 0 || dpad.y !== 0 ? dpad : stickMove;
  return {
    ...blankInput(),
    move,
    confirm: pressed(pad, 0),
    cancel: pressed(pad, 1),
    menu: pressed(pad, 3) || pressed(pad, 9),
    ...(pressed(pad, 2) ? { lantern: true } : {}),
    ...(pressed(pad, 4) ? { lasso: true } : {}),
    ...(pressed(pad, 5) ? { flute: true } : {}),
    ...(pressed(pad, 1) || pressed(pad, 7) ? { dash: true } : {}),
  };
}

export function gamepadFrame(pads: readonly StandardGamepad[]): ActionFrame {
  const frame = blankInput();
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    const next = padFrame(pad);
    if (frame.move.x === 0 && frame.move.y === 0 && (next.move.x !== 0 || next.move.y !== 0))
      frame.move = next.move;
    frame.confirm ||= next.confirm;
    frame.cancel ||= next.cancel;
    frame.menu ||= next.menu;
    if (next.lantern) frame.lantern = true;
    if (next.flute) frame.flute = true;
    if (next.lasso) frame.lasso = true;
    if (next.dash) frame.dash = true;
  }
  return frame;
}

export function combineInputFrames(
  keyboard: ActionFrame,
  touch: ActionFrame,
  gamepad: ActionFrame,
): ActionFrame {
  const move = touch.move.x !== 0 || touch.move.y !== 0 ? touch.move :
    keyboard.move.x !== 0 || keyboard.move.y !== 0 ? keyboard.move : gamepad.move;
  return {
    ...blankInput(),
    move,
    confirm: keyboard.confirm || touch.confirm || gamepad.confirm,
    cancel: keyboard.cancel || touch.cancel || gamepad.cancel,
    menu: keyboard.menu || touch.menu || gamepad.menu,
    // Only while pressed: recorded frames omit it, and a frame from real keys
    // must match the recorded one exactly (spec 3.2).
    ...(keyboard.lantern || touch.lantern || gamepad.lantern ? { lantern: true } : {}),
    ...(keyboard.flute || touch.flute || gamepad.flute ? { flute: true } : {}),
    ...(keyboard.lasso || touch.lasso || gamepad.lasso ? { lasso: true } : {}),
    ...(keyboard.dash || touch.dash || gamepad.dash ? { dash: true } : {}),
    choose: touch.choose,
    // A finger on a trace (spec 3.2): only touch has one, and only while down.
    ...(touch.pointer === undefined ? {} : { pointer: touch.pointer }),
  };
}

export class GamepadLatch {
  private current: ActionFrame = blankInput();
  private tapped: ActionFrame = blankInput();

  update(frame: ActionFrame): void {
    this.tapped.confirm ||= frame.confirm;
    this.tapped.cancel ||= frame.cancel;
    this.tapped.menu ||= frame.menu;
    if (frame.lantern) this.tapped.lantern = true;
    if (frame.flute) this.tapped.flute = true;
    if (frame.lasso) this.tapped.lasso = true;
    if (frame.dash) this.tapped.dash = true;
    this.current = frame;
  }

  clearTaps(): void {
    this.tapped = blankInput();
  }

  frame(): ActionFrame {
    const result: ActionFrame = {
      ...this.current,
      confirm: this.current.confirm || this.tapped.confirm,
      cancel: this.current.cancel || this.tapped.cancel,
      menu: this.current.menu || this.tapped.menu,
      ...(this.current.lantern || this.tapped.lantern ? { lantern: true } : {}),
      ...(this.current.flute || this.tapped.flute ? { flute: true } : {}),
      ...(this.current.lasso || this.tapped.lasso ? { lasso: true } : {}),
      ...(this.current.dash || this.tapped.dash ? { dash: true } : {}),
    };
    this.clearTaps();
    return result;
  }
}

export function gamepadBumpers(
  pads: readonly StandardGamepad[],
): { left: boolean; right: boolean } {
  let left = false;
  let right = false;
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    if (pressed(pad, 4)) left = true;
    if (pressed(pad, 5)) right = true;
  }
  return { left, right };
}

export function gamepadSelectPressed(pads: readonly StandardGamepad[]): boolean {
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    if (pressed(pad, 8)) return true;
  }
  return false;
}

export function gamepadPhotoButtons(
  pads: readonly StandardGamepad[],
): { toggle: boolean; snap: boolean; exit: boolean } {
  let toggle = false;
  let snap = false;
  let exit = false;
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    if (pressed(pad, 8)) toggle = true;
    if (pressed(pad, 0)) snap = true;
    if (pressed(pad, 1)) exit = true;
  }
  return { toggle, snap, exit };
}

export function gamepadRightStickY(pads: readonly StandardGamepad[]): number {
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    const y = pad.axes[3] ?? 0;
    if (Math.abs(y) > 0.25) return y;
  }
  return 0;
}

export function gamepadNavDirection(
  pads: readonly StandardGamepad[],
): JournalNavDirection | null {
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    const dpadY = Number(pressed(pad, 13)) - Number(pressed(pad, 12));
    const dpadX = Number(pressed(pad, 15)) - Number(pressed(pad, 14));
    if (dpadY < 0) return "up";
    if (dpadY > 0) return "down";
    if (dpadX < 0) return "left";
    if (dpadX > 0) return "right";
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (Math.abs(y) >= Math.abs(x) && Math.abs(y) > 0.55) {
      return y < 0 ? "up" : "down";
    }
    if (Math.abs(x) > 0.55) {
      return x < 0 ? "left" : "right";
    }
  }
  return null;
}

export function gamepadHasActivity(pads: readonly StandardGamepad[]): boolean {
  for (const pad of pads) {
    if (pad.mapping !== "standard") continue;
    const move = stick(pad.axes);
    if (move.x !== 0 || move.y !== 0) return true;
    if (Math.abs(pad.axes[3] ?? 0) > 0.25) return true;
    for (let index = 0; index < 16; index += 1) {
      if (pressed(pad, index)) return true;
    }
  }
  return false;
}

export class GamepadInput {
  private readonly latch = new GamepadLatch();
  private readonly getPads: () => readonly StandardGamepad[];
  private prevBumperLeft = false;
  private prevBumperRight = false;
  private pendingBumperStep: -1 | 0 | 1 = 0;
  private prevPhotoToggle = false;
  private prevPhotoSnap = false;
  private prevPhotoExit = false;
  private pendingPhotoAction: "toggle" | "snap" | "exit" | null = null;
  private prevNavDirection: JournalNavDirection | null = null;
  private pendingNavStep: JournalNavDirection | null = null;
  private prevConfirm = false;
  private pendingConfirmEdge = false;
  private latestRightStickY = 0;
  private pendingActivity = false;

  constructor(getPads: () => readonly StandardGamepad[] = () => {
    const pads = navigator.getGamepads();
    return Array.from(pads).flatMap((pad) =>
      pad === null
        ? []
        : [{ mapping: pad.mapping, buttons: pad.buttons, axes: pad.axes }],
    );
  }) {
    this.getPads = getPads;
    window.addEventListener("blur", () => this.clearTaps());
  }

  poll(): readonly StandardGamepad[] {
    const pads = this.getPads();
    this.latch.update(gamepadFrame(pads));
    const bumpers = gamepadBumpers(pads);
    if (bumpers.left && !this.prevBumperLeft) this.pendingBumperStep = -1;
    else if (bumpers.right && !this.prevBumperRight) this.pendingBumperStep = 1;
    this.prevBumperLeft = bumpers.left;
    this.prevBumperRight = bumpers.right;
    const photo = gamepadPhotoButtons(pads);
    if (photo.toggle && !this.prevPhotoToggle) this.pendingPhotoAction = "toggle";
    else if (photo.snap && !this.prevPhotoSnap) this.pendingPhotoAction = "snap";
    else if (photo.exit && !this.prevPhotoExit) this.pendingPhotoAction = "exit";
    this.prevPhotoToggle = photo.toggle;
    this.prevPhotoSnap = photo.snap;
    this.prevPhotoExit = photo.exit;
    const navDir = gamepadNavDirection(pads);
    if (navDir !== null && navDir !== this.prevNavDirection) {
      this.pendingNavStep = navDir;
    }
    this.prevNavDirection = navDir;
    const confirmDown = pads.some((pad) => pad.mapping === "standard" && pressed(pad, 0));
    if (confirmDown && !this.prevConfirm) {
      this.pendingConfirmEdge = true;
    }
    this.prevConfirm = confirmDown;
    this.latestRightStickY = gamepadRightStickY(pads);
    if (gamepadHasActivity(pads)) this.pendingActivity = true;
    return pads;
  }

  consumeBumperStep(): -1 | 0 | 1 {
    const step = this.pendingBumperStep;
    this.pendingBumperStep = 0;
    return step;
  }

  consumePhotoAction(): "toggle" | "snap" | "exit" | null {
    const action = this.pendingPhotoAction;
    this.pendingPhotoAction = null;
    return action;
  }

  consumeNavStep(): JournalNavDirection | null {
    const step = this.pendingNavStep;
    this.pendingNavStep = null;
    return step;
  }

  consumeConfirmEdge(): boolean {
    const edge = this.pendingConfirmEdge;
    this.pendingConfirmEdge = false;
    return edge;
  }

  rightStickY(): number {
    return this.latestRightStickY;
  }

  consumeActivity(): boolean {
    const active = this.pendingActivity;
    this.pendingActivity = false;
    return active;
  }

  frame(): ActionFrame {
    return this.latch.frame();
  }

  clearTaps(): void {
    this.latch.clearTaps();
    this.pendingBumperStep = 0;
    this.pendingPhotoAction = null;
    this.pendingNavStep = null;
    this.pendingConfirmEdge = false;
    this.latestRightStickY = 0;
    this.pendingActivity = false;
  }
}
