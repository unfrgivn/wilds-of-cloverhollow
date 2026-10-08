import { blankInput, type ActionFrame } from "../core";
import type { Point } from "../core";

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
    choose: touch.choose,
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
    };
    this.clearTaps();
    return result;
  }
}

export class GamepadInput {
  private readonly latch = new GamepadLatch();
  private readonly getPads: () => readonly StandardGamepad[];

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

  poll(): void {
    this.latch.update(gamepadFrame(this.getPads()));
  }

  frame(): ActionFrame {
    return this.latch.frame();
  }

  clearTaps(): void {
    this.latch.clearTaps();
  }
}
