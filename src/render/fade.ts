import type { State } from "../core";

export function fadeAlpha(
  transition: State["transition"],
  doorFadeTicks: number,
): number {
  if (transition === null) return 0;
  const raw = transition.phase === "out"
    ? Math.min(1, Math.max(0, transition.elapsed / doorFadeTicks))
    : Math.max(0, Math.min(1, 1 - transition.elapsed / doorFadeTicks));
  return raw * raw * (3 - 2 * raw);
}

export function transitionZoom(
  transition: State["transition"],
  doorFadeTicks: number,
): number {
  if (transition === null || doorFadeTicks <= 0) return 1;
  const t = Math.min(1, Math.max(0, transition.elapsed / doorFadeTicks));
  const s = t * t * (3 - 2 * t);
  if (transition.phase === "out") return 1 + 0.022 * s;
  return 0.972 + 0.028 * s;
}
