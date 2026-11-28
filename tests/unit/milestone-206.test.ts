import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, storyTags } from "../../src/content/load";
import { jukeboxTracks } from "../../src/core";
import {
  FALLBACK_VOICE,
  NARRATION_VOICE,
  TRACK_SCALES,
} from "../../src/platform/voice-catalog";
import {
  blipFrequency,
  trackScaleNotes,
  voiceForSpeaker,
} from "../../src/platform/voices";

const { world } = loadContent();

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 206: Track E19E Hearts Scroll, Flute Modal & Modular Splits", () => {
  it("guards Harmony Flute Wheel hover lift and mirrors reduced-motion suppression", () => {
    const css = readFileSync("src/ui/flute-wheel.css", "utf8");
    expect(css).toContain(".flute-wheel:focus,");
    expect(css).toContain(".flute-wheel:focus-visible");
    expect(css).toMatch(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[^}]*\.flute-wheel-btn:hover/s,
    );
    expect(css).toContain("transform: translateY(-2px);");
    expect(css).toContain(".flute-wheel-close:hover");
    expect(css).toContain("transform: scale(1.05);");

    const mediaReduce = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/);
    expect(mediaReduce).not.toBeNull();
    const reduceBlock = mediaReduce?.[0] ?? "";
    expect(reduceBlock).toContain(".flute-wheel-btn:hover");
    expect(reduceBlock).toContain(".flute-wheel-close:hover");
    expect(reduceBlock).toContain("transform: none;");

    expect(css).toContain(':root[data-reduced-motion="on"] .flute-wheel-btn:hover');
    expect(css).toContain(':root[data-reduced-motion="on"] .flute-wheel-close:hover');
    expect(css).toContain(':root[data-reduced-motion="on"] .flute-wheel-close');
  });

  it("preserves 100% voice coverage across all compiled speakers, critters & 35 tracks", () => {
    const storySpeakers = new Set<string>();
    for (const tag of storyTags(world.story)) {
      if (tag.startsWith("speaker:")) {
        storySpeakers.add(tag.slice("speaker:".length).trim());
      }
    }
    const critterNames = Object.values(world.critters).map((critter) => critter.name);
    const allSpeakers = [...new Set([...storySpeakers, ...critterNames])].sort();
    expect(allSpeakers.length).toBeGreaterThanOrEqual(120);

    expect(voiceForSpeaker("__unknown_m205_probe__")).toBe(FALLBACK_VOICE);
    expect(voiceForSpeaker(null)).toBe(NARRATION_VOICE);

    for (const speaker of allSpeakers) {
      const voice = voiceForSpeaker(speaker);
      expect(voice, `${speaker} must not fall back`).not.toBe(FALLBACK_VOICE);
      const blip = blipFrequency(speaker, 0, "a");
      expect(blip, `${speaker} blip`).not.toBeNull();
      expect(blip?.frequency).toBeGreaterThan(100);
    }

    expect(jukeboxTracks.length).toBe(35);
    for (const track of jukeboxTracks) {
      const scale = trackScaleNotes(track);
      expect(scale).toBe(TRACK_SCALES[track]);
      expect(scale.length).toBe(6);
      for (const hz of scale) expect(hz).toBeGreaterThan(200);
    }
    expect(trackScaleNotes("silent")).toBe(TRACK_SCALES.silent);
  });

  it("enforces strict modular implementation line budgets after voice & entity splits", () => {
    expect(lineCount("src/platform/voices.ts")).toBeLessThan(390);
    expect(lineCount("src/platform/voice-catalog.ts")).toBeLessThan(580);
    expect(lineCount("src/render/entity-layer.ts")).toBeLessThan(660);
    expect(lineCount("src/render/entity-critters.ts")).toBeLessThan(340);
    expect(lineCount("src/main.ts")).toBeLessThan(885);
    expect(lineCount("src/render/view.ts")).toBeLessThan(670);
    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(650);
    expect(lineCount("src/ui/journal-hearts.ts")).toBeLessThan(260);
  });
});
