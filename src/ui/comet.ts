import "./comet.css";
import {
  classifyCometPopup,
  createArcadePopupLayer,
  updateArcadeBestBadge,
  type ArcadeRecordBadge,
} from "./arcade-popups";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { adaptHintForInputMode } from "./battle-checks-helpers";
import { element, measure, pixels, place, setStyle, setText, type Box } from "./dom";
import { cometFrame, layoutComet, type CometLayout, type Rect } from "./comet-layout";
import type { HudInputMode } from "./hud-hints";
import { bindPointerHold, resolveCometLaneStep } from "./pointer-hold";
import type { CometCalibration, CometView } from "../core";

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
  onConfirmHold: (held: boolean) => void = () => undefined,
  onLaneStep: (delta: -1 | 1) => void = () => undefined,
): {
  render: (
    view: CometView | null,
    record?: ArcadeRecordBadge | null,
    inputMode?: HudInputMode,
  ) => void;
  info: () => CometInfo | null;
} {
  const overlay = element("section", "comet-overlay", root);
  overlay.setAttribute("aria-label", "Comet Cruise");
  overlay.hidden = true;
  const popups = createArcadePopupLayer(overlay);
  const machine = element("div", "comet-machine", overlay);
  const paint = element("div", "comet-paint", machine);
  paint.style.backgroundImage = `url("${image}")`;
  const marquee = element("div", "comet-marquee", machine);
  const marqueeText = element("span", "comet-marquee-text", marquee);
  const hud = element("div", "comet-hud", machine);
  const bestBadge = element("div", "arcade-best-badge is-left-anchored", machine);
  bestBadge.hidden = true;
  const score = element("span", "comet-score", hud);
  const left = element("span", "comet-left", hud);
  const field = element("div", "comet-field", machine);
  const stars = element("div", "comet-stars", field);
  for (const offset of [0, -100]) {
    const layer = element("div", "comet-star-layer", stars);
    layer.style.top = `${offset}%`;
    for (const twinkle of twinkles) {
      const dot = element("i", "comet-twinkle", layer);
      dot.style.left = `${(twinkle.x * 100).toFixed(2)}%`;
      dot.style.top = `${(twinkle.y * 100).toFixed(2)}%`;
      dot.style.width = `${twinkle.size}px`;
      dot.style.height = `${twinkle.size}px`;
    }
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
  let lastMarqueeKey = "";
  let lastView: CometView | null = null;
  let lastLayout: CometLayout | null = null;
  let lastRecord: ArcadeRecordBadge | null = null;
  let lastInputMode: HudInputMode = "keyboard";
  let prevCaught: number | null = null;
  const confirmHold = bindPointerHold(
    machine,
    (held) => onConfirmHold(held),
    () => !overlay.hidden && (lastView?.phase === "ready" || lastView?.phase === "result"),
  );
  const [leftKey, rightKey] = keys;
  machine.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (overlay.hidden || lastView === null || lastView.phase !== "playing") return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea") !== null
    ) {
      return;
    }
    if (event.target instanceof Node && leftKey !== undefined && leftKey.contains(event.target)) {
      event.preventDefault();
      onLaneStep(-1);
      return;
    }
    if (event.target instanceof Node && rightKey !== undefined && rightKey.contains(event.target)) {
      event.preventDefault();
      onLaneStep(1);
      return;
    }
    const rect = field.getBoundingClientRect();
    const step = resolveCometLaneStep(event.clientX, rect.left, rect.width, lastView.rocket.lane);
    if (step !== 0) {
      event.preventDefault();
      onLaneStep(step);
    }
  });
  const frames = new Map<string, AtlasImage | null>();
  const spriteFrame = new WeakMap<HTMLDivElement, string>();
  const frameArt = (name: string): AtlasImage | null => {
    if (!frames.has(name)) frames.set(name, art(name));
    return frames.get(name) ?? null;
  };
  const drawSprite = (node: HTMLDivElement, at: Rect & { frame: string; opacity: number }):
    void => {
    place(node, at);
    setStyle(node, "opacity", String(at.opacity));
    node.dataset.frame = at.frame;
    if (spriteFrame.get(node) !== at.frame) {
      const frame = frameArt(at.frame);
      if (frame !== null) {
        applyAtlasCrop(node, frame);
        spriteFrame.set(node, at.frame);
      }
    }
  };

  const draw = (
    view: CometView,
    layout: CometLayout,
    record: ArcadeRecordBadge | null,
    inputMode: HudInputMode,
  ): void => {
    setStyle(machine, "width", `${layout.width}px`);
    setStyle(machine, "height", `${layout.height}px`);
    setStyle(paint, "background-size", `${layout.painting.width}px ${layout.painting.height}px`);
    setStyle(paint, "background-position", `0 ${layout.painting.y}px`);
    setStyle(paint, "--fade", `${Math.round(layout.fade * 1000) / 10}%`);
    machine.dataset.scale = String(layout.scale);
    machine.dataset.phase = view.phase;
    place(marquee, layout.marquee);
    // The hint (or the game's name) on the marquee, measured once to fit.
    const text = view.hint === null ? "COMET CRUISE" : adaptHintForInputMode(view.hint, inputMode);
    marquee.classList.toggle("is-hint", view.hint !== null);
    setText(marqueeText, text);
    const marqueeKey = `${text}|${layout.marquee.width}|${layout.marquee.height}`;
    if (marqueeKey !== lastMarqueeKey) {
      lastMarqueeKey = marqueeKey;
      const tall = Math.floor(layout.marquee.height * (text.length > 16 ? 0.3 : 0.42));
      setStyle(marqueeText, "font-size", `${tall}px`);
      const room = Math.min((marquee.clientWidth * 0.92) / Math.max(1, marqueeText.scrollWidth),
        (marquee.clientHeight * 0.92) / Math.max(1, marqueeText.scrollHeight));
      if (room < 1) setStyle(marqueeText, "font-size", `${Math.floor(tall * room)}px`);
    }
    setStyle(hud, "left", `${layout.hud.x}px`);
    setStyle(hud, "top", `${layout.hud.y}px`);
    setStyle(hud, "font-size", `${Math.max(14, Math.round(layout.marquee.height * 0.24))}px`);
    hud.hidden = view.phase === "result";
    setStyle(bestBadge, "left", `${layout.hud.x}px`);
    setStyle(bestBadge, "top", `${layout.hud.y}px`);
    setStyle(
      bestBadge,
      "font-size",
      `${Math.max(12, Math.round(layout.marquee.height * 0.22))}px`,
    );
    updateArcadeBestBadge(bestBadge, view.phase === "result", record);
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
  // The marquee was measured in whatever font was usable, and Nunito swaps in
  // when it loads (spec 7.1): what's shown is drawn again then.
  document.fonts.addEventListener("loadingdone", () => {
    lastMarqueeKey = "";
    if (lastView !== null && lastLayout !== null) {
      draw(lastView, lastLayout, lastRecord, lastInputMode);
    }
  });

  return {
    render: (view, record = null, inputMode = "keyboard") => {
      overlay.hidden = view === null;
      lastView = view;
      lastRecord = record;
      lastInputMode = inputMode;
      if (view === null) {
        confirmHold.release();
        lastKey = "";
        prevCaught = null;
        popups.clear();
        bestBadge.hidden = true;
        return;
      }
      if (view.phase !== "ready" && view.phase !== "result") confirmHold.release();
      const popupSpec = classifyCometPopup(prevCaught, view.caught);
      prevCaught = view.caught;
      if (view.phase === "result") popups.clear();
      else if (popupSpec !== null) popups.spawn(popupSpec);
      const style = getComputedStyle(overlay);
      const width = overlay.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = overlay.clientHeight - pixels(style.paddingTop) -
        pixels(style.paddingBottom);
      const recordKey = record === null ? "" : `${record.best}:${record.isNewBest ? 1 : 0}`;
      const key = `${width}x${height} ${recordKey} ${inputMode} ${JSON.stringify(view)}`;
      if (key === lastKey) return;
      lastKey = key;
      const shown = cometFrame(calibration);
      const scale = Math.max(0.01, Math.min(width / shown.w, height / shown.h));
      lastLayout = layoutComet(view, calibration, scale, inputMode);
      draw(view, lastLayout, record, inputMode);
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
