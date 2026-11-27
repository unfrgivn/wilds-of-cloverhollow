import "./battle.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, svgElement } from "./dom";
import { feelingMarkup, heartMarkup, icon } from "./icons";
import type {
  BattleTalk,
  ChainLook,
  EchoNote,
  FeelingId,
  FluteAssistKind,
  PeekabooStatus,
} from "../core";
import type { DialogueView } from "./sticker";
import type { BattlePortraitItem } from "./battle-portraits";

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
  level: number;
  /** 0..1 */
  calm: number;
  critterName: string;
  sparkle: { count: number; max: number; ready: boolean } | null;
  fluteAssist: { available: boolean; label: string; kind: FluteAssistKind } | null;
  burstSoften: number;
  lassoAssist: { available: boolean; windUp: boolean } | null;
  lassoSteady: boolean;
  portraits?: readonly BattlePortraitItem[];
};

export type BattleCommand = {
  id: string;
  label: string;
  detail: string | null;
  disabled: boolean;
  // The feeling this command answers this turn, shown as a badge.
  feeling: FeelingId | null;
};

export type BattleTreatItem = {
  id: string;
  label: string;
  count: number;
  favourite: boolean;
  description: string;
};

export type CommandMenuView = {
  visible: boolean;
  commands: BattleCommand[];
  selected: number;
  treatTray?: {
    items: BattleTreatItem[];
    selected: number;
  } | null;
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

/** The complete check overlay, kept in one fixed DOM layer above the scene. */
export function createBattleCheck(root: HTMLElement): {
  render: (view: BattleCheckView | null) => void;
  onEchoNote: (callback: (note: EchoNote) => void) => void;
} {
  let echoNoteHandler: (note: EchoNote) => void = () => undefined;
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
    render: (view) => {
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

export type RewardStickerView = {
  visible: boolean;
  title: string;
  name: string;
  // Null outside a battle: the card keeps its last image while hidden.
  image: AtlasImage | null;
};

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

function leafIcon(): SVGSVGElement {
  const icon = svgElement("svg", "battle-leaf");
  icon.setAttribute("viewBox", "0 0 24 18");
  icon.setAttribute("aria-hidden", "true");
  const path = svgElement("path", "battle-leaf-path");
  path.setAttribute("d", leafPath);
  icon.append(path);
  return icon;
}

function sparkleStarIcon(filled = false): SVGSVGElement {
  const svg = svgElement("svg", filled ? "battle-sparkle-star is-full" : "battle-sparkle-star");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = svgElement("path", "battle-sparkle-star-path");
  path.setAttribute(
    "d",
    "M12 2.2 L14.9 8.7 L22 9.4 L16.6 14 L18.3 21 L12 17.2 L5.7 21 L7.4 14 L2 9.4 L9.1 8.7 Z",
  );
  svg.append(path);
  return svg;
}

function fluteNoteIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-flute-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = svgElement("path", "battle-flute-icon-path");
  path.setAttribute("d", "M9 18 V6 L19 4 V16");
  const headA = svgElement("ellipse", "battle-flute-icon-head");
  headA.setAttribute("cx", "6.5");
  headA.setAttribute("cy", "18");
  headA.setAttribute("rx", "3");
  headA.setAttribute("ry", "2.2");
  const headB = svgElement("ellipse", "battle-flute-icon-head");
  headB.setAttribute("cx", "16.5");
  headB.setAttribute("cy", "16");
  headB.setAttribute("rx", "3");
  headB.setAttribute("ry", "2.2");
  svg.append(path, headA, headB);
  return svg;
}

function softenSparkleIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-soften-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = svgElement("path", "battle-soften-icon-path");
  path.setAttribute("d", "M12 2 L14.8 9.2 L22 12 L14.8 14.8 L12 22 L9.2 14.8 L2 12 L9.2 9.2 Z");
  svg.append(path);
  return svg;
}

function lassoIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-lasso-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const loop = svgElement("ellipse", "battle-lasso-loop");
  loop.setAttribute("cx", "12.5");
  loop.setAttribute("cy", "8.5");
  loop.setAttribute("rx", "7.5");
  loop.setAttribute("ry", "4.5");
  loop.setAttribute("transform", "rotate(-16 12.5 8.5)");
  const tail = svgElement("path", "battle-lasso-tail");
  tail.setAttribute("d", "M8 12.5 C7 16 10 18.5 14 19.5 C16.5 20 19 19 20 17");
  const star = svgElement("path", "battle-lasso-star");
  star.setAttribute(
    "d",
    "M8.2 10.6 L9.3 12.6 L11.5 13 L9.9 14.5 L10.3 16.7 L8.2 15.6 " +
      "L6.1 16.7 L6.5 14.5 L4.9 13 L7.1 12.6 Z",
  );
  svg.append(loop, tail, star);
  return svg;
}

function calmHeartIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-calm-heart");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const path = svgElement("path", "battle-calm-heart-path");
  path.setAttribute(
    "d",
    "M10 17.2 C3.6 12.6 1.8 9.6 2.6 6.6 C3.6 3.4 7.6 2.8 10 6 " +
      "C12.4 2.8 16.4 3.4 17.4 6.6 C18.2 9.6 16.4 12.6 10 17.2 Z",
  );
  svg.append(path);
  return svg;
}

const commandIconMarkup: Record<string, string> = {
  soothe:
    '<path d="M8.5 14.2 V5.2 L16.2 3.4 V12.2" fill="none" stroke="#47321f" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<ellipse cx="6.2" cy="14.4" rx="2.7" ry="2" fill="#8ad8cc" stroke="#47321f" ' +
    'stroke-width="1.3"/>' +
    '<ellipse cx="14" cy="12.6" rx="2.7" ry="2" fill="#8ad8cc" stroke="#47321f" ' +
    'stroke-width="1.3"/>',
  play:
    '<ellipse cx="10" cy="13.2" rx="4.4" ry="3.4" fill="#f4b37c" stroke="#47321f" ' +
    'stroke-width="1.4"/>' +
    '<circle cx="5.2" cy="8.4" r="1.9" fill="#f4b37c" stroke="#47321f" stroke-width="1.3"/>' +
    '<circle cx="10" cy="6.2" r="2" fill="#f4b37c" stroke="#47321f" stroke-width="1.3"/>' +
    '<circle cx="14.8" cy="8.4" r="1.9" fill="#f4b37c" stroke="#47321f" stroke-width="1.3"/>',
  cast:
    '<path d="M3.2 16.6 L11.4 8.4" fill="none" stroke="#47321f" stroke-width="1.8" ' +
    'stroke-linecap="round"/>' +
    '<path d="M13.6 2.6 L14.9 6 L18.4 7.2 L14.9 8.4 L13.6 11.8 L12.3 8.4 ' +
    'L8.8 7.2 L12.3 6 Z" fill="#f6cf4f" stroke="#47321f" stroke-width="1.2" ' +
    'stroke-linejoin="round"/>',
  juggle:
    '<path d="M3.6 14.2 C5.2 6.8 14.8 6.8 16.4 14.2" fill="none" stroke="#47321f" ' +
    'stroke-width="1.3" stroke-dasharray="2 2.2" stroke-linecap="round"/>' +
    '<circle cx="4.6" cy="14.2" r="2.6" fill="#f3a5be" stroke="#47321f" stroke-width="1.3"/>' +
    '<circle cx="10" cy="5.6" r="2.6" fill="#f6cf4f" stroke="#47321f" stroke-width="1.3"/>' +
    '<circle cx="15.4" cy="14.2" r="2.6" fill="#9bd5cb" stroke="#47321f" stroke-width="1.3"/>',
  snack:
    '<path d="M10 6.2 C6.4 5.4 3.8 8.2 4.4 12.2 C5 15.8 7.8 17.6 10 16.4 ' +
    'C12.2 17.6 15 15.8 15.6 12.2 C16.2 8.2 13.6 5.4 10 6.2 Z" ' +
    'fill="#ef8fa6" stroke="#47321f" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M10 6.2 C10.2 4.2 11.4 3 13 2.8" fill="none" stroke="#47321f" ' +
    'stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M10.4 5.4 C12.2 3.2 14.6 3.4 15.4 5 C13.6 6.2 11.8 6.2 10.4 5.4 Z" ' +
    'fill="#97c982" stroke="#47321f" stroke-width="1.1" stroke-linejoin="round"/>',
  talk:
    '<path d="M3.2 9.4 C3.2 5.8 6.2 3.6 10 3.6 C13.8 3.6 16.8 5.8 16.8 9.4 ' +
    'C16.8 12.8 13.8 15 10 15 L6.8 17 L7.2 14.4 C4.8 13.6 3.2 11.8 3.2 9.4 Z" ' +
    'fill="#fff3c4" stroke="#47321f" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M10 12.2 C7.8 10.6 7.2 9.4 7.6 8.3 C8.1 7.2 9.2 7.2 10 8.3 ' +
    'C10.8 7.2 11.9 7.2 12.4 8.3 C12.8 9.4 12.2 10.6 10 12.2 Z" fill="#ef8fa6"/>',
  run:
    '<path d="M3.2 8 H12.4 C15.2 8 16.4 5.4 14.4 4.2 C12.8 3.2 11.4 4.4 11.8 5.8" ' +
    'fill="none" stroke="#47321f" stroke-width="1.7" stroke-linecap="round"/>' +
    '<path d="M4.8 12.6 H14.8 C17 12.6 17.6 15.2 15.8 16.2 C14.4 17 13 15.8 13.6 14.6" ' +
    'fill="none" stroke="#47321f" stroke-width="1.7" stroke-linecap="round"/>',
};

const fallbackCommandMarkup =
  '<path d="M10 2.4 L12.2 7.8 L17.6 10 L12.2 12.2 L10 17.6 L7.8 12.2 L2.4 10 L7.8 7.8 Z" ' +
  'fill="#f6cf4f" stroke="#47321f" stroke-width="1.3" stroke-linejoin="round"/>';

function commandIcon(commandId: string): SVGSVGElement {
  return icon(commandIconMarkup[commandId] ?? fallbackCommandMarkup, "battle-command-icon");
}

/** Concise purposeful preview line shown under the battle prompt for the highlighted command. */
export function battleCommandPreview(
  command: BattleCommand,
  critterName: string,
  feelingLabel: string | null,
): string {
  if (command.disabled && command.detail !== null) {
    if (command.id === "snack") return "No snacks or treats left right now.";
    return `Catching a breath (${command.detail}).`;
  }
  let base: string;
  if (command.id === "soothe") {
    base = `Hum a gentle tune to calm ${critterName}.`;
  } else if (command.id === "play") {
    base = "Maddie bounces in with a playful pounce!";
  } else if (command.id === "cast") {
    base = "Sue casts a sparkling lure. Hold to charge!";
  } else if (command.id === "juggle") {
    base = "Jordan juggles glowing stars. Tap on the beat!";
  } else if (command.id === "snack") {
    base = "Share a snack or favourite treat.";
  } else if (command.id === "talk") {
    base = "Listen closely and speak from the heart.";
  } else if (command.id === "run") {
    base = "Step back calmly to explore more.";
  } else {
    base = `${command.label} helps calm ${critterName}.`;
  }
  if (command.feeling !== null && feelingLabel !== null) {
    return `${base} Matches ${feelingLabel}!`;
  }
  return base;
}

function portraitBadgeIcon(): SVGSVGElement {
  const svg = svgElement("svg", "battle-portrait-badge-svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  const add = <K extends "path" | "circle">(
    parent: Element,
    tag: K,
    className: string,
    attributes: Record<string, string>,
  ): void => {
    const node = svgElement(tag, className);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    parent.append(node);
  };
  const eager = svgElement("g", "battle-portrait-icon-eager");
  add(eager, "path", "battle-portrait-badge-shape", {
    d: "M9 2 L10.8 7.2 L16 9 L10.8 10.8 L9 16 L7.2 10.8 L2 9 L7.2 7.2 Z",
  });
  const cheering = svgElement("g", "battle-portrait-icon-cheering");
  add(cheering, "path", "battle-portrait-badge-shape", {
    d: "M9 15 C4.2 11.4 2.8 8.8 3.5 6.4 C4.3 3.9 7.2 3.5 9 6 " +
      "C10.8 3.5 13.7 3.9 14.5 6.4 C15.2 8.8 13.8 11.4 9 15 Z",
  });
  const flustered = svgElement("g", "battle-portrait-icon-flustered");
  add(flustered, "path", "battle-portrait-badge-shape", {
    d: "M9 2.4 C11.4 6.2 13.4 8.8 13.4 11.4 C13.4 13.9 11.4 15.6 9 15.6 " +
      "C6.6 15.6 4.6 13.9 4.6 11.4 C4.6 8.8 6.6 6.2 9 2.4 Z",
  });
  add(flustered, "circle", "battle-portrait-badge-shine", { cx: "7.6", cy: "10.6", r: "1.1" });
  const radiant = svgElement("g", "battle-portrait-icon-radiant");
  add(radiant, "path", "battle-portrait-badge-shape", {
    d: "M9 1.8 L11.1 6.7 L16.4 7.2 L12.3 10.6 L13.6 15.8 L9 13 " +
      "L4.4 15.8 L5.7 10.6 L1.6 7.2 L6.9 6.7 Z",
  });
  svg.append(eager, cheering, flustered, radiant);
  return svg;
}

type PortraitSlot = {
  card: HTMLDivElement;
  img: HTMLSpanElement;
  imageKey: string;
};

export function createBattleHud(root: HTMLElement): {
  render: (view: BattleHudView) => void;
  onTogether: (callback: () => void) => void;
  onFlute: (callback: () => void) => void;
  onLasso: (callback: () => void) => void;
} {
  let togetherHandler: () => void = () => undefined;
  let fluteHandler: () => void = () => undefined;
  let lassoHandler: () => void = () => undefined;
  const hud = element("div", "battle-hud");
  const energy = element("section", "battle-meter battle-energy");
  const energyLabel = element("span", "battle-meter-label");
  energyLabel.textContent = "ENERGY";
  const energyRow = element("div", "battle-energy-row");
  const leaves = element("div", "battle-leaves");
  const count = element("span", "battle-leaf-count");
  count.hidden = true;
  energyRow.append(leaves, count);
  energy.append(energyLabel, energyRow);
  const portraits = element("div", "battle-portraits");
  portraits.setAttribute("aria-label", "Party mood");
  portraits.hidden = true;
  const portraitSlots: PortraitSlot[] = [];
  const addPortraitSlot = (): PortraitSlot => {
    const card = element("div", "battle-portrait");
    const clip = element("span", "battle-portrait-clip");
    const img = element("span", "battle-portrait-img");
    clip.append(img);
    const badge = element("span", "battle-portrait-badge");
    badge.setAttribute("aria-hidden", "true");
    badge.append(portraitBadgeIcon());
    card.append(clip, badge);
    portraits.append(card);
    return { card, img, imageKey: "" };
  };
  const actionsLeft = element("div", "battle-actions-left");
  actionsLeft.hidden = true;
  const sparklePill = element("div", "battle-sparkle-pill");
  sparklePill.setAttribute("role", "status");
  sparklePill.hidden = true;
  const togetherBtn = element("button", "battle-together-btn");
  togetherBtn.type = "button";
  togetherBtn.hidden = true;
  const togetherLabel = element("span", "battle-action-label");
  togetherLabel.textContent = "Together!";
  const togetherKey = element("span", "battle-action-key");
  togetherKey.setAttribute("aria-hidden", "true");
  togetherKey.textContent = "X";
  togetherBtn.append(sparkleStarIcon(true), togetherLabel, togetherKey);
  togetherBtn.addEventListener("click", () => togetherHandler());
  const fluteBtn = element("button", "battle-flute-btn");
  fluteBtn.type = "button";
  fluteBtn.hidden = true;
  const fluteLabel = element("span", "battle-action-label");
  const fluteKey = element("span", "battle-action-key");
  fluteKey.setAttribute("aria-hidden", "true");
  fluteKey.textContent = "F";
  fluteBtn.append(fluteNoteIcon(), fluteLabel, fluteKey);
  fluteBtn.addEventListener("click", () => fluteHandler());
  const softenPill = element("div", "battle-soften-pill");
  softenPill.hidden = true;
  const softenLabel = element("span", "battle-action-label");
  softenLabel.textContent = "Softened";
  softenPill.append(softenSparkleIcon(), softenLabel);
  const lassoBtn = element("button", "battle-lasso-btn");
  lassoBtn.type = "button";
  lassoBtn.hidden = true;
  const lassoLabel = element("span", "battle-action-label");
  const lassoKey = element("span", "battle-action-key");
  lassoKey.setAttribute("aria-hidden", "true");
  lassoKey.textContent = "R";
  lassoBtn.append(lassoIcon(), lassoLabel, lassoKey);
  lassoBtn.addEventListener("click", () => lassoHandler());
  const steadyPill = element("div", "battle-steady-pill");
  steadyPill.setAttribute("role", "status");
  steadyPill.hidden = true;
  const steadyLabel = element("span", "battle-action-label");
  steadyLabel.textContent = "✦ Steady";
  steadyPill.append(steadyLabel);
  actionsLeft.append(sparklePill, togetherBtn, lassoBtn, fluteBtn, softenPill, steadyPill);
  const calm = element("section", "battle-meter battle-calm");
  const calmLabel = element("span", "battle-meter-label");
  const calmRow = element("div", "battle-calm-row");
  const calmHeart = calmHeartIcon();
  const track = element("div", "battle-calm-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  const fill = element("div", "battle-calm-fill");
  track.append(fill);
  calmRow.append(calmHeart, track);
  calm.append(calmLabel, calmRow);
  hud.append(energy, portraits, actionsLeft, calm);
  hud.hidden = true;
  root.append(hud);
  return {
    onTogether: (callback) => {
      togetherHandler = callback;
    },
    onFlute: (callback) => {
      fluteHandler = callback;
    },
    onLasso: (callback) => {
      lassoHandler = callback;
    },
    render: (view) => {
      hud.hidden = !view.visible;
      const max = Math.max(0, Math.floor(view.energyMax));
      const shownLeaves = Math.min(10, max);
      const current = Math.max(0, Math.min(max, Math.floor(view.energy)));
      const filled = max <= 10
        ? current
        : current === 0
          ? 0
          : Math.min(10, Math.max(1, Math.round((current / max) * 10)));
      while (leaves.children.length < shownLeaves) leaves.append(leafIcon());
      while (leaves.children.length > shownLeaves) leaves.lastElementChild?.remove();
      leaves.classList.toggle("is-compact", max > 5 && max <= 10);
      leaves.classList.toggle("is-capped", max > 10);
      for (let index = 0; index < leaves.children.length; index += 1) {
        leaves.children
          .item(index)
          ?.classList.toggle("is-full", index < filled);
      }
      setAttribute(energy, "aria-label", `Energy ${view.energy} of ${max}`);
      setText(energyLabel, `ENERGY  Lv ${view.level}`);
      count.hidden = max <= 10;
      setText(count, `${current}/${max}`);
      const portraitItems = view.visible ? (view.portraits ?? []) : [];
      portraits.hidden = portraitItems.length === 0;
      while (portraitSlots.length < portraitItems.length) {
        portraitSlots.push(addPortraitSlot());
      }
      while (portraitSlots.length > portraitItems.length) {
        portraitSlots.pop()?.card.remove();
      }
      portraitItems.forEach((item, index) => {
        const slot = portraitSlots[index];
        if (slot === undefined) return;
        setAttribute(slot.card, "data-member", item.id);
        setAttribute(slot.card, "data-mood", item.mood);
        setAttribute(slot.card, "data-active", item.active ? "true" : "false");
        setAttribute(slot.card, "aria-label", `${item.name}: ${item.mood}`);
        slot.card.classList.toggle("is-active", item.active);
        const key = item.image === null
          ? ""
          : `${item.image.src}|${item.image.frame.x},${item.image.frame.y},` +
            `${item.image.frame.w},${item.image.frame.h}`;
        if (slot.imageKey !== key) {
          slot.imageKey = key;
          if (item.image !== null) applyAtlasCrop(slot.img, item.image);
          else slot.img.style.backgroundImage = "";
        }
      });
      const showSparkle = view.visible && view.sparkle !== null &&
        view.sparkle.count > 0 && !view.sparkle.ready;
      sparklePill.hidden = !showSparkle;
      if (view.sparkle !== null) {
        const starMax = Math.max(1, view.sparkle.max);
        while (sparklePill.children.length < starMax) sparklePill.append(sparkleStarIcon());
        while (sparklePill.children.length > starMax) sparklePill.lastElementChild?.remove();
        for (let index = 0; index < sparklePill.children.length; index += 1) {
          sparklePill.children.item(index)?.classList.toggle("is-full", index < view.sparkle.count);
        }
        setAttribute(sparklePill, "aria-label", `Sparkle ${view.sparkle.count} of ${starMax}`);
      }
      const showTogether = view.visible && view.sparkle?.ready === true;
      togetherBtn.hidden = !showTogether;
      const showFlute = view.visible && view.fluteAssist?.available === true;
      fluteBtn.hidden = !showFlute;
      if (view.fluteAssist !== null) {
        setText(fluteLabel, view.fluteAssist.label);
        setAttribute(fluteBtn, "aria-label", `Flute: ${view.fluteAssist.label}`);
      }
      const showSoften = view.visible && view.burstSoften > 0;
      softenPill.hidden = !showSoften;
      const showLasso = view.visible && view.lassoAssist?.available === true;
      lassoBtn.hidden = !showLasso;
      if (view.lassoAssist !== null) {
        const text = view.lassoAssist.windUp ? "Pop Bubble!" : "Lasso";
        setText(lassoLabel, text);
        setAttribute(
          lassoBtn,
          "aria-label",
          view.lassoAssist.windUp ? "Lasso: Pop Bubble!" : "Lasso",
        );
      }
      const showSteady = view.visible && view.lassoSteady;
      steadyPill.hidden = !showSteady;
      actionsLeft.hidden =
        !showSparkle && !showTogether && !showFlute && !showSoften && !showLasso && !showSteady;
      setText(calmLabel, view.critterName.toUpperCase());
      setAttribute(track, "aria-label", `${view.critterName} calm`);
      const calmFraction = clamp01(view.calm);
      calmHeart.classList.toggle("is-warm", calmFraction >= 0.75);
      setAttribute(
        track,
        "aria-valuenow",
        String(Math.round(calmFraction * 100)),
      );
      fill.style.width = `${calmFraction * 100}%`;
    },
  };
}

type CommandButton = {
  button: HTMLButtonElement;
  icon: { node: HTMLSpanElement; id: string | null };
  label: HTMLSpanElement;
  detail: HTMLElement;
  // The feeling badge drawn now, so it's redrawn only when it changes.
  badge: { node: HTMLSpanElement; feeling: FeelingId | null };
};

type TreatButton = {
  button: HTMLButtonElement;
  name: HTMLSpanElement;
  count: HTMLSpanElement;
  fav: HTMLSpanElement;
};

export function createCommandMenu(root: HTMLElement): {
  render: (view: CommandMenuView) => void;
  onChoose: (callback: (index: number) => void) => void;
} {
  const menu = element("div", "battle-commands");
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Battle commands");
  menu.hidden = true;
  const tray = element("div", "battle-treat-tray");
  tray.setAttribute("role", "listbox");
  tray.setAttribute("aria-label", "Treat tray");
  tray.hidden = true;
  const trayTitle = element("div", "battle-treat-title");
  trayTitle.textContent = "TREATS";
  const trayList = element("div", "battle-treat-list");
  tray.append(trayTitle, trayList);
  root.append(menu, tray);
  let choose: (index: number) => void = () => undefined;
  const buttons: CommandButton[] = [];
  const treatButtons: TreatButton[] = [];
  const addButton = (index: number): CommandButton => {
    const button = element("button", "battle-command");
    button.type = "button";
    button.setAttribute("role", "option");
    const iconSlot = element("span", "battle-command-icon-slot");
    iconSlot.setAttribute("aria-hidden", "true");
    const copy = element("span", "battle-command-copy");
    const label = element("span", "battle-command-label");
    const detail = element("small", "battle-command-detail");
    copy.append(label, detail);
    const badge = element("span", "battle-command-badge");
    badge.hidden = true;
    button.append(iconSlot, copy, badge);
    // Disabled buttons never fire click; the check keeps that explicit.
    button.addEventListener("click", () => {
      if (!button.disabled) choose(index);
    });
    menu.append(button);
    return {
      button,
      icon: { node: iconSlot, id: null },
      label,
      detail,
      badge: { node: badge, feeling: null },
    };
  };
  const addTreatButton = (index: number): TreatButton => {
    const button = element("button", "battle-treat-item");
    button.type = "button";
    button.setAttribute("role", "option");
    const name = element("span", "battle-treat-name");
    const fav = element("span", "battle-treat-fav");
    const favHeart = icon(heartMarkup, "battle-treat-heart");
    const favText = element("span", "battle-treat-fav-text");
    favText.textContent = "Fav!";
    fav.append(favHeart, favText);
    fav.hidden = true;
    const count = element("span", "battle-treat-count");
    button.append(name, fav, count);
    button.addEventListener("click", () => choose(index));
    trayList.append(button);
    return { button, name, count, fav };
  };
  return {
    onChoose: (callback) => {
      choose = callback;
    },
    render: (view) => {
      const trayView = view.visible ? (view.treatTray ?? null) : null;
      const showTray = trayView !== null;
      menu.hidden = !view.visible || showTray;
      tray.hidden = !showTray;
      if (showTray) {
        while (treatButtons.length < trayView.items.length)
          treatButtons.push(addTreatButton(treatButtons.length));
        while (treatButtons.length > trayView.items.length)
          treatButtons.pop()?.button.remove();
        trayView.items.forEach((item, index) => {
          const entry = treatButtons[index];
          if (entry === undefined) return;
          const isBack = item.id === "back";
          setText(entry.name, item.label);
          setText(entry.count, isBack ? "" : `×${item.count}`);
          entry.count.hidden = isBack;
          entry.fav.hidden = !item.favourite;
          entry.button.classList.toggle("is-back", isBack);
          setAttribute(entry.button, "data-treat", item.id);
          setAttribute(entry.button, "aria-selected", String(index === trayView.selected));
        });
        return;
      }
      while (buttons.length < view.commands.length)
        buttons.push(addButton(buttons.length));
      while (buttons.length > view.commands.length)
        buttons.pop()?.button.remove();
      view.commands.forEach((command, index) => {
        const item = buttons[index];
        if (item === undefined) return;
        if (item.icon.id !== command.id) {
          item.icon.node.replaceChildren(commandIcon(command.id));
          item.icon.id = command.id;
        }
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
        item.button.classList.toggle("is-match", command.feeling !== null);
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
