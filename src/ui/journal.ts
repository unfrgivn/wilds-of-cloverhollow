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
};

type Slot = {
  root: HTMLDivElement;
  image: HTMLDivElement;
  unknown: HTMLDivElement;
  name: HTMLDivElement;
};

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
  const notesHeading = element("h2", "journal-heading");
  notesHeading.textContent = "NOTES";
  const notes = element("ul", "journal-notes");
  const empty = element("p", "journal-empty");
  empty.textContent = "Nothing yet. Look around!";
  notesPage.append(notesHeading, notes, empty);
  const stickersPage = element("section", "journal-page journal-stickers-page");
  const stickersHeading = element("h2", "journal-heading");
  stickersHeading.textContent = "STICKERS";
  const grid = element("div", "journal-stickers");
  stickersPage.append(stickersHeading, grid);
  book.append(label, close, notesPage, stickersPage);
  root.append(book);
  let onClose: () => void = () => undefined;
  close.addEventListener("click", () => onClose());
  const slots: Slot[] = [];
  return {
    onClose: (callback) => {
      onClose = callback;
    },
    render: (view) => {
      book.hidden = !view.visible;
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
    },
  };
}
