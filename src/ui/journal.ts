import "./journal.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import { coinMarkup, cookieMarkup, ticketMarkup } from "./icons";
import { AUDIO_LEVELS, type AudioLevel } from "../platform/audio-settings";
import type { LevelStats } from "../core/levels";

export type JournalPage = "notes" | "map" | "options";

export type JournalSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
};
export type JournalPrize = JournalSticker;

export type JournalView = {
  visible: boolean;
  /** Newest first; the game decides the order. */
  notes: string[];
  stickers: JournalSticker[];
  prizes: JournalPrize[];
  lands: { id: string; name: string; busStop: boolean; x: number; y: number }[];
  currentLand: string | null;
  coins: number;
  tickets: number;
  snacks: number;
  muted: boolean;
  level: AudioLevel;
  musicMuted: boolean;
  musicLevel: AudioLevel;
  ambienceMuted: boolean;
  nowPlaying: string;
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

function addSlot(grid: HTMLElement): Slot {
  const root = element("div", "journal-slot");
  const image = element("div", "journal-sticker-image die-cut");
  image.setAttribute("role", "img");
  const unknown = element("div", "journal-unknown");
  unknown.textContent = "?";
  unknown.setAttribute("aria-label", "A sticker still to find");
  const name = element("div", "journal-name");
  root.append(image, unknown, name);
  grid.append(root);
  return { root, image, unknown, name, imageKey: "" };
}

// The bus line's stop sign, as on the sprite: a gold star on a blue roundel
// atop a pole.
function busStopIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
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
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    kind === "coins" ? coinMarkup : kind === "snacks" ? cookieMarkup : ticketMarkup;
  const count = element("span", `${pill}-count`);
  root.append(svg, `${label} `, count);
  return { root, count };
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
  const notes = element("ul", "journal-notes");
  const empty = element("p", "journal-empty");
  empty.textContent = "Nothing yet. Look around!";
  const members = element("div", "journal-members");
  notesPage.append(notesHead, members, notes, empty);

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
  const map = element("div", "journal-map");
  const mapLabels = element("div", "journal-map-labels");
  const star = element("div", "journal-map-star");
  star.textContent = "★";
  star.setAttribute("aria-label", "You are here");
  map.append(mapLabels, star);
  mapPage.append(map);

  const optionsPage = element("section", "journal-options-page");
  const optionsHead = element("div", "journal-options-head");
  const optionsHeading = element("h2", "journal-heading");
  optionsHeading.textContent = "SOUND & MUSIC";
  const nowPlaying = element("div", "journal-now-playing");
  nowPlaying.setAttribute("aria-live", "polite");
  optionsHead.append(optionsHeading, nowPlaying);

  const optionsList = element("div", "journal-options-list");

  const makeOptionRow = (
    titleText: string,
    subtitleText: string | null,
    controls: HTMLElement[],
  ): HTMLDivElement => {
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
  };

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

  optionsList.append(sfxRow, musicRow, ambienceRow);
  optionsPage.append(optionsHead, optionsList);

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

  book.append(label, close, notesPage, stickersPage, mapPage, optionsPage, tabs);
  root.append(book);

  let onClose: () => void = () => undefined;
  let onToggleAudio: () => void = () => undefined;
  let onSetAudioLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleMusic: () => void = () => undefined;
  let onSetMusicLevel: (level: AudioLevel) => void = () => undefined;
  let onToggleAmbience: () => void = () => undefined;

  let page: JournalPage = "notes";
  let wasVisible = false;
  let mapSignature = "";

  const setPage = (next: JournalPage): void => {
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
    render: (view) => {
      book.hidden = !view.visible;
      if (!view.visible && wasVisible) setPage("notes");
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
      while (slots.length < view.stickers.length) slots.push(addSlot(grid));
      while (slots.length > view.stickers.length) slots.pop()?.root.remove();
      view.stickers.forEach((sticker, index) => {
        const slot = slots[index];
        if (slot === undefined) return;
        const image = sticker.owned ? sticker.image : null;
        slot.image.hidden = image === null;
        slot.unknown.hidden = image !== null;
        slot.name.hidden = image === null;
        setText(slot.name, image === null ? "" : sticker.name);
        setAttribute(slot.root, "data-owned", String(image !== null));
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
        .map((land) => `${land.id}:${land.name}:${land.x}:${land.y}`)
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
