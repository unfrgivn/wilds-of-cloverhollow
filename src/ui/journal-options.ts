import { element, setAttribute, setText } from "./dom";
import { cameraIcon } from "./postcard";
import { AUDIO_LEVELS, type AudioLevel } from "../platform/audio-settings";
import type { TextSpeed } from "../core/sim";

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

export type JournalControlsTools = JournalControlTools;

export type JournalControlsLines = {
  primary: string;
  tools: string;
};

export type JournalOptionsView = {
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
  hasLantern: boolean;
  hasFlute: boolean;
  hasLasso?: boolean;
  inputMode?: JournalInputMode;
  canPhoto?: boolean;
};

export type JournalOptionsCallbacks = {
  onToggleAudio: () => void;
  onSetAudioLevel: (level: AudioLevel) => void;
  onToggleMusic: () => void;
  onSetMusicLevel: (level: AudioLevel) => void;
  onToggleAmbience: () => void;
  onStepTrack: (delta: -1 | 1) => void;
  onResetJukebox: () => void;
  onToggleGentleTiming: () => void;
  onToggleKeyHints: () => void;
  onCycleTextSpeed: () => void;
  onToggleReducedMotion: () => void;
  onEnterPhotoMode: () => void;
};

export type JournalOptionsHandlers = {
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
  onEnterPhotoMode: (callback: () => void) => void;
};

/** Returns a safe default callback table for Journal OPTIONS controls. */
export function defaultOptionsCallbacks(): JournalOptionsCallbacks {
  const noop = (): void => undefined;
  return {
    onToggleAudio: noop,
    onSetAudioLevel: noop,
    onToggleMusic: noop,
    onSetMusicLevel: noop,
    onToggleAmbience: noop,
    onStepTrack: noop,
    onResetJukebox: noop,
    onToggleGentleTiming: noop,
    onToggleKeyHints: noop,
    onCycleTextSpeed: noop,
    onToggleReducedMotion: noop,
    onEnterPhotoMode: noop,
  };
}

/** Creates handler-registration setters backed by a mutable options callback table. */
export function bindOptionsCallbacks(
  callbacks: JournalOptionsCallbacks,
): JournalOptionsHandlers {
  return {
    onToggleAudio: (cb) => { callbacks.onToggleAudio = cb; },
    onSetAudioLevel: (cb) => { callbacks.onSetAudioLevel = cb; },
    onToggleMusic: (cb) => { callbacks.onToggleMusic = cb; },
    onSetMusicLevel: (cb) => { callbacks.onSetMusicLevel = cb; },
    onToggleAmbience: (cb) => { callbacks.onToggleAmbience = cb; },
    onStepTrack: (cb) => { callbacks.onStepTrack = cb; },
    onResetJukebox: (cb) => { callbacks.onResetJukebox = cb; },
    onToggleGentleTiming: (cb) => { callbacks.onToggleGentleTiming = cb; },
    onToggleKeyHints: (cb) => { callbacks.onToggleKeyHints = cb; },
    onCycleTextSpeed: (cb) => { callbacks.onCycleTextSpeed = cb; },
    onToggleReducedMotion: (cb) => { callbacks.onToggleReducedMotion = cb; },
    onEnterPhotoMode: (cb) => { callbacks.onEnterPhotoMode = cb; },
  };
}

export type JournalOptionsPage = {
  root: HTMLElement;
  soundPage: HTMLElement;
  playPage: HTMLElement;
  jukebox: HTMLElement;
  handlers: JournalOptionsHandlers;
  toggleAudio: () => void;
  setAudioLevel: (level: AudioLevel) => void;
  stepTrack: (delta: -1 | 1) => void;
  render: (view: JournalOptionsView) => void;
};

/** Formats the Journal OPTIONS Controls reference lines for keyboard or gamepad play. */
export function journalControlsLines(
  inputMode: JournalInputMode,
  tools: JournalControlTools,
): JournalControlsLines {
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

export function syncSlider(
  slider: HTMLButtonElement,
  valueNode: HTMLElement,
  level: AudioLevel,
): void {
  const percent = String(Math.round(level * 100));
  setAttribute(slider, "aria-valuenow", percent);
  setAttribute(slider, "aria-valuetext", `${percent}%`);
  setText(valueNode, `${percent}%`);
}

export function wireSlider(
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

export function makeSliderButton(className: string, ariaLabel: string): {
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

export function makeJournalButton(
  className: string,
  ariaLabel: string,
  text?: string,
): HTMLButtonElement {
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

export function textSpeedLabel(speed: TextSpeed): string {
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

/** Creates the two-page open-book OPTIONS spread (Sound & Music on the left, Gameplay right). */
export function createJournalOptionsPage(options: {
  sliderSteppers: Map<EventTarget, (direction: -1 | 1) => void>;
  onMirrorAudioLevel: (level: AudioLevel) => void;
}): JournalOptionsPage {
  const optionsPage = element("section", "journal-options-page");
  const soundPage = element("section", "journal-options-sound-page");
  const optionsHead = element("div", "journal-options-head");
  const optionsHeading = element("h2", "journal-heading");
  optionsHeading.textContent = "SOUND & MUSIC";
  const jukebox = element("div", "journal-jukebox");
  jukebox.setAttribute("role", "group");
  jukebox.setAttribute("aria-label", "Music Box");
  jukebox.tabIndex = -1;
  const prevTrack = makeJournalButton(
    "journal-jukebox-btn journal-jukebox-prev",
    "Previous track",
    "‹",
  );
  const nowPlaying = element("button", "journal-now-playing");
  nowPlaying.type = "button";
  nowPlaying.setAttribute("aria-live", "polite");
  const nextTrack = makeJournalButton(
    "journal-jukebox-btn journal-jukebox-next",
    "Next track",
    "›",
  );
  jukebox.append(prevTrack, nowPlaying, nextTrack);
  optionsHead.append(optionsHeading, jukebox);

  const soundList = element("div", "journal-options-list");
  const optSfx = makeJournalButton("journal-opt-toggle journal-opt-sfx", "Toggle sound effects");
  const optSfxSlider = makeSliderButton(
    "journal-opt-slider journal-opt-sfx-slider",
    "Sound effects volume",
  );
  const optMusic = makeJournalButton("journal-opt-toggle journal-opt-music", "Toggle music");
  const musicSlider = makeSliderButton("journal-opt-slider journal-music-slider", "Music volume");
  const optAmbience = makeJournalButton(
    "journal-opt-toggle journal-opt-ambience",
    "Toggle ambience",
  );
  soundList.append(
    makeOptionRow("Sound Effects", null, [optSfx, optSfxSlider.button]),
    makeOptionRow("Music", null, [optMusic, musicSlider.button]),
    makeOptionRow("Ambience", "Waves, wind, birds & hearth", [optAmbience]),
  );
  soundPage.append(optionsHead, soundList);

  const playPage = element("section", "journal-options-play-page");
  const playHead = element("div", "journal-options-play-head");
  const playHeading = element("h2", "journal-heading");
  playHeading.textContent = "GAMEPLAY";
  playHead.append(playHeading);

  const playList = element("div", "journal-options-list");
  const optGentle = makeJournalButton(
    "journal-opt-toggle journal-opt-gentle",
    "Toggle gentle timing",
  );
  const optHints = makeJournalButton("journal-opt-toggle journal-opt-hints", "Toggle key hints");
  const optTextSpeed = makeJournalButton(
    "journal-opt-toggle journal-option-text-speed",
    "Cycle text speed",
  );
  const optReducedMotion = makeJournalButton(
    "journal-opt-toggle journal-option-reduced-motion",
    "Toggle reduced motion",
  );
  playList.append(
    makeOptionRow("Gentle Timing", "Wider windows in calm-downs", [optGentle]),
    makeOptionRow("Key Hints", "Show keys while exploring", [optHints]),
    makeOptionRow("Text Speed", "How fast story and battle lines appear", [optTextSpeed]),
    makeOptionRow(
      "Reduced Motion",
      "Calms animations, shakes, and fluttering effects",
      [optReducedMotion],
    ),
  );

  const controlsCard = element("div", "journal-controls-card");
  const controlsTitle = element("div", "journal-controls-title");
  controlsTitle.textContent = "CONTROLS";
  const controlsLine = element("div", "journal-controls-line");
  const controlsTools = element("div", "journal-controls-line journal-controls-tools");
  controlsTools.hidden = true;
  const photoBtn = makeJournalButton("journal-photo-btn", "Enter Photo Mode");
  photoBtn.hidden = true;
  const photoLabel = element("span", "journal-photo-btn-label");
  photoLabel.textContent = "Photo Mode";
  photoBtn.append(cameraIcon(), photoLabel);
  controlsCard.append(controlsTitle, controlsLine, controlsTools, photoBtn);
  playPage.append(playHead, playList, controlsCard);

  optionsPage.append(soundPage, playPage);

  let jukeboxBrowsing = false;
  const callbacks = defaultOptionsCallbacks();

  optSfx.addEventListener("click", () => callbacks.onToggleAudio());
  optMusic.addEventListener("click", () => callbacks.onToggleMusic());
  optAmbience.addEventListener("click", () => callbacks.onToggleAmbience());
  prevTrack.addEventListener("click", () => callbacks.onStepTrack(-1));
  nextTrack.addEventListener("click", () => callbacks.onStepTrack(1));
  nowPlaying.addEventListener("click", () => {
    if (jukeboxBrowsing) callbacks.onResetJukebox();
  });
  nowPlaying.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (jukeboxBrowsing) callbacks.onResetJukebox();
    }
  });
  jukebox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onStepTrack(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onStepTrack(1);
    }
  });
  optGentle.addEventListener("click", () => callbacks.onToggleGentleTiming());
  optHints.addEventListener("click", () => callbacks.onToggleKeyHints());
  optTextSpeed.addEventListener("click", () => callbacks.onCycleTextSpeed());
  optReducedMotion.addEventListener("click", () => callbacks.onToggleReducedMotion());
  photoBtn.addEventListener("click", () => callbacks.onEnterPhotoMode());

  options.sliderSteppers.set(
    optSfxSlider.button,
    wireSlider(optSfxSlider.button, optSfxSlider.value, () => (next) => {
      options.onMirrorAudioLevel(next);
      callbacks.onSetAudioLevel(next);
    }),
  );
  options.sliderSteppers.set(
    musicSlider.button,
    wireSlider(musicSlider.button, musicSlider.value, () => callbacks.onSetMusicLevel),
  );

  return {
    root: optionsPage,
    soundPage,
    playPage,
    jukebox,
    handlers: bindOptionsCallbacks(callbacks),
    toggleAudio: () => callbacks.onToggleAudio(),
    setAudioLevel: (next) => {
      syncSlider(optSfxSlider.button, optSfxSlider.value, next);
      callbacks.onSetAudioLevel(next);
    },
    stepTrack: (delta) => callbacks.onStepTrack(delta),
    render: (view) => {
      setText(nowPlaying, `♫ ${view.nowPlaying}`);
      jukeboxBrowsing = view.jukebox?.active === true;
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
      const showPhoto = view.canPhoto === true;
      photoBtn.hidden = !showPhoto;
      controlsCard.classList.toggle("has-photo", showPhoto);
    },
  };
}
