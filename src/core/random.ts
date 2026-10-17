import type { State } from "./types";

// The game's random generator (spec 3.1): a linear congruential step on
// `state.rng`, giving a value in [0, 1) and the state moved on. Everything
// random in the core draws from it, so a replay is exact.
export function nextRandom(state: State): [number, State] {
  const next = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, { ...state, rng: next }];
}
