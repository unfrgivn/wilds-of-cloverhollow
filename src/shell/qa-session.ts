import { serializeSave, stableHash, type ActionFrame, type State, type World } from "../core";
import {
  createQaBadge,
  createQaConsole,
  createQaError,
  createQaMenu,
  loadQaPacks,
  loadQaSlots,
  qaPackFromUrl,
  runConsoleCommand,
  saveQaSlot,
  type PackState,
  type QaPack,
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
  onConsoleApplied: () => void;
  onReleasePointer: () => void;
  invalidate: () => void;
};

export type QaSession = {
  isMenuOpen: () => boolean;
  isConsoleOpen: () => boolean;
  isActive: () => boolean;
  isBlocked: () => boolean;
  isRestricted: () => boolean;
  packs: () => QaPack[];
  openMenu: () => void;
  shortcuts: () => ShortcutQaControl;
  render: () => void;
  stepQaMenu: (frame: ActionFrame, previousFrame: ActionFrame) => boolean;
  reset: () => void;
};

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
 * Manages the dev/harness-only QA save menu, QA console, pack/slot reloading,
 * badge, and menu input stepping. Dynamically imported only outside production.
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

  const menu = createQaMenu(deps.uiRoot, entries);
  const badge = createQaBadge(deps.uiRoot);
  if (boot.error !== null) createQaError(deps.uiRoot, boot.error);

  const pickQa = (item: PackState): void => {
    const loaded = deps.parseSave(item.save);
    if (loaded === null) throw new Error(`QA save ${item.pack.id} is invalid`);
    deps.setState(loaded);
    activePack = item;
    menuOpen = false;
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

  const openConsole = (): void => {
    if (consoleOpen || activePack === null || deps.getTitleMode() !== null || menuOpen) return;
    consoleOpen = true;
    deps.onReleasePointer();
  };

  const consolePanel = createQaConsole(deps.uiRoot, {
    run: (line) => {
      const outcome = runConsoleCommand(
        {
          story: deps.world.story,
          stickerIds: deps.world.stickers.catalogue.map((sticker) => sticker.id),
          prizeIds: deps.world.arcade.prizes.map((prize) => prize.id),
          treatIds: deps.world.treats.map((treat) => treat.id),
          fishIds: deps.world.arcade.fish.catches.map((item) => item.id),
          thresholds: deps.world.levels.thresholds,
        },
        deps.getState(),
        line,
      );
      if (outcome.kind === "applied") {
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
      return `Saved QA slot "${name}" (tick ${tick}).`;
    },
    saveFile: () => serializeSave(deps.getState()),
    close: () => {
      consoleOpen = false;
      deps.invalidate();
    },
  });

  badge.onOpen(openConsole);
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
    packs: () => boot.packs.map((item) => item.pack),
    openMenu,
    shortcuts: () => ({
      openMenu,
      isConsoleOpen: () => consoleOpen,
      setConsoleOpen: (open) => {
        consoleOpen = open;
      },
      openConsole,
    }),
    render: () => {
      menu.render(menuOpen, selected);
      badge.render(activePack?.pack ?? null);
      consolePanel.render(consoleOpen);
    },
    stepQaMenu,
    reset: () => {
      menuOpen = false;
      activePack = null;
      justPicked = false;
      consoleOpen = false;
    },
  };
}
