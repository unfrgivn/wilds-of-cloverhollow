import "./journal.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";

export type JournalSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
};

export type JournalView = {
  visible: boolean;
  /** Newest first; the game decides the order. */
  notes: string[];
  stickers: JournalSticker[];
  lands: { id: string; name: string; busStop: boolean; x: number; y: number }[];
  currentLand: string | null;
  coins: number;
  snacks: number;
};

type Slot = {
  root: HTMLDivElement;
  image: HTMLDivElement;
  unknown: HTMLDivElement;
  name: HTMLDivElement;
};

type MapLand = JournalView["lands"][number];

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// The game renders every frame; only touch the DOM when something changed.
function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function addSlot(grid: HTMLElement): Slot {
  const root = element("div", "journal-slot");
  const image = element("div", "journal-sticker-image die-cut");
  image.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", "A sticker still to find");
  const name = element("div", "journal-name");
  root.append(image, unknown, name);
  grid.append(root);
  return { root, image, unknown, name };
}

// The bus line's stop sign, as on the sprite: a gold star on a blue roundel
// atop a pole.
function busStopIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 30");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<rect x="9" y="14" width="2" height="15" rx="1" fill="#8a8f98" stroke="#47321f" ' +
    'stroke-width="0.8"/>' +
    '<circle cx="10" cy="9" r="8" fill="#3f7fc0" stroke="#47321f" stroke-width="1.2"/>' +
    '<path d="M10 3.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6L10 11.8l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" ' +
    'fill="#f2c94c" stroke="#47321f" stroke-width="0.5"/>';
  return svg;
}

// Fae's supplies on the notes page's heading row: a gold coin, and a cookie
// for her snacks, each with its count.
function supply(kind: "coins" | "snacks", label: string): {
  root: HTMLSpanElement;
  count: HTMLSpanElement;
} {
  const root = element("span", "journal-supply");
  setAttribute(root, "data-supply", kind);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = kind === "coins"
    ? '<circle cx="10" cy="10" r="8.2" fill="#f2c94c" stroke="#47321f" stroke-width="1.4"/>' +
      '<circle cx="10" cy="10" r="4.6" fill="none" stroke="#c48a1c" stroke-width="1.3"/>'
    : '<circle cx="10" cy="10" r="8.2" fill="#dba468" stroke="#47321f" stroke-width="1.4"/>' +
      '<circle cx="7" cy="7.6" r="1.5" fill="#6b4226"/>' +
      '<circle cx="12.8" cy="7" r="1.3" fill="#6b4226"/>' +
      '<circle cx="11.4" cy="12.6" r="1.5" fill="#6b4226"/>' +
      '<circle cx="6.6" cy="12.8" r="1.1" fill="#6b4226"/>';
  const count = element("span", "journal-supply-count");
  root.append(svg, `${label} `, count);
  return { root, count };
}

export function createJournal(root: HTMLElement): {
  render: (view: JournalView) => void;
  onClose: (callback: () => void) => void;
} {
  const book = element("section", "journal-book");
  book.setAttribute("aria-label", "Journal");
  book.hidden = true;
  const label = element("div", "journal-label");
  label.textContent = "JOURNAL";
  const close = element("button", "journal-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close journal");
  close.textContent = "×";
  const notesPage = element("section", "journal-page journal-notes-page");
  const notesHead = element("div", "journal-notes-head");
  const notesHeading = element("h2", "journal-heading");
  notesHeading.textContent = "NOTES";
  const supplies = element("div", "journal-supplies");
  const coins = supply("coins", "Coins");
  const snacks = supply("snacks", "Snacks");
  supplies.append(coins.root, snacks.root);
  notesHead.append(notesHeading, supplies);
  const notes = element("ul", "journal-notes");
  const empty = element("p", "journal-empty");
  empty.textContent = "Nothing yet. Look around!";
  notesPage.append(notesHead, notes, empty);
  const stickersPage = element("section", "journal-page journal-stickers-page");
  const stickersHeading = element("h2", "journal-heading");
  stickersHeading.textContent = "STICKERS";
  const grid = element("div", "journal-stickers");
  stickersPage.append(stickersHeading, grid);
  const mapPage = element("section", "journal-map-page");
  const map = element("div", "journal-map");
  const mapLabels = element("div", "journal-map-labels");
  const star = element("div", "journal-map-star");
  star.textContent = "★";
  star.setAttribute("aria-label", "You are here");
  map.append(mapLabels, star);
  mapPage.append(map);
  const notesTab = element("button", "journal-tab journal-notes-tab");
  notesTab.type = "button";
  notesTab.textContent = "NOTES & STICKERS";
  notesTab.setAttribute("aria-label", "Notes and stickers");
  const mapTab = element("button", "journal-tab journal-map-tab");
  mapTab.type = "button";
  mapTab.textContent = "MAP";
  mapTab.setAttribute("aria-label", "Map");
  book.append(label, close, notesPage, stickersPage, mapPage, notesTab, mapTab);
  root.append(book);
  let onClose: () => void = () => undefined;
  let page: "notes" | "map" = "notes";
  let wasVisible = false;
  let mapSignature = "";
  const setPage = (next: "notes" | "map"): void => {
    page = next;
    setAttribute(book, "data-journal-page", page);
    notesPage.hidden = page !== "notes";
    stickersPage.hidden = page !== "notes";
    mapPage.hidden = page !== "map";
  };
  notesTab.addEventListener("click", () => setPage("notes"));
  mapTab.addEventListener("click", () => setPage("map"));
  const keydown = (event: KeyboardEvent): void => {
    if (book.hidden) return;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      setPage("map");
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      setPage("notes");
    }
  };
  document.addEventListener("keydown", keydown);
  setPage("notes");
  close.addEventListener("click", () => onClose());
  const slots: Slot[] = [];
  return {
    onClose: (callback) => {
      onClose = callback;
    },
    render: (view) => {
      book.hidden = !view.visible;
      setText(coins.count, String(view.coins));
      setText(snacks.count, String(view.snacks));
      if (!view.visible && wasVisible) setPage("notes");
      wasVisible = view.visible;
      while (notes.children.length < view.notes.length) notes.append(element("li", "journal-note"));
      while (notes.children.length > view.notes.length) notes.lastElementChild?.remove();
      view.notes.forEach((note, index) => {
        const item = notes.children.item(index);
        if (item !== null) setText(item, note);
      });
      empty.hidden = view.notes.length > 0;
      while (slots.length < view.stickers.length) slots.push(addSlot(grid));
      while (slots.length > view.stickers.length) slots.pop()?.root.remove();
      view.stickers.forEach((sticker, index) => {
        const slot = slots[index];
        if (slot === undefined) return;
        const image = sticker.owned ? sticker.image : null;
        slot.image.hidden = image === null;
        slot.unknown.hidden = image !== null;
        slot.name.hidden = image === null;
        setText(slot.name, image === null ? "" : sticker.name);
        setAttribute(slot.root, "data-owned", String(image !== null));
        if (image === null) return;
        setAttribute(slot.image, "aria-label", sticker.name);
        applyAtlasCrop(slot.image, image);
      });
      const nextMapSignature = view.lands
        .map((land) => `${land.id}:${land.name}:${land.x}:${land.y}`)
        .join("|");
      if (nextMapSignature !== mapSignature) {
        mapSignature = nextMapSignature;
        mapLabels.replaceChildren();
        view.lands.forEach((land: MapLand) => {
          const item = element("span", "journal-map-land");
          item.textContent = land.id === "enchanted" ? "???" : land.name;
          item.style.left = `${(land.x / 2400) * 100}%`;
          item.style.top = `${(land.y / 1610) * 100}%`;
          setAttribute(item, "data-land", land.id);
          mapLabels.append(item);
          if (!land.busStop) return;
          // The bus line's sign (a gold star on a blue roundel) leads the name.
          const stop = element("span", "journal-map-stop");
          setAttribute(stop, "data-land", land.id);
          setAttribute(stop, "aria-label", `Bus stop: ${land.name}`);
          stop.append(busStopIcon());
          item.prepend(stop);
        });
      }
      const here = view.lands.find((land) => land.id === view.currentLand);
      star.hidden = here === undefined;
      setAttribute(star, "data-land", here?.id ?? "");
      if (here !== undefined) {
        // Just above the land's name, so the name stays readable.
        star.style.left = `${(here.x / 2400) * 100}%`;
        star.style.top = `${(here.y / 1610) * 100 - 7}%`;
      }
    },
  };
}
