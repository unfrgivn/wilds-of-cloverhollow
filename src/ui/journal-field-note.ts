import { applyAtlasCrop } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import { feelingMarkup, heartMarkup, icon, keepsakeIcon } from "./icons";
import { createBlessingPlaque, createTreasuresBlessingsStrip } from "./journal-blessings";
import {
  focusRestoreSelector,
  inspectableShelfIds,
  prizeFieldNoteData,
  resolveFieldNote,
  stepInspectedItem,
  treasuresSignature,
  type FieldNoteData,
  type InspectedJournalItem,
  type JournalFieldNotePrize,
  type JournalFieldNoteSource,
} from "./journal-field-note-data";
import { createJournalGemsLedger } from "./journal-gems-ledger";
import { createJournalHeartsAlbum } from "./journal-hearts";
import { createJournalRibbonsShowcase } from "./journal-ribbons";
import { createJournalWeatherAlmanac } from "./journal-weather";
import { isKeepsakeId } from "../core/blessings";
import { evaluateMeritRibbonsFromJournal } from "../core/ribbons";
import type { CozyWeatherMode } from "../core/weather";

export {
  fieldNoteBlurb,
  fishFieldNote,
  focusRestoreSelector,
  inspectableShelfIds,
  keepsakeFieldNote,
  prizeFieldNote,
  prizeFieldNoteData,
  resolveFieldNote,
  stepInspectedItem,
  stickerFieldNote,
  treasuresSignature,
  type FieldNoteData,
  type InspectedJournalItem,
  type JournalFieldNoteFish,
  type JournalFieldNotePrize,
  type JournalFieldNoteSource,
  type JournalFieldNoteSticker,
  type PrizeFieldNoteMeta,
} from "./journal-field-note-data";

export type JournalFieldOverlays = {
  fieldBackdrop: HTMLDivElement;
  treasuresBackdrop: HTMLDivElement;
  gemsOverlay: HTMLDivElement;
  ribbonsOverlay: HTMLDivElement;
  ribbonsBanner: HTMLButtonElement;
  inspect: (item: InspectedJournalItem, view: JournalFieldNoteSource | null) => void;
  openPrize: (prize: JournalFieldNotePrize, view?: JournalFieldNoteSource | null) => void;
  openTreasures: (view: JournalFieldNoteSource | null) => void;
  openGems: (view: JournalFieldNoteSource | null, returnTarget?: HTMLElement | null) => void;
  openRibbons: (view: JournalFieldNoteSource | null, returnTarget?: HTMLElement | null) => void;
  syncFieldNote: (view: JournalFieldNoteSource) => void;
  syncTreasures: (view: JournalFieldNoteSource) => void;
  syncGems: (view: JournalFieldNoteSource) => void;
  syncRibbons: (view: JournalFieldNoteSource, anchor?: Element) => void;
  syncAll: (view: JournalFieldNoteSource, ribbonsAnchor?: Element) => void;
  stepFieldNote: (delta: -1 | 1) => boolean;
  closeFieldNote: () => void;
  closeTreasures: () => void;
  closeGems: () => void;
  closeRibbons: () => void;
  closeAll: () => void;
  hasOpen: () => boolean;
  dismiss: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

function makeOverlayButton(className: string, ariaLabel: string, text: string): HTMLButtonElement {
  const btn = element("button", className);
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);
  btn.textContent = text;
  return btn;
}

function makeDialogCard(className: string, ariaLabel: string): HTMLElement {
  const card = element("article", className);
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", ariaLabel);
  return card;
}

function makeFieldRow(
  keyText: string,
  valueNode: HTMLElement,
  pills = false,
): { row: HTMLDivElement; key: HTMLSpanElement } {
  const row = element("div", pills ? "journal-field-row is-pills" : "journal-field-row");
  const key = element("span", "journal-field-key");
  key.textContent = keyText;
  row.append(key, valueNode);
  return { row, key };
}

function makeTreasuresSection(titleText: string, bodyClass: string): {
  section: HTMLElement;
  count: HTMLSpanElement;
  body: HTMLDivElement;
} {
  const section = element("section", "journal-treasures-section");
  const head = element("div", "journal-treasures-section-head");
  element("span", "journal-treasures-section-title", head).textContent = titleText;
  const count = element("span", "journal-treasures-count", head);
  const body = element("div", bodyClass, section);
  section.prepend(head);
  return { section, count, body };
}

function makeStampPill(label: string, stamped: boolean): HTMLSpanElement {
  const pill = element("span", stamped ? "journal-stamp-pill is-stamped" : "journal-stamp-pill");
  pill.textContent = `${stamped ? "✓" : "○"} ${label}`;
  return pill;
}

function activeFocusElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function createJournalFieldOverlays(options?: {
  focusRoot?: HTMLElement;
  onVisibilityChange?: (open: boolean) => void;
  onStep?: () => void;
  onWeatherSelect?: (mode: CozyWeatherMode) => void;
}): JournalFieldOverlays {
  const fieldBackdrop = element("div", "journal-field-backdrop");
  fieldBackdrop.hidden = true;
  const fieldCard = makeDialogCard("journal-field-note", "Critter field note");
  const fieldClose = makeOverlayButton("journal-field-close", "Close field note", "×");
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
  const fieldPrev = makeOverlayButton(
    "journal-field-nav journal-field-prev", "Previous entry", "‹",
  );
  const fieldCounter = element("span", "journal-field-counter");
  fieldCounter.setAttribute("aria-live", "polite");
  const fieldNext = makeOverlayButton("journal-field-nav journal-field-next", "Next entry", "›");
  fieldPager.append(fieldPrev, fieldCounter, fieldNext);
  fieldLeft.append(fieldSpecimen, fieldOldFriend, fieldPager);
  const fieldBody = element("div", "journal-field-body");
  const fieldName = element("h3", "journal-field-name");
  const fieldSub = element("div", "journal-field-sub");
  const fieldMeta = element("div", "journal-field-meta");
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
    fieldFoundRow.row, fieldDetailRow.row, fieldFeelingsRow.row, fieldLovesRow.row,
  );
  const blessingPlaque = createBlessingPlaque();
  fieldBody.append(fieldName, fieldSub, fieldMeta, fieldBlurb, blessingPlaque.root);
  fieldCard.append(fieldClose, fieldLeft, fieldBody);
  fieldBackdrop.append(fieldCard);

  const treasuresBackdrop = element("div", "journal-treasures-backdrop");
  treasuresBackdrop.hidden = true;
  const treasuresCard = makeDialogCard("journal-treasures-card", "Field treasures");
  const treasuresClose = makeOverlayButton("journal-treasures-close", "Close field treasures", "×");
  const treasuresHead = element("div", "journal-treasures-head");
  const treasuresTitleWrap = element("div", "journal-treasures-title-wrap");
  const treasuresTitle = element("h3", "journal-treasures-title");
  treasuresTitle.textContent = "FIELD TREASURES";
  treasuresTitleWrap.append(treasuresTitle);
  treasuresHead.append(treasuresTitleWrap, treasuresClose);
  const treasuresStamps = element("div", "journal-treasures-stamps");
  treasuresStamps.hidden = true;
  const treasuresBlessings = createTreasuresBlessingsStrip();
  const keepsakesSec = makeTreasuresSection("CLUBHOUSE KEEPSAKES", "journal-keepsakes-grid");
  const catchSec = makeTreasuresSection("BUBBLEGUM BAY CATCH BOOK", "journal-catch-row");
  treasuresCard.append(
    treasuresHead,
    treasuresStamps,
    treasuresBlessings.root,
    keepsakesSec.section,
    catchSec.section,
  );
  treasuresBackdrop.append(treasuresCard);

  let fieldSignature = "";
  let lastTreasuresSignature = "";
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
    blessingPlaque.hide();
    fieldBackdrop.hidden = true;
  };

  const clearTreasures = (): void => {
    treasuresReturnFocusEl = null;
    if (!treasuresOpen && treasuresBackdrop.hidden) return;
    treasuresOpen = false;
    treasuresBackdrop.hidden = true;
  };

  let ribbonsReturnToTreasures = false;
  let weatherReturnToTreasures = false;
  let heartsReturnToTreasures = false;
  const attachOverlay = (overlay: HTMLElement): void => {
    const host = options?.focusRoot ?? treasuresBackdrop.parentElement;
    if (host !== null && overlay.parentElement !== host) host.append(overlay);
  };
  const restoreTreasures = (wasFromTreasures: boolean): void => {
    if (wasFromTreasures && treasuresOpen) treasuresBackdrop.hidden = false;
  };
  const clearPeers = (keep?: "weather" | "ribbons" | "hearts" | "gems"): void => {
    clearFieldNote();
    if (keep === "gems" || keep === undefined) clearTreasures();
    if (keep !== "gems") gemsLedger.clear();
    if (keep !== "ribbons") { ribbonsReturnToTreasures = false; ribbonsShowcase.clear(); }
    if (keep !== "weather") { weatherReturnToTreasures = false; weatherAlmanac.clear(); }
    if (keep !== "hearts") { heartsReturnToTreasures = false; heartsAlbum.clear(); }
  };
  const weatherAlmanac = createJournalWeatherAlmanac({
    onBeforeOpen: () => clearPeers("weather"),
    onClose: () => {
      restoreTreasures(weatherReturnToTreasures);
      weatherReturnToTreasures = false;
    },
    onVisibilityChange: () => syncVisibility(),
    onSelectMode: options?.onWeatherSelect,
  });
  const ribbonsShowcase = createJournalRibbonsShowcase({
    onBeforeOpen: () => clearPeers("ribbons"),
    onClose: () => {
      restoreTreasures(ribbonsReturnToTreasures);
      ribbonsReturnToTreasures = false;
    },
    onVisibilityChange: () => syncVisibility(),
  });
  const heartsAlbum = createJournalHeartsAlbum({
    onBeforeOpen: () => clearPeers("hearts"),
    onClose: () => {
      restoreTreasures(heartsReturnToTreasures);
      heartsReturnToTreasures = false;
    },
    onVisibilityChange: () => syncVisibility(),
  });
  treasuresTitleWrap.append(
    ribbonsShowcase.treasuresBtn, weatherAlmanac.treasuresBtn, heartsAlbum.treasuresBtn,
  );
  const gemsLedger = createJournalGemsLedger({
    onBeforeOpen: () => clearPeers("gems"),
    onVisibilityChange: () => syncVisibility(),
  });
  const hasOpen = (): boolean =>
    treasuresOpen || inspectedItem !== null || gemsLedger.isOpen() ||
    ribbonsShowcase.isOpen() || weatherAlmanac.isOpen() || heartsAlbum.isOpen();

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
    treasuresBackdrop.hidden =
      (ribbonsReturnToTreasures && ribbonsShowcase.isOpen()) ||
      (weatherReturnToTreasures && weatherAlmanac.isOpen()) ||
      (heartsReturnToTreasures && heartsAlbum.isOpen());
    const signature = treasuresSignature(summary);
    if (signature === lastTreasuresSignature) return;
    lastTreasuresSignature = signature;

    treasuresStamps.hidden = !summary.stamps.started;
    if (summary.stamps.started) {
      const stripLabel = element("span", "journal-stamps-label");
      stripLabel.textContent = "STAR-LINE STAMP CARD";
      const nodes: HTMLElement[] = [
        stripLabel,
        makeStampPill("Bay Wave Stamp", summary.stamps.bay),
        makeStampPill("Pass Pine Stamp", summary.stamps.pass),
      ];
      if (summary.stamps.complete) {
        const badge = element("span", "journal-stamp-complete");
        badge.textContent = "★ Star-Line Explorer!";
        nodes.push(badge);
      }
      treasuresStamps.replaceChildren(...nodes);
    } else {
      treasuresStamps.replaceChildren();
    }

    setText(keepsakesSec.count, `${summary.unlockedKeepsakes}/${summary.totalKeepsakes}`);
    treasuresBlessings.update(
      summary.keepsakes
        .filter((item) => item.unlocked)
        .map((item) => item.id)
        .filter(isKeepsakeId),
    );
    keepsakesSec.body.replaceChildren(
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

    setText(catchSec.count, `${summary.caughtFish}/${summary.totalFish}`);
    catchSec.body.replaceChildren(
      ...summary.catches.map((entry) => {
        const classes = entry.caught
          ? entry.rare
            ? "journal-catch-pill is-caught is-rare"
            : "journal-catch-pill is-caught"
          : "journal-catch-pill is-uncaught";
        const pill = element("span", classes);
        setAttribute(pill, "data-fish", entry.id);
        pill.textContent = entry.caught ? `${entry.rare ? "★ " : ""}${entry.name}` : "???";
        return pill;
      }),
    );
  };

  const applyFieldNote = (data: FieldNoteData, view: JournalFieldNoteSource | null): void => {
    fieldBackdrop.hidden = false;
    syncPager(view);
    if (data.signature === fieldSignature) return;
    fieldSignature = data.signature;
    setAttribute(fieldCard, "aria-label", data.ariaLabel);
    setAttribute(fieldCard, "data-field-kind", data.kind);
    fieldSpecimen.classList.toggle("is-rare", data.rare);
    fieldPortrait.hidden = data.portraitHidden;
    if (data.portraitImage !== null) applyAtlasCrop(fieldPortrait, data.portraitImage);
    if (data.portraitAriaLabel !== null) {
      setAttribute(fieldPortrait, "aria-label", data.portraitAriaLabel);
    }
    fieldCharm.hidden = data.charmId === null;
    if (data.charmId !== null) {
      fieldCharm.replaceChildren(keepsakeIcon(data.charmId));
      setAttribute(fieldCharm, "aria-label", data.name);
    }
    setText(fieldName, data.name);
    setText(fieldSub, data.subtitle);
    fieldOldFriend.hidden = !data.oldFriend;
    setText(fieldFoundRow.key, data.foundKey);
    setText(fieldLands, data.foundValue);
    setText(fieldDetailRow.key, data.detailKey);
    setText(fieldCalms, data.detailValue);
    fieldFeelingsRow.row.hidden = data.feelings === null;
    fieldLovesRow.row.hidden = data.favouriteTreats === null;
    if (data.feelings !== null) {
      fieldFeelings.replaceChildren(
        ...data.feelings.map((feeling) => {
          const pill = element("span", "journal-field-feeling");
          pill.append(icon(feelingMarkup[feeling.id], "journal-field-feeling-icon"), feeling.label);
          return pill;
        }),
      );
    }
    if (data.favouriteTreats !== null) {
      fieldLoves.replaceChildren(
        ...data.favouriteTreats.map((treat) => {
          const pill = element("span", "journal-field-love-pill");
          pill.append(icon(heartMarkup, "journal-field-heart"), treat);
          return pill;
        }),
      );
    }
    setText(fieldBlurb, data.blurb);
    if (data.blessingId !== null) blessingPlaque.update(data.blessingId);
    else blessingPlaque.hide();
  };

  const syncFieldNote = (view: JournalFieldNoteSource): void => {
    latestView = view;
    if (inspectedItem === null) {
      fieldPager.hidden = true;
      if (!fieldBackdrop.hidden) fieldBackdrop.hidden = true;
      return;
    }
    const data = resolveFieldNote(view, inspectedItem);
    if (data === null) {
      clearFieldNote();
      return;
    }
    applyFieldNote(data, view);
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

  const syncRibbons = (view: JournalFieldNoteSource, anchor?: Element): void => {
    const summary = evaluateMeritRibbonsFromJournal(view);
    const showBanner =
      view.keepsakes !== undefined && ((view.stickersOwned ?? 0) > 0 || summary.earned > 0);
    ribbonsShowcase.syncTriggers(summary, showBanner, anchor);
  };

  const openRibbons = (
    view: JournalFieldNoteSource | null,
    returnTarget?: HTMLElement | null,
  ): void => {
    const source = view ?? latestView;
    if (source === null) return;
    if (treasuresOpen && returnTarget === ribbonsShowcase.treasuresBtn) {
      ribbonsReturnToTreasures = true;
      treasuresBackdrop.hidden = true;
    } else {
      ribbonsReturnToTreasures = false;
      clearTreasures();
    }
    ribbonsShowcase.open(evaluateMeritRibbonsFromJournal(source), returnTarget);
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
  ribbonsShowcase.treasuresBtn.addEventListener("click", () => {
    openRibbons(latestView, ribbonsShowcase.treasuresBtn);
  });
  ribbonsShowcase.banner.addEventListener("click", () => {
    openRibbons(latestView, ribbonsShowcase.banner);
  });
  weatherAlmanac.treasuresBtn.addEventListener("click", () => {
    attachOverlay(weatherAlmanac.overlay);
    weatherReturnToTreasures = treasuresOpen;
    if (treasuresOpen) treasuresBackdrop.hidden = true;
    weatherAlmanac.open(weatherAlmanac.treasuresBtn);
  });
  heartsAlbum.treasuresBtn.addEventListener("click", () => {
    attachOverlay(heartsAlbum.overlay);
    heartsReturnToTreasures = treasuresOpen;
    if (treasuresOpen) treasuresBackdrop.hidden = true;
    heartsAlbum.open(latestView?.heartToHearts, heartsAlbum.treasuresBtn);
  });

  const closeAll = (): void => {
    clearPeers();
    lastNotifiedOpen = false;
  };

  const dismiss = (): boolean => {
    if (heartsAlbum.isOpen()) { heartsAlbum.close(); return true; }
    if (weatherAlmanac.isOpen()) { weatherAlmanac.close(); return true; }
    if (ribbonsShowcase.isOpen()) { ribbonsShowcase.close(); return true; }
    if (gemsLedger.isOpen()) { gemsLedger.close(); return true; }
    if (treasuresOpen) { closeTreasures(); return true; }
    if (inspectedItem !== null) { closeFieldNote(); return true; }
    return false;
  };

  return {
    fieldBackdrop,
    treasuresBackdrop,
    gemsOverlay: gemsLedger.overlay,
    ribbonsOverlay: ribbonsShowcase.overlay,
    ribbonsBanner: ribbonsShowcase.banner,
    inspect: (item, view) => {
      if (inspectedItem === null) fieldReturnFocusEl = activeFocusElement();
      inspectedItem = item;
      if (view !== null) syncFieldNote(view);
      if (!fieldBackdrop.hidden) fieldCard.focus({ preventScroll: true });
      syncVisibility();
    },
    openPrize: (prize, view) => {
      if (!prize.owned || prize.image === null) return;
      if (inspectedItem === null) fieldReturnFocusEl = activeFocusElement();
      inspectedItem = { kind: "prize", id: prize.id };
      if (view !== undefined && view !== null) syncFieldNote(view);
      else applyFieldNote(prizeFieldNoteData(prize), null);
      if (!fieldBackdrop.hidden) fieldCard.focus({ preventScroll: true });
      syncVisibility();
    },
    openTreasures: (view) => {
      if (view?.treasures?.hasAny !== true) return;
      if (!treasuresOpen) treasuresReturnFocusEl = activeFocusElement();
      treasuresOpen = true;
      syncTreasures(view);
      if (!treasuresBackdrop.hidden) treasuresCard.focus({ preventScroll: true });
      syncVisibility();
    },
    openGems: (view, returnTarget) => { gemsLedger.open(view?.starGems, returnTarget); },
    openRibbons,
    syncFieldNote,
    syncTreasures,
    syncGems: (view) => gemsLedger.sync(view.starGems),
    syncRibbons,
    syncAll: (view, ribbonsAnchor) => {
      syncFieldNote(view);
      syncTreasures(view);
      gemsLedger.sync(view.starGems);
      syncRibbons(view, ribbonsAnchor);
      heartsAlbum.sync(view.heartToHearts);
    },
    stepFieldNote,
    closeFieldNote,
    closeTreasures,
    closeGems: () => gemsLedger.close(),
    closeRibbons: () => ribbonsShowcase.close(),
    closeAll,
    hasOpen,
    dismiss,
    handleKeydown: (event) => {
      if (heartsAlbum.handleKeydown(event)) return true;
      if (weatherAlmanac.handleKeydown(event)) return true;
      if (ribbonsShowcase.handleKeydown(event)) return true;
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
