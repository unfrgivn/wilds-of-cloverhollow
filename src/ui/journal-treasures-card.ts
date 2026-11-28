import { element, setAttribute, setText } from "./dom";
import { createTreasuresBlessingsStrip } from "./journal-blessings";
import { treasuresSignature, type JournalFieldNoteSource } from "./journal-field-note-data";
import { applyModalScrollKey } from "./journal-nav";
import { isKeepsakeId } from "../core/blessings";

export type JournalTreasuresCardOptions = {
  onVisibilityChange?: () => void;
};

export type JournalTreasuresCard = {
  backdrop: HTMLDivElement;
  card: HTMLElement;
  titleWrap: HTMLDivElement;
  sync: (view: JournalFieldNoteSource) => void;
  open: (view: JournalFieldNoteSource | null) => void;
  close: () => void;
  clear: () => void;
  setCovered: (covered: boolean) => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
  focusCard: () => void;
};

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

function isFocusableTarget(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

/** Creates the Field Treasures modal card (stamps, blessings, keepsakes, and catch book). */
export function createJournalTreasuresCard(
  options?: JournalTreasuresCardOptions,
): JournalTreasuresCard {
  const backdrop = element("div", "journal-treasures-backdrop");
  backdrop.hidden = true;
  const card = element("article", "journal-treasures-card");
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Field treasures");

  const closeBtn = element("button", "journal-treasures-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close field treasures");
  closeBtn.textContent = "×";

  const head = element("div", "journal-treasures-head");
  const titleWrap = element("div", "journal-treasures-title-wrap");
  const title = element("h3", "journal-treasures-title");
  title.textContent = "FIELD TREASURES";
  titleWrap.append(title);
  head.append(titleWrap, closeBtn);

  const stamps = element("div", "journal-treasures-stamps");
  stamps.hidden = true;
  const blessings = createTreasuresBlessingsStrip();
  const keepsakesSec = makeTreasuresSection("CLUBHOUSE KEEPSAKES", "journal-keepsakes-grid");
  const catchSec = makeTreasuresSection("BUBBLEGUM BAY CATCH BOOK", "journal-catch-row");
  card.append(head, stamps, blessings.root, keepsakesSec.section, catchSec.section);
  backdrop.append(card);

  let openState = false;
  let covered = false;
  let lastSignature = "";
  let returnFocusEl: HTMLElement | null = null;

  const focusCard = (): void => {
    card.focus({ preventScroll: true });
  };

  const clear = (): void => {
    returnFocusEl = null;
    covered = false;
    if (!openState && backdrop.hidden) return;
    openState = false;
    backdrop.hidden = true;
  };

  const close = (): void => {
    const returnTarget = returnFocusEl;
    clear();
    options?.onVisibilityChange?.();
    if (isFocusableTarget(returnTarget)) returnTarget.focus({ preventScroll: true });
  };

  const setCovered = (nextCovered: boolean): void => {
    covered = nextCovered;
    if (openState) backdrop.hidden = covered;
  };

  const sync = (view: JournalFieldNoteSource): void => {
    const summary = view.treasures;
    if (!openState || summary === undefined || !summary.hasAny) {
      if (!backdrop.hidden) clear();
      return;
    }
    backdrop.hidden = covered;
    const signature = treasuresSignature(summary);
    if (signature === lastSignature) return;
    lastSignature = signature;

    stamps.hidden = !summary.stamps.started;
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
      stamps.replaceChildren(...nodes);
    } else {
      stamps.replaceChildren();
    }

    setText(keepsakesSec.count, `${summary.unlockedKeepsakes}/${summary.totalKeepsakes}`);
    blessings.update(
      summary.keepsakes
        .filter((item) => item.unlocked)
        .map((item) => item.id)
        .filter(isKeepsakeId),
    );
    keepsakesSec.body.replaceChildren(
      ...summary.keepsakes.map((item) => {
        const itemCard = element(
          "div",
          item.unlocked
            ? "journal-keepsake-item is-unlocked"
            : "journal-keepsake-item is-locked",
        );
        setAttribute(itemCard, "data-keepsake", item.id);
        const itemTitle = element("div", "journal-keepsake-name");
        itemTitle.textContent = item.unlocked ? `★ ${item.name}` : "???";
        const detail = element("div", "journal-keepsake-detail");
        detail.textContent = item.unlocked ? `${item.source} · ${item.note}` : item.source;
        itemCard.append(itemTitle, detail);
        return itemCard;
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

  const open = (view: JournalFieldNoteSource | null): void => {
    if (view?.treasures?.hasAny !== true) return;
    if (!openState) returnFocusEl = activeFocusElement();
    openState = true;
    sync(view);
    if (!backdrop.hidden) focusCard();
    options?.onVisibilityChange?.();
  };

  const handleKeydown = (event: KeyboardEvent): boolean => {
    if (!openState) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (applyModalScrollKey([card], event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
    return true;
  };

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  return {
    backdrop,
    card,
    titleWrap,
    sync,
    open,
    close,
    clear,
    setCovered,
    isOpen: () => openState,
    handleKeydown,
    focusCard,
  };
}
