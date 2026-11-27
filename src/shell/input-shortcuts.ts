import type { State } from "../core";
import type { GamepadInput } from "../platform/gamepad";
import type { HudInputMode } from "../ui/hud-hints";
import { computeJournalScrollDelta, type JournalNavDirection } from "../ui/journal-nav";
import type { TitleMode } from "./title-flow";

export type OverlayGateState = Pick<
  State,
  "dialogue" | "battle" | "arcade" | "journalOpen" | "transition" | "finale"
>;

export type OverlayGateContext = {
  state: OverlayGateState;
  titleMode: TitleMode | null;
  qaMenuOpen: boolean;
  qaConsoleOpen: boolean;
  qaBlocked: boolean;
  photoMode: boolean;
};

export type ShortcutKeyTarget = {
  closest?: (selector: string) => unknown;
};

export type ShortcutKeyEvent = {
  code: string;
  repeat: boolean;
  target: EventTarget | ShortcutKeyTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export type ShortcutJournalControl = {
  hasOpenOverlay: () => boolean;
  dismissOverlay: () => boolean;
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
  openConsole: () => void;
};

export type InputShortcutsDeps = {
  getContext: () => OverlayGateContext;
  getBattlePeekOpen: () => boolean;
  setBattlePeek: (open: boolean) => void;
  setPhotoMode: (open: boolean) => void;
  snapPostcard: () => void;
  journal: ShortcutJournalControl;
  gamepad: ShortcutGamepadSource;
  clearKeyboardTaps: () => void;
  swallow: (button: "confirm" | "cancel" | "menu") => void;
  playChoiceMove: () => void;
  invalidate: () => void;
  onToggleMute?: () => void;
  qa?: ShortcutQaControl;
};

export type InputShortcutsController = {
  inputMode: () => HudInputMode;
  resetInputMode: () => void;
  handleKeydown: (event: ShortcutKeyEvent) => void;
  handleQaKeydown: (event: ShortcutKeyEvent) => void;
  handleCancelEdge: (cancelSwallowed: boolean) => "none" | "swallow" | "consume-tick";
  pollGamepad: () => void;
  bind: (
    target?: {
      addEventListener: (
        type: "keydown",
        listener: (event: ShortcutKeyEvent) => void,
      ) => void;
    },
  ) => void;
};

/** Returns true when Photo Mode can be entered or kept open in the overworld. */
export function canPhotoMode(ctx: Omit<OverlayGateContext, "photoMode">): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    !ctx.state.journalOpen &&
    ctx.state.finale === null
  );
}

/** Returns true when the Battle Field Guide Peek card may toggle during battle command phase. */
export function canBattlePeek(ctx: Omit<OverlayGateContext, "photoMode">): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
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
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    !ctx.state.journalOpen &&
    ctx.state.transition === null &&
    ctx.state.finale === null
  );
}

/** Returns true when journal keyboard/gamepad navigation and page-flip shortcuts are active. */
export function isJournalShortcutActive(
  ctx: Pick<OverlayGateContext, "state" | "titleMode" | "qaMenuOpen" | "qaConsoleOpen">,
): boolean {
  return (
    ctx.state.journalOpen &&
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen
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
    ctx.state.dialogue === null &&
    ctx.state.battle === null &&
    ctx.state.arcade === null &&
    !ctx.state.journalOpen &&
    ctx.state.finale !== "credits" &&
    !hasLevelUpNotice
  );
}

/** Returns true when area-arrival banners may be displayed over the viewport. */
export function isBannerEligible(
  ctx: Pick<OverlayGateContext, "titleMode" | "qaMenuOpen" | "qaConsoleOpen" | "qaBlocked">,
  hasLevelUpNotice: boolean,
): boolean {
  return (
    ctx.titleMode === null &&
    !ctx.qaMenuOpen &&
    !ctx.qaConsoleOpen &&
    !ctx.qaBlocked &&
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

  const handleKeydown = (event: ShortcutKeyEvent): void => {
    if (matchesClosest(event.target, "input, textarea")) return;
    if (lastInputMode !== "keyboard") {
      lastInputMode = "keyboard";
      deps.invalidate();
    }
    const ctx = deps.getContext();
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
    if (journalActive) {
      if (event.code === "BracketLeft" || event.code === "PageUp") {
        event.preventDefault();
        deps.journal.stepPage(-1);
        deps.playChoiceMove();
        deps.invalidate();
        return;
      }
      if (event.code === "BracketRight" || event.code === "PageDown") {
        event.preventDefault();
        deps.journal.stepPage(1);
        deps.playChoiceMove();
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
    if (event.code === "KeyP") {
      if (!canPhotoMode(ctx)) return;
      event.preventDefault();
      deps.setPhotoMode(!ctx.photoMode);
      return;
    }
    if (
      (event.code === "Enter" || event.code === "Space") &&
      ctx.photoMode &&
      canPhotoMode(ctx)
    ) {
      event.preventDefault();
      deps.swallow("confirm");
      deps.clearKeyboardTaps();
      deps.snapPostcard();
      return;
    }
    if (event.code === "Escape" && ctx.photoMode) {
      event.preventDefault();
      deps.setPhotoMode(false);
    }
  };

  const handleQaKeydown = (event: ShortcutKeyEvent): void => {
    const qa = deps.qa;
    if (qa === undefined) return;
    if (event.code === "KeyQ") {
      if (matchesClosest(event.target, "input, textarea")) return;
      event.preventDefault();
      qa.openMenu();
      return;
    }
    if (event.code === "Backquote") {
      event.preventDefault();
      if (qa.isConsoleOpen()) qa.setConsoleOpen(false);
      else qa.openConsole();
      deps.invalidate();
      return;
    }
    if (event.code === "Escape" && qa.isConsoleOpen()) {
      event.preventDefault();
      qa.setConsoleOpen(false);
      deps.invalidate();
    }
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
    const journalActive = isJournalShortcutActive(ctx);
    if (bumperStep !== 0 && journalActive) {
      deps.journal.stepPage(bumperStep);
      deps.playChoiceMove();
      deps.invalidate();
    }
    if (journalActive && !deps.journal.hasOpenOverlay()) {
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
    const ctx = deps.getContext();
    if (ctx.state.journalOpen && deps.journal.hasOpenOverlay()) {
      deps.journal.dismissOverlay();
      deps.swallow("cancel");
      deps.playChoiceMove();
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
      if (deps.qa !== undefined) target.addEventListener("keydown", handleQaKeydown);
      return;
    }
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", handleKeydown);
    if (deps.qa !== undefined) window.addEventListener("keydown", handleQaKeydown);
  };

  return {
    inputMode: () => lastInputMode,
    resetInputMode: () => {
      lastInputMode = "keyboard";
    },
    handleKeydown,
    handleQaKeydown,
    handleCancelEdge,
    pollGamepad,
    bind,
  };
}
