import { shouldShowTouchControls, TouchInput } from "../platform/touch";
import "./touch-controls.css";

const STICK_RADIUS = 56;
const BUTTONS = [
  ["confirm", "✓"],
  ["cancel", "×"],
  ["menu", "☰"],
] as const;
type Button = (typeof BUTTONS)[number][0];

export function mountTouchControls(): TouchInput {
  const input = new TouchInput();
  if (!shouldShowTouchControls()) return input;
  const root = document.createElement("div");
  root.className = "touch-controls";
  root.style.setProperty("--stick-radius", `${STICK_RADIUS}px`);
  root.setAttribute("aria-label", "Touch controls");
  const stick = document.createElement("div");
  stick.className = "touch-stick";
  root.append(stick);
  const buttons = document.createElement("div");
  buttons.className = "touch-buttons";
  root.append(buttons);

  const releaseButton = (button: Button): (() => void) =>
    (): void => input.setButton(button, false);
  const createButton = (button: Button, label: string): void => {
    const element = document.createElement("button");
    element.className = `touch-button touch-${button}`;
    element.type = "button";
    element.textContent = label;
    element.setAttribute("aria-label", button);
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      input.setButton(button, true);
      input.tapButton(button);
    });
    const release = releaseButton(button);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    (button === "menu" ? root : buttons).append(element);
  };
  for (const [button, label] of BUTTONS) createButton(button, label);

  const releaseStick = (event: PointerEvent): void => {
    input.endStick(event);
    stick.style.removeProperty("left");
    stick.style.removeProperty("top");
    stick.style.removeProperty("bottom");
  };
  root.addEventListener("pointerdown", (event) => {
    if (event.target === root || event.target === stick) {
      input.beginStick(event);
      stick.style.left = `${event.clientX - STICK_RADIUS}px`;
      stick.style.top = `${event.clientY - STICK_RADIUS}px`;
      stick.style.bottom = "auto";
    }
  });
  root.addEventListener("pointermove", (event) => input.moveStick(event));
  root.addEventListener("pointerup", releaseStick);
  root.addEventListener("pointercancel", releaseStick);
  document.body.append(root);
  return input;
}
