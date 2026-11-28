import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, svgElement } from "./dom";
import type { Point, WhackSlot } from "../core";
import type { TimingGrade } from "./battle-checks";
import type { HudInputMode } from "./hud-hints";

export type BattleCheckV2View =
  | {
      kind: "which-one";
      x: number;
      y: number;
      cupSize: number;
      cupSpacing: number;
      phase: "show" | "shuffle" | "pick";
      hidingCup: number;
      cupSlots: [number, number, number];
      activeSwap: { pair: [number, number]; progress: number } | null;
      cursor: number;
      picked: number | null;
      targetSlot: number;
      time: number;
      revealProgress: number;
      cups: readonly (AtlasImage | null)[];
      star: AtlasImage | null;
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    }
  | {
      kind: "whack";
      x: number;
      y: number;
      slotSize: number;
      spread: number;
      activeSlot: WhackSlot | null;
      activeIndex: number;
      activeProgress: number;
      results: ("pending" | "hit" | "miss")[];
      lastSwing: { slot: WhackSlot; hit: boolean } | null;
      art: {
        slot: AtlasImage | null;
        pop: AtlasImage | null;
        hit: AtlasImage | null;
      };
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    }
  | {
      kind: "spin-snag";
      rect: { x: number; y: number; width: number; height: number };
      phase: "spin" | "snag";
      turns: number;
      spinsNeeded: number;
      lastSector: number;
      spinTime: number;
      snagProgress: number;
      snagTarget: number;
      greatWindow: [number, number];
      goodWindow: [number, number];
      coil: AtlasImage | null;
      grade: TimingGrade | null;
      hint: string | null;
      hintAt: { x: number; y: number };
    };

export type BattleCheckV2Callbacks = {
  onChooseSlot: (slot: number) => void;
  onWhackSlot: (slotIndex: number) => void;
  onSpinArrow: (dir: Point) => void;
  onSnagConfirm: () => void;
  onSpinPointer: (phase: "down" | "move" | "up", event: PointerEvent) => void;
};

type WhackSlotMeta = {
  index: number;
  slot: WhackSlot;
  dx: number;
  dy: number;
  label: string;
};

const WHACK_SLOT_META: readonly WhackSlotMeta[] = [
  { index: 0, slot: "up", dx: 0, dy: -1, label: "Up ticket slot" },
  { index: 1, slot: "right", dx: 1, dy: 0, label: "Right ticket slot" },
  { index: 2, slot: "down", dx: 0, dy: 1, label: "Down ticket slot" },
  { index: 3, slot: "left", dx: -1, dy: 0, label: "Left ticket slot" },
  { index: 4, slot: "middle", dx: 0, dy: 0, label: "Center ticket slot" },
];

/** Returns the adaptive keyboard/gamepad keycap for a Whack-a-Ticket slot. */
export function whackKeyCap(slot: WhackSlot, inputMode: HudInputMode = "keyboard"): string {
  switch (slot) {
    case "up":
      return "↑";
    case "right":
      return "→";
    case "down":
      return "↓";
    case "left":
      return "←";
    case "middle":
      return inputMode === "gamepad" ? "A" : "Z";
  }
}

/** Returns the adaptive Spin-Snag action button label for keyboard or gamepad. */
export function spinSnagButtonLabel(
  snagReady: boolean,
  inputMode: HudInputMode = "keyboard",
): string {
  if (!snagReady) return "SPIN!";
  return inputMode === "gamepad" ? "SNAG! [A]" : "SNAG!";
}

const SPIN_PETALS: readonly {
  sector: number;
  key: string;
  arrow: string;
  label: string;
  dir: Point;
}[] = [
  { sector: 0, key: "up", arrow: "↑", label: "Spin up", dir: { x: 0, y: -1 } },
  { sector: 1, key: "right", arrow: "→", label: "Spin right", dir: { x: 1, y: 0 } },
  { sector: 2, key: "down", arrow: "↓", label: "Spin down", dir: { x: 0, y: 1 } },
  { sector: 3, key: "left", arrow: "←", label: "Spin left", dir: { x: -1, y: 0 } },
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function imageKey(image: AtlasImage | null): string {
  if (image === null) return "";
  return `${image.src}|${image.frame.x},${image.frame.y},${image.frame.w},${image.frame.h}`;
}

function reducedMotionOn(): boolean {
  return document.documentElement.dataset.reducedMotion === "on" ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/** Mounts the 3 Track E7 v2 battle check DOM overlays (`which-one`, `whack`, `spin-snag`). */
export function createBattleChecksV2(
  root: HTMLElement,
  callbacks: BattleCheckV2Callbacks,
): {
  render: (
    view: BattleCheckV2View | null,
    renderGrade: (grade: TimingGrade | null, x: number, y: number) => void,
    inputMode?: HudInputMode,
  ) => void;
} {
  // 1. Which-One cup-shuffle board.
  const whichLayer = element("div", "battle-which-one");
  whichLayer.style.display = "none";
  const whichHead = element("div", "battle-which-one-head");
  const whichPhase = element("span", "battle-which-one-phase");
  whichPhase.setAttribute("role", "status");
  whichPhase.setAttribute("aria-live", "polite");
  whichPhase.setAttribute("aria-atomic", "true");
  const whichTimer = element("div", "battle-which-one-timer");
  const whichTimeFill = element("div", "battle-which-one-time-fill");
  whichTimer.append(whichTimeFill);
  whichHead.append(whichPhase, whichTimer);
  const whichStage = element("div", "battle-which-one-stage");
  const whichStar = element("span", "battle-which-one-star");
  whichStar.setAttribute("aria-hidden", "true");
  whichStage.append(whichStar);
  let whichStarKey = "";
  const cupCurrentSlot: [number, number, number] = [0, 1, 2];
  const cupNodes = [0, 1, 2].map((cupIdx) => {
    const button = element("button", `battle-which-one-cup is-cup-${cupIdx}`);
    button.type = "button";
    button.dataset.cup = String(cupIdx);
    const art = element("span", "battle-which-one-cup-art");
    art.setAttribute("aria-hidden", "true");
    const badge = element("span", "battle-which-one-cup-num");
    badge.setAttribute("aria-hidden", "true");
    button.append(art, badge);
    button.addEventListener("pointerdown", (event) => {
      if (button.disabled) return;
      event.preventDefault();
      callbacks.onChooseSlot(cupCurrentSlot[cupIdx] ?? cupIdx);
    });
    whichStage.append(button);
    return { button, art, badge, artKey: "" };
  });
  whichLayer.append(whichHead, whichStage);

  // 2. Whack-a-Ticket 5-slot arcade board.
  const whackLayer = element("div", "battle-whack");
  whackLayer.style.display = "none";
  const whackDots = element("div", "battle-whack-dots");
  const whackDotNodes: HTMLElement[] = [];
  const whackBoard = element("div", "battle-whack-board");
  const whackSlots = WHACK_SLOT_META.map((meta) => {
    const button = element("button", `battle-whack-slot is-${meta.slot}`);
    button.type = "button";
    button.dataset.slot = meta.slot;
    button.setAttribute("aria-label", meta.label);
    const art = element("span", "battle-whack-art");
    art.setAttribute("aria-hidden", "true");
    const key = element("span", "battle-whack-key");
    key.setAttribute("aria-hidden", "true");
    key.textContent = whackKeyCap(meta.slot);
    button.append(art, key);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callbacks.onWhackSlot(meta.index);
    });
    whackBoard.append(button);
    return { meta, button, art, key, artKey: "" };
  });
  whackLayer.append(whackDots, whackBoard);

  // 3. Spin-Snag circular lasso pad.
  const spinLayer = element("div", "battle-spin-snag");
  spinLayer.style.display = "none";
  const spinHead = element("div", "battle-spin-snag-head");
  const spinBeads = element("div", "battle-spin-snag-beads");
  const spinBeadNodes: HTMLElement[] = [];
  const spinPhase = element("span", "battle-spin-snag-phase");
  const spinTimer = element("div", "battle-spin-snag-timer");
  const spinTimeFill = element("div", "battle-spin-snag-time-fill");
  spinTimer.append(spinTimeFill);
  spinHead.append(spinBeads, spinPhase, spinTimer);
  const spinPad = element("div", "battle-spin-snag-pad");
  const spinCoil = element("span", "battle-spin-snag-coil");
  spinCoil.setAttribute("aria-hidden", "true");
  let spinCoilKey = "";
  const spinSvg = svgElement("svg", "battle-spin-snag-svg");
  spinSvg.setAttribute("aria-hidden", "true");
  spinSvg.setAttribute("viewBox", "0 0 200 200");
  const snagTargetCircle = svgElement("circle", "battle-spin-snag-target");
  const snagRingCircle = svgElement("circle", "battle-spin-snag-ring");
  for (const node of [snagTargetCircle, snagRingCircle]) {
    node.setAttribute("cx", "100");
    node.setAttribute("cy", "100");
  }
  spinSvg.append(snagTargetCircle, snagRingCircle);
  const spinPetalButtons = SPIN_PETALS.map((petal) => {
    const button = element("button", `battle-spin-snag-petal is-${petal.key}`);
    button.type = "button";
    button.dataset.sector = String(petal.sector);
    button.textContent = petal.arrow;
    button.setAttribute("aria-label", petal.label);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onSpinArrow(petal.dir);
    });
    return button;
  });
  const snagBtn = element("button", "battle-spin-snag-btn");
  snagBtn.type = "button";
  snagBtn.textContent = "SNAG!";
  snagBtn.setAttribute("aria-label", "Snag lasso now");
  snagBtn.hidden = true;
  snagBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    callbacks.onSnagConfirm();
  });
  let dragPointerId: number | null = null;
  spinPad.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("button") !== null) return;
    event.preventDefault();
    dragPointerId = event.pointerId;
    try {
      spinPad.setPointerCapture(event.pointerId);
    } catch {
      // Ignore synthetic pointer capture rejections.
    }
    callbacks.onSpinPointer("down", event);
  });
  spinPad.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId) return;
    callbacks.onSpinPointer("move", event);
  });
  const endDrag = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;
    dragPointerId = null;
    callbacks.onSpinPointer("up", event);
  };
  spinPad.addEventListener("pointerup", endDrag);
  spinPad.addEventListener("pointercancel", endDrag);
  spinPad.append(spinCoil, spinSvg, ...spinPetalButtons, snagBtn);
  spinLayer.append(spinHead, spinPad);

  root.append(whichLayer, whackLayer, spinLayer);

  return {
    render: (view, renderGrade, inputMode = "keyboard") => {
      whichLayer.style.display = view?.kind === "which-one" ? "" : "none";
      whackLayer.style.display = view?.kind === "whack" ? "" : "none";
      spinLayer.style.display = view?.kind === "spin-snag" ? "" : "none";
      if (view === null) return;
      const reduced = reducedMotionOn();

      if (view.kind === "which-one") {
        whichLayer.style.left = `${view.x}px`;
        whichLayer.style.top = `${view.y}px`;
        setAttribute(whichLayer, "data-phase", view.phase);
        setText(
          whichPhase,
          view.phase === "show"
            ? "WATCH!"
            : view.phase === "shuffle"
              ? "SHUFFLING..."
              : "PICK A CUP!",
        );
        whichTimer.classList.toggle("is-active", view.phase === "pick");
        whichTimeFill.style.width = `${(view.phase === "pick" ? clamp01(view.time) : 1) * 100}%`;
        const stageW = view.cupSpacing * 2 + view.cupSize + 24;
        const stageH = view.cupSize + 52;
        whichStage.style.width = `${stageW}px`;
        whichStage.style.height = `${stageH}px`;
        const slotX = (slot: number): number => stageW / 2 + (slot - 1) * view.cupSpacing;
        const baseY = stageH / 2 + 12;

        const starKey = imageKey(view.star);
        if (whichStarKey !== starKey) {
          whichStarKey = starKey;
          if (view.star !== null) applyAtlasCrop(whichStar, view.star);
          else whichStar.style.backgroundImage = "";
        }
        const showStar = view.phase === "show" || view.picked !== null;
        whichStar.hidden = !showStar;
        if (showStar) {
          const starSlot = view.phase === "show"
            ? (view.cupSlots[view.hidingCup] ?? view.hidingCup)
            : view.targetSlot;
          const starSize = Math.round(view.cupSize * 0.54);
          whichStar.style.width = `${starSize}px`;
          whichStar.style.height = `${starSize}px`;
          whichStar.style.left = `${slotX(starSlot)}px`;
          whichStar.style.top = `${baseY + 8}px`;
        }

        cupNodes.forEach((node, cupIdx) => {
          const slot = view.cupSlots[cupIdx] ?? cupIdx;
          cupCurrentSlot[cupIdx] = slot;
          let cx = slotX(slot);
          let cy = baseY;
          if (view.phase === "shuffle" && view.activeSwap !== null) {
            const [a, b] = view.activeSwap.pair;
            const p = clamp01(view.activeSwap.progress);
            if (slot === a) {
              cx = slotX(a) + (slotX(b) - slotX(a)) * p;
              cy = baseY - (reduced ? 0 : Math.sin(p * Math.PI) * 22);
            } else if (slot === b) {
              cx = slotX(b) + (slotX(a) - slotX(b)) * p;
              cy = baseY + (reduced ? 0 : Math.sin(p * Math.PI) * 18);
            }
          } else if (view.phase === "show" && cupIdx === view.hidingCup) {
            const lift = reduced ? 28 : Math.sin(clamp01(view.revealProgress) * Math.PI) * 38;
            cy = baseY - lift;
          } else if (view.picked !== null && slot === view.picked) {
            cy = baseY - 26;
          }
          const btnSize = Math.max(64, view.cupSize);
          node.button.style.width = `${btnSize}px`;
          node.button.style.height = `${btnSize}px`;
          node.button.style.left = `${cx}px`;
          node.button.style.top = `${cy}px`;
          const pickable = view.phase === "pick" && view.picked === null;
          node.button.disabled = !pickable;
          node.button.classList.toggle("is-cursor", pickable && slot === view.cursor);
          setAttribute(node.button, "aria-label", `Pick cup ${slot + 1}`);
          node.badge.hidden = !pickable;
          setText(node.badge, String(slot + 1));
          const art = view.cups[cupIdx] ?? null;
          const key = imageKey(art);
          if (node.artKey !== key) {
            node.artKey = key;
            if (art !== null) applyAtlasCrop(node.art, art);
            else node.art.style.backgroundImage = "";
          }
        });
        renderGrade(view.grade, view.x, view.y - stageH / 2 - 36);
        return;
      }

      if (view.kind === "whack") {
        whackLayer.style.left = `${view.x}px`;
        whackLayer.style.top = `${view.y}px`;
        while (whackDotNodes.length < view.results.length) {
          const dot = element("span", "battle-whack-dot");
          whackDots.append(dot);
          whackDotNodes.push(dot);
        }
        while (whackDotNodes.length > view.results.length) whackDotNodes.pop()?.remove();
        whackDotNodes.forEach((dot, idx) => {
          const res = view.results[idx] ?? "pending";
          dot.classList.toggle("is-hit", res === "hit");
          dot.classList.toggle("is-miss", res === "miss");
          dot.classList.toggle("is-current", idx === view.activeIndex && res === "pending");
        });
        const slotPx = Math.max(48, view.slotSize);
        const boardPx = view.spread * 2 + slotPx + 18;
        whackBoard.style.width = `${boardPx}px`;
        whackBoard.style.height = `${boardPx}px`;
        const center = boardPx / 2;
        whackSlots.forEach((entry) => {
          const isActive = view.activeSlot === entry.meta.slot;
          const isHit = view.lastSwing?.slot === entry.meta.slot && view.lastSwing.hit;
          const isMiss = view.lastSwing?.slot === entry.meta.slot && !view.lastSwing.hit;
          entry.button.style.width = `${slotPx}px`;
          entry.button.style.height = `${slotPx}px`;
          entry.button.style.left = `${center + entry.meta.dx * view.spread}px`;
          entry.button.style.top = `${center + entry.meta.dy * view.spread}px`;
          entry.button.classList.toggle("is-active", isActive);
          entry.button.classList.toggle("is-hit", isHit);
          entry.button.classList.toggle("is-miss", isMiss);
          setText(entry.key, whackKeyCap(entry.meta.slot, inputMode));
          const art = isHit ? view.art.hit : isActive ? view.art.pop : view.art.slot;
          const key = imageKey(art);
          if (entry.artKey !== key) {
            entry.artKey = key;
            if (art !== null) applyAtlasCrop(entry.art, art);
            else entry.art.style.backgroundImage = "";
          }
        });
        renderGrade(view.grade, view.x, view.y - boardPx / 2 - 26);
        return;
      }

      // Spin-Snag lasso pad.
      const { rect } = view;
      spinLayer.style.left = `${rect.x}px`;
      spinLayer.style.top = `${rect.y}px`;
      spinLayer.style.width = `${rect.width}px`;
      spinLayer.style.height = `${rect.height}px`;
      setAttribute(spinLayer, "data-phase", view.phase);
      setText(spinPhase, view.phase === "spin" ? "SPIN!" : "SNAG!");
      spinTimer.classList.toggle("is-active", view.phase === "spin");
      spinTimeFill.style.width = `${(view.phase === "spin" ? clamp01(view.spinTime) : 1) * 100}%`;
      while (spinBeadNodes.length < view.spinsNeeded) {
        const bead = element("span", "battle-spin-snag-bead");
        spinBeads.append(bead);
        spinBeadNodes.push(bead);
      }
      while (spinBeadNodes.length > view.spinsNeeded) spinBeadNodes.pop()?.remove();
      spinBeadNodes.forEach((bead, idx) => {
        bead.classList.toggle("is-filled", idx < view.turns);
      });
      const coilKey = imageKey(view.coil);
      if (spinCoilKey !== coilKey) {
        spinCoilKey = coilKey;
        if (view.coil !== null) applyAtlasCrop(spinCoil, view.coil);
        else spinCoil.style.backgroundImage = "";
      }
      spinCoil.style.transform = reduced
        ? "translate(-50%, -50%)"
        : `translate(-50%, -50%) rotate(${view.turns * 45}deg)`;
      const inSnag = view.phase === "snag";
      spinPetalButtons.forEach((btn, idx) => {
        btn.hidden = false;
        btn.disabled = inSnag;
        btn.classList.toggle("is-snag", inSnag);
        btn.classList.toggle("is-lit", !inSnag && view.lastSector === idx);
      });
      spinSvg.style.display = inSnag ? "" : "none";
      setText(snagBtn, spinSnagButtonLabel(inSnag, inputMode));
      snagBtn.hidden = !inSnag;
      if (inSnag) {
        const maxR = 86;
        snagTargetCircle.setAttribute("r", String(maxR * (1 - clamp01(view.snagTarget))));
        snagRingCircle.setAttribute("r", String(maxR * (1 - clamp01(view.snagProgress))));
      }
      renderGrade(view.grade, rect.x + rect.width / 2, rect.y - 24);
    },
  };
}
