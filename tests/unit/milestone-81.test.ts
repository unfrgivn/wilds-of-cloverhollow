import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { trackTitles, type MusicTrack } from "../../src/core";
import { blipFrequency, trackScaleNotes, voiceForSpeaker } from "../../src/platform/voices";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { parseAtlasJson } from "../../src/ui/atlas";
import {
  cropPortraitFrame,
  speakerAccent,
  speakerPortraitSource,
  type PortraitCropMode,
} from "../../src/ui/portraits";

const { world } = loadContent();

describe("Milestone 81: character-voiced talking blips & key-aligned UI scales", () => {
  it("assigns distinct warm musical voice profiles across cast archetypes", () => {
    const fae = voiceForSpeaker("Fae");
    const dad = voiceForSpeaker("Dad");
    const mom = voiceForSpeaker("Mom");
    const oliver = voiceForSpeaker("Oliver");
    const fairy = voiceForSpeaker("Lavender Fairy");
    const hooded = voiceForSpeaker("Hooded Kid");
    const frog = voiceForSpeaker("Fountain Frog");
    const bird = voiceForSpeaker("Bay Bluebird");
    const narration = voiceForSpeaker(null);

    expect(fae.wave).toBe("triangle");
    expect(fae.harmonic).toBe(1.5);
    expect(dad.notes[0]).toBeLessThan(mom.notes[0] ?? 0);
    expect(mom.notes[0]).toBeLessThan(fae.notes[0] ?? 0);
    expect(oliver.notes[0]).toBeGreaterThan(fae.notes[0] ?? 0);
    expect(oliver.glide).toBeGreaterThan(1);
    expect(fairy.harmonic).toBe(2);
    expect(hooded.glide).toBeLessThan(1);
    expect(bird.notes[0]).toBeGreaterThan(frog.notes[0] ?? 0);
    expect(narration.gain).toBeLessThan(fae.gain);
    expect(voiceForSpeaker("  fae ")).toEqual(fae);
  });

  it("computes deterministic musical blips and pauses on spaces and punctuation", () => {
    const first = blipFrequency("Fae", 3, "H");
    const repeat = blipFrequency("Fae", 3, "H");
    const next = blipFrequency("Fae", 6, "e");
    expect(first).not.toBeNull();
    expect(first).toEqual(repeat);
    expect(next).not.toBeNull();
    expect(voiceForSpeaker("Fae").notes).toContain(first?.frequency);
    expect(blipFrequency("Fae", 9, " ")).toBeNull();
    expect(blipFrequency("Fae", 9, "!")).toBeNull();
    expect(blipFrequency("Fae", 9, ".")).toBeNull();
    expect(blipFrequency("Oliver", 4, "a")?.endFrequency).toBeGreaterThan(
      blipFrequency("Oliver", 4, "a")?.frequency ?? 0,
    );
  });

  it("returns non-empty ascending pentatonic frequencies for every MusicTrack", () => {
    const tracks: readonly MusicTrack[] = [
      "title",
      "home",
      "cafe",
      "market",
      "parlor",
      "loft",
      "bloom",
      "school",
      "bay",
      "fishing",
      "cottage",
      "island",
      "pass",
      "lodge",
      "cabin",
      "summit",
      "cavern",
      "woods",
      "clubhouse",
      "hills",
      "road",
      "sanctuary",
      "festival",
      "arcade",
      "taco",
      "enchanted",
      "enchanted-calm",
      "battle",
      "boss",
      "encore",
      "talk",
      "hearts",
      "morning",
      "silent",
    ];
    expect([...tracks].sort()).toEqual(Object.keys(trackTitles).sort());
    for (const track of tracks) {
      const notes = trackScaleNotes(track);
      expect(notes.length, track).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < notes.length; i += 1) {
        const note = notes[i] ?? 0;
        expect(Number.isFinite(note), `${track}[${i}]`).toBe(true);
        expect(note, `${track}[${i}]`).toBeGreaterThan(100);
        if (i > 0) {
          expect(note, `${track}[${i}] ascending`).toBeGreaterThan(notes[i - 1] ?? 0);
        }
      }
    }
  });
});

describe("Milestone 81: die-cut speaker portraits & crops", () => {
  it("resolves every major speaker to an existing atlas and frame on disk", () => {
    const speakers = [
      "Fae",
      "Mom",
      "Dad",
      "Oliver",
      "Chef Bea",
      "Grandpa Barnaby",
      "Bree",
      "Toby",
      "Sue",
      "Jordan",
      "Maddie",
      "Milo",
      "Rosie",
      "Ms. Maple",
      "Ms. Clover",
      "Ms. Willow",
      "Ms. Reed",
      "Nurse Holly",
      "Coach Ash",
      "Ms. Rowan",
      "Mr. Bell",
      "Ms. Coral",
      "Mrs. Flurry",
      "Mr. Pip",
      "Hooded Kid",
      "Lavender",
      "Mint Fairy",
      "Sky Fairy",
      "Peach Fairy",
      "Fountain Frog",
      "Cozy Bat",
      "Gem Mole",
      "Pond Pup",
    ];
    for (const speaker of speakers) {
      const source = speakerPortraitSource(world, speaker);
      expect(source, speaker).not.toBeNull();
      if (source === null) continue;
      const diskPath = join(process.cwd(), "public", source.atlas);
      const atlas = parseAtlasJson(JSON.parse(readFileSync(diskPath, "utf8")), source.atlas);
      const frame = atlas.frames[source.frame]?.frame;
      expect(frame, `${speaker} -> ${source.atlas}#${source.frame}`).toBeDefined();
      if (frame !== undefined) {
        const cropped = cropPortraitFrame(frame, source.cropMode);
        expect(cropped.x).toBeGreaterThanOrEqual(frame.x);
        expect(cropped.y).toBeGreaterThanOrEqual(frame.y);
        expect(cropped.x + cropped.w).toBeLessThanOrEqual(frame.x + frame.w);
        expect(cropped.y + cropped.h).toBeLessThanOrEqual(frame.y + frame.h);
        expect(cropped.w).toBeGreaterThan(0);
        expect(cropped.h).toBeGreaterThan(0);
      }
    }

    expect(speakerPortraitSource(world, null)).toBeNull();
    expect(speakerPortraitSource(world, "Mysterious Voice")).toBeNull();
    expect(speakerPortraitSource(world, "???")).toBeNull();
    expect(speakerPortraitSource(world, "Sign")).toBeNull();
  });

  it("keeps cropPortraitFrame strictly inside source frame bounds for every mode", () => {
    const samples: readonly [PortraitCropMode, { x: number; y: number; w: number; h: number }][] = [
      ["kid", { x: 0, y: 0, w: 384, h: 384 }],
      ["kid", { x: 448, y: 0, w: 448, h: 448 }],
      ["adult", { x: 0, y: 0, w: 448, h: 448 }],
      ["small", { x: 0, y: 0, w: 256, h: 256 }],
      ["critter", { x: 0, y: 0, w: 256, h: 256 }],
      ["critter", { x: 0, y: 512, w: 512, h: 512 }],
    ];
    for (const [mode, frame] of samples) {
      const cropped = cropPortraitFrame(frame, mode);
      expect(cropped.x).toBeGreaterThanOrEqual(frame.x);
      expect(cropped.y).toBeGreaterThanOrEqual(frame.y);
      expect(cropped.x + cropped.w).toBeLessThanOrEqual(frame.x + frame.w);
      expect(cropped.y + cropped.h).toBeLessThanOrEqual(frame.y + frame.h);
      expect(cropped.w).toBe(cropped.h);
    }

    expect(speakerAccent("Fae")).toBe("fae");
    expect(speakerAccent("Dad")).toBe("family");
    expect(speakerAccent("Sue")).toBe("friend");
    expect(speakerAccent("Chef Bea")).toBe("town");
    expect(speakerAccent("Coach Ash")).toBe("school");
    expect(speakerAccent("Lavender Fairy")).toBe("fairy");
    expect(speakerAccent("Cozy Bat")).toBe("critter");
    expect(speakerAccent("Hooded Kid")).toBe("mystery");
    expect(speakerAccent(null)).toBe("default");
  });
});

describe("Milestone 81: emissive atmosphere layer & cavern magic", () => {
  it("emits bounded emissive particles for cavern, enchanted, plaza, lodge, and cafe", () => {
    const emissiveAreas = ["cavern", "enchanted", "plaza", "lodge", "cafe"] as const;
    for (const areaId of emissiveAreas) {
      const area = world.areas[areaId];
      expect(area, areaId).toBeDefined();
      if (area === undefined) continue;
      const particles = evaluateAtmosphere(area.id, area.width, area.height, 120);
      const emissive = particles.filter((item) => item.layer === "emissive");
      expect(emissive.length, `${areaId} emissive count`).toBeGreaterThan(0);
      for (const item of particles) {
        expect(Number.isFinite(item.x)).toBe(true);
        expect(Number.isFinite(item.y)).toBe(true);
        expect(item.alpha).toBeGreaterThanOrEqual(0);
        expect(item.alpha).toBeLessThanOrEqual(1);
      }
    }

    const cavern = world.areas.cavern;
    if (cavern === undefined) throw new Error("cavern missing");
    const cavernParticles = evaluateAtmosphere("cavern", cavern.width, cavern.height, 120);
    const cavernEmissive = cavernParticles.filter((item) => item.layer === "emissive");
    expect(cavernEmissive.length).toBeGreaterThanOrEqual(10);
    expect(
      cavernParticles.filter((item) => item.layer === "over" && item.texture === "waterGlint")
        .length,
    ).toBeGreaterThanOrEqual(13);
  });
});
