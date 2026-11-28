import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import { feelingMarkup, heartMarkup, icon, keepsakeIcon } from "./icons";
import { createJournalGemsLedger } from "./journal-gems-ledger";
import type { CritterFieldNote, JournalKeepsake, StarGemEntry } from "../core/journal";
import type { TreasuresSummary } from "../core/treasures";

export type InspectedJournalItem = {
  kind: "sticker" | "prize" | "fish" | "keepsake";
  id: string;
};

export type PrizeFieldNoteMeta = {
  origin: string;
  displayNote: string;
  blurb: string;
};

export type JournalFieldNoteSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
  fieldNote?: CritterFieldNote | null;
};

export type JournalFieldNotePrize = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
};

export type JournalFieldNoteFish = {
  id: string;
  name: string;
  image: AtlasImage | null;
  owned: boolean;
  rare: boolean;
  coins: number;
  snacks: number;
  blurb: string;
};

export type JournalFieldNoteSource = {
  stickers: readonly JournalFieldNoteSticker[];
  prizes?: readonly JournalFieldNotePrize[];
  fish?: readonly JournalFieldNoteFish[];
  keepsakes?: readonly JournalKeepsake[];
  starGems?: readonly StarGemEntry[];
  treasures?: TreasuresSummary;
};

export type JournalFieldOverlays = {
  fieldBackdrop: HTMLDivElement;
  treasuresBackdrop: HTMLDivElement;
  gemsOverlay: HTMLDivElement;
  inspect: (item: InspectedJournalItem, view: JournalFieldNoteSource | null) => void;
  openPrize: (prize: JournalFieldNotePrize, view?: JournalFieldNoteSource | null) => void;
  openTreasures: (view: JournalFieldNoteSource | null) => void;
  openGems: (view: JournalFieldNoteSource | null, returnTarget?: HTMLElement | null) => void;
  syncFieldNote: (view: JournalFieldNoteSource) => void;
  syncTreasures: (view: JournalFieldNoteSource) => void;
  syncGems: (view: JournalFieldNoteSource) => void;
  stepFieldNote: (delta: -1 | 1) => boolean;
  closeFieldNote: () => void;
  closeTreasures: () => void;
  closeGems: () => void;
  closeAll: () => void;
  hasOpen: () => boolean;
  dismiss: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

/** CSS selector for the Journal collection slot matching an inspected item. */
export function focusRestoreSelector(item: InspectedJournalItem | null): string | null {
  if (item === null) return null;
  if (item.kind === "sticker") {
    return `.journal-stickers .journal-slot[data-sticker="${item.id}"]`;
  }
  if (item.kind === "prize") {
    return `.journal-prizes .journal-slot[data-prize="${item.id}"]`;
  }
  if (item.kind === "fish") {
    return `.journal-fish .journal-slot[data-fish="${item.id}"]`;
  }
  return `.journal-keepsakes .journal-slot[data-keepsake="${item.id}"]`;
}

/** Lists the inspectable owned entry IDs for a given Journal collection shelf in display order. */
export function inspectableShelfIds(
  view: JournalFieldNoteSource,
  kind: InspectedJournalItem["kind"],
): string[] {
  if (kind === "sticker") {
    return view.stickers
      .filter((s) => s.owned && s.fieldNote !== null && s.fieldNote !== undefined)
      .map((s) => s.id);
  }
  if (kind === "prize") {
    return (view.prizes ?? [])
      .filter((p) => p.owned && p.image !== null)
      .map((p) => p.id);
  }
  if (kind === "fish") {
    return (view.fish ?? []).filter((f) => f.owned).map((f) => f.id);
  }
  return (view.keepsakes ?? []).filter((k) => k.owned).map((k) => k.id);
}

/** Steps backward or forward with wrap-around across owned entries on the same Journal shelf. */
export function stepInspectedItem(
  view: JournalFieldNoteSource,
  current: InspectedJournalItem,
  delta: -1 | 1,
): { next: InspectedJournalItem; index: number; total: number } | null {
  const ids = inspectableShelfIds(view, current.kind);
  if (ids.length < 2) return null;
  const idx = ids.indexOf(current.id);
  if (idx === -1) return null;
  const nextIndex = (((idx + delta) % ids.length) + ids.length) % ids.length;
  const nextId = ids[nextIndex];
  if (nextId === undefined) return null;
  return {
    next: { kind: current.kind, id: nextId },
    index: nextIndex,
    total: ids.length,
  };
}

const CLAW_ORIGIN = "Claw Machine · Mr. Pip's Arcade";
const COUNTER_ORIGIN = "Ticket Counter · Mr. Pip's Arcade";
const PRIZE_HOME = "Clubhouse Shelf";

const PRIZE_FIELD_NOTES: Readonly<Record<string, PrizeFieldNoteMeta>> = {
  "frog-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Squishy moss-green frog with a big stitched grin; Maddie swears it squeaks on rainy nights.",
  },
  "pup-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb: "Floppy-eared puppy with a velvet nose, rescued right from the top of the claw heap.",
  },
  "raccoon-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "A delightfully smug bandit in plush form, guarding the clubhouse shelf with tiny paws.",
  },
  "cat-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Soft ginger tabby stitched with a curled tail, always ready for a sunlit afternoon nap.",
  },
  "bunny-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Long pastel ears and a cotton-puff tail that feels like hugging a sunny meadow cloud.",
  },
  "bluebird-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb: "Plump sky-blue songbird with stitched wings that brighten up the whole clubhouse.",
  },
  "hamster-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb: "Round golden cheeks packed tight with stuffing, looking ready to stash a warm snack.",
  },
  "squirrel-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Fluffy chestnut tail curled taller than its head, like a tiny friend from Pinecone Pass.",
  },
  "owl-plush": {
    origin: CLAW_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb: "Wide starry button eyes watching gently over Fae's clubhouse adventures after dusk.",
  },
  pinwheel: {
    origin: COUNTER_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb: "Spinning pastel petals that whirl into a rainbow whenever a breeze drifts by.",
  },
  "bouncy-ball": {
    origin: COUNTER_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Clear speckled bouncy ball with a tiny gold star floating right in the bouncy center.",
  },
  "toy-rocket": {
    origin: COUNTER_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Tin-painted red-and-cream comet cruiser ready for pretend launches past the marquee.",
  },
  "star-racer-keychain": {
    origin: COUNTER_ORIGIN,
    displayNote: PRIZE_HOME,
    blurb:
      "Mr. Pip's legendary 80-ticket champ prize, the very Star Racer charm Milo dreamed about.",
  },
};

const FALLBACK_PRIZE_NOTE: PrizeFieldNoteMeta = {
  origin: "Mr. Pip's Arcade",
  displayNote: PRIZE_HOME,
  blurb:
    "A treasured prize won at Mr. Pip's Arcade and tucked proudly onto the clubhouse shelf.",
};

/** Returns handcrafted Cloverhollow field-note lore for an Arcade Prize. */
export function prizeFieldNote(prizeId: string): PrizeFieldNoteMeta {
  return PRIZE_FIELD_NOTES[prizeId] ?? FALLBACK_PRIZE_NOTE;
}

export function fieldNoteBlurb(note: CritterFieldNote): string {
  if (note.oldFriend) return "An old friend! Waves happily whenever Fae walks by.";
  if (note.calms >= 2) return "Brightens up fast for a gentle song and a favorite snack.";
  if (note.lands.length > 1) return "Loves wandering between sunny spots across the valley.";
  const firstFeeling = note.feelings[0]?.id;
  if (firstFeeling === "bored") return "A curious soul who just needed a playful friend.";
  if (firstFeeling === "hungry") return "Follows its nose straight to warm snacks and treats.";
  if (firstFeeling === "grumpy") return "A little prickly at first, then soft as moss once calm.";
  if (firstFeeling === "zoomy") return "Full of bouncy energy until a gentle rhythm settles it.";
  if (firstFeeling === "curious") return "Watches every sparkle and sound with bright, eager eyes.";
  return "A cozy valley friend sketched right into Fae's notebook.";
}

export function createJournalFieldOverlays(options?: {
  focusRoot?: HTMLElement;
  onVisibilityChange?: (open: boolean) => void;
  onStep?: () => void;
}): JournalFieldOverlays {
  const fieldBackdrop = element("div", "journal-field-backdrop");
  fieldBackdrop.hidden = true;
  const fieldCard = element("article", "journal-field-note");
  fieldCard.tabIndex = -1;
  fieldCard.setAttribute("role", "dialog");
  fieldCard.setAttribute("aria-modal", "true");
  fieldCard.setAttribute("aria-label", "Critter field note");
  const fieldClose = element("button", "journal-field-close");
  fieldClose.type = "button";
  fieldClose.setAttribute("aria-label", "Close field note");
  fieldClose.textContent = "×";
  const fieldLeft = element("div", "journal-field-left");
  const fieldSpecimen = element("div", "journal-field-specimen");
  const fieldPortrait = element("div", "journal-field-portrait die-cut");
  fieldPortrait.setAttribute("role", "img");
  const fieldCharm = element("div", "journal-field-charm");
  fieldCharm.setAttribute("role", "img");
  fieldCharm.hidden = true;
  fieldSpecimen.append(fieldPortrait, fieldCharm);
  const fieldOldFriend = element("span", "journal-field-old-friend");
  fieldOldFriend.textContent = "★ Old Friend";
  fieldOldFriend.hidden = true;
  const fieldPager = element("div", "journal-field-pager");
  fieldPager.hidden = true;
  const fieldPrev = element("button", "journal-field-nav journal-field-prev");
  fieldPrev.type = "button";
  fieldPrev.setAttribute("aria-label", "Previous entry");
  fieldPrev.textContent = "‹";
  const fieldCounter = element("span", "journal-field-counter");
  fieldCounter.setAttribute("aria-live", "polite");
  const fieldNext = element("button", "journal-field-nav journal-field-next");
  fieldNext.type = "button";
  fieldNext.setAttribute("aria-label", "Next entry");
  fieldNext.textContent = "›";
  fieldPager.append(fieldPrev, fieldCounter, fieldNext);
  fieldLeft.append(fieldSpecimen, fieldOldFriend, fieldPager);
  const fieldBody = element("div", "journal-field-body");
  const fieldName = element("h3", "journal-field-name");
  const fieldSub = element("div", "journal-field-sub");
  const fieldMeta = element("div", "journal-field-meta");
  const makeFieldRow = (
    keyText: string,
    valueNode: HTMLElement,
    pills = false,
  ): { row: HTMLDivElement; key: HTMLSpanElement } => {
    const row = element("div", pills ? "journal-field-row is-pills" : "journal-field-row");
    const key = element("span", "journal-field-key");
    key.textContent = keyText;
    row.append(key, valueNode);
    return { row, key };
  };
  const fieldLands = element("span", "journal-field-val journal-field-lands");
  const fieldCalms = element("span", "journal-field-val journal-field-calms");
  const fieldFeelings = element("div", "journal-field-feelings");
  const fieldLoves = element("div", "journal-field-loves");
  const fieldBlurb = element("p", "journal-field-blurb");
  const fieldFoundRow = makeFieldRow("Found in", fieldLands);
  const fieldDetailRow = makeFieldRow("Calmed", fieldCalms);
  const fieldFeelingsRow = makeFieldRow("Feelings", fieldFeelings, true);
  const fieldLovesRow = makeFieldRow("Loves", fieldLoves, true);
  fieldMeta.append(
    fieldFoundRow.row,
    fieldDetailRow.row,
    fieldFeelingsRow.row,
    fieldLovesRow.row,
  );
  fieldBody.append(fieldName, fieldSub, fieldMeta, fieldBlurb);
  fieldCard.append(fieldClose, fieldLeft, fieldBody);
  fieldBackdrop.append(fieldCard);

  const treasuresBackdrop = element("div", "journal-treasures-backdrop");
  treasuresBackdrop.hidden = true;
  const treasuresCard = element("article", "journal-treasures-card");
  treasuresCard.tabIndex = -1;
  treasuresCard.setAttribute("role", "dialog");
  treasuresCard.setAttribute("aria-modal", "true");
  treasuresCard.setAttribute("aria-label", "Field treasures");
  const treasuresClose = element("button", "journal-treasures-close");
  treasuresClose.type = "button";
  treasuresClose.setAttribute("aria-label", "Close field treasures");
  treasuresClose.textContent = "×";
  const treasuresHead = element("div", "journal-treasures-head");
  const treasuresTitle = element("h3", "journal-treasures-title");
  treasuresTitle.textContent = "FIELD TREASURES";
  treasuresHead.append(treasuresTitle, treasuresClose);
  const treasuresStamps = element("div", "journal-treasures-stamps");
  treasuresStamps.hidden = true;
  const keepsakesSection = element("section", "journal-treasures-section");
  const keepsakesHead = element("div", "journal-treasures-section-head");
  const treasuresKeepsakesHeading = element("span", "journal-treasures-section-title");
  treasuresKeepsakesHeading.textContent = "CLUBHOUSE KEEPSAKES";
  const treasuresKeepsakesCount = element("span", "journal-treasures-count");
  keepsakesHead.append(treasuresKeepsakesHeading, treasuresKeepsakesCount);
  const treasuresKeepsakesGrid = element("div", "journal-keepsakes-grid");
  keepsakesSection.append(keepsakesHead, treasuresKeepsakesGrid);
  const catchSection = element("section", "journal-treasures-section");
  const catchHead = element("div", "journal-treasures-section-head");
  const catchHeading = element("span", "journal-treasures-section-title");
  catchHeading.textContent = "BUBBLEGUM BAY CATCH BOOK";
  const catchCount = element("span", "journal-treasures-count");
  catchHead.append(catchHeading, catchCount);
  const catchRow = element("div", "journal-catch-row");
  catchSection.append(catchHead, catchRow);
  treasuresCard.append(
    treasuresHead,
    treasuresStamps,
    keepsakesSection,
    catchSection,
  );
  treasuresBackdrop.append(treasuresCard);

  let fieldSignature = "";
  let treasuresSignature = "";
  let inspectedItem: InspectedJournalItem | null = null;
  let latestView: JournalFieldNoteSource | null = null;
  let treasuresOpen = false;
  let fieldReturnFocusEl: HTMLElement | null = null;
  let treasuresReturnFocusEl: HTMLElement | null = null;
  let lastNotifiedOpen = false;
  const onVisibilityChange = options?.onVisibilityChange;
  const onStep = options?.onStep;

  const isFocusableTarget = (node: HTMLElement | null): node is HTMLElement =>
    node !== null && node.isConnected && node.closest("[hidden]") === null;

  const restoreFieldFocus = (
    closingItem: InspectedJournalItem | null,
    fallback: HTMLElement | null,
  ): void => {
    const selector = focusRestoreSelector(closingItem);
    const root = options?.focusRoot ?? fieldBackdrop.parentElement;
    if (selector !== null && root !== null) {
      const slot = root.querySelector(selector);
      if (slot instanceof HTMLElement && slot.tabIndex >= 0 && isFocusableTarget(slot)) {
        slot.focus({ preventScroll: true });
        return;
      }
    }
    if (isFocusableTarget(fallback)) fallback.focus({ preventScroll: true });
  };

  const clearFieldNote = (): void => {
    fieldReturnFocusEl = null;
    if (inspectedItem === null && fieldBackdrop.hidden) return;
    inspectedItem = null;
    fieldSignature = "";
    fieldPager.hidden = true;
    fieldBackdrop.hidden = true;
  };

  const clearTreasures = (): void => {
    treasuresReturnFocusEl = null;
    if (!treasuresOpen && treasuresBackdrop.hidden) return;
    treasuresOpen = false;
    treasuresBackdrop.hidden = true;
  };

  const gemsLedger = createJournalGemsLedger({
    onBeforeOpen: () => {
      clearFieldNote();
      clearTreasures();
    },
    onVisibilityChange: () => syncVisibility(),
  });

  const hasOpen = (): boolean => treasuresOpen || inspectedItem !== null || gemsLedger.isOpen();

  const syncVisibility = (): void => {
    const nowOpen = hasOpen();
    if (nowOpen !== lastNotifiedOpen) {
      lastNotifiedOpen = nowOpen;
      onVisibilityChange?.(nowOpen);
    }
  };

  const syncPager = (view: JournalFieldNoteSource | null): void => {
    if (inspectedItem === null || view === null) {
      fieldPager.hidden = true;
      return;
    }
    const ids = inspectableShelfIds(view, inspectedItem.kind);
    const index = ids.indexOf(inspectedItem.id);
    if (ids.length < 2 || index === -1) {
      fieldPager.hidden = true;
      return;
    }
    fieldPager.hidden = false;
    setText(fieldCounter, `${index + 1} / ${ids.length}`);
  };

  const closeFieldNote = (): void => {
    const closingItem = inspectedItem;
    const returnTarget = fieldReturnFocusEl;
    clearFieldNote();
    syncVisibility();
    restoreFieldFocus(closingItem, returnTarget);
  };

  const closeTreasures = (): void => {
    const returnTarget = treasuresReturnFocusEl;
    clearTreasures();
    syncVisibility();
    if (isFocusableTarget(returnTarget)) returnTarget.focus({ preventScroll: true });
  };

  const syncTreasures = (view: JournalFieldNoteSource): void => {
    const summary = view.treasures;
    if (!treasuresOpen || summary === undefined || !summary.hasAny) {
      if (!treasuresBackdrop.hidden) clearTreasures();
      return;
    }
    treasuresBackdrop.hidden = false;
    const signature = [
      summary.stamps.started,
      summary.stamps.bay,
      summary.stamps.pass,
      summary.stamps.complete,
      summary.keepsakes.map((item) => `${item.id}:${item.unlocked}`).join(","),
      summary.catches.map((item) => `${item.id}:${item.caught}`).join(","),
    ].join("|");
    if (signature === treasuresSignature) return;
    treasuresSignature = signature;

    treasuresStamps.hidden = !summary.stamps.started;
    if (summary.stamps.started) {
      const stripLabel = element("span", "journal-stamps-label");
      stripLabel.textContent = "STAR-LINE STAMP CARD";
      const bayPill = element(
        "span",
        summary.stamps.bay ? "journal-stamp-pill is-stamped" : "journal-stamp-pill",
      );
      bayPill.textContent = `${summary.stamps.bay ? "✓" : "○"} Bay Wave Stamp`;
      const passPill = element(
        "span",
        summary.stamps.pass ? "journal-stamp-pill is-stamped" : "journal-stamp-pill",
      );
      passPill.textContent = `${summary.stamps.pass ? "✓" : "○"} Pass Pine Stamp`;
      const nodes: HTMLElement[] = [stripLabel, bayPill, passPill];
      if (summary.stamps.complete) {
        const badge = element("span", "journal-stamp-complete");
        badge.textContent = "★ Star-Line Explorer!";
        nodes.push(badge);
      }
      treasuresStamps.replaceChildren(...nodes);
    } else {
      treasuresStamps.replaceChildren();
    }

    setText(treasuresKeepsakesCount, `${summary.unlockedKeepsakes}/${summary.totalKeepsakes}`);
    treasuresKeepsakesGrid.replaceChildren(
      ...summary.keepsakes.map((item) => {
        const card = element(
          "div",
          item.unlocked
            ? "journal-keepsake-item is-unlocked"
            : "journal-keepsake-item is-locked",
        );
        setAttribute(card, "data-keepsake", item.id);
        const title = element("div", "journal-keepsake-name");
        title.textContent = item.unlocked ? `★ ${item.name}` : "???";
        const detail = element("div", "journal-keepsake-detail");
        detail.textContent = item.unlocked ? `${item.source} · ${item.note}` : item.source;
        card.append(title, detail);
        return card;
      }),
    );

    setText(catchCount, `${summary.caughtFish}/${summary.totalFish}`);
    catchRow.replaceChildren(
      ...summary.catches.map((entry) => {
        const classes = entry.caught
          ? entry.rare
            ? "journal-catch-pill is-caught is-rare"
            : "journal-catch-pill is-caught"
          : "journal-catch-pill is-uncaught";
        const pill = element("span", classes);
        setAttribute(pill, "data-fish", entry.id);
        pill.textContent = entry.caught
          ? `${entry.rare ? "★ " : ""}${entry.name}`
          : "???";
        return pill;
      }),
    );
  };

  const renderPrizeNote = (
    prize: JournalFieldNotePrize,
    view: JournalFieldNoteSource | null,
  ): void => {
    const meta = prizeFieldNote(prize.id);
    fieldBackdrop.hidden = false;
    syncPager(view);
    const signature = [
      "prize",
      prize.id,
      prize.name,
      meta.origin,
      meta.displayNote,
      meta.blurb,
      prize.image !== null,
    ].join("|");
    if (signature === fieldSignature) return;
    fieldSignature = signature;
    setAttribute(fieldCard, "aria-label", "Arcade prize note");
    setAttribute(fieldCard, "data-field-kind", "prize");
    fieldSpecimen.classList.toggle("is-rare", false);
    fieldPortrait.hidden = prize.image === null;
    fieldCharm.hidden = true;
    if (prize.image !== null) applyAtlasCrop(fieldPortrait, prize.image);
    setAttribute(fieldPortrait, "aria-label", prize.name);
    setText(fieldName, prize.name);
    setText(fieldSub, "Arcade Prize");
    fieldOldFriend.hidden = true;
    setText(fieldFoundRow.key, "Found");
    setText(fieldLands, meta.origin);
    setText(fieldDetailRow.key, "Home");
    setText(fieldCalms, meta.displayNote);
    fieldFeelingsRow.row.hidden = true;
    fieldLovesRow.row.hidden = true;
    setText(fieldBlurb, meta.blurb);
  };

  const syncFieldNote = (view: JournalFieldNoteSource): void => {
    latestView = view;
    if (inspectedItem === null) {
      fieldPager.hidden = true;
      if (!fieldBackdrop.hidden) fieldBackdrop.hidden = true;
      return;
    }
    if (inspectedItem.kind === "sticker") {
      const sticker = view.stickers.find(
        (candidate) => candidate.id === inspectedItem?.id && candidate.owned &&
          candidate.fieldNote != null,
      );
      const note = sticker?.fieldNote ?? null;
      if (sticker === undefined || note === null) {
        clearFieldNote();
        return;
      }
      fieldBackdrop.hidden = false;
      syncPager(view);
      const signature = [
        "sticker",
        sticker.id,
        note.level,
        note.calms,
        note.oldFriend,
        note.lands.join(","),
        note.feelings.map((item) => item.id).join(","),
        note.favouriteTreats.join(","),
      ].join("|");
      if (signature === fieldSignature) return;
      fieldSignature = signature;
      setAttribute(fieldCard, "aria-label", "Critter field note");
      setAttribute(fieldCard, "data-field-kind", "sticker");
      fieldSpecimen.classList.toggle("is-rare", false);
      fieldPortrait.hidden = false;
      fieldCharm.hidden = true;
      if (sticker.image !== null) applyAtlasCrop(fieldPortrait, sticker.image);
      setAttribute(fieldPortrait, "aria-label", note.name);
      setText(fieldName, note.name);
      setText(fieldSub, `Lv ${note.level} · ${note.chaosName}`);
      fieldOldFriend.hidden = !note.oldFriend;
      setText(fieldFoundRow.key, "Found in");
      setText(fieldLands, note.lands.join(", "));
      setText(fieldDetailRow.key, "Calmed");
      setText(fieldCalms, `${note.calms} ${note.calms === 1 ? "time" : "times"}`);
      fieldFeelingsRow.row.hidden = false;
      fieldLovesRow.row.hidden = false;
      fieldFeelings.replaceChildren(
        ...note.feelings.map((feeling) => {
          const pill = element("span", "journal-field-feeling");
          pill.append(icon(feelingMarkup[feeling.id], "journal-field-feeling-icon"), feeling.label);
          return pill;
        }),
      );
      fieldLoves.replaceChildren(
        ...note.favouriteTreats.map((treat) => {
          const pill = element("span", "journal-field-love-pill");
          pill.append(icon(heartMarkup, "journal-field-heart"), treat);
          return pill;
        }),
      );
      setText(fieldBlurb, fieldNoteBlurb(note));
      return;
    }
    if (inspectedItem.kind === "prize") {
      const prize = (view.prizes ?? []).find(
        (candidate) =>
          candidate.id === inspectedItem?.id && candidate.owned && candidate.image !== null,
      );
      if (prize === undefined) {
        clearFieldNote();
        return;
      }
      renderPrizeNote(prize, view);
      return;
    }
    if (inspectedItem.kind === "fish") {
      const fish = (view.fish ?? []).find(
        (candidate) => candidate.id === inspectedItem?.id && candidate.owned,
      );
      if (fish === undefined) {
        clearFieldNote();
        return;
      }
      fieldBackdrop.hidden = false;
      syncPager(view);
      const signature = [
        "fish",
        fish.id,
        fish.rare,
        fish.coins,
        fish.snacks,
        fish.blurb,
        fish.image !== null,
      ].join("|");
      if (signature === fieldSignature) return;
      fieldSignature = signature;
      setAttribute(fieldCard, "aria-label", "Fish catch note");
      setAttribute(fieldCard, "data-field-kind", "fish");
      fieldSpecimen.classList.toggle("is-rare", fish.rare);
      fieldPortrait.hidden = fish.image === null;
      fieldCharm.hidden = true;
      if (fish.image !== null) applyAtlasCrop(fieldPortrait, fish.image);
      setAttribute(fieldPortrait, "aria-label", fish.name);
      setText(fieldName, fish.name);
      setText(fieldSub, fish.rare ? "Bubblegum Bay · Rare Catch" : "Bubblegum Bay · Bay Catch");
      fieldOldFriend.hidden = true;
      setText(fieldFoundRow.key, "Found in");
      setText(fieldLands, "Bubblegum Bay Dock");
      setText(fieldDetailRow.key, "Reward");
      const snackBonus = fish.snacks > 0 ? `, +${fish.snacks} snack` : "";
      setText(fieldCalms, `+${fish.coins} coins${snackBonus}`);
      fieldFeelingsRow.row.hidden = true;
      fieldLovesRow.row.hidden = true;
      setText(fieldBlurb, fish.blurb);
      return;
    }
    const keepsake = (view.keepsakes ?? []).find(
      (candidate) => candidate.id === inspectedItem?.id && candidate.owned,
    );
    if (keepsake === undefined) {
      clearFieldNote();
      return;
    }
    fieldBackdrop.hidden = false;
    syncPager(view);
    const signature = [
      "keepsake",
      keepsake.id,
      keepsake.source,
      keepsake.displaySpot,
      keepsake.memory,
    ].join("|");
    if (signature === fieldSignature) return;
    fieldSignature = signature;
    setAttribute(fieldCard, "aria-label", "Keepsake memory note");
    setAttribute(fieldCard, "data-field-kind", "keepsake");
    fieldSpecimen.classList.toggle("is-rare", false);
    fieldPortrait.hidden = true;
    fieldCharm.hidden = false;
    fieldCharm.replaceChildren(keepsakeIcon(keepsake.id));
    setAttribute(fieldCharm, "aria-label", keepsake.name);
    setText(fieldName, keepsake.name);
    setText(fieldSub, "Clubhouse Keepsake");
    fieldOldFriend.hidden = true;
    setText(fieldFoundRow.key, "Found in");
    setText(fieldLands, keepsake.source);
    setText(fieldDetailRow.key, "Displayed");
    setText(fieldCalms, keepsake.displaySpot);
    fieldFeelingsRow.row.hidden = true;
    fieldLovesRow.row.hidden = true;
    setText(fieldBlurb, keepsake.memory);
  };

  const stepFieldNote = (delta: -1 | 1): boolean => {
    if (fieldBackdrop.hidden || inspectedItem === null || latestView === null) return false;
    const stepped = stepInspectedItem(latestView, inspectedItem, delta);
    if (stepped === null) return false;
    inspectedItem = stepped.next;
    syncFieldNote(latestView);
    onStep?.();
    return true;
  };

  fieldPrev.addEventListener("click", () => { stepFieldNote(-1); });
  fieldNext.addEventListener("click", () => { stepFieldNote(1); });
  fieldClose.addEventListener("click", closeFieldNote);
  fieldBackdrop.addEventListener("click", (event) => {
    if (event.target === fieldBackdrop) closeFieldNote();
  });
  treasuresClose.addEventListener("click", closeTreasures);
  treasuresBackdrop.addEventListener("click", (event) => {
    if (event.target === treasuresBackdrop) closeTreasures();
  });

  const closeAll = (): void => {
    clearFieldNote();
    clearTreasures();
    gemsLedger.clear();
    lastNotifiedOpen = false;
  };

  const dismiss = (): boolean => {
    if (gemsLedger.isOpen()) {
      gemsLedger.close();
      return true;
    }
    if (treasuresOpen) {
      closeTreasures();
      return true;
    }
    if (inspectedItem !== null) {
      closeFieldNote();
      return true;
    }
    return false;
  };

  return {
    fieldBackdrop,
    treasuresBackdrop,
    gemsOverlay: gemsLedger.overlay,
    inspect: (item, view) => {
      if (inspectedItem === null) {
        fieldReturnFocusEl =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      inspectedItem = item;
      if (view !== null) syncFieldNote(view);
      if (!fieldBackdrop.hidden) fieldCard.focus({ preventScroll: true });
      syncVisibility();
    },
    openPrize: (prize, view) => {
      if (!prize.owned || prize.image === null) return;
      if (inspectedItem === null) {
        fieldReturnFocusEl =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      inspectedItem = { kind: "prize", id: prize.id };
      if (view !== undefined && view !== null) {
        syncFieldNote(view);
      } else {
        renderPrizeNote(prize, null);
      }
      if (!fieldBackdrop.hidden) fieldCard.focus({ preventScroll: true });
      syncVisibility();
    },
    openTreasures: (view) => {
      if (view?.treasures?.hasAny !== true) return;
      if (!treasuresOpen) {
        treasuresReturnFocusEl =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      treasuresOpen = true;
      syncTreasures(view);
      if (!treasuresBackdrop.hidden) treasuresCard.focus({ preventScroll: true });
      syncVisibility();
    },
    openGems: (view, returnTarget) => {
      gemsLedger.open(view?.starGems, returnTarget);
    },
    syncFieldNote,
    syncTreasures,
    syncGems: (view) => gemsLedger.sync(view.starGems),
    stepFieldNote,
    closeFieldNote,
    closeTreasures,
    closeGems: () => gemsLedger.close(),
    closeAll,
    hasOpen,
    dismiss,
    handleKeydown: (event) => {
      if (gemsLedger.handleKeydown(event)) return true;
      if (treasuresOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeTreasures();
        }
        return true;
      }
      if (inspectedItem !== null) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeFieldNote();
        } else if (
          !fieldBackdrop.hidden &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          stepFieldNote(event.key === "ArrowRight" ? 1 : -1);
        }
        return true;
      }
      return false;
    },
  };
}
