import "./comet.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { measure, type Box } from "./claw";
import { cometFrame, layoutComet, type CometLayout, type Rect } from "./comet-layout";
import type { CometCalibration, CometView } from "../core";

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

function setStyle(node: HTMLElement | SVGElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

function place(node: HTMLElement, rect: Rect): void {
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
export type CometInfo = {
  game: "comet";
  phase: string;
  machine: Box;
  field: Box;
  marquee: Box;
  hud: Box | null;
  // The rocket's and each one's centre, frame, and opacity, as laid out.
  rocket: { x: number; y: number; frame: string };
  objects: { kind: string; x: number; y: number; frame: string; opacity: number }[];
  // The keys' caps that show (none on touch).
  keys: Box[];
  score: string;
};

// The screen's night: tiny stars at fixed places (shares of the field), so a
// screenshot is the same every time.
const twinkles = Array.from({ length: 30 }, (_, index) => ({
  x: (0.137 + index * 0.6180339887) % 1,
  y: (0.071 + index * 0.7548776662) % 1,
  size: index % 3 === 0 ? 3 : 2,
}));

const svg = "http://www.w3.org/2000/svg";

// The Comet Cruise close-up (spec 8.2): the painted teal cabinet, the run drawn
// on its screen (the night, the lanes, the rocket, and the stars and rocks
// coming down), laid out by `layoutComet` from the painting's calibration.
// With a keyboard, caps letter ← and → beside the screen; on touch, the arrow
// stickers (touch-controls) steer.
export function createComet(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  calibration: CometCalibration,
  image: string,
): { render: (view: CometView | null) => void; info: () => CometInfo | null } {
  const overlay = element("section", "comet-overlay", root);
  overlay.setAttribute("aria-label", "Comet Cruise");
  overlay.hidden = true;
  const machine = element("div", "comet-machine", overlay);
  const paint = element("div", "comet-paint", machine);
  paint.style.backgroundImage = `url("${image}")`;
  const marquee = element("div", "comet-marquee", machine);
  const marqueeText = element("span", "comet-marquee-text", marquee);
  const hud = element("div", "comet-hud", machine);
  const score = element("span", "comet-score", hud);
  const left = element("span", "comet-left", hud);
  const field = element("div", "comet-field", machine);
  for (const twinkle of twinkles) {
    const dot = element("i", "comet-twinkle", field);
    dot.style.left = `${(twinkle.x * 100).toFixed(2)}%`;
    dot.style.top = `${(twinkle.y * 100).toFixed(2)}%`;
    dot.style.width = `${twinkle.size}px`;
    dot.style.height = `${twinkle.size}px`;
  }
  const lines = document.createElementNS(svg, "svg");
  lines.setAttribute("class", "comet-lines");
  lines.setAttribute("aria-hidden", "true");
  const strokes = [0, 1].map(() => {
    const line = document.createElementNS(svg, "line");
    lines.append(line);
    return line;
  });
  field.append(lines);
  // Sprites: the ones on the screen (as many as are out at once), then the
  // rocket over them.
  const sprites: HTMLDivElement[] = [];
  const rocket = element("div", "comet-sprite comet-rocket", field);
  const keys = (["left", "right"] as const).map((side) => {
    const key = element("span", `comet-key is-${side}`, machine);
    key.setAttribute("aria-hidden", "true");
    return key;
  });
  let lastKey = "";
  let lastView: CometView | null = null;
  let lastLayout: CometLayout | null = null;
  const frames = new Map<string, AtlasImage | null>();
  const frameArt = (name: string): AtlasImage | null => {
    if (!frames.has(name)) frames.set(name, art(name));
    return frames.get(name) ?? null;
  };
  const drawSprite = (node: HTMLDivElement, at: Rect & { frame: string; opacity: number }):
    void => {
    place(node, at);
    setStyle(node, "opacity", String(at.opacity));
    node.dataset.frame = at.frame;
    const frame = frameArt(at.frame);
    if (frame !== null) applyAtlasCrop(node, frame);
  };

  const draw = (view: CometView, layout: CometLayout): void => {
    setStyle(machine, "width", `${layout.width}px`);
    setStyle(machine, "height", `${layout.height}px`);
    setStyle(paint, "background-size", `${layout.painting.width}px ${layout.painting.height}px`);
    setStyle(paint, "background-position", `0 ${layout.painting.y}px`);
    setStyle(paint, "--fade", `${Math.round(layout.fade * 1000) / 10}%`);
    machine.dataset.scale = String(layout.scale);
    machine.dataset.phase = view.phase;
    place(marquee, layout.marquee);
    // The hint (or the game's name) on the marquee, measured once to fit.
    const text = view.hint ?? "COMET CRUISE";
    marquee.classList.toggle("is-hint", view.hint !== null);
    setText(marqueeText, text);
    const tall = Math.floor(layout.marquee.height * (text.length > 16 ? 0.3 : 0.42));
    setStyle(marqueeText, "font-size", `${tall}px`);
    const room = Math.min((marquee.clientWidth * 0.92) / Math.max(1, marqueeText.scrollWidth),
      (marquee.clientHeight * 0.92) / Math.max(1, marqueeText.scrollHeight));
    if (room < 1) setStyle(marqueeText, "font-size", `${Math.floor(tall * room)}px`);
    setStyle(hud, "left", `${layout.hud.x}px`);
    setStyle(hud, "top", `${layout.hud.y}px`);
    setStyle(hud, "font-size", `${Math.max(14, Math.round(layout.marquee.height * 0.24))}px`);
    hud.hidden = view.phase === "result";
    setText(score, `STARS ${view.caught}`);
    setText(left, `LEFT ${view.left}`);
    place(field, layout.field);
    lines.setAttribute("viewBox", `0 0 ${layout.field.width} ${layout.field.height}`);
    strokes.forEach((stroke, index) => {
      const at = layout.lines[index];
      if (at === undefined) return;
      stroke.setAttribute("x1", String(at.x1));
      stroke.setAttribute("y1", String(at.y1));
      stroke.setAttribute("x2", String(at.x2));
      stroke.setAttribute("y2", String(at.y2));
    });
    while (sprites.length < layout.objects.length)
      sprites.push(element("div", "comet-sprite comet-object", field));
    // The rocket stays on top of whatever is on the screen.
    field.append(rocket);
    sprites.forEach((node, index) => {
      const at = layout.objects[index];
      node.hidden = at === undefined;
      if (at === undefined) return;
      node.dataset.kind = at.kind;
      drawSprite(node, at);
    });
    drawSprite(rocket, layout.rocket);
    keys.forEach((node, index) => {
      const at = layout.keys[index];
      if (at === undefined) return;
      setStyle(node, "left", `${at.x}px`);
      setStyle(node, "top", `${at.y}px`);
      setText(node, at.label);
    });
  };

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
      const shown = cometFrame(calibration);
      const scale = Math.max(0.01, Math.min(width / shown.w, height / shown.h));
      lastLayout = layoutComet(view, calibration, scale);
      draw(view, lastLayout);
    },
    info: () => {
      if (lastView === null || lastLayout === null) return null;
      const origin = measure(machine);
      const layout = lastLayout;
      const inField = (rect: Rect): { x: number; y: number } => ({
        x: origin.x + layout.field.x + rect.x + rect.width / 2,
        y: origin.y + layout.field.y + rect.y + rect.height / 2,
      });
      return {
        game: "comet",
        phase: lastView.phase,
        machine: origin,
        field: measure(field),
        marquee: measure(marquee),
        hud: hud.hidden ? null : measure(hud),
        rocket: { ...inField(layout.rocket), frame: layout.rocket.frame },
        objects: layout.objects.map((item) => ({
          kind: item.kind, ...inField(item), frame: item.frame, opacity: item.opacity,
        })),
        keys: keys.filter((node) => node.offsetParent !== null).map(measure),
        score: score.textContent ?? "",
      };
    },
  };
}
