import "./journal-jukebox.css";
import { element, setAttribute, setText } from "./dom";
import { applyModalScrollKey } from "./journal-nav";
import type { JukeboxMeta } from "./journal-options";
import {
  JUKEBOX_ALBUM, jukeboxTracks, trackAlbumEntry,
  type JukeboxTrack, type TrackAlbumMeta, type TrackCategory,
} from "../core/music";

const SVG_NS = "http://www.w3.org/2000/svg";

export type AlbumFilter = "all" | TrackCategory;
export type JournalJukeboxSnapshot = { nowPlaying?: string; jukebox?: JukeboxMeta };
export type JournalJukeboxOptions = {
  onBeforeOpen?: () => void; onVisibilityChange?: (open: boolean) => void; onClose?: () => void;
  onSelectTrack?: (track: JukeboxTrack) => void; onResetTrack?: () => void;
  onFilterChange?: () => void;
};
export type JournalJukeboxAlbum = {
  overlay: HTMLDivElement; treasuresBtn: HTMLButtonElement;
  open: (snapshot: JournalJukeboxSnapshot | null, returnTarget?: HTMLElement | null) => void;
  sync: (snapshot: JournalJukeboxSnapshot) => void; close: () => void; clear: () => void;
  isOpen: () => boolean; handleKeydown: (event: KeyboardEvent) => boolean;
};

const FILTER_DEFS: readonly { id: AlbumFilter; label: string }[] = [
  { id: "all", label: `All · ${JUKEBOX_ALBUM.length}` }, { id: "town", label: "Town" },
  { id: "interiors", label: "Homes & Shops" }, { id: "wilds", label: "Wilds" },
  { id: "festive", label: "Festive" }, { id: "story", label: "Story & Battle" },
];

/** Pure inner SVG markup for the hand-inked music-box header emblem (no SVG text nodes). */
export const HEADER_MUSIC_BOX_MARKUP =
  '<path d="M 5.4 17.2 H 23.4 V 26.8 C 23.4 27.9 22.5 28.8 21.4 28.8 H 7.4 ' +
  'C 6.3 28.8 5.4 27.9 5.4 26.8 Z" fill="#e8b878" stroke="#47321f" stroke-width="1.65" ' +
  'stroke-linejoin="round"/>' +
  '<path d="M 4.4 16.8 L 8.2 11.4 H 21.8 L 24.4 16.8 Z" fill="#f7d89c" stroke="#47321f" ' +
  'stroke-width="1.55" stroke-linejoin="round"/>' +
  '<rect x="12.2" y="21" width="4.4" height="3.2" rx="1.1" fill="#ffe89c" stroke="#47321f" ' +
  'stroke-width="1.2"/>' +
  '<path d="M 23.4 22.2 H 27.6 M 27.6 19.8 V 24.6" stroke="#47321f" stroke-width="1.65" ' +
  'stroke-linecap="round"/>' +
  '<circle cx="27.6" cy="22.2" r="2.1" fill="#ffe175" stroke="#47321f" stroke-width="1.2"/>' +
  '<path d="M 13.8 11.2 V 5.4 L 20.6 3.8 V 9.4" fill="none" stroke="#47321f" ' +
  'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<ellipse cx="12.1" cy="11.4" rx="2.1" ry="1.5" transform="rotate(-18 12.1 11.4)" ' +
  'fill="#7fc7b8" stroke="#47321f" stroke-width="1.2"/>' +
  '<ellipse cx="18.9" cy="9.8" rx="2.1" ry="1.5" transform="rotate(-18 18.9 9.8)" ' +
  'fill="#f29ab8" stroke="#47321f" stroke-width="1.2"/>' +
  '<path d="M 26.4 4.2 L 27.2 6.1 L 29.1 6.9 L 27.2 7.7 L 26.4 9.6 L 25.6 7.7 ' +
  'L 23.7 6.9 L 25.6 6.1 Z" fill="#ffe478" stroke="#47321f" stroke-width="0.95" ' +
  'stroke-linejoin="round"/>';

/** Pure inner SVG markup for a hand-inked beamed eighth-note badge (no SVG text nodes). */
export const MUSIC_NOTE_MARKUP =
  '<path d="M 11.8 22.4 V 8.8 L 23.2 6.2 V 19.6" fill="none" stroke="#47321f" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M 11.8 12.4 L 23.2 9.8" stroke="#47321f" stroke-width="1.7" stroke-linecap="round"/>' +
  '<ellipse cx="9.2" cy="22.8" rx="3.4" ry="2.4" transform="rotate(-18 9.2 22.8)" ' +
  'fill="#ffe175" stroke="#47321f" stroke-width="1.5"/>' +
  '<ellipse cx="20.6" cy="20" rx="3.4" ry="2.4" transform="rotate(-18 20.6 20)" ' +
  'fill="#f29ab8" stroke="#47321f" stroke-width="1.5"/>';

function makeSvg(className: string, markup: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className); svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true"); svg.innerHTML = markup;
  return svg;
}
function makeButton(className: string, ariaLabel: string, text = ""): HTMLButtonElement {
  const btn = element("button", className);
  btn.type = "button"; btn.setAttribute("aria-label", ariaLabel);
  if (text !== "") btn.textContent = text;
  return btn;
}
function isFocusable(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

function resolveActiveTrack(snapshot: JournalJukeboxSnapshot): JukeboxTrack | null {
  const index = snapshot.jukebox?.index ?? -1;
  const byIndex = index >= 0 ? jukeboxTracks[index] : undefined;
  if (byIndex !== undefined) return byIndex;
  if (snapshot.nowPlaying === undefined || snapshot.nowPlaying === "") return null;
  return JUKEBOX_ALBUM.find((entry) => entry.title === snapshot.nowPlaying)?.track ?? null;
}

type TrackCardRef = { meta: TrackAlbumMeta; btn: HTMLButtonElement; playingPill: HTMLSpanElement };

function buildTrackCard(
  meta: TrackAlbumMeta,
  onSelect: (track: JukeboxTrack) => void,
): TrackCardRef {
  const numLabel = String(meta.number).padStart(2, "0");
  const btn = makeButton(
    "journal-album-track", `Play track ${numLabel}: ${meta.title} (${meta.region})`,
  );
  setAttribute(btn, "data-track", meta.track);
  setAttribute(btn, "data-category", meta.category);
  setAttribute(btn, "aria-pressed", "false");
  btn.style.borderLeftColor = meta.accent;

  const num = element("span", "journal-album-num", btn);
  num.textContent = numLabel;
  num.style.borderColor = meta.accent;
  const copy = element("span", "journal-album-copy", btn);
  const top = element("span", "journal-album-top", copy);
  element("span", "journal-album-name", top).textContent = meta.title;
  const badges = element("span", "journal-album-badges", top);
  const playingPill = element("span", "journal-album-playing", badges);
  playingPill.textContent = "♪ Playing";
  playingPill.hidden = true;
  element("span", "journal-album-region", badges).textContent = meta.region;
  element("span", "journal-album-mood", copy).textContent = meta.mood;
  btn.addEventListener("click", () => onSelect(meta.track));
  return { meta, btn, playingPill };
}

/** Creates the interactive 33-track Storybook Soundtrack Album modal for Fae's Journal. */
export function createJournalJukeboxAlbum(options?: JournalJukeboxOptions): JournalJukeboxAlbum {
  const overlay = element("div", "journal-jukebox-overlay");
  overlay.hidden = true;
  const card = element("article", "journal-jukebox-card", overlay);
  card.tabIndex = -1;
  setAttribute(card, "role", "dialog"); setAttribute(card, "aria-modal", "true");
  setAttribute(card, "aria-label", "Soundtrack Album");
  setAttribute(card, "data-album-filter", "all");
  setAttribute(card, "data-jukebox-active", "false");

  const head = element("div", "journal-jukebox-head", card);
  const titleWrap = element("div", "journal-jukebox-title-wrap", head);
  const title = element("h3", "journal-jukebox-title");
  title.textContent = "SOUNDTRACK ALBUM";
  const countPill = element("span", "journal-jukebox-count");
  countPill.setAttribute("aria-live", "polite");
  countPill.textContent = `${JUKEBOX_ALBUM.length} Themes`;
  titleWrap.append(makeSvg("journal-jukebox-emblem", HEADER_MUSIC_BOX_MARKUP), title, countPill);

  const headActions = element("div", "journal-jukebox-actions", head);
  const resetBtn = makeButton("journal-album-reset", "Return to Area Theme", "Area Theme");
  resetBtn.hidden = true;
  const closeBtn = makeButton("journal-jukebox-close", "Close Soundtrack Album", "×");
  headActions.append(resetBtn, closeBtn);

  const filterBar = element("div", "journal-album-filters", card);
  setAttribute(filterBar, "role", "group");
  setAttribute(filterBar, "aria-label", "Filter soundtrack by category");
  const filterBtns = FILTER_DEFS.map((def) => {
    const btn = makeButton("journal-album-filter", `Filter ${def.label}`, def.label);
    setAttribute(btn, "data-album-category", def.id);
    setAttribute(btn, "aria-pressed", String(def.id === "all"));
    filterBar.append(btn);
    return { id: def.id, btn };
  });

  const grid = element("div", "journal-album-grid", card);
  const trackRefs = JUKEBOX_ALBUM.map((meta) =>
    buildTrackCard(meta, (track) => { options?.onSelectTrack?.(track); }),
  );
  grid.append(...trackRefs.map((ref) => ref.btn));
  const treasuresBtn = makeButton(
    "journal-album-btn",
    `Open Soundtrack Album, ${JUKEBOX_ALBUM.length} original themes`,
    `♫ OST · ${JUKEBOX_ALBUM.length}`,
  );

  let openState = false;
  let lastSig = "";
  let activeFilter: AlbumFilter = "all";
  let activeTrack: JukeboxTrack | null = null;
  let returnFocusEl: HTMLElement | null = null;

  const applyFilter = (next: AlbumFilter, notify = true): void => {
    const changed = next !== activeFilter;
    activeFilter = next;
    setAttribute(card, "data-album-filter", next);
    for (const item of filterBtns) setAttribute(item.btn, "aria-pressed", String(item.id === next));
    for (const ref of trackRefs) ref.btn.hidden = next !== "all" && ref.meta.category !== next;
    grid.scrollTop = 0;
    if (notify && changed) options?.onFilterChange?.();
  };
  for (const item of filterBtns) item.btn.addEventListener("click", () => applyFilter(item.id));
  resetBtn.addEventListener("click", () => { options?.onResetTrack?.(); });

  const clear = (): void => {
    returnFocusEl = null;
    if (!openState && overlay.hidden) return;
    openState = false; overlay.hidden = true;
  };
  const close = (): void => {
    if (!openState && overlay.hidden) return;
    const target = returnFocusEl;
    clear();
    options?.onClose?.(); options?.onVisibilityChange?.(false);
    if (isFocusable(target)) target.focus({ preventScroll: true });
  };
  const sync = (snapshot: JournalJukeboxSnapshot): void => {
    if (!openState) { if (!overlay.hidden) clear(); return; }
    overlay.hidden = false;
    activeTrack = resolveActiveTrack(snapshot);
    const jukeboxActive = snapshot.jukebox?.active === true;
    const titleText = activeTrack !== null
      ? trackAlbumEntry(activeTrack).title : (snapshot.nowPlaying ?? "");
    const nextSig = `${activeTrack ?? "none"}|${jukeboxActive ? 1 : 0}|${titleText}`;
    if (nextSig === lastSig) return;
    lastSig = nextSig;
    setAttribute(card, "data-jukebox-active", String(jukeboxActive));
    countPill.classList.toggle("is-active", jukeboxActive);
    setText(countPill, jukeboxActive && titleText !== ""
      ? `♪ Playing: ${titleText}` : `${JUKEBOX_ALBUM.length} Themes`);
    resetBtn.hidden = !jukeboxActive;
    if (!jukeboxActive && document.activeElement === resetBtn) card.focus({ preventScroll: true });
    for (const ref of trackRefs) {
      const playing = ref.meta.track === activeTrack;
      ref.btn.classList.toggle("is-playing", playing);
      setAttribute(ref.btn, "aria-pressed", String(playing));
      ref.playingPill.hidden = !playing;
    }
  };
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });

  const open = (
    snapshot: JournalJukeboxSnapshot | null,
    returnTarget?: HTMLElement | null,
  ): void => {
    const wasOpen = openState;
    options?.onBeforeOpen?.();
    if (!openState) {
      returnFocusEl = returnTarget ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    openState = true; overlay.hidden = false;
    if (!wasOpen) applyFilter("all", false);
    lastSig = "";
    sync(snapshot ?? {});
    card.focus({ preventScroll: true });
    const activeRef = trackRefs.find((ref) => !ref.btn.hidden && ref.meta.track === activeTrack);
    activeRef?.btn.scrollIntoView?.({ block: "nearest" });
    if (!wasOpen) options?.onVisibilityChange?.(true);
  };
  const handleKeydown = (event: KeyboardEvent): boolean => {
    if (!openState) return false;
    const stop = (): void => { event.preventDefault(); event.stopPropagation(); };
    const key = event.key;
    if (["Escape", "x", "X", "b", "B"].includes(key)) { stop(); close(); return true; }
    if ((key === "Enter" || key === " ") &&
      document.activeElement instanceof HTMLButtonElement && card.contains(document.activeElement)
    ) { stop(); document.activeElement.click(); return true; }
    if (key === "PageDown" || key === "PageUp") {
      stop(); applyModalScrollKey([grid, card], key); return true;
    }
    const filterIdx = filterBtns.findIndex((item) => item.btn === document.activeElement);
    if (filterIdx !== -1 && (key === "ArrowLeft" || key === "ArrowRight")) {
      stop();
      const len = filterBtns.length;
      filterBtns[(filterIdx + (key === "ArrowRight" ? 1 : -1) + len) % len]?.btn.focus({
        preventScroll: true,
      });
      return true;
    }
    const visible = trackRefs.filter((ref) => !ref.btn.hidden);
    const len = visible.length;
    if (len === 0) return true;
    const idx = visible.findIndex((ref) => ref.btn === document.activeElement);
    const next =
      key === "Home" ? 0 : key === "End" ? len - 1
      : key === "ArrowRight" ? (idx === -1 ? 0 : (idx + 1) % len)
      : key === "ArrowLeft" ? (idx === -1 ? len - 1 : (idx - 1 + len) % len)
      : key === "ArrowDown" ? (idx === -1 ? 0 : (idx + 2) % len)
      : key === "ArrowUp" ? (idx === -1 ? len - 1 : (idx - 2 + len) % len) : null;
    if (next !== null) {
      stop();
      const target = visible[next]?.btn;
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
