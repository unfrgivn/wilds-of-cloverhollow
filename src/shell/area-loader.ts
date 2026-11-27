import type { Area, State } from "../core";

export type AreaLoaderDeps<TState extends Pick<State, "area" | "battle">> = {
  getArea: (areaId: string) => Area | undefined;
  getState: () => TState;
  loadedAreaId: () => string | null;
  setArea: (area: Area) => Promise<void>;
  prefetchArea: (area: Area) => void;
  warmAreaOverlays: (areaId: string) => Promise<void>;
  cacheAreaNpcPortraits: (area: Area) => void;
  warmAreaMedia: (area: Area) => Promise<void>;
  warmBattlePortraits: (state: TState) => Promise<void>;
  onLoaded: (state: TState) => void;
  invalidate: () => void;
};

export type AreaLoader = {
  ensureArea: (fresh?: boolean) => Promise<void>;
  prefetch: (targetAreaId: string) => void;
  clearPrefetch: () => void;
  syncTransition: (transition: State["transition"], harnessStepping: boolean) => void;
  isLoading: () => boolean;
  reset: () => void;
};

/**
 * Serializes area texture/asset loading behind a single in-flight promise and
 * deduplicates door-fade target prefetching so crossings warm each destination
 * once without racing concurrent loads.
 */
export function createAreaLoader<TState extends Pick<State, "area" | "battle">>(
  deps: AreaLoaderDeps<TState>,
): AreaLoader {
  let areaLoad: Promise<void> | undefined;
  let prefetchedTarget: string | undefined;

  const ensureArea = async (fresh = false): Promise<void> => {
    let reload = fresh;
    for (;;) {
      if (areaLoad !== undefined) {
        await areaLoad;
        continue;
      }
      const current = deps.getState();
      const area = deps.getArea(current.area);
      if (area === undefined) throw new Error(`Unknown area ${current.area}`);
      if (!reload && deps.loadedAreaId() === area.id) {
        await Promise.all([
          deps.warmAreaMedia(area),
          current.battle !== null ? deps.warmBattlePortraits(current) : Promise.resolve(),
        ]);
        return;
      }
      reload = false;
      areaLoad = Promise.all([
        deps.setArea(area).then(() => deps.cacheAreaNpcPortraits(area)),
        deps.warmAreaMedia(area),
        current.battle !== null ? deps.warmBattlePortraits(current) : Promise.resolve(),
      ])
        .then(() => {
          deps.onLoaded(deps.getState());
        })
        .finally(() => {
          areaLoad = undefined;
          deps.invalidate();
        });
    }
  };

  const prefetch = (targetAreaId: string): void => {
    if (targetAreaId === prefetchedTarget) return;
    const targetArea = deps.getArea(targetAreaId);
    if (targetArea !== undefined) {
      deps.prefetchArea(targetArea);
      void deps.warmAreaOverlays(targetArea.id);
    }
    prefetchedTarget = targetAreaId;
  };

  const clearPrefetch = (): void => {
    prefetchedTarget = undefined;
  };

  const syncTransition = (transition: State["transition"], harnessStepping: boolean): void => {
    if (transition === null) {
      clearPrefetch();
      return;
    }
    if (!harnessStepping && transition.phase === "out") {
      prefetch(transition.target.area);
    }
  };

  const reset = (): void => {
    clearPrefetch();
  };

  return {
    ensureArea,
    prefetch,
    clearPrefetch,
    syncTransition,
    isLoading: () => areaLoad !== undefined,
    reset,
  };
}
