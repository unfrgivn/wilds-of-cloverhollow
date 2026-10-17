import "./battle.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";

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
};

export type CommandMenuView = {
  visible: boolean;
  commands: BattleCommand[];
  selected: number;
};

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
  const hint = element("div", "battle-check-hint");
  const grade = element("div", "battle-grade");
  grade.setAttribute("role", "status");
  grade.hidden = true;
  root.append(ring, meter, chain, hint, grade);
  const icons: HTMLElement[] = [];
  let iconLook: "pinecone" | "bubble" | "dust" | null = null;
  const hide = (node: HTMLElement | SVGSVGElement, hidden: boolean): void => {
    node.style.display = hidden ? "none" : "";
  };
  return {
    render: (view) => {
      hide(ring, view?.kind !== "ring");
      hide(meter, view?.kind !== "charge");
      hide(chain, view?.kind !== "chain");
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
    button.append(label, detail);
    // Disabled buttons never fire click; the check keeps that explicit.
    button.addEventListener("click", () => {
      if (!button.disabled) choose(index);
    });
    menu.append(button);
    return { button, label, detail };
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
