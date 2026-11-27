import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import { feelingMarkup, heartMarkup, icon, keepsakeIcon } from "./icons";
import type { CritterFieldNote, JournalKeepsake } from "../core/journal";
import type { TreasuresSummary } from "../core/treasures";

export type InspectedJournalItem = {
  kind: "sticker" | "fish" | "keepsake";
  id: string;
};

export type JournalFieldNoteSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
  fieldNote?: CritterFieldNote | null;
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
  fish?: readonly JournalFieldNoteFish[];
  keepsakes?: readonly JournalKeepsake[];
  treasures?: TreasuresSummary;
};

export type JournalFieldOverlays = {
  fieldBackdrop: HTMLDivElement;
  treasuresBackdrop: HTMLDivElement;
  inspect: (item: InspectedJournalItem, view: JournalFieldNoteSource | null) => void;
  openTreasures: (view: JournalFieldNoteSource | null) => void;
  syncFieldNote: (view: JournalFieldNoteSource) => void;
  syncTreasures: (view: JournalFieldNoteSource) => void;
  closeFieldNote: () => void;
  closeTreasures: () => void;
  closeAll: () => void;
  hasOpen: () => boolean;
  dismiss: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

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
  onVisibilityChange?: (open: boolean) => void;
}): JournalFieldOverlays {
  const fieldBackdrop = element("div", "journal-field-backdrop");
  fieldBackdrop.hidden = true;
  const fieldCard = element("article", "journal-field-note");
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
  fieldLeft.append(fieldSpecimen, fieldOldFriend);
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
  let treasuresOpen = false;
  const onVisibilityChange = options?.onVisibilityChange;

  const hasOpen = (): boolean => treasuresOpen || inspectedItem !== null;

  const notifyVisibility = (wasOpen: boolean): void => {
    const nowOpen = hasOpen();
    if (nowOpen !== wasOpen) onVisibilityChange?.(nowOpen);
  };

  const clearFieldNote = (): void => {
    if (inspectedItem === null && fieldBackdrop.hidden) return;
    inspectedItem = null;
    fieldSignature = "";
    fieldBackdrop.hidden = true;
  };

  const clearTreasures = (): void => {
    if (!treasuresOpen && treasuresBackdrop.hidden) return;
    treasuresOpen = false;
    treasuresBackdrop.hidden = true;
  };

  const closeFieldNote = (): void => {
    const wasOpen = hasOpen();
    clearFieldNote();
    notifyVisibility(wasOpen);
  };

  const closeTreasures = (): void => {
    const wasOpen = hasOpen();
    clearTreasures();
    notifyVisibility(wasOpen);
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

  const syncFieldNote = (view: JournalFieldNoteSource): void => {
    if (inspectedItem === null) {
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
    if (inspectedItem.kind === "fish") {
      const fish = (view.fish ?? []).find(
        (candidate) => candidate.id === inspectedItem?.id && candidate.owned,
      );
      if (fish === undefined) {
        clearFieldNote();
        return;
      }
      fieldBackdrop.hidden = false;
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
    setText(fieldLands, keepsake.source);
    setText(fieldDetailRow.key, "Displayed");
    setText(fieldCalms, keepsake.displaySpot);
    fieldFeelingsRow.row.hidden = true;
    fieldLovesRow.row.hidden = true;
    setText(fieldBlurb, keepsake.memory);
  };

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
  };

  const dismiss = (): boolean => {
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
    inspect: (item, view) => {
      const wasOpen = hasOpen();
      inspectedItem = item;
      if (view !== null) syncFieldNote(view);
      notifyVisibility(wasOpen);
    },
    openTreasures: (view) => {
      if (view?.treasures?.hasAny !== true) return;
      const wasOpen = hasOpen();
      treasuresOpen = true;
      syncTreasures(view);
      notifyVisibility(wasOpen);
    },
    syncFieldNote,
    syncTreasures,
    closeFieldNote,
    closeTreasures,
    closeAll,
    hasOpen,
    dismiss,
    handleKeydown: (event) => {
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
        }
        return true;
      }
      return false;
    },
  };
}
