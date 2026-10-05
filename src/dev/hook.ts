import { stableHash, type ActionFrame, type State } from "../core";
import type { InputSource } from "../platform/input";

export type CloverhollowHook = {
  version: 1;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  step: (ticks: number) => {
    tick: number;
    x: number;
    y: number;
    facing: State["facing"];
  };
  input: (frame: ActionFrame, ticks: number) => void;
  getState: () => State;
  hash: () => string;
  reset: (options?: { seed?: number; fixture?: string }) => void;
};

export function installHook(deps: {
  input: InputSource;
  get: () => State;
  tick: (frame: ActionFrame) => void;
  render: () => void;
  paused: () => boolean;
  setPaused: (paused: boolean) => void;
  reset: (options: { seed?: number; fixture?: string }) => void;
}): void {
  const hook: CloverhollowHook = {
    version: 1,
    pause: () => deps.setPaused(true),
    resume: () => deps.setPaused(false),
    isPaused: deps.paused,
    step: (ticks) => {
      deps.setPaused(true);
      for (let index = 0; index < Math.max(0, ticks); index += 1)
        deps.tick(deps.input.next());
      deps.render();
      const state = deps.get();
      return {
        tick: state.tick,
        x: state.player.x,
        y: state.player.y,
        facing: state.facing,
      };
    },
    input: deps.input.queue,
    getState: () => structuredClone(deps.get()),
    hash: () => stableHash(deps.get()),
    reset: (options = {}) => {
      deps.setPaused(true);
      deps.input.clear();
      deps.reset(options);
      deps.render();
    },
  };
  window.__cloverhollow = hook;
}

declare global {
  interface Window {
    __cloverhollow?: CloverhollowHook;
  }
}
