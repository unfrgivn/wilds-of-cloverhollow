import "./journal-encore.css";
import { element, setAttribute, setText } from "./dom";
import { applyModalScrollKey } from "./journal-nav";
import type { JournalEncoreEntry, JournalEncoreSummary } from "../core/encore";

const SVG_NS = "http://www.w3.org/2000/svg";

export type JournalEncoreCase = {
  overlay: HTMLDivElement;
  treasuresBtn: HTMLButtonElement;
  open: (summary: JournalEncoreSummary | undefined, returnTarget?: HTMLElement | null) => void;
  sync: (summary: JournalEncoreSummary | undefined) => void;
  close: () => void;
  clear: () => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

const BOSS_ACCENTS: Readonly<Record<string, string>> = {
  gull: "#5fa8c4", "arcade-keeper": "#e37e6d", lifeguard: "#55b8b4",
  "lodge-keeper": "#6e9bd6", "art-teacher": "#a779c8", principal: "#d7a43d",
  "moon-owl": "#7585c9", "taco-chef": "#e09142", "hooded-kid": "#9c74d6",
};

const CUP_BODY =
  "M 9.2 6.6 H 22.8 V 13.8 C 22.8 17.8 19.8 20.6 16 20.6 C 12.2 20.6 9.2 17.8 9.2 13.8 Z";
const HANDLES =
  "M 9.2 8.4 H 6.6 C 5.3 8.4 4.8 10 5.3 12 C 5.8 14.1 7.4 15.2 9.4 15.1 " +
  "M 22.8 8.4 H 25.4 C 26.7 8.4 27.2 10 26.7 12 C 26.2 14.1 24.6 15.2 22.6 15.1";
const BASE_PATH =
  "M 14.2 20.4 H 17.8 V 23.4 L 21.4 25.4 V 27.4 H 10.6 V 25.4 L 14.2 23.4 Z";
const CENTER_STAR =
  "M 16 9.4 L 17.1 12.1 L 19.8 13.1 L 17.1 14.1 L 16 16.8 L 14.9 14.1 L 12.2 13.1 L 14.9 12.1 Z";
const TWINKLE =
  "M 26.4 3.4 L 27.2 5.3 L 29.1 6.1 L 27.2 6.9 L 26.4 8.8 L 25.6 6.9 L 23.7 6.1 L 25.6 5.3 Z";

const GOLD_CUP =
  `<path d="${HANDLES}" fill="none" stroke="#47321f" stroke-width="1.8" stroke-linecap="round"/>` +
  `<path d="${BASE_PATH}" fill="#e6b647" stroke="#47321f" stroke-width="1.55" ` +
  'stroke-linejoin="round"/>' +
  `<path d="${CUP_BODY}" fill="#ffd966" stroke="#47321f" stroke-width="1.65" ` +
  'stroke-linejoin="round"/>' +
  `<path d="${CENTER_STAR}" fill="#fff8d6" stroke="#47321f" stroke-width="0.95" ` +
  'stroke-linejoin="round"/>' +
  `<path d="${TWINKLE}" fill="#ffe878" stroke="#47321f" stroke-width="0.95" ` +
  'stroke-linejoin="round"/>';

/** Pure inner SVG markup for the header trophy emblem (no SVG text nodes). */
export const HEADER_TROPHY_MARKUP =
  GOLD_CUP +
  '<path d="M 12.5 21.5 L 16 22.8 L 19.5 21.5 L 18.6 24.1 L 16 23.3 L 13.4 24.1 Z" ' +
  'fill="#b99ce8" stroke="#47321f" stroke-width="1" stroke-linejoin="round"/>';

/** Pure inner SVG markup for a hand-inked trophy medallion (no SVG text nodes). */
export function trophyEmblemMarkup(won: boolean, accent: string): string {
  if (won) {
    return `${GOLD_CUP}<circle cx="16" cy="22.4" r="2.1" fill="${accent}" ` +
      'stroke="#47321f" stroke-width="1"/>';
  }
  return (
    `<path d="${HANDLES}" fill="none" stroke="#47321f" stroke-opacity="0.5" stroke-width="1.6" ` +
    'stroke-linecap="round" stroke-dasharray="2.2 1.8"/>' +
    `<path d="${BASE_PATH}" fill="#e6dac1" stroke="#47321f" stroke-opacity="0.62" ` +
    'stroke-width="1.5" stroke-linejoin="round"/>' +
    `<path d="${CUP_BODY}" fill="#ece1ca" stroke="#47321f" stroke-opacity="0.68" ` +
    'stroke-width="1.55" stroke-dasharray="2.4 1.8" stroke-linejoin="round"/>' +
    `<path d="${CENTER_STAR}" fill="#f7f0e0" stroke="#5a4028" stroke-opacity="0.55" ` +
    'stroke-width="0.95" stroke-linejoin="round"/>'
  );
}

function makeSvg(className: string, markup: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}

function isFocusable(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

function makeButton(className: string, ariaLabel: string, text: string): HTMLButtonElement {
  const btn = element("button", className);
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);
  btn.textContent = text;
  return btn;
}

function buildEncoreTile(entry: JournalEncoreEntry): HTMLElement {
  const accent = BOSS_ACCENTS[entry.id] ?? "#d9a441";
  const tile = element("article", `journal-encore-tile ${entry.won ? "is-won" : "is-open"}`);
  tile.tabIndex = 0;
  setAttribute(tile, "data-encore-boss", entry.id);
  setAttribute(tile, "data-encore-state", entry.won ? "won" : "open");
  if (entry.won) tile.style.borderLeftColor = accent;
  const emblemWrap = element("div", "journal-encore-emblem-wrap", tile);
  if (entry.won) emblemWrap.style.borderColor = accent;
  emblemWrap.append(makeSvg("journal-encore-svg", trophyEmblemMarkup(entry.won, accent)));
  const copy = element("div", "journal-encore-copy", tile);
  element("span", "journal-encore-name", copy).textContent =
    entry.won ? `${entry.title} ★` : entry.title;
  const starsRow = element("div", "journal-encore-stars-row", copy);
  if (entry.won) {
    const pips = element("span", "journal-encore-pips", starsRow);
    pips.setAttribute("aria-hidden", "true");
    for (let i = 0; i < entry.maxStars; i += 1) {
      const pip = element("span", i < entry.stars ? "is-filled" : "is-empty", pips);
      pip.textContent = i < entry.stars ? "★" : "☆";
    }
    element("span", "journal-encore-stars-label", starsRow).textContent =
      `${entry.stars}/${entry.maxStars} Stars`;
  } else {
    element("span", "journal-encore-pill", starsRow).textContent = "Unchallenged";
  }
  element("p", "journal-encore-sub", copy).textContent =
    entry.won ? entry.trophyName : "Challenge at the Sanctuary Shrine";
  return tile;
}

/** Creates the hand-inked Dream Encore Trophy Case modal for Fae's Journal. */
export function createJournalEncoreCase(options?: {
  onBeforeOpen?: () => void;
  onVisibilityChange?: (open: boolean) => void;
  onClose?: () => void;
}): JournalEncoreCase {
  const overlay = element("div", "journal-encore-overlay");
  overlay.hidden = true;
  const card = element("article", "journal-encore-card", overlay);
  card.tabIndex = -1;
  setAttribute(card, "role", "dialog");
  setAttribute(card, "aria-modal", "true");
  setAttribute(card, "aria-label", "Dream Encore Trophies");

  const head = element("div", "journal-encore-head", card);
  const titleWrap = element("div", "journal-encore-title-wrap", head);
  const title = element("h3", "journal-encore-title");
  title.textContent = "DREAM ENCORE TROPHIES";
  const count = element("span", "journal-encore-count");
  titleWrap.append(makeSvg("journal-encore-emblem", HEADER_TROPHY_MARKUP), title, count);
  const closeBtn = makeButton("journal-encore-close", "Close Dream Encore Trophies", "×");
  head.append(closeBtn);
  const grid = element("div", "journal-encore-grid", card);
  const footer = element("p", "journal-encore-footer", card);
  const treasuresBtn = makeButton(
    "journal-encore-btn", "Open Dream Encore Trophies", "★ Encore · 0/9",
  );
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
  const sync = (summary: JournalEncoreSummary | undefined): void => {
    if (summary === undefined || !summary.unlocked) {
      treasuresBtn.hidden = true;
      if (openState) clear();
      return;
    }
    const complete = summary.total > 0 && summary.earned >= summary.total;
    treasuresBtn.hidden = false;
    treasuresBtn.classList.toggle("is-complete", complete);
    setText(treasuresBtn, `★ Encore · ${summary.earned}/${summary.total}`);
    const aria = `Open Dream Encore Trophies, ${summary.earned} of ${summary.total} claimed`;
    setAttribute(treasuresBtn, "aria-label", aria);
    if (!openState) { if (!overlay.hidden) clear(); return; }
    overlay.hidden = false;
    const nextSig = summary.entries
      .map((entry) => `${entry.id}:${entry.won ? 1 : 0}:${entry.stars}`)
      .join("|");
    if (nextSig === lastSig) return;
    lastSig = nextSig;
    count.classList.toggle("is-complete", complete);
    setText(
      count,
      complete ? `★ ${summary.earned}/${summary.total} ENCORE MASTER!`
        : `${summary.earned}/${summary.total}`,
    );
    tiles = summary.entries.map(buildEncoreTile);
    grid.replaceChildren(...tiles);
    footer.classList.toggle("is-complete", complete);
    setText(
      footer,
      complete
        ? "★ All 9 Dream Encore Trophies Claimed — Radiant Trophy Gleams in the Clubhouse!"
        : "Visit the Wildlife Sanctuary Dream Memory Shrine to replay bosses with Star Challenges!",
    );
  };
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });

  const open = (
    summary: JournalEncoreSummary | undefined,
    returnTarget?: HTMLElement | null,
  ): void => {
    if (summary === undefined || !summary.unlocked) return;
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
    const key = event.key;
    if (["Escape", "x", "X", "b", "B"].includes(key)) { stop(); close(); return true; }
    if ((key === "Enter" || key === " ") && document.activeElement === closeBtn) {
      stop(); close(); return true;
    }
    if (key === "PageDown" || key === "PageUp") {
      stop(); applyModalScrollKey([grid, card], key); return true;
    }
    const len = tiles.length;
    if (len === 0) return true;
    const idx = tiles.findIndex((tile) => tile === document.activeElement);
    const next =
      key === "Home" ? 0 : key === "End" ? len - 1
      : key === "ArrowRight" ? (idx === -1 ? 0 : (idx + 1) % len)
      : key === "ArrowLeft" ? (idx === -1 ? len - 1 : (idx - 1 + len) % len)
      : key === "ArrowDown" ? (idx === -1 ? 0 : (idx + 3) % len)
      : key === "ArrowUp" ? (idx === -1 ? len - 1 : (idx - 3 + len) % len) : null;
    if (next !== null) {
      stop();
      const target = tiles[next];
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: "nearest" });
      if (key === "Home" || key === "End") applyModalScrollKey([grid, card], key);
    }
    return true;
  };
  return {
    overlay, treasuresBtn, open, sync, close, clear, isOpen: () => openState, handleKeydown,
  };
}
