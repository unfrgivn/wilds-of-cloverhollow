import { describe, expect, test } from "vitest";
import {
  DEFAULT_AUDIO_LEVEL,
  gainForAudioLevel,
  readAudioPreferences,
  writeAudioPreferences,
} from "../../src/platform/audio-settings";

describe("audio preferences", () => {
  test("clamps arbitrary stored levels to the closest supported step", () => {
    expect(readAudioPreferences('{"muted":false,"level":0.01}').level).toBe(0.25);
    expect(readAudioPreferences('{"muted":false,"level":9}').level).toBe(1);
    expect(readAudioPreferences(null).level).toBe(DEFAULT_AUDIO_LEVEL);
  });

  test("loads the old mute-only preference and writes the new shape", () => {
    expect(readAudioPreferences("true")).toEqual({ muted: true, level: 1 });
    expect(readAudioPreferences("false")).toEqual({ muted: false, level: 1 });
    expect(writeAudioPreferences({ muted: true, level: 0.5 }))
      .toBe('{"muted":true,"level":0.5}');
  });

  test("keeps the existing moderate gain at the default level", () => {
    expect(gainForAudioLevel(1)).toBe(0.18);
    expect(gainForAudioLevel(0.25)).toBe(0.045);
  });
});
