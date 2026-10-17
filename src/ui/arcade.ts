import "./arcade.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { clawLook, layoutClaw, type ClawLayout, type Line, type Rect } from "./claw-layout";
import type { ArcadeView, ClawCalibration } from "../core";

const svgNamespace = "http://www.w3.org/2000/svg";

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

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className: string,
  parent: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(svgNamespace, tag);
  node.setAttribute("class", className);
  parent.append(node);
  return node;
}

function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function setStyle(node: HTMLElement | SVGElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

function place(node: HTMLElement | SVGElement, rect: Rect): void {
  setStyle(node, "left", `${rect.x}px`);
  setStyle(node, "top", `${rect.y}px`);
  setStyle(node, "width", `${rect.width}px`);
  setStyle(node, "height", `${rect.height}px`);
}

function drawLine(node: SVGLineElement, line: Line): void {
  setAttribute(node, "x1", String(line.x1));
  setAttribute(node, "y1", String(line.y1));
  setAttribute(node, "x2", String(line.x2));
  setAttribute(node, "y2", String(line.y2));
}

function attributes(node: Element, values: Record<string, string | number>): void {
  for (const [name, value] of Object.entries(values)) setAttribute(node, name, String(value));
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// The claw in a 100 x 100 box: its head and collar at the top, three prongs
// whose tips touch the box's bottom edge, spread open or curled shut.
const prongs = {
  spread: [
    "M45 40 Q24 46 16 72 Q12 88 22 97",
    "M50 40 L50 97",
    "M55 40 Q76 46 84 72 Q88 88 78 97",
  ],
  curled: [
    "M45 40 Q32 52 34 74 Q35 90 44 97",
    "M50 40 L50 97",
    "M55 40 Q68 52 66 74 Q65 90 56 97",
  ],
};

type Box = { x: number; y: number; width: number; height: number };
// The close-up as drawn, in CSS px (spec 11, renderInfo().arcade): the claw's
// prong tips, and where each plush stands (its base point) and its box's side.
export type ArcadeInfo = {
  phase: string;
  machine: Box;
  glass: Box;
  plate: Box;
  chute: Box;
  claw: { x: number; y: number; open: boolean };
  plushes: { id: string; x: number; y: number; size: number; held: boolean }[];
};

function measure(node: Element): Box {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

// The claw machine close-up (spec 8.2): the painted cabinet, the heap of plush
// critters inside its glass box, the gantry, and the claw, laid out by
// `layoutClaw` from the painting's calibration. Every frame passes a whole
// view; the DOM changes only when the view or the room for the cabinet does.
export function createArcade(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  calibration: ClawCalibration,
  cabinet: string,
): { render: (view: ArcadeView | null) => void; info: () => ArcadeInfo | null } {
  const overlay = element("section", "arcade-overlay", root);
  overlay.setAttribute("aria-label", "Claw machine");
  overlay.hidden = true;
  const machine = element("div", "arcade-machine", overlay);
  machine.style.backgroundImage = `url("${cabinet}")`;
  const scene = element("div", "arcade-scene", machine);
  const marker = element("div", "arcade-marker", scene);
  const cable = element("div", "arcade-cable", scene);
  const claw = svgElement("svg", "arcade-claw", scene);
  claw.setAttribute("viewBox", "0 0 100 100");
  claw.setAttribute("aria-hidden", "true");
  for (const [state, paths] of Object.entries(prongs)) {
    const group = svgElement("g", `arcade-prongs arcade-prongs-${state}`, claw);
    for (const d of paths) {
      svgElement("path", "arcade-prong-ink", group).setAttribute("d", d);
      svgElement("path", "arcade-prong", group).setAttribute("d", d);
    }
  }
  attributes(svgElement("rect", "arcade-claw-collar", claw),
    { x: 40, y: 28, width: 20, height: 13, rx: 4 });
  attributes(svgElement("circle", "arcade-claw-head", claw), { cx: 50, cy: 17, r: 13 });
  const gantry = svgElement("svg", "arcade-gantry", scene);
  gantry.setAttribute("aria-hidden", "true");
  const railInk = [svgElement("line", "arcade-rail-ink", gantry),
    svgElement("line", "arcade-rail-ink", gantry)];
  const rails = [svgElement("line", "arcade-rail", gantry),
    svgElement("line", "arcade-rail", gantry)];
  const crossbarInk = svgElement("line", "arcade-crossbar-ink", gantry);
  const crossbar = svgElement("line", "arcade-crossbar", gantry);
  const carriage = svgElement("rect", "arcade-carriage", gantry);
  element("div", "arcade-reflections", scene);
  const glass = element("div", "arcade-glass", machine);
  const chute = element("div", "arcade-chute", machine);
  const plate = element("div", "arcade-plate", machine);
  const plateText = element("span", "arcade-plate-text", plate);
  const plushes = new Map<string, HTMLDivElement>();
  let lastKey = "";
  let lastView: ArcadeView | null = null;

  const plush = (id: string, frame: string): HTMLDivElement => {
    const existing = plushes.get(id);
    if (existing !== undefined) return existing;
    const box = element("div", "arcade-plush", scene);
    box.dataset.id = id;
    const image = element("div", "arcade-plush-image", box);
    const crop = art(frame);
    if (crop !== null) applyAtlasCrop(image, crop);
    plushes.set(id, box);
    return box;
  };

  const draw = (view: ArcadeView, layout: ClawLayout): void => {
    setStyle(machine, "width", `${layout.width}px`);
    setStyle(machine, "height", `${layout.height}px`);
    machine.dataset.scale = String(layout.scale);
    const g = layout.glass;
    setStyle(scene, "clip-path", `inset(${g.y}px ${layout.width - g.x - g.width}px ` +
      `${layout.height - g.y - g.height}px ${g.x}px round ${g.radius}px)`);
    place(glass, g);
    place(chute, layout.chute);
    place(plate, layout.plate);
    // The hint (or the machine's name) is lettered on the blank plate: one
    // line for a word, two balanced lines for a hint, as large as fits.
    const text = view.hint ?? "CLAW";
    const lines = text.length > 16 ? 2 : 1;
    const perLine = Math.ceil(text.length / lines);
    const font = Math.floor(Math.min(layout.plate.height * (lines === 1 ? 0.5 : 0.36),
      (layout.plate.width * 0.88) / (perLine * 0.62)));
    setText(plateText, text);
    setStyle(plateText, "font-size", `${font}px`);
    plate.classList.toggle("is-hint", view.hint !== null);

    const seen = new Set<string>();
    for (const item of layout.plushes) {
      seen.add(item.id);
      const box = plush(item.id, item.frame);
      place(box, { x: item.x, y: item.y, width: item.size, height: item.size });
      setStyle(box, "z-index", String(item.layer + 1));
      setStyle(box, "clip-path", item.hidden > 0 ? `inset(0 0 ${item.hidden}px 0)` : "");
      setAttribute(box, "aria-label", item.name);
      box.classList.toggle("is-floor", item.floor);
      box.classList.toggle("is-held", item.held);
      box.classList.toggle("is-tug", item.tug);
    }
    for (const [id, box] of plushes)
      if (!seen.has(id)) {
        box.remove();
        plushes.delete(id);
      }

    marker.hidden = layout.marker === null;
    if (layout.marker !== null) {
      place(marker, layout.marker);
      setStyle(marker, "z-index", String(layout.marker.layer + 1));
    }
    const clawZ = String(layout.claw.layer + 1);
    const size = layout.claw.size;
    place(claw, { x: layout.claw.x - Math.round(size / 2), y: layout.claw.tip - size,
      width: size, height: size });
    setStyle(claw, "z-index", clawZ);
    claw.classList.toggle("is-closed", !layout.claw.open);
    const cableWidth = Math.max(2, Math.round(size * 0.05));
    place(cable, {
      x: layout.cable.x1 - Math.round(cableWidth / 2), y: layout.cable.y1,
      width: cableWidth, height: Math.max(0, layout.cable.y2 - layout.cable.y1),
    });
    setStyle(cable, "z-index", clawZ);

    setAttribute(gantry, "viewBox", `0 0 ${layout.width} ${layout.height}`);
    layout.rails.forEach((line, index) => {
      const ink = railInk[index];
      const rail = rails[index];
      if (ink === undefined || rail === undefined) return;
      drawLine(ink, line);
      drawLine(rail, line);
      setStyle(ink, "stroke-width", `${Math.max(4, layout.bar)}px`);
      setStyle(rail, "stroke-width", `${Math.max(2, layout.bar - 3)}px`);
    });
    drawLine(crossbarInk, layout.crossbar);
    drawLine(crossbar, layout.crossbar);
    setStyle(crossbarInk, "stroke-width", `${layout.bar + 3}px`);
    setStyle(crossbar, "stroke-width", `${layout.bar}px`);
    const c = layout.carriage;
    attributes(carriage,
      { x: c.x, y: c.y, width: c.width, height: c.height, rx: Math.round(c.height / 3) });
  };

  return {
    render: (view) => {
      overlay.hidden = view === null;
      lastView = view;
      if (view === null) {
        lastKey = "";
        return;
      }
      // The cabinet is as large as the overlay's padded box allows (the safe
      // areas, and the touch buttons' column on the right), keeping its shape.
      const style = getComputedStyle(overlay);
      const width = overlay.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = overlay.clientHeight - pixels(style.paddingTop) -
        pixels(style.paddingBottom);
      const key = `${width}x${height} ${JSON.stringify(view)}`;
      if (key === lastKey) return;
      lastKey = key;
      const scale = Math.max(0.01,
        Math.min(width / calibration.size.w, height / calibration.size.h));
      draw(view, layoutClaw(view, calibration, scale));
    },
    info: () => {
      if (lastView === null) return null;
      const tips = measure(claw);
      return {
        phase: lastView.phase,
        machine: measure(machine),
        glass: measure(glass),
        plate: measure(plate),
        chute: measure(chute),
        claw: { x: tips.x + tips.width / 2, y: tips.y + tips.height, open: lastView.claw.open },
        plushes: lastView.plushes.map((item) => {
          const node = plushes.get(item.id);
          const box = node === undefined ? { x: 0, y: 0, width: 0, height: 0 } : measure(node);
          return {
            id: item.id, held: item.held, size: box.width,
            x: box.x + box.width / 2, y: box.y + clawLook.base * box.height,
          };
        }),
      };
    },
  };
}
