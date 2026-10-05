import type { State } from "../core";

export function fadeAlpha(
  transition: State["transition"],
  doorFadeTicks: number,
): number {
  if (transition === null) return 0;
  return transition.phase === "out"
    ? Math.min(1, transition.elapsed / doorFadeTicks)
    : Math.max(0, 1 - transition.elapsed / doorFadeTicks);
}
