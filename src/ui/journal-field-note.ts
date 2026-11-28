import { applyAtlasCrop } from "./atlas";
import { element, setAttribute, setText } from "./dom";
import { feelingMarkup, heartMarkup, icon, keepsakeIcon } from "./icons";
import { createBlessingPlaque } from "./journal-blessings";
import {
  focusRestoreSelector, inspectableShelfIds, prizeFieldNoteData, resolveFieldNote,
  stepInspectedItem, type FieldNoteData, type InspectedJournalItem,
  type JournalFieldNotePrize, type JournalFieldNoteSource,
} from "./journal-field-note-data";
import { createJournalEncoreCase } from "./journal-encore";
import { createJournalGemsLedger } from "./journal-gems-ledger";
import { createJournalHeartsAlbum } from "./journal-hearts";
import { createJournalJukeboxAlbum } from "./journal-jukebox";
import { createJournalPostcardsAlbum } from "./journal-postcards";
import type { JournalNavDirection } from "./journal-nav";
import {
  activateOverlayButton, scrollOverlayContainer, stepOverlayFocus,
} from "./journal-overlay-nav";
import { createJournalRibbonsShowcase } from "./journal-ribbons";
import { createJournalTreasuresCard } from "./journal-treasures-card";
import { createJournalWeatherAlmanac } from "./journal-weather";
import type { JukeboxTrack } from "../core/music";
import { evaluateMeritRibbonsFromJournal } from "../core/ribbons";
import type { CozyWeatherMode } from "../core/weather";

export {
  fieldNoteBlurb, fishFieldNote, focusRestoreSelector, inspectableShelfIds, keepsakeFieldNote,
  prizeFieldNote, prizeFieldNoteData, resolveFieldNote, stepInspectedItem, stickerFieldNote,
  treasuresSignature, type FieldNoteData, type InspectedJournalItem, type JournalFieldNoteFish,
  type JournalFieldNotePrize, type JournalFieldNoteSource, type JournalFieldNoteSticker,
  type PrizeFieldNoteMeta,
} from "./journal-field-note-data";

export type JournalFieldOverlays = {
  fieldBackdrop: HTMLDivElement; treasuresBackdrop: HTMLDivElement;
  gemsOverlay: HTMLDivElement; ribbonsOverlay: HTMLDivElement; ribbonsBanner: HTMLButtonElement;
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
  navigateOverlay: (direction: JournalNavDirection) => boolean;
  activateOverlay: () => boolean;
  scrollOverlay: (deltaY: number) => boolean;
  closeFieldNote: () => void; closeTreasures: () => void;
  closeGems: () => void; closeRibbons: () => void; closeAll: () => void;
  hasOpen: () => boolean; dismiss: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

function makeOverlayButton(cls: string, label: string, text: string): HTMLButtonElement {
  const btn = element("button", cls);
  btn.type = "button"; btn.setAttribute("aria-label", label); btn.textContent = text;
  return btn;
}
function makeFieldRow(
  keyText: string, valueNode: HTMLElement, pills = false,
): { row: HTMLDivElement; key: HTMLSpanElement } {
  const row = element("div", pills ? "journal-field-row is-pills" : "journal-field-row");
  const key = element("span", "journal-field-key");
  key.textContent = keyText; row.append(key, valueNode);
  return { row, key };
}
function activeFocusElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
function isFocusableTarget(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

export function createJournalFieldOverlays(options?: {
  focusRoot?: HTMLElement;
  onVisibilityChange?: (open: boolean) => void;
  onStep?: () => void;
  onWeatherSelect?: (mode: CozyWeatherMode) => void;
  onSelectTrack?: (track: JukeboxTrack) => void;
  onResetTrack?: () => void;
  onJukeboxFilter?: () => void;
  onPostcardPinChange?: (pinned: boolean) => void;
}): JournalFieldOverlays {
  const fieldBackdrop = element("div", "journal-field-backdrop"); fieldBackdrop.hidden = true;
  const fieldCard = element("article", "journal-field-note");
  fieldCard.tabIndex = -1; fieldCard.setAttribute("role", "dialog");
  fieldCard.setAttribute("aria-modal", "true");
  fieldCard.setAttribute("aria-label", "Critter field note");
  const fieldClose = makeOverlayButton("journal-field-close", "Close field note", "×");
  const fieldLeft = element("div", "journal-field-left");
  const fieldSpecimen = element("div", "journal-field-specimen");
  const fieldPortrait = element("div", "journal-field-portrait die-cut");
  fieldPortrait.setAttribute("role", "img");
  const fieldCharm = element("div", "journal-field-charm");
  fieldCharm.setAttribute("role", "img"); fieldCharm.hidden = true;
  fieldSpecimen.append(fieldPortrait, fieldCharm);
  const fieldOldFriend = element("span", "journal-field-old-friend");
  fieldOldFriend.textContent = "★ Old Friend"; fieldOldFriend.hidden = true;
  const fieldPager = element("div", "journal-field-pager"); fieldPager.hidden = true;
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
  fieldMeta.append(fieldFoundRow.row, fieldDetailRow.row, fieldFeelingsRow.row, fieldLovesRow.row);
  const blessingPlaque = createBlessingPlaque();
  fieldBody.append(fieldName, fieldSub, fieldMeta, fieldBlurb, blessingPlaque.root);
  fieldCard.append(fieldClose, fieldLeft, fieldBody);
  fieldBackdrop.append(fieldCard);

  let fieldSignature = "";
  let inspectedItem: InspectedJournalItem | null = null;
  let latestView: JournalFieldNoteSource | null = null;
  let fieldReturnFocusEl: HTMLElement | null = null;
  let lastNotifiedOpen = false;
  const onVisibilityChange = options?.onVisibilityChange;
  const onStep = options?.onStep;

  const restoreFieldFocus = (
    closingItem: InspectedJournalItem | null, fallback: HTMLElement | null,
  ): void => {
    const selector = focusRestoreSelector(closingItem);
    const root = options?.focusRoot ?? fieldBackdrop.parentElement;
    if (selector !== null && root !== null) {
      const slot = root.querySelector(selector);
      if (slot instanceof HTMLElement && slot.tabIndex >= 0 && isFocusableTarget(slot)) {
        slot.focus({ preventScroll: true }); return;
      }
    }
    if (isFocusableTarget(fallback)) fallback.focus({ preventScroll: true });
  };

  const clearFieldNote = (): void => {
    fieldReturnFocusEl = null;
    if (inspectedItem === null && fieldBackdrop.hidden) return;
    inspectedItem = null; fieldSignature = "";
    fieldPager.hidden = true; blessingPlaque.hide(); fieldBackdrop.hidden = true;
  };

  const PEER_KEYS = ["jukebox", "encore", "hearts", "weather", "ribbons", "postcards"] as const;
  type TreasuresPeer = (typeof PEER_KEYS)[number];
  const returnToTreasures: Record<TreasuresPeer, boolean> = {
    weather: false, ribbons: false, hearts: false, encore: false, jukebox: false, postcards: false,
  };
  const treasures = createJournalTreasuresCard({ onVisibilityChange: () => syncVisibility() });
  const attachOverlay = (overlay: HTMLElement): void => {
    const host = options?.focusRoot ?? treasures.backdrop.parentElement;
    if (host !== null && overlay.parentElement !== host) host.append(overlay);
  };
  const clearPeers = (keep?: TreasuresPeer | "gems"): void => {
    clearFieldNote();
    if (keep === "gems" || keep === undefined) treasures.clear();
    if (keep !== "gems") gemsLedger.clear();
    for (const key of PEER_KEYS) {
      if (keep === key) continue;
      returnToTreasures[key] = false; peerModals[key].clear();
    }
  };
  const peerHooks = (key: TreasuresPeer) => ({
    onBeforeOpen: () => clearPeers(key),
    onClose: () => {
      if (returnToTreasures[key] && treasures.isOpen()) treasures.setCovered(false);
      returnToTreasures[key] = false;
    },
    onVisibilityChange: () => syncVisibility(),
  });
  const weatherAlmanac = createJournalWeatherAlmanac({
    ...peerHooks("weather"), onSelectMode: options?.onWeatherSelect,
  });
  const ribbonsShowcase = createJournalRibbonsShowcase(peerHooks("ribbons"));
  const heartsAlbum = createJournalHeartsAlbum(peerHooks("hearts"));
  const encoreCase = createJournalEncoreCase(peerHooks("encore"));
  const jukeboxAlbum = createJournalJukeboxAlbum({
    ...peerHooks("jukebox"),
    onSelectTrack: options?.onSelectTrack, onResetTrack: options?.onResetTrack,
    onFilterChange: options?.onJukeboxFilter,
  });
  const postcardsAlbum = createJournalPostcardsAlbum({
    ...peerHooks("postcards"),
    onAction: options?.onJukeboxFilter, onStep: options?.onStep,
    onPinChange: options?.onPostcardPinChange,
  });
  const peerModals = {
    weather: weatherAlmanac, ribbons: ribbonsShowcase, hearts: heartsAlbum,
    encore: encoreCase, jukebox: jukeboxAlbum, postcards: postcardsAlbum,
  };
  treasures.titleWrap.append(
    ribbonsShowcase.treasuresBtn, weatherAlmanac.treasuresBtn,
    heartsAlbum.treasuresBtn, encoreCase.treasuresBtn,
    jukeboxAlbum.treasuresBtn, postcardsAlbum.treasuresBtn,
  );
  const gemsLedger = createJournalGemsLedger({
    onBeforeOpen: () => clearPeers("gems"),
    onVisibilityChange: () => syncVisibility(),
  });
  const childModals = [
    postcardsAlbum, jukeboxAlbum, encoreCase, heartsAlbum,
    weatherAlmanac, ribbonsShowcase, gemsLedger,
  ] as const;
  const hasOpen = (): boolean =>
    treasures.isOpen() || inspectedItem !== null || childModals.some((modal) => modal.isOpen());
  const isTreasuresCovered = (): boolean =>
    PEER_KEYS.some((key) => returnToTreasures[key] && peerModals[key].isOpen());

  const syncVisibility = (): void => {
    const nowOpen = hasOpen();
    if (nowOpen !== lastNotifiedOpen) {
      lastNotifiedOpen = nowOpen; onVisibilityChange?.(nowOpen);
    }
  };

  const syncPager = (view: JournalFieldNoteSource | null): void => {
    if (inspectedItem === null || view === null) { fieldPager.hidden = true; return; }
    const ids = inspectableShelfIds(view, inspectedItem.kind);
    const index = ids.indexOf(inspectedItem.id);
    if (ids.length < 2 || index === -1) { fieldPager.hidden = true; return; }
    fieldPager.hidden = false; setText(fieldCounter, `${index + 1} / ${ids.length}`);
  };

  const closeFieldNote = (): void => {
    const closingItem = inspectedItem; const returnTarget = fieldReturnFocusEl;
    clearFieldNote(); syncVisibility(); restoreFieldFocus(closingItem, returnTarget);
  };
  const closeTreasures = (): void => treasures.close();
  const syncTreasures = (view: JournalFieldNoteSource): void => {
    treasures.setCovered(isTreasuresCovered()); treasures.sync(view);
  };

  const applyFieldNote = (data: FieldNoteData, view: JournalFieldNoteSource | null): void => {
    fieldBackdrop.hidden = false; syncPager(view);
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
    setText(fieldName, data.name); setText(fieldSub, data.subtitle);
    fieldOldFriend.hidden = !data.oldFriend;
    setText(fieldFoundRow.key, data.foundKey); setText(fieldLands, data.foundValue);
    setText(fieldDetailRow.key, data.detailKey); setText(fieldCalms, data.detailValue);
    fieldFeelingsRow.row.hidden = data.feelings === null;
    fieldLovesRow.row.hidden = data.favouriteTreats === null;
    if (data.feelings !== null) {
      fieldFeelings.replaceChildren(...data.feelings.map((feeling) => {
        const pill = element("span", "journal-field-feeling");
        pill.append(icon(feelingMarkup[feeling.id], "journal-field-feeling-icon"), feeling.label);
        return pill;
      }));
    }
    if (data.favouriteTreats !== null) {
      fieldLoves.replaceChildren(...data.favouriteTreats.map((treat) => {
        const pill = element("span", "journal-field-love-pill");
        pill.append(icon(heartMarkup, "journal-field-heart"), treat);
        return pill;
      }));
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
    if (data === null) { clearFieldNote(); return; }
    applyFieldNote(data, view);
  };

  const stepFieldNote = (delta: -1 | 1): boolean => {
    if (fieldBackdrop.hidden || inspectedItem === null || latestView === null) return false;
    const stepped = stepInspectedItem(latestView, inspectedItem, delta);
    if (stepped === null) return false;
    inspectedItem = stepped.next; syncFieldNote(latestView); onStep?.();
    return true;
  };

  const syncRibbons = (view: JournalFieldNoteSource, anchor?: Element): void => {
    const summary = evaluateMeritRibbonsFromJournal(view);
    const showBanner =
      view.keepsakes !== undefined && ((view.stickersOwned ?? 0) > 0 || summary.earned > 0);
    ribbonsShowcase.syncTriggers(summary, showBanner, anchor);
  };

  const openRibbons = (
    view: JournalFieldNoteSource | null, returnTarget?: HTMLElement | null,
  ): void => {
    const source = view ?? latestView;
    if (source === null) return;
    if (treasures.isOpen() && returnTarget === ribbonsShowcase.treasuresBtn) {
      returnToTreasures.ribbons = true; treasures.setCovered(true);
    } else {
      returnToTreasures.ribbons = false; treasures.clear();
    }
    ribbonsShowcase.open(evaluateMeritRibbonsFromJournal(source), returnTarget);
  };

  fieldPrev.addEventListener("click", () => { stepFieldNote(-1); });
  fieldNext.addEventListener("click", () => { stepFieldNote(1); });
  fieldClose.addEventListener("click", closeFieldNote);
  fieldBackdrop.addEventListener("click", (e) => {
    if (e.target === fieldBackdrop) closeFieldNote();
  });
  ribbonsShowcase.treasuresBtn.addEventListener("click", () =>
    openRibbons(latestView, ribbonsShowcase.treasuresBtn));
  ribbonsShowcase.banner.addEventListener("click", () =>
    openRibbons(latestView, ribbonsShowcase.banner));
  const openFromTreasures = (key: TreasuresPeer, overlay: HTMLElement, launch: () => void) => {
    attachOverlay(overlay);
    returnToTreasures[key] = treasures.isOpen();
    if (treasures.isOpen()) treasures.setCovered(true);
    launch();
  };
  weatherAlmanac.treasuresBtn.addEventListener("click", () => openFromTreasures(
    "weather", weatherAlmanac.overlay, () => weatherAlmanac.open(weatherAlmanac.treasuresBtn)));
  heartsAlbum.treasuresBtn.addEventListener("click", () => openFromTreasures(
    "hearts", heartsAlbum.overlay,
    () => heartsAlbum.open(latestView?.heartToHearts, heartsAlbum.treasuresBtn)));
  encoreCase.treasuresBtn.addEventListener("click", () => openFromTreasures(
    "encore", encoreCase.overlay,
    () => encoreCase.open(latestView?.encoreSummary, encoreCase.treasuresBtn)));
  jukeboxAlbum.treasuresBtn.addEventListener("click", () => openFromTreasures(
    "jukebox", jukeboxAlbum.overlay,
    () => jukeboxAlbum.open(latestView, jukeboxAlbum.treasuresBtn)));
  postcardsAlbum.treasuresBtn.addEventListener("click", () => openFromTreasures(
    "postcards", postcardsAlbum.overlay,
    () => postcardsAlbum.open(postcardsAlbum.treasuresBtn)));

  const closeAll = (): void => { clearPeers(); lastNotifiedOpen = false; };
  const topOverlay = (): HTMLElement | null =>
    childModals.find((modal) => modal.isOpen())?.overlay ??
    (treasures.isOpen() ? treasures.backdrop : inspectedItem !== null ? fieldBackdrop : null);
  const dismiss = (): boolean => {
    for (const modal of childModals) { if (modal.isOpen()) { modal.close(); return true; } }
    if (treasures.isOpen()) { closeTreasures(); return true; }
    if (inspectedItem !== null) { closeFieldNote(); return true; }
    return false;
  };
  const focusFieldAndSync = (): void => {
    if (!fieldBackdrop.hidden) fieldCard.focus({ preventScroll: true });
    syncVisibility();
  };

  return {
    fieldBackdrop, treasuresBackdrop: treasures.backdrop,
    gemsOverlay: gemsLedger.overlay, ribbonsOverlay: ribbonsShowcase.overlay,
    ribbonsBanner: ribbonsShowcase.banner,
    inspect: (item, view) => {
      if (inspectedItem === null) fieldReturnFocusEl = activeFocusElement();
      inspectedItem = item;
      if (view !== null) syncFieldNote(view);
      focusFieldAndSync();
    },
    openPrize: (prize, view) => {
      if (!prize.owned || prize.image === null) return;
      if (inspectedItem === null) fieldReturnFocusEl = activeFocusElement();
      inspectedItem = { kind: "prize", id: prize.id };
      if (view !== undefined && view !== null) syncFieldNote(view);
      else applyFieldNote(prizeFieldNoteData(prize), null);
      focusFieldAndSync();
    },
    openTreasures: (view) => { treasures.setCovered(isTreasuresCovered()); treasures.open(view); },
    openGems: (view, returnTarget) => { gemsLedger.open(view?.starGems, returnTarget); },
    openRibbons, syncFieldNote, syncTreasures,
    syncGems: (view) => gemsLedger.sync(view.starGems),
    syncRibbons,
    syncAll: (view, ribbonsAnchor) => {
      syncFieldNote(view); syncTreasures(view);
      gemsLedger.sync(view.starGems); syncRibbons(view, ribbonsAnchor);
      heartsAlbum.sync(view.heartToHearts); encoreCase.sync(view.encoreSummary);
      jukeboxAlbum.sync(view); postcardsAlbum.sync();
    },
    stepFieldNote,
    navigateOverlay: (direction) => {
      if (inspectedItem !== null && (direction === "left" || direction === "right")) {
        return stepFieldNote(direction === "right" ? 1 : -1);
      }
      const root = topOverlay();
      return root !== null && stepOverlayFocus(root, direction);
    },
    activateOverlay: () => {
      const root = topOverlay(); return root !== null && activateOverlayButton(root);
    },
    scrollOverlay: (deltaY) => {
      const root = topOverlay(); return root !== null && scrollOverlayContainer(root, deltaY);
    },
    closeFieldNote, closeTreasures,
    closeGems: () => gemsLedger.close(),
    closeRibbons: () => ribbonsShowcase.close(),
    closeAll, hasOpen, dismiss,
    handleKeydown: (event) => {
      if (childModals.some((modal) => modal.handleKeydown(event))) return true;
      if (treasures.handleKeydown(event)) return true;
      if (inspectedItem === null) return false;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); closeFieldNote();
      } else if (
        !fieldBackdrop.hidden && (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault(); stepFieldNote(event.key === "ArrowRight" ? 1 : -1);
      }
      return true;
    },
  };
}
