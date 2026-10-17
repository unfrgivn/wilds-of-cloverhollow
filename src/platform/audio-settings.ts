export const AUDIO_LEVELS = [0.25, 0.5, 0.75, 1] as const;
export type AudioLevel = (typeof AUDIO_LEVELS)[number];

export const DEFAULT_AUDIO_LEVEL: AudioLevel = 1;
export const MASTER_GAIN = 0.18;
export type AudioPreferences = { muted: boolean; level: AudioLevel };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function audioLevel(value: unknown): AudioLevel {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_AUDIO_LEVEL;
  let closest: AudioLevel = AUDIO_LEVELS[0];
  for (const candidate of AUDIO_LEVELS) {
    if (Math.abs(candidate - value) < Math.abs(closest - value)) closest = candidate;
  }
  return closest;
}

export function readAudioPreferences(value: string | null): AudioPreferences {
  if (value === null) return { muted: false, level: DEFAULT_AUDIO_LEVEL };
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "boolean") return { muted: parsed, level: DEFAULT_AUDIO_LEVEL };
    if (!isRecord(parsed)) return { muted: false, level: DEFAULT_AUDIO_LEVEL };
    return { muted: parsed.muted === true, level: audioLevel(parsed.level) };
  } catch {
    return { muted: false, level: DEFAULT_AUDIO_LEVEL };
  }
}

export function writeAudioPreferences(preferences: AudioPreferences): string {
  return JSON.stringify({ muted: preferences.muted, level: preferences.level });
}

export function gainForAudioLevel(level: AudioLevel): number {
  return MASTER_GAIN * level;
}
