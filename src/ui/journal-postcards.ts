import "./journal-postcards.css";
import { element, setAttribute, setText } from "./dom";
import { applyModalScrollKey } from "./journal-nav";
import { deliverPostcard } from "./postcard";
import {
  getPostcardAlbum, POSTCARD_ALBUM_LIMIT, removePostcardFromAlbum, subscribePostcardAlbum,
  type SavedPostcard,
} from "../platform/postcard-album";

const SVG_NS = "http://www.w3.org/2000/svg";

export type JournalPostcardsOptions = {
  onBeforeOpen?: () => void; onVisibilityChange?: (open: boolean) => void;
  onClose?: () => void; onAction?: () => void; onStep?: () => void;
};

export type JournalPostcardsAlbum = {
  overlay: HTMLDivElement; treasuresBtn: HTMLButtonElement;
  open: (returnTarget?: HTMLElement | null) => void; sync: () => void;
  close: () => void; clear: () => void; isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

/** Pure inner SVG markup for the hand-inked camera-album header emblem (no SVG text nodes). */
export const HEADER_POSTCARD_ALBUM_MARKUP =
  '<rect x="11.2" y="4.2" width="15.8" height="12.6" rx="2.4" transform="rotate(9 19 10.5)" ' +
  'fill="#fff9e8" stroke="#47321f" stroke-width="1.5"/>' +
  '<rect x="13.4" y="6.3" width="11.2" height="7.4" rx="1.2" transform="rotate(9 19 10)" ' +
  'fill="#b6dfb5" stroke="#47321f" stroke-width="1.15"/>' +
  '<path d="M 4.4 13.6 C 4.4 12.2 5.5 11.2 6.8 11.2 H 9.6 L 11.1 8.8 ' +
  'C 11.5 8.2 12.1 7.9 12.8 7.9 H 16.4 C 17.1 7.9 17.7 8.2 18.1 8.8 L 19.6 11.2 H 22.4 ' +
  'C 23.7 11.2 24.8 12.2 24.8 13.6 V 24.4 C 24.8 25.8 23.7 26.8 22.4 26.8 H 6.8 ' +
  'C 5.5 26.8 4.4 25.8 4.4 24.4 Z" fill="#f5d594" stroke="#47321f" stroke-width="1.65" ' +
  'stroke-linejoin="round"/>' +
  '<circle cx="14.6" cy="18.9" r="4.6" fill="#9fd8ff" stroke="#47321f" stroke-width="1.6"/>' +
  '<circle cx="13.1" cy="17.3" r="1.25" fill="#fffdf7"/>' +
  '<circle cx="21.1" cy="14.5" r="1.2" fill="#47321f"/>' +
  '<path d="M 27.6 15.8 L 28.4 17.6 L 30.2 18.4 L 28.4 19.2 L 27.6 21 L 26.8 19.2 ' +
  'L 25 18.4 L 26.8 17.6 Z" fill="#ffe478" stroke="#47321f" stroke-width="0.95" ' +
  'stroke-linejoin="round"/>';

/** Pure inner SVG markup for the empty-album camera illustration (no SVG text nodes). */
export const EMPTY_ALBUM_MARKUP =
  '<rect x="6" y="8" width="36" height="28" rx="4.5" fill="#fbf3dc" stroke="#47321f" ' +
  'stroke-width="1.6" stroke-dasharray="3.2 2.4"/>' +
  '<path d="M 12.2 18.2 C 12.2 16.6 13.5 15.4 15.1 15.4 H 18.2 L 19.9 12.7 ' +
  'C 20.4 12 21.1 11.6 21.9 11.6 H 26.1 C 26.9 11.6 27.6 12 28.1 12.7 L 29.8 15.4 H 32.9 ' +
  'C 34.5 15.4 35.8 16.6 35.8 18.2 V 29.2 C 35.8 30.8 34.5 32 32.9 32 H 15.1 ' +
  'C 13.5 32 12.2 30.8 12.2 29.2 Z" fill="#f7dca1" stroke="#47321f" stroke-width="1.7" ' +
  'stroke-linejoin="round"/>' +
  '<circle cx="24" cy="23.8" r="5.1" fill="#a8ddf8" stroke="#47321f" stroke-width="1.65"/>' +
  '<circle cx="22.3" cy="22.1" r="1.4" fill="#fffdf7"/>' +
  '<circle cx="31.4" cy="19.1" r="1.3" fill="#47321f"/>' +
  '<path d="M 38.6 9.8 L 39.6 12.2 L 42 13.2 L 39.6 14.2 L 38.6 16.6 L 37.6 14.2 ' +
  'L 35.2 13.2 L 37.6 12.2 Z" fill="#ffe57a" stroke="#47321f" stroke-width="1" ' +
  'stroke-linejoin="round"/>';

function makeSvg(className: string, viewBox: string, markup: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className); svg.setAttribute("viewBox", viewBox);
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
function shortTileCaption(caption: string): string {
  const stripped = caption.replace(/\s*·\s*Wilds of Cloverhollow$/i, "").trim();
  return stripped.length > 0 ? stripped : caption.trim();
}
function imageToPngDataUrl(img: HTMLImageElement, fallback: string): string {
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return fallback;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return fallback;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const encoded = canvas.toDataURL("image/png");
  return encoded.startsWith("data:image/png;base64,") ? encoded : fallback;
}

/** Creates Fae's interactive Postcard Scrapbook Album modal for Fae's Journal. */
export function createJournalPostcardsAlbum(
  options?: JournalPostcardsOptions,
): JournalPostcardsAlbum {
  const overlay = element("div", "journal-postcards-overlay");
  overlay.hidden = true;
  const card = element("article", "journal-postcards-card", overlay);
  card.tabIndex = -1;
  setAttribute(card, "role", "dialog"); setAttribute(card, "aria-modal", "true");
  setAttribute(card, "aria-label", "Postcard Album");
  setAttribute(card, "data-album-mode", "grid"); setAttribute(card, "data-album-count", "0");

  const head = element("div", "journal-postcards-head", card);
  const titleWrap = element("div", "journal-postcards-title-wrap", head);
  element("h3", "journal-postcards-title", titleWrap).textContent = "POSTCARD ALBUM";
  const countPill = element("span", "journal-postcards-count", titleWrap);
  countPill.setAttribute("aria-live", "polite");
  titleWrap.prepend(makeSvg("journal-postcards-emblem", "0 0 32 32", HEADER_POSTCARD_ALBUM_MARKUP));
  const closeBtn = makeButton("journal-postcards-close", "Close Postcard Album", "×");
  head.append(closeBtn);
  const emptyBox = element("div", "journal-postcards-empty", card);
  emptyBox.append(makeSvg("journal-postcards-empty-icon", "0 0 48 48", EMPTY_ALBUM_MARKUP));
  const emptyTitle = element("p", "journal-postcards-empty-title", emptyBox);
  emptyTitle.textContent = "No postcards tucked in yet!";
  element("p", "journal-postcards-empty-note", emptyBox).textContent =
    "Press P (or tap the camera in Options) to frame and snap a Cloverhollow memory.";
  const grid = element("div", "journal-postcards-grid", card);
  const lightbox = element("div", "journal-postcards-lightbox", card);
  lightbox.hidden = true;
  const lbBar = element("div", "journal-lightbox-bar", lightbox);
  const lbBack = makeButton("journal-lightbox-back", "Back to Postcard Album", "← Back to Album");
  const lbNav = element("div", "journal-lightbox-nav");
  const lbPrev = makeButton("journal-lightbox-prev", "Previous postcard", "‹");
  const lbPos = element("span", "journal-lightbox-pos");
  lbPos.setAttribute("aria-live", "polite");
  const lbNext = makeButton("journal-lightbox-next", "Next postcard", "›");
  lbNav.append(lbPrev, lbPos, lbNext); lbBar.append(lbBack, lbNav);
  const lbContent = element("div", "journal-lightbox-content", lightbox);
  const lbImg = document.createElement("img");
  lbImg.className = "journal-lightbox-img"; lbImg.draggable = false;
  element("div", "journal-lightbox-frame", lbContent).append(lbImg);

  const lbMeta = element("div", "journal-lightbox-meta", lbContent);
  const lbText = element("div", "journal-lightbox-text", lbMeta);
  const lbCaption = element("div", "journal-lightbox-caption", lbText);
  const lbSub = element("div", "journal-lightbox-sub", lbText);
  const lbStatus = element("span", "journal-lightbox-status", lbText);
  setAttribute(lbStatus, "role", "status"); setAttribute(lbStatus, "aria-live", "polite");
  lbStatus.hidden = true;
  const lbActions = element("div", "journal-lightbox-actions", lbMeta);
  const lbSave = makeButton("journal-lightbox-save", "Save postcard as PNG", "Save PNG");
  const lbRemove = makeButton("journal-lightbox-remove", "Remove postcard from album", "Remove");
  lbActions.append(lbSave, lbRemove);
  const treasuresBtn = makeButton("journal-postcards-btn", "Open Postcard Album", "📷 Photos");

  let openState = false; let entries: SavedPostcard[] = []; let selectedId: string | null = null;
  let lastGridSig = ""; let tileButtons: HTMLButtonElement[] = [];
  let returnFocusEl: HTMLElement | null = null; let statusTimer = 0;
  const clearStatus = (): void => {
    window.clearTimeout(statusTimer); statusTimer = 0;
    lbStatus.textContent = ""; lbStatus.hidden = true;
  };
  const showStatus = (message: string): void => {
    window.clearTimeout(statusTimer); lbStatus.textContent = message; lbStatus.hidden = false;
    statusTimer = window.setTimeout(clearStatus, 1800);
  };
  const renderState = (forceGrid = false): void => {
    const count = entries.length;
    setText(treasuresBtn, count > 0 ? `📷 Photos · ${count}` : "📷 Photos");
    setAttribute(
      treasuresBtn, "aria-label", `Open Postcard Album, ${count} of ${POSTCARD_ALBUM_LIMIT} saved`,
    );
    setAttribute(card, "data-album-count", String(count));
    setText(countPill, `${count}/${POSTCARD_ALBUM_LIMIT}`);
    countPill.classList.toggle("is-full", count >= POSTCARD_ALBUM_LIMIT);
    if (!openState) { if (!overlay.hidden) { overlay.hidden = true; clearStatus(); } return; }
    overlay.hidden = false;
    const activeIdx = selectedId === null ? -1 : entries.findIndex((e) => e.id === selectedId);
    if (selectedId !== null && activeIdx === -1) selectedId = null;
    const inLightbox = selectedId !== null && activeIdx !== -1;
    setAttribute(card, "data-album-mode", inLightbox ? "lightbox" : "grid");
    emptyBox.hidden = inLightbox || count > 0;
    grid.hidden = inLightbox || count === 0;
    lightbox.hidden = !inLightbox;
    if (inLightbox) {
      const current = entries[activeIdx];
      if (current !== undefined) {
        if (lbImg.src !== current.dataUrl) lbImg.src = current.dataUrl;
        lbImg.alt = current.caption; setText(lbCaption, current.caption);
        lbSub.hidden = current.subcaption.length === 0; setText(lbSub, current.subcaption);
        setText(lbPos, `${activeIdx + 1} / ${count}`);
        lbPrev.disabled = count < 2; lbNext.disabled = count < 2;
      }
      return;
    }
    const sig = entries.map((item) => `${item.id}:${item.caption}:${item.subcaption}`).join("|");
    if (!forceGrid && sig === lastGridSig) return;
    lastGridSig = sig;
    tileButtons = entries.map((item, idx) => {
      const btn = makeButton("journal-postcard-tile", `View postcard: ${item.caption}`);
      setAttribute(btn, "data-postcard-id", item.id);
      setAttribute(btn, "data-postcard-tilt", idx % 2 === 0 ? "left" : "right");
      const img = document.createElement("img");
      img.className = "journal-postcard-thumb"; img.src = item.dataUrl;
      img.alt = item.caption; img.draggable = false;
      element("span", "journal-postcard-thumb-wrap", btn).append(img);
      const copy = element("span", "journal-postcard-tile-copy", btn);
      element("span", "journal-postcard-tile-caption", copy).textContent =
        shortTileCaption(item.caption);
      if (item.subcaption.length > 0) {
        element("span", "journal-postcard-tile-sub", copy).textContent = item.subcaption;
      }
      btn.addEventListener("click", () => {
        selectedId = item.id; clearStatus(); renderState();
        options?.onAction?.(); lbBack.focus({ preventScroll: true });
      });
      return btn;
    });
    grid.replaceChildren(...tileButtons);
  };

  const sync = (): void => { entries = getPostcardAlbum(); renderState(); };
  const backToGrid = (restoreId?: string | null): void => {
    const focusId = restoreId ?? selectedId;
    selectedId = null; clearStatus(); renderState(); options?.onAction?.();
    (tileButtons.find((btn) => btn.dataset.postcardId === focusId) ?? card).focus({
      preventScroll: true,
    });
  };
  const stepLightbox = (delta: -1 | 1): void => {
    if (selectedId === null || entries.length < 2) return;
    const idx = entries.findIndex((item) => item.id === selectedId);
    const next = idx === -1 ? undefined : entries[(idx + delta + entries.length) % entries.length];
    if (next === undefined) return;
    selectedId = next.id; clearStatus(); renderState(); options?.onStep?.();
  };
  const clear = (): void => {
    returnFocusEl = null; selectedId = null; clearStatus();
    if (!openState && overlay.hidden) return;
    openState = false; overlay.hidden = true;
  };
  const closeModal = (): void => {
    if (!openState && overlay.hidden) return;
    const target = returnFocusEl;
    clear(); options?.onClose?.(); options?.onVisibilityChange?.(false);
    if (isFocusable(target)) target.focus({ preventScroll: true });
  };
  const close = (): void => {
    if (!openState) return;
    if (selectedId !== null) backToGrid();
    else closeModal();
  };

  lbBack.addEventListener("click", () => backToGrid());
  lbPrev.addEventListener("click", () => stepLightbox(-1));
  lbNext.addEventListener("click", () => stepLightbox(1));
  lbSave.addEventListener("click", () => {
    const current = entries.find((item) => item.id === selectedId);
    if (current === undefined) return;
    options?.onAction?.();
    void deliverPostcard(
      {
        dataUrl: imageToPngDataUrl(lbImg, current.dataUrl),
        filename: current.filename,
        caption: current.caption,
      },
      { preferShare: document.documentElement.dataset.touch === "on" },
    ).then((delivery) => {
      if (delivery === "shared") showStatus("Postcard shared!");
      else if (delivery === "downloaded") showStatus("PNG saved!");
    });
  });
  lbRemove.addEventListener("click", () => {
    if (selectedId === null) return;
    const removedId = selectedId; selectedId = null; clearStatus();
    entries = removePostcardFromAlbum(removedId); lastGridSig = ""; renderState(true);
    options?.onAction?.(); (tileButtons[0] ?? card).focus({ preventScroll: true });
  });
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeModal(); });
  subscribePostcardAlbum((next) => { entries = next; lastGridSig = ""; renderState(true); });
  sync();

  const open = (returnTarget?: HTMLElement | null): void => {
    const wasOpen = openState;
    options?.onBeforeOpen?.();
    if (!openState) {
      returnFocusEl = returnTarget ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    openState = true; selectedId = null; clearStatus();
    entries = getPostcardAlbum(); lastGridSig = ""; renderState(true);
    card.focus({ preventScroll: true });
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
    if (selectedId !== null) {
      if (key === "ArrowLeft") { stop(); stepLightbox(-1); }
      else if (key === "ArrowRight") { stop(); stepLightbox(1); }
      return true;
    }
    if (key === "PageDown" || key === "PageUp") {
      stop(); applyModalScrollKey([grid, card], key); return true;
    }
    const len = tileButtons.length;
    if (len === 0) return true;
    const idx = tileButtons.findIndex((btn) => btn === document.activeElement);
    const cols = window.innerWidth <= 900 || window.innerHeight <= 500 ? 2 : 3;
    const next =
      key === "Home" ? 0 : key === "End" ? len - 1
      : key === "ArrowRight" ? (idx === -1 ? 0 : (idx + 1) % len)
      : key === "ArrowLeft" ? (idx === -1 ? len - 1 : (idx - 1 + len) % len)
      : key === "ArrowDown" ? (idx === -1 ? 0 : (idx + cols) % len)
      : key === "ArrowUp" ? (idx === -1 ? len - 1 : (idx - cols + len) % len) : null;
    if (next !== null) {
      stop(); const target = tileButtons[next];
      target?.focus({ preventScroll: true }); target?.scrollIntoView?.({ block: "nearest" });
    }
    return true;
  };
  return {
    overlay, treasuresBtn, open, sync, close, clear, isOpen: () => openState, handleKeydown,
  };
}
