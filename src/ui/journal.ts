import "./journal.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import {
  coinMarkup, cookieMarkup, gemMarkup, heartMarkup, icon, keepsakeIcon, ticketMarkup,
} from "./icons";
import {
  createJournalFieldOverlays,
  type JournalFieldNoteFish,
  type JournalFieldNoteSticker,
} from "./journal-field-note";
import { createJournalMapPage, type JournalMapView } from "./journal-map";
import { createJournalNavController, cycleIndex, type JournalNavDirection } from "./journal-nav";
import {
  createJournalOptionsPage, makeJournalButton, makeSliderButton, syncSlider, wireSlider,
  type JournalOptionsHandlers, type JournalOptionsView,
} from "./journal-options";
import { formatArcadeRecordPills, type MinigameRecords } from "../platform/minigame-records";
import type {
  AtlasFilter, CarriedTreat, JournalKeepsake, KeepsakeId, StarGemEntry,
} from "../core/journal";
import type { LevelStats } from "../core/levels";

export {
  bindOptionsCallbacks, defaultOptionsCallbacks, formatJukeboxLabel, journalControlsLines,
  textSpeedLabel, type JournalControlsLines, type JournalControlsTools, type JournalControlTools,
  type JournalInputMode, type JournalOptionsCallbacks, type JukeboxMeta,
} from "./journal-options";

export type JournalPage = "notes" | "map" | "options";
export type JournalSticker = JournalFieldNoteSticker;
export type JournalPrize = JournalSticker;
export type JournalFishEntry = JournalFieldNoteFish;

export type JournalView = JournalOptionsView & JournalMapView & {
  visible: boolean;
  /** Newest first; the game decides the order. */
  notes: string[];
  treats?: CarriedTreat[];
  stickers: JournalSticker[];
  prizes: JournalPrize[];
  arcadeRecords?: MinigameRecords;
  fish?: JournalFishEntry[];
  keepsakes?: JournalKeepsake[];
  coins: number;
  tickets: number;
  snacks: number;
  gems?: { found: number; total: number };
  starGems?: StarGemEntry[];
  members: {
    id: string;
    name: string;
    level: number;
    xp: number;
    startXp: number;
    nextXp: number;
    stats: LevelStats;
    friend: boolean;
  }[];
};

type Slot = {
  root: HTMLDivElement;
  image: HTMLDivElement;
  unknown: HTMLDivElement;
  name: HTMLDivElement;
  imageKey: string;
};

type KeepsakeSlot = {
  root: HTMLDivElement;
  charm: HTMLDivElement;
  unknown: HTMLDivElement;
  name: HTMLDivElement;
  iconId: KeepsakeId | null;
};

const journalPages: readonly JournalPage[] = ["notes", "map", "options"];

/** Steps cleanly across Journal tabs with wrap-around in either direction. */
export function stepJournalPage(current: JournalPage, delta: -1 | 1): JournalPage {
  const index = journalPages.indexOf(current);
  return journalPages[cycleIndex(index === -1 ? 0 : index, journalPages.length, delta)] ?? "notes";
}

const svgNamespace = "http://www.w3.org/2000/svg";

function wireInspectable(root: HTMLElement, onInspect?: () => void): void {
  if (onInspect === undefined) return;
  root.addEventListener("click", () => onInspect());
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onInspect();
    }
  });
}

function createSlotShell(
  grid: HTMLElement,
  rootClass: string,
  mediaClass: string,
  unknownLabel: string,
  onInspect?: () => void,
): {
  root: HTMLDivElement;
  media: HTMLDivElement;
  unknown: HTMLDivElement;
  name: HTMLDivElement;
} {
  const root = element("div", rootClass);
  const media = element("div", mediaClass);
  media.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", unknownLabel);
  const name = element("div", "journal-name");
  root.append(media, unknown, name);
  wireInspectable(root, onInspect);
  grid.append(root);
  return { root, media, unknown, name };
}

function addSlot(
  grid: HTMLElement,
  onInspect?: () => void,
  unknownLabel = "A sticker still to find",
): Slot {
  const s = createSlotShell(
    grid, "journal-slot", "journal-sticker-image die-cut", unknownLabel, onInspect,
  );
  return { root: s.root, image: s.media, unknown: s.unknown, name: s.name, imageKey: "" };
}

function addKeepsakeSlot(grid: HTMLElement, onInspect?: () => void): KeepsakeSlot {
  const s = createSlotShell(
    grid, "journal-slot journal-keepsake-slot", "journal-keepsake-charm",
    "A keepsake still to find", onInspect,
  );
  return { root: s.root, charm: s.media, unknown: s.unknown, name: s.name, iconId: null };
}

function syncInspectableSlot(root: HTMLElement, inspectable: boolean, ariaLabel: string): void {
  root.classList.toggle("is-inspectable", inspectable);
  if (inspectable) {
    setAttribute(root, "tabindex", "0");
    setAttribute(root, "role", "button");
    setAttribute(root, "aria-label", ariaLabel);
  } else {
    for (const attr of ["tabindex", "role", "aria-label"]) {
      if (root.hasAttribute(attr)) root.removeAttribute(attr);
    }
  }
}

function makeCompleteRibbon(): HTMLSpanElement {
  const ribbon = element("span", "journal-complete-ribbon");
  ribbon.textContent = "★ Complete!";
  return ribbon;
}

function syncSlotVisual(
  slot: Slot,
  owned: boolean,
  name: string,
  image: AtlasImage | null,
): void {
  slot.image.hidden = !owned;
  slot.unknown.hidden = owned;
  slot.name.hidden = !owned;
  setText(slot.name, owned ? name : "");
  setAttribute(slot.root, "data-owned", String(owned));
  if (image === null) {
    slot.imageKey = "";
    return;
  }
  setAttribute(slot.image, "aria-label", name);
  const key =
    `${image.src}#${image.frame.x},${image.frame.y},${image.frame.w},${image.frame.h}`;
  if (slot.imageKey !== key) {
    applyAtlasCrop(slot.image, image);
    slot.imageKey = key;
  }
}

function syncChild(parent: Element, node: Element, show: boolean): void {
  if (show) {
    if (!node.isConnected) parent.append(node);
  } else if (node.isConnected) {
    node.remove();
  }
}

// Fae's supplies, each a pill with its count: a gold coin and a cookie for
// her snacks on the notes page's heading row (`journal-supply`), and her
// tickets on the PRIZES heading (`journal-tickets`, the same pill).
const supplyMarkup = {
  coins: coinMarkup,
  snacks: cookieMarkup,
  gems: gemMarkup,
  tickets: ticketMarkup,
} as const;

function supply(kind: keyof typeof supplyMarkup, label: string): {
  root: HTMLElement;
  count: HTMLSpanElement;
} {
  const pill = kind === "tickets" ? "journal-tickets" : "journal-supply";
  const root: HTMLElement = kind === "gems"
    ? Object.assign(element("button", `${pill} journal-gems`), { type: "button" })
    : element("span", pill);
  setAttribute(root, "data-supply", kind);
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = supplyMarkup[kind];
  const count = element("span", `${pill}-count`);
  root.append(svg, `${label} `, count);
  return { root, count };
}

export type JournalControl = JournalOptionsHandlers & {
  render: (view: JournalView) => void;
  setPage: (page: JournalPage) => void;
  stepPage: (delta: -1 | 1) => void;
  scrollActivePage: (deltaY: number) => boolean;
  navigateFocus: (direction: JournalNavDirection) => boolean;
  activateFocused: () => boolean;
  hasOpenOverlay: () => boolean;
  dismissOverlay: () => boolean;
  stepOverlay: (delta: -1 | 1) => boolean;
  onPageChange: (callback: (page: JournalPage) => void) => void;
  onMapSelect: (callback: (selected: boolean) => void) => void;
  onMapFilter: (callback: (filter: AtlasFilter) => void) => void;
  onOverlayChange: (callback: (open: boolean) => void) => void;
  onOverlayStep: (callback: () => void) => void;
  onClose: (callback: () => void) => void;
};

export function createJournal(root: HTMLElement): JournalControl {
  const book = element("section", "journal-book");
  book.setAttribute("aria-label", "Journal");
  book.hidden = true;
  const label = element("div", "journal-label");
  label.textContent = "JOURNAL";
  const close = makeJournalButton("journal-close", "Close journal", "×");

  const notesPage = element("section", "journal-page journal-notes-page");
  notesPage.setAttribute("tabindex", "0");
  notesPage.setAttribute("aria-label", "Journal notes");
  const notesHead = element("div", "journal-notes-head");
  const notesHeading = element("h2", "journal-heading");
  notesHeading.textContent = "NOTES";
  const supplies = element("div", "journal-supplies");
  const coins = supply("coins", "Coins");
  const snacks = supply("snacks", "Snacks");
  const gems = supply("gems", "Gems");
  supplies.append(coins.root, snacks.root);
  const audio = makeJournalButton("journal-audio", "Toggle sound");
  supplies.append(audio);
  const volumeLabel = element("label", "journal-volume");
  volumeLabel.setAttribute("aria-label", "Sound volume");
  const volume = makeSliderButton("journal-volume-slider", "Sound volume");
  volumeLabel.append(volume.button);
  supplies.append(volumeLabel);
  notesHead.append(notesHeading, supplies);
  const treatsStrip = element("div", "journal-treats-strip");
  treatsStrip.setAttribute("aria-label", "Specialty treats");
  treatsStrip.hidden = true;
  const notes = element("ul", "journal-notes");
  const empty = element("p", "journal-empty");
  empty.textContent = "Nothing yet. Look around!";
  const members = element("div", "journal-members");
  notesPage.append(notesHead, treatsStrip, members, notes, empty);

  const stickersPage = element("section", "journal-page journal-stickers-page");
  const stickersHeading = element("h2", "journal-heading");
  stickersHeading.textContent = "STICKERS";
  const stickersComplete = makeCompleteRibbon();
  const grid = element("div", "journal-stickers");
  const prizesHeading = element("h3", "journal-prizes-heading");
  prizesHeading.append("PRIZES");
  const tickets = supply("tickets", "Tickets");
  prizesHeading.append(tickets.root);
  const prizesComplete = makeCompleteRibbon();
  const prizesGrid = element("div", "journal-stickers journal-prizes");
  const recordsStrip = element("div", "journal-records-strip");
  recordsStrip.setAttribute("role", "region");
  recordsStrip.setAttribute("aria-label", "Arcade and fishing records");
  const fishHeading = element("h3", "journal-prizes-heading journal-fish-heading");
  const fishCount = element("span", "journal-section-count");
  fishHeading.append("FISH", fishCount);
  const fishComplete = makeCompleteRibbon();
  const fishGrid = element("div", "journal-stickers journal-fish");
  const keepsakesHeading = element("h3", "journal-prizes-heading journal-keepsakes-heading");
  const keepsakesCount = element("span", "journal-section-count");
  keepsakesHeading.append("KEEPSAKES", keepsakesCount);
  const keepsakesComplete = makeCompleteRibbon();
  const keepsakesGrid = element("div", "journal-stickers journal-keepsakes");
  stickersPage.append(stickersHeading, grid, prizesHeading, prizesGrid);

  let latestView: JournalView | null = null;
  let onPageChange: (page: JournalPage) => void = () => undefined;
  let onMapSelect: (selected: boolean) => void = () => undefined;
  let onMapFilter: (filter: AtlasFilter) => void = () => undefined;
  let onOverlayChange: (open: boolean) => void = () => undefined;
  let onOverlayStep: () => void = () => undefined;
  let onClose: () => void = () => undefined;

  const fieldOverlays = createJournalFieldOverlays({
    focusRoot: book,
    onVisibilityChange: (open) => onOverlayChange(open),
    onStep: () => onOverlayStep(),
  });
  const mapPage = createJournalMapPage(() => fieldOverlays.openTreasures(latestView), {
    onSelectLand: (landId) => onMapSelect(landId !== null),
    onFilterChange: (filter) => onMapFilter(filter),
  });
  const sliderSteppers = new Map<EventTarget, (direction: -1 | 1) => void>();
  const optionsPage = createJournalOptionsPage({
    sliderSteppers,
    onMirrorAudioLevel: (next) => syncSlider(volume.button, volume.value, next),
  });

  const tabs = element("div", "journal-tabs");
  const notesTab = makeJournalButton(
    "journal-tab journal-notes-tab", "Notes and stickers", "NOTES",
  );
  const mapTab = makeJournalButton("journal-tab journal-map-tab", "Map", "MAP");
  const optionsTab = makeJournalButton("journal-tab journal-options-tab", "Options", "OPTIONS");
  tabs.append(notesTab, mapTab, optionsTab);

  book.append(
    label, close, notesPage, stickersPage, mapPage.root, optionsPage.root, tabs,
    fieldOverlays.fieldBackdrop, fieldOverlays.treasuresBackdrop,
    fieldOverlays.gemsOverlay, fieldOverlays.ribbonsOverlay,
  );
  root.append(book);

  let page: JournalPage = "notes";
  let wasVisible = false;
  let treatsSignature = "";
  let recordsSignature = "";

  const applyPage = (next: JournalPage, notify: boolean): void => {
    fieldOverlays.closeAll();
    const changed = page !== next;
    if (!changed && book.getAttribute("data-journal-page") === next) return;
    page = next;
    setAttribute(book, "data-journal-page", page);
    setAttribute(notesTab, "aria-selected", String(page === "notes"));
    setAttribute(mapTab, "aria-selected", String(page === "map"));
    setAttribute(optionsTab, "aria-selected", String(page === "options"));
    notesPage.hidden = page !== "notes";
    stickersPage.hidden = page !== "notes";
    mapPage.root.hidden = page !== "map";
    optionsPage.root.hidden = page !== "options";
    if (notify && changed) onPageChange(page);
  };

  const setPage = (next: JournalPage): void => applyPage(next, true);
  const stepPage = (delta: -1 | 1): void => setPage(stepJournalPage(page, delta));

  notesTab.addEventListener("click", () => setPage("notes"));
  mapTab.addEventListener("click", () => setPage("map"));
  optionsTab.addEventListener("click", () => setPage("options"));

  const nav = createJournalNavController({
    book, notesPage, stickersPage,
    optionsPage: optionsPage.root,
    soundPage: optionsPage.soundPage,
    playPage: optionsPage.playPage,
    jukebox: optionsPage.jukebox,
    mapRoot: mapPage.root, sliderSteppers, getPage: () => page, setPage,
    hasOpenOverlay: () => fieldOverlays.hasOpen(),
    handleOverlayKeydown: (event) => fieldOverlays.handleKeydown(event),
    stepMapLandFocus: (delta) => mapPage.stepLandFocus(delta),
    stepTrack: (delta) => optionsPage.stepTrack(delta),
  });
  document.addEventListener("keydown", nav.handleKeydown);
  applyPage("notes", false);

  close.addEventListener("click", () => onClose());
  gems.root.addEventListener("click", () => fieldOverlays.openGems(latestView, gems.root));
  audio.addEventListener("click", () => optionsPage.toggleAudio());
  sliderSteppers.set(
    volume.button,
    wireSlider(volume.button, volume.value, () => optionsPage.setAudioLevel),
  );

  const slots: Slot[] = [];
  const prizeSlots: Slot[] = [];
  const fishSlots: Slot[] = [];
  const keepsakeSlots: KeepsakeSlot[] = [];
  return {
    setPage,
    stepPage,
    scrollActivePage: nav.scrollActivePage,
    navigateFocus: nav.navigateFocus,
    activateFocused: nav.activateFocused,
    hasOpenOverlay: () => fieldOverlays.hasOpen(),
    dismissOverlay: () => fieldOverlays.dismiss(),
    stepOverlay: (delta) => fieldOverlays.stepFieldNote(delta),
    onPageChange: (cb) => { onPageChange = cb; },
    onMapSelect: (cb) => { onMapSelect = cb; },
    onMapFilter: (cb) => { onMapFilter = cb; },
    onOverlayChange: (cb) => { onOverlayChange = cb; },
    onOverlayStep: (cb) => { onOverlayStep = cb; },
    onClose: (cb) => { onClose = cb; },
    ...optionsPage.handlers,
    render: (view) => {
      latestView = view;
      book.hidden = !view.visible;
      if (!view.visible && wasVisible) {
        fieldOverlays.closeAll();
        applyPage("notes", false);
        mapPage.resetSelection();
      }
      wasVisible = view.visible;
      if (!view.visible) return;
      setText(coins.count, String(view.coins));
      setText(tickets.count, String(view.tickets));
      setText(snacks.count, String(view.snacks));
      const showGems = view.gems !== undefined && view.gems.found > 0;
      if (showGems && view.gems !== undefined) {
        if (!gems.root.isConnected) snacks.root.after(gems.root);
        setText(gems.count, `${view.gems.found}/${view.gems.total}`);
        setAttribute(
          gems.root, "aria-label",
          `Inspect Star Gem Ledger, ${view.gems.found} of ${view.gems.total} found`,
        );
      } else if (gems.root.isConnected) {
        gems.root.remove();
      }
      notesHead.classList.toggle("has-gems", showGems);
      setText(audio, view.muted ? "♪ off" : "♪ on");
      audio.classList.toggle("is-muted", view.muted);
      syncSlider(volume.button, volume.value, view.level);
      optionsPage.render(view);

      const treats = view.treats ?? [];
      const nextTreatsSignature = treats.map((item) => `${item.id}:${item.count}`).join("|");
      if (nextTreatsSignature !== treatsSignature) {
        treatsSignature = nextTreatsSignature;
        treatsStrip.hidden = treats.length === 0;
        if (treats.length === 0) {
          treatsStrip.replaceChildren();
        } else {
          const stripLabel = element("span", "journal-treats-label");
          stripLabel.textContent = "TREATS";
          treatsStrip.replaceChildren(
            stripLabel,
            ...treats.map((item) => {
              const pill = element("span", "journal-treat-pill");
              setAttribute(pill, "data-treat", item.id);
              pill.append(icon(heartMarkup, "journal-treat-heart"), `${item.name} ×${item.count}`);
              return pill;
            }),
          );
        }
      }

      while (notes.children.length < view.notes.length) notes.append(element("li", "journal-note"));
      while (notes.children.length > view.notes.length) notes.lastElementChild?.remove();
      view.notes.forEach((note, index) => {
        const item = notes.children.item(index);
        if (item !== null) setText(item, note);
      });
      empty.hidden = view.notes.length > 0;
      while (members.children.length < view.members.length) {
        const card = element("article", "journal-member");
        card.append(
          element("h3", "journal-member-name"),
          element("div", "journal-member-level"),
          element("div", "journal-xp"),
          element("div", "journal-member-stats"),
        );
        members.append(card);
      }
      while (members.children.length > view.members.length) members.lastElementChild?.remove();
      view.members.forEach((member, index) => {
        const card = members.children.item(index);
        if (!(card instanceof HTMLElement)) return;
        const name = card.children.item(0);
        const level = card.children.item(1);
        const xp = card.children.item(2);
        const stats = card.children.item(3);
        if (
          !(name instanceof HTMLElement) ||
          !(level instanceof HTMLElement) ||
          !(xp instanceof HTMLElement) ||
          !(stats instanceof HTMLElement)
        )
          return;
        setText(name, member.name);
        setText(level, `Lv ${member.level}`);
        const span = Math.max(1, member.nextXp - member.startXp);
        const ratio = (member.xp - member.startXp) / span;
        const progress = member.nextXp <= member.xp ? 1 : Math.max(0, Math.min(1, ratio));
        const xpMarkup =
          `<div class="journal-xp-fill" style="width:${progress * 100}%"></div>` +
          `<span>${member.xp} XP</span>`;
        if (xp.innerHTML !== xpMarkup) xp.innerHTML = xpMarkup;
        setText(
          stats,
          member.friend
            ? `Power ${member.stats.power} · Magic ${member.stats.magic}`
            : `Power ${member.stats.power} · Magic ${member.stats.magic} · ` +
                `Life ${member.stats.life} · Guard ${member.stats.guard}`,
        );
      });
      while (slots.length < view.stickers.length) {
        const slotIndex = slots.length;
        slots.push(addSlot(grid, () => {
          const current = latestView?.stickers[slotIndex];
          if (current === undefined || !current.owned || current.fieldNote == null) return;
          fieldOverlays.inspect({ kind: "sticker", id: current.id }, latestView);
        }));
      }
      while (slots.length > view.stickers.length) slots.pop()?.root.remove();
      view.stickers.forEach((sticker, index) => {
        const slot = slots[index];
        if (slot === undefined) return;
        const image = sticker.owned ? sticker.image : null;
        const inspectable = image !== null && sticker.fieldNote != null;
        setAttribute(slot.root, "data-sticker", sticker.id);
        syncSlotVisual(slot, image !== null, sticker.name, image);
        syncInspectableSlot(slot.root, inspectable, `Inspect ${sticker.name}`);
      });
      const allStickersOwned =
        view.stickers.length > 0 && view.stickers.every((sticker) => sticker.owned);
      stickersHeading.classList.toggle("is-complete", allStickersOwned);
      syncChild(stickersHeading, stickersComplete, allStickersOwned);

      while (prizeSlots.length < view.prizes.length) {
        const slotIndex = prizeSlots.length;
        prizeSlots.push(addSlot(prizesGrid, () => {
          const current = latestView?.prizes[slotIndex];
          if (current === undefined || !current.owned || current.image === null) return;
          fieldOverlays.openPrize(current, latestView);
        }, "A prize still to win"));
      }
      while (prizeSlots.length > view.prizes.length) prizeSlots.pop()?.root.remove();
      view.prizes.forEach((prize, index) => {
        const slot = prizeSlots[index];
        if (slot === undefined) return;
        const image = prize.owned ? prize.image : null;
        setAttribute(slot.root, "data-prize", prize.id);
        syncSlotVisual(slot, image !== null, prize.name, image);
        syncInspectableSlot(slot.root, image !== null, `Inspect ${prize.name} prize note`);
      });
      const allPrizesOwned =
        view.prizes.length > 0 && view.prizes.every((prize) => prize.owned);
      syncChild(prizesHeading, prizesComplete, allPrizesOwned);

      const arcadePills =
        view.arcadeRecords === undefined ? [] : formatArcadeRecordPills(view.arcadeRecords);
      const showRecords = arcadePills.length > 0;
      syncAttachedAfter(prizesGrid, recordsStrip, showRecords);
      if (showRecords) {
        const nextRecordsSignature = arcadePills
          .map((item) => `${item.id}:${item.value}`)
          .join("|");
        if (nextRecordsSignature !== recordsSignature) {
          recordsSignature = nextRecordsSignature;
          const stripLabel = element("span", "journal-records-label");
          stripLabel.textContent = "BESTS";
          recordsStrip.replaceChildren(
            stripLabel,
            ...arcadePills.map((item) => {
              const pill = element("span", "journal-record-pill");
              setAttribute(pill, "data-record", item.id);
              pill.textContent = `★ ${item.label} · ${item.value}`;
              return pill;
            }),
          );
        }
      } else if (recordsSignature !== "") {
        recordsSignature = "";
        recordsStrip.replaceChildren();
      }

      const fishAnchor = showRecords ? recordsStrip : prizesGrid;
      const fishList = view.fish ?? [];
      const fishOwned = fishList.filter((item) => item.owned).length;
      const showFish = fishOwned > 0;
      syncAttachedAfter(fishAnchor, fishHeading, showFish);
      syncAttachedAfter(fishHeading, fishGrid, showFish);
      if (showFish) {
        setText(fishCount, `${fishOwned}/${fishList.length}`);
        syncChild(fishHeading, fishComplete, fishList.length > 0 && fishOwned >= fishList.length);
        while (fishSlots.length < fishList.length) {
          const slotIndex = fishSlots.length;
          fishSlots.push(addSlot(fishGrid, () => {
            const current = latestView?.fish?.[slotIndex];
            if (current === undefined || !current.owned) return;
            fieldOverlays.inspect({ kind: "fish", id: current.id }, latestView);
          }, "A fish still to catch"));
        }
        while (fishSlots.length > fishList.length) fishSlots.pop()?.root.remove();
        fishList.forEach((item, index) => {
          const slot = fishSlots[index];
          if (slot === undefined) return;
          const image = item.owned ? item.image : null;
          setAttribute(slot.root, "data-fish", item.id);
          slot.root.classList.toggle("is-rare", item.owned && item.rare);
          syncInspectableSlot(slot.root, item.owned, `Inspect ${item.name}`);
          syncSlotVisual(slot, item.owned, item.name, image);
        });
      }

      const keepsakesList = view.keepsakes ?? [];
      const keepsakesOwned = keepsakesList.filter((item) => item.owned).length;
      const showKeepsakes = keepsakesOwned > 0;
      const keepsakesAnchor = showFish ? fishGrid : fishAnchor;
      syncAttachedAfter(keepsakesAnchor, keepsakesHeading, showKeepsakes);
      syncAttachedAfter(keepsakesHeading, keepsakesGrid, showKeepsakes);
      if (showKeepsakes) {
        setText(keepsakesCount, `${keepsakesOwned}/${keepsakesList.length}`);
        syncChild(
          keepsakesHeading,
          keepsakesComplete,
          keepsakesList.length > 0 && keepsakesOwned >= keepsakesList.length,
        );
        while (keepsakeSlots.length < keepsakesList.length) {
          const slotIndex = keepsakeSlots.length;
          keepsakeSlots.push(addKeepsakeSlot(keepsakesGrid, () => {
            const current = latestView?.keepsakes?.[slotIndex];
            if (current === undefined || !current.owned) return;
            fieldOverlays.inspect({ kind: "keepsake", id: current.id }, latestView);
          }));
        }
        while (keepsakeSlots.length > keepsakesList.length) keepsakeSlots.pop()?.root.remove();
        keepsakesList.forEach((item, index) => {
          const slot = keepsakeSlots[index];
          if (slot === undefined) return;
          slot.charm.hidden = !item.owned;
          slot.unknown.hidden = item.owned;
          slot.name.hidden = !item.owned;
          setText(slot.name, item.owned ? item.name : "");
          setAttribute(slot.root, "data-owned", String(item.owned));
          setAttribute(slot.root, "data-keepsake", item.id);
          syncInspectableSlot(slot.root, item.owned, `Inspect ${item.name}`);
          if (item.owned) {
            setAttribute(slot.root, "title", item.source);
            setAttribute(slot.charm, "aria-label", item.name);
            if (slot.iconId !== item.id) {
              slot.charm.replaceChildren(keepsakeIcon(item.id));
              slot.iconId = item.id;
            }
          } else {
            if (slot.root.hasAttribute("title")) slot.root.removeAttribute("title");
            if (slot.iconId !== null) {
              slot.charm.replaceChildren();
              slot.iconId = null;
            }
          }
        });
      }
      fieldOverlays.syncAll(view, showKeepsakes ? keepsakesGrid : keepsakesAnchor);
      mapPage.render(view, {
        fishOwned,
        fishTotal: fishList.length,
        keepsakesOwned,
        keepsakesTotal: keepsakesList.length,
      });
    },
  };
}
