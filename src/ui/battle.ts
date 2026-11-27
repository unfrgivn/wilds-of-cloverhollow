import "./battle.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, svgElement } from "./dom";
import { feelingMarkup, heartMarkup, icon } from "./icons";
import type {
  BattleTalk,
  FeelingId,
  FluteAssistKind,
} from "../core";
import type { DialogueView } from "./sticker";
import type { BattlePortraitItem } from "./battle-portraits";
import {
  classifyBattlePopup,
  type BattlePopupKind,
  type BattlePopupSide,
  type BattlePopupSnapshot,
  type BattlePopupSpec,
} from "./battle-popups";

export {
  classifyBattlePopup,
  type BattlePopupKind,
  type BattlePopupSide,
  type BattlePopupSnapshot,
  type BattlePopupSpec,
};

export { createBattleCheck, type BattleCheckView, type TimingGrade } from "./battle-checks";

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
  popupSnapshot?: BattlePopupSnapshot | null;
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

export type RewardStickerView = {
  visible: boolean;
  title: string;
  name: string;
  // Null outside a battle: the card keeps its last image while hidden.
  image: AtlasImage | null;
};

const leafPath = "M 2 15 C 5 2, 15 1, 22 3 C 20 12, 12 18, 2 15 M 3 14 L 19 4";

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
  const popupsLayer = element("div", "battle-popups");
  popupsLayer.setAttribute("aria-hidden", "true");
  root.append(hud, popupsLayer);
  type ActivePopup = {
    node: HTMLElement;
    spawnedAtTick: number | null;
    timer: number;
  };
  const activePopups = new Set<ActivePopup>();
  let prevPopupSnapshot: BattlePopupSnapshot | null = null;
  let popupSequence = 0;
  const popupMaxPausedTicks = 36;
  const clearPopups = (): void => {
    for (const entry of activePopups) {
      window.clearTimeout(entry.timer);
      entry.node.remove();
    }
    activePopups.clear();
  };
  const isReducedMotion = (): boolean =>
    document.documentElement.dataset.reducedMotion === "on" ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const spawnPopup = (
    spec: BattlePopupSpec,
    indexInBurst: number,
    spawnedAtTick: number | null,
  ): void => {
    const classes = ["battle-popup", `is-${spec.side}`];
    if (spec.kind !== "normal") classes.push(`is-${spec.kind}`);
    const node = element("div", classes.join(" "));
    node.dataset.popupKind = spec.kind;
    setText(node, spec.text);
    const jitterSlot = (popupSequence + indexInBurst) % 3;
    popupSequence += 1;
    const dx = (jitterSlot - 1) * 18;
    const dy = indexInBurst * -30 + (jitterSlot === 1 ? -6 : 0);
    node.style.setProperty("--popup-dx", `${dx}px`);
    node.style.setProperty("--popup-dy", `${dy}px`);
    popupsLayer.append(node);
    const entry: ActivePopup = { node, spawnedAtTick, timer: 0 };
    const remove = (): void => {
      if (!activePopups.has(entry)) return;
      activePopups.delete(entry);
      window.clearTimeout(entry.timer);
      node.remove();
    };
    node.addEventListener("animationend", remove, { once: true });
    entry.timer = window.setTimeout(remove, isReducedMotion() ? 520 : 920);
    activePopups.add(entry);
  };
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
      const nextPopup = view.popupSnapshot ?? null;
      const battleReset =
        nextPopup === null ||
        (prevPopupSnapshot !== null && prevPopupSnapshot.battleKey !== nextPopup.battleKey) ||
        (prevPopupSnapshot?.tick !== undefined &&
          nextPopup.tick !== undefined &&
          nextPopup.tick < prevPopupSnapshot.tick);
      if (battleReset) {
        clearPopups();
      } else if (nextPopup.paused === true && nextPopup.tick !== undefined) {
        for (const entry of activePopups) {
          if (
            entry.spawnedAtTick !== null &&
            nextPopup.tick - entry.spawnedAtTick >= popupMaxPausedTicks
          ) {
            window.clearTimeout(entry.timer);
            entry.node.remove();
            activePopups.delete(entry);
          }
        }
      }
      const spawned = classifyBattlePopup(prevPopupSnapshot, nextPopup);
      spawned.forEach((spec, index) => {
        spawnPopup(spec, index, nextPopup?.tick ?? null);
      });
      prevPopupSnapshot = nextPopup;
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
