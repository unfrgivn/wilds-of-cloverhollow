import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, svgElement } from "./dom";
import {
  bindPointerHold,
  bindPointerMoveHold,
  isConfirmCheckKind,
  isDirectionalCheckKind,
  resolveCatchDirection,
  resolveLeanDirection,
} from "./pointer-hold";
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
      look: ChainLook;
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
    };

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
const peekabooLabels: Record<PeekabooStatus, string> = {
  safe: "LOOKING AWAY · HOLD!",
  warning: "TURN SOON...",
  watching: "WATCHING · FREEZE!",
};

const echoChimeMeta: readonly {
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The complete check overlay, kept in one fixed DOM layer above the scene. */
export function createBattleCheck(root: HTMLElement): {
  render: (view: BattleCheckView | null) => void;
  onEchoNote: (callback: (note: EchoNote) => void) => void;
  onConfirmHold: (callback: (held: boolean) => void) => void;
  onDirectionHold: (callback: (dir: Point) => void) => void;
} {
  let echoNoteHandler: (note: EchoNote) => void = () => undefined;
  let confirmHoldHandler: (held: boolean) => void = () => undefined;
  let directionHoldHandler: (dir: Point) => void = () => undefined;
  let activeView: BattleCheckView | null = null;
  let confirmActive = false;
  let directionalActive = false;
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
  // Peekaboo (Milestone 81): status sticker with SVG eyes above a cream
  // progress bar filling left-to-right toward a gold star, plus peek dots.
  const peekabooLayer = element("div", "battle-peekaboo");
  const peekabooBadge = element("div", "battle-peekaboo-badge");
  const peekabooEyes = peekabooEyesIcon();
  const peekabooStatusLabel = element("span", "battle-peekaboo-status");
  peekabooBadge.append(peekabooEyes, peekabooStatusLabel);
  const peekabooTrack = element("div", "battle-peekaboo-track");
  const peekabooFill = element("div", "battle-peekaboo-fill");
  peekabooTrack.append(peekabooFill);
  const peekabooStar = peekabooStarIcon();
  const peekabooDots = element("div", "battle-peekaboo-dots");
  peekabooLayer.append(peekabooBadge, peekabooTrack, peekabooStar, peekabooDots);
  const tapStage = element("div", "battle-check-tap");
  tapStage.setAttribute("aria-hidden", "true");
  tapStage.hidden = true;
  const confirmHold = bindPointerHold(
    tapStage,
    (held) => confirmHoldHandler(held),
    () => confirmActive,
  );
  const dirHold = bindPointerMoveHold(
    tapStage,
    (dir) => directionHoldHandler(dir),
    (clientX, clientY) => {
      if (activeView === null) return { x: 0, y: 0 };
      if (activeView.kind === "catch") {
        return resolveCatchDirection(
          clientY,
          activeView.lanes[0],
          activeView.lanes[2],
          activeView.lanes.length,
        );
      }
      if (activeView.kind === "lean") {
        return resolveLeanDirection(clientX, activeView.track.x);
      }
      return { x: 0, y: 0 };
    },
    () => directionalActive,
  );
  // Echo chime board: note progress dots, phase pill, timer bar, and four
  // directional chime stickers.
  const echoLayer = element("div", "battle-echo");
  const echoHead = element("div", "battle-echo-head");
  const echoDots = element("div", "battle-echo-dots");
  const echoPhase = element("span", "battle-echo-phase");
  echoHead.append(echoDots, echoPhase);
  const echoTimer = element("div", "battle-echo-timer");
  const echoTimeFill = element("div", "battle-echo-time-fill");
  echoTimer.append(echoTimeFill);
  const echoPad = element("div", "battle-echo-pad");
  const echoChimeButtons: HTMLButtonElement[] = echoChimeMeta.map((meta) => {
    const button = element("button", `battle-echo-chime battle-echo-chime-${meta.key}`);
    button.type = "button";
    button.dataset.note = String(meta.note);
    button.setAttribute("aria-label", `${meta.label} chime (${meta.dir})`);
    const arrow = element("span", "battle-echo-arrow");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = meta.arrow;
    const name = element("span", "battle-echo-name");
    name.textContent = meta.label;
    button.append(arrow, name);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      echoNoteHandler(meta.note);
    });
    echoPad.append(button);
    return button;
  });
  echoLayer.append(echoHead, echoTimer, echoPad);
  const hint = element("div", "battle-check-hint");
  const grade = element("div", "battle-grade");
  grade.setAttribute("role", "status");
  grade.hidden = true;
  root.append(
    ring,
    meter,
    chain,
    catchLayer,
    leanLayer,
    traceLayer,
    peekabooLayer,
    tapStage,
    echoLayer,
    hint,
    grade,
  );
  const icons: HTMLElement[] = [];
  const toyNodes: { node: HTMLElement; src: string }[] = [];
  const dotNodes: HTMLElement[] = [];
  const peekDotNodes: HTMLElement[] = [];
  const echoDotNodes: HTMLElement[] = [];
  let iconLook: ChainLook | null = null;
  const hide = (node: HTMLElement | SVGSVGElement, hidden: boolean): void => {
    node.style.display = hidden ? "none" : "";
  };
  return {
    onEchoNote: (callback) => {
      echoNoteHandler = callback;
    },
    onConfirmHold: (callback) => {
      confirmHoldHandler = callback;
    },
    onDirectionHold: (callback) => {
      directionHoldHandler = callback;
    },
    render: (view) => {
      activeView = view;
      confirmActive = view !== null && isConfirmCheckKind(view.kind) && view.grade === null;
      directionalActive =
        view !== null && isDirectionalCheckKind(view.kind) && view.grade === null;
      tapStage.hidden = !confirmActive && !directionalActive;
      if (!confirmActive) confirmHold.release();
      if (!directionalActive) dirHold.release();
      else dirHold.refresh();
      hide(ring, view?.kind !== "ring");
      hide(meter, view?.kind !== "charge");
      hide(chain, view?.kind !== "chain");
      hide(catchLayer, view?.kind !== "catch");
      hide(leanLayer, view?.kind !== "lean");
      hide(traceLayer, view?.kind !== "trace");
      hide(peekabooLayer, view?.kind !== "peekaboo");
      hide(echoLayer, view?.kind !== "echo");
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
        traceLayer.style.left = `${rect.x}px`;
        traceLayer.style.top = `${rect.y}px`;
        traceLayer.style.width = `${rect.width}px`;
        traceLayer.style.height = `${rect.height}px`;
        traceSvg.setAttribute("viewBox", "0 0 1000 1000");
        const pathData = (points: { x: number; y: number }[]): string =>
          points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
            .join(" ");
        const d = pathData(view.points);
        tracePath.setAttribute("d", d);
        // Painted from the start through every point reached, up to the brush.
        const painted = pathData([
          ...view.points.slice(0, Math.max(1, view.checkpoint)),
          view.brush,
        ]);
        tracePaint.setAttribute("d", painted);
        while (traceDots.children.length < view.points.length)
          traceDots.append(element("span", "battle-trace-dot"));
        // A shorter scribble after a longer one leaves no stale dots behind.
        while (traceDots.children.length > view.points.length)
          traceDots.lastElementChild?.remove();
        [...traceDots.querySelectorAll<HTMLElement>(".battle-trace-dot")].forEach((dot, index) => {
          const point = view.points[index];
          if (point === undefined) return;
          dot.style.left = `${point.x / 10}%`;
          dot.style.top = `${point.y / 10}%`;
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
      } else if (view.kind === "peekaboo") {
        const { x, y, width, height } = view.track;
        setAttribute(peekabooBadge, "data-status", view.status);
        setText(peekabooStatusLabel, peekabooLabels[view.status]);
        peekabooBadge.style.setProperty("--peekaboo-x", `${x}px`);
        peekabooBadge.style.top = `${y - height / 2 - 6}px`;
        peekabooTrack.style.left = `${x}px`;
        peekabooTrack.style.top = `${y}px`;
        peekabooTrack.style.width = `${width}px`;
        peekabooTrack.style.height = `${height}px`;
        peekabooFill.style.width = `${clamp01(view.progress) * 100}%`;
        const starSize = Math.round(Math.max(24, height * 1.7));
        setAttribute(peekabooStar, "width", String(starSize));
        setAttribute(peekabooStar, "height", String(starSize));
        peekabooStar.style.left = `${x + width / 2}px`;
        peekabooStar.style.top = `${y}px`;
        while (peekDotNodes.length < view.peeks.length) {
          const dot = element("span", "battle-peekaboo-dot");
          peekabooDots.append(dot);
          peekDotNodes.push(dot);
        }
        peekDotNodes.forEach((dot, index) => {
          const state = view.peeks[index];
          dot.hidden = state === undefined;
          if (state === undefined) return;
          dot.classList.toggle("is-cleared", state === "cleared");
          dot.classList.toggle("is-spotted", state === "spotted");
          dot.style.left = `${x + (index - (view.peeks.length - 1) / 2) * puffSpacing}px`;
          dot.style.top = `${y + height / 2 + 8}px`;
        });
        renderGrade(grade, view.grade, x, y + height / 2 + 54);
      } else if (view.kind === "echo") {
        echoLayer.style.left = `${view.x}px`;
        echoLayer.style.setProperty("--echo-y", `${view.y}px`);
        setAttribute(echoLayer, "data-phase", view.phase);
        setText(echoPhase, view.phase === "demo" ? "LISTEN..." : "YOUR TURN!");
        echoTimer.classList.toggle("is-active", view.phase === "input");
        echoTimeFill.style.width = `${(view.phase === "input" ? clamp01(view.time) : 1) * 100}%`;
        while (echoDotNodes.length < view.sequence.length) {
          const dot = element("span", "battle-echo-dot");
          echoDots.append(dot);
          echoDotNodes.push(dot);
        }
        while (echoDotNodes.length > view.sequence.length) {
          echoDotNodes.pop()?.remove();
        }
        echoDotNodes.forEach((dot, index) => {
          const result = view.results[index] ?? "pending";
          const note = view.sequence[index] ?? 0;
          const isDemoLit = view.phase === "demo" && index === view.demoIndex;
          const isCurrent = view.phase === "input" && index === view.entered &&
            result === "pending";
          setAttribute(dot, "data-note", isDemoLit ? String(note) : "");
          dot.classList.toggle("is-demo", isDemoLit);
          dot.classList.toggle("is-current", isCurrent);
          dot.classList.toggle("is-hit", result === "hit");
          dot.classList.toggle("is-miss", result === "miss");
          setText(dot, result === "hit" ? "✓" : result === "miss" ? "×" : "");
        });
        echoChimeButtons.forEach((button, index) => {
          button.classList.toggle("is-lit", view.litNote === index);
        });
        renderGrade(grade, view.grade, view.x, Math.max(132, view.y - 68));
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
// a butter-gold star for Together!, or a puff of dust with motion dashes.
function chainIcon(look: ChainLook): SVGSVGElement {
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

// Peekaboo status eyes (Milestone 81): all three states pre-mounted in one
// SVG and toggled by CSS on `[data-status]` so renders never churn DOM nodes.
function peekabooEyesIcon(): SVGSVGElement {
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
  // Safe: closed cozy crescent eyes looking away.
  const safeGroup = svgElement("g", "battle-peekaboo-eyes-safe");
  add(safeGroup, "path", "battle-peekaboo-lid", { d: "M4 11 Q10 6 16 11" });
  add(safeGroup, "path", "battle-peekaboo-lid", { d: "M20 11 Q26 6 32 11" });
  // Warning: half-open blinking eyes peeking over.
  const warnGroup = svgElement("g", "battle-peekaboo-eyes-warning");
  add(warnGroup, "ellipse", "battle-peekaboo-sclera", { cx: "10", cy: "10", rx: "6", ry: "3.4" });
  add(warnGroup, "ellipse", "battle-peekaboo-sclera", { cx: "26", cy: "10", rx: "6", ry: "3.4" });
  add(warnGroup, "circle", "battle-peekaboo-pupil", { cx: "10", cy: "10.5", r: "2" });
  add(warnGroup, "circle", "battle-peekaboo-pupil", { cx: "26", cy: "10.5", r: "2" });
  add(warnGroup, "path", "battle-peekaboo-lid", { d: "M4 8.5 Q10 6.5 16 8.5" });
  add(warnGroup, "path", "battle-peekaboo-lid", { d: "M20 8.5 Q26 6.5 32 8.5" });
  // Watching: wide starry eyes with bright sparkle pupils.
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

// Peekaboo's goal star at the end of the progress track: butter gold on cream rim.
function peekabooStarIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-peekaboo-star");
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
