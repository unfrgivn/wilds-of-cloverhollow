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

export type TimingRingView = {
  visible: boolean;
  /** Ring centre in CSS px. */
  x: number;
  y: number;
  /** Ring radius in CSS px at progress 0. */
  radius: number;
  /** 0 = full size, 1 = collapsed to the centre. */
  progress: number;
  /** Where the target circle sits on the same 0..1 scale. */
  target: number;
  grade: TimingGrade | null;
};

export type RewardStickerView = {
  visible: boolean;
  title: string;
  name: string;
  image: AtlasImage;
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
        leaves.children.item(index)?.classList.toggle("is-full", index < view.energy);
      }
      setAttribute(energy, "aria-label", `Energy ${view.energy} of ${max}`);
      setText(calmLabel, view.critterName.toUpperCase());
      setAttribute(track, "aria-label", `${view.critterName} calm`);
      setAttribute(track, "aria-valuenow", String(Math.round(clamp01(view.calm) * 100)));
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
      while (buttons.length < view.commands.length) buttons.push(addButton(buttons.length));
      while (buttons.length > view.commands.length) buttons.pop()?.button.remove();
      view.commands.forEach((command, index) => {
        const item = buttons[index];
        if (item === undefined) return;
        setText(item.label, command.label);
        setText(item.detail, command.detail ?? "");
        item.detail.hidden = command.detail === null;
        setAttribute(item.button, "aria-selected", String(index === view.selected));
        setAttribute(item.button, "aria-disabled", String(command.disabled));
        item.button.disabled = command.disabled;
      });
    },
  };
}

export function createTimingRing(root: HTMLElement): {
  render: (view: TimingRingView) => void;
} {
  const ring = svgElement("svg", "battle-ring");
  ring.setAttribute("aria-hidden", "true");
  const rim = svgElement("circle", "battle-ring-rim");
  const ink = svgElement("circle", "battle-ring-ink");
  const target = svgElement("circle", "battle-ring-target");
  ring.append(rim, ink, target);
  const grade = element("div", "battle-grade");
  grade.setAttribute("role", "status");
  ring.style.display = "none";
  grade.hidden = true;
  root.append(ring, grade);
  return {
    render: (view) => {
      ring.style.display = view.visible ? "" : "none";
      const size = String(view.radius * 2);
      setAttribute(ring, "width", size);
      setAttribute(ring, "height", size);
      setAttribute(ring, "viewBox", `0 0 ${size} ${size}`);
      ring.style.left = `${view.x}px`;
      ring.style.top = `${view.y}px`;
      const centre = String(view.radius);
      for (const circle of [rim, ink, target]) {
        setAttribute(circle, "cx", centre);
        setAttribute(circle, "cy", centre);
      }
      const ringRadius = String(view.radius * (1 - clamp01(view.progress)));
      const targetRadius = view.radius * (1 - clamp01(view.target));
      setAttribute(rim, "r", ringRadius);
      setAttribute(ink, "r", ringRadius);
      setAttribute(target, "r", String(targetRadius));
      grade.hidden = !view.visible || view.grade === null;
      if (view.grade === null) return;
      // The grade sits centred just above the target circle.
      grade.style.left = `${view.x}px`;
      grade.style.top = `${view.y - targetRadius - gradeGap}px`;
      setAttribute(grade, "class", `battle-grade battle-grade-${view.grade}`);
      setText(grade, gradeLabels[view.grade]);
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
      applyAtlasCrop(image, view.image);
    },
  };
}
