import "./journal.css";
import { element, setAttribute, setText } from "./dom";
import {
  coinMarkup, cookieMarkup, gemMarkup, heartMarkup, icon, ticketMarkup,
} from "./icons";
import {
  createJournalFieldOverlays, type JournalFieldNoteFish, type JournalFieldNoteSticker,
} from "./journal-field-note";
import { createJournalMapPage, type JournalMapView } from "./journal-map";
import { createJournalNavController, cycleIndex, type JournalNavDirection } from "./journal-nav";
import {
  createJournalOptionsPage, makeJournalButton, makeSliderButton, syncSlider, wireSlider,
  type JournalOptionsHandlers, type JournalOptionsView,
} from "./journal-options";
import { createJournalShelves } from "./journal-shelves";
import type { MinigameRecords } from "../platform/minigame-records";
import type {
  AtlasFilter, CarriedTreat, JournalKeepsake, StarGemEntry,
} from "../core/journal";
import type { CozyWeatherMode } from "../core/weather";
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

const journalPages: readonly JournalPage[] = ["notes", "map", "options"];

/** Steps cleanly across Journal tabs with wrap-around in either direction. */
export function stepJournalPage(current: JournalPage, delta: -1 | 1): JournalPage {
  const index = journalPages.indexOf(current);
  return journalPages[cycleIndex(index === -1 ? 0 : index, journalPages.length, delta)] ?? "notes";
}

const svgNamespace = "http://www.w3.org/2000/svg";

// Fae's supplies, each a pill with its count: a gold coin and a cookie for
// her snacks on the notes page's heading row (`journal-supply`), and her
// tickets on the PRIZES heading (`journal-tickets`, the same pill).
const supplyMarkup = {
  coins: coinMarkup, snacks: cookieMarkup, gems: gemMarkup, tickets: ticketMarkup,
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
  navigateOverlay: (direction: JournalNavDirection) => boolean;
  activateOverlay: () => boolean;
  scrollOverlay: (deltaY: number) => boolean;
  onPageChange: (callback: (page: JournalPage) => void) => void;
  onMapSelect: (callback: (selected: boolean) => void) => void;
  onMapFilter: (callback: (filter: AtlasFilter) => void) => void;
  onOverlayChange: (callback: (open: boolean) => void) => void;
  onOverlayStep: (callback: () => void) => void;
  onWeatherSelect: (callback: (mode: CozyWeatherMode) => void) => void;
  onJukeboxFilter: (callback: () => void) => void;
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

  let latestView: JournalView | null = null;
  let onPageChange: (page: JournalPage) => void = () => undefined;
  let onMapSelect: (selected: boolean) => void = () => undefined;
  let onMapFilter: (filter: AtlasFilter) => void = () => undefined;
  let onOverlayChange: (open: boolean) => void = () => undefined;
  let onOverlayStep: () => void = () => undefined;
  let onWeatherSelect: (mode: CozyWeatherMode) => void = () => undefined;
  let onJukeboxFilter: () => void = () => undefined;
  let onClose: () => void = () => undefined;

  const sliderSteppers = new Map<EventTarget, (direction: -1 | 1) => void>();
  const optionsPage = createJournalOptionsPage({
    sliderSteppers,
    onMirrorAudioLevel: (next) => syncSlider(volume.button, volume.value, next),
  });
  const fieldOverlays = createJournalFieldOverlays({
    focusRoot: book,
    onVisibilityChange: (open) => onOverlayChange(open),
    onStep: () => onOverlayStep(),
    onWeatherSelect: (mode) => onWeatherSelect(mode),
    onSelectTrack: optionsPage.selectTrack, onResetTrack: optionsPage.resetJukebox,
    onJukeboxFilter: () => onJukeboxFilter(),
  });
  const shelves = createJournalShelves({
    ticketsPill: supply("tickets", "Tickets"),
    onInspectSticker: (id) => fieldOverlays.inspect({ kind: "sticker", id }, latestView),
    onInspectPrize: (prize) => fieldOverlays.openPrize(prize, latestView),
    onInspectFish: (id) => fieldOverlays.inspect({ kind: "fish", id }, latestView),
    onInspectKeepsake: (id) => fieldOverlays.inspect({ kind: "keepsake", id }, latestView),
  });
  const mapPage = createJournalMapPage(() => fieldOverlays.openTreasures(latestView), {
    onSelectLand: (landId) => onMapSelect(landId !== null),
    onFilterChange: (filter) => onMapFilter(filter),
  });

  const tabs = element("div", "journal-tabs");
  const notesTab = makeJournalButton(
    "journal-tab journal-notes-tab", "Notes and stickers", "NOTES",
  );
  const mapTab = makeJournalButton("journal-tab journal-map-tab", "Map", "MAP");
  const optionsTab = makeJournalButton("journal-tab journal-options-tab", "Options", "OPTIONS");
  tabs.append(notesTab, mapTab, optionsTab);

  book.append(
    label, close, notesPage, shelves.root, mapPage.root, optionsPage.root, tabs,
    fieldOverlays.fieldBackdrop, fieldOverlays.treasuresBackdrop,
    fieldOverlays.gemsOverlay, fieldOverlays.ribbonsOverlay,
  );
  root.append(book);

  let page: JournalPage = "notes";
  let wasVisible = false;
  let treatsSignature = "";

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
    shelves.root.hidden = page !== "notes";
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
    book, notesPage, stickersPage: shelves.root,
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

  return {
    setPage, stepPage,
    scrollActivePage: nav.scrollActivePage,
    navigateFocus: nav.navigateFocus,
    activateFocused: nav.activateFocused,
    hasOpenOverlay: fieldOverlays.hasOpen,
    dismissOverlay: fieldOverlays.dismiss,
    stepOverlay: fieldOverlays.stepFieldNote,
    navigateOverlay: fieldOverlays.navigateOverlay,
    activateOverlay: fieldOverlays.activateOverlay,
    scrollOverlay: fieldOverlays.scrollOverlay,
    onPageChange: (cb) => { onPageChange = cb; },
    onMapSelect: (cb) => { onMapSelect = cb; },
    onMapFilter: (cb) => { onMapFilter = cb; },
    onOverlayChange: (cb) => { onOverlayChange = cb; },
    onOverlayStep: (cb) => { onOverlayStep = cb; },
    onWeatherSelect: (cb) => { onWeatherSelect = cb; },
    onJukeboxFilter: (cb) => { onJukeboxFilter = cb; },
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

      const shelvesResult = shelves.render(view);
      fieldOverlays.syncAll(view, shelvesResult.lastAnchor);
      mapPage.render(view, {
        fishOwned: shelvesResult.fishOwned,
        fishTotal: shelvesResult.fishTotal,
        keepsakesOwned: shelvesResult.keepsakesOwned,
        keepsakesTotal: shelvesResult.keepsakesTotal,
      });
    },
  };
}
