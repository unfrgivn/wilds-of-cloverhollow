export const AUDIO_LEVELS = [0.25, 0.5, 0.75, 1] as const;
export type AudioLevel = (typeof AUDIO_LEVELS)[number];

export const DEFAULT_AUDIO_LEVEL: AudioLevel = 1;
export const DEFAULT_MUSIC_LEVEL: AudioLevel = 0.75;
export const MASTER_GAIN = 0.18;
export const MUSIC_MASTER_GAIN = 0.2;
export const AMBIENCE_MASTER_GAIN = 0.065;

export type AudioPreferences = {
  muted: boolean;
  level: AudioLevel;
  musicMuted: boolean;
  musicLevel: AudioLevel;
  ambienceMuted: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultPreferences(muted = false): AudioPreferences {
  return {
    muted,
    level: DEFAULT_AUDIO_LEVEL,
    musicMuted: false,
    musicLevel: DEFAULT_MUSIC_LEVEL,
    ambienceMuted: false,
  };
}

export function audioLevel(
  value: unknown,
  fallback: AudioLevel = DEFAULT_AUDIO_LEVEL,
): AudioLevel {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  let closest: AudioLevel = AUDIO_LEVELS[0];
  for (const candidate of AUDIO_LEVELS) {
    if (Math.abs(candidate - value) < Math.abs(closest - value)) closest = candidate;
  }
  return closest;
}

export function readAudioPreferences(value: string | null): AudioPreferences {
  if (value === null) return defaultPreferences(false);
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "boolean") return defaultPreferences(parsed);
    if (!isRecord(parsed)) return defaultPreferences(false);
    return {
      muted: parsed.muted === true,
      level: audioLevel(parsed.level, DEFAULT_AUDIO_LEVEL),
      musicMuted: parsed.musicMuted === true,
      musicLevel: audioLevel(parsed.musicLevel, DEFAULT_MUSIC_LEVEL),
      ambienceMuted: parsed.ambienceMuted === true,
    };
  } catch {
    return defaultPreferences(false);
  }
}

export function writeAudioPreferences(preferences: AudioPreferences): string {
  return JSON.stringify({
    muted: preferences.muted,
    level: preferences.level,
    musicMuted: preferences.musicMuted,
    musicLevel: preferences.musicLevel,
    ambienceMuted: preferences.ambienceMuted,
  });
}

export function gainForAudioLevel(level: AudioLevel): number {
  return MASTER_GAIN * level;
}

export function gainForMusicLevel(level: AudioLevel): number {
  return MUSIC_MASTER_GAIN * level;
}

export function gainForAmbienceLevel(level: AudioLevel): number {
  return AMBIENCE_MASTER_GAIN * level;
}
