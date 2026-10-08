import { blankInput, type ActionFrame } from "../core";

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Enter",
  "KeyZ",
  "KeyX",
  "Escape",
  "KeyJ",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyL",
  "KeyM",
]);

/**
 * Samples the keyboard once per tick. A key pressed since the previous sample
 * counts as held for that sample, so a tap whose keydown and keyup both land
 * between two ticks still registers for exactly one tick.
 */
export class Keyboard {
  private readonly held = new Set<string>();
  private readonly tapped = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (event) => {
      this.held.add(event.code);
      this.tapped.add(event.code);
      if (GAME_KEYS.has(event.code)) event.preventDefault();
    });
    window.addEventListener("keyup", (event) => this.held.delete(event.code));
    window.addEventListener("blur", () => {
      this.held.clear();
      this.tapped.clear();
    });
  }

  /** Forgets taps that have not been sampled yet (used when the game resets). */
  clearTaps(): void {
    this.tapped.clear();
  }

  frame(): ActionFrame {
    const has = (code: string): boolean =>
      this.held.has(code) || this.tapped.has(code);
    const frame: ActionFrame = {
      ...blankInput(),
      move: {
        x:
          Number(has("ArrowRight") || has("KeyD")) -
          Number(has("ArrowLeft") || has("KeyA")),
        y:
          Number(has("ArrowDown") || has("KeyS")) -
          Number(has("ArrowUp") || has("KeyW")),
      },
      confirm: has("KeyZ") || has("Space") || has("Enter"),
      cancel: has("KeyX") || has("Escape"),
      menu: has("KeyJ"),
      lantern: has("KeyL"),
    };
    this.tapped.clear();
    return frame;
  }
}
