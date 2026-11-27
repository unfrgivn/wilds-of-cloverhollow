import "./journal.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import {
  coinMarkup,
  cookieMarkup,
  gemMarkup,
  heartMarkup,
  icon,
  keepsakeIcon,
  ticketMarkup,
} from "./icons";
import { createJournalFieldOverlays } from "./journal-field-note";
import { createJournalMapPage } from "./journal-map";
import { createJournalNavController, cycleIndex, type JournalNavDirection } from "./journal-nav";
import { AUDIO_LEVELS, type AudioLevel } from "../platform/audio-settings";
import { formatArcadeRecordPills, type MinigameRecords } from "../platform/minigame-records";
import type {
  BusRoute,
  CarriedTreat,
  CritterFieldNote,
  JournalKeepsake,
  KeepsakeId,
  LandProgress,
} from "../core/journal";
import type { LevelStats } from "../core/levels";
import type { TextSpeed } from "../core/sim";
import type { TreasuresSummary } from "../core/treasures";

export type JournalPage = "notes" | "map" | "options";

export type JournalSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
  fieldNote?: CritterFieldNote | null;
};
export type JournalPrize = JournalSticker;
export type JournalFishEntry = {
  id: string;
  name: string;
  image: AtlasImage | null;
  owned: boolean;
  rare: boolean;
  coins: number;
  snacks: number;
  blurb: string;
};

export type JukeboxMeta = {
  active: boolean;
  index: number;
  total: number;
};

export type JournalInputMode = "keyboard" | "gamepad";

export type JournalControlTools = {
  hasLantern: boolean;
  hasFlute: boolean;
  hasLasso: boolean;
};

/** Formats the Journal OPTIONS Controls reference lines for keyboard or gamepad play. */
export function journalControlsLines(
  inputMode: JournalInputMode,
  tools: JournalControlTools,
): { primary: string; tools: string } {
  if (inputMode === "gamepad") {
    const toolParts: string[] = [];
    if (tools.hasLantern) toolParts.push("Lantern: X");
    if (tools.hasFlute) toolParts.push("Flute: RB");
    if (tools.hasLasso) toolParts.push("Lasso: LB");
    toolParts.push("Photo / Guide: View");
    return {
      primary: "Move: Stick / D-Pad · Talk: A · Back: B · Journal: Y",
      tools: toolParts.join(" · "),
    };
  }
  const toolParts: string[] = [];
  if (tools.hasLantern) toolParts.push("Lantern: L");
  if (tools.hasFlute) toolParts.push("Flute: F");
  if (tools.hasLasso) toolParts.push("Lasso: R");
  return {
    primary: "Move: Arrows / WASD · Talk: Z · Journal: J · Mute: M",
    tools: toolParts.join(" · "),
  };
}

/** Formats the accessible label and tooltip for the Music Box now-playing pill. */
export function formatJukeboxLabel(nowPlaying: string, meta?: JukeboxMeta): string {
  if (meta !== undefined && meta.active && meta.total > 0) {
    return (
      `Track ${meta.index + 1} of ${meta.total}: ${nowPlaying} ` +
      "— press Left or Right to browse, Enter to return to area theme"
    );
  }
  return `Now playing: ${nowPlaying} — press Left or Right to browse Music Box`;
}

export type JournalView = {
  visible: boolean;
  /** Newest first; the game decides the order. */
  notes: string[];
  treats?: CarriedTreat[];
  stickers: JournalSticker[];
  prizes: JournalPrize[];
  arcadeRecords?: MinigameRecords;
  fish?: JournalFishEntry[];
  keepsakes?: JournalKeepsake[];
  lands: { id: string; name: string; busStop: boolean; x: number; y: number }[];
  currentLand: string | null;
  landProgress: Record<string, LandProgress>;
  landGuides?: Record<string, string>;
  busRoutes: BusRoute[];
  stickersOwned: number;
  stickersTotal: number;
  prizesOwned: number;
  prizesTotal: number;
  coins: number;
  tickets: number;
  snacks: number;
  gems?: { found: number; total: number };
  valleyComplete?: boolean;
  muted: boolean;
  level: AudioLevel;
  musicMuted: boolean;
  musicLevel: AudioLevel;
  ambienceMuted: boolean;
  nowPlaying: string;
  jukebox?: JukeboxMeta;
  gentleTiming: boolean;
  keyHints: boolean;
  textSpeed: TextSpeed;
  reducedMotion: boolean;
  treasures?: TreasuresSummary;
  hasLantern: boolean;
  hasFlute: boolean;
  hasLasso?: boolean;
  inputMode?: JournalInputMode;
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

function syncSlider(slider: HTMLButtonElement, valueNode: HTMLElement, level: AudioLevel): void {
  const percent = String(Math.round(level * 100));
  setAttribute(slider, "aria-valuenow", percent);
  setAttribute(slider, "aria-valuetext", `${percent}%`);
  setText(valueNode, `${percent}%`);
}

function wireSlider(
  slider: HTMLButtonElement,
  valueNode: HTMLElement,
  onChange: () => (level: AudioLevel) => void,
): (direction: -1 | 1) => void {
  const apply = (next: AudioLevel): void => {
    syncSlider(slider, valueNode, next);
    onChange()(next);
  };
  const stepLevel = (direction: -1 | 1): void => {
    const current = Number(slider.getAttribute("aria-valuenow"));
    const index = AUDIO_LEVELS.findIndex((candidate) => candidate * 100 === current);
    const start = index === -1 ? AUDIO_LEVELS.length - 1 : index;
    const nextIndex = (start + direction + AUDIO_LEVELS.length) % AUDIO_LEVELS.length;
    const next = AUDIO_LEVELS[nextIndex];
    if (next !== undefined) apply(next);
  };
  slider.addEventListener("click", () => stepLevel(1));
  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      stepLevel(-1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      stepLevel(1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      apply(event.key === "Home" ? AUDIO_LEVELS[0] : AUDIO_LEVELS[3]);
    }
  });
  return stepLevel;
}

function makeSliderButton(className: string, ariaLabel: string): {
  button: HTMLButtonElement;
  value: HTMLSpanElement;
} {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("role", "slider");
  button.setAttribute("aria-label", ariaLabel);
  button.setAttribute("aria-valuemin", "25");
  button.setAttribute("aria-valuemax", "100");
  button.setAttribute("aria-valuestep", "25");
  const value = element("span", "journal-volume-value");
  button.append(value);
  return { button, value };
}

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

function addSlot(
  grid: HTMLElement,
  onInspect?: () => void,
  unknownLabel = "A sticker still to find",
): Slot {
  const root = element("div", "journal-slot");
  const image = element("div", "journal-sticker-image die-cut");
  image.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", unknownLabel);
  const name = element("div", "journal-name");
  root.append(image, unknown, name);
  wireInspectable(root, onInspect);
  grid.append(root);
  return { root, image, unknown, name, imageKey: "" };
}

function addKeepsakeSlot(grid: HTMLElement, onInspect?: () => void): KeepsakeSlot {
  const root = element("div", "journal-slot journal-keepsake-slot");
  const charm = element("div", "journal-keepsake-charm");
  charm.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", "A keepsake still to find");
  const name = element("div", "journal-name");
  root.append(charm, unknown, name);
  wireInspectable(root, onInspect);
  grid.append(root);
  return { root, charm, unknown, name, iconId: null };
}

function syncInspectableSlot(root: HTMLElement, inspectable: boolean, name: string): void {
  root.classList.toggle("is-inspectable", inspectable);
  if (inspectable) {
    setAttribute(root, "tabindex", "0");
    setAttribute(root, "role", "button");
    setAttribute(root, "aria-label", `Inspect ${name}`);
  } else {
    if (root.hasAttribute("tabindex")) root.removeAttribute("tabindex");
    if (root.hasAttribute("role")) root.removeAttribute("role");
    if (root.hasAttribute("aria-label")) root.removeAttribute("aria-label");
  }
}

function makeCompleteRibbon(): HTMLSpanElement {
  const ribbon = element("span", "journal-complete-ribbon");
  ribbon.textContent = "★ Complete!";
  return ribbon;
}

function makeButton(className: string, ariaLabel: string, text?: string): HTMLButtonElement {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", ariaLabel);
  if (text !== undefined) button.textContent = text;
  return button;
}

function syncOptionToggle(button: HTMLButtonElement, enabled: boolean): void {
  setText(button, enabled ? "on" : "off");
  button.classList.toggle("is-muted", !enabled);
  setAttribute(button, "aria-pressed", String(enabled));
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
function supply(kind: "coins" | "snacks" | "tickets" | "gems", label: string): {
  root: HTMLSpanElement;
  count: HTMLSpanElement;
} {
  const pill = kind === "tickets" ? "journal-tickets" : "journal-supply";
  const root = element("span", kind === "gems" ? `${pill} journal-gems` : pill);
  setAttribute(root, "data-supply", kind);
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    kind === "coins"
      ? coinMarkup
      : kind === "snacks"
        ? cookieMarkup
        : kind === "gems"
          ? gemMarkup
          : ticketMarkup;
  const count = element("span", `${pill}-count`);
  root.append(svg, `${label} `, count);
  return { root, count };
}

function textSpeedLabel(speed: TextSpeed): string {
  if (speed === "brisk") return "Brisk";
  if (speed === "instant") return "Instant";
  return "Cozy";
}

function makeOptionRow(
  titleText: string,
  subtitleText: string | null,
  controls: HTMLElement[],
): HTMLDivElement {
  const row = element("div", "journal-opt-row");
  const copy = element("div", "journal-opt-copy");
  const title = element("div", "journal-opt-label");
  title.textContent = titleText;
  copy.append(title);
  if (subtitleText !== null) {
    const sub = element("div", "journal-opt-sub");
    sub.textContent = subtitleText;
    copy.append(sub);
  }
  const right = element("div", "journal-opt-controls");
  right.append(...controls);
  row.append(copy, right);
  return row;
}

export function createJournal(root: HTMLElement): {
  render: (view: JournalView) => void;
  setPage: (page: JournalPage) => void;
  stepPage: (delta: -1 | 1) => void;
  scrollActivePage: (deltaY: number) => boolean;
  navigateFocus: (direction: JournalNavDirection) => boolean;
  activateFocused: () => boolean;
  hasOpenOverlay: () => boolean;
  dismissOverlay: () => boolean;
  onClose: (callback: () => void) => void;
  onToggleAudio: (callback: () => void) => void;
  onSetAudioLevel: (callback: (level: AudioLevel) => void) => void;
  onToggleMusic: (callback: () => void) => void;
  onSetMusicLevel: (callback: (level: AudioLevel) => void) => void;
  onToggleAmbience: (callback: () => void) => void;
  onStepTrack: (callback: (delta: -1 | 1) => void) => void;
  onResetJukebox: (callback: () => void) => void;
  onToggleGentleTiming: (callback: () => void) => void;
  onToggleKeyHints: (callback: () => void) => void;
  onCycleTextSpeed: (callback: () => void) => void;
  onToggleReducedMotion: (callback: () => void) => void;
} {
  const book = element("section", "journal-book");
  book.setAttribute("aria-label", "Journal");
  book.hidden = true;
  const label = element("div", "journal-label");
  label.textContent = "JOURNAL";
  const close = makeButton("journal-close", "Close journal", "×");

  const notesPage = element("section", "journal-page journal-notes-page");
  const notesHead = element("div", "journal-notes-head");
  const notesHeading = element("h2", "journal-heading");
  notesHeading.textContent = "NOTES";
  const supplies = element("div", "journal-supplies");
  const coins = supply("coins", "Coins");
  const snacks = supply("snacks", "Snacks");
  const gems = supply("gems", "Gems");
  supplies.append(coins.root, snacks.root);
  const audio = makeButton("journal-audio", "Toggle sound");
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
  const fieldOverlays = createJournalFieldOverlays();
  const mapPage = createJournalMapPage(() => fieldOverlays.openTreasures(latestView));

  // Two-page open-book OPTIONS spread: Sound & Music on the left, Gameplay on the right.
  const optionsPage = element("section", "journal-options-page");
  const soundPage = element("section", "journal-options-sound-page");
  const optionsHead = element("div", "journal-options-head");
  const optionsHeading = element("h2", "journal-heading");
  optionsHeading.textContent = "SOUND & MUSIC";
  const jukebox = element("div", "journal-jukebox");
  jukebox.setAttribute("role", "group");
  jukebox.setAttribute("aria-label", "Music Box");
  jukebox.tabIndex = -1;
  const prevTrack = makeButton("journal-jukebox-btn journal-jukebox-prev", "Previous track", "‹");
  const nowPlaying = element("button", "journal-now-playing");
  nowPlaying.type = "button";
  nowPlaying.setAttribute("aria-live", "polite");
  const nextTrack = makeButton("journal-jukebox-btn journal-jukebox-next", "Next track", "›");
  jukebox.append(prevTrack, nowPlaying, nextTrack);
  optionsHead.append(optionsHeading, jukebox);

  const soundList = element("div", "journal-options-list");
  const optSfx = makeButton("journal-opt-toggle journal-opt-sfx", "Toggle sound effects");
  const optSfxSlider = makeSliderButton(
    "journal-opt-slider journal-opt-sfx-slider",
    "Sound effects volume",
  );
  const sfxRow = makeOptionRow("Sound Effects", null, [optSfx, optSfxSlider.button]);

  const optMusic = makeButton("journal-opt-toggle journal-opt-music", "Toggle music");
  const musicSlider = makeSliderButton("journal-opt-slider journal-music-slider", "Music volume");
  const musicRow = makeOptionRow("Music", null, [optMusic, musicSlider.button]);

  const optAmbience = makeButton("journal-opt-toggle journal-opt-ambience", "Toggle ambience");
  const ambienceRow = makeOptionRow(
    "Ambience",
    "Waves, wind, birds & hearth",
    [optAmbience],
  );
  soundList.append(sfxRow, musicRow, ambienceRow);
  soundPage.append(optionsHead, soundList);

  const playPage = element("section", "journal-options-play-page");
  const playHead = element("div", "journal-options-play-head");
  const playHeading = element("h2", "journal-heading");
  playHeading.textContent = "GAMEPLAY";
  playHead.append(playHeading);

  const playList = element("div", "journal-options-list");
  const optGentle = makeButton("journal-opt-toggle journal-opt-gentle", "Toggle gentle timing");
  const gentleRow = makeOptionRow("Gentle Timing", "Wider windows in calm-downs", [optGentle]);

  const optHints = makeButton("journal-opt-toggle journal-opt-hints", "Toggle key hints");
  const hintsRow = makeOptionRow("Key Hints", "Show keys while exploring", [optHints]);

  const optTextSpeed = makeButton(
    "journal-opt-toggle journal-option-text-speed",
    "Cycle text speed",
  );
  const textSpeedRow = makeOptionRow(
    "Text Speed",
    "How fast story and battle lines appear",
    [optTextSpeed],
  );

  const optReducedMotion = makeButton(
    "journal-opt-toggle journal-option-reduced-motion",
    "Toggle reduced motion",
  );
  const reducedMotionRow = makeOptionRow(
    "Reduced Motion",
    "Calms animations, shakes, and fluttering effects",
    [optReducedMotion],
  );
  playList.append(gentleRow, hintsRow, textSpeedRow, reducedMotionRow);

  const controlsCard = element("div", "journal-controls-card");
  const controlsTitle = element("div", "journal-controls-title");
  controlsTitle.textContent = "CONTROLS";
  const controlsLine = element("div", "journal-controls-line");
  const controlsTools = element("div", "journal-controls-line journal-controls-tools");
  controlsTools.hidden = true;
  controlsCard.append(controlsTitle, controlsLine, controlsTools);
  playPage.append(playHead, playList, controlsCard);

  optionsPage.append(soundPage, playPage);

  const tabs = element("div", "journal-tabs");
  const notesTab = makeButton("journal-tab journal-notes-tab", "Notes and stickers", "NOTES");
  const mapTab = makeButton("journal-tab journal-map-tab", "Map", "MAP");
  const optionsTab = makeButton("journal-tab journal-options-tab", "Options", "OPTIONS");
  tabs.append(notesTab, mapTab, optionsTab);

  book.append(
    label,
    close,
    notesPage,
    stickersPage,
    mapPage.root,
    optionsPage,
    tabs,
    fieldOverlays.fieldBackdrop,
    fieldOverlays.treasuresBackdrop,
  );
  root.append(book);

  let onClose: () => void = () => undefined;
  let onToggleAudio: () => void = () => undefined;
  let onSetAudioLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleMusic: () => void = () => undefined;
  let onSetMusicLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleAmbience: () => void = () => undefined;
  let onStepTrack: (delta: -1 | 1) => void = () => undefined;
  let onResetJukebox: () => void = () => undefined;
  let onToggleGentleTiming: () => void = () => undefined;
  let onToggleKeyHints: () => void = () => undefined;
  let onCycleTextSpeed: () => void = () => undefined;
  let onToggleReducedMotion: () => void = () => undefined;

  let page: JournalPage = "notes";
  let wasVisible = false;
  let treatsSignature = "";
  let recordsSignature = "";

  const setPage = (next: JournalPage): void => {
    fieldOverlays.closeAll();
    if (page === next && book.getAttribute("data-journal-page") === next) return;
    page = next;
    setAttribute(book, "data-journal-page", page);
    notesPage.hidden = page !== "notes";
    stickersPage.hidden = page !== "notes";
    mapPage.root.hidden = page !== "map";
    optionsPage.hidden = page !== "options";
  };

  const stepPage = (delta: -1 | 1): void => {
    setPage(stepJournalPage(page, delta));
  };

  notesTab.addEventListener("click", () => setPage("notes"));
  mapTab.addEventListener("click", () => setPage("map"));
  optionsTab.addEventListener("click", () => setPage("options"));

  const sliderSteppers = new Map<EventTarget, (direction: -1 | 1) => void>();
  const nav = createJournalNavController({
    book,
    notesPage,
    stickersPage,
    optionsPage,
    soundPage,
    playPage,
    jukebox,
    mapRoot: mapPage.root,
    sliderSteppers,
    getPage: () => page,
    setPage,
    hasOpenOverlay: () => fieldOverlays.hasOpen(),
    handleOverlayKeydown: (event) => fieldOverlays.handleKeydown(event),
    stepMapLandFocus: (delta) => mapPage.stepLandFocus(delta),
    stepTrack: (delta) => onStepTrack(delta),
  });
  document.addEventListener("keydown", nav.handleKeydown);
  setPage("notes");

  close.addEventListener("click", () => onClose());
  audio.addEventListener("click", () => onToggleAudio());
  optSfx.addEventListener("click", () => onToggleAudio());
  optMusic.addEventListener("click", () => onToggleMusic());
  optAmbience.addEventListener("click", () => onToggleAmbience());
  prevTrack.addEventListener("click", () => onStepTrack(-1));
  nextTrack.addEventListener("click", () => onStepTrack(1));
  nowPlaying.addEventListener("click", () => {
    if (latestView?.jukebox?.active === true) onResetJukebox();
  });
  nowPlaying.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (latestView?.jukebox?.active === true) onResetJukebox();
    }
  });
  jukebox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      onStepTrack(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      onStepTrack(1);
    }
  });
  optGentle.addEventListener("click", () => onToggleGentleTiming());
  optHints.addEventListener("click", () => onToggleKeyHints());
  optTextSpeed.addEventListener("click", () => onCycleTextSpeed());
  optReducedMotion.addEventListener("click", () => onToggleReducedMotion());

  const bindSlider = (
    pair: { button: HTMLButtonElement; value: HTMLSpanElement },
    onChange: () => (level: AudioLevel) => void,
  ): void => {
    sliderSteppers.set(pair.button, wireSlider(pair.button, pair.value, onChange));
  };
  bindSlider(volume, () => (next) => {
    syncSlider(optSfxSlider.button, optSfxSlider.value, next);
    onSetAudioLevel(next);
  });
  bindSlider(optSfxSlider, () => (next) => {
    syncSlider(volume.button, volume.value, next);
    onSetAudioLevel(next);
  });
  bindSlider(musicSlider, () => onSetMusicLevel);

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
    onClose: (cb) => { onClose = cb; },
    onToggleAudio: (cb) => { onToggleAudio = cb; },
    onSetAudioLevel: (cb) => { onSetAudioLevel = cb; },
    onToggleMusic: (cb) => { onToggleMusic = cb; },
    onSetMusicLevel: (cb) => { onSetMusicLevel = cb; },
    onToggleAmbience: (cb) => { onToggleAmbience = cb; },
    onStepTrack: (cb) => { onStepTrack = cb; },
    onResetJukebox: (cb) => { onResetJukebox = cb; },
    onToggleGentleTiming: (cb) => { onToggleGentleTiming = cb; },
    onToggleKeyHints: (cb) => { onToggleKeyHints = cb; },
    onCycleTextSpeed: (cb) => { onCycleTextSpeed = cb; },
    onToggleReducedMotion: (cb) => { onToggleReducedMotion = cb; },
    render: (view) => {
      latestView = view;
      book.hidden = !view.visible;
      if (!view.visible && wasVisible) {
        fieldOverlays.closeAll();
        setPage("notes");
        mapPage.resetSelection();
      }
      wasVisible = view.visible;
      if (!view.visible) return;
      setText(coins.count, String(view.coins));
      setText(tickets.count, String(view.tickets));
      setText(snacks.count, String(view.snacks));
      const showGems = view.gems !== undefined && view.gems.found > 0;
      if (showGems) {
        if (!gems.root.isConnected) snacks.root.after(gems.root);
        if (view.gems !== undefined)
          setText(gems.count, `${view.gems.found}/${view.gems.total}`);
      } else if (gems.root.isConnected) {
        gems.root.remove();
      }
      notesHead.classList.toggle("has-gems", showGems);
      setText(audio, view.muted ? "♪ off" : "♪ on");
      audio.classList.toggle("is-muted", view.muted);
      syncSlider(volume.button, volume.value, view.level);
      setText(nowPlaying, `♫ ${view.nowPlaying}`);
      const jukeboxBrowsing = view.jukebox?.active === true;
      const jukeboxLabel = formatJukeboxLabel(view.nowPlaying, view.jukebox);
      nowPlaying.classList.toggle("is-browsing", jukeboxBrowsing);
      setAttribute(nowPlaying, "data-browsing", String(jukeboxBrowsing));
      setAttribute(nowPlaying, "aria-label", jukeboxLabel);
      setAttribute(nowPlaying, "title", jukeboxLabel);
      syncOptionToggle(optSfx, !view.muted);
      syncSlider(optSfxSlider.button, optSfxSlider.value, view.level);
      syncOptionToggle(optMusic, !view.musicMuted);
      syncSlider(musicSlider.button, musicSlider.value, view.musicLevel);
      syncOptionToggle(optAmbience, !view.ambienceMuted);

      syncOptionToggle(optGentle, view.gentleTiming);
      syncOptionToggle(optHints, view.keyHints);
      setText(optTextSpeed, textSpeedLabel(view.textSpeed));
      setAttribute(optTextSpeed, "data-speed", view.textSpeed);
      syncOptionToggle(optReducedMotion, view.reducedMotion);

      const controls = journalControlsLines(view.inputMode ?? "keyboard", {
        hasLantern: view.hasLantern,
        hasFlute: view.hasFlute,
        hasLasso: view.hasLasso === true,
      });
      setText(controlsLine, controls.primary);
      controlsTools.hidden = controls.tools.length === 0;
      setText(controlsTools, controls.tools);

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
        const progress =
          member.nextXp <= member.xp
            ? 1
            : Math.max(
                0,
                Math.min(
                  1,
                  (member.xp - member.startXp) / Math.max(1, member.nextXp - member.startXp),
                ),
              );
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
        syncSlotVisual(slot, image !== null, sticker.name, image);
        syncInspectableSlot(slot.root, inspectable, sticker.name);
      });
      const allStickersOwned =
        view.stickers.length > 0 && view.stickers.every((sticker) => sticker.owned);
      stickersHeading.classList.toggle("is-complete", allStickersOwned);
      syncChild(stickersHeading, stickersComplete, allStickersOwned);

      while (prizeSlots.length < view.prizes.length) prizeSlots.push(addSlot(prizesGrid));
      while (prizeSlots.length > view.prizes.length) prizeSlots.pop()?.root.remove();
      view.prizes.forEach((prize, index) => {
        const slot = prizeSlots[index];
        if (slot === undefined) return;
        const image = prize.owned ? prize.image : null;
        syncSlotVisual(slot, image !== null, prize.name, image);
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
          syncInspectableSlot(slot.root, item.owned, item.name);
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
          syncInspectableSlot(slot.root, item.owned, item.name);
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
      fieldOverlays.syncFieldNote(view);
      fieldOverlays.syncTreasures(view);
      mapPage.render(view, {
        fishOwned,
        fishTotal: fishList.length,
        keepsakesOwned,
        keepsakesTotal: keepsakesList.length,
      });
    },
  };
}
