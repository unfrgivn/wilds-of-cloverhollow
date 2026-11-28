import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function extractMediaBlocks(css: string, mediaQuery: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const start = css.indexOf(mediaQuery, cursor);
    if (start === -1) break;
    const openBrace = css.indexOf("{", start + mediaQuery.length);
    if (openBrace === -1) break;
    let depth = 1;
    let index = openBrace + 1;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(openBrace + 1, index - 1));
    cursor = index;
  }
  return blocks;
}

describe("Milestone 169: WCAG 2.4.7 :focus-visible & @media (hover: hover) Gate", () => {
  const battleCommandHover =
    '.battle-command:not(:disabled):not([aria-disabled="true"]):not([aria-selected="true"]):hover';
  const sheets: readonly {
    file: string;
    focusVisible: readonly string[];
    hoverSelectors: readonly string[];
    reducedMediaSnippets: readonly string[];
    reducedDataSnippets: readonly string[];
  }[] = [
    {
      file: "src/ui/title.css",
      focusVisible: [
        ".title-option:focus-visible",
        ".title-confirm-button:focus-visible",
      ],
      hoverSelectors: [
        '.title-option:not([aria-selected="true"]):hover',
        '.title-confirm-button:not([aria-selected="true"]):hover',
      ],
      reducedMediaSnippets: [
        '.title-option:not([aria-selected="true"]):hover',
        '.title-confirm-button:not([aria-selected="true"]):hover',
        "transform: none;",
      ],
      reducedDataSnippets: [
        ':root[data-reduced-motion="on"] .title-option:not([aria-selected="true"]):hover',
        ':root[data-reduced-motion="on"] .title-confirm-button:not([aria-selected="true"]):hover',
      ],
    },
    {
      file: "src/ui/sticker.css",
      focusVisible: [
        ".sticker-choice:focus-visible",
        ".sticker-prompt:focus-visible",
      ],
      hoverSelectors: [
        '.sticker-choice:not([aria-selected="true"]):hover',
        ".sticker-prompt:hover",
      ],
      reducedMediaSnippets: [
        '.sticker-choice:not([aria-selected="true"]):hover',
        "transform: none;",
      ],
      reducedDataSnippets: [
        ':root[data-reduced-motion="on"] .sticker-choice:not([aria-selected="true"]):hover',
      ],
    },
    {
      file: "src/ui/battle.css",
      focusVisible: [
        ".battle-command:focus-visible",
        ".battle-together-btn:focus-visible",
        ".battle-flute-btn:focus-visible",
        ".battle-lasso-btn:focus-visible",
      ],
      hoverSelectors: [
        battleCommandHover,
        ".battle-calm.is-peekable:hover",
        ".battle-together-btn:hover",
        ".battle-flute-btn:hover",
        ".battle-lasso-btn:hover",
      ],
      reducedMediaSnippets: [
        battleCommandHover,
        ".battle-together-btn:hover",
        "transform: none;",
      ],
      reducedDataSnippets: [
        ':root[data-reduced-motion="on"]',
        battleCommandHover,
        ':root[data-reduced-motion="on"] .battle-together-btn:hover',
      ],
    },
    {
      file: "src/ui/journal.css",
      focusVisible: [
        ".journal-tab:focus-visible",
        ".journal-close:focus-visible",
        ".journal-opt-toggle:focus-visible",
        ".journal-opt-slider:focus-visible",
      ],
      hoverSelectors: [
        '.journal-tab:not([aria-selected="true"]):hover',
        ".journal-close:hover",
        ".journal-opt-toggle:hover",
      ],
      reducedMediaSnippets: [
        '.journal-tab:not([aria-selected="true"]):hover',
        ".journal-close:hover",
        "transform: none;",
      ],
      reducedDataSnippets: [
        ':root[data-reduced-motion="on"] .journal-tab:not([aria-selected="true"]):hover',
        ':root[data-reduced-motion="on"] .journal-close:hover',
      ],
    },
  ];

  it("enforces :focus-visible, @media (hover: hover), and reduced-motion parity", () => {
    for (const sheet of sheets) {
      const css = readFileSync(sheet.file, "utf8");
      for (const selector of sheet.focusVisible) {
        expect(css, `${sheet.file} missing ${selector}`).toContain(selector);
      }

      const hoverBlocks = extractMediaBlocks(css, "@media (hover: hover) and (pointer: fine)");
      expect(hoverBlocks.length, `${sheet.file} missing @media (hover: hover)`).toBeGreaterThan(0);
      const hoverJoined = hoverBlocks.join("\n");
      for (const selector of sheet.hoverSelectors) {
        expect(hoverJoined, `${sheet.file} hover missing ${selector}`).toContain(selector);
      }

      const reducedBlocks = extractMediaBlocks(css, "@media (prefers-reduced-motion: reduce)");
      expect(reducedBlocks.length, `${sheet.file} missing reduced-motion block`).toBeGreaterThan(0);
      const reducedJoined = reducedBlocks.join("\n");
      for (const snippet of sheet.reducedMediaSnippets) {
        expect(reducedJoined, `${sheet.file} reduced-motion media missing ${snippet}`).toContain(
          snippet,
        );
      }
      for (const snippet of sheet.reducedDataSnippets) {
        expect(css, `${sheet.file} data-reduced-motion missing ${snippet}`).toContain(snippet);
      }
    }
  });

  it("hides .qa-touch-trigger across credits, photo, title, and qa-console states", () => {
    const qaCss = readFileSync("src/ui/qa.css", "utf8");
    for (const selector of [
      ':root[data-credits="open"] .qa-touch-trigger',
      ':root[data-photo="on"] .qa-touch-trigger',
      ':root[data-title="open"] .qa-touch-trigger',
      ':root[data-qa-console="open"] .qa-touch-trigger',
    ]) {
      expect(qaCss, `src/ui/qa.css missing ${selector}`).toContain(selector);
    }
  });

  it("keeps src/main.ts cleanly under 950 lines", () => {
    const lines = readFileSync("src/main.ts", "utf8").trimEnd().split("\n").length;
    expect(lines).toBeLessThan(950);
  });
});
