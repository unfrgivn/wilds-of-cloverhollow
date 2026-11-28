import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  phraseDynamics,
  VOICE_PAN,
} from "../../src/platform/music";
import {
  hasMicroTiming,
  midiToHz,
  phraseDynamics as directPhraseDynamics,
  VOICE_PAN as directVoicePan,
} from "../../src/platform/music-synth";
import { modalScrollDelta } from "../../src/ui/journal-nav";

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 204: Track E19D Modal Scrolling, Toast Hygiene & Music Synth Split", () => {
  it("computes deterministic modalScrollDelta steps for all scroll keys and null otherwise", () => {
    expect(modalScrollDelta("ArrowDown", 300)).toEqual({ mode: "delta", amount: 72 });
    expect(modalScrollDelta("ArrowUp", 300)).toEqual({ mode: "delta", amount: -72 });
    expect(modalScrollDelta("PageDown", 300)).toEqual({ mode: "delta", amount: 225 });
    expect(modalScrollDelta("PageUp", 300)).toEqual({ mode: "delta", amount: -225 });
    expect(modalScrollDelta("PageDown", 100)).toEqual({ mode: "delta", amount: 120 });
    expect(modalScrollDelta("PageUp", 100)).toEqual({ mode: "delta", amount: -120 });
    expect(modalScrollDelta("PageDown", Number.NaN)).toEqual({ mode: "delta", amount: 120 });
    expect(modalScrollDelta("Home", 300)).toEqual({ mode: "top", amount: 0 });
    expect(modalScrollDelta("End", 300)).toEqual({ mode: "bottom", amount: 0 });
    expect(modalScrollDelta("Escape", 300)).toBeNull();
    expect(modalScrollDelta("ArrowLeft", 300)).toBeNull();
    expect(modalScrollDelta("Enter", 300)).toBeNull();
    expect(modalScrollDelta("j", 300)).toBeNull();
  });

  it("hides .ribbon-toast defensively under shrine, decor, and flute-wheel modals", () => {
    const css = readFileSync("src/ui/ribbon-toast.css", "utf8");
    const hideBlock = css.match(/\.ribbon-toast\[hidden\][^}]*display:\s*none;/s);
    expect(hideBlock).not.toBeNull();
    const block = hideBlock?.[0] ?? "";
    expect(block).toContain(':root[data-shrine="open"] .ribbon-toast');
    expect(block).toContain(':root[data-decor="open"] .ribbon-toast');
    expect(block).toContain(':root[data-flute-wheel="open"] .ribbon-toast');
    expect(block).toContain(':root[data-photo="on"] .ribbon-toast');
    expect(block).toContain(':root[data-title="open"] .ribbon-toast');
    expect(block).toContain(':root[data-cutscene="open"] .ribbon-toast');
    expect(block).toContain(':root[data-credits="open"] .ribbon-toast');
  });

  it("preserves music-synth reference identity and strict implementation line budgets", () => {
    expect(VOICE_PAN).toBe(directVoicePan);
    expect(phraseDynamics).toBe(directPhraseDynamics);
    expect(hasMicroTiming("harp")).toBe(true);
    expect(hasMicroTiming("bass")).toBe(false);
    expect(midiToHz(69)).toBeCloseTo(440, 6);

    expect(lineCount("src/platform/music.ts")).toBeLessThan(520);
    expect(lineCount("src/platform/music-synth.ts")).toBeLessThan(540);
    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(650);
    expect(lineCount("src/main.ts")).toBeLessThan(885);
    expect(lineCount("src/render/view.ts")).toBeLessThan(670);
  });
});
