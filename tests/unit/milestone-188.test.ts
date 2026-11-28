import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  pointInPolygon,
  sceneryArea,
  targetInteractable,
  type Direction,
  type State,
} from "../../src/core";
import { effectRecipe, type CompanionAudioEffect } from "../../src/platform/audio-effects";
import { CameraDirector } from "../../src/render/camera";
import { REST_SPOTS } from "../../src/render/companions";
import {
  BEACH_BALL_HOME,
  BEACH_BALL_SANDBOX,
  createBeachBallState,
  createPebbleSkip,
  findNearbySanctuaryCritter,
  findPebbleSkipSpot,
  findSanctuaryCritterByKnot,
  PEBBLE_SKIP_DURATION,
  PEBBLE_SKIP_SPOTS,
  SANCTUARY_HOP_DURATION,
  SANCTUARY_HOP_STYLES,
  sanctuaryCritterHopPose,
  SCENIC_REST_SPOTS,
  scenicBenchChatter,
  scenicBenchZoom,
  shopBellForAreaEntry,
  stepBeachBall,
  stepPebbleSkip,
} from "../../src/render/micro-delights";
import { NEUTRAL_POSE } from "../../src/render/motion";

const { world, fixtures } = loadContent();

function stateIn(fixtureName: string, overrides: Partial<State> = {}): State {
  const fixture = fixtures[fixtureName] ?? fixtures["new-game"];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  return { ...createState(world, fixture, 1), ...overrides };
}

describe("Milestone 188: Track E16 Overworld Micro-Delights & Modular Relief", () => {
  it(
    "beach ball rests in Bubblegum Bay SE sand, bounces in sandbox, and flattens in reducedMotion",
    () => {
      const bay = world.areas.bay;
      if (bay === undefined) throw new Error("Missing bay area");
      const bayState = stateIn("bay");
      const scenery = sceneryArea(world, bayState.ink, bay);

      // Walkable, clear of blockers/triggers, and strictly outside both bay arrival viewports.
      expect(pointInPolygon(BEACH_BALL_HOME, bay.walkable)).toBe(true);
      for (const blocker of scenery.blockers) {
        expect(pointInPolygon(BEACH_BALL_HOME, blocker)).toBe(false);
      }
      for (const trigger of bay.triggers) {
        expect(pointInPolygon(BEACH_BALL_HOME, trigger.polygon)).toBe(false);
      }
      expect(BEACH_BALL_HOME.x).toBeGreaterThan(1280);
      expect(BEACH_BALL_HOME.y - 34).toBeGreaterThan(905);

      const ball = createBeachBallState();
      expect({ x: ball.x, y: ball.y, kicks: ball.kicks, z: ball.z }).toEqual({
        x: BEACH_BALL_HOME.x, y: BEACH_BALL_HOME.y, kicks: 0, z: 0,
      });

      // Walking right up to the ball launches velocity, vertical bounce, and increments kicks.
      const kick = stepBeachBall(
        ball, { x: BEACH_BALL_HOME.x - 20, y: BEACH_BALL_HOME.y + 4 }, true, 10, false,
      );
      expect(kick.kicked).toBe(true);
      expect(ball.kicks).toBe(1);
      expect(ball.vx).toBeGreaterThan(4);
      expect(ball.z).toBeGreaterThan(0);

      // Cooldown prevents instant re-kick on the very next tick.
      const cooldownTick = stepBeachBall(ball, { x: ball.x - 10, y: ball.y }, true, 11, false);
      expect(cooldownTick.kicked).toBe(false);
      expect(ball.kicks).toBe(1);

      // Repeated steps keep the ball elastically bounded inside BEACH_BALL_SANDBOX.
      let sawSpin = false;
      for (let t = 12; t <= 160; t += 1) {
        stepBeachBall(ball, { x: 200, y: 200 }, false, t, false);
        expect(ball.x).toBeGreaterThanOrEqual(BEACH_BALL_SANDBOX.minX);
        expect(ball.x).toBeLessThanOrEqual(BEACH_BALL_SANDBOX.maxX);
        expect(ball.y).toBeGreaterThanOrEqual(BEACH_BALL_SANDBOX.minY);
        expect(ball.y).toBeLessThanOrEqual(BEACH_BALL_SANDBOX.maxY);
        if (ball.spin !== 0) sawSpin = true;
      }
      expect(sawSpin).toBe(true);

      // Under reducedMotion, kicking rolls flatly with z === 0 and spin === 0.
      const calmBall = createBeachBallState();
      const calmKick = stepBeachBall(
        calmBall, { x: BEACH_BALL_HOME.x - 18, y: BEACH_BALL_HOME.y }, true, 5, true,
      );
      expect(calmKick.kicked).toBe(true);
      expect(calmBall.kicks).toBe(1);
      expect(calmBall.z).toBe(0);
      expect(calmBall.spin).toBe(0);
      for (let t = 6; t <= 30; t += 1) {
        stepBeachBall(calmBall, { x: 200, y: 200 }, false, t, true);
        expect(calmBall.z).toBe(0);
        expect(calmBall.spin).toBe(0);
      }
    },
  );

  it("all 3 shoreline pebble-skipping spots resolve cleanly and animate ripples + reducedMotion",
    () => {
      expect(PEBBLE_SKIP_SPOTS.map((spot) => spot.area).sort()).toEqual(["bay", "island", "park"]);
      const directions: readonly Direction[] = ["up", "down", "left", "right"];

      for (const spot of PEBBLE_SKIP_SPOTS) {
        const area = world.areas[spot.area];
        if (area === undefined) throw new Error(`Missing area ${spot.area}`);
        const base = stateIn(spot.area, {
          area: spot.area,
          player: { x: spot.x, y: spot.y },
          party: [],
        });
        const scenery = sceneryArea(world, base.ink, area);
        expect(pointInPolygon({ x: spot.x, y: spot.y }, area.walkable), spot.id).toBe(true);
        for (const blocker of scenery.blockers) {
          expect(pointInPolygon({ x: spot.x, y: spot.y }, blocker), spot.id).toBe(false);
        }
        for (const facing of directions) {
          const facingState = { ...base, facing };
          expect(targetInteractable(world, facingState), `${spot.id}:${facing}`).toBeUndefined();
          expect(findPebbleSkipSpot(world, facingState)?.id).toBe(spot.id);
        }

        // Standard skip emits stone arc, droplets, and 3-4 distinct ripple bounce points.
        const skip = createPebbleSkip(spot, 100, false);
        const rippleCenters = new Set<string>();
        let sawStone = false;
        let sawDroplet = false;
        for (let t = 100; t < 100 + PEBBLE_SKIP_DURATION; t += 1) {
          const frame = stepPebbleSkip(skip, t);
          expect(frame.active).toBe(true);
          if (frame.stone !== null) sawStone = true;
          if (frame.droplets.length > 0) sawDroplet = true;
          for (const ripple of frame.ripples) {
            rippleCenters.add(`${Math.round(ripple.x)},${Math.round(ripple.y)}`);
          }
        }
        expect(sawStone).toBe(true);
        expect(sawDroplet).toBe(true);
        expect(rippleCenters.size).toBe(spot.skips);
        expect(stepPebbleSkip(skip, 100 + PEBBLE_SKIP_DURATION).active).toBe(false);

        // Reduced Motion collapses to a single calm ripple with no stone or droplets.
        const calmSkip = createPebbleSkip(spot, 200, true);
        const calmFrame = stepPebbleSkip(calmSkip, 215);
        expect(calmFrame.active).toBe(true);
        expect(calmFrame.stone).toBeNull();
        expect(calmFrame.droplets).toEqual([]);
        expect(calmFrame.ripples).toHaveLength(1);
      }
    },
  );

  it("classifies cozy shop and arcade door bells accurately on live area crossings", () => {
    for (const shop of ["cafe", "market", "parlor", "lodge"]) {
      expect(shopBellForAreaEntry("plaza", shop)).toBe("shop-bell");
      expect(shopBellForAreaEntry(null, shop)).toBeNull();
      expect(shopBellForAreaEntry(shop, shop)).toBeNull();
    }
    expect(shopBellForAreaEntry("plaza", "arcade")).toBe("arcade-bell");
    expect(shopBellForAreaEntry(null, "arcade")).toBeNull();
    expect(shopBellForAreaEntry("arcade", "arcade")).toBeNull();

    for (const other of ["plaza", "park", "bay", "sanctuary", "bedroom", "harness"]) {
      expect(shopBellForAreaEntry("plaza", other)).toBeNull();
    }
  });

  it("scenic rest spots smoothly pull back camera zoom and emit spoiler-safe warm party chatter",
    () => {
      const scenicIds = Object.keys(SCENIC_REST_SPOTS);
      expect(scenicIds).toHaveLength(6);
      const restIds = new Set(REST_SPOTS.map((spot) => spot.id));
      for (const id of scenicIds) {
        expect(restIds.has(id), `${id} exists in REST_SPOTS`).toBe(true);
      }

      // Smooth pullback across ticks 18..48; neutral before 18, reducedMotion, or non-scenic.
      expect(scenicBenchZoom("park-bench", 0, false)).toBe(1);
      expect(scenicBenchZoom("park-bench", 17, false)).toBe(1);
      const midZoom = scenicBenchZoom("park-bench", 33, false);
      expect(midZoom).toBeLessThan(1);
      expect(midZoom).toBeGreaterThan(0.91);
      expect(scenicBenchZoom("park-bench", 48, false)).toBeCloseTo(0.91, 4);
      expect(scenicBenchZoom("park-bench", 120, false)).toBeCloseTo(0.91, 4);
      expect(scenicBenchZoom("park-bench", 60, true)).toBe(1);
      expect(scenicBenchZoom("cafe-chair", 60, false)).toBe(1);
      expect(scenicBenchZoom(null, 60, false)).toBe(1);

      // CameraDirector clamps scenicZoom safely inside area bounds in live and paused modes.
      const park = world.areas.park;
      if (park === undefined) throw new Error("Missing park area");
      const director = new CameraDirector();
      const parkState = stateIn("park", { player: { x: 740, y: 480 } });
      const frame = director.step({
        world, area: park, state: parkState, previousState: undefined,
        width: 1280, height: 720, viewWidth: 1280, viewHeight: 720, resolution: 1,
        doorFadeTicks: 16, paused: true, reducedMotion: false, alpha: 1,
        scenicZoom: scenicBenchZoom("park-bench", 60, false),
      });
      expect(frame.zoom).toBeCloseTo(0.91, 3);
      expect(frame.camera.x).toBeGreaterThanOrEqual(0);
      expect(frame.camera.y).toBeGreaterThanOrEqual(0);

      // Warm party chatter across ticks 36..240, strictly spoiler-free (zero Milo mentions).
      expect(scenicBenchChatter("park-bench", 20, ["maddie"], "park")).toBeNull();
      expect(scenicBenchChatter("park-bench", 250, ["maddie"], "park")).toBeNull();
      expect(scenicBenchChatter("park-bench", 60, [], "park")).toBeNull();

      for (const spotId of scenicIds) {
        for (const member of ["sue", "jordan", "maddie"] as const) {
          const chatter = scenicBenchChatter(spotId, 60, [member], spotId);
          expect(chatter, `${spotId}:${member}`).not.toBeNull();
          expect(chatter?.npcId).toBe(member);
          expect(chatter?.tone).toBe("warm");
          expect(chatter?.text.length ?? 0).toBeGreaterThan(10);
          expect(chatter?.text.toLowerCase() ?? "").not.toContain("milo");
        }
      }
    },
  );

  it("gives all 17 calm Sanctuary critters distinct hop poses and respects reducedMotion", () => {
    const sanctuary = world.areas.sanctuary;
    if (sanctuary === undefined) throw new Error("Missing sanctuary area");
    const sanctuaryCritterNpcs = sanctuary.npcs.filter((npc) => npc.id.startsWith("sanctuary-"));
    expect(sanctuaryCritterNpcs).toHaveLength(17);

    const styleSet = new Set<string>();
    for (const npc of sanctuaryCritterNpcs) {
      const style = SANCTUARY_HOP_STYLES[npc.id];
      expect(style, `${npc.id} missing hop style`).toBeDefined();
      if (style !== undefined) styleSet.add(style);

      const active = sanctuaryCritterHopPose(npc.id, 12, false);
      const changed =
        active.offsetX !== 0 ||
        active.offsetY !== 0 ||
        active.scaleX !== 1 ||
        active.scaleY !== 1 ||
        active.rotation !== 0;
      expect(changed, `${npc.id} active hop pose`).toBe(true);
      expect(sanctuaryCritterHopPose(npc.id, 12, true)).toEqual(NEUTRAL_POSE);
      expect(sanctuaryCritterHopPose(npc.id, SANCTUARY_HOP_DURATION, false)).toEqual(NEUTRAL_POSE);
    }
    expect(styleSet.size).toBe(10);

    // Knot lookup & nearby lookup resolve visible calm critters cleanly.
    const calmedState = stateIn("sanctuary", {
      area: "sanctuary",
      critters: { "fountain-frog": "calm" },
      player: { x: 420, y: 450 },
      facing: "right",
      party: [],
    });
    expect(findSanctuaryCritterByKnot(world, calmedState, "pet_frog")?.id).toBe("sanctuary-frog");
    expect(findNearbySanctuaryCritter(world, calmedState)?.id).toBe("sanctuary-frog");
  });

  it("keeps all 5 new E16 foley recipes gentle (<= 0.08 gain, zero square waves) and files lean",
    () => {
      const e16Effects: readonly CompanionAudioEffect[] = [
        "beach-ball-boop",
        "pebble-skip",
        "shop-bell",
        "arcade-bell",
        "sanctuary-hop",
      ];
      for (const effect of e16Effects) {
        const recipe = effectRecipe(effect);
        expect(recipe.length, effect).toBeGreaterThan(0);
        for (const seg of recipe) {
          expect(seg.wave, `${effect} avoids square wave`).not.toBe("square");
          expect(seg.gain, `${effect} gain <= 0.08`).toBeLessThanOrEqual(0.08);
          expect(seg.attack ?? 0, `${effect} smooth attack`).toBeGreaterThanOrEqual(0.003);
        }
      }

      const lineCount = (path: string): number =>
        readFileSync(path, "utf8").trimEnd().split("\n").length;
      expect(lineCount("src/main.ts")).toBeLessThan(880);
      expect(lineCount("src/render/micro-delights.ts")).toBeLessThan(460);
      expect(lineCount("src/render/micro-delights-render.ts")).toBeLessThan(240);
      expect(readFileSync("src/render/micro-delights.ts", "utf8")).not.toContain("pixi.js");
    },
  );
});
