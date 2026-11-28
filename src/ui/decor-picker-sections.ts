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
import type { DecorPickerFeedback, DecorPickerRoom } from "./decor-picker";

export type DecorSectionContext = {
  world: World;
  getState: () => State;
  applyAndRefresh: (next: State, cue: DecorPickerFeedback, message?: string) => void;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined && className.length > 0) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function buildDecorHeader(
  state: State,
  room: DecorPickerRoom,
  onClose: () => void,
): HTMLElement {
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
  closeBtn.addEventListener("click", onClose);
  right.append(coins, tickets, closeBtn);
  header.append(titleWrap, right);
  return header;
}

function makeBuySwatchButton(
  ctx: DecorSectionContext,
  id: ClubhouseSwatchId,
  currency: "coins" | "tickets",
  cost: number,
  disabled: boolean,
): HTMLButtonElement {
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
    const current = ctx.getState();
    const unlocked = unlockClubhouseSwatch(ctx.world, current, id, currency);
    if (unlocked === current) return;
    const equipped = equipClubhouseSwatch(unlocked, id);
    ctx.applyAndRefresh(
      equipped,
      "buy",
      `${CLUBHOUSE_SWATCHES[id].name} unlocked and equipped.`,
    );
  });
  return btn;
}

export function buildSwatchesSection(ctx: DecorSectionContext, state: State): HTMLElement {
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
    const price = swatchPriceFor(ctx.world, id);

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
        const current = ctx.getState();
        const next = equipClubhouseSwatch(current, id);
        if (next !== current) ctx.applyAndRefresh(next, "equip", `${spec.name} equipped.`);
      });
      actions.append(equipBtn);
    } else {
      const buyCoins = makeBuySwatchButton(
        ctx,
        id,
        "coins",
        price.coins,
        state.coins < price.coins,
      );
      const buyTickets = makeBuySwatchButton(
        ctx,
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
}

export function buildPedestalsSection(ctx: DecorSectionContext, state: State): HTMLElement {
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
    const price = plushPedestalPrice(ctx.world);
    const buyCoins = el("button", "decor-btn is-buy", `Buy · ${price.coins} Coins`);
    buyCoins.type = "button";
    buyCoins.dataset.pedestalBuyCoins = "true";
    buyCoins.disabled = state.coins < price.coins;
    buyCoins.addEventListener("click", () => {
      const current = ctx.getState();
      const next = unlockPlushPedestals(ctx.world, current, "coins");
      if (next !== current) ctx.applyAndRefresh(next, "buy", "Velvet Plush Pedestals unlocked.");
    });
    const buyTickets = el("button", "decor-btn is-buy-ticket", `Buy · ${price.tickets} Tickets`);
    buyTickets.type = "button";
    buyTickets.dataset.pedestalBuyTickets = "true";
    buyTickets.disabled = state.tickets < price.tickets;
    buyTickets.addEventListener("click", () => {
      const current = ctx.getState();
      const next = unlockPlushPedestals(ctx.world, current, "tickets");
      if (next !== current) ctx.applyAndRefresh(next, "buy", "Velvet Plush Pedestals unlocked.");
    });
    actions.append(buyCoins, buyTickets);
  }
  row.append(copy, actions);
  section.append(row);
  return section;
}

export function buildShelfSection(ctx: DecorSectionContext, state: State): HTMLElement {
  const section = el("section", "decor-section");
  section.dataset.decorShelf = "true";
  const displayed = resolvedBedroomShelfPrizes(ctx.world, state);
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
      const current = ctx.getState();
      const next = resetBedroomShelfPrizes(current);
      if (next !== current) ctx.applyAndRefresh(next, "toggle", "Bedroom shelf reset to auto.");
    });
    meta.append(resetBtn);
  }
  head.append(meta);
  section.append(head);

  const ownedSet = new Set(state.prizes);
  const ownedPrizes = ctx.world.arcade.prizes.filter((entry) => ownedSet.has(entry.id));
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
      const current = ctx.getState();
      const next = toggleBedroomShelfPrize(ctx.world, current, prize.id);
      if (next !== current) {
        const action = active ? "removed from" : "placed on";
        ctx.applyAndRefresh(next, "toggle", `${prize.name} ${action} bedroom shelf.`);
      }
    });
    list.append(pill);
  }
  section.append(list);
  return section;
}

export function buildVisitorsSection(
  ctx: DecorSectionContext,
  state: State,
  room: DecorPickerRoom,
): HTMLElement | null {
  const eligible = eligibleClubhouseVisitors(ctx.world, state);
  if (room !== "clubhouse" && eligible.length === 0) return null;

  const section = el("section", "decor-section");
  section.dataset.decorVisitors = "true";
  const head = el("div", "decor-section-head");
  head.append(el("h3", "decor-section-title", "Visiting Friends"));
  section.append(head);

  const activeVisitor = activeClubhouseVisitor(ctx.world, state);
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
      const current = ctx.getState();
      const next = cycleClubhouseVisitor(ctx.world, current);
      if (next !== current) {
        const nextVisitor = activeClubhouseVisitor(ctx.world, next);
        const msg =
          nextVisitor !== null
            ? `${nextVisitor.name} is now visiting the Clubhouse.`
            : "Updated Clubhouse visitor.";
        ctx.applyAndRefresh(next, "visitor", msg);
      }
    });
    row.append(cycleBtn);
  }
  section.append(row);
  return section;
}
