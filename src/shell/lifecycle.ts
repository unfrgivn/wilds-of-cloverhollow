export type LifecycleContext = {
  documentHidden: boolean;
  paused: boolean;
  areaLoading: boolean;
};

/**
 * Freezes live fixed-timestep ticking and resets elapsed accumulator time while
 * an area is loading or the tab/iOS app is hidden during unpaused play, without
 * interfering with paused harness stepping.
 */
export function shouldFreezeLiveLoop(ctx: LifecycleContext): boolean {
  return ctx.areaLoading || (!ctx.paused && ctx.documentHidden);
}

export type SaveFlushContext = {
  qaActive: boolean;
  titleOpen: boolean;
  area: string;
  inFinale: boolean;
  inBattle: boolean;
  inArcade: boolean;
  autosaveNeeded: boolean;
};

/**
 * Returns true when hiding or unloading the page should flush an immediate
 * quiet autosave, guarding QA mode, title, harness, finale/credits, and
 * mid-battle or mid-arcade states.
 */
export function shouldFlushSaveOnHide(ctx: SaveFlushContext): boolean {
  return (
    !ctx.qaActive &&
    !ctx.titleOpen &&
    ctx.area !== "harness" &&
    !ctx.inFinale &&
    !ctx.inBattle &&
    !ctx.inArcade &&
    ctx.autosaveNeeded
  );
}
