import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import { keepsakeIcon } from "./icons";
import type { JournalFieldNoteFish, JournalFieldNoteSticker } from "./journal-field-note";
import { formatArcadeRecordPills, type MinigameRecords } from "../platform/minigame-records";
import type { JournalKeepsake, KeepsakeId } from "../core/journal";

export type JournalShelvesView = {
  tickets: number; stickers: JournalFieldNoteSticker[]; prizes: JournalFieldNoteSticker[];
  arcadeRecords?: MinigameRecords; fish?: JournalFieldNoteFish[]; keepsakes?: JournalKeepsake[];
};
export type JournalShelvesCallbacks = {
  ticketsPill: { root: HTMLElement; count: HTMLSpanElement };
  onInspectSticker: (id: string) => void; onInspectPrize: (prize: JournalFieldNoteSticker) => void;
  onInspectFish: (id: string) => void; onInspectKeepsake: (id: string) => void;
};
export type JournalShelvesResult = {
  lastAnchor: HTMLElement;
  fishOwned: number; fishTotal: number; keepsakesOwned: number; keepsakesTotal: number;
};
export type JournalShelvesControl = {
  root: HTMLElement; render: (view: JournalShelvesView) => JournalShelvesResult;
};

type SlotShell = {
  root: HTMLDivElement; media: HTMLDivElement; unknown: HTMLDivElement; name: HTMLDivElement;
};
type Slot = SlotShell & { imageKey: string };
type KeepsakeSlot = SlotShell & { iconId: KeepsakeId | null };
type CountedSection = {
  heading: HTMLHeadingElement; count: HTMLSpanElement;
  complete: HTMLSpanElement; grid: HTMLDivElement;
};
type ImageShelfItem = { id: string; name: string; owned: boolean; image: AtlasImage | null };

function createSlotShell(
  grid: HTMLElement, rootClass: string, mediaClass: string, unknownLabel: string,
  onInspect: () => void,
): SlotShell {
  const root = element("div", rootClass);
  const media = element("div", mediaClass);
  media.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", unknownLabel);
  const name = element("div", "journal-name");
  root.append(media, unknown, name);
  root.addEventListener("click", () => onInspect());
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onInspect(); }
  });
  grid.append(root);
  return { root, media, unknown, name };
}

function syncSlotPool<T extends { root: HTMLElement }>(
  pool: T[], count: number, create: (index: number) => T,
): void {
  while (pool.length < count) pool.push(create(pool.length));
  while (pool.length > count) pool.pop()?.root.remove();
}

function syncInspectableSlot(root: HTMLElement, inspectable: boolean, ariaLabel: string): void {
  root.classList.toggle("is-inspectable", inspectable);
  if (inspectable) {
    setAttribute(root, "tabindex", "0");
    setAttribute(root, "role", "button");
    setAttribute(root, "aria-label", ariaLabel);
    return;
  }
  for (const attr of ["tabindex", "role", "aria-label"]) {
    if (root.hasAttribute(attr)) root.removeAttribute(attr);
  }
}

function makeCompleteRibbon(): HTMLSpanElement {
  return Object.assign(element("span", "journal-complete-ribbon"), { textContent: "★ Complete!" });
}

function makeCountedSection(
  headingClass: string, gridClass: string, title: string,
): CountedSection {
  const heading = element("h3", headingClass);
  const count = element("span", "journal-section-count");
  heading.append(title, count);
  return { heading, count, complete: makeCompleteRibbon(), grid: element("div", gridClass) };
}

function syncSlotBase(slot: SlotShell, owned: boolean, name: string): void {
  slot.media.hidden = !owned;
  slot.unknown.hidden = owned;
  slot.name.hidden = !owned;
  setText(slot.name, owned ? name : "");
  setAttribute(slot.root, "data-owned", String(owned));
}

function syncSlotVisual(slot: Slot, owned: boolean, name: string, image: AtlasImage | null): void {
  syncSlotBase(slot, owned, name);
  if (image === null) { slot.imageKey = ""; return; }
  setAttribute(slot.media, "aria-label", name);
  const key = `${image.src}#${image.frame.x},${image.frame.y},${image.frame.w},${image.frame.h}`;
  if (slot.imageKey !== key) { applyAtlasCrop(slot.media, image); slot.imageKey = key; }
}

function syncChild(parent: Element, node: Element, show: boolean): void {
  if (show) { if (!node.isConnected) parent.append(node); }
  else if (node.isConnected) node.remove();
}

function syncCountedHeader(
  anchor: HTMLElement, section: CountedSection, owned: number, total: number,
): boolean {
  const show = owned > 0;
  syncAttachedAfter(anchor, section.heading, show);
  syncAttachedAfter(section.heading, section.grid, show);
  if (show) {
    setText(section.count, `${owned}/${total}`);
    syncChild(section.heading, section.complete, total > 0 && owned >= total);
  }
  return show;
}

function syncImageShelf<T extends ImageShelfItem>(
  grid: HTMLElement, pool: Slot[], items: readonly T[],
  config: {
    dataAttr: string; unknownLabel: string; onInspect: (index: number) => void;
    isOwnedVisual: (item: T, image: AtlasImage | null) => boolean;
    isInspectable: (item: T, image: AtlasImage | null) => boolean;
    ariaLabel: (item: T) => string; afterSync?: (slot: Slot, item: T) => void;
  },
): void {
  syncSlotPool(pool, items.length, (index) => ({
    ...createSlotShell(
      grid, "journal-slot", "journal-sticker-image die-cut", config.unknownLabel,
      () => config.onInspect(index),
    ),
    imageKey: "",
  }));
  items.forEach((item, index) => {
    const slot = pool[index];
    if (slot === undefined) return;
    const image = item.owned ? item.image : null;
    setAttribute(slot.root, config.dataAttr, item.id);
    syncSlotVisual(slot, config.isOwnedVisual(item, image), item.name, image);
    syncInspectableSlot(slot.root, config.isInspectable(item, image), config.ariaLabel(item));
    config.afterSync?.(slot, item);
  });
}

function syncKeepsakeSlot(slot: KeepsakeSlot, item: JournalKeepsake): void {
  syncSlotBase(slot, item.owned, item.name);
  setAttribute(slot.root, "data-keepsake", item.id);
  syncInspectableSlot(slot.root, item.owned, `Inspect ${item.name}`);
  if (item.owned) {
    setAttribute(slot.root, "title", item.source);
    setAttribute(slot.media, "aria-label", item.name);
    if (slot.iconId !== item.id) {
      slot.media.replaceChildren(keepsakeIcon(item.id));
      slot.iconId = item.id;
    }
    return;
  }
  if (slot.root.hasAttribute("title")) slot.root.removeAttribute("title");
  if (slot.iconId !== null) { slot.media.replaceChildren(); slot.iconId = null; }
}

/** Builds and syncs Journal collection shelves (Stickers, Prizes, Fish, Keepsakes). */
export function createJournalShelves(callbacks: JournalShelvesCallbacks): JournalShelvesControl {
  const root = element("section", "journal-page journal-stickers-page");
  const stickersHeading = element("h2", "journal-heading");
  stickersHeading.textContent = "STICKERS";
  const stickersComplete = makeCompleteRibbon();
  const grid = element("div", "journal-stickers");
  const prizesHeading = element("h3", "journal-prizes-heading");
  prizesHeading.append("PRIZES", callbacks.ticketsPill.root);
  const prizesComplete = makeCompleteRibbon();
  const prizesGrid = element("div", "journal-stickers journal-prizes");
  const recordsStrip = element("div", "journal-records-strip");
  recordsStrip.setAttribute("role", "region");
  recordsStrip.setAttribute("aria-label", "Arcade and fishing records");
  const fishSection = makeCountedSection(
    "journal-prizes-heading journal-fish-heading", "journal-stickers journal-fish", "FISH",
  );
  const keepsakesSection = makeCountedSection(
    "journal-prizes-heading journal-keepsakes-heading",
    "journal-stickers journal-keepsakes", "KEEPSAKES",
  );
  root.append(stickersHeading, grid, prizesHeading, prizesGrid);

  let latestView: JournalShelvesView | null = null;
  let recordsSignature = "";
  const slots: Slot[] = []; const prizeSlots: Slot[] = [];
  const fishSlots: Slot[] = []; const keepsakeSlots: KeepsakeSlot[] = [];

  return {
    root,
    render: (view) => {
      latestView = view;
      setText(callbacks.ticketsPill.count, String(view.tickets));
      syncImageShelf(grid, slots, view.stickers, {
        dataAttr: "data-sticker", unknownLabel: "A sticker still to find",
        onInspect: (i) => {
          const cur = latestView?.stickers[i];
          if (cur?.owned && cur.fieldNote != null) callbacks.onInspectSticker(cur.id);
        },
        isOwnedVisual: (_item, image) => image !== null,
        isInspectable: (item, image) => image !== null && item.fieldNote != null,
        ariaLabel: (item) => `Inspect ${item.name}`,
      });
      const allStickers = view.stickers.length > 0 && view.stickers.every((s) => s.owned);
      stickersHeading.classList.toggle("is-complete", allStickers);
      syncChild(stickersHeading, stickersComplete, allStickers);
      syncImageShelf(prizesGrid, prizeSlots, view.prizes, {
        dataAttr: "data-prize", unknownLabel: "A prize still to win",
        onInspect: (i) => {
          const cur = latestView?.prizes[i];
          if (cur?.owned && cur.image !== null) callbacks.onInspectPrize(cur);
        },
        isOwnedVisual: (_item, image) => image !== null,
        isInspectable: (_item, image) => image !== null,
        ariaLabel: (item) => `Inspect ${item.name} prize note`,
      });
      syncChild(
        prizesHeading, prizesComplete, view.prizes.length > 0 && view.prizes.every((p) => p.owned),
      );
      const pills = view.arcadeRecords ? formatArcadeRecordPills(view.arcadeRecords) : [];
      const showRecords = pills.length > 0;
      syncAttachedAfter(prizesGrid, recordsStrip, showRecords);
      if (showRecords) {
        const nextSig = pills.map((item) => `${item.id}:${item.value}`).join("|");
        if (nextSig !== recordsSignature) {
          recordsSignature = nextSig;
          recordsStrip.replaceChildren(
            Object.assign(element("span", "journal-records-label"), { textContent: "BESTS" }),
            ...pills.map((item) => {
              const pill = element("span", "journal-record-pill");
              setAttribute(pill, "data-record", item.id);
              pill.textContent = `★ ${item.label} · ${item.value}`;
              return pill;
            }),
          );
        }
      } else if (recordsSignature !== "") { recordsSignature = ""; recordsStrip.replaceChildren(); }
      const fishAnchor = showRecords ? recordsStrip : prizesGrid;
      const fishList = view.fish ?? [];
      const fishOwned = fishList.filter((item) => item.owned).length;
      const showFish = syncCountedHeader(fishAnchor, fishSection, fishOwned, fishList.length);
      if (showFish) {
        syncImageShelf(fishSection.grid, fishSlots, fishList, {
          dataAttr: "data-fish", unknownLabel: "A fish still to catch",
          onInspect: (i) => {
            const cur = latestView?.fish?.[i];
            if (cur?.owned) callbacks.onInspectFish(cur.id);
          },
          isOwnedVisual: (item) => item.owned, isInspectable: (item) => item.owned,
          ariaLabel: (item) => `Inspect ${item.name}`,
          afterSync: (slot, item) => slot.root.classList.toggle("is-rare", item.owned && item.rare),
        });
      }
      const keepsakesList = view.keepsakes ?? [];
      const keepsakesOwned = keepsakesList.filter((item) => item.owned).length;
      const keepsakesAnchor = showFish ? fishSection.grid : fishAnchor;
      const showKeepsakes = syncCountedHeader(
        keepsakesAnchor, keepsakesSection, keepsakesOwned, keepsakesList.length,
      );
      if (showKeepsakes) {
        syncSlotPool(keepsakeSlots, keepsakesList.length, (i) => ({
          ...createSlotShell(
            keepsakesSection.grid, "journal-slot journal-keepsake-slot", "journal-keepsake-charm",
            "A keepsake still to find", () => {
              const cur = latestView?.keepsakes?.[i];
              if (cur?.owned) callbacks.onInspectKeepsake(cur.id);
            },
          ),
          iconId: null,
        }));
        keepsakesList.forEach((item, i) => {
          if (keepsakeSlots[i] !== undefined) syncKeepsakeSlot(keepsakeSlots[i], item);
        });
      }
      return {
        lastAnchor: showKeepsakes ? keepsakesSection.grid : keepsakesAnchor,
        fishOwned, fishTotal: fishList.length, keepsakesOwned, keepsakesTotal: keepsakesList.length,
      };
    },
  };
}
