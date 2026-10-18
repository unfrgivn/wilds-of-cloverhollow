import "../ui/qa.css";
export type QaPack = {
  id: string; label: string; note: string; fixture: string; run: string;
  tick: number; interim: boolean;
};
type RawModule = string | Record<string, unknown>;
export type PackState = { pack: QaPack; save: string };

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
    typeof value.interim === "boolean";
}

function readMetadata(): QaPack[] {
  const value = Object.values(metadata)[0];
  if (!Array.isArray(value)) throw new Error("QA save manifest is not an array");
  return value.filter(isPack);
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

export function createQaMenu(root: HTMLElement, packs: PackState[]): {
  render: (visible: boolean, selected: number) => void;
  onChoose: (callback: (pack: PackState) => void) => void;
} {
  let choose: (pack: PackState) => void = () => undefined;
  const menu = el("main", "qa-menu");
  menu.hidden = true; menu.setAttribute("aria-label", "QA save library");
  const card = el("div", "qa-card");
  const heading = el("h1", "qa-heading");
  heading.textContent = "QA save library";
  const list = el("div", "qa-list"); list.setAttribute("role", "listbox");
  const buttons = packs.map((item) => {
    const button = el("button", "qa-option");
    button.type = "button"; button.dataset.id = item.pack.id;
    const label = el("strong", "qa-option-label");
    label.textContent = item.pack.label;
    const note = el("small", "qa-option-note");
    note.textContent = item.pack.interim ? `${item.pack.note} (shortcut)` : item.pack.note;
    button.append(label, note);
    button.addEventListener("click", () => choose(item));
    list.append(button); return button;
  });
  card.append(heading, list); menu.append(card); root.append(menu);
  return {
    onChoose: (callback) => { choose = callback; },
    render: (visible, selected) => {
      menu.hidden = !visible;
      buttons.forEach((button, index) => button.setAttribute(
        "aria-selected", String(index === selected),
      ));
    },
  };
}

export function createQaBadge(root: HTMLElement): { render: (pack: QaPack | null) => void } {
  const badge = el("div", "qa-badge"); root.append(badge);
  return {
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
