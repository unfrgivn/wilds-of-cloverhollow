import "./battle.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { feelingMarkup, heartMarkup, icon } from "./icons";
import type { BattleTalk, FeelingId } from "../core";
import type { DialogueView } from "./sticker";

/** Project battle Talk's core dialogue state onto the shared sticker dialogue. */
export function battleTalkDialogueView(talk: BattleTalk): DialogueView {
  const complete = talk.revealed >= talk.text.length;
  return {
    speaker: talk.speaker,
    text: talk.text,
    revealed: talk.revealed,
    choices: complete ? talk.choices.map((text) => ({ text })) : [],
    selected: talk.selected,
    canAdvance: complete && talk.choices.length === 0,
  };
}

/**
 * While a Talk question's answers are on screen the HUD steps aside (spec
 * 8.1): on a phone the band between it and the dialogue box is too short for
 * three 44 px answers, and the meter only moves once an answer is picked.
 */
export function talkChoicesShown(talk: BattleTalk | null): boolean {
  return talk !== null && talk.choices.length > 0 && talk.revealed >= talk.text.length;
}

export type BattleHudView = {
  visible: boolean;
  energy: number;
  energyMax: number;
  /** 0..1 */
  calm: number;
  critterName: string;
};

export type BattleCommand = {
  id: string;
  label: string;
  detail: string | null;
  disabled: boolean;
  // The feeling this command answers this turn, shown as a badge.
  feeling: FeelingId | null;
};

export type CommandMenuView = {
  visible: boolean;
  commands: BattleCommand[];
  selected: number;
};

// What the critter feels (spec 8.1): this turn's, with its label; the next
// turn's; the turn after's once the lantern has peeked; whether this turn's
// choice answered it; and where its cloud floats.
export type FeelingBubbleView = {
  now: { id: FeelingId; label: string } | null;
  next: FeelingId | null;
  later: FeelingId | null;
  answered: boolean;
  // Where the cloud's top centre would like to be, in CSS px; CSS keeps it
  // below the HUD.
  x: number;
  y: number;
} | null;

export type TimingGrade = "great" | "good" | "miss";

export type BattleCheckView =
  | {
      kind: "ring";
      x: number;
      y: number;
      radius: number;
      progress: number;
      target: number;
      grade: TimingGrade | null;
      hint: string | null;
      // The top centre of the hint sticker.
      hintAt: { x: number; y: number };
    }
  | {
      kind: "charge";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: number;
      great: [number, number];
      good: [number, number];
      grade: TimingGrade | null;
      hint: string | null;
      // The top centre of the hint sticker.
      hintAt: { x: number; y: number };
    }
  | {
      kind: "chain";
      from: { x: number; y: number };
      to: { x: number; y: number };
      radius: number;
      beats: {
        appeared: boolean;
        progress: number;
        result: "pending" | "hit" | "miss";
      }[];
      look: "pinecone" | "bubble" | "dust";
      grade: TimingGrade | null;
      hint: string | null;
      // The top centre of the hint sticker.
      hintAt: { x: number; y: number };
    }
  | {
      kind: "catch";
      // The three lanes' heights, high to low.
      lanes: [number, number, number];
      fromX: number;
      catcherX: number;
      radius: number;
      // The lane the catch is in now.
      catcher: number;
      toys: {
        appeared: boolean;
        progress: number;
        lane: number;
        result: "pending" | "hit" | "miss";
        // The toy's crop and its size in CSS px; null if the atlas isn't in.
        image: AtlasImage | null;
        width: number;
        height: number;
      }[];
      grade: TimingGrade | null;
      hint: string | null;
      // The top centre of the hint sticker.
      hintAt: { x: number; y: number };
    }
  | {
      kind: "lean";
      // The balance track's centre and size, and Fae's balance on it: -1
      // blown over backward (left), 1 leaned over forward (right).
      track: { x: number; y: number; width: number; height: number };
      balance: number;
      // Where each swoosh sets out, one height per row, and its length.
      wind: { x: number; rows: number[]; length: number };
      puffs: {
        blowing: boolean;
        progress: number;
        // How hard it pushes next to Fae's lean, 0..1.
        force: number;
        result: "pending" | "hit" | "miss";
      }[];
      grade: TimingGrade | null;
      hint: string | null;
      // The top centre of the hint sticker.
      hintAt: { x: number; y: number };
    }
  | {
      kind: "trace";
      rect: { x: number; y: number; width: number; height: number };
      brush: { x: number; y: number };
      points: { x: number; y: number }[];
      checkpoint: number;
      dry: number;
      results: ("pending" | "hit" | "miss")[];
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    };

/** The complete check overlay, kept in one fixed DOM layer above the scene. */
export function createBattleCheck(root: HTMLElement): {
  render: (view: BattleCheckView | null) => void;
} {
  const ring = svgElement("svg", "battle-ring");
  ring.setAttribute("aria-hidden", "true");
  const rim = svgElement("circle", "battle-ring-rim");
  const ink = svgElement("circle", "battle-ring-ink");
  const target = svgElement("circle", "battle-ring-target");
  ring.append(rim, ink, target);
  const meter = element("div", "battle-charge-meter");
  const fill = element("div", "battle-charge-fill");
  const goodBand = element("div", "battle-charge-good");
  const greatBand = element("div", "battle-charge-great");
  const tick = element("div", "battle-charge-tick");
  meter.append(fill, goodBand, greatBand, tick);
  const chain = element("div", "battle-chain");
  const chainTarget = element("div", "battle-chain-target");
  const beats = element("div", "battle-chain-beats");
  chain.append(chainTarget, beats);
  // A catch: three lane dots, the catch circle, and the toys in flight.
  const catchLayer = element("div", "battle-catch");
  const laneDots = [0, 1, 2].map(() => element("span", "battle-catch-lane"));
  const catcher = element("div", "battle-catch-ring");
  const toys = element("div", "battle-catch-toys");
  catchLayer.append(...laneDots, catcher, toys);
  // A lean: swooshes blowing in at Fae, the balance track with the star on
  // it, and a dot per puff above the track.
  const leanLayer = element("div", "battle-lean");
  const swooshes = [0, 1, 2, 3].map(() => swooshIcon());
  const track = element("div", "battle-lean-track");
  const star = starIcon();
  const puffDots = element("div", "battle-lean-puffs");
  leanLayer.append(...swooshes, track, star, puffDots);
  const traceLayer = element("div", "battle-trace");
  const traceSvg = svgElement("svg", "battle-trace-svg");
  const tracePath = svgElement("path", "battle-trace-path");
  const tracePaint = svgElement("path", "battle-trace-paint");
  // The paint goes over the purple scribble: Fae paints it back.
  traceSvg.append(tracePath, tracePaint);
  const traceDots = element("div", "battle-trace-dots");
  const traceBrush = element("div", "battle-trace-brush");
  const traceDry = element("div", "battle-trace-dry");
  traceLayer.append(traceSvg, traceDots, traceBrush, traceDry);
  const hint = element("div", "battle-check-hint");
  const grade = element("div", "battle-grade");
  grade.setAttribute("role", "status");
  grade.hidden = true;
  root.append(ring, meter, chain, catchLayer, leanLayer, traceLayer, hint, grade);
  const icons: HTMLElement[] = [];
  const toyNodes: { node: HTMLElement; src: string }[] = [];
  const dotNodes: HTMLElement[] = [];
  let iconLook: "pinecone" | "bubble" | "dust" | null = null;
  const hide = (node: HTMLElement | SVGSVGElement, hidden: boolean): void => {
    node.style.display = hidden ? "none" : "";
  };
  return {
    render: (view) => {
      hide(ring, view?.kind !== "ring");
      hide(meter, view?.kind !== "charge");
      hide(chain, view?.kind !== "chain");
      hide(catchLayer, view?.kind !== "catch");
      hide(leanLayer, view?.kind !== "lean");
      hide(traceLayer, view?.kind !== "trace");
      hide(hint, view?.hint === null || view === null);
      if (view === null) {
        grade.hidden = true;
        return;
      }
      if (view.hint !== null) {
        setText(hint, view.hint);
        hint.style.left = `${view.hintAt.x}px`;
        hint.style.top = `${view.hintAt.y}px`;
      }
      if (view.kind === "ring") {
        const size = view.radius * 2;
        setAttribute(ring, "width", String(size));
        setAttribute(ring, "height", String(size));
        setAttribute(ring, "viewBox", `0 0 ${size} ${size}`);
        ring.style.left = `${view.x}px`;
        ring.style.top = `${view.y}px`;
        const c = String(view.radius);
        for (const node of [rim, ink, target]) {
          setAttribute(node, "cx", c);
          setAttribute(node, "cy", c);
        }
        const r = view.radius * (1 - clamp01(view.progress));
        setAttribute(rim, "r", String(r));
        setAttribute(ink, "r", String(r));
        setAttribute(
          target,
          "r",
          String(view.radius * (1 - clamp01(view.target))),
        );
        renderGrade(
          grade,
          view.grade,
          view.x,
          view.y - view.radius * (1 - view.target) - gradeGap,
        );
      } else if (view.kind === "charge") {
        meter.style.left = `${view.x}px`;
        meter.style.top = `${view.y}px`;
        meter.style.width = `${view.width}px`;
        meter.style.height = `${view.height}px`;
        fill.style.height = `${clamp01(view.fill) * 100}%`;
        goodBand.style.bottom = `${view.good[0] * 100}%`;
        goodBand.style.height = `${(view.good[1] - view.good[0]) * 100}%`;
        greatBand.style.bottom = `${view.great[0] * 100}%`;
        greatBand.style.height = `${(view.great[1] - view.great[0]) * 100}%`;
        tick.style.bottom = `${view.great[0] * 100}%`;
        renderGrade(
          grade,
          view.grade,
          view.x + view.width / 2,
          view.y - gradeGap,
        );
      } else if (view.kind === "catch") {
        const laneY = (lane: number): number => view.lanes[lane] ?? view.lanes[1];
        laneDots.forEach((dot, lane) => {
          dot.style.left = `${view.catcherX}px`;
          dot.style.top = `${laneY(lane)}px`;
        });
        catcher.style.left = `${view.catcherX}px`;
        catcher.style.top = `${laneY(view.catcher)}px`;
        catcher.style.width = `${view.radius * 2}px`;
        catcher.style.height = `${view.radius * 2}px`;
        while (toyNodes.length < view.toys.length) {
          const node = element("span", "battle-catch-toy");
          node.setAttribute("aria-hidden", "true");
          toys.append(node);
          toyNodes.push({ node, src: "" });
        }
        toyNodes.forEach((item, index) => {
          const toy = view.toys[index];
          item.node.hidden = toy === undefined || !toy.appeared || toy.image === null;
          if (toy === undefined || toy.image === null) return;
          // A new battle's toys may be another critter's: crop only on change.
          const key = `${toy.image.src}#${toy.image.frame.x},${toy.image.frame.y}`;
          if (item.src !== key) {
            applyAtlasCrop(item.node, toy.image);
            item.src = key;
          }
          item.node.classList.toggle("is-hit", toy.result === "hit");
          item.node.classList.toggle("is-miss", toy.result === "miss");
          item.node.style.width = `${toy.width}px`;
          item.node.style.height = `${toy.height}px`;
          const p = clamp01(toy.progress);
          item.node.style.left = `${view.fromX + (view.catcherX - view.fromX) * p}px`;
          item.node.style.top = `${laneY(toy.lane)}px`;
        });
        renderGrade(
          grade,
          view.grade,
          view.catcherX,
          laneY(view.catcher) - view.radius - gradeGap,
        );
      } else if (view.kind === "lean") {
        const { x, y, width, height } = view.track;
        track.style.left = `${x}px`;
        track.style.top = `${y}px`;
        track.style.width = `${width}px`;
        track.style.height = `${height}px`;
        setAttribute(star, "width", String(2 * height));
        setAttribute(star, "height", String(2 * height));
        star.style.left = `${x + Math.max(-1, Math.min(1, view.balance)) * width / 2}px`;
        star.style.top = `${y}px`;
        while (dotNodes.length < view.puffs.length) {
          const dot = element("span", "battle-lean-puff");
          puffDots.append(dot);
          dotNodes.push(dot);
        }
        dotNodes.forEach((dot, index) => {
          const puff = view.puffs[index];
          dot.hidden = puff === undefined;
          if (puff === undefined) return;
          dot.classList.toggle("is-blowing", puff.blowing);
          dot.classList.toggle("is-hit", puff.result === "hit");
          dot.classList.toggle("is-miss", puff.result === "miss");
          dot.style.left = `${x + (index - (view.puffs.length - 1) / 2) * puffSpacing}px`;
          dot.style.top = `${y - height / 2 - puffGap}px`;
        });
        // The puff blowing now: three swooshes, four when it pushes harder,
        // each drifting its length in toward Fae and fading as it goes.
        const blowing = view.puffs.find((puff) => puff.blowing);
        const rows = blowing === undefined ? 0 : blowing.force >= 0.5 ? 4 : 3;
        swooshes.forEach((swoosh, row) => {
          const rowY = view.wind.rows[row];
          hide(swoosh, blowing === undefined || row >= rows || rowY === undefined);
          if (blowing === undefined || rowY === undefined) return;
          const phase = (blowing.progress * swooshCycles + row * 0.29) % 1;
          setAttribute(swoosh, "width", String(view.wind.length));
          setAttribute(swoosh, "height", String(view.wind.length / 3));
          swoosh.style.left = `${view.wind.x - phase * view.wind.length}px`;
          swoosh.style.top = `${rowY}px`;
          swoosh.style.opacity = String(Math.sin(Math.PI * phase));
        });
        // Over Fae's head: above the track it would run into the HUD.
        renderGrade(grade, view.grade, x, y + 3 * height);
      } else if (view.kind === "trace") {
        const { rect } = view;
        traceLayer.style.left = `${rect.x}px`; traceLayer.style.top = `${rect.y}px`;
        traceLayer.style.width = `${rect.width}px`; traceLayer.style.height = `${rect.height}px`;
        traceSvg.setAttribute("viewBox", "0 0 1000 1000");
        const pathData = (points: { x: number; y: number }[]): string =>
          points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
            .join(" ");
        const d = pathData(view.points);
        tracePath.setAttribute("d", d);
        // Painted from the start through every point reached, up to the brush.
        const painted = pathData([...view.points.slice(0, Math.max(1, view.checkpoint)),
          view.brush]);
        tracePaint.setAttribute("d", painted);
        while (traceDots.children.length < view.points.length)
          traceDots.append(element("span", "battle-trace-dot"));
        // A shorter scribble after a longer one leaves no stale dots behind.
        while (traceDots.children.length > view.points.length)
          traceDots.lastElementChild?.remove();
        [...traceDots.querySelectorAll<HTMLElement>(".battle-trace-dot")].forEach((dot, index) => {
          const point = view.points[index]; if (point === undefined) return;
          dot.style.left = `${point.x / 10}%`; dot.style.top = `${point.y / 10}%`;
          dot.classList.toggle("is-next", index === view.checkpoint);
          dot.classList.toggle("is-hit", view.results[index] === "hit");
          dot.classList.toggle("is-miss", view.results[index] === "miss");
        });
        traceBrush.style.left = `${view.brush.x / 10}%`;
        traceBrush.style.top = `${view.brush.y / 10}%`;
        traceDry.style.setProperty("--dry", String(view.dry));
        // On the notched phone the HUD occupies the band immediately above the
        // square, so a completed grade hangs just inside the paper, not over
        // the calm meter.
        renderGrade(grade, view.grade, rect.x + rect.width / 2, rect.y + 52);
      } else {
        chain.style.left = "0";
        chain.style.top = "0";
        chainTarget.style.left = `${view.to.x}px`;
        chainTarget.style.top = `${view.to.y}px`;
        chainTarget.style.width = `${view.radius * 2}px`;
        chainTarget.style.height = `${view.radius * 2}px`;
        // A new chain may bring a different look, or fewer beats.
        if (iconLook !== view.look) {
          for (const icon of icons) icon.remove();
          icons.length = 0;
          iconLook = view.look;
        }
        while (icons.length < view.beats.length) {
          const icon = element("span", "battle-chain-beat");
          icon.append(chainIcon(view.look));
          beats.append(icon);
          icons.push(icon);
        }
        icons.forEach((icon, index) => {
          const beat = view.beats[index];
          icon.hidden = beat === undefined || !beat.appeared;
          if (beat === undefined) return;
          icon.classList.toggle("is-hit", beat.result === "hit");
          icon.classList.toggle("is-miss", beat.result === "miss");
          const p = clamp01(beat.progress);
          icon.style.left = `${view.from.x + (view.to.x - view.from.x) * p}px`;
          icon.style.top = `${view.from.y + (view.to.y - view.from.y) * p}px`;
        });
        renderGrade(
          grade,
          view.grade,
          view.to.x,
          view.to.y - view.radius - gradeGap,
        );
      }
    },
  };
}

function renderGrade(
  node: HTMLElement,
  value: TimingGrade | null,
  x: number,
  y: number,
): void {
  node.hidden = value === null;
  if (value === null) return;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  setAttribute(node, "class", `battle-grade battle-grade-${value}`);
  setText(node, gradeLabels[value]);
}

// A chain beat's icon, drawn in code in the sticker style: a round pink
// bubble with a shine (like the frog's own), a pinecone with ink scale marks,
// a puff of dust with motion dashes.
function chainIcon(look: "pinecone" | "bubble" | "dust"): SVGSVGElement {
  const svg = svgElement("svg", `battle-icon battle-icon-${look}`);
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  const part = <K extends "circle" | "ellipse" | "path">(
    tag: K,
    className: string,
    attributes: Record<string, string>,
  ): void => {
    const node = svgElement(tag, className);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    svg.append(node);
  };
  if (look === "bubble") {
    part("circle", "battle-icon-fill", { cx: "16", cy: "16", r: "13" });
    part("ellipse", "battle-icon-shine", { cx: "11.5", cy: "10.5", rx: "4", ry: "2.6",
      transform: "rotate(-35 11.5 10.5)" });
    part("circle", "battle-icon-shine", { cx: "20.5", cy: "8.5", r: "1.4" });
  } else if (look === "pinecone") {
    part("path", "battle-icon-mark", { d: "M16 5 L17.5 1.5" });
    part("ellipse", "battle-icon-fill", { cx: "16", cy: "17.5", rx: "9", ry: "12.5" });
    part("path", "battle-icon-mark", {
      d: "M9 12 Q16 16 23 12 M8 18 Q16 22.5 24 18 M10 24 Q16 27.5 22 24 " +
        "M13 6.5 Q12 17 14.5 29 M19 6.5 Q20 17 17.5 29",
    });
  } else {
    part("path", "battle-icon-fill", {
      d: "M7 24 C2 23 2 16 8 15.5 C8 9 16 7 19 12 C23 9 30 12 28 18.5 " +
        "C32 22 28 27 24 25.5 C21 29 11 29 7 24 Z",
    });
    part("path", "battle-icon-mark", { d: "M3 9 L8 11 M5 4 L10 7.5" });
  }
  return svg;
}

// A lean's star, drawn in code in the sticker style: butter yellow with an
// ink edge, on a cream rim.
function starIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-lean-star");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shape = "M12 1.6 L14.8 8.7 L22.5 9.2 L16.6 14.1 L18.5 21.5 L12 17.4 L5.5 21.5 " +
    "L7.4 14.1 L1.5 9.2 L9.2 8.7 Z";
  for (const className of ["battle-lean-star-rim", "battle-lean-star-fill"]) {
    const path = svgElement("path", className);
    path.setAttribute("d", shape);
    svg.append(path);
  }
  return svg;
}

// A swoosh of wind: a streak that curls up at its leading end, ink on a
// cream rim.
function swooshIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-lean-swoosh");
  svg.setAttribute("viewBox", "0 0 60 20");
  svg.setAttribute("aria-hidden", "true");
  for (const className of ["battle-lean-swoosh-rim", "battle-lean-swoosh-ink"]) {
    const path = svgElement("path", className);
    path.setAttribute("d", "M58 15 H25 C12 15 4 8 9 3.5 C13 0 21 2 19.5 8.5");
    svg.append(path);
  }
  return svg;
}

export type RewardStickerView = {
  visible: boolean;
  title: string;
  name: string;
  // Null outside a battle: the card keeps its last image while hidden.
  image: AtlasImage | null;
};

const svgNamespace = "http://www.w3.org/2000/svg";
const leafPath = "M 2 15 C 5 2, 15 1, 22 3 C 20 12, 12 18, 2 15 M 3 14 L 19 4";
const gradeGap = 6;
// A lean's puff dots: their spacing, and how far over the track they sit.
const puffSpacing = 18;
const puffGap = 10;
// How many times each swoosh drifts in over one puff.
const swooshCycles = 3;
const gradeLabels: Record<TimingGrade, string> = {
  great: "GREAT!",
  good: "GOOD!",
  miss: "MISS",
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(svgNamespace, tag);
  node.setAttribute("class", className);
  return node;
}

// The game renders every frame; only touch the DOM when something changed.
function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function leafIcon(): SVGSVGElement {
  const icon = svgElement("svg", "battle-leaf");
  icon.setAttribute("viewBox", "0 0 24 18");
  icon.setAttribute("aria-hidden", "true");
  const path = svgElement("path", "battle-leaf-path");
  path.setAttribute("d", leafPath);
  icon.append(path);
  return icon;
}

export function createBattleHud(root: HTMLElement): {
  render: (view: BattleHudView) => void;
} {
  const hud = element("div", "battle-hud");
  const energy = element("section", "battle-meter battle-energy");
  const energyLabel = element("span", "battle-meter-label");
  energyLabel.textContent = "ENERGY";
  const leaves = element("div", "battle-leaves");
  energy.append(energyLabel, leaves);
  const calm = element("section", "battle-meter battle-calm");
  const calmLabel = element("span", "battle-meter-label");
  const track = element("div", "battle-calm-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  const fill = element("div", "battle-calm-fill");
  track.append(fill);
  calm.append(calmLabel, track);
  hud.append(energy, calm);
  hud.hidden = true;
  root.append(hud);
  return {
    render: (view) => {
      hud.hidden = !view.visible;
      const max = Math.max(0, Math.floor(view.energyMax));
      while (leaves.children.length < max) leaves.append(leafIcon());
      while (leaves.children.length > max) leaves.lastElementChild?.remove();
      for (let index = 0; index < leaves.children.length; index += 1) {
        leaves.children
          .item(index)
          ?.classList.toggle("is-full", index < view.energy);
      }
      setAttribute(energy, "aria-label", `Energy ${view.energy} of ${max}`);
      setText(calmLabel, view.critterName.toUpperCase());
      setAttribute(track, "aria-label", `${view.critterName} calm`);
      setAttribute(
        track,
        "aria-valuenow",
        String(Math.round(clamp01(view.calm) * 100)),
      );
      fill.style.width = `${clamp01(view.calm) * 100}%`;
    },
  };
}

type CommandButton = {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
  detail: HTMLElement;
  // The feeling badge drawn now, so it's redrawn only when it changes.
  badge: { node: HTMLSpanElement; feeling: FeelingId | null };
};

export function createCommandMenu(root: HTMLElement): {
  render: (view: CommandMenuView) => void;
  onChoose: (callback: (index: number) => void) => void;
} {
  const menu = element("div", "battle-commands");
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Battle commands");
  menu.hidden = true;
  root.append(menu);
  let choose: (index: number) => void = () => undefined;
  const buttons: CommandButton[] = [];
  const addButton = (index: number): CommandButton => {
    const button = element("button", "battle-command");
    button.type = "button";
    button.setAttribute("role", "option");
    const label = element("span", "battle-command-label");
    const detail = element("small", "battle-command-detail");
    const badge = element("span", "battle-command-badge");
    badge.hidden = true;
    button.append(label, detail, badge);
    // Disabled buttons never fire click; the check keeps that explicit.
    button.addEventListener("click", () => {
      if (!button.disabled) choose(index);
    });
    menu.append(button);
    return { button, label, detail, badge: { node: badge, feeling: null } };
  };
  return {
    onChoose: (callback) => {
      choose = callback;
    },
    render: (view) => {
      menu.hidden = !view.visible;
      while (buttons.length < view.commands.length)
        buttons.push(addButton(buttons.length));
      while (buttons.length > view.commands.length)
        buttons.pop()?.button.remove();
      view.commands.forEach((command, index) => {
        const item = buttons[index];
        if (item === undefined) return;
        setText(item.label, command.label);
        setText(item.detail, command.detail ?? "");
        item.detail.hidden = command.detail === null;
        setAttribute(
          item.button,
          "aria-selected",
          String(index === view.selected),
        );
        setAttribute(item.button, "aria-disabled", String(command.disabled));
        item.button.disabled = command.disabled;
        if (item.badge.feeling !== command.feeling) {
          drawFeeling(item.badge.node, command.feeling);
          item.badge.feeling = command.feeling;
        }
      });
    },
  };
}

/** Draws a feeling's icon into its slot, or empties and hides the slot. */
function drawFeeling(slot: HTMLElement, feeling: FeelingId | null): void {
  slot.hidden = feeling === null;
  slot.replaceChildren(...(feeling === null ? [] : [icon(feelingMarkup[feeling], "battle-icon")]));
}

/**
 * The critter's thought cloud (spec 8.1): this turn's feeling, big, with its
 * label, and a trail of thought dots down toward the critter carrying what's
 * coming: the next turn's feeling in the middle dot and, once the lantern has
 * peeked, the one after in the smallest. A heart pops when this turn's
 * choice answered it.
 */
export function createFeelingBubble(root: HTMLElement): {
  render: (view: FeelingBubbleView) => void;
} {
  const bubble = element("div", "battle-feeling");
  const cloud = element("div", "battle-feeling-cloud");
  const nowIcon = element("span", "battle-feeling-icon");
  const label = element("span", "battle-feeling-label");
  const heart = element("span", "battle-feeling-heart");
  heart.append(icon(heartMarkup, "battle-icon"));
  cloud.append(nowIcon, label, heart);
  const nextDot = element("span", "battle-feeling-dot battle-feeling-next");
  const laterDot = element("span", "battle-feeling-dot battle-feeling-later");
  const nextIcon = element("span", "battle-feeling-dot-icon");
  const laterIcon = element("span", "battle-feeling-dot-icon");
  nextDot.append(nextIcon);
  laterDot.append(laterIcon);
  bubble.append(cloud, nextDot, laterDot);
  bubble.hidden = true;
  root.append(bubble);
  // What each icon slot shows now, so icons are redrawn only on change.
  const drawn = new Map<HTMLElement, FeelingId | null>();
  const show = (slot: HTMLElement, feeling: FeelingId | null): void => {
    if (drawn.has(slot) && drawn.get(slot) === feeling) return;
    drawFeeling(slot, feeling);
    drawn.set(slot, feeling);
  };
  return {
    render: (view) => {
      bubble.hidden = view === null || view.now === null;
      if (view === null || view.now === null) return;
      bubble.style.left = `${view.x}px`;
      bubble.style.setProperty("--feeling-y", `${view.y}px`);
      show(nowIcon, view.now.id);
      setText(label, view.now.label);
      show(nextIcon, view.next);
      show(laterIcon, view.later);
      laterDot.classList.toggle("is-peeked", view.later !== null);
      heart.hidden = !view.answered;
    },
  };
}

// A mini-boss's wind-up (spec 8.1, Milestone 50): the feelings it shows at
// once, as round bubbles where the thought cloud would float, each popped or
// not; null hides them.
export type WindUpView = {
  bubbles: { id: FeelingId; label: string; popped: boolean }[];
  // Where the row's top centre would like to be, in CSS px; CSS keeps it
  // below the HUD, like the cloud.
  x: number;
  y: number;
} | null;

/**
 * A wind-up's bubbles: a feeling and its label in each, and a popped one a
 * faint dashed ring, so it's plain which are left to answer.
 */
export function createWindUpBubbles(root: HTMLElement): {
  render: (view: WindUpView) => void;
} {
  const row = element("div", "battle-windup");
  row.hidden = true;
  root.append(row);
  const bubbles: { node: HTMLElement; icon: HTMLElement; label: HTMLElement;
    feeling: FeelingId | null }[] = [];
  return {
    render: (view) => {
      row.hidden = view === null || view.bubbles.length === 0;
      if (view === null) return;
      row.style.left = `${view.x}px`;
      row.style.setProperty("--feeling-y", `${view.y}px`);
      while (bubbles.length < view.bubbles.length) {
        const node = element("div", "battle-windup-bubble");
        const iconSlot = element("span", "battle-windup-icon");
        const label = element("span", "battle-windup-label");
        node.append(iconSlot, label);
        row.append(node);
        bubbles.push({ node, icon: iconSlot, label, feeling: null });
      }
      bubbles.forEach((bubble, index) => {
        const item = view.bubbles[index];
        bubble.node.hidden = item === undefined;
        if (item === undefined) return;
        if (bubble.feeling !== item.id) {
          drawFeeling(bubble.icon, item.id);
          bubble.feeling = item.id;
        }
        setText(bubble.label, item.label);
        bubble.node.classList.toggle("is-popped", item.popped);
      });
    },
  };
}

export function createRewardSticker(root: HTMLElement): {
  render: (view: RewardStickerView) => void;
} {
  const card = element("section", "battle-reward");
  const title = element("div", "battle-reward-title");
  const image = element("div", "battle-reward-image die-cut");
  image.setAttribute("role", "img");
  const name = element("div", "battle-reward-name");
  card.append(title, image, name);
  card.hidden = true;
  root.append(card);
  return {
    render: (view) => {
      card.hidden = !view.visible;
      card.classList.toggle("is-visible", view.visible);
      setText(title, view.title);
      setText(name, view.name);
      setAttribute(image, "aria-label", view.name);
      if (view.image !== null) applyAtlasCrop(image, view.image);
    },
  };
}
