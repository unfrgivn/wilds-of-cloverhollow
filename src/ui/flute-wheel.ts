import type { Direction, State, World } from "../core";
import "./flute-wheel.css";

export type FluteWheelView = {
  visible: boolean;
  bellId: string;
  hintLabel: string;
  sequence: readonly Direction[];
  entered: readonly Direction[];
  status: "listening" | "matched" | "wrong";
  lastNote: Direction | null;
  noteSeq: number;
};

const COMPASS_BUTTONS: readonly {
  index: number;
  note: Direction;
  glyph: string;
  name: string;
  aria: string;
}[] = [
  { index: 0, note: "up", glyph: "▲", name: "Red", aria: "Play Red note (Up)" },
  { index: 1, note: "right", glyph: "▶\uFE0E", name: "Yellow", aria: "Play Yellow note (Right)" },
  { index: 2, note: "down", glyph: "▼", name: "Green", aria: "Play Green note (Down)" },
  { index: 3, note: "left", glyph: "◀\uFE0E", name: "Blue", aria: "Play Blue note (Left)" },
];

const NOTE_NAMES: Readonly<Record<Direction, string>> = {
  up: "Red",
  right: "Yellow",
  down: "Green",
  left: "Blue",
};

const HIDDEN_VIEW: FluteWheelView = {
  visible: false,
  bellId: "",
  hintLabel: "",
  sequence: [],
  entered: [],
  status: "listening",
  lastNote: null,
  noteSeq: 0,
};

/** Pure projection from world + state into the Harmony Flute Wheel overlay model. */
export function buildFluteWheelView(world: World, state: State): FluteWheelView {
  const wheel = state.puzzleArea?.fluteWheel;
  const overworldVisible =
    state.battle === null &&
    state.arcade === null &&
    state.dialogue === null &&
    state.cutscene === undefined &&
    !state.journalOpen &&
    state.finale === null;
  if (wheel === undefined || !overworldVisible) return HIDDEN_VIEW;
  const bell = world.areas[state.area]?.puzzles?.bells?.find((item) => item.id === wheel.bellId);
  const sequence = bell?.sequence ?? [];
  const hintLabel =
    bell?.hintLabel ?? sequence.map((note) => NOTE_NAMES[note]).join(" · ");
  return {
    visible: true,
    bellId: wheel.bellId,
    hintLabel,
    sequence,
    entered: wheel.entered,
    status: wheel.status,
    lastNote: wheel.lastNote ?? null,
    noteSeq: wheel.noteSeq,
  };
}

export type FluteWheelOverlay = {
  render: (view: FluteWheelView) => void;
  onNote: (callback: (index: number) => void) => void;
  onClose: (callback: () => void) => void;
  hide: () => void;
};

/** Mounts the die-cut Harmony Flute Wheel dialog into `root`. */
export function createFluteWheel(root: HTMLElement): FluteWheelOverlay {
  const panel = document.createElement("section");
  panel.className = "sticker-ui flute-wheel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Harmony Flute");
  panel.hidden = true;

  const head = document.createElement("div");
  head.className = "flute-wheel-head";
  const title = document.createElement("h2");
  title.className = "flute-wheel-title";
  title.textContent = "Harmony Flute";
  const closeBtn = document.createElement("button");
  closeBtn.className = "flute-wheel-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close Harmony Flute");
  head.append(title, closeBtn);

  const clue = document.createElement("div");
  clue.className = "flute-wheel-clue";
  const orbs = document.createElement("div");
  orbs.className = "flute-wheel-orbs";
  orbs.setAttribute("aria-live", "polite");

  const compass = document.createElement("div");
  compass.className = "flute-wheel-compass";
  const center = document.createElement("span");
  center.className = "flute-wheel-center";
  center.setAttribute("aria-hidden", "true");
  center.textContent = "♪";
  compass.append(center);

  let noteHandler: (index: number) => void = () => undefined;
  let closeHandler: () => void = () => undefined;

  const buttons = COMPASS_BUTTONS.map((spec) => {
    const btn = document.createElement("button");
    btn.className = "flute-wheel-btn";
    btn.type = "button";
    btn.dataset.note = spec.note;
    btn.setAttribute("aria-label", spec.aria);
    const glyph = document.createElement("span");
    glyph.className = "flute-wheel-glyph";
    glyph.textContent = spec.glyph;
    const name = document.createElement("span");
    name.className = "flute-wheel-name";
    name.textContent = spec.name;
    btn.append(glyph, name);
    btn.addEventListener("click", () => noteHandler(spec.index));
    compass.append(btn);
    return { note: spec.note, el: btn };
  });

  closeBtn.addEventListener("click", () => closeHandler());
  panel.append(head, clue, orbs, compass);
  root.append(panel);

  let lastKey = "";

  const syncDataset = (open: boolean): void => {
    if (open) document.documentElement.dataset.fluteWheel = "open";
    else delete document.documentElement.dataset.fluteWheel;
  };

  const hide = (): void => {
    panel.hidden = true;
    panel.classList.remove("is-matched", "is-wrong");
    syncDataset(false);
    lastKey = "";
  };

  const render = (view: FluteWheelView): void => {
    if (!view.visible) {
      if (!panel.hidden || document.documentElement.dataset.fluteWheel !== undefined) {
        hide();
      }
      return;
    }
    syncDataset(true);
    const key =
      `${view.bellId}|${view.hintLabel}|${view.sequence.join(",")}|` +
      `${view.entered.join(",")}|${view.status}|${view.lastNote ?? ""}|${view.noteSeq}`;
    if (key === lastKey && !panel.hidden) return;
    lastKey = key;

    panel.hidden = false;
    panel.classList.toggle("is-matched", view.status === "matched");
    panel.classList.toggle("is-wrong", view.status === "wrong");

    clue.setAttribute("aria-label", view.hintLabel || "Melody clue");
    clue.replaceChildren(
      ...view.sequence.map((note) => {
        const dot = document.createElement("span");
        dot.className = "flute-wheel-clue-dot";
        dot.dataset.note = note;
        dot.setAttribute("aria-hidden", "true");
        return dot;
      }),
    );

    const orbCount = Math.max(3, view.sequence.length);
    const orbNodes: HTMLSpanElement[] = [];
    for (let i = 0; i < orbCount; i += 1) {
      const orb = document.createElement("span");
      orb.className = "flute-wheel-orb";
      const note = view.entered[i];
      if (note !== undefined) {
        orb.classList.add("is-filled");
        orb.dataset.note = note;
      }
      orbNodes.push(orb);
    }
    orbs.replaceChildren(...orbNodes);

    for (const button of buttons) {
      button.el.classList.toggle("is-last", view.lastNote === button.note && view.noteSeq > 0);
    }
  };

  return {
    render,
    onNote: (callback) => { noteHandler = callback; },
    onClose: (callback) => { closeHandler = callback; },
    hide,
  };
}
