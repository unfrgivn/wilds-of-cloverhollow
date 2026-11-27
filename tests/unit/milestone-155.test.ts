import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { effectRecipe, effectRecipes } from "../../src/platform/audio-recipes";
import { voiceForSpeaker } from "../../src/platform/voices";
import { createToolEventChimeSync, shouldPlayToolEventChime } from "../../src/shell/feedback";
import { focusRestoreSelector } from "../../src/ui/journal-field-note";
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";

describe("Milestone 155: 100% Living NPC Profile Voice, Accent & Portrait Parity", () => {
  it("covers voice, accent, and portrait for all 53 profiles and living NPC speakers", () => {
    const { world } = loadContent();
    const fallbackVoice = voiceForSpeaker("__unknown_living_npc_probe__");

    const profiles = Object.values(world.npcProfiles);
    expect(profiles).toHaveLength(53);

    const speakers = new Set<string>();
    for (const profile of profiles) {
      speakers.add(profile.name);
    }
    for (const pair of world.npcBanter) {
      for (const speakerId of pair.speakers) {
        const resolved = world.npcProfiles[speakerId]?.name ?? speakerId;
        speakers.add(resolved);
      }
    }
    for (const entry of world.partyBanter) {
      for (const turn of entry.turns) {
        const resolved =
          world.party[turn.speaker]?.name ??
          world.npcProfiles[turn.speaker]?.name ??
          turn.speaker;
        speakers.add(resolved);
      }
    }
    for (const event of world.toolEvents) {
      for (const turn of event.turns) {
        const resolved =
          world.npcProfiles[turn.speaker]?.name ??
          world.party[turn.speaker]?.name ??
          turn.speaker;
        speakers.add(resolved);
      }
    }

    const fallbackVoices: string[] = [];
    const defaultAccents: string[] = [];
    const missingPortraits: string[] = [];

    for (const speaker of [...speakers].sort()) {
      if (voiceForSpeaker(speaker) === fallbackVoice) fallbackVoices.push(speaker);
      if (speakerAccent(speaker) === "default") defaultAccents.push(speaker);
      if (speakerPortraitSource(world, speaker) === null) missingPortraits.push(speaker);
    }

    expect(fallbackVoices).toEqual([]);
    expect(defaultAccents).toEqual([]);
    expect(missingPortraits).toEqual([]);

    expect(voiceForSpeaker("Nurse Clover")).toEqual(voiceForSpeaker("Nurse Holly"));
    expect(speakerAccent("Nurse Clover")).toBe("school");
    expect(speakerPortraitSource(world, "Nurse Clover")).toEqual({
      atlas: world.characters.nurse?.atlas,
      frame: "down_idle_01",
      cropMode: "adult",
    });
  });
});

describe("Milestone 155: Interactive Tool Micro-Event Sparkle Chime", () => {
  it("defines tool-sparkle as a gentle 3-note celesta shimmer with zero square waves", () => {
    const recipe = effectRecipes["tool-sparkle"];
    expect(recipe).toEqual(effectRecipe("tool-sparkle"));
    expect(recipe).toHaveLength(3);

    const frequencies: number[] = [];
    const offsets: number[] = [];
    const gains: number[] = [];

    for (const segment of recipe) {
      expect(segment.wave).toBe("sine");
      expect(segment.gain).toBeGreaterThan(0);
      expect(segment.gain).toBeLessThanOrEqual(0.08);
      expect(segment.duration).toBeGreaterThan(0);
      if (segment.wave === "sine") frequencies.push(segment.frequency);
      offsets.push(segment.offset);
      gains.push(segment.gain);
    }

    expect(frequencies).toEqual([659, 880, 1318.5]);
    expect(offsets).toEqual([0, 0.055, 0.11]);
    expect(gains).toEqual([0.055, 0.05, 0.045]);
  });

  it("fires shouldPlayToolEventChime strictly on null/other -> activeId transitions", () => {
    expect(shouldPlayToolEventChime(null, null)).toBe(false);
    expect(shouldPlayToolEventChime("cavern-crystal-resonance", null)).toBe(false);
    expect(shouldPlayToolEventChime(null, "cavern-crystal-resonance")).toBe(true);
    expect(
      shouldPlayToolEventChime("cavern-crystal-resonance", "cavern-crystal-resonance"),
    ).toBe(false);
    expect(
      shouldPlayToolEventChime("mist-sage-lantern", "mist-bluebell-awakening"),
    ).toBe(true);
  });

  it("tracks live overworld transitions and resets on area change, overlay leave, or reset", () => {
    let chimes = 0;
    const tracker = createToolEventChimeSync(() => {
      chimes += 1;
    });

    // Paused frame must not fire even when an event activates.
    tracker.sync("cavern", true, false, "cavern-crystal-resonance");
    expect(chimes).toBe(0);

    // Leaving overworld clears tracked id, so returning live to an active event chimes once.
    tracker.sync("cavern", false, true, "cavern-crystal-resonance");
    tracker.sync("cavern", true, true, "cavern-crystal-resonance");
    expect(chimes).toBe(1);

    // Staying on the same active event does not re-chime.
    tracker.sync("cavern", true, true, "cavern-crystal-resonance");
    expect(chimes).toBe(1);

    // Area change clears tracked id cleanly.
    tracker.sync("mist", true, true, "mist-bluebell-awakening");
    expect(chimes).toBe(2);

    // Explicit reset clears tracked id cleanly.
    tracker.reset();
    tracker.sync("mist", true, true, "mist-bluebell-awakening");
    expect(chimes).toBe(3);
  });
});

describe("Milestone 155: Accessible Modal Focus Restore Selector", () => {
  it("maps all 4 InspectedJournalItem kinds accurately and returns null for null", () => {
    expect(focusRestoreSelector(null)).toBeNull();
    expect(focusRestoreSelector({ kind: "sticker", id: "fountain-frog" })).toBe(
      '.journal-stickers .journal-slot[data-sticker="fountain-frog"]',
    );
    expect(focusRestoreSelector({ kind: "prize", id: "pup-plush" })).toBe(
      '.journal-prizes .journal-slot[data-prize="pup-plush"]',
    );
    expect(focusRestoreSelector({ kind: "fish", id: "bubble-guppy" })).toBe(
      '.journal-fish .journal-slot[data-fish="bubble-guppy"]',
    );
    expect(focusRestoreSelector({ kind: "keepsake", id: "star-map" })).toBe(
      '.journal-keepsakes .journal-slot[data-keepsake="star-map"]',
    );
  });
});

describe("Milestone 155: Battle Stage Render Extraction Size Budget", () => {
  it("keeps src/render/battle-view.ts cleanly under 720 lines and stage renderer under 500", () => {
    const battleViewLines = readFileSync("src/render/battle-view.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    const stageRenderLines = readFileSync("src/render/battle-stage-render.ts", "utf8")
      .trimEnd()
      .split("\n").length;

    expect(battleViewLines).toBeLessThan(700);
    expect(battleViewLines).toBeLessThan(720);
    expect(stageRenderLines).toBeLessThan(500);
  });
});
