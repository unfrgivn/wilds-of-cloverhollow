import type { State } from "../core";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function fadeAlpha(
  transition: State["transition"],
  doorFadeTicks: number,
): number {
  if (transition === null) return 0;
  if (doorFadeTicks <= 0) return transition.phase === "out" ? 1 : 0;
  if (transition.tone === "dark") {
    const ramp = doorFadeTicks * 0.65;
    const raw = transition.phase === "out"
      ? clamp01(transition.elapsed / ramp)
      : clamp01((doorFadeTicks - transition.elapsed) / ramp);
    return raw * raw * (3 - 2 * raw);
  }
  const raw = transition.phase === "out"
    ? clamp01(transition.elapsed / doorFadeTicks)
    : clamp01(1 - transition.elapsed / doorFadeTicks);
  return raw * raw * (3 - 2 * raw);
}

export function transitionZoom(
  transition: State["transition"],
  doorFadeTicks: number,
): number {
  if (transition === null || transition.tone === "dark" || doorFadeTicks <= 0) return 1;
  const t = clamp01(transition.elapsed / doorFadeTicks);
  const s = t * t * (3 - 2 * t);
  if (transition.phase === "out") return 1 + 0.022 * s;
  return 0.972 + 0.028 * s;
}

export type VignetteEnvelope = {
  opacity: number;
  scale: number;
  progress: number;
};

export function vignetteEnvelope(
  elapsedMs: number,
  durationMs: number,
  options?: { fadeInMs?: number; fadeOutMs?: number; reducedMotion?: boolean },
): VignetteEnvelope {
  if (options?.reducedMotion === true || !Number.isFinite(durationMs) || durationMs <= 0) {
    return { opacity: 0, scale: 1, progress: 1 };
  }
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const progress = clamp01(safeElapsed / durationMs);
  const rawIn = Math.max(0, options?.fadeInMs ?? 200);
  const rawOut = Math.max(0, options?.fadeOutMs ?? 220);
  const sum = rawIn + rawOut;
  const ratio = sum > durationMs && sum > 0 ? durationMs / sum : 1;
  const fadeInMs = rawIn * ratio;
  const fadeOutMs = rawOut * ratio;

  if (fadeInMs > 0 && safeElapsed < fadeInMs) {
    const t = clamp01(safeElapsed / fadeInMs);
    const s = t * t * (3 - 2 * t);
    return { opacity: s, scale: 0.97 + 0.03 * s, progress };
  }
  if (fadeOutMs > 0 && safeElapsed > durationMs - fadeOutMs) {
    const remaining = Math.max(0, durationMs - safeElapsed);
    const t = clamp01(remaining / fadeOutMs);
    const s = t * t * (3 - 2 * t);
    return { opacity: s, scale: 1 + 0.015 * (1 - s), progress };
  }
  if (safeElapsed >= durationMs) {
    return { opacity: 0, scale: 1.015, progress: 1 };
  }
  return { opacity: 1, scale: 1, progress };
}

export function travelFadeAlpha(
  transition: State["transition"],
  doorFadeTicks: number,
  vignetteActive: boolean,
): number {
  return vignetteActive ? 1 : fadeAlpha(transition, doorFadeTicks);
}
