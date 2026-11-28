import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import type { EnemyIntentKind } from "../core";

export type BattleIntentItem = {
  kind: EnemyIntentKind;
  label: string;
  detail: string;
  art: AtlasImage | null;
};

export type BattleFoePlateItem = {
  index: number;
  critterId: string;
  name: string;
  calm: number;
  calmMax: number;
  soothed: boolean;
  targeted: boolean;
  intent: BattleIntentItem | null;
};

export type BossPhase2BannerView = {
  bossId: string;
  bossName: string;
  phaseTitle: string;
  signatureLine: string;
  accentHex: string;
  rhythmLabel: string;
} | null;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function atlasKey(image: AtlasImage | null): string {
  if (image === null) return "";
  return `${image.src}|${image.frame.x},${image.frame.y},${image.frame.w},${image.frame.h}`;
}

type IntentBadgeSlot = {
  root: HTMLDivElement;
  art: HTMLSpanElement;
  label: HTMLSpanElement;
  artKey: string;
};

function makeIntentSticker(extraClass = ""): IntentBadgeSlot {
  const cls = extraClass === "" ? "battle-intent-sticker" : `battle-intent-sticker ${extraClass}`;
  const root = element("div", cls);
  const art = element("span", "battle-intent-art");
  art.setAttribute("aria-hidden", "true");
  const label = element("span", "battle-intent-label");
  root.append(art, label);
  root.hidden = true;
  return { root, art, label, artKey: "" };
}

function syncIntentSticker(slot: IntentBadgeSlot, intent: BattleIntentItem | null): void {
  slot.root.hidden = intent === null;
  if (intent === null) return;
  setAttribute(slot.root, "data-intent", intent.kind);
  setAttribute(slot.root, "title", intent.detail);
  setText(slot.label, intent.label);
  const key = atlasKey(intent.art);
  if (slot.artKey !== key) {
    slot.artKey = key;
    if (intent.art !== null) applyAtlasCrop(slot.art, intent.art);
    else slot.art.style.backgroundImage = "";
  }
  slot.art.hidden = intent.art === null;
}

type FoePlateNode = {
  button: HTMLButtonElement;
  name: HTMLSpanElement;
  soothedBadge: HTMLSpanElement;
  track: HTMLDivElement;
  fill: HTMLDivElement;
  intent: IntentBadgeSlot;
  foeIndex: number;
};

/**
 * Clickable multi-foe formation HUD (`.battle-foes`) rendered in the top-right
 * safe area when 2–3 critters share the stage. Hidden for single-foe battles.
 */
export function createFoeFormationHud(hud: HTMLElement): {
  render: (foes: readonly BattleFoePlateItem[]) => void;
  onSelectTarget: (callback: (index: number) => void) => void;
} {
  let selectHandler: (index: number) => void = () => undefined;
  const container = element("div", "battle-foes");
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Critter formation");
  container.hidden = true;
  hud.append(container);

  const plates: FoePlateNode[] = [];
  const addPlate = (): FoePlateNode => {
    const button = element("button", "battle-foe-plate");
    button.type = "button";
    const head = element("div", "battle-foe-head");
    const name = element("span", "battle-foe-name");
    const soothedBadge = element("span", "battle-foe-soothed");
    soothedBadge.textContent = "CALM ✓";
    soothedBadge.hidden = true;
    head.append(name, soothedBadge);
    const track = element("div", "battle-foe-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    const fill = element("div", "battle-foe-fill");
    track.append(fill);
    const intent = makeIntentSticker();
    button.append(head, track, intent.root);
    const node: FoePlateNode = {
      button,
      name,
      soothedBadge,
      track,
      fill,
      intent,
      foeIndex: 0,
    };
    button.addEventListener("click", () => {
      if (!button.disabled) selectHandler(node.foeIndex);
    });
    container.append(button);
    return node;
  };

  return {
    onSelectTarget: (callback) => {
      selectHandler = callback;
    },
    render: (foes) => {
      const show = foes.length > 1;
      container.hidden = !show;
      if (!show) return;
      while (plates.length < foes.length) plates.push(addPlate());
      while (plates.length > foes.length) plates.pop()?.button.remove();
      foes.forEach((foe, idx) => {
        const plate = plates[idx];
        if (plate === undefined) return;
        plate.foeIndex = foe.index;
        setText(plate.name, foe.name);
        plate.soothedBadge.hidden = !foe.soothed;
        plate.button.disabled = foe.soothed;
        plate.button.classList.toggle("is-targeted", foe.targeted && !foe.soothed);
        plate.button.classList.toggle("is-soothed", foe.soothed);
        setAttribute(plate.button, "data-critter", foe.critterId);
        setAttribute(plate.button, "aria-pressed", String(foe.targeted && !foe.soothed));
        setAttribute(
          plate.button,
          "aria-label",
          foe.soothed
            ? `${foe.name} is calm`
            : `${foe.name}${foe.targeted ? " (targeted)" : ""}`,
        );
        const remaining = 1 - clamp01(foe.calm / Math.max(1, foe.calmMax));
        setAttribute(plate.track, "aria-label", `${foe.name} fizz`);
        setAttribute(plate.track, "aria-valuenow", String(Math.round(remaining * 100)));
        plate.fill.style.width = `${remaining * 100}%`;
        syncIntentSticker(plate.intent, foe.soothed ? null : foe.intent);
      });
    },
  };
}

/**
 * Die-cut top-center Boss Phase-2 callout ribbon. Hidden unless `bossPhase2 !== null`
 * so single-foe Turn 1 baselines remain 100% pixel-identical.
 */
export function createPhase2Banner(hud: HTMLElement): {
  render: (banner: BossPhase2BannerView) => void;
} {
  const banner = element("div", "battle-phase2-banner");
  banner.setAttribute("role", "status");
  banner.hidden = true;
  const crest = element("div", "battle-phase2-crest");
  const line = element("div", "battle-phase2-line");
  banner.append(crest, line);
  hud.append(banner);
  return {
    render: (view) => {
      banner.hidden = view === null;
      if (view === null) return;
      setAttribute(banner, "data-boss", view.bossId);
      banner.style.setProperty("--phase2-accent", view.accentHex);
      setText(crest, `PHASE 2 · ${view.phaseTitle}`);
      setText(line, view.signatureLine);
    },
  };
}

/** Die-cut intent sticker anchored under `.battle-calm` strictly during Boss Phase 2. */
export function createBossIntentSticker(calmSection: HTMLElement): {
  render: (intent: BattleIntentItem | null) => void;
} {
  const slot = makeIntentSticker("battle-boss-intent");
  calmSection.append(slot.root);
  return {
    render: (intent) => syncIntentSticker(slot, intent),
  };
}
