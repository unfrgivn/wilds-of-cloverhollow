import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 238: Postcard Lightbox Touch/Keyboard Parity & < 600-Line src/ui/ Gate", () => {
  it("declares :root[data-touch=\"on\"] >= 44 px rules for all 5 Lightbox buttons", () => {
    const css = readFileSync("src/ui/journal-postcards.css", "utf8");
    const requiredSelectors = [
      ':root[data-touch="on"] .journal-lightbox-back',
      ':root[data-touch="on"] .journal-lightbox-prev',
      ':root[data-touch="on"] .journal-lightbox-next',
      ':root[data-touch="on"] .journal-lightbox-save',
      ':root[data-touch="on"] .journal-lightbox-remove',
    ];
    for (const selector of requiredSelectors) {
      expect(css, `missing touch rule for ${selector}`).toContain(selector);
    }
    const touchHeightRule = new RegExp(
      ':root\\[data-touch="on"\\] \\.journal-lightbox-back[\\s\\S]*?' +
        "\\.journal-lightbox-remove\\s*\\{[^}]*min-height:\\s*44px;",
    );
    const touchWidthRule = new RegExp(
      ':root\\[data-touch="on"\\] \\.journal-lightbox-prev,\\s*' +
        ':root\\[data-touch="on"\\] \\.journal-lightbox-next\\s*\\{[^}]*min-width:\\s*44px;',
    );
    expect(css).toMatch(touchHeightRule);
    expect(css).toMatch(touchWidthRule);
    expect(css).toContain("-webkit-touch-callout: none;");
    expect(css).toContain(':root[data-reduced-motion="on"]');

    const ts = readFileSync("src/ui/journal-postcards.ts", "utf8");
    expect(ts).toContain('["ArrowDown", "ArrowUp", "Home", "End"]');
    expect(ts).toContain("[lbBack, lbSave, lbRemove, closeBtn]");
  });

  it("enforces the global < 600-line src/ui/ architecture gate after Treasures extraction", () => {
    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(450);
    expect(lineCount("src/ui/journal-treasures-card.ts")).toBeLessThan(270);

    const uiFiles = readdirSync("src/ui")
      .filter((name) => name.endsWith(".ts"))
      .sort()
      .map((name) => join("src/ui", name));
    expect(uiFiles.length).toBeGreaterThan(25);
    for (const file of uiFiles) {
      const lines = lineCount(file);
      expect(lines, `${file} must be < 600 lines (got ${lines})`).toBeLessThan(600);
    }
  });
});
