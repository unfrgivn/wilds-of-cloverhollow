import "./decor-picker.css";
import {
  activeClubhouseSwatch,
  activeClubhouseVisitor,
  bedroomShelfCapacity,
  CLUBHOUSE_SWATCH_IDS,
  CLUBHOUSE_SWATCHES,
  cycleClubhouseVisitor,
  eligibleClubhouseVisitors,
  equipClubhouseSwatch,
  hasPlushPedestals,
  isSwatchUnlocked,
  plushPedestalPrice,
  resetBedroomShelfPrizes,
  resolvedBedroomShelfPrizes,
  swatchPriceFor,
  toggleBedroomShelfPrize,
  unlockClubhouseSwatch,
  unlockPlushPedestals,
  type ClubhouseSwatchId,
  type State,
  type World,
} from "../core";
import type { CompanionAudioEffect } from "../platform/audio-effects";
import type { ShortcutKeyEvent } from "../shell/input-shortcuts";

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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined && className.length > 0) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
    if (button.dataset.decorClose !== undefined) return "[data-decor-close]";
    if (button.dataset.swatchEquip !== undefined) {
      return `[data-swatch-equip="${button.dataset.swatchEquip}"]`;
    }
    if (button.dataset.swatchBuyCoins !== undefined) {
      return `[data-swatch-buy-coins="${button.dataset.swatchBuyCoins}"]`;
    }
    if (button.dataset.swatchBuyTickets !== undefined) {
      return `[data-swatch-buy-tickets="${button.dataset.swatchBuyTickets}"]`;
    }
    if (button.dataset.pedestalBuyCoins !== undefined) return "[data-pedestal-buy-coins]";
    if (button.dataset.pedestalBuyTickets !== undefined) return "[data-pedestal-buy-tickets]";
    if (button.dataset.shelfReset !== undefined) return "[data-shelf-reset]";
    if (button.dataset.shelfPrize !== undefined) {
      return `[data-shelf-prize="${button.dataset.shelfPrize}"]`;
    }
    if (button.dataset.cycleVisitor !== undefined) return "[data-cycle-visitor]";
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

  const buildHeader = (state: State, room: DecorPickerRoom): HTMLElement => {
    const header = el("div", "decor-picker-header");
    const titleWrap = el("div", "decor-picker-title-wrap");
    const title = el(
      "h2",
      "decor-picker-title",
      room === "clubhouse" ? "Clubhouse Decorating" : "Fae's Bedroom Shelf",
    );
    title.id = "decor-picker-title";
    const subtitle = el(
      "p",
      "decor-picker-subtitle",
      room === "clubhouse"
        ? "Style rugs, bunting, plush pedestals, and invite friends over."
        : "Arrange Fae's arcade plushes and unlock velvet display pedestals.",
    );
    titleWrap.append(title, subtitle);

    const right = el("div", "decor-picker-header-right");
    const coins = el("span", "decor-currency-pill is-coins", `${state.coins} Coins`);
    coins.dataset.decorCoins = String(state.coins);
    const tickets = el("span", "decor-currency-pill is-tickets", `${state.tickets} Tickets`);
    tickets.dataset.decorTickets = String(state.tickets);
    const closeBtn = el("button", "decor-close-btn", "Done");
    closeBtn.type = "button";
    closeBtn.dataset.decorClose = "true";
    closeBtn.setAttribute("aria-label", "Close decorating menu");
    closeBtn.addEventListener("click", () => close());
    right.append(coins, tickets, closeBtn);
    header.append(titleWrap, right);
    return header;
  };

  const buildSwatchesSection = (state: State): HTMLElement => {
    const section = el("section", "decor-section");
    section.dataset.decorSwatches = "true";
    const head = el("div", "decor-section-head");
    head.append(el("h3", "decor-section-title", "Clubhouse Decor Swatches"));
    section.append(head);

    const grid = el("div", "decor-swatch-grid");
    const activeSwatch = activeClubhouseSwatch(state);
    for (const id of CLUBHOUSE_SWATCH_IDS) {
      const spec = CLUBHOUSE_SWATCHES[id];
      const equipped = activeSwatch === id;
      const unlocked = isSwatchUnlocked(state, id);
      const price = swatchPriceFor(deps.world, id);

      const card = el("div", equipped ? "decor-swatch-card is-equipped" : "decor-swatch-card");
      card.dataset.swatch = id;

      const top = el("div", "decor-swatch-top");
      top.append(el("span", "decor-swatch-name", spec.name));
      const dots = el("span", "decor-swatch-dots");
      dots.setAttribute("aria-hidden", "true");
      for (const color of spec.previewColors) {
        const dot = el("span", "decor-swatch-dot");
        dot.style.background = color;
        dots.append(dot);
      }
      top.append(dots);
      card.append(top, el("p", "decor-swatch-tagline", spec.tagline));

      const actions = el("div", "decor-card-actions");
      if (equipped) {
        const badge = el("span", "decor-badge is-equipped", "Equipped");
        badge.dataset.swatchState = "equipped";
        actions.append(badge);
      } else if (unlocked) {
        const equipBtn = el("button", "decor-btn is-equip", "Equip");
        equipBtn.type = "button";
        equipBtn.dataset.swatchEquip = id;
        equipBtn.addEventListener("click", () => {
          const current = deps.getState();
          const next = equipClubhouseSwatch(current, id);
          if (next !== current) applyAndRefresh(next, "equip", `${spec.name} equipped.`);
        });
        actions.append(equipBtn);
      } else {
        const buyCoins = makeBuySwatchButton(id, "coins", price.coins, state.coins < price.coins);
        const buyTickets = makeBuySwatchButton(
          id,
          "tickets",
          price.tickets,
          state.tickets < price.tickets,
        );
        actions.append(buyCoins, buyTickets);
      }
      card.append(actions);
      grid.append(card);
    }
    section.append(grid);
    return section;
  };

  const makeBuySwatchButton = (
    id: ClubhouseSwatchId,
    currency: "coins" | "tickets",
    cost: number,
    disabled: boolean,
  ): HTMLButtonElement => {
    const label = currency === "coins" ? `Buy · ${cost} Coins` : `Buy · ${cost} Tickets`;
    const btn = el(
      "button",
      currency === "coins" ? "decor-btn is-buy" : "decor-btn is-buy-ticket",
      label,
    );
    btn.type = "button";
    btn.disabled = disabled;
    if (currency === "coins") btn.dataset.swatchBuyCoins = id;
    else btn.dataset.swatchBuyTickets = id;
    btn.addEventListener("click", () => {
      const current = deps.getState();
      const unlocked = unlockClubhouseSwatch(deps.world, current, id, currency);
      if (unlocked === current) return;
      const equipped = equipClubhouseSwatch(unlocked, id);
      applyAndRefresh(equipped, "buy", `${CLUBHOUSE_SWATCHES[id].name} unlocked and equipped.`);
    });
    return btn;
  };

  const buildPedestalsSection = (state: State): HTMLElement => {
    const section = el("section", "decor-section");
    section.dataset.decorPedestals = "true";
    const row = el("div", "decor-pedestal-row");
    const copy = el("div", "decor-pedestal-copy");
    copy.append(
      el("span", "decor-pedestal-name", "Velvet Plush Pedestals"),
      el(
        "p",
        "decor-pedestal-desc",
        "+1 Bedroom Shelf slot (5 total) & gilded cushions under displayed plushes",
      ),
    );
    const actions = el("div", "decor-card-actions");
    if (hasPlushPedestals(state)) {
      const badge = el("span", "decor-badge is-unlocked", "Unlocked");
      badge.dataset.pedestalState = "unlocked";
      actions.append(badge);
    } else {
      const price = plushPedestalPrice(deps.world);
      const buyCoins = el("button", "decor-btn is-buy", `Buy · ${price.coins} Coins`);
      buyCoins.type = "button";
      buyCoins.dataset.pedestalBuyCoins = "true";
      buyCoins.disabled = state.coins < price.coins;
      buyCoins.addEventListener("click", () => {
        const current = deps.getState();
        const next = unlockPlushPedestals(deps.world, current, "coins");
        if (next !== current) applyAndRefresh(next, "buy", "Velvet Plush Pedestals unlocked.");
      });
      const buyTickets = el(
        "button",
        "decor-btn is-buy-ticket",
        `Buy · ${price.tickets} Tickets`,
      );
      buyTickets.type = "button";
      buyTickets.dataset.pedestalBuyTickets = "true";
      buyTickets.disabled = state.tickets < price.tickets;
      buyTickets.addEventListener("click", () => {
        const current = deps.getState();
        const next = unlockPlushPedestals(deps.world, current, "tickets");
        if (next !== current) applyAndRefresh(next, "buy", "Velvet Plush Pedestals unlocked.");
      });
      actions.append(buyCoins, buyTickets);
    }
    row.append(copy, actions);
    section.append(row);
    return section;
  };

  const buildShelfSection = (state: State): HTMLElement => {
    const section = el("section", "decor-section");
    section.dataset.decorShelf = "true";
    const displayed = resolvedBedroomShelfPrizes(deps.world, state);
    const displayedSet = new Set(displayed);
    const capacity = bedroomShelfCapacity(state);

    const head = el("div", "decor-section-head");
    head.append(el("h3", "decor-section-title", "Bedroom Shelf Plush Display"));
    const meta = el("div", "decor-section-meta");
    const count = el("span", "decor-shelf-count", `${displayed.length} / ${capacity}`);
    count.dataset.shelfCount = `${displayed.length}/${capacity}`;
    meta.append(count);
    if (state.decor?.bedroomSlots !== undefined) {
      const resetBtn = el("button", "decor-btn is-secondary", "Reset Auto");
      resetBtn.type = "button";
      resetBtn.dataset.shelfReset = "true";
      resetBtn.addEventListener("click", () => {
        const current = deps.getState();
        const next = resetBedroomShelfPrizes(current);
        if (next !== current) applyAndRefresh(next, "toggle", "Bedroom shelf reset to auto.");
      });
      meta.append(resetBtn);
    }
    head.append(meta);
    section.append(head);

    const ownedSet = new Set(state.prizes);
    const ownedPrizes = deps.world.arcade.prizes.filter((entry) => ownedSet.has(entry.id));
    if (ownedPrizes.length === 0) {
      section.append(
        el(
          "p",
          "decor-empty-hint",
          "Win plushes at the Arcade Claw Machine or Ticket Counter to display them " +
            "on Fae's Bedroom shelf!",
        ),
      );
      return section;
    }

    const list = el("div", "decor-prize-list");
    for (const prize of ownedPrizes) {
      const active = displayedSet.has(prize.id);
      const pill = el(
        "button",
        active ? "decor-prize-pill is-active" : "decor-prize-pill",
        prize.name,
      );
      pill.type = "button";
      pill.dataset.shelfPrize = prize.id;
      pill.setAttribute("aria-pressed", active ? "true" : "false");
      pill.addEventListener("click", () => {
        const current = deps.getState();
        const next = toggleBedroomShelfPrize(deps.world, current, prize.id);
        if (next !== current) {
          const action = active ? "removed from" : "placed on";
          applyAndRefresh(next, "toggle", `${prize.name} ${action} bedroom shelf.`);
        }
      });
      list.append(pill);
    }
    section.append(list);
    return section;
  };

  const buildVisitorsSection = (state: State, room: DecorPickerRoom): HTMLElement | null => {
    const eligible = eligibleClubhouseVisitors(deps.world, state);
    if (room !== "clubhouse" && eligible.length === 0) return null;

    const section = el("section", "decor-section");
    section.dataset.decorVisitors = "true";
    const head = el("div", "decor-section-head");
    head.append(el("h3", "decor-section-title", "Visiting Friends"));
    section.append(head);

    const activeVisitor = activeClubhouseVisitor(deps.world, state);
    if (activeVisitor === null) {
      section.append(
        el(
          "p",
          "decor-empty-hint",
          "Claim the Clubhouse and befriend valley neighbors so friends drop by to hang out!",
        ),
      );
      return section;
    }

    const row = el("div", "decor-visitor-row");
    const info = el("div", "decor-visitor-active");
    info.dataset.activeVisitor = activeVisitor.id;
    info.append(
      el("span", "decor-visitor-name", activeVisitor.name),
      el("p", "decor-visitor-blurb", activeVisitor.blurb),
    );
    row.append(info);
    if (eligible.length >= 2) {
      const cycleBtn = el("button", "decor-btn is-equip", "Invite Next Friend");
      cycleBtn.type = "button";
      cycleBtn.dataset.cycleVisitor = "true";
      cycleBtn.addEventListener("click", () => {
        const current = deps.getState();
        const next = cycleClubhouseVisitor(deps.world, current);
        if (next !== current) {
          const nextVisitor = activeClubhouseVisitor(deps.world, next);
          const msg =
            nextVisitor !== null
              ? `${nextVisitor.name} is now visiting the Clubhouse.`
              : "Updated Clubhouse visitor.";
          applyAndRefresh(next, "visitor", msg);
        }
      });
      row.append(cycleBtn);
    }
    section.append(row);
    return section;
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

    const header = buildHeader(state, activeRoom);
    const body = el("div", "decor-picker-body");
    const swatches = buildSwatchesSection(state);
    const pedestals = buildPedestalsSection(state);
    const shelf = buildShelfSection(state);
    const visitors = buildVisitorsSection(state, activeRoom);
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
        ? delta > 0
          ? 0
          : buttons.length - 1
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
    if (!event.repeat && (code === "Escape" || code === "KeyX" || code === "KeyB")) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return true;
    }
    if (code === "ArrowRight" || code === "ArrowDown" || code === "KeyD" || code === "KeyS") {
      event.preventDefault();
      event.stopPropagation();
      stepFocus(1);
      return true;
    }
    if (code === "ArrowLeft" || code === "ArrowUp" || code === "KeyA" || code === "KeyW") {
      event.preventDefault();
      event.stopPropagation();
      stepFocus(-1);
      return true;
    }
    if (!event.repeat && code === "Home") {
      event.preventDefault();
      event.stopPropagation();
      focusEdge("first");
      return true;
    }
    if (!event.repeat && code === "End") {
      event.preventDefault();
      event.stopPropagation();
      focusEdge("last");
      return true;
    }
    if (!event.repeat && (code === "Enter" || code === "Space" || code === "KeyZ")) {
      const activeButton = findFocusedButton();
      if (activeButton !== null) {
        event.preventDefault();
        event.stopPropagation();
        clickFocusedButton(activeButton);
        return true;
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
