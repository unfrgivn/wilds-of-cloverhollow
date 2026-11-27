import "./journal.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import {
  coinMarkup,
  cookieMarkup,
  feelingMarkup,
  gemMarkup,
  heartMarkup,
  icon,
  keepsakeIcon,
  ticketMarkup,
} from "./icons";
import { AUDIO_LEVELS, type AudioLevel } from "../platform/audio-settings";
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
};

export type JournalView = {
  visible: boolean;
  /** Newest first; the game decides the order. */
  notes: string[];
  treats?: CarriedTreat[];
  stickers: JournalSticker[];
  prizes: JournalPrize[];
  fish?: JournalFishEntry[];
  keepsakes?: JournalKeepsake[];
  lands: { id: string; name: string; busStop: boolean; x: number; y: number }[];
  currentLand: string | null;
  landProgress: Record<string, LandProgress>;
  busRoutes: BusRoute[];
  stickersOwned: number;
  stickersTotal: number;
  prizesOwned: number;
  prizesTotal: number;
  coins: number;
  tickets: number;
  snacks: number;
  gems?: { found: number; total: number };
  muted: boolean;
  level: AudioLevel;
  musicMuted: boolean;
  musicLevel: AudioLevel;
  ambienceMuted: boolean;
  nowPlaying: string;
  gentleTiming: boolean;
  keyHints: boolean;
  textSpeed: TextSpeed;
  reducedMotion: boolean;
  treasures?: TreasuresSummary;
  hasLantern: boolean;
  hasFlute: boolean;
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

type MapLand = JournalView["lands"][number];

const journalPages: readonly JournalPage[] = ["notes", "map", "options"];
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
): void {
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
  if (onInspect !== undefined) {
    root.addEventListener("click", () => onInspect());
    root.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onInspect();
      }
    });
  }
  grid.append(root);
  return { root, image, unknown, name, imageKey: "" };
}

function addKeepsakeSlot(grid: HTMLElement): KeepsakeSlot {
  const root = element("div", "journal-slot journal-keepsake-slot");
  const charm = element("div", "journal-keepsake-charm");
  charm.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", "A keepsake still to find");
  const name = element("div", "journal-name");
  root.append(charm, unknown, name);
  grid.append(root);
  return { root, charm, unknown, name, iconId: null };
}

function makeCompleteRibbon(): HTMLSpanElement {
  const ribbon = element("span", "journal-complete-ribbon");
  ribbon.textContent = "★ Complete!";
  return ribbon;
}

function syncAttachedAfter(anchor: Element, node: Element, show: boolean): void {
  if (show) {
    if (!node.isConnected || anchor.nextElementSibling !== node) anchor.after(node);
  } else if (node.isConnected) {
    node.remove();
  }
}

function syncChild(parent: Element, node: Element, show: boolean): void {
  if (show) {
    if (!node.isConnected) parent.append(node);
  } else if (node.isConnected) {
    node.remove();
  }
}

// The bus line's stop sign, as on the sprite: a gold star on a blue roundel
// atop a pole.
function busStopIcon(): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 30");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<rect x="9" y="14" width="2" height="15" rx="1" fill="#8a8f98" stroke="#47321f" ' +
    'stroke-width="0.8"/>' +
    '<circle cx="10" cy="9" r="8" fill="#3f7fc0" stroke="#47321f" stroke-width="1.2"/>' +
    '<path d="M10 3.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6L10 11.8l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" ' +
    'fill="#f2c94c" stroke="#47321f" stroke-width="0.5"/>';
  return svg;
}

function busRoutePath(
  from: { id: string; x: number; y: number },
  to: { id: string; x: number; y: number },
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const key = [from.id, to.id].sort().join("-");
  const bend = key === "bay-cloverhollow" ? 0.16 : key === "cloverhollow-pass" ? -0.32 : 0.14;
  const cx = Math.round(mx - dy * bend);
  const cy = Math.round(my + dx * bend);
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
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

function fieldNoteBlurb(note: CritterFieldNote): string {
  if (note.oldFriend) return "An old friend! Waves happily whenever Fae walks by.";
  if (note.calms >= 2) return "Brightens up fast for a gentle song and a favorite snack.";
  if (note.lands.length > 1) return "Loves wandering between sunny spots across the valley.";
  const firstFeeling = note.feelings[0]?.id;
  if (firstFeeling === "bored") return "A curious soul who just needed a playful friend.";
  if (firstFeeling === "hungry") return "Follows its nose straight to warm snacks and treats.";
  if (firstFeeling === "grumpy") return "A little prickly at first, then soft as moss once calm.";
  if (firstFeeling === "zoomy") return "Full of bouncy energy until a gentle rhythm settles it.";
  if (firstFeeling === "curious") return "Watches every sparkle and sound with bright, eager eyes.";
  return "A cozy valley friend sketched right into Fae's notebook.";
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
  onClose: (callback: () => void) => void;
  onToggleAudio: (callback: () => void) => void;
  onSetAudioLevel: (callback: (level: AudioLevel) => void) => void;
  onToggleMusic: (callback: () => void) => void;
  onSetMusicLevel: (callback: (level: AudioLevel) => void) => void;
  onToggleAmbience: (callback: () => void) => void;
  onStepTrack: (callback: (delta: -1 | 1) => void) => void;
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
  const close = element("button", "journal-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close journal");
  close.textContent = "×";

  const notesPage = element("section", "journal-page journal-notes-page");
  const notesHead = element("div", "journal-notes-head");
  const notesHeading = element("h2", "journal-heading");
  notesHeading.textContent = "NOTES";
  const supplies = element("div", "journal-supplies");
  const coins = supply("coins", "Coins");
  const snacks = supply("snacks", "Snacks");
  const gems = supply("gems", "Gems");
  supplies.append(coins.root, snacks.root);
  const audio = element("button", "journal-audio");
  audio.type = "button";
  audio.setAttribute("aria-label", "Toggle sound");
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

  const mapPage = element("section", "journal-map-page");
  const mapStage = element("div", "journal-map-stage");
  const map = element("div", "journal-map");
  const mapRoutes = document.createElementNS(svgNamespace, "svg");
  mapRoutes.setAttribute("class", "journal-map-routes");
  mapRoutes.setAttribute("viewBox", "0 0 2400 1610");
  mapRoutes.setAttribute("aria-hidden", "true");
  const mapLabels = element("div", "journal-map-labels");
  const mapBadges = element("div", "journal-map-badges");
  const star = element("div", "journal-map-star");
  star.textContent = "★";
  star.setAttribute("aria-label", "You are here");
  map.append(mapRoutes, mapLabels, mapBadges, star);
  mapStage.append(map);

  const mapFooter = element("div", "journal-map-footer");
  const mapDetail = element("span", "journal-map-detail");
  const mapSummary = element("div", "journal-map-summary");
  const mapStickersPill = element("span", "journal-map-pill");
  setAttribute(mapStickersPill, "data-stat", "stickers");
  const mapPrizesPill = element("span", "journal-map-pill");
  setAttribute(mapPrizesPill, "data-stat", "prizes");
  const mapFishPill = element("span", "journal-map-pill");
  setAttribute(mapFishPill, "data-stat", "fish");
  const mapKeepsakesPill = element("span", "journal-map-pill");
  setAttribute(mapKeepsakesPill, "data-stat", "keepsakes");
  const mapTreasuresBtn = element("button", "journal-treasures-btn");
  mapTreasuresBtn.type = "button";
  mapTreasuresBtn.hidden = true;
  mapTreasuresBtn.setAttribute("aria-label", "Open field treasures");
  const mapLegend = element("span", "journal-map-legend");
  mapLegend.append(busStopIcon(), "Bus");
  mapSummary.append(mapStickersPill, mapPrizesPill, mapTreasuresBtn, mapLegend);
  mapFooter.append(mapDetail, mapSummary);
  mapPage.append(mapStage, mapFooter);

  // Two-page open-book OPTIONS spread: Sound & Music on the left, Gameplay on the right.
  const optionsPage = element("section", "journal-options-page");
  const soundPage = element("section", "journal-options-sound-page");
  const optionsHead = element("div", "journal-options-head");
  const optionsHeading = element("h2", "journal-heading");
  optionsHeading.textContent = "SOUND & MUSIC";
  const jukebox = element("div", "journal-jukebox");
  jukebox.setAttribute("role", "group");
  jukebox.setAttribute("aria-label", "Music Box");
  const prevTrack = element("button", "journal-jukebox-btn journal-jukebox-prev");
  prevTrack.type = "button";
  prevTrack.textContent = "‹";
  prevTrack.setAttribute("aria-label", "Previous track");
  const nowPlaying = element("div", "journal-now-playing");
  nowPlaying.setAttribute("aria-live", "polite");
  const nextTrack = element("button", "journal-jukebox-btn journal-jukebox-next");
  nextTrack.type = "button";
  nextTrack.textContent = "›";
  nextTrack.setAttribute("aria-label", "Next track");
  jukebox.append(prevTrack, nowPlaying, nextTrack);
  optionsHead.append(optionsHeading, jukebox);

  const soundList = element("div", "journal-options-list");
  const optSfx = element("button", "journal-opt-toggle journal-opt-sfx");
  optSfx.type = "button";
  optSfx.setAttribute("aria-label", "Toggle sound effects");
  const optSfxSlider = makeSliderButton(
    "journal-opt-slider journal-opt-sfx-slider",
    "Sound effects volume",
  );
  const sfxRow = makeOptionRow("Sound Effects", null, [optSfx, optSfxSlider.button]);

  const optMusic = element("button", "journal-opt-toggle journal-opt-music");
  optMusic.type = "button";
  optMusic.setAttribute("aria-label", "Toggle music");
  const musicSlider = makeSliderButton(
    "journal-opt-slider journal-music-slider",
    "Music volume",
  );
  const musicRow = makeOptionRow("Music", null, [optMusic, musicSlider.button]);

  const optAmbience = element("button", "journal-opt-toggle journal-opt-ambience");
  optAmbience.type = "button";
  optAmbience.setAttribute("aria-label", "Toggle ambience");
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
  const optGentle = element("button", "journal-opt-toggle journal-opt-gentle");
  optGentle.type = "button";
  optGentle.setAttribute("aria-label", "Toggle gentle timing");
  const gentleRow = makeOptionRow(
    "Gentle Timing",
    "Wider windows in calm-downs",
    [optGentle],
  );

  const optHints = element("button", "journal-opt-toggle journal-opt-hints");
  optHints.type = "button";
  optHints.setAttribute("aria-label", "Toggle key hints");
  const hintsRow = makeOptionRow(
    "Key Hints",
    "Show keys while exploring",
    [optHints],
  );

  const optTextSpeed = element("button", "journal-opt-toggle journal-option-text-speed");
  optTextSpeed.type = "button";
  optTextSpeed.setAttribute("aria-label", "Cycle text speed");
  const textSpeedRow = makeOptionRow(
    "Text Speed",
    "How fast story and battle lines appear",
    [optTextSpeed],
  );

  const optReducedMotion = element("button", "journal-opt-toggle journal-option-reduced-motion");
  optReducedMotion.type = "button";
  optReducedMotion.setAttribute("aria-label", "Toggle reduced motion");
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
  const notesTab = element("button", "journal-tab journal-notes-tab");
  notesTab.type = "button";
  notesTab.textContent = "NOTES";
  notesTab.setAttribute("aria-label", "Notes and stickers");
  const mapTab = element("button", "journal-tab journal-map-tab");
  mapTab.type = "button";
  mapTab.textContent = "MAP";
  mapTab.setAttribute("aria-label", "Map");
  const optionsTab = element("button", "journal-tab journal-options-tab");
  optionsTab.type = "button";
  optionsTab.textContent = "OPTIONS";
  optionsTab.setAttribute("aria-label", "Options");
  tabs.append(notesTab, mapTab, optionsTab);

  const fieldBackdrop = element("div", "journal-field-backdrop");
  fieldBackdrop.hidden = true;
  const fieldCard = element("article", "journal-field-note");
  fieldCard.setAttribute("role", "dialog");
  fieldCard.setAttribute("aria-modal", "true");
  fieldCard.setAttribute("aria-label", "Critter field note");
  const fieldClose = element("button", "journal-field-close");
  fieldClose.type = "button";
  fieldClose.setAttribute("aria-label", "Close field note");
  fieldClose.textContent = "×";
  const fieldLeft = element("div", "journal-field-left");
  const fieldSpecimen = element("div", "journal-field-specimen");
  const fieldPortrait = element("div", "journal-field-portrait die-cut");
  fieldPortrait.setAttribute("role", "img");
  fieldSpecimen.append(fieldPortrait);
  const fieldOldFriend = element("span", "journal-field-old-friend");
  fieldOldFriend.textContent = "★ Old Friend";
  fieldOldFriend.hidden = true;
  fieldLeft.append(fieldSpecimen, fieldOldFriend);
  const fieldBody = element("div", "journal-field-body");
  const fieldName = element("h3", "journal-field-name");
  const fieldSub = element("div", "journal-field-sub");
  const fieldMeta = element("div", "journal-field-meta");
  const makeFieldRow = (
    keyText: string,
    valueNode: HTMLElement,
    pills = false,
  ): HTMLDivElement => {
    const row = element("div", pills ? "journal-field-row is-pills" : "journal-field-row");
    const key = element("span", "journal-field-key");
    key.textContent = keyText;
    row.append(key, valueNode);
    return row;
  };
  const fieldLands = element("span", "journal-field-val journal-field-lands");
  const fieldCalms = element("span", "journal-field-val journal-field-calms");
  const fieldFeelings = element("div", "journal-field-feelings");
  const fieldLoves = element("div", "journal-field-loves");
  const fieldBlurb = element("p", "journal-field-blurb");
  fieldMeta.append(
    makeFieldRow("Found in", fieldLands),
    makeFieldRow("Calmed", fieldCalms),
    makeFieldRow("Feelings", fieldFeelings, true),
    makeFieldRow("Loves", fieldLoves, true),
  );
  fieldBody.append(fieldName, fieldSub, fieldMeta, fieldBlurb);
  fieldCard.append(fieldClose, fieldLeft, fieldBody);
  fieldBackdrop.append(fieldCard);

  const treasuresBackdrop = element("div", "journal-treasures-backdrop");
  treasuresBackdrop.hidden = true;
  const treasuresCard = element("article", "journal-treasures-card");
  treasuresCard.setAttribute("role", "dialog");
  treasuresCard.setAttribute("aria-modal", "true");
  treasuresCard.setAttribute("aria-label", "Field treasures");
  const treasuresClose = element("button", "journal-treasures-close");
  treasuresClose.type = "button";
  treasuresClose.setAttribute("aria-label", "Close field treasures");
  treasuresClose.textContent = "×";
  const treasuresHead = element("div", "journal-treasures-head");
  const treasuresTitle = element("h3", "journal-treasures-title");
  treasuresTitle.textContent = "FIELD TREASURES";
  treasuresHead.append(treasuresTitle, treasuresClose);
  const treasuresStamps = element("div", "journal-treasures-stamps");
  treasuresStamps.hidden = true;
  const keepsakesSection = element("section", "journal-treasures-section");
  const keepsakesHead = element("div", "journal-treasures-section-head");
  const treasuresKeepsakesHeading = element("span", "journal-treasures-section-title");
  treasuresKeepsakesHeading.textContent = "CLUBHOUSE KEEPSAKES";
  const treasuresKeepsakesCount = element("span", "journal-treasures-count");
  keepsakesHead.append(treasuresKeepsakesHeading, treasuresKeepsakesCount);
  const treasuresKeepsakesGrid = element("div", "journal-keepsakes-grid");
  keepsakesSection.append(keepsakesHead, treasuresKeepsakesGrid);
  const catchSection = element("section", "journal-treasures-section");
  const catchHead = element("div", "journal-treasures-section-head");
  const catchHeading = element("span", "journal-treasures-section-title");
  catchHeading.textContent = "BUBBLEGUM BAY CATCH BOOK";
  const catchCount = element("span", "journal-treasures-count");
  catchHead.append(catchHeading, catchCount);
  const catchRow = element("div", "journal-catch-row");
  catchSection.append(catchHead, catchRow);
  treasuresCard.append(
    treasuresHead,
    treasuresStamps,
    keepsakesSection,
    catchSection,
  );
  treasuresBackdrop.append(treasuresCard);

  book.append(
    label,
    close,
    notesPage,
    stickersPage,
    mapPage,
    optionsPage,
    tabs,
    fieldBackdrop,
    treasuresBackdrop,
  );
  root.append(book);

  let onClose: () => void = () => undefined;
  let onToggleAudio: () => void = () => undefined;
  let onSetAudioLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleMusic: () => void = () => undefined;
  let onSetMusicLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleAmbience: () => void = () => undefined;
  let onStepTrack: (delta: -1 | 1) => void = () => undefined;
  let onToggleGentleTiming: () => void = () => undefined;
  let onToggleKeyHints: () => void = () => undefined;
  let onCycleTextSpeed: () => void = () => undefined;
  let onToggleReducedMotion: () => void = () => undefined;

  let page: JournalPage = "notes";
  let wasVisible = false;
  let mapSignature = "";
  let routeSignature = "";
  let badgeSignature = "";
  let treatsSignature = "";
  let fieldSignature = "";
  let treasuresSignature = "";
  let inspectedStickerId: string | null = null;
  let treasuresOpen = false;
  let selectedLandId: string | null = null;
  let hoveredLandId: string | null = null;
  let latestView: JournalView | null = null;

  const closeFieldNote = (): void => {
    if (inspectedStickerId === null && fieldBackdrop.hidden) return;
    inspectedStickerId = null;
    fieldSignature = "";
    fieldBackdrop.hidden = true;
  };

  const closeTreasures = (): void => {
    if (!treasuresOpen && treasuresBackdrop.hidden) return;
    treasuresOpen = false;
    treasuresBackdrop.hidden = true;
  };

  const syncTreasures = (view: JournalView): void => {
    const summary = view.treasures;
    if (!treasuresOpen || summary === undefined || !summary.hasAny) {
      if (!treasuresBackdrop.hidden) closeTreasures();
      return;
    }
    treasuresBackdrop.hidden = false;
    const signature = [
      summary.stamps.started,
      summary.stamps.bay,
      summary.stamps.pass,
      summary.stamps.complete,
      summary.keepsakes.map((item) => `${item.id}:${item.unlocked}`).join(","),
      summary.catches.map((item) => `${item.id}:${item.caught}`).join(","),
    ].join("|");
    if (signature === treasuresSignature) return;
    treasuresSignature = signature;

    treasuresStamps.hidden = !summary.stamps.started;
    if (summary.stamps.started) {
      const stripLabel = element("span", "journal-stamps-label");
      stripLabel.textContent = "STAR-LINE STAMP CARD";
      const bayPill = element(
        "span",
        summary.stamps.bay ? "journal-stamp-pill is-stamped" : "journal-stamp-pill",
      );
      bayPill.textContent = `${summary.stamps.bay ? "✓" : "○"} Bay Wave Stamp`;
      const passPill = element(
        "span",
        summary.stamps.pass ? "journal-stamp-pill is-stamped" : "journal-stamp-pill",
      );
      passPill.textContent = `${summary.stamps.pass ? "✓" : "○"} Pass Pine Stamp`;
      const nodes: HTMLElement[] = [stripLabel, bayPill, passPill];
      if (summary.stamps.complete) {
        const badge = element("span", "journal-stamp-complete");
        badge.textContent = "★ Star-Line Explorer!";
        nodes.push(badge);
      }
      treasuresStamps.replaceChildren(...nodes);
    } else {
      treasuresStamps.replaceChildren();
    }

    setText(treasuresKeepsakesCount, `${summary.unlockedKeepsakes}/${summary.totalKeepsakes}`);
    treasuresKeepsakesGrid.replaceChildren(
      ...summary.keepsakes.map((item) => {
        const card = element(
          "div",
          item.unlocked
            ? "journal-keepsake-item is-unlocked"
            : "journal-keepsake-item is-locked",
        );
        setAttribute(card, "data-keepsake", item.id);
        const title = element("div", "journal-keepsake-name");
        title.textContent = item.unlocked ? `★ ${item.name}` : "???";
        const detail = element("div", "journal-keepsake-detail");
        detail.textContent = item.unlocked ? `${item.source} · ${item.note}` : item.source;
        card.append(title, detail);
        return card;
      }),
    );

    setText(catchCount, `${summary.caughtFish}/${summary.totalFish}`);
    catchRow.replaceChildren(
      ...summary.catches.map((entry) => {
        const classes = entry.caught
          ? entry.rare
            ? "journal-catch-pill is-caught is-rare"
            : "journal-catch-pill is-caught"
          : "journal-catch-pill is-uncaught";
        const pill = element("span", classes);
        setAttribute(pill, "data-fish", entry.id);
        pill.textContent = entry.caught
          ? `${entry.rare ? "★ " : ""}${entry.name}`
          : "???";
        return pill;
      }),
    );
  };

  const syncFieldNote = (view: JournalView): void => {
    if (inspectedStickerId === null) {
      if (!fieldBackdrop.hidden) fieldBackdrop.hidden = true;
      return;
    }
    const sticker = view.stickers.find(
      (candidate) => candidate.id === inspectedStickerId && candidate.owned &&
        candidate.fieldNote != null,
    );
    const note = sticker?.fieldNote ?? null;
    if (sticker === undefined || note === null) {
      closeFieldNote();
      return;
    }
    fieldBackdrop.hidden = false;
    const signature = [
      sticker.id,
      note.level,
      note.calms,
      note.oldFriend,
      note.lands.join(","),
      note.feelings.map((item) => item.id).join(","),
      note.favouriteTreats.join(","),
    ].join("|");
    if (signature === fieldSignature) return;
    fieldSignature = signature;
    if (sticker.image !== null) applyAtlasCrop(fieldPortrait, sticker.image);
    setAttribute(fieldPortrait, "aria-label", note.name);
    setText(fieldName, note.name);
    setText(fieldSub, `Lv ${note.level} · ${note.chaosName}`);
    fieldOldFriend.hidden = !note.oldFriend;
    setText(fieldLands, note.lands.join(", "));
    setText(fieldCalms, `${note.calms} ${note.calms === 1 ? "time" : "times"}`);
    fieldFeelings.replaceChildren(
      ...note.feelings.map((feeling) => {
        const pill = element("span", "journal-field-feeling");
        pill.append(icon(feelingMarkup[feeling.id], "journal-field-feeling-icon"), feeling.label);
        return pill;
      }),
    );
    fieldLoves.replaceChildren(
      ...note.favouriteTreats.map((treat) => {
        const pill = element("span", "journal-field-love-pill");
        pill.append(icon(heartMarkup, "journal-field-heart"), treat);
        return pill;
      }),
    );
    setText(fieldBlurb, fieldNoteBlurb(note));
  };

  fieldClose.addEventListener("click", closeFieldNote);
  fieldBackdrop.addEventListener("click", (event) => {
    if (event.target === fieldBackdrop) closeFieldNote();
  });
  mapTreasuresBtn.addEventListener("click", () => {
    if (latestView?.treasures?.hasAny !== true) return;
    treasuresOpen = true;
    syncTreasures(latestView);
  });
  treasuresClose.addEventListener("click", closeTreasures);
  treasuresBackdrop.addEventListener("click", (event) => {
    if (event.target === treasuresBackdrop) closeTreasures();
  });

  const syncMapDetail = (view: JournalView): void => {
    const inspectId = hoveredLandId ?? selectedLandId;
    const inspected = inspectId === null
      ? undefined
      : view.lands.find((land) => land.id === inspectId && land.name !== "???");
    const current = view.lands.find((land) => land.id === view.currentLand);
    const active = inspected ?? current;
    const prefix = inspected !== undefined && inspected.id !== view.currentLand ? "" : "Here: ";
    if (active === undefined) {
      setText(mapDetail, "Cloverhollow World");
    } else {
      const progress = view.landProgress[active.id];
      const suffix =
        progress === undefined || progress.total === 0
          ? ""
          : ` · ${progress.owned}/${progress.total} stickers`;
      setText(mapDetail, `${prefix}${active.name}${suffix}`);
    }
    for (const node of mapLabels.children) {
      if (!(node instanceof HTMLElement)) continue;
      const landId = node.getAttribute("data-land");
      node.classList.toggle("is-selected", landId !== null && landId === selectedLandId);
    }
  };

  const setPage = (next: JournalPage): void => {
    closeFieldNote();
    closeTreasures();
    if (page === next && book.getAttribute("data-journal-page") === next) return;
    page = next;
    setAttribute(book, "data-journal-page", page);
    notesPage.hidden = page !== "notes";
    stickersPage.hidden = page !== "notes";
    mapPage.hidden = page !== "map";
    optionsPage.hidden = page !== "options";
  };

  notesTab.addEventListener("click", () => setPage("notes"));
  mapTab.addEventListener("click", () => setPage("map"));
  optionsTab.addEventListener("click", () => setPage("options"));

  const sliders = new Set<EventTarget>([
    volume.button,
    optSfxSlider.button,
    musicSlider.button,
  ]);
  const keydown = (event: KeyboardEvent): void => {
    if (book.hidden) return;
    if (treasuresOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeTreasures();
      }
      return;
    }
    if (inspectedStickerId !== null) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeFieldNote();
      }
      return;
    }
    if (event.target !== null && sliders.has(event.target)) return;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      const index = journalPages.indexOf(page);
      const next = journalPages[Math.min(journalPages.length - 1, index + 1)];
      if (next !== undefined) setPage(next);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      const index = journalPages.indexOf(page);
      const prev = journalPages[Math.max(0, index - 1)];
      if (prev !== undefined) setPage(prev);
    }
  };
  document.addEventListener("keydown", keydown);
  setPage("notes");

  close.addEventListener("click", () => onClose());
  audio.addEventListener("click", () => onToggleAudio());
  optSfx.addEventListener("click", () => onToggleAudio());
  optMusic.addEventListener("click", () => onToggleMusic());
  optAmbience.addEventListener("click", () => onToggleAmbience());
  prevTrack.addEventListener("click", () => onStepTrack(-1));
  nextTrack.addEventListener("click", () => onStepTrack(1));
  optGentle.addEventListener("click", () => onToggleGentleTiming());
  optHints.addEventListener("click", () => onToggleKeyHints());
  optTextSpeed.addEventListener("click", () => onCycleTextSpeed());
  optReducedMotion.addEventListener("click", () => onToggleReducedMotion());

  wireSlider(volume.button, volume.value, () => (next) => {
    syncSlider(optSfxSlider.button, optSfxSlider.value, next);
    onSetAudioLevel(next);
  });
  wireSlider(optSfxSlider.button, optSfxSlider.value, () => (next) => {
    syncSlider(volume.button, volume.value, next);
    onSetAudioLevel(next);
  });
  wireSlider(musicSlider.button, musicSlider.value, () => onSetMusicLevel);

  const slots: Slot[] = [];
  const prizeSlots: Slot[] = [];
  const fishSlots: Slot[] = [];
  const keepsakeSlots: KeepsakeSlot[] = [];
  return {
    setPage,
    onClose: (callback) => {
      onClose = callback;
    },
    onToggleAudio: (callback) => {
      onToggleAudio = callback;
    },
    onSetAudioLevel: (callback) => {
      onSetAudioLevel = callback;
    },
    onToggleMusic: (callback) => {
      onToggleMusic = callback;
    },
    onSetMusicLevel: (callback) => {
      onSetMusicLevel = callback;
    },
    onToggleAmbience: (callback) => {
      onToggleAmbience = callback;
    },
    onStepTrack: (callback) => {
      onStepTrack = callback;
    },
    onToggleGentleTiming: (callback) => {
      onToggleGentleTiming = callback;
    },
    onToggleKeyHints: (callback) => {
      onToggleKeyHints = callback;
    },
    onCycleTextSpeed: (callback) => {
      onCycleTextSpeed = callback;
    },
    onToggleReducedMotion: (callback) => {
      onToggleReducedMotion = callback;
    },
    render: (view) => {
      latestView = view;
      book.hidden = !view.visible;
      if (!view.visible && wasVisible) {
        closeFieldNote();
        closeTreasures();
        setPage("notes");
        selectedLandId = null;
        hoveredLandId = null;
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
      setText(optSfx, view.muted ? "off" : "on");
      optSfx.classList.toggle("is-muted", view.muted);
      setAttribute(optSfx, "aria-pressed", String(!view.muted));
      syncSlider(optSfxSlider.button, optSfxSlider.value, view.level);
      setText(optMusic, view.musicMuted ? "off" : "on");
      optMusic.classList.toggle("is-muted", view.musicMuted);
      setAttribute(optMusic, "aria-pressed", String(!view.musicMuted));
      syncSlider(musicSlider.button, musicSlider.value, view.musicLevel);
      setText(optAmbience, view.ambienceMuted ? "off" : "on");
      optAmbience.classList.toggle("is-muted", view.ambienceMuted);
      setAttribute(optAmbience, "aria-pressed", String(!view.ambienceMuted));

      setText(optGentle, view.gentleTiming ? "on" : "off");
      optGentle.classList.toggle("is-muted", !view.gentleTiming);
      setAttribute(optGentle, "aria-pressed", String(view.gentleTiming));
      setText(optHints, view.keyHints ? "on" : "off");
      optHints.classList.toggle("is-muted", !view.keyHints);
      setAttribute(optHints, "aria-pressed", String(view.keyHints));
      setText(optTextSpeed, textSpeedLabel(view.textSpeed));
      setAttribute(optTextSpeed, "data-speed", view.textSpeed);
      setText(optReducedMotion, view.reducedMotion ? "on" : "off");
      optReducedMotion.classList.toggle("is-muted", !view.reducedMotion);
      setAttribute(optReducedMotion, "aria-pressed", String(view.reducedMotion));

      setText(controlsLine, "Move: Arrows / WASD · Talk: Z · Journal: J · Mute: M");
      const toolParts: string[] = [];
      if (view.hasLantern) toolParts.push("Lantern: L");
      if (view.hasFlute) toolParts.push("Flute: F");
      controlsTools.hidden = toolParts.length === 0;
      setText(controlsTools, toolParts.join(" · "));

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
          inspectedStickerId = current.id;
          if (latestView !== null) syncFieldNote(latestView);
        }));
      }
      while (slots.length > view.stickers.length) slots.pop()?.root.remove();
      view.stickers.forEach((sticker, index) => {
        const slot = slots[index];
        if (slot === undefined) return;
        const image = sticker.owned ? sticker.image : null;
        const inspectable = image !== null && sticker.fieldNote != null;
        slot.image.hidden = image === null;
        slot.unknown.hidden = image !== null;
        slot.name.hidden = image === null;
        setText(slot.name, image === null ? "" : sticker.name);
        setAttribute(slot.root, "data-owned", String(image !== null));
        slot.root.classList.toggle("is-inspectable", inspectable);
        if (inspectable) {
          setAttribute(slot.root, "tabindex", "0");
          setAttribute(slot.root, "role", "button");
          setAttribute(slot.root, "aria-label", `Inspect ${sticker.name}`);
        } else {
          if (slot.root.hasAttribute("tabindex")) slot.root.removeAttribute("tabindex");
          if (slot.root.hasAttribute("role")) slot.root.removeAttribute("role");
          if (slot.root.hasAttribute("aria-label")) slot.root.removeAttribute("aria-label");
        }
        if (image === null) {
          slot.imageKey = "";
          return;
        }
        setAttribute(slot.image, "aria-label", sticker.name);
        const key =
          `${image.src}#${image.frame.x},${image.frame.y},` +
          `${image.frame.w},${image.frame.h}`;
        if (slot.imageKey !== key) {
          applyAtlasCrop(slot.image, image);
          slot.imageKey = key;
        }
      });
      syncFieldNote(view);
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
        slot.image.hidden = image === null;
        slot.unknown.hidden = image !== null;
        slot.name.hidden = image === null;
        setText(slot.name, image === null ? "" : prize.name);
        setAttribute(slot.root, "data-owned", String(image !== null));
        if (image === null) {
          slot.imageKey = "";
          return;
        }
        setAttribute(slot.image, "aria-label", prize.name);
        const key =
          `${image.src}#${image.frame.x},${image.frame.y},` +
          `${image.frame.w},${image.frame.h}`;
        if (slot.imageKey !== key) {
          applyAtlasCrop(slot.image, image);
          slot.imageKey = key;
        }
      });
      const allPrizesOwned =
        view.prizes.length > 0 && view.prizes.every((prize) => prize.owned);
      syncChild(prizesHeading, prizesComplete, allPrizesOwned);

      const fishList = view.fish ?? [];
      const fishOwned = fishList.filter((item) => item.owned).length;
      const showFish = fishOwned > 0;
      syncAttachedAfter(prizesGrid, fishHeading, showFish);
      syncAttachedAfter(fishHeading, fishGrid, showFish);
      if (showFish) {
        setText(fishCount, `${fishOwned}/${fishList.length}`);
        syncChild(fishHeading, fishComplete, fishList.length > 0 && fishOwned >= fishList.length);
        while (fishSlots.length < fishList.length) {
          fishSlots.push(addSlot(fishGrid, undefined, "A fish still to catch"));
        }
        while (fishSlots.length > fishList.length) fishSlots.pop()?.root.remove();
        fishList.forEach((item, index) => {
          const slot = fishSlots[index];
          if (slot === undefined) return;
          const image = item.owned ? item.image : null;
          slot.image.hidden = !item.owned;
          slot.unknown.hidden = item.owned;
          slot.name.hidden = !item.owned;
          setText(slot.name, item.owned ? item.name : "");
          setAttribute(slot.root, "data-owned", String(item.owned));
          setAttribute(slot.root, "data-fish", item.id);
          slot.root.classList.toggle("is-rare", item.owned && item.rare);
          if (image === null) {
            slot.imageKey = "";
            return;
          }
          setAttribute(slot.image, "aria-label", item.name);
          const key =
            `${image.src}#${image.frame.x},${image.frame.y},` +
            `${image.frame.w},${image.frame.h}`;
          if (slot.imageKey !== key) {
            applyAtlasCrop(slot.image, image);
            slot.imageKey = key;
          }
        });
      }

      const keepsakesList = view.keepsakes ?? [];
      const keepsakesOwned = keepsakesList.filter((item) => item.owned).length;
      const showKeepsakes = keepsakesOwned > 0;
      const keepsakesAnchor = showFish ? fishGrid : prizesGrid;
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
          keepsakeSlots.push(addKeepsakeSlot(keepsakesGrid));
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

      const nextMapSignature = view.lands
        .map((land) => `${land.id}:${land.name}:${land.busStop}:${land.x}:${land.y}`)
        .join("|");
      if (nextMapSignature !== mapSignature) {
        mapSignature = nextMapSignature;
        mapLabels.replaceChildren();
        view.lands.forEach((land: MapLand) => {
          const item = element("span", "journal-map-land");
          item.textContent = land.name;
          item.style.left = `${(land.x / 2400) * 100}%`;
          item.style.top = `${(land.y / 1610) * 100}%`;
          setAttribute(item, "data-land", land.id);
          const revealed = land.name !== "???";
          if (revealed) {
            item.classList.add("is-revealed");
            item.addEventListener("click", () => {
              selectedLandId = selectedLandId === land.id ? null : land.id;
              if (latestView !== null) syncMapDetail(latestView);
            });
            item.addEventListener("pointerenter", () => {
              hoveredLandId = land.id;
              if (latestView !== null) syncMapDetail(latestView);
            });
            item.addEventListener("pointerleave", () => {
              if (hoveredLandId === land.id) {
                hoveredLandId = null;
                if (latestView !== null) syncMapDetail(latestView);
              }
            });
          }
          mapLabels.append(item);
          if (!land.busStop) return;
          // The bus line's sign (a gold star on a blue roundel) leads the name.
          const stop = element("span", "journal-map-stop");
          setAttribute(stop, "data-land", land.id);
          setAttribute(stop, "aria-label", `Bus stop: ${land.name}`);
          stop.append(busStopIcon());
          item.prepend(stop);
        });
      }

      const landLookup = new Map(view.lands.map((land) => [land.id, land]));
      const nextRouteSignature = view.busRoutes
        .map((route) => {
          const a = landLookup.get(route.from);
          const b = landLookup.get(route.to);
          return `${route.from}-${route.to}:${route.open}:` +
            `${a?.x ?? 0},${a?.y ?? 0}:${b?.x ?? 0},${b?.y ?? 0}`;
        })
        .join("|");
      if (nextRouteSignature !== routeSignature) {
        routeSignature = nextRouteSignature;
        mapRoutes.replaceChildren();
        for (const route of view.busRoutes) {
          const from = landLookup.get(route.from);
          const to = landLookup.get(route.to);
          if (from === undefined || to === undefined) continue;
          const d = busRoutePath(from, to);
          const halo = document.createElementNS(svgNamespace, "path");
          halo.setAttribute(
            "class",
            route.open ? "journal-map-route-halo is-open" : "journal-map-route-halo",
          );
          halo.setAttribute("d", d);
          mapRoutes.append(halo);
          const line = document.createElementNS(svgNamespace, "path");
          line.setAttribute(
            "class",
            route.open ? "journal-map-route is-open" : "journal-map-route",
          );
          line.setAttribute("data-route", `${route.from}-${route.to}`);
          line.setAttribute("data-open", String(route.open));
          line.setAttribute("d", d);
          mapRoutes.append(line);
        }
      }

      const completedLands = view.lands.filter((land) => {
        if (land.name === "???") return false;
        const progress = view.landProgress[land.id];
        return progress !== undefined && progress.total > 0 && progress.owned >= progress.total;
      });
      const nextBadgeSignature = completedLands
        .map((land) => `${land.id}:${land.x}:${land.y}`)
        .join("|");
      if (nextBadgeSignature !== badgeSignature) {
        badgeSignature = nextBadgeSignature;
        mapBadges.replaceChildren();
        for (const land of completedLands) {
          const badge = element("span", "journal-map-complete");
          badge.textContent = "✓";
          badge.style.left = `${(land.x / 2400) * 100}%`;
          badge.style.top = `${(land.y / 1610) * 100}%`;
          setAttribute(badge, "data-land", land.id);
          setAttribute(badge, "aria-label", `${land.name} stickers complete`);
          mapBadges.append(badge);
        }
      }

      setText(mapStickersPill, `Stickers ${view.stickersOwned}/${view.stickersTotal}`);
      setText(mapPrizesPill, `Prizes ${view.prizesOwned}/${view.prizesTotal}`);
      syncAttachedAfter(mapPrizesPill, mapFishPill, showFish);
      if (showFish) setText(mapFishPill, `Fish ${fishOwned}/${fishList.length}`);
      syncAttachedAfter(showFish ? mapFishPill : mapPrizesPill, mapKeepsakesPill, showKeepsakes);
      if (showKeepsakes) {
        setText(mapKeepsakesPill, `Keepsakes ${keepsakesOwned}/${keepsakesList.length}`);
      }
      const treasures = view.treasures;
      const showTreasures = treasures !== undefined && treasures.hasAny;
      mapTreasuresBtn.hidden = !showTreasures;
      if (showTreasures) {
        setText(
          mapTreasuresBtn,
          `Treasures · ${treasures.unlockedKeepsakes}/${treasures.totalKeepsakes}`,
        );
      }
      syncTreasures(view);
      syncMapDetail(view);

      const here = view.lands.find((land) => land.id === view.currentLand);
      star.hidden = here === undefined;
      setAttribute(star, "data-land", here?.id ?? "");
      if (here !== undefined) {
        // Just above the land's name, so the name stays readable.
        star.style.left = `${(here.x / 2400) * 100}%`;
        star.style.top = `${(here.y / 1610) * 100 - 7}%`;
      }
    },
  };
}
