import "../ui/qa.css";
import { Preferences } from "@capacitor/preferences";
import type { ConsoleOutcome } from "./console";

export { runConsoleCommand } from "./console";
export type { ConsoleContext, ConsoleOutcome } from "./console";

export type QaPack = {
  id: string; label: string; note: string; fixture: string; run: string;
  tick: number; interim: boolean; hash: string;
};
type RawModule = string | Record<string, unknown>;
export type PackState = { pack: QaPack; save: string };

// Console saves live beside the player's slot, never inside it (spec 11).
const slotIndexKey = "cloverhollow-qa-slots";
const slotKey = (name: string): string => `cloverhollow-qa-save:${name}`;
export type QaSlotMeta = { name: string; tick: number; hash: string };

function isSlotMeta(value: unknown): value is QaSlotMeta {
  if (typeof value !== "object" || value === null) return false;
  const entry: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  return typeof entry.name === "string" && entry.name !== "" &&
    /^[a-z0-9][a-z0-9-]{0,23}$/.test(entry.name) &&
    typeof entry.tick === "number" && typeof entry.hash === "string";
}

async function readSlotIndex(): Promise<QaSlotMeta[]> {
  const { value } = await Preferences.get({ key: slotIndexKey });
  if (value === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSlotMeta);
}

// The console's saved slots, listed in the QA menu after the packs. A slot
// whose save is missing (cleared storage) drops out of the list.
export async function loadQaSlots(): Promise<PackState[]> {
  const slots: PackState[] = [];
  for (const meta of await readSlotIndex()) {
    const { value } = await Preferences.get({ key: slotKey(meta.name) });
    if (value === null) continue;
    slots.push({
      pack: {
        id: `slot:${meta.name}`, label: `Saved: ${meta.name}`,
        note: `A console save at tick ${meta.tick}.`, fixture: "console", run: "",
        tick: meta.tick, interim: true, hash: meta.hash,
      },
      save: value,
    });
  }
  return slots;
}

export async function saveQaSlot(meta: QaSlotMeta, save: string): Promise<void> {
  const index = (await readSlotIndex()).filter((entry) => entry.name !== meta.name);
  index.push(meta);
  await Preferences.set({ key: slotKey(meta.name), value: save });
  await Preferences.set({ key: slotIndexKey, value: JSON.stringify(index) });
}

const metadata = import.meta.glob("../../content/qa/saves.json", {
  eager: true, import: "default",
});
const saveFiles = import.meta.glob("../../content/qa/saves/*.json", {
  eager: true, query: "?raw", import: "default",
});

function isPack(item: unknown): item is QaPack {
  if (typeof item !== "object" || item === null) return false;
  const value: Record<string, unknown> = Object.fromEntries(Object.entries(item));
  return typeof value.id === "string" && typeof value.label === "string" &&
    typeof value.note === "string" && typeof value.fixture === "string" &&
    typeof value.run === "string" && typeof value.tick === "number" &&
    typeof value.interim === "boolean" && typeof value.hash === "string";
}

function readMetadata(): QaPack[] {
  const value = Object.values(metadata)[0];
  if (!Array.isArray(value)) throw new Error("QA save manifest is not an array");
  return value.map((item, index) => {
    if (!isPack(item)) throw new Error(`Invalid QA save manifest entry ${index}`);
    return item;
  });
}

function rawString(value: RawModule | undefined): string | null {
  if (typeof value === "string") return value;
  if (value !== undefined && typeof value.default === "string") return value.default;
  return null;
}

export function loadQaPacks(): PackState[] {
  return readMetadata().map((pack) => {
    const path = Object.keys(saveFiles).find((item) => item.endsWith(`/${pack.id}.json`));
    const save = rawString(path === undefined ? undefined : saveFiles[path]);
    if (save === null) throw new Error(`Missing QA save ${pack.id}`);
    return { pack, save };
  });
}

export function qaPackFromUrl(packs: PackState[], search: string): PackState | null {
  const id = new URLSearchParams(search).get("qa");
  if (id === null) return null;
  const found = packs.find((item) => item.pack.id === id);
  if (found === undefined)
    throw new Error(
      `Unknown QA save "${id}". Known saves: ${packs.map((item) => item.pack.id).join(", ")}`,
    );
  return found;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; return node;
}

export function createQaMenu(root: HTMLElement, entries: PackState[]): {
  render: (visible: boolean, selected: number) => void;
  onChoose: (callback: (pack: PackState) => void) => void;
  onCancel: (callback: () => void) => void;
  setEntries: (entries: PackState[]) => void;
} {
  let choose: (pack: PackState) => void = () => undefined;
  let cancel: () => void = () => undefined;
  const menu = el("main", "qa-menu");
  menu.hidden = true; menu.setAttribute("aria-label", "QA save library");
  const card = el("div", "qa-card");
  const heading = el("h1", "qa-heading");
  heading.textContent = "QA save library";
  const list = el("div", "qa-list"); list.setAttribute("role", "listbox");
  let buttons: HTMLButtonElement[] = [];
  const buildOptions = (items: PackState[]): void => {
    for (const button of buttons) button.remove();
    buttons = items.map((item) => {
      const button = el("button", "qa-option");
      button.type = "button"; button.dataset.id = item.pack.id;
      const label = el("strong", "qa-option-label");
      label.textContent = item.pack.label;
      const note = el("small", "qa-option-note");
      note.textContent = item.pack.note;
      button.append(label, note);
      button.addEventListener("click", () => choose(item));
      list.append(button); return button;
    });
  };
  buildOptions(entries);
  card.append(heading, list); menu.append(card); root.append(menu);
  const back = el("button", "qa-back"); back.type = "button"; back.textContent = "Back to title";
  back.addEventListener("click", () => cancel()); card.append(back);
  return {
    onChoose: (callback) => { choose = callback; },
    onCancel: (callback) => { cancel = callback; },
    setEntries: (items) => { buildOptions(items); },
    render: (visible, selected) => {
      menu.hidden = !visible;
      buttons.forEach((button, index) => button.setAttribute(
        "aria-selected", String(index === selected),
      ));
    },
  };
}

export function createQaBadge(root: HTMLElement): {
  render: (pack: QaPack | null) => void;
  onOpen: (callback: () => void) => void;
} {
  let open: () => void = () => undefined;
  const badge = el("button", "qa-badge");
  badge.type = "button"; badge.hidden = true;
  badge.addEventListener("click", () => open());
  root.append(badge);
  return {
    onOpen: (callback) => { open = callback; },
    render: (pack) => {
      badge.hidden = pack === null;
      badge.textContent = pack === null ? "" : `QA · ${pack.label}`;
    },
  };
}

export function createQaError(root: HTMLElement, message: string): void {
  const menu = el("main", "qa-menu");
  const card = el("div", "qa-card");
  const heading = el("h1", "qa-heading"); heading.textContent = "QA save error";
  const detail = el("p", "qa-error"); detail.textContent = message;
  card.append(heading, detail); menu.append(card); root.append(menu);
}

// The QA console (Milestone 67, spec 11): a thin shell over runConsoleCommand.
// The shell (main.ts) owns the state, the save slot writes, and whether the
// console is open; this only reads commands and shows what happened.
export type QaConsoleHandlers = {
  run: (line: string) => ConsoleOutcome;
  saveSlot: (name: string) => Promise<string>;
  saveFile: () => string;
  close: () => void;
};

export function createQaConsole(root: HTMLElement, handlers: QaConsoleHandlers): {
  render: (open: boolean) => void;
} {
  // Built on first open: the dev-only panel never sits in the page's DOM
  // while unused, so no game test can trip over its words (the kid's battle
  // asserts the word "Run" is nowhere on the page, and a hidden button would
  // count).
  let panel: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  const build = (): void => {
    const madePanel = el("main", "qa-console");
    madePanel.hidden = true; madePanel.setAttribute("aria-label", "QA console");
    const card = el("div", "qa-console-card");
    const heading = el("h1", "qa-heading");
    heading.textContent = "QA console";
    const madeLog = el("div", "qa-console-log"); madeLog.setAttribute("aria-live", "polite");
    const form = el("form", "qa-console-form");
    const madeInput = document.createElement("input");
    madeInput.type = "text"; madeInput.className = "qa-console-input";
    madeInput.autocomplete = "off"; madeInput.spellcheck = false;
    madeInput.placeholder = "Type a command; help lists them";
    const run = el("button", "qa-console-run"); run.type = "submit"; run.textContent = "Run";
    form.append(madeInput, run);
    const close = el("button", "qa-console-close");
    close.type = "button"; close.textContent = "Close (Esc)";
    close.addEventListener("click", () => handlers.close());
    card.append(heading, madeLog, form, close); madePanel.append(card); root.append(madePanel);

    const scroll = (): void => { madeLog.scrollTop = madeLog.scrollHeight; };
    const entry = (text: string, className: string): void => {
      const line = el("p", className); line.textContent = text;
      madeLog.append(line);
      while (madeLog.children.length > 200) madeLog.firstElementChild?.remove();
      scroll();
    };
    const submit = async (): Promise<void> => {
      const line = madeInput.value.trim();
      if (line === "") return;
      madeInput.value = "";
      entry(`> ${line}`, "qa-console-cmd");
      const outcome = handlers.run(line);
      if (outcome.kind === "applied") entry(outcome.message, "qa-console-ok");
      else if (outcome.kind === "help") entry(outcome.message, "qa-console-help");
      else if (outcome.kind === "error") entry(outcome.message, "qa-console-error");
      else if (outcome.kind === "save")
        entry(await handlers.saveSlot(outcome.name), "qa-console-ok");
      else {
        const block = el("pre", "qa-console-save");
        block.dataset.qaExport = ""; block.textContent = handlers.saveFile();
        madeLog.append(block);
        while (madeLog.children.length > 200) madeLog.firstElementChild?.remove();
        scroll();
      }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); void submit(); });
    panel = madePanel;
    input = madeInput;
  };
  return {
    render: (open) => {
      if (open && panel === null) build();
      if (panel === null) return;
      panel.hidden = !open;
      if (input === null) return;
      if (open) input.focus();
      else input.blur();
    },
  };
}
