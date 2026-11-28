import type { AtlasImage } from "./atlas";
import type { BattleCheckV2View } from "./battle-checks-v2";
import { setAttribute, setText, svgElement } from "./dom";
import type { HudInputMode } from "./hud-hints";
import { resolveCatchDirection, resolveLeanDirection } from "./pointer-hold";
import type { ChainLook, EchoNote, PeekabooStatus, Point } from "../core";

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
      look: ChainLook;
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    }
  | {
      kind: "catch";
      lanes: [number, number, number];
      fromX: number;
      catcherX: number;
      radius: number;
      catcher: number;
      toys: {
        appeared: boolean;
        progress: number;
        lane: number;
        result: "pending" | "hit" | "miss";
        image: AtlasImage | null;
        width: number;
        height: number;
      }[];
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    }
  | {
      kind: "lean";
      track: { x: number; y: number; width: number; height: number };
      balance: number;
      wind: { x: number; rows: number[]; length: number };
      puffs: {
        blowing: boolean;
        progress: number;
        force: number;
        result: "pending" | "hit" | "miss";
      }[];
      grade: TimingGrade | null;
      hint: string | null;
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
    }
  | {
      kind: "peekaboo";
      track: { x: number; y: number; width: number; height: number };
      progress: number;
      status: PeekabooStatus;
      peeks: ("pending" | "cleared" | "spotted")[];
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    }
  | {
      kind: "echo";
      x: number;
      y: number;
      phase: "demo" | "input";
      sequence: EchoNote[];
      results: ("pending" | "hit" | "miss")[];
      litNote: EchoNote | null;
      demoIndex: number;
      entered: number;
      time: number;
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    }
  | BattleCheckV2View;

export const GRADE_GAP = 6;
export const PUFF_SPACING = 18;
export const PUFF_GAP = 10;
export const SWOOSH_CYCLES = 3;

export const gradeLabels: Record<TimingGrade, string> = {
  great: "GREAT!",
  good: "GOOD!",
  miss: "MISS",
};

export const peekabooLabels: Record<PeekabooStatus, string> = {
  safe: "LOOKING AWAY · HOLD!",
  warning: "TURN SOON...",
  watching: "WATCHING · FREEZE!",
};

export const echoChimeMeta: readonly {
  note: EchoNote;
  key: string;
  label: string;
  arrow: string;
  dir: string;
}[] = [
  { note: 0, key: "red", label: "Red", arrow: "↑", dir: "Up" },
  { note: 1, key: "yellow", label: "Yellow", arrow: "→", dir: "Right" },
  { note: 2, key: "green", label: "Green", arrow: "↓", dir: "Down" },
  { note: 3, key: "blue", label: "Blue", arrow: "←", dir: "Left" },
];

/**
 * Adapts Minigame (Claw, Skee-Ball, Boop-a-Mole, Comet Cruise, Microwave,
 * Fishing, Taco Truck) and Battle Check hint copy for Steam Deck / Gamepad
 * while keeping keyboard copy 100% unchanged.
 */
export function adaptHintForInputMode(
  hint: string,
  inputMode: HudInputMode = "keyboard",
): string {
  if (inputMode !== "gamepad") return hint;
  return hint
    .replace(
      "Up Beans · Right Cheese · Down Salsa · Left Avocado.",
      "D-Pad ↑ Beans · → Cheese · ↓ Salsa · ← Avocado.",
    )
    .replace(
      "Catch the stars and slip past the space rocks!",
      "Catch the stars with Stick / D-Pad and dodge space rocks!",
    )
    .replace(/\bHold to\b/g, "Hold A to")
    .replace(/\bPress to\b/g, "Press A to")
    .replace(/\bTap to\b/g, "Tap A to")
    .replace(/\bConfirm\b/g, "A")
    .replace(/\bconfirm\b/g, "A")
    .replace(/\bEsc\b/g, "B")
    .replace(/\bLeft \/ Right\b/g, "Stick / D-Pad")
    .replace(/\bArrows\b/g, "Stick / D-Pad")
    .replace(/\bSpace\b/g, "A")
    .replace(/\bZ\b/g, "A");
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function tracePathData(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}

export function resolveCheckPointerDirection(
  view: BattleCheckView | null,
  clientX: number,
  clientY: number,
): Point {
  if (view === null) return { x: 0, y: 0 };
  if (view.kind === "catch") {
    return resolveCatchDirection(clientY, view.lanes[0], view.lanes[2], view.lanes.length);
  }
  if (view.kind === "lean") {
    return resolveLeanDirection(clientX, view.track.x);
  }
  return { x: 0, y: 0 };
}

export function renderGrade(
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

export function chainIcon(look: ChainLook): SVGSVGElement {
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
    part("ellipse", "battle-icon-shine", {
      cx: "11.5",
      cy: "10.5",
      rx: "4",
      ry: "2.6",
      transform: "rotate(-35 11.5 10.5)",
    });
    part("circle", "battle-icon-shine", { cx: "20.5", cy: "8.5", r: "1.4" });
  } else if (look === "pinecone") {
    part("path", "battle-icon-mark", { d: "M16 5 L17.5 1.5" });
    part("ellipse", "battle-icon-fill", { cx: "16", cy: "17.5", rx: "9", ry: "12.5" });
    part("path", "battle-icon-mark", {
      d: "M9 12 Q16 16 23 12 M8 18 Q16 22.5 24 18 M10 24 Q16 27.5 22 24 " +
        "M13 6.5 Q12 17 14.5 29 M19 6.5 Q20 17 17.5 29",
    });
  } else if (look === "star") {
    part("path", "battle-icon-fill", {
      d: "M16 2.5 L19.8 11.2 L29.2 12 L22 18.2 L24.2 27.5 L16 22.4 L7.8 27.5 " +
        "L10 18.2 L2.8 12 L12.2 11.2 Z",
    });
    part("circle", "battle-icon-shine", { cx: "13.5", cy: "13", r: "2.2" });
    part("circle", "battle-icon-shine", { cx: "17.8", cy: "10.5", r: "1.1" });
  } else {
    part("path", "battle-icon-fill", {
      d: "M7 24 C2 23 2 16 8 15.5 C8 9 16 7 19 12 C23 9 30 12 28 18.5 " +
        "C32 22 28 27 24 25.5 C21 29 11 29 7 24 Z",
    });
    part("path", "battle-icon-mark", { d: "M3 9 L8 11 M5 4 L10 7.5" });
  }
  return svg;
}

const STAR_SHAPE = "M12 1.6 L14.8 8.7 L22.5 9.2 L16.6 14.1 L18.5 21.5 L12 17.4 L5.5 21.5 " +
  "L7.4 14.1 L1.5 9.2 L9.2 8.7 Z";

function buildStarSvg(className: string): SVGSVGElement {
  const svg = svgElement("svg", className);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const partClass of ["battle-lean-star-rim", "battle-lean-star-fill"]) {
    const path = svgElement("path", partClass);
    path.setAttribute("d", STAR_SHAPE);
    svg.append(path);
  }
  return svg;
}

export function starIcon(): SVGSVGElement {
  return buildStarSvg("battle-lean-star");
}

export function swooshIcon(): SVGSVGElement {
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

export function peekabooEyesIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-peekaboo-eyes");
  svg.setAttribute("viewBox", "0 0 36 18");
  svg.setAttribute("aria-hidden", "true");
  const add = <K extends "path" | "circle" | "ellipse">(
    parent: Element,
    tag: K,
    className: string,
    attributes: Record<string, string>,
  ): void => {
    const node = svgElement(tag, className);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    parent.append(node);
  };
  const safeGroup = svgElement("g", "battle-peekaboo-eyes-safe");
  add(safeGroup, "path", "battle-peekaboo-lid", { d: "M4 11 Q10 6 16 11" });
  add(safeGroup, "path", "battle-peekaboo-lid", { d: "M20 11 Q26 6 32 11" });
  const warnGroup = svgElement("g", "battle-peekaboo-eyes-warning");
  add(warnGroup, "ellipse", "battle-peekaboo-sclera", { cx: "10", cy: "10", rx: "6", ry: "3.4" });
  add(warnGroup, "ellipse", "battle-peekaboo-sclera", { cx: "26", cy: "10", rx: "6", ry: "3.4" });
  add(warnGroup, "circle", "battle-peekaboo-pupil", { cx: "10", cy: "10.5", r: "2" });
  add(warnGroup, "circle", "battle-peekaboo-pupil", { cx: "26", cy: "10.5", r: "2" });
  add(warnGroup, "path", "battle-peekaboo-lid", { d: "M4 8.5 Q10 6.5 16 8.5" });
  add(warnGroup, "path", "battle-peekaboo-lid", { d: "M20 8.5 Q26 6.5 32 8.5" });
  const watchGroup = svgElement("g", "battle-peekaboo-eyes-watching");
  add(watchGroup, "circle", "battle-peekaboo-sclera", { cx: "10", cy: "9", r: "6.4" });
  add(watchGroup, "circle", "battle-peekaboo-sclera", { cx: "26", cy: "9", r: "6.4" });
  add(watchGroup, "circle", "battle-peekaboo-pupil", { cx: "10", cy: "9", r: "3.5" });
  add(watchGroup, "circle", "battle-peekaboo-pupil", { cx: "26", cy: "9", r: "3.5" });
  add(watchGroup, "circle", "battle-peekaboo-spark", { cx: "8.5", cy: "7.5", r: "1.4" });
  add(watchGroup, "circle", "battle-peekaboo-spark", { cx: "24.5", cy: "7.5", r: "1.4" });
  svg.append(safeGroup, warnGroup, watchGroup);
  return svg;
}

export function peekabooStarIcon(): SVGSVGElement {
  return buildStarSvg("battle-peekaboo-star");
}
