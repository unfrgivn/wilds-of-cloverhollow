import { applyAtlasCrop, type AtlasImage } from "./atlas";
import type { BattlePeekData } from "./battle-peek";
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
  banner.setAttribute("aria-live", "polite");
  banner.setAttribute("aria-atomic", "true");
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

/**
 * Compact warm-paper Battle Field Guide Peek card (spec 8.1, Milestones 110, 232 & 233).
 * Shows active targeted foe metadata, optional multi-foe flipper pager, optional live Next Move
 * intent row, optional Boss Phase-2 badge, feelings/treats, and input-adapted tactical tip.
 */
export function createBattlePeekCard(root: HTMLElement): {
  render: (peek: BattlePeekData | null, battleVisible: boolean) => void;
  onClose: (callback: () => void) => void;
  onStepTarget: (callback: (delta: -1 | 1) => void) => void;
} {
  let closeHandler: () => void = () => undefined;
  let stepTargetHandler: (delta: -1 | 1) => void = () => undefined;
  const peekCard = element("section", "battle-peek-card");
  peekCard.tabIndex = -1;
  peekCard.setAttribute("role", "region");
  peekCard.setAttribute("aria-label", "Critter field guide");
  peekCard.hidden = true;

  const peekHead = element("div", "battle-peek-head");
  const peekTitleRow = element("div", "battle-peek-title-row");
  const peekName = element("span", "battle-peek-name");
  const peekLevel = element("span", "battle-peek-level");
  const peekFam = element("span", "battle-peek-fam");
  peekTitleRow.append(peekName, peekLevel, peekFam);
  const peekPager = element("div", "battle-peek-pager");
  peekPager.setAttribute("role", "group");
  peekPager.setAttribute("aria-label", "Switch critter target");
  peekPager.hidden = true;
  const prevBtn = element("button", "battle-peek-step");
  prevBtn.type = "button";
  prevBtn.textContent = "‹";
  prevBtn.setAttribute("aria-label", "Previous foe");
  prevBtn.addEventListener("click", () => stepTargetHandler(-1));
  const countSpan = element("span", "battle-peek-count");
  const nextBtn = element("button", "battle-peek-step");
  nextBtn.type = "button";
  nextBtn.textContent = "›";
  nextBtn.setAttribute("aria-label", "Next foe");
  nextBtn.addEventListener("click", () => stepTargetHandler(1));
  peekPager.append(prevBtn, countSpan, nextBtn);
  const peekClose = element("button", "battle-peek-close");
  peekClose.type = "button";
  peekClose.textContent = "×";
  peekClose.setAttribute("aria-label", "Close critter field guide");
  peekClose.addEventListener("click", () => closeHandler());
  peekHead.append(peekTitleRow, peekPager, peekClose);

  const peekMeta = element("div", "battle-peek-meta");
  const peekLand = element("span", "battle-peek-badge is-land");
  const peekCheck = element("span", "battle-peek-badge is-check");
  const peekPhase2 = element("span", "battle-peek-badge battle-peek-phase2");
  peekPhase2.hidden = true;
  peekMeta.append(peekLand, peekCheck, peekPhase2);

  const peekIntentRow = element("div", "battle-peek-row battle-peek-intent");
  peekIntentRow.hidden = true;
  const peekIntentLabel = element("span", "battle-peek-label");
  peekIntentLabel.textContent = "NEXT MOVE";
  const peekIntentBody = element("div", "battle-peek-body");
  const peekIntentText = element("span", "battle-peek-intent-text");
  peekIntentBody.append(peekIntentText);
  peekIntentRow.append(peekIntentLabel, peekIntentBody);

  const peekFeelingsRow = element("div", "battle-peek-row");
  const peekFeelingsLabel = element("span", "battle-peek-label");
  peekFeelingsLabel.textContent = "Feelings";
  const peekFeelingsBody = element("div", "battle-peek-body");
  peekFeelingsRow.append(peekFeelingsLabel, peekFeelingsBody);

  const peekTreatsRow = element("div", "battle-peek-row");
  const peekTreatsLabel = element("span", "battle-peek-label");
  peekTreatsLabel.textContent = "Treats";
  const peekTreatsBody = element("div", "battle-peek-body");
  peekTreatsRow.append(peekTreatsLabel, peekTreatsBody);

  const peekTip = element("div", "battle-peek-tip");
  peekCard.append(
    peekHead,
    peekMeta,
    peekIntentRow,
    peekFeelingsRow,
    peekTreatsRow,
    peekTip,
  );
  root.append(peekCard);

  let lastPeekSig = "";
  let prevPeekOpen = false;
  let peekReturnFocusEl: HTMLElement | null = null;

  return {
    onClose: (callback) => {
      closeHandler = callback;
    },
    onStepTarget: (callback) => {
      stepTargetHandler = callback;
    },
    render: (peek, battleVisible) => {
      const nextPeekOpen = peek !== null;
      peekCard.hidden = !nextPeekOpen;
      if (nextPeekOpen && !prevPeekOpen) {
        peekReturnFocusEl =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        peekCard.focus({ preventScroll: true });
      } else if (!nextPeekOpen && prevPeekOpen) {
        const returnTarget = peekReturnFocusEl;
        peekReturnFocusEl = null;
        if (
          battleVisible &&
          returnTarget !== null &&
          returnTarget.isConnected &&
          returnTarget.closest("[hidden]") === null
        ) {
          returnTarget.focus({ preventScroll: true });
        }
      }
      prevPeekOpen = nextPeekOpen;
      if (peek === null) return;
      const intentNote = peek.intentNote ?? null;
      const phase2Note = peek.phase2Note ?? null;
      const pager = peek.formationPager ?? null;
      const sig = [
        peek.critterId,
        peek.name,
        peek.level,
        peek.landName,
        peek.familiarity,
        peek.familiarityLabel,
        peek.checkLabel,
        peek.favouriteTreats.join(","),
        peek.knownFeelings === null ? "hidden" : peek.knownFeelings.join(","),
        peek.tip,
        intentNote ?? "",
        phase2Note ?? "",
        pager === null ? "" : `${pager.index}/${pager.total}`,
      ].join("|");
      if (sig === lastPeekSig) return;
      lastPeekSig = sig;
      setAttribute(peekCard, "data-critter", peek.critterId);
      setText(peekName, peek.name);
      setText(peekLevel, `Lv ${peek.level}`);
      setText(peekFam, peek.familiarityLabel);
      setAttribute(peekFam, "data-familiarity", peek.familiarity);
      peekPager.hidden = pager === null;
      if (pager !== null) setText(countSpan, `${pager.index} / ${pager.total}`);
      setText(peekLand, peek.landName);
      setText(peekCheck, peek.checkLabel);
      peekPhase2.hidden = phase2Note === null;
      if (phase2Note !== null) setText(peekPhase2, phase2Note);
      peekIntentRow.hidden = intentNote === null;
      if (intentNote !== null) setText(peekIntentText, intentNote);
      if (peek.knownFeelings !== null && peek.knownFeelings.length > 0) {
        const pills = peek.knownFeelings.map((feelingLabel) => {
          const pill = element("span", "battle-peek-feeling");
          pill.textContent = feelingLabel;
          return pill;
        });
        peekFeelingsBody.replaceChildren(...pills);
      } else {
        const hint = element("span", "battle-peek-hint");
        hint.textContent = "Calm once or carry the lantern to spot feelings.";
        peekFeelingsBody.replaceChildren(hint);
      }
      if (peek.favouriteTreats.length > 0) {
        const pills = peek.favouriteTreats.map((treatName) => {
          const pill = element("span", "battle-peek-treat");
          pill.textContent = `♥ Fav: ${treatName}`;
          return pill;
        });
        peekTreatsBody.replaceChildren(...pills);
      } else {
        const hint = element("span", "battle-peek-hint");
        hint.textContent = "Try treats in battle to discover favourites!";
        peekTreatsBody.replaceChildren(hint);
      }
      setText(peekTip, peek.tip);
    },
  };
}
