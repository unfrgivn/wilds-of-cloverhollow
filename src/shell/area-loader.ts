import type { Area, State } from "../core";
import { vignetteEnvelope } from "../render/fade";
import {
  classifyTravelVignette,
  shouldShowTravelVignette,
  travelMarkerMotion,
  type TravelVignetteSpec,
} from "../render/travel-vignette";
import type { TravelOverlayView } from "../ui/travel-overlay";

export type TravelVignetteDeps = {
  isPaused: () => boolean;
  isReducedMotion: () => boolean;
  preload: (assetUrl: string) => void;
  render: (view: TravelOverlayView) => void;
  hide: () => void;
  onStart?: (spec: TravelVignetteSpec) => void;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof globalThis.setTimeout>;
  clearTimer?: (handle: ReturnType<typeof globalThis.setTimeout>) => void;
};

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
  travelVignette?: TravelVignetteDeps;
};

export type AreaLoader = {
  ensureArea: (fresh?: boolean) => Promise<void>;
  prefetch: (targetAreaId: string) => void;
  clearPrefetch: () => void;
  syncTransition: (transition: State["transition"], harnessStepping: boolean) => void;
  isLoading: () => boolean;
  reset: () => void;
  renderTravelVignette: (nowMs?: number) => void;
  skipTravelVignette: () => boolean;
  cancelTravelVignette: () => void;
  isTravelVignetteActive: () => boolean;
  pollTravelGamepadSkip: (pressed: boolean, onSkip: () => void) => void;
};

type ActiveVignette = {
  spec: TravelVignetteSpec;
  startedAtMs: number;
  resolveHold: () => void;
  timerHandle: ReturnType<typeof globalThis.setTimeout> | null;
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
  let pendingVignette: { toArea: string; spec: TravelVignetteSpec } | null = null;
  let activeVignette: ActiveVignette | null = null;
  let overlayShown = false;
  let padArmed = false;
  let padWasDown = false;

  const now = (): number => {
    if (deps.travelVignette?.now !== undefined) return deps.travelVignette.now();
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  };

  const scheduleTimer = (
    callback: () => void,
    ms: number,
  ): ReturnType<typeof globalThis.setTimeout> => {
    if (deps.travelVignette?.setTimer !== undefined) {
      return deps.travelVignette.setTimer(callback, ms);
    }
    return globalThis.setTimeout(callback, ms);
  };

  const cancelTimer = (handle: ReturnType<typeof globalThis.setTimeout>): void => {
    if (deps.travelVignette?.clearTimer !== undefined) {
      deps.travelVignette.clearTimer(handle);
      return;
    }
    globalThis.clearTimeout(handle);
  };

  const hideOverlay = (): void => {
    if (deps.travelVignette === undefined) return;
    overlayShown = false;
    deps.travelVignette.hide();
  };

  const skipTravelVignette = (): boolean => {
    if (activeVignette === null) return false;
    const current = activeVignette;
    activeVignette = null;
    if (current.timerHandle !== null) {
      cancelTimer(current.timerHandle);
      current.timerHandle = null;
    }
    current.resolveHold();
    hideOverlay();
    deps.invalidate();
    return true;
  };

  const cancelTravelVignette = (): void => {
    pendingVignette = null;
    skipTravelVignette();
  };

  const renderTravelVignette = (nowMs?: number): void => {
    const hooks = deps.travelVignette;
    if (hooks === undefined) return;
    if (activeVignette === null) {
      if (overlayShown) hideOverlay();
      return;
    }
    if (hooks.isPaused() || hooks.isReducedMotion()) {
      cancelTravelVignette();
      return;
    }
    const elapsedMs = Math.max(0, (nowMs ?? now()) - activeVignette.startedAtMs);
    const env = vignetteEnvelope(elapsedMs, activeVignette.spec.holdMs);
    const motion = travelMarkerMotion(activeVignette.spec.mode, env.progress);
    overlayShown = true;
    hooks.render({
      visible: true,
      spec: activeVignette.spec,
      opacity: env.opacity,
      scale: env.scale,
      progressPct: motion.progressPct,
      bobY: motion.bobY,
      tiltDeg: motion.tiltDeg,
    });
  };

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
      const isFresh = reload;
      reload = false;

      let runVignette: ActiveVignette | null = null;
      let holdPromise: Promise<void> = Promise.resolve();
      const hooks = deps.travelVignette;
      const candidate =
        !isFresh && pendingVignette !== null && pendingVignette.toArea === area.id
          ? pendingVignette.spec
          : null;
      pendingVignette = null;
      if (hooks !== undefined && candidate !== null) {
        if (
          shouldShowTravelVignette({
            route: candidate,
            paused: hooks.isPaused(),
            harnessStepping: false,
            reducedMotion: hooks.isReducedMotion(),
          })
        ) {
          let resolveHold = (): void => undefined;
          holdPromise = new Promise<void>((resolve) => {
            resolveHold = resolve;
          });
          const startedAtMs = now();
          const active: ActiveVignette = {
            spec: candidate,
            startedAtMs,
            resolveHold,
            timerHandle: null,
          };
          active.timerHandle = scheduleTimer(() => {
            active.timerHandle = null;
            active.resolveHold();
          }, candidate.holdMs);
          activeVignette = active;
          runVignette = active;
          hooks.onStart?.(candidate);
          renderTravelVignette(startedAtMs);
        }
      }

      const assetsPromise = Promise.all([
        deps.setArea(area).then(() => deps.cacheAreaNpcPortraits(area)),
        deps.warmAreaMedia(area),
        current.battle !== null ? deps.warmBattlePortraits(current) : Promise.resolve(),
      ]);

      areaLoad = Promise.all([assetsPromise, holdPromise])
        .then(() => {
          deps.onLoaded(deps.getState());
        })
        .finally(() => {
          if (runVignette !== null) {
            if (runVignette.timerHandle !== null) {
              cancelTimer(runVignette.timerHandle);
              runVignette.timerHandle = null;
            }
            if (activeVignette === runVignette) {
              activeVignette = null;
            }
            if (overlayShown) hideOverlay();
          }
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
      pendingVignette = null;
      return;
    }
    if (transition.phase !== "out") return;
    if (harnessStepping) {
      pendingVignette = null;
      return;
    }
    prefetch(transition.target.area);
    const hooks = deps.travelVignette;
    if (hooks === undefined) return;
    const fromArea = deps.getState().area;
    const route = classifyTravelVignette(fromArea, transition.target.area, transition.tone);
    if (
      shouldShowTravelVignette({
        route,
        paused: hooks.isPaused(),
        harnessStepping,
        reducedMotion: hooks.isReducedMotion(),
      }) &&
      route !== null
    ) {
      if (
        pendingVignette === null ||
        pendingVignette.toArea !== transition.target.area ||
        pendingVignette.spec.id !== route.id
      ) {
        pendingVignette = { toArea: transition.target.area, spec: route };
        hooks.preload(route.assetUrl);
      }
    } else {
      pendingVignette = null;
    }
  };

  const reset = (): void => {
    clearPrefetch();
    cancelTravelVignette();
  };

  const pollTravelGamepadSkip = (pressed: boolean, onSkip: () => void): void => {
    if (activeVignette === null) {
      padArmed = false;
      padWasDown = false;
      return;
    }
    if (padArmed && pressed && !padWasDown) onSkip();
    padArmed = true;
    padWasDown = pressed;
  };

  return {
    ensureArea,
    prefetch,
    clearPrefetch,
    syncTransition,
    isLoading: () => areaLoad !== undefined,
    reset,
    renderTravelVignette,
    skipTravelVignette,
    cancelTravelVignette,
    isTravelVignetteActive: () => activeVignette !== null,
    pollTravelGamepadSkip,
  };
}
