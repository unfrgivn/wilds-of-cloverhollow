import "./decor-picker.css";
import {
  activeClubhouseVisitor,
  eligibleClubhouseVisitors,
  type State,
  type World,
} from "../core";
import type { CompanionAudioEffect } from "../platform/audio-effects";
import type { ShortcutKeyEvent } from "../shell/input-shortcuts";
import {
  buildDecorHeader,
  buildPedestalsSection,
  buildShelfSection,
  buildSwatchesSection,
  buildVisitorsSection,
  el,
  type DecorSectionContext,
} from "./decor-picker-sections";

export type DecorPickerRoom = "clubhouse" | "bedroom";

export type DecorPickerFeedback = "open" | "close" | "equip" | "buy" | "toggle" | "visitor";

export type DecorPickerDeps = {
  world: World;
  getState: () => State;
  applyState: (next: State) => void;
  onFeedback?: (cue: DecorPickerFeedback) => void;
  onClose?: () => void;
};

export type DecorPickerController = {
  open: (room: DecorPickerRoom) => void;
  openForArea: (area: string) => boolean;
  close: (silent?: boolean) => void;
  isOpen: () => boolean;
  render: (canStayOpen?: boolean) => void;
  stepFocus: (delta: -1 | 1) => void;
  activateFocused: () => void;
  handleKeydown: (event: ShortcutKeyEvent) => boolean;
};

/** Maps Decor Picker interactions to warm storybook UI foley effects. */
export function decorFeedbackEffect(cue: DecorPickerFeedback): CompanionAudioEffect {
  if (cue === "open") return "card-open";
  if (cue === "close") return "card-close";
  if (cue === "buy") return "tool-sparkle";
  if (cue === "toggle") return "sticker-peel";
  return "atlas-pin";
}

function renderSignature(world: World, state: State, room: DecorPickerRoom): string {
  const visitor = activeClubhouseVisitor(world, state);
  const eligible = eligibleClubhouseVisitors(world, state);
  const decor = state.decor;
  return [
    room,
    state.coins,
    state.tickets,
    state.prizes.join(","),
    decor?.swatch ?? "classic",
    decor?.unlockedSwatches?.join(",") ?? "",
    decor?.pedestals === true ? "1" : "0",
    decor?.bedroomSlots === undefined ? "auto" : decor.bedroomSlots.join(","),
    decor?.visitorOffset ?? 0,
    visitor?.id ?? "none",
    eligible.length,
  ].join("|");
}

/**
 * Interactive hand-drawn storybook modal for Clubhouse decor swatches,
 * Velvet Plush Pedestals, Bedroom shelf plush curation, and visiting friends.
 */
export function createDecorPicker(
  root: HTMLElement,
  deps: DecorPickerDeps,
): DecorPickerController {
  const backdrop = el("div", "decor-picker-backdrop");
  backdrop.hidden = true;
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "decor-picker-title");

  const modal = el("div", "decor-picker-modal");
  modal.tabIndex = -1;
  const statusEl = el("div", "decor-picker-status");
  statusEl.setAttribute("role", "status");
  statusEl.setAttribute("aria-live", "polite");
  backdrop.append(modal, statusEl);
  root.append(backdrop);

  let activeRoom: DecorPickerRoom | null = null;
  let lastRenderedKey = "";
  let returnFocusEl: HTMLElement | null = null;
  let restoreButtonAfterRender = false;

  const syncDocumentFlag = (open: boolean): void => {
    if (typeof document === "undefined") return;
    if (open) document.documentElement.dataset.decor = "open";
    else delete document.documentElement.dataset.decor;
  };

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  const enabledButtons = (): HTMLButtonElement[] =>
    Array.from(modal.querySelectorAll("button")).filter((btn) => !btn.disabled && !btn.hidden);

  const findFocusedButton = (): HTMLButtonElement | null => {
    if (typeof document === "undefined") return null;
    const active = document.activeElement;
    if (
      active instanceof HTMLButtonElement &&
      modal.contains(active) &&
      !active.disabled &&
      !active.hidden
    ) {
      return active;
    }
    return null;
  };

  const focusButton = (button: HTMLButtonElement): void => {
    button.focus({ preventScroll: true });
    if (typeof button.scrollIntoView === "function") {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const buttonIdentity = (button: HTMLButtonElement): string | null => {
    const d = button.dataset;
    if (d.decorClose !== undefined) return "[data-decor-close]";
    if (d.swatchEquip !== undefined) return `[data-swatch-equip="${d.swatchEquip}"]`;
    if (d.swatchBuyCoins !== undefined) return `[data-swatch-buy-coins="${d.swatchBuyCoins}"]`;
    if (d.swatchBuyTickets !== undefined) {
      return `[data-swatch-buy-tickets="${d.swatchBuyTickets}"]`;
    }
    if (d.pedestalBuyCoins !== undefined) return "[data-pedestal-buy-coins]";
    if (d.pedestalBuyTickets !== undefined) return "[data-pedestal-buy-tickets]";
    if (d.shelfReset !== undefined) return "[data-shelf-reset]";
    if (d.shelfPrize !== undefined) return `[data-shelf-prize="${d.shelfPrize}"]`;
    if (d.cycleVisitor !== undefined) return "[data-cycle-visitor]";
    return null;
  };

  const applyAndRefresh = (next: State, cue: DecorPickerFeedback, message?: string): void => {
    deps.applyState(next);
    deps.onFeedback?.(cue);
    if (message !== undefined) announce(message);
    render(true);
  };

  const close = (silent = false): void => {
    if (activeRoom === null) return;
    const focusTarget = returnFocusEl;
    returnFocusEl = null;
    activeRoom = null;
    lastRenderedKey = "";
    statusEl.textContent = "";
    backdrop.hidden = true;
    delete backdrop.dataset.decorPicker;
    delete backdrop.dataset.decorRoom;
    syncDocumentFlag(false);
    if (!silent) {
      if (focusTarget !== null && focusTarget.isConnected) {
        focusTarget.focus({ preventScroll: true });
      }
      deps.onFeedback?.("close");
      deps.onClose?.();
    }
  };

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  const sectionCtx: DecorSectionContext = {
    world: deps.world,
    getState: deps.getState,
    applyAndRefresh,
  };

  const render = (canStayOpen = true): void => {
    if (activeRoom === null) return;
    const state = deps.getState();
    const validRoom = state.area === "clubhouse" || state.area === "bedroom";
    const clearOfModals =
      canStayOpen &&
      validRoom &&
      state.battle === null &&
      state.dialogue === null &&
      state.arcade === null &&
      !state.journalOpen &&
      state.transition === null &&
      state.finale !== "credits";
    if (!clearOfModals) {
      close(true);
      return;
    }
    const key = renderSignature(deps.world, state, activeRoom);
    if (key === lastRenderedKey) return;
    lastRenderedKey = key;

    const prevFocused = restoreButtonAfterRender ? findFocusedButton() : null;
    const prevIdentity = prevFocused !== null ? buttonIdentity(prevFocused) : null;
    const prevIndex = prevFocused !== null ? enabledButtons().indexOf(prevFocused) : -1;

    const header = buildDecorHeader(state, activeRoom, () => close());
    const body = el("div", "decor-picker-body");
    const swatches = buildSwatchesSection(sectionCtx, state);
    const pedestals = buildPedestalsSection(sectionCtx, state);
    const shelf = buildShelfSection(sectionCtx, state);
    const visitors = buildVisitorsSection(sectionCtx, state, activeRoom);
    if (activeRoom === "bedroom") {
      body.append(shelf, pedestals, swatches);
    } else {
      body.append(swatches, pedestals, shelf);
    }
    if (visitors !== null) body.append(visitors);

    modal.replaceChildren(header, body);

    if (restoreButtonAfterRender) {
      const sameBtn =
        prevIdentity !== null
          ? modal.querySelector<HTMLButtonElement>(prevIdentity)
          : null;
      if (sameBtn !== null && !sameBtn.disabled && !sameBtn.hidden) {
        focusButton(sameBtn);
      } else {
        const nextButtons = enabledButtons();
        const fallback =
          nextButtons.length > 0 && prevIndex >= 0
            ? nextButtons[Math.min(prevIndex, nextButtons.length - 1)]
            : undefined;
        if (fallback !== undefined) focusButton(fallback);
        else modal.focus({ preventScroll: true });
      }
    }
  };

  const open = (room: DecorPickerRoom): void => {
    const wasOpen = activeRoom !== null;
    if (!wasOpen) {
      returnFocusEl =
        typeof document !== "undefined" && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    activeRoom = room;
    lastRenderedKey = "";
    backdrop.hidden = false;
    backdrop.dataset.decorPicker = "open";
    backdrop.dataset.decorRoom = room;
    syncDocumentFlag(true);
    render(true);
    if (!wasOpen) deps.onFeedback?.("open");
    modal.focus({ preventScroll: true });
  };

  const openForArea = (area: string): boolean => {
    if (area !== "clubhouse" && area !== "bedroom") return false;
    open(area);
    return true;
  };

  const stepFocus = (delta: -1 | 1): void => {
    if (activeRoom === null) return;
    const buttons = enabledButtons();
    if (buttons.length === 0) return;
    const active = findFocusedButton();
    const index = active !== null ? buttons.indexOf(active) : -1;
    const nextIndex =
      index < 0
        ? (delta > 0 ? 0 : buttons.length - 1)
        : (index + delta + buttons.length) % buttons.length;
    const target = buttons[nextIndex];
    if (target !== undefined) focusButton(target);
  };

  const focusEdge = (edge: "first" | "last"): void => {
    if (activeRoom === null) return;
    const buttons = enabledButtons();
    const target = edge === "first" ? buttons[0] : buttons[buttons.length - 1];
    if (target !== undefined) focusButton(target);
  };

  const clickFocusedButton = (button: HTMLButtonElement): void => {
    restoreButtonAfterRender = true;
    try {
      button.click();
    } finally {
      restoreButtonAfterRender = false;
    }
  };

  const activateFocused = (): void => {
    if (activeRoom === null) return;
    const active = findFocusedButton();
    if (active !== null) clickFocusedButton(active);
  };

  const handleKeydown = (event: ShortcutKeyEvent): boolean => {
    if (activeRoom === null) return false;
    const { code } = event;
    const consume = (): true => {
      event.preventDefault();
      event.stopPropagation();
      return true;
    };
    if (!event.repeat && (code === "Escape" || code === "KeyX" || code === "KeyB")) {
      close();
      return consume();
    }
    if (code === "ArrowRight" || code === "ArrowDown" || code === "KeyD" || code === "KeyS") {
      stepFocus(1);
      return consume();
    }
    if (code === "ArrowLeft" || code === "ArrowUp" || code === "KeyA" || code === "KeyW") {
      stepFocus(-1);
      return consume();
    }
    if (!event.repeat && code === "Home") {
      focusEdge("first");
      return consume();
    }
    if (!event.repeat && code === "End") {
      focusEdge("last");
      return consume();
    }
    if (!event.repeat && (code === "Enter" || code === "Space" || code === "KeyZ")) {
      const activeButton = findFocusedButton();
      if (activeButton !== null) {
        clickFocusedButton(activeButton);
        return consume();
      }
    }
    return false;
  };

  return {
    open,
    openForArea,
    close,
    isOpen: () => activeRoom !== null,
    render,
    stepFocus,
    activateFocused,
    handleKeydown,
  };
}
