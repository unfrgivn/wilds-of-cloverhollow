import "./journal-hearts.css";
import { element, setAttribute, setText } from "./dom";
import {
  heartToHeartMeta, type HeartToHeartEntry, type HeartToHeartSummary,
} from "../core/heart-to-hearts";

const svgNamespace = "http://www.w3.org/2000/svg";

export type HeartEmblemState = "done" | "ready" | "locked";

export type JournalHeartsAlbum = {
  overlay: HTMLDivElement;
  treasuresBtn: HTMLButtonElement;
  open: (summary: HeartToHeartSummary | undefined, returnTarget?: HTMLElement | null) => void;
  sync: (summary: HeartToHeartSummary | undefined) => void;
  close: () => void;
  clear: () => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

const HEART_PATH =
  "M 16 25.4 C 9.4 20.6 6.4 16.6 6.4 12.8 C 6.4 9.5 9 7.2 12 7.2 " +
  "C 13.9 7.2 15.2 8.2 16 9.8 C 16.8 8.2 18.1 7.2 20 7.2 " +
  "C 23 7.2 25.6 9.5 25.6 12.8 C 25.6 16.6 22.6 20.6 16 25.4 Z";

const SPARKLE_STAR =
  '<path d="M 26.2 5.6 L 27.1 7.8 L 29.3 8.7 L 27.1 9.6 L 26.2 11.8 ' +
  'L 25.3 9.6 L 23.1 8.7 L 25.3 7.8 Z" fill="#ffe175" stroke="#47321f" ' +
  'stroke-width="1.05" stroke-linejoin="round"/>';

const HEADER_HEART_MARKUP =
  '<path d="M 9.6 22.8 L 6.8 29.4 L 11.4 27.2 L 14.4 29.4 L 15.2 23.4 Z" ' +
  'fill="#f2a8be" stroke="#47321f" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M 22.4 22.8 L 25.2 29.4 L 20.6 27.2 L 17.6 29.4 L 16.8 23.4 Z" ' +
  'fill="#f2a8be" stroke="#47321f" stroke-width="1.4" stroke-linejoin="round"/>' +
  `<path d="${HEART_PATH}" fill="#e87e9e" stroke="#47321f" ` +
  'stroke-width="1.75" stroke-linejoin="round"/>' +
  `<circle cx="11.6" cy="11.6" r="1.8" fill="#fffaf2" opacity="0.9"/>${SPARKLE_STAR}`;

/** Pure inner SVG markup for a hand-inked heart medallion (zero `<text>` nodes). */
export function heartEmblemMarkup(state: HeartEmblemState, accent: string): string {
  if (state === "done") {
    return (
      `<path d="${HEART_PATH}" fill="${accent}" stroke="#47321f" ` +
      'stroke-width="1.75" stroke-linejoin="round"/>' +
      `<circle cx="11.6" cy="11.6" r="1.8" fill="#fffaf2" opacity="0.88"/>${SPARKLE_STAR}` +
      '<circle cx="6.2" cy="23.2" r="1.5" fill="#ffe175" stroke="#47321f" stroke-width="1"/>'
    );
  }
  if (state === "ready") {
    return (
      `<path d="${HEART_PATH}" fill="#ffd8e4" stroke="#47321f" ` +
      'stroke-width="1.7" stroke-linejoin="round"/>' +
      '<path d="M 16 21.8 C 11.8 18.7 9.8 15.8 9.8 13.3 C 9.8 11.4 11.3 10.1 13 10.1 ' +
      'C 14.3 10.1 15.3 10.8 16 12 C 16.7 10.8 17.7 10.1 19 10.1 ' +
      'C 20.7 10.1 22.2 11.4 22.2 13.3 C 22.2 15.8 20.2 18.7 16 21.8 Z" ' +
      `fill="none" stroke="#fffaf2" stroke-width="1.35" stroke-dasharray="2.1 1.7"/>` +
      `${SPARKLE_STAR}` +
      '<circle cx="5.4" cy="8.2" r="1.7" fill="#ffe175" stroke="#47321f" stroke-width="1.05"/>' +
      '<circle cx="25.6" cy="24.2" r="1.4" fill="#ffe175" stroke="#47321f" stroke-width="1"/>'
    );
  }
  return (
    `<path d="${HEART_PATH}" fill="#ece1ca" stroke="#47321f" stroke-opacity="0.72" ` +
    'stroke-width="1.6" stroke-dasharray="2.4 1.8" stroke-linejoin="round"/>' +
    '<circle cx="16" cy="14.5" r="2.2" fill="#f7f0e0" stroke="#5a4028" stroke-width="1.2"/>' +
    '<path d="M 16 16.8 V 19.8" stroke="#5a4028" stroke-width="1.35" stroke-linecap="round"/>'
  );
}

function makeSvg(className: string, markup: string): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}

/** Builds a hand-inked inline SVG heart medallion (zero `<text>` nodes). */
export function createHeartEmblem(
  state: HeartEmblemState, accent: string, className = "journal-heart-svg",
): SVGSVGElement {
  return makeSvg(className, heartEmblemMarkup(state, accent));
}
function isFocusable(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}
function buildHeartTile(entry: HeartToHeartEntry): HTMLElement {
  const state: HeartEmblemState = entry.completed ? "done" : entry.unlocked ? "ready" : "locked";
  const meta = heartToHeartMeta(entry.id, entry.unlocked || entry.completed);
  const tile = element("article", `journal-heart-tile is-${state}`);
  tile.tabIndex = 0;
  setAttribute(tile, "data-heart", entry.id);
  setAttribute(tile, "data-heart-state", state);
  if (state !== "locked") tile.style.borderLeftColor = meta.accent;
  const emblemWrap = element("div", "journal-heart-emblem-wrap", tile);
  if (state !== "locked") emblemWrap.style.borderColor = meta.accent;
  emblemWrap.append(createHeartEmblem(state, meta.accent));
  const copy = element("div", "journal-heart-copy", tile);
  const top = element("div", "journal-heart-top", copy);
  const titleText =
    state === "locked" && entry.id === "sanctuary-encore" ? "Secret Meadow Gathering" : entry.title;
  element("span", "journal-heart-name", top).textContent =
    state === "done" ? `${titleText} ♥` : titleText;
  element("span", `journal-heart-pill is-${state}`, top).textContent =
    state === "done" ? meta.locationLabel : state === "ready" ? "Ready to Visit!" : "Locked";
  element("p", "journal-heart-note", copy).textContent =
    state === "done" ? meta.memoryNote
    : state === "ready" ? `Share a quiet moment with ${meta.participantsLabel}.`
    : meta.unlockHint;
  const metaRow = element("div", "journal-heart-meta", copy);
  if (state === "done") {
    element("span", "journal-heart-pin", metaRow).textContent = `✦ ${meta.pinLabel}`;
    element("span", "journal-heart-who", metaRow).textContent = meta.participantsLabel;
  } else if (state === "ready") {
    element("span", "journal-heart-visit", metaRow).textContent = `Visit: ${meta.locationLabel}`;
  } else {
    element("span", "journal-heart-who", metaRow).textContent = meta.participantsLabel;
  }
  return tile;
}

function makeButton(className: string, ariaLabel: string, text: string): HTMLButtonElement {
  const btn = element("button", className);
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);
  btn.textContent = text;
  return btn;
}

/** Creates the hand-inked Party Heart-to-Heart Scrapbook Album modal for Fae's Journal. */
export function createJournalHeartsAlbum(options?: {
  onBeforeOpen?: () => void;
  onVisibilityChange?: (open: boolean) => void;
  onClose?: () => void;
}): JournalHeartsAlbum {
  const overlay = element("div", "journal-hearts-overlay");
  overlay.hidden = true;
  const card = element("article", "journal-hearts-card", overlay);
  card.tabIndex = -1;
  setAttribute(card, "role", "dialog");
  setAttribute(card, "aria-modal", "true");
  setAttribute(card, "aria-label", "Heart-to-Hearts");

  const head = element("div", "journal-hearts-head", card);
  const titleWrap = element("div", "journal-hearts-title-wrap", head);
  const title = element("h3", "journal-hearts-title");
  title.textContent = "HEART-TO-HEARTS";
  const count = element("span", "journal-hearts-count");
  titleWrap.append(makeSvg("journal-hearts-emblem", HEADER_HEART_MARKUP), title, count);
  const closeBtn = makeButton("journal-hearts-close", "Close Heart-to-Hearts", "×");
  head.append(closeBtn);

  const grid = element("div", "journal-hearts-grid", card);
  const footer = element("p", "journal-hearts-footer", card);
  const treasuresBtn = makeButton("journal-hearts-btn", "Open Heart-to-Hearts", "♥ Hearts · 0/6");
  treasuresBtn.hidden = true;

  let openState = false;
  let lastSig = "";
  let tiles: HTMLElement[] = [];
  let returnFocusEl: HTMLElement | null = null;

  const clear = (): void => {
    returnFocusEl = null;
    if (!openState && overlay.hidden) return;
    openState = false;
    overlay.hidden = true;
  };
  const close = (): void => {
    if (!openState && overlay.hidden) return;
    const target = returnFocusEl;
    clear();
    options?.onClose?.();
    options?.onVisibilityChange?.(false);
    if (isFocusable(target)) target.focus({ preventScroll: true });
  };
  const sync = (summary: HeartToHeartSummary | undefined): void => {
    if (summary === undefined) {
      treasuresBtn.hidden = true;
      if (openState) clear();
      return;
    }
    const complete = summary.total > 0 && summary.completed >= summary.total;
    treasuresBtn.hidden = false;
    treasuresBtn.classList.toggle("is-complete", complete);
    setText(treasuresBtn, `♥ Hearts · ${summary.completed}/${summary.total}`);
    setAttribute(
      treasuresBtn, "aria-label",
      `Open Heart-to-Hearts, ${summary.completed} of ${summary.total} shared`,
    );
    if (!openState) { if (!overlay.hidden) clear(); return; }
    overlay.hidden = false;
    const nextSig = summary.entries
      .map((e) => `${e.id}:${e.unlocked ? 1 : 0}:${e.completed ? 1 : 0}`).join("|");
    if (nextSig === lastSig) return;
    lastSig = nextSig;
    count.classList.toggle("is-complete", complete);
    setText(
      count,
      complete ? `♥ ${summary.completed}/${summary.total} ALL HEARTS SHARED!`
        : `${summary.completed}/${summary.total}`,
    );
    tiles = summary.entries.map(buildHeartTile);
    grid.replaceChildren(...tiles);
    footer.classList.toggle("is-complete", complete);
    setText(
      footer,
      complete ? "♥ All 6 Heart-to-Hearts Shared — True Cloverhollow Best Friends!"
        : "Look for floating heart bubbles in the valley to share Heart-to-Hearts!",
    );
  };
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  const open = (
    summary: HeartToHeartSummary | undefined,
    returnTarget?: HTMLElement | null,
  ): void => {
    if (summary === undefined) return;
    const wasOpen = openState;
    options?.onBeforeOpen?.();
    if (!openState) {
      returnFocusEl = returnTarget ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    openState = true;
    sync(summary);
    if (!overlay.hidden) card.focus({ preventScroll: true });
    if (!wasOpen) options?.onVisibilityChange?.(true);
  };
  const handleKeydown = (event: KeyboardEvent): boolean => {
    if (!openState) return false;
    const stop = (): void => { event.preventDefault(); event.stopPropagation(); };
    if (["Escape", "x", "X", "b", "B"].includes(event.key)) { stop(); close(); return true; }
    if ((event.key === "Enter" || event.key === " ") && document.activeElement === closeBtn) {
      stop(); close(); return true;
    }
    const len = tiles.length;
    if (len === 0) return true;
    const idx = tiles.findIndex((tile) => tile === document.activeElement);
    const key = event.key;
    const next =
      key === "Home" ? 0 : key === "End" ? len - 1
      : key === "ArrowRight" ? (idx === -1 ? 0 : (idx + 1) % len)
      : key === "ArrowLeft" ? (idx === -1 ? len - 1 : (idx - 1 + len) % len)
      : key === "ArrowDown" ? (idx === -1 ? 0 : (idx + 2) % len)
      : key === "ArrowUp" ? (idx === -1 ? len - 1 : (idx - 2 + len) % len) : null;
    if (next !== null) { stop(); tiles[next]?.focus({ preventScroll: true }); }
    return true;
  };
  return {
    overlay, treasuresBtn, open, sync, close, clear, isOpen: () => openState, handleKeydown,
  };
}
