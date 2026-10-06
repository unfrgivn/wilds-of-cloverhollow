import "./title.css";

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

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// The title renders every frame; only touch the DOM when something changed.
function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

// A four-leaf clover sprig for the wordmark plate.
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
} {
  let choose: (id: TitleChoiceId) => void = () => undefined;
  const chooseLater = (id: TitleChoiceId): void => choose(id);
  const screen = element("main", "title-screen");
  screen.hidden = true;
  const plate = element("div", "title-plate");
  const logo = element("h1", "title-logo");
  logo.textContent = "Wilds of Cloverhollow";
  plate.append(logo, cloverIcon());
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
