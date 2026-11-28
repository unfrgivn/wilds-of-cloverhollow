import { element, setAttribute, setText } from "./dom";
import { gemMarkup } from "./icons";
import { applyModalScrollKey } from "./journal-nav";
import type { StarGemEntry } from "../core/journal";

const svgNamespace = "http://www.w3.org/2000/svg";

export type JournalGemsLedger = {
  overlay: HTMLDivElement;
  open: (gems: readonly StarGemEntry[] | undefined, returnTarget?: HTMLElement | null) => void;
  sync: (gems: readonly StarGemEntry[] | undefined) => void;
  close: () => void;
  clear: () => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

function createHeaderEmblem(): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", "journal-gems-emblem");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = gemMarkup;
  return svg;
}

/** Builds a faceted jewel-tinted or muted-silhouette SVG icon with zero `<text>` nodes. */
export function createStarGemIcon(color: string, found: boolean): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", found ? "journal-gem-svg is-found" : "journal-gem-svg is-missing");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.setAttribute("aria-hidden", "true");
  if (found) {
    svg.innerHTML =
      `<polygon points="8.6,4.6 19.4,4.6 24.8,11.4 14,24.4 3.2,11.4" fill="${color}"/>` +
      '<polygon points="8.6,4.6 19.4,4.6 17.6,11.4 10.4,11.4" fill="#ffffff" opacity="0.46"/>' +
      '<polygon points="3.2,11.4 8.6,4.6 10.4,11.4" fill="#ffffff" opacity="0.24"/>' +
      '<polygon points="19.4,4.6 24.8,11.4 17.6,11.4" fill="#47321f" opacity="0.14"/>' +
      '<polygon points="3.2,11.4 10.4,11.4 14,24.4" fill="#47321f" opacity="0.08"/>' +
      '<polygon points="17.6,11.4 24.8,11.4 14,24.4" fill="#47321f" opacity="0.22"/>' +
      '<path d="M3.8 11.4 H24.2 M10.4 11.4 L14 23.8 M17.6 11.4 L14 23.8" ' +
      'stroke="#47321f" stroke-opacity="0.34" stroke-width="0.9" fill="none"/>' +
      '<polygon points="8.6,4.6 19.4,4.6 24.8,11.4 14,24.4 3.2,11.4" fill="none" ' +
      'stroke="#47321f" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M8.8 6.4 L9.6 8.3 L11.5 9.1 L9.6 9.9 L8.8 11.8 L8 9.9 L6.1 9.1 L8 8.3 Z" ' +
      'fill="#ffffff"/>';
  } else {
    svg.innerHTML =
      '<polygon points="8.6,4.6 19.4,4.6 24.8,11.4 14,24.4 3.2,11.4" ' +
      'fill="#e9dec7" stroke="#47321f" stroke-opacity="0.52" stroke-width="1.6" ' +
      'stroke-dasharray="2.4 2" stroke-linejoin="round"/>' +
      '<polygon points="8.6,4.6 19.4,4.6 17.6,11.4 10.4,11.4" fill="#f7f0e0" opacity="0.72"/>' +
      '<path d="M11.6 10.4 C11.6 7.8 16.4 7.8 16.4 10.3 C16.4 12.1 14 12.3 14 14.3" ' +
      'fill="none" stroke="#6b5239" stroke-width="1.8" stroke-linecap="round"/>' +
      '<circle cx="14" cy="17.2" r="1.2" fill="#6b5239"/>';
  }
  return svg;
}

function isFocusableTarget(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

function gemGridColumns(grid: HTMLElement): number {
  if (typeof window === "undefined") return 2;
  const raw = window.getComputedStyle(grid).gridTemplateColumns.trim();
  if (raw !== "" && raw !== "none" && !raw.includes("(")) {
    return Math.max(1, raw.split(/\s+/).length);
  }
  return window.innerWidth <= 560 ? 1 : 2;
}

function buildGemTile(entry: StarGemEntry): HTMLDivElement {
  const tile = element(
    "div",
    entry.found ? "journal-gem-tile is-found" : "journal-gem-tile is-missing",
  );
  tile.tabIndex = 0;
  setAttribute(tile, "role", "listitem");
  const ariaLabel = entry.found
    ? `${entry.name} (${entry.areaName}) — Found: ${entry.foundNote}`
    : `Undiscovered Star Gem (${entry.areaName}) — Not yet found: ${entry.hint}`;
  setAttribute(tile, "aria-label", ariaLabel);
  setAttribute(tile, "data-gem", entry.id);
  setAttribute(tile, "data-found", String(entry.found));

  const iconWrap = element("div", "journal-gem-icon-wrap");
  if (entry.found) iconWrap.style.borderColor = entry.color;
  iconWrap.append(createStarGemIcon(entry.color, entry.found));

  const copy = element("div", "journal-gem-copy");
  const top = element("div", "journal-gem-top");
  const name = element("span", "journal-gem-name");
  if (entry.found) {
    name.textContent = `${entry.name} ★`;
    const area = element("span", "journal-gem-area");
    area.textContent = entry.areaName;
    top.append(name, area);
  } else {
    name.textContent = `Undiscovered · ${entry.areaName}`;
    top.append(name);
  }

  const note = element("p", entry.found ? "journal-gem-note" : "journal-gem-note is-hint");
  note.textContent = entry.found ? entry.foundNote : entry.hint;

  copy.append(top, note);
  tile.append(iconWrap, copy);
  return tile;
}

/** Creates the interactive Star Gem Field Ledger modal for Fae's Journal NOTES page. */
export function createJournalGemsLedger(options?: {
  onBeforeOpen?: () => void;
  onVisibilityChange?: (open: boolean) => void;
}): JournalGemsLedger {
  const overlay = element("div", "journal-gems-overlay");
  overlay.hidden = true;

  const card = element("article", "journal-gems-card");
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Star Gem Field Ledger");

  const head = element("div", "journal-gems-head");
  const titleWrap = element("div", "journal-gems-title-wrap");
  const title = element("h3", "journal-gems-title");
  title.textContent = "STAR GEM LEDGER";
  const count = element("span", "journal-gems-count");
  titleWrap.append(createHeaderEmblem(), title, count);

  const closeBtn = element("button", "journal-gems-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close Star Gem Ledger");
  closeBtn.textContent = "×";
  head.append(titleWrap, closeBtn);

  const grid = element("div", "journal-gems-grid");
  grid.setAttribute("role", "list");
  const footer = element("p", "journal-gems-footer");

  card.append(head, grid, footer);
  overlay.append(card);

  let openState = false;
  let signature = "";
  let tiles: HTMLDivElement[] = [];
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
    options?.onVisibilityChange?.(false);
    if (isFocusableTarget(target)) target.focus({ preventScroll: true });
  };

  const sync = (gems: readonly StarGemEntry[] | undefined): void => {
    if (!openState || gems === undefined || gems.length === 0) {
      if (!overlay.hidden) clear();
      return;
    }
    overlay.hidden = false;
    const nextSignature = gems.map((entry) => `${entry.id}:${entry.found}`).join("|");
    if (nextSignature === signature) return;
    signature = nextSignature;

    const foundCount = gems.filter((entry) => entry.found).length;
    const total = gems.length;
    const complete = total > 0 && foundCount >= total;
    count.classList.toggle("is-complete", complete);
    setText(count, complete ? `★ ${foundCount}/${total} COMPLETE!` : `${foundCount}/${total}`);
    tiles = gems.map(buildGemTile);
    grid.replaceChildren(...tiles);
    footer.classList.toggle("is-complete", complete);
    setText(
      footer,
      complete
        ? "★ All 7 Valley Star Gems found — Grandpa Barnaby's Rainbow Geode shines!"
        : "Bring all 7 Star Gems to Grandpa Barnaby at the Mountain Lodge!",
    );
  };

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  return {
    overlay,
    open: (gems, returnTarget) => {
      if (gems === undefined || gems.length === 0) return;
      const wasOpen = openState;
      options?.onBeforeOpen?.();
      if (!openState) {
        returnFocusEl =
          returnTarget !== undefined && returnTarget !== null
            ? returnTarget
            : document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
      }
      openState = true;
      sync(gems);
      if (!overlay.hidden) card.focus({ preventScroll: true });
      if (!wasOpen) options?.onVisibilityChange?.(true);
    },
    sync,
    close,
    clear,
    isOpen: () => openState,
    handleKeydown: (event) => {
      if (!openState) return false;
      const stop = (): void => {
        event.preventDefault();
        event.stopPropagation();
      };
      const key = event.key;
      if (["Escape", "x", "X", "b", "B"].includes(key)) {
        stop();
        close();
        return true;
      }
      if ((key === "Enter" || key === " ") && document.activeElement === closeBtn) {
        stop();
        close();
        return true;
      }
      if (key === "PageDown" || key === "PageUp") {
        stop();
        applyModalScrollKey([grid, card], key);
        return true;
      }
      const len = tiles.length;
      if (len === 0) return true;
      const cols = gemGridColumns(grid);
      const idx = tiles.findIndex((tile) => tile === document.activeElement);
      const next =
        key === "Home" ? 0
        : key === "End" ? len - 1
        : key === "ArrowRight" ? (idx === -1 ? 0 : (idx + 1) % len)
        : key === "ArrowLeft" ? (idx === -1 ? len - 1 : (idx - 1 + len) % len)
        : key === "ArrowDown" ? (idx === -1 ? 0 : (idx + cols) % len)
        : key === "ArrowUp" ? (idx === -1 ? len - 1 : (idx - cols + len) % len)
        : null;
      if (next !== null) {
        stop();
        const beforeTop = card.scrollTop;
        const target = tiles[next];
        target?.focus({ preventScroll: true });
        target?.scrollIntoView?.({ block: "nearest" });
        const scrollFallback =
          (key === "ArrowDown" || key === "ArrowUp") && idx === -1 && card.scrollTop === beforeTop;
        if (key === "Home" || key === "End" || scrollFallback) {
          applyModalScrollKey([grid, card], key);
        }
      }
      return true;
    },
  };
}
