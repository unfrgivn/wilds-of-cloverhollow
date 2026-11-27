import "./title.css";
import { element, setAttribute, setText } from "./dom";

export type TitleChoiceId = "continue" | "new-game" | "confirm-yes" | "confirm-no";

export type TitleView = {
  visible: boolean;
  /** fresh: no save (New game only); continue: a save exists; confirm: asking first. */
  mode: "fresh" | "continue" | "confirm";
  selected: TitleChoiceId;
  /** Under Continue, e.g. "Town plaza · 1 sticker". */
  continueDetail: string;
};

type Option = { id: TitleChoiceId; button: HTMLButtonElement };

const svgNamespace = "http://www.w3.org/2000/svg";

// A four-leaf clover sprig for the upper-right corner of the wordmark plate.
function cloverIcon(): SVGSVGElement {
  const icon = document.createElementNS(svgNamespace, "svg");
  icon.setAttribute("class", "title-clover");
  icon.setAttribute("viewBox", "0 0 40 44");
  icon.setAttribute("aria-hidden", "true");
  const leaves = [[20, 11], [29, 20], [20, 29], [11, 20]];
  for (const [x = 0, y = 0] of leaves) {
    const leaf = document.createElementNS(svgNamespace, "circle");
    leaf.setAttribute("class", "title-clover-leaf");
    leaf.setAttribute("cx", String(x));
    leaf.setAttribute("cy", String(y));
    leaf.setAttribute("r", "8");
    icon.append(leaf);
  }
  const stem = document.createElementNS(svgNamespace, "path");
  stem.setAttribute("class", "title-clover-stem");
  stem.setAttribute("d", "M20 21 C21 30 25 37 31 42");
  icon.append(stem);
  return icon;
}

// A storybook wildflower and leaf sprig for the bottom-left corner of the plate.
function blossomIcon(): SVGSVGElement {
  const icon = document.createElementNS(svgNamespace, "svg");
  icon.setAttribute("class", "title-blossom");
  icon.setAttribute("viewBox", "0 0 42 40");
  icon.setAttribute("aria-hidden", "true");
  const stem = document.createElementNS(svgNamespace, "path");
  stem.setAttribute("class", "title-blossom-stem");
  stem.setAttribute("d", "M29 14 C23 20 15 24 7 29");
  icon.append(stem);
  const leaves: readonly [number, number, number, number, string][] = [
    [28, 24, 7, 4.4, "rotate(-24 28 24)"],
    [15, 13, 6.5, 4, "rotate(34 15 13)"],
  ];
  for (const [cx, cy, rx, ry, transform] of leaves) {
    const leaf = document.createElementNS(svgNamespace, "ellipse");
    leaf.setAttribute("class", "title-blossom-leaf");
    leaf.setAttribute("cx", String(cx));
    leaf.setAttribute("cy", String(cy));
    leaf.setAttribute("rx", String(rx));
    leaf.setAttribute("ry", String(ry));
    leaf.setAttribute("transform", transform);
    icon.append(leaf);
  }
  const petals: readonly [number, number][] = [
    [19, 15.8], [24.9, 20.1], [22.6, 27], [15.4, 27], [13.1, 20.1],
  ];
  for (const [cx, cy] of petals) {
    const petal = document.createElementNS(svgNamespace, "circle");
    petal.setAttribute("class", "title-blossom-petal");
    petal.setAttribute("cx", String(cx));
    petal.setAttribute("cy", String(cy));
    petal.setAttribute("r", "5.2");
    icon.append(petal);
  }
  const center = document.createElementNS(svgNamespace, "circle");
  center.setAttribute("class", "title-blossom-center");
  center.setAttribute("cx", "19");
  center.setAttribute("cy", "22");
  center.setAttribute("r", "4.2");
  icon.append(center);
  return icon;
}

function optionButton(className: string, id: TitleChoiceId, label: string,
  detail: HTMLElement | null, choose: (id: TitleChoiceId) => void): Option {
  const button = element("button", className);
  button.type = "button";
  button.dataset.id = id;
  const text = element("span", `${className}-label`);
  text.textContent = label;
  button.append(text);
  if (detail !== null) button.append(detail);
  button.addEventListener("click", () => choose(id));
  return { id, button };
}

export function createTitleScreen(root: HTMLElement): {
  render: (view: TitleView) => void;
  onChoose: (callback: (id: TitleChoiceId) => void) => void;
  onQa: (callback: () => void) => void;
} {
  let choose: (id: TitleChoiceId) => void = () => undefined;
  let qa: () => void = () => undefined;
  const chooseLater = (id: TitleChoiceId): void => choose(id);
  const screen = element("main", "title-screen");
  screen.hidden = true;
  const plate = element("div", "title-plate");
  const logo = element("h1", "title-logo");
  logo.textContent = "Wilds of Cloverhollow";
  // A long press on the logo opens the QA library. The timer opens it with the
  // finger still down; the release opens it too once the press has lasted long
  // enough, because a busy main thread can run the release before an overdue
  // timer, which would otherwise cancel it.
  const longPressMs = 650;
  let press: { at: number; timer: number } | null = null;
  const endPress = (): void => {
    if (press !== null) window.clearTimeout(press.timer);
    press = null;
  };
  logo.addEventListener("pointerdown", (event) => {
    endPress();
    const timer = window.setTimeout(() => { press = null; qa(); }, longPressMs);
    press = { at: event.timeStamp, timer };
  });
  logo.addEventListener("pointerup", (event) => {
    const held = press !== null && event.timeStamp - press.at >= longPressMs;
    endPress();
    if (held) qa();
  });
  logo.addEventListener("pointerleave", endPress);
  plate.append(logo, cloverIcon(), blossomIcon());
  const options = element("div", "title-options");
  options.setAttribute("role", "listbox");
  options.setAttribute("aria-label", "Start");
  const detail = element("small", "title-option-detail");
  const continueOption = optionButton("title-option", "continue", "Continue", detail,
    chooseLater);
  const newGameOption = optionButton("title-option", "new-game", "New game", null, chooseLater);
  options.append(continueOption.button, newGameOption.button);
  screen.append(plate, options);

  const confirm = element("section", "title-confirm");
  confirm.hidden = true;
  confirm.setAttribute("role", "alertdialog");
  const card = element("div", "title-confirm-card");
  const confirmText = element("p", "title-confirm-text");
  confirmText.textContent = "Start a new game? Your saved game will be replaced.";
  confirm.setAttribute("aria-label", confirmText.textContent);
  const buttons = element("div", "title-confirm-buttons");
  const yes = optionButton("title-confirm-button", "confirm-yes", "Yes, start over", null,
    chooseLater);
  const no = optionButton("title-confirm-button", "confirm-no", "No, go back", null,
    chooseLater);
  buttons.append(yes.button, no.button);
  card.append(confirmText, buttons);
  confirm.append(card);
  root.append(screen, confirm);
  const all = [continueOption, newGameOption, yes, no];
  return {
    onChoose: (callback) => {
      choose = callback;
    },
    onQa: (callback) => { qa = callback; },
    render: (view) => {
      screen.hidden = !view.visible;
      confirm.hidden = !view.visible || view.mode !== "confirm";
      // With no save there is no Continue at all (not merely hidden), so it
      // moves only when the mode changes, never on an identical render.
      if (view.mode === "fresh") {
        if (continueOption.button.parentElement === options) continueOption.button.remove();
      } else if (continueOption.button.parentElement !== options) {
        options.prepend(continueOption.button);
      }
      setText(detail, view.continueDetail);
      setAttribute(options, "aria-hidden", String(view.mode === "confirm"));
      for (const option of all)
        setAttribute(option.button, "aria-selected", String(option.id === view.selected));
    },
  };
}
