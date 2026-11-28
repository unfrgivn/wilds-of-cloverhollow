import "./encore-shrine.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import type { HudInputMode } from "./hud-hints";
import { assetUrl } from "../platform/assets";
import {
  buildEncoreShrineView,
  computeEncoreCoins,
  ENCORE_MODIFIER_IDS,
  startEncoreBattle,
  type EncoreBossView,
  type EncoreModifierId,
  type EncoreShrineView,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import type { ShortcutEncoreControl, ShortcutKeyEvent } from "../shell/input-shortcuts";

const SVG_NS = "http://www.w3.org/2000/svg";
const TROPHY_IMG_URL = "assets/props/encore-shrine/star-trophy.webp";

/** Adapts the Dream Memory Shrine footer hint for touch, gamepad, and keyboard input. */
export function encoreFooterHint(
  inputMode: HudInputMode = "keyboard",
  touchActive = false,
): string {
  if (touchActive) {
    return "Tap a memory · Tap Star Challenges · Tap Begin Encore";
  }
  if (inputMode === "gamepad") {
    return "D-Pad pick a memory · L/R toggle Star Challenges · A launch · B close";
  }
  return (
    "Arrows/WASD pick a memory · 1/2/3 toggle Star Challenges · Enter/Z launch · Esc close"
  );
}

export type EncoreShrineRenderParams = {
  view: EncoreShrineView;
  stickerArt: (critterId: string, frameName: string) => AtlasImage | null;
  inputMode?: HudInputMode;
  touchActive?: boolean;
};

export type EncoreBattleBannerView = {
  visible: boolean;
  modifiers: readonly EncoreModifierId[];
};

export type EncoreShrineOverlay = {
  root: HTMLDivElement;
  battleBanner: HTMLDivElement;
  isOpen: () => boolean;
  open: (params: EncoreShrineRenderParams) => void;
  sync: (params: EncoreShrineRenderParams) => void;
  close: () => void;
  renderBattleBanner: (banner: EncoreBattleBannerView) => void;
  selectedBossId: () => string;
  selectedModifiers: () => EncoreModifierId[];
  stepNav: (dx: number, dy: number) => void;
  toggleModifier: (id: EncoreModifierId) => void;
  cycleModifier: (delta: -1 | 1) => void;
  activateLaunch: () => void;
  onLaunch: (handler: (bossId: string, modifiers: EncoreModifierId[]) => void) => void;
  onClose: (handler: () => void) => void;
  onSelect: (handler: () => void) => void;
  onToggle: (handler: (active: boolean) => void) => void;
  handleKeydown: (event: ShortcutKeyEvent) => boolean;
};

const MODIFIER_SHORT_NAMES: Readonly<Record<EncoreModifierId, string>> = {
  "brisk-breeze": "Brisk Breeze",
  "windup-surge": "Wind-Up Surge",
  "pure-heart": "Pure Heart",
};

function starSvg(filled: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "encore-star-svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    "M10 1.8 L12.5 6.8 L18 7.6 L14 11.4 L14.9 16.9 L10 14.3 L5.1 16.9 L6 11.4 L2 7.6 L7.5 6.8 Z",
  );
  path.setAttribute("fill", filled ? "#f4c542" : "#efe4c8");
  path.setAttribute("stroke", "#47321f");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linejoin", "round");
  if (!filled) path.setAttribute("stroke-dasharray", "2.1 1.6");
  svg.append(path);
  return svg;
}

function makeTrophyImg(className: string): HTMLImageElement {
  const img = element("img", className);
  img.src = assetUrl(TROPHY_IMG_URL);
  img.alt = "";
  img.decoding = "async";
  img.setAttribute("aria-hidden", "true");
  return img;
}

/** Creates the tactile Dream Memory Shrine overlay and Encore battle modifier banner. */
export function createEncoreShrine(parent: HTMLElement): EncoreShrineOverlay {
  const root = element("div", "sticker-ui encore-shrine", parent);
  root.hidden = true;

  const card = element("section", "encore-card", root);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Dream Memory Shrine");
  card.tabIndex = -1;

  const head = element("header", "encore-head", card);
  const titleWrap = element("div", "encore-title-wrap", head);
  titleWrap.append(makeTrophyImg("encore-trophy-icon"));
  const title = element("h2", "encore-title", titleWrap);
  title.textContent = "DREAM MEMORY SHRINE";
  const stats = element("div", "encore-stats", titleWrap);
  const trophyPill = element("span", "encore-stat-pill", stats);
  trophyPill.setAttribute("data-encore-trophies", "0");
  const starsPill = element("span", "encore-stat-pill is-stars", stats);
  starsPill.setAttribute("data-encore-stars", "0");

  const closeBtn = element("button", "encore-close", head);
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close Dream Memory Shrine");

  const body = element("div", "encore-body", card);
  const rosterPane = element("div", "encore-roster-pane", body);
  const rosterGrid = element("div", "encore-roster-grid", rosterPane);
  rosterGrid.setAttribute("role", "listbox");
  rosterGrid.setAttribute("aria-label", "Replayable Boss Memories");
  const shelfBar = element("div", "encore-shelf-bar", rosterPane);
  const shelfLabel = element("span", "encore-shelf-label", shelfBar);
  const shelfPips = element("div", "encore-shelf-pips", shelfBar);

  const detailPane = element("aside", "encore-detail-pane", body);
  const spotlight = element("div", "encore-spotlight", detailPane);
  const spotlightArt = element("div", "encore-spotlight-art", spotlight);
  const spotlightCopy = element("div", "encore-spotlight-copy", spotlight);
  const spotlightTitle = element("h3", "encore-spotlight-title", spotlightCopy);
  const spotlightRegion = element("span", "encore-spotlight-region", spotlightCopy);
  const spotlightBlurb = element("p", "encore-spotlight-blurb", spotlightCopy);

  const trophyStrip = element("div", "encore-trophy-strip", detailPane);
  trophyStrip.append(makeTrophyImg("encore-trophy-mini"));
  const trophyLabel = element("span", "encore-trophy-label", trophyStrip);

  const modBox = element("div", "encore-modifiers", detailPane);
  const modHeading = element("p", "encore-section-label", modBox);
  modHeading.textContent = "Star Challenge Modifiers";
  const modList = element("div", "encore-mod-list", modBox);

  const launchBox = element("div", "encore-launch-box", detailPane);
  const rewardPreview = element("div", "encore-reward-preview", launchBox);
  const rewardCoins = element("span", "encore-reward-coins", rewardPreview);
  const rewardStars = element("span", "encore-reward-stars", rewardPreview);
  const launchBtn = element("button", "encore-launch", launchBox);
  launchBtn.type = "button";
  launchBtn.textContent = "Replay Calm-Down!";

  const footHint = element("p", "encore-foot-hint", card);
  footHint.textContent = encoreFooterHint();

  const battleBanner = element("div", "sticker-ui encore-battle-banner", parent);
  battleBanner.hidden = true;
  battleBanner.setAttribute("aria-live", "polite");

  let openState = false;
  let currentParams: EncoreShrineRenderParams | null = null;
  let selectedId = "";
  let lastRenderKey = "";
  const activeModifiers = new Set<EncoreModifierId>();
  let launchHandler: ((bossId: string, modifiers: EncoreModifierId[]) => void) | null = null;
  let closeHandler: (() => void) | null = null;
  let selectHandler: (() => void) | null = null;
  let toggleHandler: ((active: boolean) => void) | null = null;

  const orderedModifiers = (): EncoreModifierId[] =>
    ENCORE_MODIFIER_IDS.filter((id) => activeModifiers.has(id));

  const currentBoss = (): EncoreBossView | undefined => {
    const bosses = currentParams?.view.bosses ?? [];
    return bosses.find((item) => item.critterId === selectedId) ?? bosses[0];
  };

  const pickDefaultBoss = (view: EncoreShrineView): string => {
    if (view.bosses.some((item) => item.critterId === selectedId)) return selectedId;
    const firstUnlocked = view.bosses.find((item) => item.unlocked);
    return firstUnlocked?.critterId ?? view.bosses[0]?.critterId ?? "";
  };

  const renderAll = (): void => {
    if (currentParams === null) return;
    const { view, stickerArt } = currentParams;
    selectedId = pickDefaultBoss(view);
    const key = [
      selectedId,
      orderedModifiers().join(","),
      view.trophiesEarned,
      view.starsEarned,
      ...view.bosses.map(
        (b) =>
          `${b.critterId}:${b.unlocked ? 1 : 0}:${b.stars}:${b.trophyEarned ? 1 : 0}:` +
          `${b.clears}:${b.modifiersCleared.join(".")}:` +
          `${b.unlocked ? (stickerArt(b.critterId, b.stickerFrame)?.src ?? "") : ""}`,
      ),
    ].join("|");
    if (key === lastRenderKey) return;
    lastRenderKey = key;
    setText(trophyPill, `Trophies ${view.trophiesEarned}/${view.trophiesTotal}`);
    setAttribute(trophyPill, "data-encore-trophies", String(view.trophiesEarned));
    setText(starsPill, `★ ${view.starsEarned}/${view.starsTotal}`);
    setAttribute(starsPill, "data-encore-stars", String(view.starsEarned));

    rosterGrid.innerHTML = "";
    for (const boss of view.bosses) {
      const selected = boss.critterId === selectedId;
      const classes = [
        "encore-boss-card",
        selected ? "is-selected" : "",
        boss.unlocked ? "is-unlocked" : "is-locked",
        boss.isFinale ? "is-finale" : "",
      ].filter(Boolean).join(" ");
      const btn = element("button", classes, rosterGrid);
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(selected));
      btn.setAttribute("data-encore-boss", boss.critterId);
      btn.setAttribute("data-unlocked", String(boss.unlocked));
      btn.setAttribute("data-stars", String(boss.stars));

      if (boss.trophyEarned) {
        btn.append(makeTrophyImg("encore-boss-trophy-dot"));
      }
      const artWrap = element("div", "encore-boss-art", btn);
      const art = boss.unlocked ? stickerArt(boss.critterId, boss.stickerFrame) : null;
      if (boss.unlocked && art !== null) {
        const sprite = element("div", "encore-boss-sprite", artWrap);
        applyAtlasCrop(sprite, art);
      } else {
        const mark = element("span", "encore-boss-lock", artWrap);
        mark.textContent = boss.unlocked ? "★" : "?";
      }
      const name = element("span", "encore-boss-name", btn);
      name.textContent = boss.title;
      const starsRow = element("span", "encore-boss-stars", btn);
      starsRow.setAttribute("aria-label", `${boss.stars} of 3 stars`);
      for (let index = 0; index < ENCORE_MODIFIER_IDS.length; index += 1) {
        starsRow.append(starSvg(index < boss.stars));
      }
      btn.addEventListener("click", () => {
        if (selectedId !== boss.critterId) {
          selectedId = boss.critterId;
          selectHandler?.();
          renderAll();
        }
      });
    }

    setText(shelfLabel, `Clubhouse Shelf · ${view.trophiesEarned}/${view.trophiesTotal} Trophies`);
    shelfPips.innerHTML = "";
    for (const boss of view.bosses) {
      const pip = element(
        "span",
        `encore-shelf-pip${boss.trophyEarned ? " is-earned" : ""}`,
        shelfPips,
      );
      if (boss.trophyEarned) pip.append(makeTrophyImg("encore-shelf-pip-img"));
    }

    const boss = currentBoss();
    spotlightArt.innerHTML = "";
    if (boss !== undefined) {
      const heroArt = boss.unlocked ? stickerArt(boss.critterId, boss.stickerFrame) : null;
      if (boss.unlocked && heroArt !== null) {
        const sprite = element("div", "encore-spotlight-sprite", spotlightArt);
        applyAtlasCrop(sprite, heroArt);
      } else {
        const mark = element("span", "encore-boss-lock", spotlightArt);
        mark.textContent = boss.unlocked ? "★" : "?";
      }
      setText(spotlightTitle, boss.title);
      setText(
        spotlightRegion,
        boss.clears > 0
          ? `${boss.region} · Cleared ${boss.clears}×`
          : boss.region,
      );
      setText(spotlightBlurb, boss.blurb);
      trophyStrip.classList.toggle("is-earned", boss.trophyEarned);
      setText(
        trophyLabel,
        boss.trophyEarned
          ? `Clubhouse Trophy Earned: ${boss.trophyName}`
          : `Win with 1+ ★ to earn: ${boss.trophyName}`,
      );
    }

    modList.innerHTML = "";
    const clearedSet = new Set<EncoreModifierId>(boss?.modifiersCleared ?? []);
    view.modifiers.forEach((mod, index) => {
      const active = activeModifiers.has(mod.id);
      const pill = element(
        "button",
        `encore-mod-pill${active ? " is-active" : ""}`,
        modList,
      );
      pill.type = "button";
      pill.setAttribute("role", "switch");
      pill.setAttribute("aria-checked", String(active));
      pill.setAttribute("data-encore-modifier", mod.id);
      const check = element("span", "encore-mod-check", pill);
      check.append(starSvg(active));
      const copy = element("div", "encore-mod-copy", pill);
      const top = element("div", "encore-mod-head", copy);
      const modName = element("span", "encore-mod-name", top);
      modName.textContent = `[${index + 1}] ${mod.name}`;
      const modTag = element("span", "encore-mod-tag", top);
      modTag.textContent = clearedSet.has(mod.id) ? "★ Cleared" : active ? "Active" : "Off";
      const desc = element("span", "encore-mod-desc", copy);
      desc.textContent = mod.description;
      pill.addEventListener("click", () => {
        toggleModifier(mod.id);
      });
    });

    const mods = orderedModifiers();
    const coins = computeEncoreCoins(view, mods);
    setText(rewardCoins, `Reward: +${coins} coins`);
    setText(
      rewardStars,
      mods.length > 0 ? `★ ${mods.length}-Star Challenge` : "Cozy Rematch",
    );
    const canLaunch = boss !== undefined && boss.unlocked;
    launchBtn.disabled = !canLaunch;
    setText(
      launchBtn,
      canLaunch ? "Replay Calm-Down!" : "Calm in Story to Unlock",
    );
  };

  let modifierCursor = 0;
  const toggleModifier = (id: EncoreModifierId): void => {
    if (activeModifiers.has(id)) activeModifiers.delete(id);
    else activeModifiers.add(id);
    toggleHandler?.(activeModifiers.has(id));
    renderAll();
  };

  const cycleModifier = (delta: -1 | 1): void => {
    const count = ENCORE_MODIFIER_IDS.length;
    modifierCursor = (((modifierCursor + delta) % count) + count) % count;
    const modId = ENCORE_MODIFIER_IDS[modifierCursor];
    if (modId !== undefined) toggleModifier(modId);
  };

  const stepNav = (dx: number, dy: number): void => {
    const bosses = currentParams?.view.bosses ?? [];
    if (bosses.length === 0) return;
    const cols = 3;
    const index = Math.max(0, bosses.findIndex((item) => item.critterId === selectedId));
    const delta = dx + dy * cols;
    const nextIndex = (((index + delta) % bosses.length) + bosses.length) % bosses.length;
    const nextBoss = bosses[nextIndex];
    if (nextBoss !== undefined && nextBoss.critterId !== selectedId) {
      selectedId = nextBoss.critterId;
      selectHandler?.();
      renderAll();
    }
  };

  const activateLaunch = (): void => {
    const boss = currentBoss();
    if (boss === undefined || !boss.unlocked) return;
    launchHandler?.(boss.critterId, orderedModifiers());
  };

  const close = (): void => {
    if (!openState) return;
    openState = false;
    lastRenderKey = "";
    root.hidden = true;
    delete document.documentElement.dataset.encoreShrine;
    closeHandler?.();
  };

  const syncFooterHint = (params: EncoreShrineRenderParams): void => {
    setText(
      footHint,
      encoreFooterHint(params.inputMode ?? "keyboard", params.touchActive ?? false),
    );
  };

  const open = (params: EncoreShrineRenderParams): void => {
    currentParams = params;
    openState = true;
    lastRenderKey = "";
    root.hidden = false;
    document.documentElement.dataset.encoreShrine = "open";
    syncFooterHint(params);
    renderAll();
    card.focus({ preventScroll: true });
  };

  const sync = (params: EncoreShrineRenderParams): void => {
    currentParams = params;
    if (openState) {
      syncFooterHint(params);
      renderAll();
    }
  };

  const renderBattleBanner = (banner: EncoreBattleBannerView): void => {
    battleBanner.hidden = !banner.visible;
    if (!banner.visible) return;
    const labels = banner.modifiers.map((id) => MODIFIER_SHORT_NAMES[id]);
    const text = labels.length > 0
      ? `★ ENCORE · ${labels.join(" · ")}`
      : "★ DREAM ENCORE";
    setText(battleBanner, text);
  };

  closeBtn.addEventListener("click", close);
  launchBtn.addEventListener("click", activateLaunch);
  root.addEventListener("click", (event) => {
    if (event.target === root) close();
  });

  const handleKeydown = (event: ShortcutKeyEvent): boolean => {
    if (!openState) return false;
    const { code } = event;
    if (code === "Escape" || code === "KeyX") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return true;
    }
    if (code === "Digit1" || code === "Digit2" || code === "Digit3") {
      event.preventDefault();
      event.stopPropagation();
      const idx = code === "Digit1" ? 0 : code === "Digit2" ? 1 : 2;
      const modId = ENCORE_MODIFIER_IDS[idx];
      if (modId !== undefined) toggleModifier(modId);
      return true;
    }
    if (code === "ArrowRight" || code === "KeyD") {
      event.preventDefault();
      event.stopPropagation();
      stepNav(1, 0);
      return true;
    }
    if (code === "ArrowLeft" || code === "KeyA") {
      event.preventDefault();
      event.stopPropagation();
      stepNav(-1, 0);
      return true;
    }
    if (code === "ArrowDown" || code === "KeyS") {
      event.preventDefault();
      event.stopPropagation();
      stepNav(0, 1);
      return true;
    }
    if (code === "ArrowUp" || code === "KeyW") {
      event.preventDefault();
      event.stopPropagation();
      stepNav(0, -1);
      return true;
    }
    if (code === "KeyZ") {
      event.preventDefault();
      event.stopPropagation();
      activateLaunch();
      return true;
    }
    if (code === "Enter" || code === "Space") {
      const target = event.target;
      if (typeof HTMLButtonElement !== "undefined" && target instanceof HTMLButtonElement) {
        if (target !== closeBtn && target.hasAttribute("data-encore-boss")) {
          event.preventDefault();
          event.stopPropagation();
          activateLaunch();
          return true;
        }
        return false;
      }
      if (target === card || target === document.body) {
        event.preventDefault();
        event.stopPropagation();
        activateLaunch();
        return true;
      }
    }
    return false;
  };

  return {
    root,
    battleBanner,
    isOpen: () => openState,
    open,
    sync,
    close,
    renderBattleBanner,
    selectedBossId: () => selectedId,
    selectedModifiers: orderedModifiers,
    stepNav,
    toggleModifier,
    cycleModifier,
    activateLaunch,
    onLaunch: (handler) => { launchHandler = handler; },
    onClose: (handler) => { closeHandler = handler; },
    onSelect: (handler) => { selectHandler = handler; },
    onToggle: (handler) => { toggleHandler = handler; },
    handleKeydown,
  };
}

export type EncoreShrineSession = {
  isOpen: () => boolean;
  open: () => void;
  closeSilent: () => void;
  render: (state: State, inputMode?: HudInputMode, touchActive?: boolean) => void;
  shortcuts: () => ShortcutEncoreControl;
};

/** Wires the Dream Memory Shrine modal, boss art warming, and battle launch into the shell. */
export function mountEncoreShrineSession(deps: {
  uiRoot: HTMLElement;
  world: World;
  getState: () => State;
  setState: (next: State) => void;
  stickerArt: (critterId: string, frameName: string) => AtlasImage | null;
  warmEncoreArt: (bossIds: readonly string[]) => Promise<void>;
  warmBattlePortraits: (state: State) => Promise<void>;
  ensureCritterAtlas: (critterId: string) => Promise<void>;
  textSpeed: () => TextSpeed;
  playEffect: (effect: "card-open" | "card-close" | "toggle-on" | "toggle-off") => void;
  playCue: (cue: "choice-move" | "battle-start", tick: number) => void;
  lightHaptic: () => void;
  swallow: (button: "confirm" | "cancel") => void;
  clearTaps: () => void;
  releasePointer: () => void;
  invalidate: () => void;
}): EncoreShrineSession {
  const shrine = createEncoreShrine(deps.uiRoot);
  let launching = false;
  let silentClose = false;
  let lastInputMode: HudInputMode = "keyboard";
  let lastTouchActive = false;

  shrine.onSelect(() => {
    deps.playCue("choice-move", deps.getState().tick);
    deps.invalidate();
  });
  shrine.onToggle((active) => {
    deps.playEffect(active ? "toggle-on" : "toggle-off");
    deps.lightHaptic();
    deps.invalidate();
  });
  shrine.onClose(() => {
    if (!silentClose) {
      deps.playEffect("card-close");
      deps.swallow("cancel");
      deps.clearTaps();
      deps.invalidate();
    }
  });
  shrine.onLaunch((bossId, modifiers) => {
    if (launching) return;
    launching = true;
    const launch = async (): Promise<void> => {
      try {
        await Promise.all([
          deps.ensureCritterAtlas(bossId),
          deps.warmBattlePortraits(deps.getState()),
        ]);
        const current = deps.getState();
        const started = startEncoreBattle(
          deps.world,
          current,
          bossId,
          modifiers,
          deps.textSpeed(),
        );
        if (started.battle !== null) {
          silentClose = true;
          shrine.close();
          silentClose = false;
          deps.swallow("confirm");
          deps.clearTaps();
          deps.setState(started);
          deps.playCue("battle-start", started.tick);
          deps.lightHaptic();
          deps.invalidate();
        }
      } finally {
        launching = false;
      }
    };
    void launch();
  });

  const open = (): void => {
    const state = deps.getState();
    const view = buildEncoreShrineView(deps.world, state);
    if (!view.unlocked) return;
    deps.releasePointer();
    deps.clearTaps();
    shrine.open({
      view,
      stickerArt: deps.stickerArt,
      inputMode: lastInputMode,
      touchActive: lastTouchActive,
    });
    deps.playEffect("card-open");
    deps.lightHaptic();
    deps.invalidate();
    const unlockedIds = view.bosses.filter((b) => b.unlocked).map((b) => b.critterId);
    void deps.warmEncoreArt(unlockedIds).then(() => {
      if (shrine.isOpen()) {
        shrine.sync({
          view: buildEncoreShrineView(deps.world, deps.getState()),
          stickerArt: deps.stickerArt,
          inputMode: lastInputMode,
          touchActive: lastTouchActive,
        });
        deps.invalidate();
      }
    });
  };

  const closeSilent = (): void => {
    if (!shrine.isOpen()) return;
    silentClose = true;
    shrine.close();
    silentClose = false;
  };

  const render = (
    state: State,
    inputMode: HudInputMode = "keyboard",
    touchActive = false,
  ): void => {
    lastInputMode = inputMode;
    lastTouchActive = touchActive;
    if (shrine.isOpen()) {
      shrine.sync({
        view: buildEncoreShrineView(deps.world, state),
        stickerArt: deps.stickerArt,
        inputMode,
        touchActive,
      });
    }
    const encore = state.battle?.encore;
    shrine.renderBattleBanner({
      visible: encore !== undefined,
      modifiers: encore?.modifiers ?? [],
    });
  };

  return {
    isOpen: shrine.isOpen,
    open,
    closeSilent,
    render,
    shortcuts: () => ({
      isOpen: shrine.isOpen,
      close: shrine.close,
      stepNav: shrine.stepNav,
      cycleModifier: shrine.cycleModifier,
      activateLaunch: shrine.activateLaunch,
      handleKeydown: shrine.handleKeydown,
    }),
  };
}
