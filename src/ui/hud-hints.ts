import "./hud-hints.css";
import type { Direction, Point } from "../core";

export type HudInputMode = "keyboard" | "gamepad";

export type HudHintAction =
  | "interact"
  | "journal"
  | "lantern"
  | "flute"
  | "photo"
  | "mute"
  | "battle-guide";

export type HudHintKeys = {
  interact: string;
  journal: string;
  lantern: string;
  flute: string;
  mute: string;
};

export function hudHintKeys(mode: HudInputMode): HudHintKeys {
  if (mode === "gamepad") {
    return {
      interact: "A",
      journal: "Y",
      lantern: "X",
      flute: "RB",
      mute: "M",
    };
  }
  return {
    interact: "Z",
    journal: "J",
    lantern: "L",
    flute: "F",
    mute: "M",
  };
}

export type HudHintsView = {
  visible: boolean;
  canInteract: boolean;
  interactLabel: string;
  hasLantern: boolean;
  lanternOn: boolean;
  hasFlute: boolean;
  muted: boolean;
  canPhoto?: boolean;
  battlePeekHint?: boolean;
  inputMode?: HudInputMode;
};

export type ResolvedHudHints = {
  showRibbon: boolean;
  showPhoto: boolean;
  showBattleGuide: boolean;
};

/** Projects HudHintsView to ribbon, Photo pill, and battle Field Guide pill visibility. */
export function resolveHudHintVisibility(view: HudHintsView): ResolvedHudHints {
  const showRibbon = view.visible;
  const showPhoto = showRibbon && view.canPhoto === true;
  const showBattleGuide = !showRibbon && view.battlePeekHint === true;
  return { showRibbon, showPhoto, showBattleGuide };
}

export type HudInteractHint = {
  canInteract: boolean;
  interactLabel: string;
};

export type HudInteractContext = {
  hasInteractable: boolean;
  interactPrompt?: string;
  isResting: boolean;
  player: Point;
  facing: Direction;
  pettableCompanion: Point | null;
  hasRestSpot: boolean;
};

const FACING_VECTORS: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const PET_HINT_FRONT_DOT = 0.15;

export function isFacingPoint(origin: Point, facing: Direction, target: Point): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  const vector = FACING_VECTORS[facing];
  return (dx * vector.x + dy * vector.y) / distance >= PET_HINT_FRONT_DOT;
}

/**
 * Resolves the context-aware Z keycap label while roaming the overworld:
 * real interactables win, then Stand (while resting), Pet (only when facing a
 * pettable companion within the forward cone), Rest (at a cozy rest spot), or
 * inactive Talk.
 */
export function resolveHudInteractHint(context: HudInteractContext): HudInteractHint {
  if (context.hasInteractable) {
    return { canInteract: true, interactLabel: context.interactPrompt ?? "Talk" };
  }
  if (context.isResting) {
    return { canInteract: true, interactLabel: "Stand" };
  }
  if (
    context.pettableCompanion !== null &&
    isFacingPoint(context.player, context.facing, context.pettableCompanion)
  ) {
    return { canInteract: true, interactLabel: "Pet" };
  }
  if (context.hasRestSpot) {
    return { canInteract: true, interactLabel: "Rest" };
  }
  return { canInteract: false, interactLabel: "Talk" };
}

type HintPill = {
  root: HTMLSpanElement;
  key: HTMLElement;
  label: HTMLSpanElement;
};

function makeHintPill(
  action: HudHintAction,
  keyText: string,
  labelText: string,
  onActivate: (action: HudHintAction) => void,
): HintPill {
  const root = document.createElement("span");
  root.className = "hud-hint";
  root.setAttribute("data-hint", action);
  root.setAttribute("role", "button");
  root.tabIndex = 0;
  root.setAttribute("aria-label", labelText);
  root.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!root.hidden) onActivate(action);
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (!root.hidden) onActivate(action);
  });
  const key = document.createElement("kbd");
  key.className = "hud-hint-key";
  key.textContent = keyText;
  const label = document.createElement("span");
  label.className = "hud-hint-label";
  label.textContent = labelText;
  root.append(key, label);
  return { root, key, label };
}

function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function createHudHints(root: HTMLElement): {
  render: (view: HudHintsView) => void;
  onAction: (callback: (action: HudHintAction) => void) => void;
} {
  let actionHandler: (action: HudHintAction) => void = () => undefined;
  const fire = (action: HudHintAction): void => {
    actionHandler(action);
  };

  const ribbon = document.createElement("aside");
  ribbon.className = "hud-hints";
  ribbon.setAttribute("aria-label", "Keyboard controls");
  ribbon.hidden = true;

  const journalPill = makeHintPill("journal", "J", "Journal", fire);
  const interactPill = makeHintPill("interact", "Z", "Talk", fire);
  const lanternPill = makeHintPill("lantern", "L", "Lantern", fire);
  lanternPill.root.hidden = true;
  const flutePill = makeHintPill("flute", "F", "Flute", fire);
  flutePill.root.hidden = true;
  const mutePill = makeHintPill("mute", "M", "Mute", fire);
  const photoPill = makeHintPill("photo", "P", "Photo", fire);
  photoPill.root.hidden = true;

  ribbon.append(
    journalPill.root,
    interactPill.root,
    lanternPill.root,
    flutePill.root,
    mutePill.root,
    photoPill.root,
  );

  const battleHint = document.createElement("aside");
  battleHint.className = "hud-battle-hint";
  battleHint.setAttribute("aria-label", "Battle keyboard hint");
  battleHint.hidden = true;
  battleHint.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!battleHint.hidden) fire("battle-guide");
  });
  const battleGuidePill = makeHintPill("battle-guide", "I", "Field Guide", fire);
  battleHint.append(battleGuidePill.root);

  root.append(ribbon, battleHint);

  let lastSignature = "";

  return {
    onAction: (callback) => {
      actionHandler = callback;
    },
    render: (view) => {
      const mode: HudInputMode = view.inputMode ?? "keyboard";
      const resolved = resolveHudHintVisibility(view);
      const signature =
        `${resolved.showRibbon}|${resolved.showPhoto}|${resolved.showBattleGuide}|` +
        `${view.canInteract}|${view.interactLabel}|` +
        `${view.hasLantern}|${view.lanternOn}|${view.hasFlute}|${view.muted}|${mode}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      ribbon.hidden = !resolved.showRibbon;
      battleHint.hidden = !resolved.showBattleGuide;
      if (resolved.showBattleGuide) {
        setText(battleGuidePill.key, mode === "gamepad" ? "View" : "I");
      }
      if (!resolved.showRibbon) return;

      const keys = hudHintKeys(mode);
      setText(journalPill.key, keys.journal);
      setText(interactPill.key, keys.interact);
      setText(lanternPill.key, keys.lantern);
      setText(flutePill.key, keys.flute);
      setText(mutePill.key, keys.mute);
      setText(photoPill.key, mode === "gamepad" ? "View" : "P");

      const interactText = view.canInteract ? view.interactLabel : "Talk";
      interactPill.root.classList.toggle("is-active", view.canInteract);
      setText(interactPill.label, interactText);
      interactPill.root.setAttribute("aria-label", interactText);

      const lanternOn = view.hasLantern && view.lanternOn;
      lanternPill.root.hidden = !view.hasLantern;
      lanternPill.root.classList.toggle("is-on", lanternOn);
      lanternPill.root.setAttribute("aria-label", lanternOn ? "Lantern on" : "Lantern");

      flutePill.root.hidden = !view.hasFlute;

      const muteText = view.muted ? "Muted" : "Mute";
      mutePill.root.classList.toggle("is-muted", view.muted);
      setText(mutePill.label, muteText);
      mutePill.root.setAttribute("aria-label", muteText);

      photoPill.root.hidden = !resolved.showPhoto;
    },
  };
}
