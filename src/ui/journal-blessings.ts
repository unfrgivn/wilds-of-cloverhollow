import "./journal-blessings.css";
import { element, setAttribute, setText } from "./dom";
import {
  evaluateKeepsakeBlessingsFromIds,
  keepsakeBlessingFor,
} from "../core/blessings";
import type { KeepsakeId } from "../core/journal";

const svgNamespace = "http://www.w3.org/2000/svg";

export type JournalBlessingPlaque = {
  root: HTMLElement;
  update: (id: KeepsakeId) => void;
  hide: () => void;
};

export type JournalTreasuresBlessingsStrip = {
  root: HTMLDivElement;
  update: (ownedIds: readonly KeepsakeId[]) => void;
};

/** Pure inner SVG markup for a hand-inked sparkle star badge (zero `<text>` nodes). */
export function blessingStarMarkup(accent: string): string {
  return (
    `<path d="M 8.2 1.8 C 8.8 5.4 10.6 7.2 14.2 7.8 C 10.6 8.4 8.8 10.2 8.2 13.8 ` +
    `C 7.6 10.2 5.8 8.4 2.2 7.8 C 5.8 7.2 7.6 5.4 8.2 1.8 Z" ` +
    `fill="${accent}" stroke="#47321f" stroke-width="1.35" stroke-linejoin="round"/>` +
    `<circle cx="14.2" cy="13.8" r="1.45" fill="${accent}" stroke="#47321f" stroke-width="1"/>`
  );
}

/** Builds a hand-inked sparkle star SVG emblem tinted by a Keepsake Dream Blessing accent. */
export function createBlessingStarIcon(accent: string): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", "journal-blessing-star");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = blessingStarMarkup(accent);
  return svg;
}

/** Creates the warm cream-and-gold Dream Blessing Plaque for Keepsake Field Note Cards. */
export function createBlessingPlaque(): JournalBlessingPlaque {
  const root = element("section", "journal-blessing-plaque");
  root.hidden = true;
  const eyebrowRow = element("div", "journal-blessing-eyebrow-row");
  const starSlot = element("span", "journal-blessing-star-slot");
  const eyebrow = element("span", "journal-blessing-eyebrow");
  eyebrowRow.append(starSlot, eyebrow);
  const mainRow = element("div", "journal-blessing-main");
  const title = element("span", "journal-blessing-title");
  const effect = element("span", "journal-blessing-effect");
  mainRow.append(title, effect);
  const summary = element("p", "journal-blessing-summary");
  root.append(eyebrowRow, mainRow, summary);

  return {
    root,
    update: (id) => {
      const blessing = keepsakeBlessingFor(id);
      root.hidden = false;
      setAttribute(root, "data-blessing", blessing.id);
      setAttribute(root, "data-category", blessing.category);
      root.style.borderLeftColor = blessing.accent;
      starSlot.replaceChildren(createBlessingStarIcon(blessing.accent));
      setText(eyebrow, `DREAM BLESSING · ${blessing.category.toUpperCase()}`);
      setText(title, blessing.title);
      setText(effect, blessing.effectNote);
      setText(summary, blessing.summary);
    },
    hide: () => {
      root.hidden = true;
    },
  };
}

/** Creates the compact Dream Blessings summary strip for the Journal Field Treasures Card. */
export function createTreasuresBlessingsStrip(): JournalTreasuresBlessingsStrip {
  const root = element("div", "journal-treasures-blessings");
  const head = element("div", "journal-treasures-blessings-head");
  const label = element("span", "journal-treasures-blessings-label");
  head.append(label);
  const chips = element("div", "journal-treasures-blessings-chips");
  chips.hidden = true;
  root.append(head, chips);

  return {
    root,
    update: (ownedIds) => {
      const summary = evaluateKeepsakeBlessingsFromIds(ownedIds);
      root.classList.toggle("is-complete", summary.complete);
      setAttribute(root, "data-complete", String(summary.complete));
      setAttribute(root, "data-active", String(summary.active));
      setText(
        label,
        summary.complete
          ? `★ ${summary.active}/${summary.total} All Dream Blessings Active!`
          : `✦ Dream Blessings · ${summary.active}/${summary.total} Active`,
      );
      const activeBlessings = summary.blessings.filter((entry) => entry.active);
      chips.hidden = activeBlessings.length === 0;
      chips.replaceChildren(
        ...activeBlessings.map((blessing) => {
          const chip = element("span", "journal-blessing-chip");
          setAttribute(chip, "data-blessing", blessing.id);
          chip.style.setProperty("--blessing-accent", blessing.accent);
          const dot = element("span", "journal-blessing-dot");
          dot.setAttribute("aria-hidden", "true");
          chip.append(dot, blessing.title);
          return chip;
        }),
      );
    },
  };
}
