import "./cook.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { measure, type Box } from "./claw";
import { cookFront, layoutCook, type CookLayout } from "./cook-layout";
import type { CookCalibration, CookView } from "../core";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: Element,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}

function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setStyle(node: HTMLElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

function place(node: HTMLElement, rect: Box): void {
  setStyle(node, "left", `${rect.x}px`);
  setStyle(node, "top", `${rect.y}px`);
  setStyle(node, "width", `${rect.width}px`);
  setStyle(node, "height", `${rect.height}px`);
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// The close-up as drawn (spec 11, renderInfo().arcade), in CSS px.
export type CookInfo = {
  game: "cook";
  phase: string;
  machine: Box;
  glass: Box;
  food: Box;
  display: string;
  front: string;
  // How the food is drawn: its frost's opacity, how dark it is, the light in
  // the door, and how many puffs (smoke, once it's burnt) rise from it.
  frost: number;
  darkness: number;
  light: boolean;
  wisps: number;
  smoke: boolean;
};

// The clubhouse microwave's close-up (spec 8.2): the painted microwave on the
// fridge, Mom's dish on its turntable behind the glass, and the timer, the
// button, and the hint drawn over it by `layoutCook` from the painting's
// calibration. How the food looks comes from the view alone.
export function createCook(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  calibration: CookCalibration,
  image: string,
): { render: (view: CookView | null) => void; info: () => CookInfo | null } {
  const overlay = element("section", "cook-overlay", root);
  overlay.setAttribute("aria-label", "The clubhouse microwave");
  overlay.hidden = true;
  const machine = element("div", "cook-machine", overlay);
  machine.style.backgroundImage = `url("${image}")`;
  const glass = element("div", "cook-glass", machine);
  const food = element("div", "cook-food", glass);
  const frost = element("div", "cook-frost", glass);
  const light = element("div", "cook-light", glass);
  const wisps: HTMLDivElement[] = [];
  element("div", "cook-sheen", glass);
  const display = element("div", "cook-display", machine);
  const button = element("div", "cook-button", machine);
  const front = element("div", "cook-front", machine);
  const frontText = element("span", "cook-front-text", front);
  let lastKey = "";
  let lastView: CookView | null = null;
  let lastLayout: CookLayout | null = null;
  let lastDish = "";

  const draw = (view: CookView, layout: CookLayout): void => {
    place(machine, { x: 0, y: 0, width: layout.width, height: layout.height });
    machine.dataset.scale = String(layout.scale);
    place(glass, layout.glass);
    setStyle(glass, "border-radius", `${layout.glass.radius}px`);
    if (view.dish !== lastDish) {
      const dish = art(view.dish);
      if (dish !== null) {
        applyAtlasCrop(food, dish);
        applyAtlasCrop(frost, dish);
      }
      lastDish = view.dish;
    }
    place(food, layout.food);
    place(frost, layout.food);
    // Darker and browner as it overcooks: a deep brown at burnt.
    const dark = view.darkness;
    setStyle(food, "filter", dark === 0 ? "none"
      : `brightness(${(1 - 0.62 * dark).toFixed(3)}) sepia(${(0.35 * dark).toFixed(3)})`);
    setStyle(frost, "opacity", (view.frost * 0.7).toFixed(3));
    light.classList.toggle("is-on", view.cooking);
    while (wisps.length < layout.wisps.length) wisps.push(element("div", "cook-wisp", glass));
    wisps.forEach((wisp, index) => {
      const puff = layout.wisps[index];
      wisp.hidden = puff === undefined;
      if (puff === undefined) return;
      place(wisp, { x: puff.x, y: puff.y, width: puff.size, height: puff.size });
      setStyle(wisp, "opacity", String(puff.opacity));
      wisp.classList.toggle("is-smoke", view.smoke);
    });
    place(display, layout.display);
    setStyle(display, "font-size", `${Math.max(10, Math.round(layout.display.height * 0.62))}px`);
    setText(display, view.display);
    const size = layout.button.radius * 2;
    place(button, { x: layout.button.x - layout.button.radius,
      y: layout.button.y - layout.button.radius, width: size, height: size });
    button.classList.toggle("is-held", view.cooking);
    // The hint as large as fits the fridge's front: sized from its height, then
    // measured once and shrunk if it runs over.
    place(front, layout.front);
    const text = cookFront(view);
    setText(frontText, text);
    const tall = Math.max(10, Math.floor(layout.front.height * 0.42));
    setStyle(frontText, "font-size", `${tall}px`);
    const room = (front.clientWidth * 0.94) / Math.max(1, frontText.scrollWidth);
    if (room < 1) setStyle(frontText, "font-size", `${Math.max(9, Math.floor(tall * room))}px`);
    front.hidden = view.phase === "result";
  };
  // The front was measured in whatever font was usable, and Nunito swaps in
  // when it loads (spec 7.1): what's shown is drawn again then.
  document.fonts.addEventListener("loadingdone", () => {
    if (lastView !== null && lastLayout !== null) draw(lastView, lastLayout);
  });

  return {
    render: (view) => {
      overlay.hidden = view === null;
      lastView = view;
      if (view === null) {
        lastKey = "";
        return;
      }
      const style = getComputedStyle(overlay);
      const width = overlay.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = overlay.clientHeight - pixels(style.paddingTop) -
        pixels(style.paddingBottom);
      const key = `${width}x${height} ${JSON.stringify(view)}`;
      if (key === lastKey) return;
      lastKey = key;
      const scale = Math.max(0.01,
        Math.min(width / calibration.size.w, height / calibration.size.h));
      lastLayout = layoutCook(view, calibration, scale);
      draw(view, lastLayout);
    },
    info: () => {
      if (lastView === null || lastLayout === null) return null;
      return {
        game: "cook",
        phase: lastView.phase,
        machine: measure(machine),
        glass: measure(glass),
        food: measure(food),
        display: display.textContent ?? "",
        front: front.hidden ? "" : frontText.textContent ?? "",
        frost: Number.parseFloat(frost.style.opacity || "0"),
        darkness: lastView.darkness,
        light: light.classList.contains("is-on"),
        wisps: lastLayout.wisps.length,
        smoke: lastView.smoke,
      };
    },
  };
}
