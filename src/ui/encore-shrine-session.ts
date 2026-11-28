import type { AtlasImage } from "./atlas";
import { element } from "./dom";
import type { HudInputMode } from "./hud-hints";
import { assetUrl } from "../platform/assets";
import {
  buildEncoreShrineView,
  startEncoreBattle,
  type EncoreModifierId,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import type { ShortcutEncoreControl } from "../shell/input-shortcuts";
import { createEncoreShrine } from "./encore-shrine";

const SVG_NS = "http://www.w3.org/2000/svg";
const TROPHY_IMG_URL = "assets/props/encore-shrine/star-trophy.webp";

export const MODIFIER_SHORT_NAMES: Readonly<Record<EncoreModifierId, string>> = {
  "brisk-breeze": "Brisk Breeze",
  "windup-surge": "Wind-Up Surge",
  "pure-heart": "Pure Heart",
};

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

export function starSvg(filled: boolean): SVGSVGElement {
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

export function makeTrophyImg(className: string): HTMLImageElement {
  const img = element("img", className);
  img.src = assetUrl(TROPHY_IMG_URL);
  img.alt = "";
  img.decoding = "async";
  img.setAttribute("aria-hidden", "true");
  return img;
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
