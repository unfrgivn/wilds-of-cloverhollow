import "./journal-ribbons.css";
import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import { applyModalScrollKey } from "./journal-nav";
import type { MeritRibbonEntry, MeritRibbonSummary } from "../core/ribbons";

const svgNamespace = "http://www.w3.org/2000/svg";

type RibbonMotif = "heart" | "star" | "gem" | "wave" | "crown";

export type JournalRibbonsShowcase = {
  overlay: HTMLDivElement;
  banner: HTMLButtonElement;
  treasuresBtn: HTMLButtonElement;
  open: (summary: MeritRibbonSummary, returnTarget?: HTMLElement | null) => void;
  sync: (summary: MeritRibbonSummary) => void;
  syncTriggers: (summary: MeritRibbonSummary, showBanner: boolean, anchor?: Element) => void;
  close: () => void;
  clear: () => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

const ROSETTE_PATH =
  "M 28.2 16 Q 31.5 21.6 25.2 23.2 Q 23.6 29.5 18 26.2 Q 12.4 29.5 10.8 23.2 " +
  "Q 4.5 21.6 7.8 16 Q 4.5 10.4 10.8 8.8 Q 12.4 2.5 18 5.8 " +
  "Q 23.6 2.5 25.2 8.8 Q 31.5 10.4 28.2 16 Z";

const LEFT_TAIL_PATH = "M 11.4 23.4 L 8.4 39.2 L 13.4 35.8 L 17.2 39.2 L 17.8 24.4 Z";
const RIGHT_TAIL_PATH = "M 24.6 23.4 L 27.6 39.2 L 22.6 35.8 L 18.8 39.2 L 18.2 24.4 Z";

function ribbonMotif(ribbon: MeritRibbonEntry): RibbonMotif {
  if (ribbon.id === "encore-star" || ribbon.category === "mastery") return "crown";
  if (ribbon.id === "gem-scholar" || ribbon.id === "puzzle-solver") return "gem";
  if (ribbon.id === "master-angler" || ribbon.id === "starlight-keeper") return "wave";
  if (ribbon.id === "heart-collector" || ribbon.category === "story") return "heart";
  return "star";
}

function motifMarkup(motif: RibbonMotif, fill: string, stroke: string, earned: boolean): string {
  const f = earned ? fill : "none";
  const sw = earned ? "1.15" : "1.35";
  const s = `fill="${f}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  if (motif === "heart") {
    return (
      `<path d="M 18 20.4 C 14.3 17.8 13.2 15.6 13.2 14.3 C 13.2 12.8 14.4 11.9 15.7 11.9 ` +
      `C 16.7 11.9 17.5 12.5 18 13.3 C 18.5 12.5 19.3 11.9 20.3 11.9 ` +
      `C 21.6 11.9 22.8 12.8 22.8 14.3 C 22.8 15.6 21.7 17.8 18 20.4 Z" ${s}/>`
    );
  }
  if (motif === "gem") {
    return `<polygon points="15.3,12 20.7,12 23,14.9 18,20.5 13,14.9" ${s}/>` +
      `<path d="M 13.5 14.9 H 22.5" stroke="${stroke}" stroke-width="0.95" opacity="0.7"/>`;
  }
  if (motif === "wave") {
    return `<path d="M 12.8 15.1 Q 15.4 12.3 18 15.1 T 23.2 15.1 ` +
      `M 13.4 18.6 Q 15.7 16.3 18 18.6 T 22.6 18.6" fill="none" ` +
      `stroke="${earned ? "#47321f" : stroke}" stroke-width="1.55" stroke-linecap="round"/>`;
  }
  if (motif === "crown") {
    return `<path d="M 13.2 19.3 L 12.8 13.9 L 15.8 16.1 L 18 12.3 L 20.2 16.1 ` +
      `L 23.2 13.9 L 22.8 19.3 Z" ${s}/>`;
  }
  return `<path d="M 18 11.2 L 19.4 14.2 L 22.7 14.6 L 20.2 16.8 L 20.9 20.1 ` +
    `L 18 18.3 L 15.1 20.1 L 15.8 16.8 L 13.3 14.6 L 16.6 14.2 Z" ${s}/>`;
}

/** Pure inner SVG markup for a stitched Valley Merit Ribbon rosette (zero `<text>` nodes). */
export function meritRibbonEmblemMarkup(ribbon: MeritRibbonEntry): string {
  const earned = ribbon.earned;
  const tailAttrs = earned
    ? `fill="${ribbon.color}" stroke="#47321f" stroke-width="1.6" stroke-linejoin="round"`
    : 'fill="#e6dac2" stroke="#47321f" stroke-opacity="0.72" stroke-width="1.45" ' +
      'stroke-dasharray="2.3 1.7" stroke-linejoin="round"';
  const foldShadow = earned
    ? '<path d="M 11.4 23.4 L 17.8 24.4 L 17.5 28 L 10.6 27 Z" fill="#47321f" opacity="0.16"/>' +
      '<path d="M 24.6 23.4 L 18.2 24.4 L 18.5 28 L 25.4 27 Z" fill="#47321f" opacity="0.16"/>'
    : "";
  const bodyAttrs = earned
    ? `fill="${ribbon.color}" stroke="#47321f" stroke-width="1.7" stroke-linejoin="round"`
    : 'fill="#ece1ca" stroke="#47321f" stroke-opacity="0.74" stroke-width="1.55" ' +
      'stroke-dasharray="2.4 1.8" stroke-linejoin="round"';
  const stitchAttrs = earned
    ? 'stroke="#fffaf0" stroke-opacity="0.88" stroke-width="1.2" ' +
      'stroke-dasharray="2.1 1.8" stroke-linecap="round"'
    : 'stroke="#5a4028" stroke-opacity="0.58" stroke-width="1.15" stroke-dasharray="2 2"';
  const coreAttrs = earned
    ? 'fill="#fffaf0" stroke="#47321f" stroke-width="1.2"'
    : 'fill="#f7f0e0" stroke="#47321f" stroke-opacity="0.62" stroke-width="1.15"';
  const motifFill = earned ? ribbon.color : "#7a5e42";
  const motifStroke = earned ? "#47321f" : "#5a4028";
  return (
    `<path d="${LEFT_TAIL_PATH}" ${tailAttrs}/><path d="${RIGHT_TAIL_PATH}" ${tailAttrs}/>` +
    foldShadow +
    `<path d="${ROSETTE_PATH}" ${bodyAttrs}/>` +
    `<circle cx="18" cy="16" r="8.8" fill="none" ${stitchAttrs}/>` +
    `<circle cx="18" cy="16" r="6.7" ${coreAttrs}/>` +
    motifMarkup(ribbonMotif(ribbon), motifFill, motifStroke, earned)
  );
}

/**
 * Builds a hand-inked stitched rosette medallion SVG with twin notched ribbon tails,
 * dashed needlework ring, and distinct category motif (zero `<text>` nodes).
 */
export function createMeritRibbonEmblem(ribbon: MeritRibbonEntry): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", `journal-ribbon-svg ${ribbon.earned ? "is-earned" : "is-locked"}`);
  svg.setAttribute("viewBox", "0 0 36 42");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = meritRibbonEmblemMarkup(ribbon);
  return svg;
}

const HEADER_RIBBON: MeritRibbonEntry = {
  id: "valley-legend", title: "", category: "mastery", color: "#eab949",
  description: "", progressText: "★ Earned", earned: true,
};

/** Builds a decorative golden stitched rosette emblem for headers and banners. */
export function createHeaderRibbonEmblem(className: string): SVGSVGElement {
  const svg = createMeritRibbonEmblem(HEADER_RIBBON);
  svg.setAttribute("class", className);
  return svg;
}

function isFocusableTarget(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

function ribbonGridColumns(grid: HTMLElement): number {
  if (typeof window === "undefined") return 4;
  const raw = window.getComputedStyle(grid).gridTemplateColumns.trim();
  if (raw !== "" && raw !== "none" && !raw.includes("(")) {
    return Math.max(1, raw.split(/\s+/).length);
  }
  return window.innerWidth <= 680 ? 2 : 4;
}

function buildRibbonTile(ribbon: MeritRibbonEntry): HTMLDivElement {
  const tile = element("div", `journal-ribbon-tile ${ribbon.earned ? "is-earned" : "is-locked"}`);
  tile.tabIndex = 0;
  setAttribute(tile, "role", "listitem");
  const status = ribbon.earned ? "Earned" : `Locked (${ribbon.progressText})`;
  setAttribute(tile, "aria-label", `${ribbon.title} — ${status}: ${ribbon.description}`);
  setAttribute(tile, "data-ribbon", ribbon.id);
  setAttribute(tile, "data-category", ribbon.category);
  setAttribute(tile, "data-earned", String(ribbon.earned));
  if (ribbon.earned) tile.style.borderLeftColor = ribbon.color;
  const emblemWrap = element("div", "journal-ribbon-emblem-wrap", tile);
  if (ribbon.earned) emblemWrap.style.borderColor = ribbon.color;
  emblemWrap.append(createMeritRibbonEmblem(ribbon));
  const copy = element("div", "journal-ribbon-copy", tile);
  const top = element("div", "journal-ribbon-top", copy);
  element("span", "journal-ribbon-name", top).textContent = ribbon.earned
    ? `${ribbon.title} ★`
    : ribbon.title;
  if (!ribbon.earned) {
    element("span", "journal-ribbon-progress", top).textContent = ribbon.progressText;
  }
  element("p", "journal-ribbon-desc", copy).textContent = ribbon.description;
  return tile;
}

function makeRibbonButton(className: string, ariaLabel: string, text = ""): HTMLButtonElement {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", ariaLabel);
  if (text !== "") button.textContent = text;
  return button;
}

/** Creates the hand-stitched Valley Merit Ribbons showcase modal for Fae's Journal. */
export function createJournalRibbonsShowcase(options?: {
  onBeforeOpen?: () => void;
  onVisibilityChange?: (open: boolean) => void;
  onClose?: () => void;
}): JournalRibbonsShowcase {
  const overlay = element("div", "journal-ribbons-overlay");
  overlay.hidden = true;
  const card = element("article", "journal-ribbons-card", overlay);
  card.tabIndex = -1;
  setAttribute(card, "role", "dialog");
  setAttribute(card, "aria-modal", "true");
  setAttribute(card, "aria-label", "Valley Merit Ribbons");
  const head = element("div", "journal-ribbons-head", card);
  const titleWrap = element("div", "journal-ribbons-title-wrap", head);
  const title = element("h3", "journal-ribbons-title");
  title.textContent = "VALLEY MERIT RIBBONS";
  const count = element("span", "journal-ribbons-count");
  titleWrap.append(createHeaderRibbonEmblem("journal-ribbons-emblem"), title, count);
  const closeBtn = makeRibbonButton("journal-ribbons-close", "Close Valley Merit Ribbons", "×");
  head.append(closeBtn);
  const grid = element("div", "journal-ribbons-grid", card);
  setAttribute(grid, "role", "list");
  const footer = element("p", "journal-ribbons-footer", card);

  const treasuresBtn = makeRibbonButton(
    "journal-ribbons-btn", "Inspect Valley Merit Ribbons", "★ Ribbons · 0/16",
  );
  const banner = makeRibbonButton("journal-ribbons-banner", "Inspect Valley Merit Ribbons");
  banner.hidden = true;
  const bannerMain = element("span", "journal-ribbons-banner-main", banner);
  const bannerLabel = element("span", "journal-ribbons-banner-label");
  bannerMain.append(createHeaderRibbonEmblem("journal-ribbons-banner-emblem"), bannerLabel);
  element("span", "journal-ribbons-banner-cta", banner).textContent = "View ›";

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
    options?.onClose?.();
    options?.onVisibilityChange?.(false);
    if (isFocusableTarget(target)) target.focus({ preventScroll: true });
  };
  const sync = (summary: MeritRibbonSummary): void => {
    if (!openState) { if (!overlay.hidden) clear(); return; }
    overlay.hidden = false;
    const nextSig = summary.ribbons
      .map((item) => `${item.id}:${item.earned}:${item.progressText}`).join("|");
    if (nextSig === signature) return;
    signature = nextSig;
    count.classList.toggle("is-complete", summary.complete);
    setText(count, summary.complete
      ? `★ ${summary.earned}/${summary.total} VALLEY LEGEND!`
      : `${summary.earned}/${summary.total}`);
    tiles = summary.ribbons.map(buildRibbonTile);
    grid.replaceChildren(...tiles);
    footer.classList.toggle("is-complete", summary.complete);
    setText(footer, summary.complete
      ? "★ All 16 Valley Merit Ribbons Stitched — True Cloverhollow Legend!"
      : "Earn Merit Ribbons across Cloverhollow's stories, wilds, and arcades!");
  };
  const syncTriggers = (
    summary: MeritRibbonSummary, showBanner: boolean, anchor?: Element,
  ): void => {
    const aria = `Inspect Valley Merit Ribbons, ${summary.earned} of ${summary.total} earned`;
    treasuresBtn.classList.toggle("is-complete", summary.complete);
    setText(treasuresBtn, `★ Ribbons · ${summary.earned}/${summary.total}`);
    setAttribute(treasuresBtn, "aria-label", aria);
    banner.hidden = !showBanner;
    if (anchor !== undefined) syncAttachedAfter(anchor, banner, showBanner);
    if (showBanner) {
      banner.classList.toggle("is-complete", summary.complete);
      setText(bannerLabel, `★ Valley Merit Ribbons · ${summary.earned}/${summary.total}`);
      setAttribute(banner, "aria-label", aria);
    }
    sync(summary);
  };

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });

  return {
    overlay, banner, treasuresBtn,
    open: (summary, returnTarget) => {
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
    },
    sync, syncTriggers, close, clear,
    isOpen: () => openState,
    handleKeydown: (event) => {
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
      const cols = ribbonGridColumns(grid);
      const idx = tiles.findIndex((tile) => tile === document.activeElement);
      const next =
        key === "Home" ? 0 : key === "End" ? len - 1
        : key === "ArrowRight" ? (idx === -1 ? 0 : (idx + 1) % len)
        : key === "ArrowLeft" ? (idx === -1 ? len - 1 : (idx - 1 + len) % len)
        : key === "ArrowDown" ? (idx === -1 ? 0 : (idx + cols) % len)
        : key === "ArrowUp" ? (idx === -1 ? len - 1 : (idx - cols + len) % len) : null;
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
