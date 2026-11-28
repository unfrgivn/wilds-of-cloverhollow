import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { Area, State } from "../../src/core";
import { vignetteEnvelope } from "../../src/render/fade";
import {
  classifyTravelVignette,
  shouldShowTravelVignette,
  TRAVEL_VIGNETTE_FADE_IN_MS,
  TRAVEL_VIGNETTE_FADE_OUT_MS,
  TRAVEL_VIGNETTE_HOLD_MS,
  TRAVEL_VIGNETTE_IDS,
  travelCardAssetUrl,
  travelMarkerMotion,
  type TravelMode,
  type TravelVignetteId,
  type TravelVignetteSpec,
} from "../../src/render/travel-vignette";
import { createAreaLoader } from "../../src/shell/area-loader";
import { isTravelSkipKey, type TravelOverlayView } from "../../src/ui/travel-overlay";

describe("E14: Travel Vignette Classification & Rules", () => {
  it("classifies all 10 directed fast-travel transitions accurately", () => {
    const cases: readonly {
      from: string;
      to: string;
      id: TravelVignetteId;
      mode: TravelMode;
      badgeLabel: string;
      originLabel: string;
      destinationLabel: string;
      caption: string;
      chime: TravelVignetteSpec["chime"];
      soundtrackHint: TravelVignetteSpec["soundtrackHint"];
      accentColor: string;
    }[] = [
      {
        from: "bay",
        to: "plaza",
        id: "bus-hills",
        mode: "bus",
        badgeLabel: "Star-Line Bus",
        originLabel: "Bubblegum Bay",
        destinationLabel: "Cloverhollow",
        caption: "Next stop: Cloverhollow!",
        chime: "title-start",
        soundtrackHint: "hills",
        accentColor: "#e8c468",
      },
      {
        from: "pass",
        to: "plaza",
        id: "bus-hills",
        mode: "bus",
        badgeLabel: "Star-Line Bus",
        originLabel: "Pinecone Pass",
        destinationLabel: "Cloverhollow",
        caption: "Next stop: Cloverhollow!",
        chime: "title-start",
        soundtrackHint: "hills",
        accentColor: "#e8c468",
      },
      {
        from: "plaza",
        to: "bay",
        id: "bus-coast",
        mode: "bus",
        badgeLabel: "Star-Line Bus",
        originLabel: "Cloverhollow",
        destinationLabel: "Bubblegum Bay",
        caption: "Next stop: Bubblegum Bay!",
        chime: "title-start",
        soundtrackHint: "bay",
        accentColor: "#e8c468",
      },
      {
        from: "pass",
        to: "bay",
        id: "bus-coast",
        mode: "bus",
        badgeLabel: "Star-Line Bus",
        originLabel: "Pinecone Pass",
        destinationLabel: "Bubblegum Bay",
        caption: "Next stop: Bubblegum Bay!",
        chime: "title-start",
        soundtrackHint: "bay",
        accentColor: "#e8c468",
      },
      {
        from: "plaza",
        to: "pass",
        id: "bus-pass",
        mode: "bus",
        badgeLabel: "Star-Line Bus",
        originLabel: "Cloverhollow",
        destinationLabel: "Pinecone Pass",
        caption: "Next stop: Pinecone Pass!",
        chime: "title-start",
        soundtrackHint: "pass",
        accentColor: "#e8c468",
      },
      {
        from: "bay",
        to: "pass",
        id: "bus-pass",
        mode: "bus",
        badgeLabel: "Star-Line Bus",
        originLabel: "Bubblegum Bay",
        destinationLabel: "Pinecone Pass",
        caption: "Next stop: Pinecone Pass!",
        chime: "title-start",
        soundtrackHint: "pass",
        accentColor: "#e8c468",
      },
      {
        from: "bay",
        to: "island",
        id: "boat-island",
        mode: "boat",
        badgeLabel: "Bay Rowboat",
        originLabel: "Bubblegum Bay",
        destinationLabel: "Starlight Island",
        caption: "Next stop: Starlight Island!",
        chime: "card-open",
        soundtrackHint: "island",
        accentColor: "#92cdd0",
      },
      {
        from: "island",
        to: "bay",
        id: "boat-island",
        mode: "boat",
        badgeLabel: "Bay Rowboat",
        originLabel: "Starlight Island",
        destinationLabel: "Bubblegum Bay",
        caption: "Next stop: Bubblegum Bay!",
        chime: "card-open",
        soundtrackHint: "bay",
        accentColor: "#92cdd0",
      },
      {
        from: "pass",
        to: "summit",
        id: "lift-summit",
        mode: "lift",
        badgeLabel: "Alpine Ski Lift",
        originLabel: "Pinecone Pass",
        destinationLabel: "Alpine Summit Overlook",
        caption: "Next stop: Alpine Summit Overlook!",
        chime: "tool-sparkle",
        soundtrackHint: "summit",
        accentColor: "#b8c7e8",
      },
      {
        from: "summit",
        to: "pass",
        id: "lift-summit",
        mode: "lift",
        badgeLabel: "Alpine Ski Lift",
        originLabel: "Alpine Summit Overlook",
        destinationLabel: "Pinecone Pass",
        caption: "Next stop: Pinecone Pass!",
        chime: "tool-sparkle",
        soundtrackHint: "pass",
        accentColor: "#b8c7e8",
      },
    ];

    for (const expected of cases) {
      const spec = classifyTravelVignette(expected.from, expected.to);
      expect(spec).not.toBeNull();
      expect(spec).toEqual({
        id: expected.id,
        mode: expected.mode,
        assetUrl: `assets/travel/${expected.id}.webp`,
        badgeLabel: expected.badgeLabel,
        caption: expected.caption,
        originLabel: expected.originLabel,
        destinationLabel: expected.destinationLabel,
        chime: expected.chime,
        soundtrackHint: expected.soundtrackHint,
        accentColor: expected.accentColor,
        holdMs: TRAVEL_VIGNETTE_HOLD_MS,
      });
      expect(spec?.assetUrl.startsWith("/")).toBe(false);
      expect(spec?.holdMs).toBeGreaterThanOrEqual(1600);
      expect(spec?.holdMs).toBeLessThanOrEqual(1800);
    }
    expect(TRAVEL_VIGNETTE_FADE_IN_MS).toBe(200);
    expect(TRAVEL_VIGNETTE_FADE_OUT_MS).toBe(220);
  });

  it("returns null for walking doors, same-area, dark fades, harness, and unknown areas", () => {
    const nonTravel: readonly [string, string, ("paper" | "dark")?][] = [
      ["plaza", "park"],
      ["plaza", "lane"],
      ["bay", "trail"],
      ["pass", "lodge"],
      ["pass", "sanctuary"],
      ["plaza", "bedroom"],
      ["field", "field"],
      ["mist", "mist"],
      ["plaza", "plaza"],
      ["plaza", "bay", "dark"],
      ["bay", "island", "dark"],
      ["pass", "summit", "dark"],
      ["harness", "bay"],
      ["plaza", "harness"],
      ["unknown", "bay"],
      ["plaza", "unknown"],
    ];
    for (const [from, to, tone] of nonTravel) {
      expect(classifyTravelVignette(from, to, tone)).toBeNull();
    }
  });

  it("gates display strictly via shouldShowTravelVignette", () => {
    const route = classifyTravelVignette("plaza", "bay");
    expect(route).not.toBeNull();
    expect(
      shouldShowTravelVignette({
        route,
        paused: false,
        harnessStepping: false,
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(
      shouldShowTravelVignette({
        route: null,
        paused: false,
        harnessStepping: false,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldShowTravelVignette({
        route,
        paused: true,
        harnessStepping: false,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldShowTravelVignette({
        route,
        paused: false,
        harnessStepping: true,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldShowTravelVignette({
        route,
        paused: false,
        harnessStepping: false,
        reducedMotion: true,
      }),
    ).toBe(false);
  });

  it("computes bounded motion, vignette envelope, and skip keys", () => {
    const modes: readonly [TravelMode, number, number, number][] = [
      ["bus", -3.2, 0.8, 2.2],
      ["boat", -2.8, 2.8, 4.5],
      ["lift", -2.0, 2.0, 3.2],
    ];
    for (const [mode, minBob, maxBob, maxTilt] of modes) {
      const start = travelMarkerMotion(mode, -0.5);
      const mid = travelMarkerMotion(mode, 0.5);
      const end = travelMarkerMotion(mode, 1.5);
      expect(start.progressPct).toBe(0);
      expect(mid.progressPct).toBeCloseTo(50, 5);
      expect(end.progressPct).toBe(100);
      for (let i = 0; i <= 20; i += 1) {
        const sample = travelMarkerMotion(mode, i / 20);
        expect(sample.bobY).toBeGreaterThanOrEqual(minBob - 1e-6);
        expect(sample.bobY).toBeLessThanOrEqual(maxBob + 1e-6);
        expect(Math.abs(sample.tiltDeg)).toBeLessThanOrEqual(maxTilt + 1e-6);
      }
    }

    expect(vignetteEnvelope(0, 1680)).toEqual({ opacity: 0, scale: 0.97, progress: 0 });
    const fadeInMid = vignetteEnvelope(100, 1680);
    expect(fadeInMid.opacity).toBeCloseTo(0.5, 5);
    expect(fadeInMid.scale).toBeCloseTo(0.985, 5);

    const hold = vignetteEnvelope(840, 1680);
    expect(hold.opacity).toBe(1);
    expect(hold.scale).toBe(1);
    expect(hold.progress).toBeCloseTo(0.5, 5);

    const fadeOutMid = vignetteEnvelope(1680 - 110, 1680);
    expect(fadeOutMid.opacity).toBeCloseTo(0.5, 5);
    expect(fadeOutMid.scale).toBeCloseTo(1.0075, 5);

    const finished = vignetteEnvelope(1680, 1680);
    expect(finished.opacity).toBe(0);
    expect(finished.scale).toBeCloseTo(1.015, 5);
    expect(finished.progress).toBe(1);

    expect(vignetteEnvelope(500, 1680, { reducedMotion: true })).toEqual({
      opacity: 0,
      scale: 1,
      progress: 1,
    });
    expect(vignetteEnvelope(500, 0)).toEqual({ opacity: 0, scale: 1, progress: 1 });

    for (const code of ["KeyZ", "Space", "Enter", "KeyX", "Escape"]) {
      expect(isTravelSkipKey(code)).toBe(true);
    }
    for (const code of ["ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "KeyJ", "KeyP"]) {
      expect(isTravelSkipKey(code)).toBe(false);
    }
  });
});

describe("E14: AreaLoader Travel Vignette Lifecycle", () => {
  const content = loadContent();

  function createHarness(options?: {
    paused?: boolean;
    reducedMotion?: boolean;
    deferSetArea?: boolean;
  }) {
    let paused = options?.paused ?? false;
    let reducedMotion = options?.reducedMotion ?? false;
    let clockMs = 1000;
    let loadedId: string | null = "plaza";
    let currentState: Pick<State, "area" | "battle"> = { area: "plaza", battle: null };
    const preloads: string[] = [];
    const started: TravelVignetteSpec[] = [];
    const renders: TravelOverlayView[] = [];
    const loadedCallbacks: string[] = [];
    let hides = 0;
    let invalidations = 0;
    const pendingSetAreas: (() => void)[] = [];
    type TimerHandle = ReturnType<typeof globalThis.setTimeout>;
    const timers = new Map<TimerHandle, { callback: () => void; ms: number }>();

    const loader = createAreaLoader({
      getArea: (id): Area | undefined => content.world.areas[id],
      getState: () => currentState,
      loadedAreaId: () => loadedId,
      setArea: (area) => {
        if (options?.deferSetArea === true) {
          return new Promise<void>((resolve) => {
            pendingSetAreas.push(() => {
              loadedId = area.id;
              resolve();
            });
          });
        }
        loadedId = area.id;
        return Promise.resolve();
      },
      prefetchArea: () => undefined,
      warmAreaOverlays: async () => undefined,
      cacheAreaNpcPortraits: () => undefined,
      warmAreaMedia: async () => undefined,
      warmBattlePortraits: async () => undefined,
      onLoaded: (loadedState) => {
        loadedCallbacks.push(loadedState.area);
      },
      invalidate: () => {
        invalidations += 1;
      },
      travelVignette: {
        isPaused: () => paused,
        isReducedMotion: () => reducedMotion,
        preload: (url) => preloads.push(url),
        render: (view) => renders.push(view),
        hide: () => {
          hides += 1;
        },
        onStart: (spec) => started.push(spec),
        now: () => clockMs,
        setTimer: (callback, ms) => {
          const handle = globalThis.setTimeout(() => undefined, 60_000);
          timers.set(handle, { callback, ms });
          return handle;
        },
        clearTimer: (handle) => {
          globalThis.clearTimeout(handle);
          timers.delete(handle);
        },
      },
    });

    return {
      loader,
      setPaused: (value: boolean) => {
        paused = value;
      },
      setReducedMotion: (value: boolean) => {
        reducedMotion = value;
      },
      setAreaState: (area: string) => {
        currentState = { area, battle: null };
      },
      advanceClock: (ms: number) => {
        clockMs += ms;
      },
      fireAllTimers: () => {
        const queued = [...timers.entries()];
        timers.clear();
        for (const [handle, entry] of queued) {
          globalThis.clearTimeout(handle);
          entry.callback();
        }
      },
      releaseNextSetArea: () => {
        const release = pendingSetAreas.shift();
        if (release === undefined) throw new Error("Expected deferred setArea");
        release();
      },
      pendingTimerCount: () => timers.size,
      preloads,
      started,
      renders,
      loadedCallbacks,
      getHides: () => hides,
      getInvalidations: () => invalidations,
    };
  }

  it("bypasses vignette when paused, harnessStepping, reducedMotion, or walking door", async () => {
    const outToBay: State["transition"] = {
      phase: "out",
      elapsed: 1,
      target: { area: "bay", spawn: "from-plaza" },
    };

    const pausedHarness = createHarness({ paused: true });
    pausedHarness.loader.syncTransition(outToBay, false);
    pausedHarness.setAreaState("bay");
    await pausedHarness.loader.ensureArea();
    expect(pausedHarness.preloads).toEqual([]);
    expect(pausedHarness.started).toEqual([]);
    expect(pausedHarness.renders).toEqual([]);
    expect(pausedHarness.pendingTimerCount()).toBe(0);

    const steppingHarness = createHarness();
    steppingHarness.loader.syncTransition(outToBay, true);
    steppingHarness.setAreaState("bay");
    await steppingHarness.loader.ensureArea();
    expect(steppingHarness.preloads).toEqual([]);
    expect(steppingHarness.started).toEqual([]);
    expect(steppingHarness.renders).toEqual([]);

    const reducedHarness = createHarness({ reducedMotion: true });
    reducedHarness.loader.syncTransition(outToBay, false);
    reducedHarness.setAreaState("bay");
    await reducedHarness.loader.ensureArea();
    expect(reducedHarness.preloads).toEqual([]);
    expect(reducedHarness.started).toEqual([]);
    expect(reducedHarness.renders).toEqual([]);

    const walkHarness = createHarness();
    walkHarness.loader.syncTransition(
      { phase: "out", elapsed: 1, target: { area: "park", spawn: "from-plaza" } },
      false,
    );
    walkHarness.setAreaState("park");
    await walkHarness.loader.ensureArea();
    expect(walkHarness.preloads).toEqual([]);
    expect(walkHarness.started).toEqual([]);
    expect(walkHarness.renders).toEqual([]);
  });

  it("preloads, holds, animates, and completes live fast-travel on timer expiry", async () => {
    const h = createHarness();
    const outToBay: State["transition"] = {
      phase: "out",
      elapsed: 2,
      target: { area: "bay", spawn: "from-plaza" },
    };

    h.loader.syncTransition(outToBay, false);
    h.loader.syncTransition(outToBay, false);
    expect(h.preloads).toEqual(["assets/travel/bus-coast.webp"]);

    h.setAreaState("bay");
    const loadPromise = h.loader.ensureArea();
    expect(h.loader.isLoading()).toBe(true);
    expect(h.loader.isTravelVignetteActive()).toBe(true);
    expect(h.started.map((s) => s.id)).toEqual(["bus-coast"]);
    expect(h.renders).toHaveLength(1);
    expect(h.renders[0]?.progressPct).toBe(0);

    h.advanceClock(840);
    h.loader.renderTravelVignette();
    expect(h.renders).toHaveLength(2);
    expect(h.renders[1]?.opacity).toBe(1);
    expect(h.renders[1]?.progressPct).toBeCloseTo(50, 4);

    h.fireAllTimers();
    await loadPromise;

    expect(h.loader.isLoading()).toBe(false);
    expect(h.loader.isTravelVignetteActive()).toBe(false);
    expect(h.loadedCallbacks).toEqual(["bay"]);
    expect(h.getHides()).toBe(1);
    expect(h.getInvalidations()).toBeGreaterThanOrEqual(1);
  });

  it("skips immediately while still waiting on in-flight setArea assets", async () => {
    const h = createHarness({ deferSetArea: true });
    h.loader.syncTransition(
      { phase: "out", elapsed: 2, target: { area: "bay", spawn: "from-plaza" } },
      false,
    );
    h.setAreaState("bay");
    const loadPromise = h.loader.ensureArea();
    expect(h.loader.isTravelVignetteActive()).toBe(true);
    expect(h.pendingTimerCount()).toBe(1);

    expect(h.loader.skipTravelVignette()).toBe(true);
    expect(h.loader.skipTravelVignette()).toBe(false);
    expect(h.loader.isTravelVignetteActive()).toBe(false);
    expect(h.pendingTimerCount()).toBe(0);
    expect(h.getHides()).toBe(1);
    expect(h.loader.isLoading()).toBe(true);

    h.releaseNextSetArea();
    await loadPromise;
    expect(h.loader.isLoading()).toBe(false);
    expect(h.loadedCallbacks).toEqual(["bay"]);
  });

  it("cancels and resets active or pending vignettes cleanly", async () => {
    const h = createHarness();
    h.loader.syncTransition(
      { phase: "out", elapsed: 2, target: { area: "pass", spawn: "from-plaza" } },
      false,
    );
    h.setAreaState("pass");
    const loadPromise = h.loader.ensureArea();
    expect(h.loader.isTravelVignetteActive()).toBe(true);

    h.loader.reset();
    await loadPromise;
    expect(h.loader.isTravelVignetteActive()).toBe(false);
    expect(h.loader.isLoading()).toBe(false);
    expect(h.pendingTimerCount()).toBe(0);

    // Pausing mid-vignette dismisses via renderTravelVignette.
    h.setAreaState("bay");
    h.loader.syncTransition(
      { phase: "out", elapsed: 2, target: { area: "island", spawn: "from-bay" } },
      false,
    );
    h.setAreaState("island");
    const secondLoad = h.loader.ensureArea();
    expect(h.loader.isTravelVignetteActive()).toBe(true);
    h.setPaused(true);
    h.loader.renderTravelVignette();
    await secondLoad;
    expect(h.loader.isTravelVignetteActive()).toBe(false);
  });

  it("requires a rising gamepad button edge after arming to skip", async () => {
    const h = createHarness();
    h.loader.syncTransition(
      { phase: "out", elapsed: 2, target: { area: "bay", spawn: "from-plaza" } },
      false,
    );
    h.setAreaState("bay");
    const loadPromise = h.loader.ensureArea();
    expect(h.loader.isTravelVignetteActive()).toBe(true);

    let skips = 0;
    const onSkip = (): void => {
      skips += 1;
      h.loader.skipTravelVignette();
    };
    // Button already held on opening frame must not auto-skip.
    h.loader.pollTravelGamepadSkip(true, onSkip);
    h.loader.pollTravelGamepadSkip(true, onSkip);
    expect(skips).toBe(0);
    // Release, then fresh press skips cleanly.
    h.loader.pollTravelGamepadSkip(false, onSkip);
    h.loader.pollTravelGamepadSkip(true, onSkip);
    expect(skips).toBe(1);
    await loadPromise;
    expect(h.loader.isTravelVignetteActive()).toBe(false);
  });
});

describe("E14: Travel Vignette WebP Asset Integrity", () => {
  it("ships all 5 valid, compact WebP postcards under public/assets/travel/", () => {
    expect(TRAVEL_VIGNETTE_IDS).toHaveLength(5);
    for (const id of TRAVEL_VIGNETTE_IDS) {
      const relativeUrl = travelCardAssetUrl(id);
      expect(relativeUrl).toBe(`assets/travel/${id}.webp`);
      const fullPath = join("public", relativeUrl);
      const stat = statSync(fullPath);
      expect(stat.size).toBeGreaterThan(1024);
      expect(stat.size).toBeLessThan(120 * 1024);
      const bytes = readFileSync(fullPath);
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
  });
});
