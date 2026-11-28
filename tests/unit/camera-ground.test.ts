import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  surfaceAt,
  type Battle,
  type Point,
  type State,
} from "../../src/core";
import {
  addCameraTrauma,
  CameraDirector,
  clampCameraToArea,
  clampZoomToArea,
  computeParallaxOffset,
  createCameraTraumaState,
  detectTraumaImpulse,
  DIALOGUE_ZOOM,
  extractInkCurrentTags,
  followCamera,
  MAX_CAMERA_ZOOM,
  MAX_SHAKE_X,
  MAX_SHAKE_Y,
  MIN_CAMERA_ZOOM,
  parseCameraTags,
  resolveDialogueFocus,
  screenToWorld,
  stepCameraTrauma,
  worldToScreen,
} from "../../src/render/camera";
import {
  classifyFootstepEffect,
  computeGrassTuftSway,
  FOOTSTEP_VFX_STYLES,
  GRASS_TUFT_POOL_SIZE,
  isNearWaterShore,
  sampleNearbyGrassTufts,
} from "../../src/render/overworld-effects";
import {
  generateColdPressPaperGrainPixels,
  generateCssPaperGrainPixels,
  PAPER_GRAIN_LIVE_ALPHA,
  PAPER_GRAIN_PAUSED_ALPHA,
  PAPER_GRAIN_SIZE,
} from "../../src/render/paper-grain";
import { computeOverworldCameraFrame } from "../../src/render/view-projections";

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

function makeDialogue(
  knot: string,
  text = "Hello there!",
  partnerPoint?: Point,
): NonNullable<State["dialogue"]> {
  return {
    knot,
    speaker: "Friend",
    text,
    revealed: text.length,
    choices: [],
    selected: 0,
    ended: false,
    ...(partnerPoint !== undefined ? { partnerPoint } : {}),
  };
}

describe("Elevation E1: Presentation Camera Director", () => {
  const { world, fixtures } = loadContent();

  function stateFor(areaName: string): State {
    const fixture = fixtures[areaName];
    if (fixture !== undefined) return createState(world, fixture);
    const area = world.areas[areaName];
    if (area === undefined) throw new Error(`unknown area ${areaName}`);
    const spawnName = Object.keys(area.spawns)[0];
    if (spawnName === undefined) throw new Error(`area ${areaName} has no spawns`);
    return createState(world, { area: areaName, spawn: spawnName });
  }

  it("frames dialogue partners with weighted midpoints, clamping, and directive overrides", () => {
    const base = stateFor("plaza");
    const player: Point = { x: 600, y: 600 };
    expect(resolveDialogueFocus(world, base, player)).toBeNull();

    // 1. Explicit partnerPoint with 55/45 weighting and +44 camera focus offset (lifts actors up).
    const withPartner: State = {
      ...base,
      dialogue: makeDialogue("custom_knot", "Hi!", { x: 700, y: 640 }),
    };
    const partnerRes = resolveDialogueFocus(world, withPartner, player);
    expect(partnerRes).not.toBeNull();
    expect(partnerRes?.framing).toBe("dialogue");
    expect(partnerRes?.focus.x).toBeCloseTo(600 * 0.55 + 700 * 0.45, 5);
    expect(partnerRes?.focus.y).toBeCloseTo(600 * 0.55 + 640 * 0.45 + 44, 5);

    // 2. Max pull clamping keeps distant partners within 220 world units.
    const farPartner: State = {
      ...base,
      dialogue: makeDialogue("far_knot", "Way over here!", { x: 1700, y: 1050 }),
    };
    const farRes = resolveDialogueFocus(world, farPartner, player);
    expect(farRes).not.toBeNull();
    if (farRes !== null) {
      const pull = Math.hypot(farRes.focus.x - player.x, farRes.focus.y - player.y);
      expect(pull).toBeLessThanOrEqual(220.001);
      expect(pull).toBeGreaterThan(219);
    }

    // 3. Explicit # cam: directive overrides partner midpoint.
    const directed = resolveDialogueFocus(world, withPartner, player, {
      focus: { x: 875, y: 518 },
    });
    expect(directed).toEqual({ focus: { x: 875, y: 518 }, framing: "directive" });

    // 4. Visible area NPC match by knot.
    const plaza = world.areas.plaza;
    if (plaza === undefined) throw new Error("missing plaza area");
    const npc = plaza.npcs.find((item) => item.visibleWhile === undefined);
    if (npc === undefined) throw new Error("missing visible plaza npc");
    const withNpc: State = {
      ...base,
      player: { x: npc.point.x - 60, y: npc.point.y },
      dialogue: makeDialogue(npc.knot, "Lovely morning!"),
    };
    const npcRes = resolveDialogueFocus(world, withNpc, withNpc.player);
    expect(npcRes?.framing).toBe("dialogue");
    expect(npcRes?.focus.x).toBeGreaterThan(withNpc.player.x);

    // 5. Calm critter match by calmKnot.
    const critterPiece = plaza.critters[0];
    if (critterPiece !== undefined) {
      const kind = world.critters[critterPiece.id];
      if (kind !== undefined) {
        const withCalm: State = {
          ...base,
          critters: { ...base.critters, [critterPiece.id]: "calm" },
          player: { x: critterPiece.point.x - 50, y: critterPiece.point.y },
          dialogue: makeDialogue(kind.calmKnot, "Ribbit!"),
        };
        const calmRes = resolveDialogueFocus(world, withCalm, withCalm.player);
        expect(calmRes?.framing).toBe("dialogue");
        expect(calmRes?.focus.x).toBeGreaterThan(withCalm.player.x);
      }
    }

    // 6. Interactable hotspot match by knot.
    const spot = plaza.interactables[0];
    if (spot !== undefined) {
      const withSpot: State = {
        ...base,
        player: { x: spot.point.x - 40, y: spot.point.y },
        dialogue: makeDialogue(spot.knot, "A wooden sign."),
      };
      const spotRes = resolveDialogueFocus(world, withSpot, withSpot.player);
      expect(spotRes?.framing).toBe("dialogue");
      expect(spotRes?.focus.x).toBeGreaterThan(withSpot.player.x);
    }

    // 7. Narration fallback with no spatial partner.
    const narration: State = {
      ...base,
      dialogue: makeDialogue("nonexistent_narration_knot", "A gentle breeze."),
    };
    expect(resolveDialogueFocus(world, narration, player)).toEqual({
      focus: { x: player.x, y: player.y + 28 },
      framing: "dialogue",
    });
  });

  it("clamps zoom & camera safely in small rooms and large areas, and round-trips coords", () => {
    const view = { width: 960, height: 720 };
    const bedroom = world.areas.bedroom;
    const plaza = world.areas.plaza;
    const boardwalk = world.areas.boardwalk;
    if (!bedroom || !plaza || !boardwalk) throw new Error("missing areas");

    // Small room (bedroom 1050x700): zoom-out clamped to 1, zoom-in allowed up to MAX_CAMERA_ZOOM.
    expect(clampZoomToArea(0.85, view, bedroom)).toBe(1);
    expect(clampZoomToArea(1.07, view, bedroom)).toBe(1.07);
    expect(clampZoomToArea(1.8, view, bedroom)).toBe(MAX_CAMERA_ZOOM);

    // Large area (plaza 1750x1100): zoom-out allowed down to MIN_CAMERA_ZOOM.
    expect(clampZoomToArea(0.85, view, plaza)).toBe(MIN_CAMERA_ZOOM);
    expect(clampZoomToArea(0.5, view, plaza)).toBe(MIN_CAMERA_ZOOM);

    // Area just slightly larger than view clamps zoom-out tightly to minSafe.
    const tight = { width: 1000, height: 800 };
    expect(clampZoomToArea(0.85, view, tight)).toBeCloseTo(0.96, 5);

    // Camera clamping never leaks outside [0, area - effectiveView] at any zoom.
    for (const area of [plaza, boardwalk]) {
      for (const zoom of [0.85, 1, 1.07, 1.12, 1.35]) {
        const effW = view.width / zoom;
        const effH = view.height / zoom;
        const topLeft = clampCameraToArea({ x: -500, y: -500 }, view, area, zoom);
        const botRight = clampCameraToArea({ x: 9999, y: 9999 }, view, area, zoom);
        expect(topLeft).toEqual({ x: 0, y: 0 });
        expect(botRight.x).toBeCloseTo(area.width - effW, 5);
        expect(botRight.y).toBeCloseTo(area.height - effH, 5);
      }
    }

    // Small room vertical centering when area.height <= view.height / zoom.
    const bedCam = clampCameraToArea({ x: -100, y: 500 }, view, bedroom, 1);
    expect(bedCam.x).toBe(0);
    expect(bedCam.y).toBe((bedroom.height - view.height) / 2);

    // worldToScreen <-> screenToWorld round-trip at multiple zooms and aspect ratios.
    const cam: Point = { x: 240, y: 120 };
    const sample: Point = { x: 615.5, y: 402.25 };
    for (const zoom of [0.85, 1, 1.07, 1.25]) {
      const screen = worldToScreen(sample, cam, 960, 720, 1280, 720, zoom);
      const back = screenToWorld(screen, cam, 960, 720, 1280, 720, zoom);
      expect(back.x).toBeCloseTo(sample.x, 6);
      expect(back.y).toBeCloseTo(sample.y, 6);
    }
  });

  it("extracts and parses Ink camera directive tags cleanly and ignores invalid inputs", () => {
    const modernInk = JSON.stringify({
      currentFlowName: "DEFAULT_FLOW",
      flows: {
        DEFAULT_FLOW: {
          outputStream: [
            "^Look at the fountain!",
            "\n",
            "#",
            "^cam: 640, 420",
            "/#",
            "#",
            "^zoom: 1.12",
            "/#",
            "#",
            "^shake: 0.5",
            "/#",
          ],
        },
      },
    });
    const tags = extractInkCurrentTags(modernInk);
    expect(tags).toEqual(["cam: 640, 420", "zoom: 1.12", "shake: 0.5"]);
    expect(parseCameraTags(tags)).toEqual({
      focus: { x: 640, y: 420 },
      zoom: 1.12,
      shake: 0.5,
    });

    const legacyInk = JSON.stringify({
      outputStream: ["^Hi!", { "#": "cam: 120,340" }, { "#": "zoom: 2.5" }],
    });
    expect(parseCameraTags(extractInkCurrentTags(legacyInk))).toEqual({
      focus: { x: 120, y: 340 },
      zoom: MAX_CAMERA_ZOOM,
    });

    // Malformed / empty JSON and invalid tags are ignored safely; last valid tag wins.
    expect(extractInkCurrentTags("")).toEqual([]);
    expect(extractInkCurrentTags("{not valid json")).toEqual([]);
    expect(
      parseCameraTags([
        "cam: nope, 10",
        "zoom: -2",
        "shake: bad",
        "# cam: 100, 200",
        "cam: 300, 400",
        "zoom: 0.4",
        "shake: 3.2",
      ]),
    ).toEqual({
      focus: { x: 300, y: 400 },
      zoom: MIN_CAMERA_ZOOM,
      shake: 1,
    });
  });

  it("steps CameraDirector across live dialogue, paused baselines, and reduced motion", () => {
    const plaza = world.areas.plaza;
    if (plaza === undefined) throw new Error("missing plaza");
    const base = stateFor("plaza");

    // 1. Paused harness determinism matches computeOverworldCameraFrame bit-for-bit.
    const pausedDirector = new CameraDirector();
    const pausedFrame = pausedDirector.step({
      world,
      area: plaza,
      state: base,
      previousState: undefined,
      width: 1280,
      height: 720,
      viewWidth: 1280,
      viewHeight: 720,
      resolution: 1,
      doorFadeTicks: world.tunables.doorFadeTicks,
      paused: true,
      reducedMotion: false,
      alpha: 1,
    });
    const baseline = computeOverworldCameraFrame({
      area: plaza,
      state: base,
      previousState: undefined,
      previousCamera: undefined,
      width: 1280,
      height: 720,
      viewWidth: 1280,
      viewHeight: 720,
      resolution: 1,
      doorFadeTicks: world.tunables.doorFadeTicks,
      paused: true,
      reducedMotion: false,
      alpha: 1,
    });
    expect(pausedFrame.zoom).toBe(1);
    expect(pausedFrame.framing).toBe("follow");
    expect(pausedFrame.shakeOffset).toEqual({ x: 0, y: 0 });
    expect(pausedFrame.parallaxOver).toEqual({ x: 0, y: 0 });
    expect(pausedFrame.parallaxAmbient).toEqual({ x: 0, y: 0 });
    expect(pausedFrame.camera).toEqual(
      followCamera(undefined, base.player, { width: 1280, height: 720 }, plaza, { x: 80, y: 60 }),
    );
    expect(pausedFrame.zoomScale).toBe(baseline.zoomScale);
    expect(pausedFrame.zoomOffsetX).toBe(baseline.zoomOffsetX);
    expect(pausedFrame.zoomOffsetY).toBe(baseline.zoomOffsetY);

    // 2. Live dialogue smoothly eases zoom up toward DIALOGUE_ZOOM, then returns to 1 on close.
    const liveDirector = new CameraDirector();
    const stepLive = (s: State, prev?: State) =>
      liveDirector.step({
        world,
        area: plaza,
        state: s,
        previousState: prev,
        width: 1280,
        height: 720,
        viewWidth: 1280,
        viewHeight: 720,
        resolution: 1,
        doorFadeTicks: world.tunables.doorFadeTicks,
        paused: false,
        reducedMotion: false,
        alpha: 1,
      });

    const f0 = stepLive(base);
    expect(f0.zoom).toBe(1);
    expect(f0.framing).toBe("follow");

    let cur: State = {
      ...base,
      tick: 1,
      dialogue: makeDialogue("talk_test", "Hi Fae!", {
        x: base.player.x + 90,
        y: base.player.y - 20,
      }),
    };
    let lastFrame = f0;
    for (let i = 0; i < 40; i += 1) {
      cur = { ...cur, tick: i + 1 };
      lastFrame = stepLive(cur);
    }
    expect(lastFrame.framing).toBe("dialogue");
    expect(lastFrame.zoom).toBeCloseTo(DIALOGUE_ZOOM, 2);

    // Close dialogue -> zoom eases smoothly back to 1.
    for (let i = 0; i < 60; i += 1) {
      lastFrame = stepLive({ ...base, tick: 50 + i, dialogue: null });
    }
    expect(lastFrame.framing).toBe("follow");
    expect(lastFrame.zoom).toBeCloseTo(1, 3);

    // 3. Explicit Ink # cam / # zoom in paused mode snaps cleanly with zero shake/parallax.
    const directedInk = JSON.stringify({
      currentFlowName: "DEFAULT_FLOW",
      flows: {
        DEFAULT_FLOW: {
          outputStream: ["^Behold!", "#", "^cam: 875, 518", "/#", "#", "^zoom: 1.15", "/#"],
        },
      },
    });
    const directedState: State = {
      ...base,
      ink: directedInk,
      dialogue: makeDialogue("fountain_view", "Behold!"),
    };
    const snapDirected = new CameraDirector().step({
      world,
      area: plaza,
      state: directedState,
      previousState: undefined,
      width: 1280,
      height: 720,
      viewWidth: 1280,
      viewHeight: 720,
      resolution: 1,
      doorFadeTicks: world.tunables.doorFadeTicks,
      paused: true,
      reducedMotion: false,
      alpha: 1,
    });
    expect(snapDirected.framing).toBe("directive");
    expect(snapDirected.zoom).toBeCloseTo(1.15, 5);
    expect(snapDirected.shakeOffset).toEqual({ x: 0, y: 0 });
    expect(snapDirected.parallaxOver).toEqual({ x: 0, y: 0 });

    // 4. Reduced Motion keeps zoom === 1, zero shake, zero parallax, honors # cam:.
    const rmFrame = new CameraDirector().step({
      world,
      area: plaza,
      state: directedState,
      previousState: undefined,
      width: 1280,
      height: 720,
      viewWidth: 1280,
      viewHeight: 720,
      resolution: 1,
      doorFadeTicks: world.tunables.doorFadeTicks,
      paused: false,
      reducedMotion: true,
      alpha: 1,
    });
    expect(rmFrame.zoom).toBe(1);
    expect(rmFrame.framing).toBe("directive");
    expect(rmFrame.shakeOffset).toEqual({ x: 0, y: 0 });
    expect(rmFrame.parallaxOver).toEqual({ x: 0, y: 0 });
  });

  it("handles damped trauma screen-shake impulses, decay, and accessibility guards", () => {
    const base = stateFor("plaza");
    // Impulse detection across all gameplay beats.
    expect(detectTraumaImpulse(base, { ...base, battle: makeBattle() })).toBe(0.45);
    expect(
      detectTraumaImpulse(
        { ...base, battle: makeBattle({ phase: "check" }) },
        { ...base, battle: makeBattle({ phase: "burstResult", lastGrade: "miss" }) },
      ),
    ).toBe(0.65);
    expect(
      detectTraumaImpulse(
        { ...base, battle: makeBattle({ phase: "check" }) },
        { ...base, battle: makeBattle({ phase: "burstResult", lastGrade: "good" }) },
      ),
    ).toBe(0.32);
    expect(
      detectTraumaImpulse(
        { ...base, battle: makeBattle({ lassoUsed: false }) },
        { ...base, battle: makeBattle({ lassoUsed: true }) },
      ),
    ).toBe(0.55);
    expect(
      detectTraumaImpulse(
        base,
        { ...base, previousInput: { ...base.previousInput, lasso: true } },
      ),
    ).toBe(0.48);
    expect(
      detectTraumaImpulse(
        { ...base, battle: makeBattle({ phase: "check", command: "soothe" }) },
        {
          ...base,
          battle: makeBattle({ phase: "result", command: "soothe", lastGrade: "great" }),
        },
      ),
    ).toBe(0.36);
    expect(
      detectTraumaImpulse(
        { ...base, battle: makeBattle({ phase: "check", command: "together" }) },
        {
          ...base,
          battle: makeBattle({ phase: "result", command: "together", lastGrade: "great" }),
        },
      ),
    ).toBe(0.72);
    expect(
      detectTraumaImpulse(
        base,
        { ...base, dialogue: makeDialogue("door_knot", "CLUNK! The gate opens!") },
      ),
    ).toBe(0.5);
    expect(
      detectTraumaImpulse(
        base,
        { ...base, dialogue: makeDialogue("rumble_knot", "The pebbles rattle.") },
        0.6,
      ),
    ).toBe(0.6);

    // Quadratic decay to zero, strictly bounded.
    let trauma = addCameraTrauma(createCameraTraumaState(), 0.8, 10);
    const first = stepCameraTrauma(trauma, 10, {
      reducedMotion: false,
      paused: false,
      areaId: "plaza",
    });
    expect(Math.abs(first.offset.x)).toBeLessThanOrEqual(MAX_SHAKE_X);
    expect(Math.abs(first.offset.y)).toBeLessThanOrEqual(MAX_SHAKE_Y);
    expect(Math.hypot(first.offset.x, first.offset.y)).toBeGreaterThan(0);

    trauma = first.state;
    for (let t = 11; t <= 45; t += 1) {
      const next = stepCameraTrauma(trauma, t, {
        reducedMotion: false,
        paused: false,
        areaId: "plaza",
      });
      expect(Math.abs(next.offset.x)).toBeLessThanOrEqual(MAX_SHAKE_X);
      expect(Math.abs(next.offset.y)).toBeLessThanOrEqual(MAX_SHAKE_Y);
      trauma = next.state;
    }
    expect(trauma.trauma).toBe(0);

    // Strictly zero under reducedMotion, paused, and harness.
    const charged = addCameraTrauma(createCameraTraumaState(), 1, 20);
    for (const opts of [
      { reducedMotion: true, paused: false, areaId: "plaza" },
      { reducedMotion: false, paused: true, areaId: "plaza" },
      { reducedMotion: false, paused: false, areaId: "harness" },
    ]) {
      const zeroed = stepCameraTrauma(charged, 20, opts);
      expect(zeroed.state.trauma).toBe(0);
      expect(zeroed.offset).toEqual({ x: 0, y: 0 });
    }
  });

  it("computes bounded opposite parallax relative to area center and zeros when disabled", () => {
    const area = { width: 2000, height: 1200 };
    const view = { width: 960, height: 720 };
    // Right of center -> negative parallax X, capped at maxOffset.
    const right = computeParallaxOffset({ x: 1000, y: 400 }, area, view, 0.04, 18, true);
    expect(right.x).toBeLessThan(0);
    expect(Math.abs(right.x)).toBeLessThanOrEqual(18);
    expect(right.y).toBeLessThan(0);
    expect(Math.abs(right.y)).toBeLessThanOrEqual(18);

    // Extreme displacement clamps strictly to maxOffset.
    const clamped = computeParallaxOffset({ x: 5000, y: -5000 }, area, view, 0.04, 12, true);
    expect(clamped).toEqual({ x: -12, y: 12 });

    // Disabled returns exact zero.
    expect(computeParallaxOffset({ x: 1000, y: 400 }, area, view, 0.04, 18, false)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("Elevation E1: Living Ground Reactivity & Cold-Press Paper Grain", () => {
  const { world } = loadContent();

  it("classifies real content surface maps into surface- and shore-aware footstep VFX", () => {
    const classifyAt = (areaId: string, point: Point) => {
      const map = world.surfaces[areaId];
      if (map === undefined) throw new Error(`missing surface map for ${areaId}`);
      const surface = surfaceAt(map, point);
      return { surface, kind: classifyFootstepEffect(surface, areaId, point) };
    };

    // Plaza: stone dust away from fountain, water-ripple along fountain rim.
    expect(classifyAt("plaza", { x: 450, y: 760 })).toEqual({ surface: "stone", kind: "dust" });
    expect(classifyAt("plaza", { x: 875, y: 560 })).toEqual({
      surface: "stone",
      kind: "water-ripple",
    });

    // Park: meadow grass-fleck in center, water-ripple by pond.
    expect(classifyAt("park", { x: 745, y: 585 })).toEqual({
      surface: "grass",
      kind: "grass-fleck",
    });
    expect(classifyAt("park", { x: 985, y: 845 }).kind).toBe("water-ripple");

    // Pass: snowy trail -> snow-sparkle.
    expect(classifyAt("pass", { x: 500, y: 500 })).toEqual({
      surface: "snow",
      kind: "snow-sparkle",
    });

    // Bay: dry inland sand -> sand-fleck, shoreline sand -> water-ripple, wooden dock -> dust.
    expect(classifyAt("bay", { x: 320, y: 760 })).toEqual({
      surface: "sand",
      kind: "sand-fleck",
    });
    expect(classifyAt("bay", { x: 900, y: 340 })).toEqual({
      surface: "sand",
      kind: "water-ripple",
    });
    expect(classifyAt("bay", { x: 1180, y: 380 })).toEqual({ surface: "wood", kind: "dust" });

    // Woods: meadow grass -> grass-fleck, stream stepping stones -> water-ripple.
    expect(classifyAt("woods", { x: 500, y: 650 })).toEqual({
      surface: "grass",
      kind: "grass-fleck",
    });
    expect(classifyAt("woods", { x: 1050, y: 500 })).toEqual({
      surface: "stone",
      kind: "water-ripple",
    });

    // Bedroom: wood & carpet -> dust.
    expect(classifyAt("bedroom", { x: 200, y: 400 })).toEqual({ surface: "wood", kind: "dust" });
    expect(classifyAt("bedroom", { x: 528, y: 474 })).toEqual({
      surface: "carpet",
      kind: "dust",
    });

    // Additional water features: sanctuary lily pond & cavern shallow pools.
    expect(isNearWaterShore("sanctuary", { x: 320, y: 340 }, "grass")).toBe(true);
    expect(isNearWaterShore("cavern", { x: 840, y: 542 }, "stone")).toBe(true);
    expect(Object.keys(FOOTSTEP_VFX_STYLES)).toHaveLength(5);
  });

  it("samples grass tufts only on real grass surfaces and bends away from moving feet", () => {
    const parkArea = world.areas.park;
    const parkMap = world.surfaces.park;
    const woodsArea = world.areas.woods;
    const woodsMap = world.surfaces.woods;
    const plazaArea = world.areas.plaza;
    const plazaMap = world.surfaces.plaza;
    if (!parkArea || !parkMap || !woodsArea || !woodsMap || !plazaArea || !plazaMap) {
      throw new Error("missing areas/surfaces");
    }

    const parkTufts = sampleNearbyGrassTufts(parkMap, parkArea, { x: 745, y: 585 });
    expect(parkTufts.length).toBeGreaterThan(0);
    expect(parkTufts.length).toBeLessThanOrEqual(GRASS_TUFT_POOL_SIZE);
    for (const tuft of parkTufts) {
      expect(surfaceAt(parkMap, tuft)).toBe("grass");
      expect(Math.hypot(tuft.x - 745, tuft.y - 585)).toBeLessThanOrEqual(165.001);
    }
    // Deterministic across repeated calls.
    expect(sampleNearbyGrassTufts(parkMap, parkArea, { x: 745, y: 585 })).toEqual(parkTufts);

    const woodsTufts = sampleNearbyGrassTufts(woodsMap, woodsArea, { x: 450, y: 650 });
    expect(woodsTufts.length).toBeGreaterThan(0);
    for (const tuft of woodsTufts) {
      expect(surfaceAt(woodsMap, tuft)).toBe("grass");
    }

    // Non-grass area returns zero tufts.
    expect(sampleNearbyGrassTufts(plazaMap, plazaArea, { x: 600, y: 600 })).toEqual([]);

    // Sway bends away from nearby feet, stronger while moving, zero under reducedMotion.
    const tuftPos: Point = { x: 500, y: 500 };
    const idleNear = computeGrassTuftSway(
      tuftPos,
      [{ x: 485, y: 500, moving: false }],
      12,
      42,
      false,
    );
    const movingNear = computeGrassTuftSway(
      tuftPos,
      [{ x: 485, y: 500, moving: true }],
      12,
      42,
      false,
    );
    const movingRight = computeGrassTuftSway(
      tuftPos,
      [{ x: 515, y: 500, moving: true }],
      12,
      42,
      false,
    );
    expect(idleNear.bend).toBeGreaterThan(0);
    expect(movingNear.bend).toBeGreaterThan(idleNear.bend);
    expect(movingNear.scaleY).toBeLessThan(1);
    expect(movingNear.scaleX).toBeGreaterThan(1);
    expect(movingRight.bend).toBeLessThan(0);

    expect(
      computeGrassTuftSway(tuftPos, [{ x: 485, y: 500, moving: true }], 12, 42, true),
    ).toEqual({ rotation: 0, scaleX: 1, scaleY: 1, bend: 0 });
  });

  it("generates deterministic, seamless warm ivory cold-press paper grain & CSS grain", () => {
    expect(PAPER_GRAIN_SIZE).toBe(256);
    expect(PAPER_GRAIN_LIVE_ALPHA).toBe(0.05);
    expect(PAPER_GRAIN_PAUSED_ALPHA).toBe(0.035);

    const a = generateColdPressPaperGrainPixels(64);
    const b = generateColdPressPaperGrainPixels(64);
    expect(a.length).toBe(64 * 64 * 4);
    expect(Array.from(a)).toEqual(Array.from(b));

    let minR = 255;
    let maxR = 0;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i] ?? 0;
      const g = a[i + 1] ?? 0;
      const bl = a[i + 2] ?? 0;
      const al = a[i + 3] ?? 0;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      expect(r).toBeGreaterThanOrEqual(222);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBe(r - 1);
      expect(bl).toBe(r - 3);
      expect(al).toBe(255);
    }
    expect(maxR - minR).toBeGreaterThan(6);

    // Toroidal wrap continuity across opposite edges.
    let horizEdgeDiff = 0;
    let vertEdgeDiff = 0;
    for (let i = 0; i < 64; i += 1) {
      horizEdgeDiff += Math.abs((a[(i * 64 + 0) * 4] ?? 0) - (a[(i * 64 + 63) * 4] ?? 0));
      vertEdgeDiff += Math.abs((a[(0 * 64 + i) * 4] ?? 0) - (a[(63 * 64 + i) * 4] ?? 0));
    }
    expect(horizEdgeDiff / 64).toBeLessThan(6);
    expect(vertEdgeDiff / 64).toBeLessThan(6);

    // CSS paper grain pixels: sepia #5a4228 with subtle alpha 0..15.
    const cssA = generateCssPaperGrainPixels(64);
    const cssB = generateCssPaperGrainPixels(64);
    expect(Array.from(cssA)).toEqual(Array.from(cssB));
    let maxAlpha = 0;
    for (let i = 0; i < cssA.length; i += 4) {
      expect(cssA[i]).toBe(0x5a);
      expect(cssA[i + 1]).toBe(0x42);
      expect(cssA[i + 2]).toBe(0x28);
      const alpha = cssA[i + 3] ?? 0;
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(15);
      if (alpha > maxAlpha) maxAlpha = alpha;
    }
    expect(maxAlpha).toBeGreaterThan(4);
  });

  it("keeps src/render/view.ts strictly under 760 lines and src/render/camera.ts Pixi-free", () => {
    const viewSrc = fs.readFileSync("src/render/view.ts", "utf8");
    const cameraSrc = fs.readFileSync("src/render/camera.ts", "utf8");
    expect(viewSrc.split("\n").length).toBeLessThan(760);
    expect(cameraSrc).not.toContain("pixi.js");
  });
});
