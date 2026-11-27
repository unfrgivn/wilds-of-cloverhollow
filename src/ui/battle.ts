import "./battle.css";
import { applyAtlasCrop } from "./atlas";
import { element, setAttribute, setText, svgElement } from "./dom";
import type { BattleTalk, FluteAssistKind } from "../core";
import type { DialogueView } from "./sticker";
import type { BattlePortraitItem } from "./battle-portraits";
import {
  classifyBattlePopup,
  type BattlePopupKind,
  type BattlePopupSide,
  type BattlePopupSnapshot,
  type BattlePopupSpec,
} from "./battle-popups";
import {
  battlePeekData,
  checkMechanicLabel,
  type BattlePeekData,
  type CheckKind,
} from "./battle-peek";

export {
  battlePeekData,
  checkMechanicLabel,
  classifyBattlePopup,
  type BattlePeekData,
  type BattlePopupKind,
  type BattlePopupSide,
  type BattlePopupSnapshot,
  type BattlePopupSpec,
  type CheckKind,
};

export { createBattleCheck, type BattleCheckView, type TimingGrade } from "./battle-checks";

export {
  battleCommandPreview,
  createCommandMenu,
  createFeelingBubble,
  createRewardSticker,
  createWindUpBubbles,
  type BattleCommand,
  type BattleTreatItem,
  type CommandMenuView,
  type FeelingBubbleView,
  type RewardStickerView,
  type WindUpView,
} from "./battle-overlays";

export type BattleActionKeys = {
  together: string;
  lasso: string;
  flute: string;
  peek: string;
};

export function battleActionKeys(mode: "keyboard" | "gamepad"): BattleActionKeys {
  if (mode === "gamepad") {
    return { together: "B", lasso: "LB", flute: "RB", peek: "View" };
  }
  return { together: "X", lasso: "R", flute: "F", peek: "I" };
}

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
  canPeek?: boolean;
  peekOpen?: boolean;
  peek?: BattlePeekData | null;
  inputMode?: "keyboard" | "gamepad";
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
  onPeekToggle: (callback: () => void) => void;
  onPeekClose: (callback: () => void) => void;
} {
  let togetherHandler: () => void = () => undefined;
  let fluteHandler: () => void = () => undefined;
  let lassoHandler: () => void = () => undefined;
  let peekToggleHandler: () => void = () => undefined;
  let peekCloseHandler: () => void = () => undefined;
  let peekable = false;
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
  calm.addEventListener("click", () => {
    if (peekable) peekToggleHandler();
  });
  calm.addEventListener("keydown", (event) => {
    if (!peekable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      peekToggleHandler();
    }
  });
  hud.append(energy, portraits, actionsLeft, calm);
  hud.hidden = true;
  const peekCard = element("section", "battle-peek-card");
  peekCard.tabIndex = -1;
  peekCard.setAttribute("role", "region");
  peekCard.setAttribute("aria-label", "Critter field guide");
  peekCard.hidden = true;
  const peekHead = element("div", "battle-peek-head");
  const peekTitleRow = element("div", "battle-peek-title-row");
  const peekName = element("span", "battle-peek-name");
  const peekLevel = element("span", "battle-peek-level");
  const peekFam = element("span", "battle-peek-fam");
  peekTitleRow.append(peekName, peekLevel, peekFam);
  const peekClose = element("button", "battle-peek-close");
  peekClose.type = "button";
  peekClose.textContent = "×";
  peekClose.setAttribute("aria-label", "Close critter field guide");
  peekClose.addEventListener("click", () => peekCloseHandler());
  peekHead.append(peekTitleRow, peekClose);
  const peekMeta = element("div", "battle-peek-meta");
  const peekLand = element("span", "battle-peek-badge is-land");
  const peekCheck = element("span", "battle-peek-badge is-check");
  peekMeta.append(peekLand, peekCheck);
  const peekFeelingsRow = element("div", "battle-peek-row");
  const peekFeelingsLabel = element("span", "battle-peek-label");
  peekFeelingsLabel.textContent = "Feelings";
  const peekFeelingsBody = element("div", "battle-peek-body");
  peekFeelingsRow.append(peekFeelingsLabel, peekFeelingsBody);
  const peekTreatsRow = element("div", "battle-peek-row");
  const peekTreatsLabel = element("span", "battle-peek-label");
  peekTreatsLabel.textContent = "Treats";
  const peekTreatsBody = element("div", "battle-peek-body");
  peekTreatsRow.append(peekTreatsLabel, peekTreatsBody);
  const peekTip = element("div", "battle-peek-tip");
  peekCard.append(peekHead, peekMeta, peekFeelingsRow, peekTreatsRow, peekTip);
  let lastPeekSig = "";
  let prevPeekOpen = false;
  let peekReturnFocusEl: HTMLElement | null = null;
  const popupsLayer = element("div", "battle-popups");
  popupsLayer.setAttribute("aria-live", "polite");
  popupsLayer.setAttribute("aria-atomic", "false");
  root.append(hud, peekCard, popupsLayer);
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
    if (spec.kind !== "normal") classes.push(`is-${spec.kind}`, `battle-popup-${spec.kind}`);
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
    onPeekToggle: (callback) => {
      peekToggleHandler = callback;
    },
    onPeekClose: (callback) => {
      peekCloseHandler = callback;
    },
    render: (view) => {
      hud.hidden = !view.visible;
      const keys = battleActionKeys(view.inputMode ?? "keyboard");
      setText(togetherKey, keys.together);
      setText(lassoKey, keys.lasso);
      setText(fluteKey, keys.flute);
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
      peekable = view.visible && view.canPeek === true;
      calm.classList.toggle("is-peekable", peekable);
      if (peekable) {
        setAttribute(calm, "role", "button");
        setAttribute(calm, "tabindex", "0");
        setAttribute(calm, "aria-expanded", String(view.peekOpen === true));
        setAttribute(calm, "aria-label", `${view.critterName}. Inspect critter field guide`);
        setAttribute(calm, "title", `Inspect critter field guide (${keys.peek})`);
      } else {
        if (calm.hasAttribute("role")) calm.removeAttribute("role");
        if (calm.hasAttribute("tabindex")) calm.removeAttribute("tabindex");
        if (calm.hasAttribute("aria-expanded")) calm.removeAttribute("aria-expanded");
        if (calm.hasAttribute("aria-label")) calm.removeAttribute("aria-label");
        if (calm.hasAttribute("title")) calm.removeAttribute("title");
      }
      const peek = view.visible && view.peekOpen === true ? (view.peek ?? null) : null;
      const nextPeekOpen = peek !== null;
      peekCard.hidden = !nextPeekOpen;
      if (nextPeekOpen && !prevPeekOpen) {
        peekReturnFocusEl =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        peekCard.focus({ preventScroll: true });
      } else if (!nextPeekOpen && prevPeekOpen) {
        const returnTarget = peekReturnFocusEl;
        peekReturnFocusEl = null;
        if (
          view.visible &&
          returnTarget !== null &&
          returnTarget.isConnected &&
          returnTarget.closest("[hidden]") === null
        ) {
          returnTarget.focus({ preventScroll: true });
        }
      }
      prevPeekOpen = nextPeekOpen;
      if (peek !== null) {
        const sig = [
          peek.critterId,
          peek.name,
          peek.level,
          peek.landName,
          peek.familiarity,
          peek.familiarityLabel,
          peek.checkLabel,
          peek.favouriteTreats.join(","),
          peek.knownFeelings === null ? "hidden" : peek.knownFeelings.join(","),
          peek.tip,
        ].join("|");
        if (sig !== lastPeekSig) {
          lastPeekSig = sig;
          setAttribute(peekCard, "data-critter", peek.critterId);
          setText(peekName, peek.name);
          setText(peekLevel, `Lv ${peek.level}`);
          setText(peekFam, peek.familiarityLabel);
          setAttribute(peekFam, "data-familiarity", peek.familiarity);
          setText(peekLand, peek.landName);
          setText(peekCheck, peek.checkLabel);
          if (peek.knownFeelings !== null && peek.knownFeelings.length > 0) {
            const pills = peek.knownFeelings.map((feelingLabel) => {
              const pill = element("span", "battle-peek-feeling");
              pill.textContent = feelingLabel;
              return pill;
            });
            peekFeelingsBody.replaceChildren(...pills);
          } else {
            const hint = element("span", "battle-peek-hint");
            hint.textContent = "Calm once or carry the lantern to spot feelings.";
            peekFeelingsBody.replaceChildren(hint);
          }
          if (peek.favouriteTreats.length > 0) {
            const pills = peek.favouriteTreats.map((treatName) => {
              const pill = element("span", "battle-peek-treat");
              pill.textContent = `♥ Fav: ${treatName}`;
              return pill;
            });
            peekTreatsBody.replaceChildren(...pills);
          } else {
            const hint = element("span", "battle-peek-hint");
            hint.textContent = "Try treats in battle to discover favourites!";
            peekTreatsBody.replaceChildren(hint);
          }
          setText(peekTip, peek.tip);
        }
      }
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
