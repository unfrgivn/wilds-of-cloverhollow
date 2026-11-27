import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import { feelingMarkup, heartMarkup, icon } from "./icons";
import type { FeelingId } from "../core";

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

export type RewardStickerView = {
  visible: boolean;
  title: string;
  name: string;
  // Null outside a battle: the card keeps its last image while hidden.
  image: AtlasImage | null;
};

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

/** Draws a feeling's icon into its slot, or empties and hides the slot. */
function drawFeeling(slot: HTMLElement, feeling: FeelingId | null): void {
  slot.hidden = feeling === null;
  slot.replaceChildren(...(feeling === null ? [] : [icon(feelingMarkup[feeling], "battle-icon")]));
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
  const bubbles: {
    node: HTMLElement;
    icon: HTMLElement;
    label: HTMLElement;
    feeling: FeelingId | null;
  }[] = [];
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
  onConfirm: (callback: () => void) => void;
} {
  let confirmHandler: () => void = () => undefined;
  const card = element("section", "battle-reward");
  card.setAttribute("role", "status");
  card.setAttribute("aria-live", "polite");
  const title = element("div", "battle-reward-title");
  const image = element("div", "battle-reward-image die-cut");
  image.setAttribute("role", "img");
  const name = element("div", "battle-reward-name");
  card.append(title, image, name);
  card.hidden = true;
  card.addEventListener("click", () => {
    if (!card.hidden) confirmHandler();
  });
  root.append(card);
  return {
    onConfirm: (callback) => {
      confirmHandler = callback;
    },
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
