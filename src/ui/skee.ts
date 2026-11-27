import "./skee.css";
import {
  classifySkeePopup,
  createArcadePopupLayer,
  updateArcadeBestBadge,
  type ArcadeRecordBadge,
} from "./arcade-popups";
import {
  element, measure, pixels, place, setAttribute, setStyle, setText, svgElement, type Box,
} from "./dom";
import { bindPointerHold } from "./pointer-hold";
import { layoutSkee, skeeFrame, type SkeeLayout, type Target } from "./skee-layout";
import type { SkeeCalibration, SkeeView } from "../core";

function attributes(node: Element, values: Record<string, string | number>): void {
  for (const [name, value] of Object.entries(values)) setAttribute(node, name, String(value));
}

// The close-up as drawn (spec 11, renderInfo().arcade), in CSS px.
export type SkeeInfo = {
  game: "skee";
  phase: string;
  machine: Box;
  // The part of the painting shown.
  frame: Box;
  board: Box;
  plate: Box;
  hud: Box;
  arrow: { x: number; y: number; set: boolean } | null;
  ghost: { x: number; y: number; over: boolean } | null;
  ball: { x: number; y: number; radius: number } | null;
  // The target lit by a ball in its hole: its points, and which corner.
  lit: { points: number; side: -1 | 0 | 1 } | null;
  pop: { x: number; y: number; text: string } | null;
  score: string;
};

// One drawn target: its collar and, for the holes, the dark mouth inside.
type TargetNodes = { collar: SVGEllipseElement; label: SVGTextElement };

// The skee-ball close-up (spec 8.2): the painted lane and its board, with the
// rings, the arrow, the ghost of the meter, and the ball drawn over it by
// `layoutSkee` from the painting's calibration. Like the claw machine, the DOM
// changes only when the view or the room for the cabinet does.
export function createSkee(
  root: HTMLElement,
  calibration: SkeeCalibration,
  image: string,
  onConfirmHold: (held: boolean) => void = () => undefined,
): {
  render: (view: SkeeView | null, record?: ArcadeRecordBadge | null) => void;
  info: () => SkeeInfo | null;
} {
  const overlay = element("section", "skee-overlay", root);
  overlay.setAttribute("aria-label", "Skee-ball");
  overlay.hidden = true;
  const pointerHold = bindPointerHold(
    overlay,
    (held) => onConfirmHold(held),
    () => !overlay.hidden,
  );
  const popups = createArcadePopupLayer(overlay);
  // The close-up shows part of the painting (`skeeFrame`): a frame that clips
  // it, holding the whole painting moved so that part shows.
  const frame = element("div", "skee-frame", overlay);
  const machine = element("div", "skee-machine", frame);
  machine.style.backgroundImage = `url("${image}")`;
  const target = svgElement("svg", "skee-target", machine);
  target.setAttribute("aria-hidden", "true");
  const board = element("div", "skee-board", machine);
  const plate = element("div", "skee-plate", machine);
  const plateText = element("span", "skee-plate-text", plate);
  const hud = element("div", "skee-hud", machine);
  const bestBadge = element("div", "arcade-best-badge", machine);
  bestBadge.hidden = true;
  const score = element("span", "skee-score", hud);
  const balls = element("span", "skee-balls", hud);
  balls.setAttribute("aria-label", "balls left");
  const arrow = svgElement("svg", "skee-arrow", machine);
  arrow.setAttribute("viewBox", "0 0 40 100");
  arrow.setAttribute("aria-hidden", "true");
  svgElement("path", "skee-arrow-shape", arrow)
    .setAttribute("d", "M20 2 L37 34 L26 34 L26 98 L14 98 L14 34 L3 34 Z");
  const ghost = element("div", "skee-ghost", machine);
  const ball = element("div", "skee-ball", machine);
  const pop = element("div", "skee-pop", machine);
  const rings: TargetNodes[] = [];
  const corners: TargetNodes[] = [];
  const floor = svgElement("text", "skee-label skee-floor", target);
  let lastKey = "";
  let lastPlateKey = "";
  let lastView: SkeeView | null = null;
  let lastLayout: SkeeLayout | null = null;
  let lastRecord: ArcadeRecordBadge | null = null;
  let prevScore: number | null = null;

  const targetNodes = (list: TargetNodes[], count: number, className: string): void => {
    while (list.length < count)
      list.push({
        collar: svgElement("ellipse", `skee-collar ${className}`, target),
        label: svgElement("text", "skee-label", target),
      });
  };
  // A target's collar, its points lettered at the top of its band (or, for a
  // hole, just above it), and its glow when lit.
  const drawTarget = (nodes: TargetNodes, item: Target, labelY: number, band: number): void => {
    attributes(nodes.collar, { cx: item.cx, cy: item.cy, rx: item.rx, ry: item.ry });
    nodes.collar.classList.toggle("is-lit", item.lit);
    attributes(nodes.label, { x: item.cx, y: labelY });
    setStyle(nodes.label, "font-size", `${Math.max(9, Math.round(band))}px`);
    setText(nodes.label, String(item.points));
    nodes.label.classList.toggle("is-lit", item.lit);
  };

  const draw = (
    view: SkeeView,
    layout: SkeeLayout,
    record: ArcadeRecordBadge | null,
  ): void => {
    setStyle(frame, "width", `${layout.frame.width}px`);
    setStyle(frame, "height", `${layout.frame.height}px`);
    setStyle(machine, "left", `${-layout.frame.x}px`);
    setStyle(machine, "top", `${-layout.frame.y}px`);
    setStyle(machine, "width", `${layout.width}px`);
    setStyle(machine, "height", `${layout.height}px`);
    machine.dataset.scale = String(layout.scale);
    attributes(target, { viewBox: `0 0 ${layout.width} ${layout.height}` });
    place(board, layout.board);
    place(plate, layout.plate);
    // The hint (or the game's name) lettered on the marquee: one line for the
    // name, two balanced lines for a hint, as large as fits. Sized from the
    // plate's height first, then measured once and shrunk if it runs over.
    const text = view.hint ?? "SKEE-BALL";
    const lines = view.hint === null ? 1 : text.length > 16 ? 2 : 1;
    plate.classList.toggle("is-hint", view.hint !== null);
    setText(plateText, text);
    const plateKey = `${text}|${layout.plate.width}|${layout.plate.height}`;
    if (plateKey !== lastPlateKey) {
      lastPlateKey = plateKey;
      const tall = Math.floor(layout.plate.height * (lines === 1 ? 0.5 : 0.36));
      setStyle(plateText, "font-size", `${tall}px`);
      const room = Math.min((plate.clientWidth * 0.92) / Math.max(1, plateText.scrollWidth),
        (plate.clientHeight * 0.92) / Math.max(1, plateText.scrollHeight));
      if (room < 1) setStyle(plateText, "font-size", `${Math.floor(tall * room)}px`);
    }
    setStyle(hud, "left", `${layout.hud.x}px`);
    setStyle(hud, "top", `${layout.hud.y}px`);
    // As large as the marquee's lettering allows, never under 14 px.
    setStyle(hud, "font-size", `${Math.max(14, Math.round(layout.plate.height * 0.3))}px`);
    hud.hidden = view.phase === "result";
    setStyle(bestBadge, "left", `${layout.hud.x}px`);
    setStyle(bestBadge, "top", `${layout.hud.y}px`);
    setStyle(bestBadge, "font-size", `${Math.max(11, Math.round(layout.plate.height * 0.24))}px`);
    updateArcadeBestBadge(bestBadge, view.phase === "result", record);
    setText(score, `SCORE ${view.score}`);
    // A dot a ball: filled for those still to roll.
    setText(balls, "●".repeat(view.ballsLeft) + "○".repeat(view.balls - view.ballsLeft));

    // The rings from the outside in; each band's number at its top.
    targetNodes(rings, layout.rings.length, "skee-ring");
    layout.rings.forEach((item, index) => {
      const nodes = rings[index];
      if (nodes === undefined) return;
      const inner = layout.rings[index + 1];
      const band = item.ry - (inner?.ry ?? 0);
      drawTarget(nodes, item, item.cy - item.ry + band * 0.62, band * 0.55);
      nodes.collar.classList.toggle("is-hole", inner === undefined);
    });
    targetNodes(corners, layout.corners.length, "skee-corner is-hole");
    layout.corners.forEach((item, index) => {
      const nodes = corners[index];
      if (nodes !== undefined)
        drawTarget(nodes, item, item.cy - item.ry - item.ry * 0.25, item.ry * 0.7);
    });
    attributes(floor, { x: layout.floor.x, y: layout.floor.y - 4 });
    setText(floor, String(layout.floor.points));
    floor.classList.toggle("is-lit", layout.floor.lit);
    setStyle(floor, "font-size", `${Math.max(9, Math.round(layout.board.height * 0.07))}px`);

    arrow.classList.toggle("is-hidden", layout.arrow === null);
    if (layout.arrow !== null) {
      const width = Math.round(layout.arrow.length * 0.4);
      setStyle(arrow, "left", `${layout.arrow.x - Math.round(width / 2)}px`);
      setStyle(arrow, "top", `${layout.arrow.y - layout.arrow.length}px`);
      setStyle(arrow, "width", `${width}px`);
      setStyle(arrow, "height", `${layout.arrow.length}px`);
      setStyle(arrow, "transform", `rotate(${layout.arrow.angle}rad)`);
      arrow.classList.toggle("is-set", layout.arrow.set);
    }
    ghost.hidden = layout.ghost === null;
    if (layout.ghost !== null) {
      const size = layout.ghost.radius * 2;
      place(ghost, { x: layout.ghost.x - layout.ghost.radius,
        y: layout.ghost.y - layout.ghost.radius, width: size, height: size });
      ghost.classList.toggle("is-over", layout.ghost.over);
    }
    ball.hidden = layout.ball === null;
    ball.classList.toggle("is-hopping", view.phase === "hopping");
    if (layout.ball !== null) {
      const size = layout.ball.radius * 2;
      place(ball, { x: layout.ball.x - layout.ball.radius,
        y: layout.ball.y - layout.ball.radius, width: size, height: size });
    }
    pop.hidden = layout.pop === null;
    if (layout.pop !== null) {
      setStyle(pop, "left", `${layout.pop.x}px`);
      setStyle(pop, "top", `${layout.pop.y}px`);
      setText(pop, `+${layout.pop.points}`);
    }
  };
  // The marquee was measured in whatever font was usable, and Nunito swaps in
  // when it loads (spec 7.1): what's shown is drawn again then.
  document.fonts.addEventListener("loadingdone", () => {
    lastPlateKey = "";
    if (lastView !== null && lastLayout !== null) draw(lastView, lastLayout, lastRecord);
  });

  return {
    render: (view, record = null) => {
      overlay.hidden = view === null;
      lastView = view;
      lastRecord = record;
      if (view === null) {
        pointerHold.release();
        lastKey = "";
        prevScore = null;
        popups.clear();
        bestBadge.hidden = true;
        return;
      }
      const popupSpec = classifySkeePopup(prevScore, view.score);
      prevScore = view.score;
      if (view.phase === "result") popups.clear();
      else if (popupSpec !== null) popups.spawn(popupSpec);
      const style = getComputedStyle(overlay);
      const width = overlay.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = overlay.clientHeight - pixels(style.paddingTop) -
        pixels(style.paddingBottom);
      const recordKey = record === null ? "" : `${record.best}:${record.isNewBest ? 1 : 0}`;
      const key = `${width}x${height} ${recordKey} ${JSON.stringify(view)}`;
      if (key === lastKey) return;
      lastKey = key;
      const shown = skeeFrame(calibration);
      const scale = Math.max(0.01, Math.min(width / shown.w, height / shown.h));
      lastLayout = layoutSkee(view, calibration, scale);
      draw(view, lastLayout, record);
    },
    info: () => {
      if (lastView === null || lastLayout === null) return null;
      const origin = measure(machine);
      const at = (x: number, y: number): { x: number; y: number } =>
        ({ x: origin.x + x, y: origin.y + y });
      const layout = lastLayout;
      const litRing = layout.rings.find((item) => item.lit);
      const litCorner = layout.corners.findIndex((item) => item.lit);
      return {
        game: "skee",
        phase: lastView.phase,
        machine: origin,
        frame: measure(frame),
        board: measure(board),
        plate: measure(plate),
        hud: measure(hud),
        arrow: layout.arrow === null ? null
          : { ...at(layout.arrow.x, layout.arrow.y), set: layout.arrow.set },
        ghost: layout.ghost === null ? null
          : { ...at(layout.ghost.x, layout.ghost.y), over: layout.ghost.over },
        ball: layout.ball === null ? null
          : { ...at(layout.ball.x, layout.ball.y), radius: layout.ball.radius },
        lit: litCorner >= 0 ? { points: lastView.corners.points, side: litCorner === 0 ? -1 : 1 }
          : litRing !== undefined ? { points: litRing.points, side: 0 }
            : layout.floor.lit ? { points: layout.floor.points, side: 0 } : null,
        pop: layout.pop === null ? null
          : { ...at(layout.pop.x, layout.pop.y), text: pop.textContent ?? "" },
        score: score.textContent ?? "",
      };
    },
  };
}
