import { describe, expect, test } from "vitest";
import {
  DEFAULT_AUDIO_LEVEL,
  DEFAULT_MUSIC_LEVEL,
  gainForAmbienceLevel,
  gainForAudioLevel,
  gainForMusicLevel,
  readAudioPreferences,
  writeAudioPreferences,
} from "../../src/platform/audio-settings";

describe("audio preferences", () => {
  test("clamps arbitrary stored levels to the closest supported step", () => {
    expect(readAudioPreferences('{"muted":false,"level":0.01}').level).toBe(0.25);
    expect(readAudioPreferences('{"muted":false,"level":9}').level).toBe(1);
    expect(readAudioPreferences(null).level).toBe(DEFAULT_AUDIO_LEVEL);
    expect(readAudioPreferences(null).musicLevel).toBe(DEFAULT_MUSIC_LEVEL);
  });

  test("loads legacy shapes cleanly and writes the full shape", () => {
    expect(readAudioPreferences("true")).toEqual({
      muted: true,
      level: 1,
      musicMuted: false,
      musicLevel: DEFAULT_MUSIC_LEVEL,
      ambienceMuted: false,
    });
    expect(readAudioPreferences("false")).toEqual({
      muted: false,
      level: 1,
      musicMuted: false,
      musicLevel: DEFAULT_MUSIC_LEVEL,
      ambienceMuted: false,
    });
    expect(readAudioPreferences('{"muted":true,"level":0.5}')).toEqual({
      muted: true,
      level: 0.5,
      musicMuted: false,
      musicLevel: DEFAULT_MUSIC_LEVEL,
      ambienceMuted: false,
    });
    const encoded = writeAudioPreferences({
      muted: true,
      level: 0.5,
      musicMuted: true,
      musicLevel: 0.25,
      ambienceMuted: true,
    });
    expect(readAudioPreferences(encoded)).toEqual({
      muted: true,
      level: 0.5,
      musicMuted: true,
      musicLevel: 0.25,
      ambienceMuted: true,
    });
  });

  test("keeps moderate gains for sfx, music, and ambience", () => {
    expect(gainForAudioLevel(1)).toBe(0.18);
    expect(gainForAudioLevel(0.25)).toBe(0.045);
    expect(gainForMusicLevel(1)).toBe(0.2);
    expect(gainForMusicLevel(0.75)).toBeCloseTo(0.15, 6);
    expect(gainForAmbienceLevel(1)).toBe(0.065);
    expect(gainForAmbienceLevel(0.5)).toBeCloseTo(0.0325, 6);
  });
});
