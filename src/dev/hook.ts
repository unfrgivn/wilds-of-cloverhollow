import { stableHash, type ActionFrame, type State } from "../core";
import type { InputSource } from "../platform/input";

export type CloverhollowHook = {
  version: 1;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  step: (ticks: number) => Promise<{
    tick: number;
    x: number;
    y: number;
    facing: State["facing"];
  }>;
  input: (frame: ActionFrame, ticks: number) => void;
  getState: () => State;
  hash: () => string;
  reset: (options?: { seed?: number; fixture?: string }) => Promise<void>;
  renderInfo: () => {
    area: string;
    drawOrder: { label: string; zIndex: number }[];
    animation: string;
    frame: number;
    maddie: { animation: string; frame: number };
    hidden: number;
    fade: number;
    cachedAreaTextures: string[];
    prompt: { visible: boolean; label: string; x: number; y: number };
    dialogue: {
      open: boolean;
      speaker: string | null;
      revealed: number;
      length: number;
      choices: string[];
      selected: number;
    };
    critters: { id: string; frame: string }[];
    battle: {
      phase: string | null;
      ring: { x: number; y: number; radius: number } | null;
      frogFrame: string;
      layout: {
        frog: { x: number; baseline: number; height: number };
        fae: { x: number; baseline: number; height: number };
      } | null;
      backdrop: { x: number; y: number; width: number; height: number } | null;
      overworldVisible: boolean;
      auraAlpha: number;
    };
  };
};

export function installHook(deps: {
  input: InputSource;
  get: () => State;
  tick: (frame: ActionFrame) => void;
  ensureArea: () => Promise<void>;
  render: () => void;
  paused: () => boolean;
  setPaused: (paused: boolean) => void;
  reset: (options: { seed?: number; fixture?: string }) => Promise<void>;
  renderInfo: CloverhollowHook["renderInfo"];
}): void {
  const hook: CloverhollowHook = {
    version: 1,
    pause: () => deps.setPaused(true),
    resume: () => deps.setPaused(false),
    isPaused: deps.paused,
    step: async (ticks) => {
      deps.setPaused(true);
      await deps.ensureArea();
      for (let index = 0; index < Math.max(0, ticks); index += 1) {
        deps.tick(deps.input.next());
        await deps.ensureArea();
      }
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
    reset: async (options = {}) => {
      deps.setPaused(true);
      deps.input.clear();
      await deps.reset(options);
      deps.render();
    },
    renderInfo: deps.renderInfo,
  };
  window.__cloverhollow = hook;
}

declare global {
  interface Window {
    __cloverhollow?: CloverhollowHook;
  }
}
