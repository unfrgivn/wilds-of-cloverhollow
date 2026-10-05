import "./sticker.css";

export type DialogueView = {
  speaker: string | null;
  text: string;
  revealed: number;
  choices: { text: string }[];
  selected: number;
  canAdvance: boolean;
};

type ChoiceCallback = (index: number) => void;

export function createDialogueBox(root: HTMLElement): {
  render: (view: DialogueView) => void;
  onChoose: (callback: ChoiceCallback) => void;
  hide: () => void;
} {
  const box = document.createElement("section");
  box.className = "sticker-ui sticker-dialogue";
  box.setAttribute("aria-label", "Dialogue");
  const speaker = document.createElement("div");
  speaker.className = "sticker-speaker";
  const text = document.createElement("div");
  text.className = "sticker-text";
  text.setAttribute("aria-hidden", "true");
  const full = document.createElement("span");
  full.className = "sticker-text-full";
  const revealed = document.createElement("span");
  revealed.className = "sticker-text-revealed";
  text.append(full, revealed);
  const live = document.createElement("div");
  live.className = "sticker-live";
  live.setAttribute("aria-live", "polite");
  const choiceLive = document.createElement("div");
  choiceLive.className = "sticker-live";
  choiceLive.setAttribute("aria-live", "polite");
  const advance = document.createElement("span");
  advance.className = "sticker-advance";
  advance.setAttribute("aria-label", "Ready to advance");
  const choices = document.createElement("div");
  choices.className = "sticker-choices";
  choices.setAttribute("role", "listbox");
  choices.setAttribute("aria-label", "Choices");
  box.append(speaker, text, live, choiceLive, advance, choices);
  root.append(box);
  let choose: ChoiceCallback = () => undefined;
  let announcedLine = "";
  let announcedChoice = "";

  const onChoose = (callback: ChoiceCallback): void => { choose = callback; };
  const render = (view: DialogueView): void => {
    box.hidden = false;
    speaker.textContent = view.speaker ?? "";
    speaker.hidden = view.speaker === null;
    full.textContent = view.text;
    revealed.textContent = view.text.slice(0, Math.max(0, view.revealed));
    const line = `${view.speaker ?? ""}: ${view.text}`;
    if (line !== announcedLine) {
      live.textContent = line;
      announcedLine = line;
    }
    advance.classList.toggle("is-visible", view.canAdvance &&
      view.revealed >= view.text.length);
    while (choices.children.length > view.choices.length) {
      choices.lastElementChild?.remove();
    }
    view.choices.forEach((choice, index) => {
      const existing = choices.children.item(index);
      let element: HTMLButtonElement;
      if (existing instanceof HTMLButtonElement) {
        element = existing;
      } else {
        element = document.createElement("button");
        element.className = "sticker-choice";
        element.type = "button";
        element.setAttribute("role", "option");
        element.addEventListener("click", () => choose(index));
        choices.append(element);
      }
      element.textContent = choice.text;
      element.setAttribute("aria-selected", String(index === view.selected));
    });
    const selected = view.choices[view.selected];
    const selectedText = selected === undefined ? "" : `Selected: ${selected.text}`;
    if (selectedText !== announcedChoice) {
      choiceLive.textContent = selectedText;
      announcedChoice = selectedText;
    }
  };
  return { render, onChoose, hide: () => { box.hidden = true; } };
}

export type PromptView = { label: string; x: number; y: number; visible: boolean };
export type Insets = { top: number; right: number; bottom: number; left: number };

export function clampPromptPosition(x: number, y: number, width: number, height: number,
  viewportWidth: number, viewportHeight: number, insets: Insets): { x: number; y: number } {
  return { x: Math.min(Math.max(insets.left + width / 2, x),
    viewportWidth - insets.right - width / 2),
    y: Math.min(Math.max(insets.top + height, y), viewportHeight - insets.bottom - 8) };
}

function readInsets(): Insets {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;inset:0;padding:env(safe-area-inset-top) " +
    "env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const parse = (value: string): number => parseFloat(value) || 0;
  const insets = { top: parse(style.paddingTop), right: parse(style.paddingRight),
    bottom: parse(style.paddingBottom), left: parse(style.paddingLeft) };
  probe.remove();
  return insets;
}

export function createPrompt(root: HTMLElement): { render: (view: PromptView) => void } {
  const prompt = document.createElement("div");
  prompt.className = "sticker-ui sticker-prompt";
  const label = document.createElement("span");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrow.classList.add("sticker-prompt-arrow");
  arrow.setAttribute("viewBox", "0 0 44 41");
  arrow.setAttribute("aria-hidden", "true");
  const rim = document.createElementNS("http://www.w3.org/2000/svg", "path");
  rim.classList.add("sticker-prompt-arrow-rim");
  rim.setAttribute("d", "M 8 4 C 10 18, 18 25, 28 31 L 25 27 M 28 31 L 27 25");
  const ink = rim.cloneNode(true);
  if (!(ink instanceof SVGPathElement)) throw new Error("Could not create prompt arrow");
  ink.classList.remove("sticker-prompt-arrow-rim");
  ink.classList.add("sticker-prompt-arrow-ink");
  arrow.append(rim, ink);
  prompt.append(label, arrow);
  root.append(prompt);
  let insets = readInsets();
  window.addEventListener("resize", () => { insets = readInsets(); });
  return { render: (view) => {
    label.textContent = view.label;
    prompt.hidden = !view.visible;
    if (view.visible) {
      const position = clampPromptPosition(view.x, view.y, prompt.offsetWidth,
        prompt.offsetHeight + 44, window.innerWidth, window.innerHeight, insets);
      prompt.style.left = `${position.x}px`;
      prompt.style.top = `${position.y}px`;
      prompt.dataset.tipX = String(position.x);
      prompt.dataset.tipY = String(position.y);
    }
  } };
}
