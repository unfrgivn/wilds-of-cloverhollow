import { Rectangle, type Application } from "pixi.js";
import type { JukeboxTrack, Point, State, TextSpeed, World } from "../core";
import type { AudioController } from "../platform/audio";
import type { AudioLevel } from "../platform/audio-settings";
import type { GameSettingsController } from "../platform/game-settings";
import type { TouchInput } from "../platform/touch";
import type { HudHintAction } from "../ui/hud-hints";
import type { JournalControl } from "../ui/journal";
import { postcardToastMessage, type PostcardCapture } from "../ui/postcard";
import { deliverAreaPostcard, stepJukeboxTrack } from "./feedback";
import { bindWebGlRecovery } from "./lifecycle";

export type ShellToggleFactory = (
  toggle: () => void,
  isOn: () => boolean,
) => () => void;

export type ShellUiTargets = {
  journal: JournalControl;
  touch: TouchInput;
  battleCheck: {
    onConfirmHold: (handler: (held: boolean) => void) => void;
    onDirectionHold: (handler: (dir: Point) => void) => void;
    onEchoNote: (handler: (note: number) => void) => void;
  };
  dialogueBox: {
    onChoose: (handler: (index: number) => void) => void;
    onAdvance: (handler: () => void) => void;
  };
  prompt: { onActivate: (handler: () => void) => void };
  commandMenu: { onChoose: (handler: (index: number) => void) => void };
  rewardSticker: { onConfirm: (handler: () => void) => void };
  battleHud: {
    onTogether: (handler: () => void) => void;
    onFlute: (handler: () => void) => void;
    onLasso: (handler: () => void) => void;
    onPeekToggle: (handler: () => void) => void;
    onPeekClose: (handler: () => void) => void;
  };
  credits: { onClose: (handler: () => void) => void };
  hudHints: { onAction: (handler: (action: HudHintAction) => void) => void };
};

export type ShellUiBindingDeps = {
  world: World;
  ui: ShellUiTargets;
  sound: AudioController;
  gameSettings: GameSettingsController;
  getState: () => State;
  getJukeboxTrack: () => JukeboxTrack | null;
  setJukeboxTrack: (track: JukeboxTrack | null) => void;
  isTitleOrQaOpen: () => boolean;
  canPhotoMode: () => boolean;
  setPhotoMode: (on: boolean) => void;
  canBattlePeek: () => boolean;
  getBattlePeekOpen: () => boolean;
  setBattlePeek: (on: boolean) => void;
  lightHaptic: () => void;
  playToggleFeedback: (on: boolean) => void;
  bindToggle: ShellToggleFactory;
  invalidate: () => void;
  onConfirmHold: (held: boolean) => void;
};

const ECHO_ARROWS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Binds journal audio/settings/atlas callbacks, battle inputs, and touch-tap UI actions. */
export function bindShellUiControls(deps: ShellUiBindingDeps): void {
  const { ui, sound, gameSettings, invalidate, lightHaptic, playToggleFeedback, bindToggle } = deps;
  const withInvalidate = <Args extends unknown[]>(
    fn: (...args: Args) => void,
  ): ((...args: Args) => void) => (...args: Args): void => {
    fn(...args);
    invalidate();
  };

  ui.battleCheck.onConfirmHold(deps.onConfirmHold);
  ui.battleCheck.onDirectionHold((dir) => {
    ui.touch.setPointerArrow(dir.x === 0 && dir.y === 0 ? null : dir);
  });
  ui.battleCheck.onEchoNote((note) => {
    const direction = ECHO_ARROWS[note];
    if (direction !== undefined) ui.touch.tapArrow(direction);
  });

  const playPageTurn = (): void => {
    sound.playEffect("page-turn");
    lightHaptic();
  };
  ui.journal.onPageChange(playPageTurn);
  ui.journal.onMapSelect((on) => {
    sound.playEffect(on ? "atlas-pin" : "sticker-peel");
    lightHaptic();
  });
  ui.journal.onMapFilter(() => {
    sound.playEffect("paper-flip");
    lightHaptic();
  });
  ui.journal.onOverlayStep(playPageTurn);
  ui.journal.onOverlayChange((open) => {
    sound.playEffect(open ? "card-open" : "card-close");
    if (open) lightHaptic();
  });
  ui.journal.onWeatherSelect((mode) => {
    sound.playEffect(mode === "clear" ? "toggle-off" : "tool-sparkle");
    lightHaptic();
  });
  ui.journal.onToggleAudio(withInvalidate(() => {
    sound.toggle();
    if (!sound.muted()) playToggleFeedback(true);
  }));
  ui.journal.onSetAudioLevel(withInvalidate((level: AudioLevel) => sound.setLevel(level)));
  ui.journal.onToggleMusic(bindToggle(sound.toggleMusic, () => !sound.musicMuted()));
  ui.journal.onSetMusicLevel(withInvalidate((level: AudioLevel) => sound.setMusicLevel(level)));
  ui.journal.onToggleAmbience(bindToggle(sound.toggleAmbience, () => !sound.ambienceMuted()));
  ui.journal.onStepTrack((delta) => {
    const current = deps.getState();
    if (!current.journalOpen) return;
    const nextTrack = stepJukeboxTrack(
      deps.world, current, deps.getJukeboxTrack(), delta, deps.isTitleOrQaOpen(),
    );
    if (nextTrack === null) return;
    deps.setJukeboxTrack(nextTrack);
    invalidate();
  });
  ui.journal.onResetJukebox(() => {
    if (deps.getJukeboxTrack() === null) return;
    deps.setJukeboxTrack(null);
    invalidate();
  });
  ui.journal.onToggleGentleTiming(
    bindToggle(gameSettings.toggleGentleTiming, gameSettings.gentleTiming),
  );
  ui.journal.onToggleKeyHints(bindToggle(gameSettings.toggleKeyHints, gameSettings.keyHints));
  ui.journal.onCycleTextSpeed(
    bindToggle(gameSettings.cycleTextSpeed, () => gameSettings.textSpeed() !== "cozy"),
  );
  ui.journal.onToggleReducedMotion(
    bindToggle(gameSettings.toggleReducedMotion, gameSettings.reducedMotion),
  );

  ui.dialogueBox.onChoose((index) => ui.touch.tapChoice(index));
  ui.dialogueBox.onAdvance(() => ui.touch.tapButton("confirm"));
  ui.prompt.onActivate(() => ui.touch.tapButton("confirm"));
  ui.commandMenu.onChoose((index) => ui.touch.tapChoice(index));
  ui.rewardSticker.onConfirm(() => ui.touch.tapButton("confirm"));
  ui.battleHud.onTogether(() => ui.touch.tapButton("cancel"));
  ui.battleHud.onFlute(() => ui.touch.tapButton("flute"));
  ui.battleHud.onLasso(() => ui.touch.tapButton("lasso"));
  ui.battleHud.onPeekToggle(() => deps.setBattlePeek(!deps.getBattlePeekOpen()));
  ui.battleHud.onPeekClose(() => deps.setBattlePeek(false));
  ui.journal.onClose(() => ui.touch.tapButton("cancel"));
  ui.credits.onClose(() => ui.touch.tapButton("confirm"));

  ui.hudHints.onAction((action) => {
    if (action === "interact") ui.touch.tapButton("confirm");
    else if (action === "journal") ui.touch.tapButton("menu");
    else if (action === "lantern") ui.touch.tapButton("lantern");
    else if (action === "flute") ui.touch.tapButton("flute");
    else if (action === "photo" && deps.canPhotoMode()) deps.setPhotoMode(true);
    else if (action === "mute") {
      sound.toggle();
      invalidate();
    } else if (action === "battle-guide" && deps.canBattlePeek()) {
      deps.setBattlePeek(!deps.getBattlePeekOpen());
    }
  });
}

/** Builds the QA console settings adapter wired to sound, accessibility, photo, and nav toggles. */
export function createQaSettingsBindings(deps: {
  gameSettings: GameSettingsController;
  sound: AudioController;
  bindToggle: ShellToggleFactory;
  playToggleFeedback: (on: boolean) => void;
  invalidate: () => void;
  photoMode: () => boolean;
  canPhotoMode: () => boolean;
  setPhotoMode: (on: boolean) => void;
  isNavOverlayVisible: () => boolean;
  setNavOverlayVisible: (on: boolean) => boolean;
}) {
  const { gameSettings, sound, bindToggle, playToggleFeedback, invalidate } = deps;
  const withInvalidate = <Args extends unknown[]>(
    fn: (...args: Args) => void,
  ): ((...args: Args) => void) => (...args: Args): void => {
    fn(...args);
    invalidate();
  };
  return {
    gentleTiming: gameSettings.gentleTiming,
    toggleGentleTiming: bindToggle(gameSettings.toggleGentleTiming, gameSettings.gentleTiming),
    keyHints: gameSettings.keyHints,
    toggleKeyHints: bindToggle(gameSettings.toggleKeyHints, gameSettings.keyHints),
    reducedMotion: gameSettings.reducedMotion,
    toggleReducedMotion: bindToggle(gameSettings.toggleReducedMotion, gameSettings.reducedMotion),
    muted: sound.muted,
    toggleMute: withInvalidate(() => {
      sound.toggle();
      if (!sound.muted()) playToggleFeedback(true);
    }),
    textSpeed: gameSettings.textSpeed,
    setTextSpeed: withInvalidate((speed: TextSpeed) => {
      gameSettings.setTextSpeed(speed);
      playToggleFeedback(speed !== "cozy");
    }),
    photoMode: deps.photoMode,
    canPhotoMode: deps.canPhotoMode,
    setPhotoMode: deps.setPhotoMode,
    navOverlay: deps.isNavOverlayVisible,
    toggleNavOverlay: (): void => {
      const next = deps.setNavOverlayVisible(!deps.isNavOverlayVisible());
      playToggleFeedback(next);
      invalidate();
    },
  };
}

/** Captures a framed watercolor postcard from the Pixi stage and delivers it. */
export function createPostcardSnapper(deps: {
  app: Application;
  world: World;
  getState: () => State;
  isPhotoMode: () => boolean;
  canPhotoMode: () => boolean;
  sound: AudioController;
  lightHaptic: () => void;
  shutterFlash: { trigger: () => void };
  photoToast: { show: (message: string) => void };
  renderNow: () => void;
}): (options?: { download?: boolean }) => Promise<PostcardCapture | null> {
  return async (options) => {
    if (!deps.isPhotoMode() || !deps.canPhotoMode()) return null;
    deps.sound.playEffect("camera-shutter");
    deps.shutterFlash.trigger();
    deps.lightHaptic();
    deps.renderNow();
    deps.app.render();
    const extracted = deps.app.renderer.extract.canvas({
      target: deps.app.stage,
      frame: new Rectangle(0, 0, deps.app.screen.width, deps.app.screen.height),
      resolution: deps.app.renderer.resolution,
      clearColor: 0xf8edcf,
    });
    const sourceCanvas = extracted instanceof HTMLCanvasElement ? extracted : deps.app.canvas;
    return deliverAreaPostcard(deps.world, deps.getState(), sourceCanvas, {
      download: options?.download !== false,
      preferShare: document.documentElement.dataset.touch === "on",
      onDelivered: (capture, delivery) => {
        if (deps.isPhotoMode()) {
          deps.photoToast.show(postcardToastMessage(delivery, capture.caption));
        }
      },
    });
  };
}

/** Wires window invalidation, WebGL context recovery, visibility, and pagehide listeners. */
export function bindShellLifecycle(deps: {
  canvas: HTMLCanvasElement;
  invalidate: () => void;
  onSuspend: () => void;
  onResume: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  onPageHide: () => void;
}): void {
  for (const type of ["resize", "pointerdown", "pointerup"]) {
    window.addEventListener(type, deps.invalidate);
  }
  bindWebGlRecovery(deps.canvas, {
    onLost: deps.onContextLost,
    onRestored: deps.onContextRestored,
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) deps.onSuspend();
    else deps.onResume();
  });
  window.addEventListener("pagehide", deps.onPageHide);
}

export type OpenFlagName =
  | "arcade" | "qaConsole" | "title" | "credits" | "battle" | "talk" | "journal" | "cutscene";

/** Sets or clears a `data-<name>="open"` flag on `document.documentElement`. */
export function syncOpenFlag(name: OpenFlagName, open: boolean): void {
  if (open) document.documentElement.dataset[name] = "open";
  else delete document.documentElement.dataset[name];
}

/** Keeps the window title updated only when its formatted string changes. */
export function createDocumentTitleSync(initial: string): (next: string) => void {
  let last = initial;
  return (next) => {
    if (next === last) return;
    last = next;
    document.title = next;
  };
}
