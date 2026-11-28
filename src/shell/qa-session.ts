import {
  serializeSave,
  stableHash,
  type ActionFrame,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import {
  createQaBadge,
  createQaConsole,
  createQaError,
  createQaMenu,
  createQaTouchTrigger,
  ensureSandboxPack,
  loadQaPacks,
  loadQaSlots,
  qaPackFromUrl,
  runConsoleCommand,
  saveQaSlot,
  shouldShowQaTouchTrigger,
  type ConsoleContext,
  type PackState,
  type QaConsoleSnapshot,
  type QaPack,
  type QaSettingsSnapshot,
} from "../dev/qa";
import type { ShortcutQaControl } from "./input-shortcuts";
import { qaFlow } from "./qa-flow";
import type { TitleMode } from "./title-flow";

export type QaBoot = {
  packs: PackState[];
  slots: PackState[];
  urlPack: PackState | null;
  error: string | null;
};

export type QaSessionSettingsDeps = {
  gentleTiming: () => boolean;
  toggleGentleTiming: () => void;
  keyHints: () => boolean;
  toggleKeyHints: () => void;
  reducedMotion: () => boolean;
  toggleReducedMotion: () => void;
  muted: () => boolean;
  toggleMute: () => void;
  textSpeed: () => TextSpeed;
  setTextSpeed: (speed: TextSpeed) => void;
  photoMode: () => boolean;
  canPhotoMode: () => boolean;
  setPhotoMode: (on: boolean) => void;
  navOverlay?: () => boolean;
  toggleNavOverlay?: () => void;
};

export type QaSessionDeps = {
  uiRoot: HTMLElement;
  world: World;
  initialReturnMode: TitleMode;
  getState: () => State;
  setState: (state: State) => void;
  parseSave: (raw: string) => State | null;
  getTitleMode: () => TitleMode | null;
  setTitleMode: (mode: TitleMode | null) => void;
  onPickPack: () => void;
  onEnterSandbox: () => void;
  onResetGame: () => void;
  onConsoleApplied: () => void;
  onReleasePointer: () => void;
  invalidate: () => void;
  settings: QaSessionSettingsDeps;
};

export type QaSession = {
  isMenuOpen: () => boolean;
  isConsoleOpen: () => boolean;
  isActive: () => boolean;
  isBlocked: () => boolean;
  isRestricted: () => boolean;
  activePack: () => QaPack | null;
  packs: () => QaPack[];
  openMenu: () => void;
  openConsole: (options?: { source?: "keyboard" | "pointer"; allowFromMenu?: boolean }) => void;
  shortcuts: () => ShortcutQaControl;
  render: () => void;
  stepQaMenu: (frame: ActionFrame, previousFrame: ActionFrame) => boolean;
  reset: () => void;
};

/** Reads the live Settings tab snapshot for the QA console. */
export function readQaSettingsSnapshot(settings: QaSessionSettingsDeps): QaSettingsSnapshot {
  return {
    gentleTiming: settings.gentleTiming(),
    keyHints: settings.keyHints(),
    reducedMotion: settings.reducedMotion(),
    muted: settings.muted(),
    textSpeed: settings.textSpeed(),
    photoMode: settings.photoMode(),
    canPhotoMode: settings.canPhotoMode(),
    navOverlay: settings.navOverlay?.() ?? false,
  };
}

/** Loads QA save packs, console slots, and any `?qa=<id>` boot target. */
export async function loadQaBoot(search: string): Promise<QaBoot> {
  const packs = loadQaPacks();
  const slots = await loadQaSlots();
  let urlPack: PackState | null = null;
  let error: string | null = null;
  try {
    urlPack = qaPackFromUrl(packs, search);
  } catch (caught: unknown) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { packs, slots, urlPack, error };
}

/**
 * Manages the dev/harness-only QA save menu, tabbed QA console, pack/slot
 * reloading, badge, touch trigger, and menu input stepping. Dynamically
 * imported only outside production.
 */
export function createQaSession(boot: QaBoot, deps: QaSessionDeps): QaSession {
  let entries: PackState[] = [...boot.packs, ...boot.slots];
  let menuOpen = false;
  let activePack: PackState | null = boot.urlPack;
  const blocked = boot.error !== null;
  let justPicked = false;
  let selected = 0;
  let returnMode: TitleMode = deps.initialReturnMode;
  let consoleOpen = false;
  let consoleFocusInput = false;

  const consoleContext: ConsoleContext = {
    story: deps.world.story,
    stickerIds: deps.world.stickers.catalogue.map((sticker) => sticker.id),
    prizeIds: deps.world.arcade.prizes.map((prize) => prize.id),
    treatIds: deps.world.treats.map((treat) => treat.id),
    fishIds: deps.world.arcade.fish.catches.map((item) => item.id),
    thresholds: deps.world.levels.thresholds,
  };
  const partyNames: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(deps.world.party).map(([id, member]) => [id, member.name]),
  );

  const menu = createQaMenu(deps.uiRoot, entries);
  const badge = createQaBadge(deps.uiRoot);
  const touchTrigger = createQaTouchTrigger(deps.uiRoot);
  if (boot.error !== null) createQaError(deps.uiRoot, boot.error);

  const snapshot = (): QaConsoleSnapshot => ({
    open: consoleOpen,
    focusInput: consoleFocusInput,
    activePack: activePack?.pack ?? null,
    entries,
    state: deps.getState(),
    context: consoleContext,
    partyNames,
    settings: readQaSettingsSnapshot(deps.settings),
  });

  const pickQa = (item: PackState): void => {
    const loaded = deps.parseSave(item.save);
    if (loaded === null) throw new Error(`QA save ${item.pack.id} is invalid`);
    deps.setState(loaded);
    activePack = item;
    menuOpen = false;
    consoleOpen = false;
    deps.setTitleMode(null);
    justPicked = true;
    deps.onPickPack();
  };

  const openMenu = (): void => {
    const titleMode = deps.getTitleMode();
    if (blocked || entries.length === 0 || titleMode === null) return;
    returnMode = titleMode;
    menuOpen = true;
    deps.onReleasePointer();
  };

  const openConsole = (
    options: { source?: "keyboard" | "pointer"; allowFromMenu?: boolean } = {},
  ): void => {
    if (consoleOpen || blocked) return;
    const allowFromMenu = options.allowFromMenu === true;
    if (!allowFromMenu && (deps.getTitleMode() !== null || menuOpen)) return;
    if (menuOpen) menuOpen = false;
    consoleOpen = true;
    consoleFocusInput = (options.source ?? "keyboard") === "keyboard";
    deps.onReleasePointer();
    deps.invalidate();
  };

  const consolePanel = createQaConsole(deps.uiRoot, {
    getSnapshot: snapshot,
    run: (line) => {
      const outcome = runConsoleCommand(consoleContext, deps.getState(), line);
      if (outcome.kind === "applied") {
        const nextPack = ensureSandboxPack(activePack, deps.getState().tick);
        activePack = nextPack.pack;
        if (nextPack.enteredSandbox) deps.onEnterSandbox();
        if (deps.getTitleMode() !== null) deps.setTitleMode(null);
        deps.setState(outcome.state);
        deps.onConsoleApplied();
      }
      return outcome;
    },
    saveSlot: async (name) => {
      const current = deps.getState();
      const tick = current.tick;
      const hash = stableHash(current);
      await saveQaSlot({ name, tick, hash }, serializeSave(current));
      entries = [...boot.packs, ...(await loadQaSlots())];
      menu.setEntries(entries);
      deps.invalidate();
      return `Saved QA slot "${name}" (tick ${tick}).`;
    },
    saveFile: () => serializeSave(deps.getState()),
    loadPack: pickQa,
    resetGame: () => {
      activePack = null;
      menuOpen = false;
      consoleOpen = false;
      consoleFocusInput = false;
      justPicked = false;
      selected = 0;
      deps.setTitleMode(null);
      deps.onResetGame();
    },
    close: () => {
      consoleOpen = false;
      deps.invalidate();
    },
    toggleGentleTiming: deps.settings.toggleGentleTiming,
    toggleKeyHints: deps.settings.toggleKeyHints,
    toggleReducedMotion: deps.settings.toggleReducedMotion,
    toggleMute: deps.settings.toggleMute,
    setTextSpeed: deps.settings.setTextSpeed,
    togglePhotoMode: () => {
      if (deps.settings.photoMode()) {
        deps.settings.setPhotoMode(false);
      } else if (deps.settings.canPhotoMode()) {
        consoleOpen = false;
        deps.settings.setPhotoMode(true);
      }
      deps.invalidate();
    },
    toggleNavOverlay: () => {
      deps.settings.toggleNavOverlay?.();
      deps.invalidate();
    },
  });

  badge.onOpen(() => openConsole({ source: "pointer" }));
  touchTrigger.onOpen(() => openConsole({ source: "pointer" }));
  menu.onChoose(pickQa);
  menu.onCancel(() => {
    menuOpen = false;
    activePack = null;
    deps.setTitleMode(returnMode);
  });

  const stepQaMenu = (frame: ActionFrame, previousFrame: ActionFrame): boolean => {
    if (justPicked) {
      justPicked = false;
      return true;
    }
    if (menuOpen) {
      const result = qaFlow(entries.length, selected, {
        up: frame.move.y < -0.5 && previousFrame.move.y >= -0.5,
        down: frame.move.y > 0.5 && previousFrame.move.y <= 0.5,
        confirm: frame.confirm && !previousFrame.confirm,
        cancel: frame.cancel && !previousFrame.cancel,
      });
      selected = result.selected;
      if (!result.open) {
        menuOpen = false;
        deps.setTitleMode(returnMode);
        activePack = null;
      }
      if (result.action !== null) {
        const chosen = entries[result.action];
        if (chosen === undefined) throw new Error("QA selection disappeared");
        pickQa(chosen);
      }
      return true;
    }
    return consoleOpen || blocked;
  };

  return {
    isMenuOpen: () => menuOpen,
    isConsoleOpen: () => consoleOpen,
    isActive: () => activePack !== null,
    isBlocked: () => blocked,
    isRestricted: () => activePack !== null || blocked,
    activePack: () => activePack?.pack ?? null,
    packs: () => boot.packs.map((item) => item.pack),
    openMenu,
    openConsole,
    shortcuts: () => ({
      openMenu,
      isConsoleOpen: () => consoleOpen,
      setConsoleOpen: (open) => {
        consoleOpen = open;
      },
      openConsole: (options) => openConsole({
        source: "keyboard",
        allowFromMenu: options?.allowFromMenu === true,
      }),
    }),
    render: () => {
      menu.render(menuOpen, selected);
      badge.render(activePack?.pack ?? null);
      touchTrigger.render(
        shouldShowQaTouchTrigger({
          blocked,
          hasActivePack: activePack !== null,
          menuOpen,
          consoleOpen,
          titleOpen: deps.getTitleMode() !== null,
          photoMode: deps.settings.photoMode(),
        }),
      );
      consolePanel.render(snapshot());
    },
    stepQaMenu,
    reset: () => {
      menuOpen = false;
      activePack = null;
      justPicked = false;
      consoleOpen = false;
      consoleFocusInput = false;
    },
  };
}
