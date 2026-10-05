import type { ActionFrame } from "../core";

export type InputSource = {
  next: () => ActionFrame;
  queue: (frame: ActionFrame, ticks: number) => void;
  clear: () => void;
};

export function createInputSource(live: () => ActionFrame): InputSource {
  const queued: { frame: ActionFrame; ticks: number }[] = [];
  return {
    next: () => {
      const segment = queued[0];
      if (segment === undefined) return live();
      segment.ticks -= 1;
      if (segment.ticks <= 0) queued.shift();
      return segment.frame;
    },
    queue: (frame, ticks) => {
      if (ticks > 0) queued.push({ frame, ticks });
    },
    clear: () => {
      queued.length = 0;
    },
  };
}
