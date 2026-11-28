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
