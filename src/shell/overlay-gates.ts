import type { State } from "../core";
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

/** Returns true when an event target implements `closest` and matches `selector`. */
export function matchesClosest(
  target: ShortcutKeyEvent["target"],
  selector: string,
): boolean {
  if (target === null || typeof target !== "object") return false;
  if ("closest" in target && typeof target.closest === "function") {
    return target.closest(selector) !== null;
  }
  return false;
}
