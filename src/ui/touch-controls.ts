import { shouldShowTouchControls, TouchInput } from "../platform/touch";
import "./touch-controls.css";

const STICK_RADIUS = 56;
const BUTTONS = [
  ["confirm", "✓"],
  ["cancel", "×"],
  ["menu", "☰"],
  ["lantern", "✦"],
] as const;
type Button = (typeof BUTTONS)[number][0];

// The concept's JOURNAL sticker: an open book with a quill.
function journalIcon(): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.setAttribute("viewBox", "0 0 32 32");
  icon.setAttribute("aria-hidden", "true");
  const parts: [string, string][] = [
    ["journal-icon-page", "M16 10 C12 7.5 7.5 7.5 4 9 V26 C7.5 24.5 12 24.5 16 27 Z"],
    ["journal-icon-page", "M16 10 C20 7.5 24.5 7.5 28 9 V26 C24.5 24.5 20 24.5 16 27 Z"],
    ["journal-icon-line", "M7 13.5 H13 M7 17 H13 M7 20.5 H12"],
    ["journal-icon-quill", "M19.5 22 C22 15 25.5 8.5 30 4 C30.5 9.5 27 16.5 21 21 Z"],
    ["journal-icon-line", "M19.5 22 L26 11"],
  ];
  for (const [className, shape] of parts) {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("class", className);
    path.setAttribute("d", shape);
    icon.append(path);
  }
  return icon;
}

export function mountTouchControls(): TouchInput {
  const input = new TouchInput();
  if (!shouldShowTouchControls()) return input;
  // CSS reserves room for the buttons from this flag (touch-controls.css).
  document.documentElement.dataset.touch = "on";
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
    element.setAttribute("aria-label", button);
    if (button === "menu") {
      element.setAttribute("aria-label", "journal");
      element.append(journalIcon());
    } else if (button === "lantern") {
      element.textContent = "";
      element.hidden = true;
      element.setAttribute("aria-label", "lantern");
      element.classList.add("touch-lantern");
    } else {
      element.textContent = label;
    }
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
