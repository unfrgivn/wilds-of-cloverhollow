import "./journal.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import {
  coinMarkup,
  cookieMarkup,
  feelingMarkup,
  heartMarkup,
  icon,
  ticketMarkup,
} from "./icons";
import { AUDIO_LEVELS, type AudioLevel } from "../platform/audio-settings";
import type { BusRoute, CarriedTreat, CritterFieldNote, LandProgress } from "../core/journal";
import type { LevelStats } from "../core/levels";

export type JournalPage = "notes" | "map" | "options";

export type JournalSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
  fieldNote?: CritterFieldNote | null;
};
export type JournalPrize = JournalSticker;

export type JournalView = {
  visible: boolean;
  /** Newest first; the game decides the order. */
  notes: string[];
  treats?: CarriedTreat[];
  stickers: JournalSticker[];
  prizes: JournalPrize[];
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
  muted: boolean;
  level: AudioLevel;
  musicMuted: boolean;
  musicLevel: AudioLevel;
  ambienceMuted: boolean;
  nowPlaying: string;
  gentleTiming: boolean;
  keyHints: boolean;
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

function addSlot(grid: HTMLElement, onInspect?: () => void): Slot {
  const root = element("div", "journal-slot");
  const image = element("div", "journal-sticker-image die-cut");
  image.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", "A sticker still to find");
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
function supply(kind: "coins" | "snacks" | "tickets", label: string): {
  root: HTMLSpanElement;
  count: HTMLSpanElement;
} {
  const pill = kind === "tickets" ? "journal-tickets" : "journal-supply";
  const root = element("span", pill);
  setAttribute(root, "data-supply", kind);
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    kind === "coins" ? coinMarkup : kind === "snacks" ? cookieMarkup : ticketMarkup;
  const count = element("span", `${pill}-count`);
  root.append(svg, `${label} `, count);
  return { root, count };
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
  onToggleGentleTiming: (callback: () => void) => void;
  onToggleKeyHints: (callback: () => void) => void;
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
  const grid = element("div", "journal-stickers");
  const prizesHeading = element("h3", "journal-prizes-heading");
  prizesHeading.append("PRIZES");
  const tickets = supply("tickets", "Tickets");
  prizesHeading.append(tickets.root);
  const prizesGrid = element("div", "journal-stickers journal-prizes");
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
  const mapLegend = element("span", "journal-map-legend");
  mapLegend.append(busStopIcon(), "Bus");
  mapSummary.append(mapStickersPill, mapPrizesPill, mapLegend);
  mapFooter.append(mapDetail, mapSummary);
  mapPage.append(mapStage, mapFooter);

  // Two-page open-book OPTIONS spread: Sound & Music on the left, Gameplay on the right.
  const optionsPage = element("section", "journal-options-page");
  const soundPage = element("section", "journal-options-sound-page");
  const optionsHead = element("div", "journal-options-head");
  const optionsHeading = element("h2", "journal-heading");
  optionsHeading.textContent = "SOUND & MUSIC";
  const nowPlaying = element("div", "journal-now-playing");
  nowPlaying.setAttribute("aria-live", "polite");
  optionsHead.append(optionsHeading, nowPlaying);

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
  playList.append(gentleRow, hintsRow);

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
  const fieldPortrait = element("div", "journal-field-portrait die-cut");
  fieldPortrait.setAttribute("role", "img");
  const fieldOldFriend = element("span", "journal-field-old-friend");
  fieldOldFriend.textContent = "★ Old Friend";
  fieldOldFriend.hidden = true;
  fieldLeft.append(fieldPortrait, fieldOldFriend);
  const fieldBody = element("div", "journal-field-body");
  const fieldName = element("h3", "journal-field-name");
  const fieldSub = element("div", "journal-field-sub");
  const fieldMeta = element("div", "journal-field-meta");
  const makeFieldRow = (
    keyText: string,
    valueNode: HTMLElement,
  ): HTMLDivElement => {
    const row = element("div", "journal-field-row");
    const key = element("span", "journal-field-key");
    key.textContent = keyText;
    row.append(key, valueNode);
    return row;
  };
  const fieldLands = element("span", "journal-field-val journal-field-lands");
  const fieldCalms = element("span", "journal-field-val journal-field-calms");
  const fieldFeelings = element("div", "journal-field-feelings");
  const fieldLoves = element("div", "journal-field-loves");
  fieldMeta.append(
    makeFieldRow("Found in", fieldLands),
    makeFieldRow("Calmed", fieldCalms),
    makeFieldRow("Feelings", fieldFeelings),
    makeFieldRow("Loves", fieldLoves),
  );
  fieldBody.append(fieldName, fieldSub, fieldMeta);
  fieldCard.append(fieldClose, fieldLeft, fieldBody);
  fieldBackdrop.append(fieldCard);

  book.append(label, close, notesPage, stickersPage, mapPage, optionsPage, tabs, fieldBackdrop);
  root.append(book);

  let onClose: () => void = () => undefined;
  let onToggleAudio: () => void = () => undefined;
  let onSetAudioLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleMusic: () => void = () => undefined;
  let onSetMusicLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleAmbience: () => void = () => undefined;
  let onToggleGentleTiming: () => void = () => undefined;
  let onToggleKeyHints: () => void = () => undefined;

  let page: JournalPage = "notes";
  let wasVisible = false;
  let mapSignature = "";
  let routeSignature = "";
  let badgeSignature = "";
  let treatsSignature = "";
  let fieldSignature = "";
  let inspectedStickerId: string | null = null;
  let selectedLandId: string | null = null;
  let hoveredLandId: string | null = null;
  let latestView: JournalView | null = null;

  const closeFieldNote = (): void => {
    if (inspectedStickerId === null && fieldBackdrop.hidden) return;
    inspectedStickerId = null;
    fieldSignature = "";
    fieldBackdrop.hidden = true;
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
    const lovesPill = element("span", "journal-field-love-pill");
    lovesPill.append(
      icon(heartMarkup, "journal-field-heart"),
      note.favouriteTreats.join(", "),
    );
    fieldLoves.replaceChildren(lovesPill);
  };

  fieldClose.addEventListener("click", closeFieldNote);
  fieldBackdrop.addEventListener("click", (event) => {
    if (event.target === fieldBackdrop) closeFieldNote();
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
  optGentle.addEventListener("click", () => onToggleGentleTiming());
  optHints.addEventListener("click", () => onToggleKeyHints());

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
    onToggleGentleTiming: (callback) => {
      onToggleGentleTiming = callback;
    },
    onToggleKeyHints: (callback) => {
      onToggleKeyHints = callback;
    },
    render: (view) => {
      latestView = view;
      book.hidden = !view.visible;
      if (!view.visible && wasVisible) {
        closeFieldNote();
        setPage("notes");
        selectedLandId = null;
        hoveredLandId = null;
      }
      wasVisible = view.visible;
      if (!view.visible) return;
      setText(coins.count, String(view.coins));
      setText(tickets.count, String(view.tickets));
      setText(snacks.count, String(view.snacks));
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
