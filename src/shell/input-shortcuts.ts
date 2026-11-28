import type { State } from "../core";
import type { GamepadInput } from "../platform/gamepad";
import type { HudInputMode } from "../ui/hud-hints";
import { computeJournalScrollDelta, type JournalNavDirection } from "../ui/journal-nav";
import type { TitleMode } from "./title-flow";

export type OverlayGateState = Pick<
  State,
  "dialogue" | "battle" | "arcade" | "journalOpen" | "transition" | "finale" | "cutscene"
> & { area?: string };

export type OverlayGateContext = {
  state: OverlayGateState;
  titleMode: TitleMode | null;
  qaMenuOpen: boolean;
  qaConsoleOpen: boolean;
  qaBlocked: boolean;
  photoMode: boolean;
  shrineOpen?: boolean;
  decorPickerOpen?: boolean;
  loading?: boolean;
};

export type ShortcutKeyTarget = {
  closest?: (selector: string) => unknown;
};

export const QA_HOLD_MS = 500;

export type ShortcutKeyEvent = {
  code: string;
  repeat: boolean;
  shiftKey?: boolean;
  timeStamp?: number;
  target: EventTarget | ShortcutKeyTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export type ShortcutTimer = {
  now: () => number;
  set: (callback: () => void, ms: number) => ReturnType<typeof globalThis.setTimeout>;
  clear: (handle: ReturnType<typeof globalThis.setTimeout>) => void;
};

export type ShortcutJournalControl = {
  hasOpenOverlay: () => boolean;
  dismissOverlay: () => boolean;
  stepOverlay: (delta: -1 | 1) => boolean;
  navigateOverlay?: (direction: JournalNavDirection) => boolean;
  activateOverlay?: () => boolean;
  scrollOverlay?: (deltaY: number) => boolean;
  stepPage: (delta: -1 | 1) => void;
  scrollActivePage: (deltaY: number) => boolean;
  navigateFocus: (direction: JournalNavDirection) => boolean;
  activateFocused: () => boolean;
};

export type ShortcutGamepadSource = Pick<
  GamepadInput,
  | "poll"
  | "consumeActivity"
  | "consumePhotoAction"
  | "consumeBumperStep"
  | "consumeNavStep"
  | "consumeConfirmEdge"
  | "rightStickY"
  | "clearTaps"
>;

export type ShortcutQaControl = {
  openMenu: () => void;
  isConsoleOpen: () => boolean;
  setConsoleOpen: (open: boolean) => void;
  openConsole: (options?: { allowFromMenu?: boolean }) => void;
};

export type ShortcutEncoreControl = {
  isOpen: () => boolean;
  close: () => void;
  stepNav: (dx: number, dy: number) => void;
  cycleModifier: (delta: -1 | 1) => void;
  activateLaunch: () => void;
  handleKeydown: (event: ShortcutKeyEvent) => boolean;
};

export type ShortcutDecorControl = {
  isOpen: () => boolean;
  openForArea: (area: string) => boolean;
  close: () => void;
  stepFocus?: (delta: -1 | 1) => void;
  activateFocused?: () => void;
  handleKeydown: (event: ShortcutKeyEvent) => boolean;
};

export type InputShortcutsDeps = {
  getContext: () => OverlayGateContext;
  getBattlePeekOpen: () => boolean;
  setBattlePeek: (open: boolean) => void;
  setPhotoMode: (open: boolean) => void;
  snapPostcard: () => void;
  onCyclePhotoWeather?: (delta?: -1 | 1) => void;
  journal: ShortcutJournalControl;
  encoreShrine?: ShortcutEncoreControl;
  gamepad: ShortcutGamepadSource;
  clearKeyboardTaps: () => void;
  swallow: (button: "confirm" | "cancel" | "menu") => void;
  playChoiceMove: () => void;
  invalidate: () => void;
  decorPicker?: ShortcutDecorControl;
  onToggleMute?: () => void;
  qa?: ShortcutQaControl;
  qaTimer?: ShortcutTimer;
};

export type ShortcutBindTarget = {
  addEventListener: {
    (type: "keydown" | "keyup", listener: (event: ShortcutKeyEvent) => void): void;
    (type: "blur", listener: () => void): void;
  };
};

export type InputShortcutsController = {
  inputMode: () => HudInputMode;
  resetInputMode: () => void;
  handleKeydown: (event: ShortcutKeyEvent) => void;
  handleQaKeydown: (event: ShortcutKeyEvent) => void;
  handleQaKeyup: (event: ShortcutKeyEvent) => void;
  handleQaBlur: () => void;
  handleCancelEdge: (cancelSwallowed: boolean) => "none" | "swallow" | "consume-tick";
  pollGamepad: () => void;
  bind: (target?: ShortcutBindTarget) => void;
};

export type PhotoKeyAction = "toggle" | "snap" | "weather" | "exit";

/** Maps a keyboard event code to its Photo Mode shortcut action, if any. */
export function photoKeyAction(code: string): PhotoKeyAction | null {
  if (code === "KeyP") return "toggle";
  if (code === "Enter" || code === "Space") return "snap";
  if (code === "KeyW") return "weather";
  if (code === "Escape") return "exit";
  return null;
}

/** Returns true when Photo Mode can be entered or kept open in the overworld. */
export function canPhotoMode(ctx: Omit<OverlayGateContext, "photoMode">): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    ctx.shrineOpen !== true &&
    ctx.decorPickerOpen !== true &&
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    !ctx.state.journalOpen &&
    ctx.state.finale === null &&
    ctx.state.cutscene === undefined
  );
}

/** Returns true when Photo Mode can be launched from Journal OPTIONS in the free overworld. */
export function canPhotoFromJournal(ctx: Omit<OverlayGateContext, "photoMode">): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    ctx.shrineOpen !== true &&
    ctx.decorPickerOpen !== true &&
    ctx.loading !== true &&
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    ctx.state.transition === null &&
    ctx.state.finale === null &&
    ctx.state.cutscene === undefined
  );
}

/** Returns true when the Battle Field Guide Peek card may toggle during battle command phase. */
export function canBattlePeek(ctx: Omit<OverlayGateContext, "photoMode">): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    ctx.shrineOpen !== true &&
    !ctx.state.journalOpen &&
    ctx.state.battle !== null &&
    ctx.state.battle.phase === "command" &&
    (ctx.state.battle.talk === undefined || ctx.state.battle.talk === null)
  );
}

/** Returns true when desktop mouse/pen press-and-hold overworld steering is permitted. */
export function canOverworldSteer(ctx: OverlayGateContext): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    !ctx.photoMode &&
    ctx.shrineOpen !== true &&
    ctx.decorPickerOpen !== true &&
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    !ctx.state.journalOpen &&
    ctx.state.transition === null &&
    ctx.state.finale === null &&
    ctx.state.cutscene === undefined
  );
}

/** Returns true when journal keyboard/gamepad navigation and page-flip shortcuts are active. */
export function isJournalShortcutActive(
  ctx: Pick<
    OverlayGateContext,
    "state" | "titleMode" | "qaMenuOpen" | "qaConsoleOpen" | "shrineOpen" | "decorPickerOpen"
  >,
): boolean {
  return (
    ctx.state.journalOpen &&
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    ctx.shrineOpen !== true &&
    ctx.decorPickerOpen !== true
  );
}

/** Returns true when the overworld HUD hints ribbon can treat Fae as free-roaming. */
export function isOverworldFree(
  ctx: Omit<OverlayGateContext, "photoMode">,
  hasLevelUpNotice: boolean,
): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    ctx.shrineOpen !== true &&
    ctx.decorPickerOpen !== true &&
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    !ctx.state.journalOpen &&
    ctx.state.finale !== "credits" &&
    ctx.state.cutscene === undefined &&
    !hasLevelUpNotice
  );
}

/** Returns true when area-arrival banners may be displayed over the viewport. */
export function isBannerEligible(
  ctx: Pick<
    OverlayGateContext,
    "titleMode" | "qaMenuOpen" | "qaConsoleOpen" | "qaBlocked" | "shrineOpen"
  >,
  hasLevelUpNotice: boolean,
): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    ctx.shrineOpen !== true &&
    !hasLevelUpNotice
  );
}

function matchesClosest(
  target: ShortcutKeyEvent["target"],
  selector: string,
): boolean {
  if (target === null) return false;
  if (typeof HTMLElement !== "undefined") {
    return target instanceof HTMLElement && target.closest(selector) !== null;
  }
  if (
    typeof target === "object" &&
    "closest" in target &&
    typeof target.closest === "function"
  ) {
    return target.closest(selector) !== null;
  }
  return false;
}

/**
 * Orchestrates shell keyboard shortcuts, optional QA shortcuts, and per-frame
 * gamepad overlay/journal shortcuts alongside active keyboard/gamepad HUD mode.
 */
export function createInputShortcuts(
  deps: InputShortcutsDeps,
): InputShortcutsController {
  let lastInputMode: HudInputMode = "keyboard";
  const timer: ShortcutTimer = deps.qaTimer ?? {
    now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
    set: (callback, ms) => globalThis.setTimeout(callback, ms),
    clear: (handle) => globalThis.clearTimeout(handle),
  };
  let qHold: { startedAt: number; handle: ReturnType<typeof globalThis.setTimeout> } | null = null;
  const cancelQHold = (): void => {
    if (qHold !== null) {
      timer.clear(qHold.handle);
      qHold = null;
    }
  };

  const handleKeydown = (event: ShortcutKeyEvent): void => {
    if (matchesClosest(event.target, "input, textarea")) return;
    if (lastInputMode !== "keyboard") {
      lastInputMode = "keyboard";
      deps.invalidate();
    }
    const ctx = deps.getContext();
    if (deps.encoreShrine?.isOpen() === true) {
      if (!event.repeat && deps.encoreShrine.handleKeydown(event)) {
        deps.clearKeyboardTaps();
        deps.invalidate();
      }
      return;
    }
    if (deps.decorPicker?.isOpen() === true) {
      if (deps.decorPicker.handleKeydown(event)) {
        if (!deps.decorPicker.isOpen()) {
          deps.swallow("confirm");
          deps.swallow("cancel");
        }
        deps.clearKeyboardTaps();
        deps.invalidate();
      }
      return;
    }
    const journalActive = isJournalShortcutActive(ctx);
    if (journalActive && !deps.journal.hasOpenOverlay()) {
      const inSlider = matchesClosest(
        event.target,
        ".journal-opt-slider, .journal-volume-slider",
      );
      if ((event.code === "ArrowUp" || event.code === "ArrowDown") && !inSlider) {
        if (deps.journal.navigateFocus(event.code === "ArrowUp" ? "up" : "down")) {
          event.preventDefault();
          deps.invalidate();
        }
        return;
      }
      if (
        !event.repeat &&
        (event.code === "ArrowLeft" || event.code === "ArrowRight") &&
        !inSlider &&
        !matchesClosest(event.target, ".journal-jukebox") &&
        matchesClosest(event.target, ".journal-map-page, .journal-slot.is-inspectable")
      ) {
        if (deps.journal.navigateFocus(event.code === "ArrowLeft" ? "left" : "right")) {
          event.preventDefault();
          deps.invalidate();
        }
        return;
      }
    }
    if (event.repeat) return;
    if (journalActive && !deps.journal.hasOpenOverlay()) {
      if (event.code === "BracketLeft" || event.code === "PageUp") {
        event.preventDefault();
        deps.journal.stepPage(-1);
        deps.invalidate();
        return;
      }
      if (event.code === "BracketRight" || event.code === "PageDown") {
        event.preventDefault();
        deps.journal.stepPage(1);
        deps.invalidate();
        return;
      }
    }
    if (event.code === "KeyM" && deps.onToggleMute !== undefined) {
      event.preventDefault();
      deps.onToggleMute();
      deps.invalidate();
      return;
    }
    if (
      event.code === "KeyB" &&
      deps.decorPicker !== undefined &&
      isOverworldFree(ctx, false) &&
      !ctx.photoMode &&
      ctx.state.transition === null &&
      ctx.state.area !== undefined &&
      deps.decorPicker.openForArea(ctx.state.area)
    ) {
      event.preventDefault();
      deps.clearKeyboardTaps();
      deps.invalidate();
      return;
    }
    if (event.code === "KeyI" && canBattlePeek(ctx)) {
      event.preventDefault();
      deps.setBattlePeek(!deps.getBattlePeekOpen());
      return;
    }
    if (event.code === "Escape" && deps.getBattlePeekOpen()) {
      event.preventDefault();
      event.stopPropagation();
      deps.setBattlePeek(false);
      deps.swallow("cancel");
      deps.clearKeyboardTaps();
      return;
    }
    const photoAction = photoKeyAction(event.code);
    if (photoAction === "toggle") {
      if (!canPhotoMode(ctx)) return;
      event.preventDefault();
      deps.setPhotoMode(!ctx.photoMode);
      return;
    }
    if (photoAction === "snap" && ctx.photoMode && canPhotoMode(ctx)) {
      event.preventDefault();
      deps.swallow("confirm");
      deps.clearKeyboardTaps();
      deps.snapPostcard();
      return;
    }
    if (photoAction === "weather" && ctx.photoMode && canPhotoMode(ctx)) {
      event.preventDefault();
      deps.clearKeyboardTaps();
      deps.onCyclePhotoWeather?.(event.shiftKey === true ? -1 : 1);
      return;
    }
    if (photoAction === "exit" && ctx.photoMode) {
      event.preventDefault();
      deps.setPhotoMode(false);
    }
  };

  const handleQaKeydown = (event: ShortcutKeyEvent): void => {
    const qa = deps.qa;
    if (qa === undefined) return;
    if (event.code === "KeyQ") {
      if (matchesClosest(event.target, "input, textarea")) return;
      if (qa.isConsoleOpen()) return;
      event.preventDefault();
      if (event.repeat) return;
      qa.openMenu();
      cancelQHold();
      const startedAt = event.timeStamp ?? timer.now();
      const handle = timer.set(() => {
        qHold = null;
        if (qa.isConsoleOpen()) return;
        qa.openConsole({ allowFromMenu: true });
        deps.invalidate();
      }, QA_HOLD_MS);
      qHold = { startedAt, handle };
      return;
    }
    if (event.code === "Backquote") {
      cancelQHold();
      event.preventDefault();
      if (qa.isConsoleOpen()) qa.setConsoleOpen(false);
      else qa.openConsole();
      deps.invalidate();
      return;
    }
    if (event.code === "Escape" && qa.isConsoleOpen()) {
      cancelQHold();
      event.preventDefault();
      qa.setConsoleOpen(false);
      deps.invalidate();
    }
  };

  const handleQaKeyup = (event: ShortcutKeyEvent): void => {
    const qa = deps.qa;
    if (qa === undefined || event.code !== "KeyQ" || qHold === null) return;
    const elapsed = (event.timeStamp ?? timer.now()) - qHold.startedAt;
    cancelQHold();
    if (elapsed >= QA_HOLD_MS && !qa.isConsoleOpen()) {
      qa.openConsole({ allowFromMenu: true });
      deps.invalidate();
    }
  };

  const handleQaBlur = (): void => {
    cancelQHold();
  };

  const pollGamepad = (): void => {
    deps.gamepad.poll();
    if (deps.gamepad.consumeActivity() && lastInputMode !== "gamepad") {
      lastInputMode = "gamepad";
      deps.invalidate();
    }
    const ctx = deps.getContext();
    const photoAction = deps.gamepad.consumePhotoAction();
    if (photoAction === "toggle") {
      if (canBattlePeek(ctx)) {
        deps.setBattlePeek(!deps.getBattlePeekOpen());
      } else if (canPhotoMode(ctx) && ctx.state.transition === null) {
        deps.setPhotoMode(!ctx.photoMode);
      }
    } else if (photoAction === "snap" && ctx.photoMode && canPhotoMode(ctx)) {
      deps.swallow("confirm");
      deps.gamepad.clearTaps();
      deps.snapPostcard();
    } else if (photoAction === "exit") {
      if (ctx.photoMode) {
        deps.setPhotoMode(false);
        deps.swallow("cancel");
        deps.gamepad.clearTaps();
      } else if (deps.getBattlePeekOpen()) {
        deps.setBattlePeek(false);
        deps.swallow("cancel");
        deps.gamepad.clearTaps();
      }
    }

    const bumperStep = deps.gamepad.consumeBumperStep();
    const navStep = deps.gamepad.consumeNavStep();
    const journalConfirmEdge = deps.gamepad.consumeConfirmEdge();
    if (ctx.photoMode && canPhotoMode(ctx) && bumperStep !== 0) {
      deps.gamepad.clearTaps();
      deps.onCyclePhotoWeather?.(bumperStep);
      return;
    }
    if (deps.encoreShrine?.isOpen() === true) {
      if (photoAction === "exit") {
        deps.encoreShrine.close();
        deps.swallow("cancel");
        deps.gamepad.clearTaps();
        deps.invalidate();
        return;
      }
      if (bumperStep !== 0) {
        deps.encoreShrine.cycleModifier(bumperStep);
        deps.invalidate();
      }
      if (navStep !== null) {
        const dx = navStep === "left" ? -1 : navStep === "right" ? 1 : 0;
        const dy = navStep === "up" ? -1 : navStep === "down" ? 1 : 0;
        deps.encoreShrine.stepNav(dx, dy);
        deps.invalidate();
      }
      if (journalConfirmEdge) {
        deps.swallow("confirm");
        deps.gamepad.clearTaps();
        deps.encoreShrine.activateLaunch();
        deps.invalidate();
      }
      return;
    }
    if (ctx.decorPickerOpen === true || deps.decorPicker?.isOpen() === true) {
      if (photoAction === "exit") {
        deps.decorPicker?.close();
        deps.swallow("cancel");
        deps.gamepad.clearTaps();
        deps.invalidate();
        return;
      }
      if (navStep !== null) {
        const delta: -1 | 1 = navStep === "left" || navStep === "up" ? -1 : 1;
        deps.decorPicker?.stepFocus?.(delta);
        deps.playChoiceMove();
        deps.invalidate();
      }
      if (journalConfirmEdge) {
        deps.swallow("confirm");
        deps.gamepad.clearTaps();
        deps.decorPicker?.activateFocused?.();
        deps.invalidate();
      }
      return;
    }
    if (bumperStep !== 0 && ctx.photoMode && canPhotoMode(ctx)) {
      deps.gamepad.clearTaps();
      deps.onCyclePhotoWeather?.(bumperStep);
      return;
    }
    const journalActive = isJournalShortcutActive(ctx);
    const overlayOpen = journalActive && deps.journal.hasOpenOverlay();
    if (bumperStep !== 0 && journalActive && !overlayOpen) {
      deps.journal.stepPage(bumperStep);
      deps.invalidate();
    }
    if (overlayOpen) {
      const scrollDelta = computeJournalScrollDelta(deps.gamepad.rightStickY());
      if (scrollDelta !== 0 && deps.journal.scrollOverlay?.(scrollDelta) === true) {
        deps.invalidate();
      }
      if (navStep !== null) {
        if (deps.journal.navigateOverlay !== undefined) {
          if (deps.journal.navigateOverlay(navStep)) {
            deps.playChoiceMove();
            deps.invalidate();
          }
        } else if (
          (navStep === "left" || navStep === "right") &&
          deps.journal.stepOverlay(navStep === "right" ? 1 : -1)
        ) {
          deps.invalidate();
        }
      }
      if (journalConfirmEdge && deps.journal.activateOverlay?.() === true) {
        deps.swallow("confirm");
        deps.gamepad.clearTaps();
        deps.invalidate();
      }
    } else if (journalActive) {
      const scrollDelta = computeJournalScrollDelta(deps.gamepad.rightStickY());
      if (scrollDelta !== 0 && deps.journal.scrollActivePage(scrollDelta)) {
        deps.invalidate();
      }
      if (navStep !== null && deps.journal.navigateFocus(navStep)) {
        deps.playChoiceMove();
        deps.invalidate();
      }
      if (journalConfirmEdge && deps.journal.activateFocused()) {
        deps.playChoiceMove();
        deps.invalidate();
      }
    }
  };

  const handleCancelEdge: InputShortcutsController["handleCancelEdge"] = (cancelSwallowed) => {
    if (cancelSwallowed) return "none";
    if (deps.encoreShrine?.isOpen() === true) {
      deps.encoreShrine.close();
      deps.swallow("cancel");
      deps.invalidate();
      return "consume-tick";
    }
    const ctx = deps.getContext();
    if (deps.decorPicker?.isOpen() === true) {
      deps.decorPicker.close();
      deps.swallow("cancel");
      deps.invalidate();
      return "consume-tick";
    }
    if (ctx.state.journalOpen && deps.journal.hasOpenOverlay()) {
      deps.journal.dismissOverlay();
      deps.swallow("cancel");
      deps.invalidate();
      return "swallow";
    }
    if (
      deps.getBattlePeekOpen() &&
      ctx.titleMode === null &&
      !ctx.qaMenuOpen &&
      !ctx.qaConsoleOpen
    ) {
      deps.setBattlePeek(false);
      deps.swallow("cancel");
      return "consume-tick";
    }
    return "none";
  };

  const bind: InputShortcutsController["bind"] = (target) => {
    if (target !== undefined) {
      target.addEventListener("keydown", handleKeydown);
      if (deps.qa !== undefined) {
        target.addEventListener("keydown", handleQaKeydown);
        target.addEventListener("keyup", handleQaKeyup);
        target.addEventListener("blur", handleQaBlur);
      }
      return;
    }
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", handleKeydown);
    if (deps.qa !== undefined) {
      window.addEventListener("keydown", handleQaKeydown);
      window.addEventListener("keyup", handleQaKeyup);
      window.addEventListener("blur", handleQaBlur);
    }
  };

  return {
    inputMode: () => lastInputMode,
    resetInputMode: () => {
      lastInputMode = "keyboard";
    },
    handleKeydown,
    handleQaKeydown,
    handleQaKeyup,
    handleQaBlur,
    handleCancelEdge,
    pollGamepad,
    bind,
  };
}
