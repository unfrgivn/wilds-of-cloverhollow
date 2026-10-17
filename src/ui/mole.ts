import "./mole.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { measure, type Box } from "./claw";
import { layoutMole, moleFrame, type MoleLayout } from "./mole-layout";
import type { MoleCalibration, MoleHole, MoleView } from "../core";

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

function place(node: HTMLElement, rect: { x: number; y: number; width: number; height: number }):
  void {
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
export type MoleInfo = {
  game: "mole";
  phase: string;
  machine: Box;
  plate: Box;
  hud: Box | null;
  // Each hole's centre and the mole in it: its face, and how far its frame's
  // cut bottom is below the hole's near rim (0 when fully risen).
  holes: { hole: MoleHole; x: number; y: number; mole: { face: string; drop: number } | null }[];
  hammer: { x: number; y: number } | null;
  pop: { x: number; y: number; text: string } | null;
  score: string;
};

// A squeaky toy hammer in the sticker style: a red barrel head with yellow
// caps on a yellow handle, its head's centre at (40, 76) of 100.
const hammerMarkup =
  '<path d="M44 66 L86 10" stroke="#47321f" stroke-width="13" stroke-linecap="round"/>' +
  '<path d="M44 66 L86 10" stroke="#f2c94c" stroke-width="8" stroke-linecap="round"/>' +
  '<rect x="14" y="62" width="52" height="28" rx="9" fill="#e86a5c" stroke="#47321f" ' +
  'stroke-width="3"/>' +
  '<rect x="8" y="64" width="10" height="24" rx="4" fill="#f2c94c" stroke="#47321f" ' +
  'stroke-width="3"/>' +
  '<rect x="62" y="64" width="10" height="24" rx="4" fill="#f2c94c" stroke="#47321f" ' +
  'stroke-width="3"/>' +
  '<path d="M24 69 L50 69" stroke="#ffffff" stroke-width="3" stroke-linecap="round" ' +
  'opacity=".7"/>';

// The Boop-a-Mole close-up (spec 8.2): the painted cabinet, a mole rising
// out of its hole (clipped so the near rim hides its waist), the hammer, and
// "Boop!", laid out by `layoutMole` from the painting's calibration. Each hole
// is also a touch target: `onHole` hears it pressed and let go.
export function createMole(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  calibration: MoleCalibration,
  image: string,
  onHole: (hole: MoleHole, down: boolean) => void,
): { render: (view: MoleView | null) => void; info: () => MoleInfo | null } {
  const overlay = element("section", "mole-overlay", root);
  overlay.setAttribute("aria-label", "Boop-a-Mole");
  overlay.hidden = true;
  const machine = element("div", "mole-machine", overlay);
  const paint = element("div", "mole-paint", machine);
  paint.style.backgroundImage = `url("${image}")`;
  const plate = element("div", "mole-plate", machine);
  const plateText = element("span", "mole-plate-text", plate);
  const hud = element("div", "mole-hud", machine);
  const score = element("span", "mole-score", hud);
  const left = element("span", "mole-left", hud);
  type HoleNodes = { hole: MoleHole; box: HTMLDivElement; sprite: HTMLDivElement;
    hit: HTMLButtonElement; key: HTMLSpanElement };
  const holes: HoleNodes[] = (["up", "left", "middle", "right", "down"] as const).map((hole) => {
    const box = element("div", "mole-hole", machine);
    box.dataset.hole = hole;
    const sprite = element("div", "mole-sprite", box);
    const key = element("span", "mole-key", machine);
    key.setAttribute("aria-hidden", "true");
    const hit = element("button", "mole-hit", machine);
    hit.type = "button";
    hit.setAttribute("aria-label", `boop the ${hole} hole`);
    hit.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      hit.setPointerCapture(event.pointerId);
      onHole(hole, true);
    });
    const release = (): void => onHole(hole, false);
    hit.addEventListener("pointerup", release);
    hit.addEventListener("pointercancel", release);
    hit.addEventListener("lostpointercapture", release);
    return { hole, box, sprite, hit, key };
  });
  const hammer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  hammer.setAttribute("class", "mole-hammer");
  hammer.setAttribute("viewBox", "0 0 100 100");
  hammer.setAttribute("aria-hidden", "true");
  hammer.innerHTML = hammerMarkup;
  machine.append(hammer);
  const pop = element("div", "mole-pop", machine);
  pop.textContent = "Boop!";
  let lastKey = "";
  let lastView: MoleView | null = null;
  let lastLayout: MoleLayout | null = null;
  const frames = new Map<string, AtlasImage | null>();
  const frameArt = (name: string): AtlasImage | null => {
    if (!frames.has(name)) frames.set(name, art(name));
    return frames.get(name) ?? null;
  };

  const draw = (view: MoleView, layout: MoleLayout): void => {
    setStyle(machine, "width", `${layout.width}px`);
    setStyle(machine, "height", `${layout.height}px`);
    setStyle(paint, "background-size",
      `${layout.painting.width}px ${layout.painting.height}px`);
    setStyle(paint, "background-position", `0 ${layout.painting.y}px`);
    setStyle(paint, "--fade", `${Math.round(layout.fade * 1000) / 10}%`);
    machine.dataset.scale = String(layout.scale);
    place(plate, layout.plate);
    // The hint (or the game's name) on the marquee, measured once to fit.
    const text = view.hint ?? "BOOP-A-MOLE";
    plate.classList.toggle("is-hint", view.hint !== null);
    setText(plateText, text);
    const tall = Math.floor(layout.plate.height * (text.length > 16 ? 0.36 : 0.5));
    setStyle(plateText, "font-size", `${tall}px`);
    const room = Math.min((plate.clientWidth * 0.92) / Math.max(1, plateText.scrollWidth),
      (plate.clientHeight * 0.92) / Math.max(1, plateText.scrollHeight));
    if (room < 1) setStyle(plateText, "font-size", `${Math.floor(tall * room)}px`);
    setStyle(hud, "left", `${layout.hud.x}px`);
    setStyle(hud, "top", `${layout.hud.y}px`);
    setStyle(hud, "font-size", `${Math.max(14, Math.round(layout.plate.height * 0.3))}px`);
    hud.hidden = view.phase === "result";
    setText(score, `BOOPS ${view.booped}`);
    setText(left, `MOLES ${view.molesLeft}`);
    for (const nodes of holes) {
      const at = layout.holes.find((item) => item.hole === nodes.hole);
      if (at === undefined) continue;
      place(nodes.box, at.box);
      setStyle(nodes.box, "clip-path", `path("${at.clip}")`);
      // The tap target: the opening, at least 48 px each way.
      const width = Math.max(48, 2 * at.rx);
      const height = Math.max(48, 2.6 * at.ry);
      place(nodes.hit, { x: Math.round(at.cx - width / 2), y: Math.round(at.cy - height / 2),
        width: Math.round(width), height: Math.round(height) });
      setStyle(nodes.key, "left", `${at.key.x}px`);
      setStyle(nodes.key, "top", `${at.key.y}px`);
      setText(nodes.key, at.key.label);
      nodes.sprite.hidden = at.mole === null;
      if (at.mole === null) continue;
      const frame = frameArt(`mole-${at.mole.face}`);
      if (frame !== null) applyAtlasCrop(nodes.sprite, frame);
      nodes.sprite.dataset.face = at.mole.face;
      setStyle(nodes.sprite, "transform", `translateY(${at.mole.drop}px)`);
    }
    hammer.classList.toggle("is-hidden", layout.hammer === null);
    if (layout.hammer !== null) {
      const size = layout.hammer.length;
      setStyle(hammer, "left", `${layout.hammer.x - Math.round(size * 0.4)}px`);
      setStyle(hammer, "top", `${layout.hammer.y - Math.round(size * 0.76)}px`);
      setStyle(hammer, "width", `${size}px`);
      setStyle(hammer, "height", `${size}px`);
      setStyle(hammer, "transform", `rotate(${layout.hammer.angle}rad)`);
      setStyle(hammer, "opacity", String(layout.hammer.opacity));
    }
    pop.hidden = layout.pop === null;
    if (layout.pop !== null) {
      setStyle(pop, "left", `${layout.pop.x}px`);
      setStyle(pop, "top", `${layout.pop.y}px`);
    }
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
      const shown = moleFrame(calibration);
      const scale = Math.max(0.01, Math.min(width / shown.w, height / shown.h));
      lastLayout = layoutMole(view, calibration, scale);
      draw(view, lastLayout);
    },
    info: () => {
      if (lastView === null || lastLayout === null) return null;
      const origin = measure(machine);
      const at = (x: number, y: number): { x: number; y: number } =>
        ({ x: origin.x + x, y: origin.y + y });
      const layout = lastLayout;
      return {
        game: "mole",
        phase: lastView.phase,
        machine: origin,
        plate: measure(plate),
        hud: hud.hidden ? null : measure(hud),
        holes: layout.holes.map((item) => ({
          hole: item.hole, ...at(item.cx, item.cy),
          mole: item.mole === null ? null : { face: item.mole.face, drop: item.mole.drop },
        })),
        hammer: layout.hammer === null ? null : at(layout.hammer.x, layout.hammer.y),
        pop: layout.pop === null ? null
          : { ...at(layout.pop.x, layout.pop.y), text: pop.textContent ?? "" },
        score: score.textContent ?? "",
      };
    },
  };
}
