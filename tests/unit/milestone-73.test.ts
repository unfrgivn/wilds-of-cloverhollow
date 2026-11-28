import { describe, expect, it } from "vitest";
import type { Battle, BattleView } from "../../src/core";
import { followCamera, interpolatePoint, smoothFollowCamera } from "../../src/render/camera";
import {
  fairyHover,
  idleBreathing,
  roamerHop,
  sitSquash,
  walkPose,
} from "../../src/render/motion";
import { computeBattleChoreography } from "../../src/render/battle-choreography";

const viewSize = { width: 960, height: 720 };
const areaSize = { width: 2000, height: 1200 };
const deadZone = { x: 80, y: 60 };

function baseBattle(overrides: Partial<Battle> = {}): Battle {
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

function baseBattleView(battle: Battle, overrides: Partial<BattleView> = {}): BattleView {
  return {
    critterId: battle.critterId,
    critterName: "Chaos Frog",
    battleHeight: 145,
    auraCentre: { x: 256, y: 256 },
    bodyCentre: { x: 256, y: 256 },
    phase: battle.phase,
    activeActor: { id: "fae", name: "Fae" },
    message: battle.message,
    revealed: battle.revealed,
    commands: [
      { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: null },
      { id: "play", label: "Play", detail: null, disabled: false, feeling: null },
      { id: "cast", label: "Cast", detail: null, disabled: false, feeling: null },
      { id: "juggle", label: "Juggle", detail: null, disabled: false, feeling: null },
      { id: "snack", label: "Snack", detail: null, disabled: false, feeling: null },
      { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
    ],
    selected: battle.selected,
    energy: battle.energy,
    energyMax: 5,
    calm: battle.calm,
    calmMax: 100,
    check: null,
    hint: null,
    feelings: null,
    windUp: null,
    puff: 0,
    lastGrade: battle.lastGrade,
    rewardSticker: battle.rewardSticker,
    talk: null,
    sparkle: null,
    fluteAssist: null,
    burstSoften: 0,
    lassoAssist: null,
    lassoSteady: false,
    treatTray: null,
    ...overrides,
  };
}

describe("Milestone 73: 120 Hz interpolation & smooth damped camera", () => {
  it("interpolates points across alpha 0, 0.5, 1 and clamps out-of-range alpha", () => {
    const a = { x: 100, y: 200 };
    const b = { x: 140, y: 260 };
    expect(interpolatePoint(a, b, 0)).toEqual(a);
    expect(interpolatePoint(a, b, 0.5)).toEqual({ x: 120, y: 230 });
    expect(interpolatePoint(a, b, 1)).toEqual(b);
    expect(interpolatePoint(a, b, -0.5)).toEqual(a);
    expect(interpolatePoint(a, b, 1.5)).toEqual(b);
  });

  it("delegates straight to followCamera when snap is true", () => {
    const previous = { x: 520, y: 240 };
    const player = { x: 1090, y: 660 };
    expect(
      smoothFollowCamera(previous, player, "right", viewSize, areaSize, deadZone, true),
    ).toEqual(followCamera(previous, player, viewSize, areaSize, deadZone));
  });

  it("smoothly damps with facing look-ahead and clamps to area bounds when snap is false", () => {
    const previous = { x: 520, y: 240 };
    const player = { x: 1080, y: 600 };
    const target = followCamera(
      previous,
      { x: player.x + 22, y: player.y },
      viewSize,
      areaSize,
      deadZone,
    );
    const damped = smoothFollowCamera(
      previous,
      player,
      "right",
      viewSize,
      areaSize,
      deadZone,
      false,
    );
    expect(damped.x).toBeGreaterThan(previous.x);
    expect(damped.x).toBeLessThan(target.x);
    expect(damped.x).toBeCloseTo(previous.x + (target.x - previous.x) * 0.14, 5);

    const clampedEdge = smoothFollowCamera(
      { x: 1039, y: 479 },
      { x: 1995, y: 1195 },
      "right",
      viewSize,
      areaSize,
      deadZone,
      false,
    );
    expect(clampedEdge.x).toBeLessThanOrEqual(areaSize.width - viewSize.width);
    expect(clampedEdge.y).toBeLessThanOrEqual(areaSize.height - viewSize.height);

    const smallArea = { width: 400, height: 300 };
    expect(
      smoothFollowCamera(
        { x: -280, y: -210 },
        { x: 200, y: 150 },
        "right",
        viewSize,
        smallArea,
        deadZone,
        false,
      ),
    ).toEqual({ x: -280, y: -210 });
  });
});

describe("Milestone 73: procedural overworld motion helpers", () => {
  it("computes walk stride bounce, elastic squash-stretch, and Acorn Squirrel side bounds", () => {
    expect(walkPose(42, 126, false)).toEqual({
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
    const stride = walkPose(126 * 0.25, 126, true, false);
    expect(stride.offsetY).toBeCloseTo(-2.5, 4);
    expect(stride.scaleY).toBeCloseTo(1 - 0.022, 4);
    expect(stride.scaleX).toBeCloseTo(1 + 0.016, 4);

    const bound = walkPose(72 * 0.25, 72, true, true);
    expect(bound.offsetY).toBeCloseTo(-7, 4);
  });

  it("produces gentle idle breathing and continuous fairy hover bob with banking tilt", () => {
    const breath = idleBreathing(11 * Math.PI, 0, 0.015);
    expect(breath.scaleY).toBeCloseTo(1.015, 3);
    expect(breath.scaleX).toBeCloseTo(1 - 0.015 * 0.7, 3);

    const hover0 = fairyHover(0, 0);
    const hover1 = fairyHover(25, 0);
    expect(hover0.offsetY).toBeLessThan(0);
    expect(hover1.offsetY).toBeLessThan(0);
    expect(hover1.rotation).not.toBe(hover0.rotation);
  });

  it("triggers sitSquash only during sitDelayTicks..sitDelayTicks+7", () => {
    expect(sitSquash(29, 30).scaleY).toBe(1);
    expect(sitSquash(30, 30).scaleY).toBeCloseTo(0.9, 4);
    expect(sitSquash(33, 30).scaleY).toBeCloseTo(1.04, 4);
    expect(sitSquash(37, 30).scaleY).toBe(1);
    expect(sitSquash(38, 30).scaleY).toBe(1);
  });

  it("drives roamerHop startle jumps, faster chase hops, and directional lean", () => {
    const startleStart = roamerHop(10, true, true, 45, 45, "left");
    const startleApex = roamerHop(15, true, true, 50, 45, "left");
    expect(startleStart.offsetY).toBeLessThan(0);
    expect(startleApex.offsetY).toBeCloseTo(-12, 3);
    expect(startleApex.scaleY).toBeGreaterThan(1.05);

    const wander = roamerHop(7, true, false, 0, 45, "right");
    const chase = roamerHop(5, true, true, 60, 45, "right");
    expect(wander.rotation).toBeCloseTo(0.03, 4);
    expect(chase.rotation).toBeCloseTo(0.08, 4);
    expect(Math.abs(chase.offsetY)).toBeGreaterThan(Math.abs(wander.offsetY) * 0.5);
  });
});

describe("Milestone 73: Paper Mario / EarthBound battle choreography", () => {
  const partyIds = ["maddie", "sue", "jordan"] as const;
  const partyCommands: Record<string, string | null> = {
    maddie: "play",
    sue: "cast",
    jordan: "juggle",
  };

  it("steps the active command actor eagerly forward on the command menu", () => {
    const faeTurn = baseBattle({ phase: "command", selected: 0, actorIndex: 0 });
    const faeChoreo = computeBattleChoreography(
      faeTurn,
      baseBattleView(faeTurn, { activeActor: { id: "fae", name: "Fae" } }),
      10,
      partyIds,
      partyCommands,
    );
    expect(faeChoreo.fae.offsetX).toBe(16);
    expect(faeChoreo.party.maddie?.offsetX).toBe(0);

    const sueTurn = baseBattle({ phase: "command", selected: 0, actorIndex: 1 });
    const sueChoreo = computeBattleChoreography(
      sueTurn,
      baseBattleView(sueTurn, { activeActor: { id: "sue", name: "Sue" } }),
      10,
      partyIds,
      partyCommands,
    );
    expect(sueChoreo.fae.offsetX).toBe(0);
    expect(sueChoreo.party.sue?.offsetX).toBe(16);
  });

  it("tilts Fae live with Lean balance and wind-braced squash when a puff blows", () => {
    const battle = baseBattle({
      phase: "check",
      check: {
        kind: "lean",
        side: "fae",
        tick: 15,
        spec: { kind: "lean", puffTicks: 20, starts: [10], forces: [6], steer: 8, spring: 2 },
        strengths: [6],
        balance: -60,
        results: ["pending"],
        big: false,
      },
    });
    const view = baseBattleView(battle, {
      check: {
        kind: "lean",
        side: "fae",
        balance: -0.6,
        puffs: [{ blowing: true, progress: 0.25, force: 0.75, result: "pending" }],
      },
    });
    const choreo = computeBattleChoreography(battle, view, 20, partyIds, partyCommands);
    expect(choreo.fae.rotation).toBeCloseTo(-0.6 * 0.28, 4);
    expect(choreo.fae.offsetX).toBeLessThan(-6);
    expect(choreo.fae.scaleY).toBeLessThan(0.98);
  });

  it("poses Fae by Catch lane and emits sparkles when a toy is caught", () => {
    const makeCatch = (catcher: number, hit: boolean): Battle =>
      baseBattle({
        phase: "check",
        check: {
          kind: "catch",
          side: "fae",
          tick: 44,
          spec: { kind: "catch", travelTicks: 30, arrivals: [40], toys: ["ball"] },
          lanes: [0],
          catcher,
          results: [hit ? "hit" : "pending"],
          big: false,
        },
      });
    const high = computeBattleChoreography(
      makeCatch(0, true),
      null,
      10,
      partyIds,
      partyCommands,
    );
    const low = computeBattleChoreography(
      makeCatch(2, false),
      null,
      10,
      partyIds,
      partyCommands,
    );
    expect(high.fae.offsetY).toBe(-7);
    expect(low.fae.offsetY).toBe(4);
    expect(high.vfx.some((particle) => particle.texture === "sparkle")).toBe(true);
    expect(low.vfx).toHaveLength(0);
  });

  it("leans Sue back proportionally to Charge fill", () => {
    const battle = baseBattle({
      phase: "check",
      command: "cast",
      check: {
        kind: "charge",
        side: "critter",
        tick: 30,
        spec: {
          kind: "charge",
          waitTicks: 180,
          maxTicks: 60,
          targetTick: 44,
          greatWindow: 5,
          goodWindow: 11,
        },
        held: 45,
        big: false,
      },
    });
    const view = baseBattleView(battle, {
      check: {
        kind: "charge",
        side: "critter",
        actor: 1,
        waiting: false,
        fill: 0.75,
        great: [0.65, 0.82],
        good: [0.55, 0.92],
      },
    });
    const choreo = computeBattleChoreography(battle, view, 10, partyIds, partyCommands);
    expect(choreo.party.sue?.rotation).toBeCloseTo(-0.16 * 0.75, 4);
    expect(choreo.party.sue?.offsetX).toBeCloseTo(-10 * 0.75, 4);
  });

  it("emits energyRing + rainbow heart/sparkle VFX on great Soothe result", () => {
    const plain = baseBattle({
      phase: "result",
      command: "soothe",
      lastGrade: "great",
      answered: false,
      phaseTicks: 6,
    });
    const answered = baseBattle({ ...plain, answered: true });
    const plainChoreo = computeBattleChoreography(plain, null, 20, partyIds, partyCommands);
    const answeredChoreo = computeBattleChoreography(
      answered,
      null,
      20,
      partyIds,
      partyCommands,
    );
    expect(plainChoreo.vfx.some((particle) => particle.texture === "energyRing")).toBe(true);
    expect(plainChoreo.vfx.some((particle) => particle.texture === "heart")).toBe(true);
    expect(plainChoreo.vfx.some((particle) => particle.texture === "sparkle")).toBe(true);
    expect(answeredChoreo.vfx.length).toBeGreaterThan(plainChoreo.vfx.length);
  });

  it("recoils Fae with warm blush flash and micro stage shake on spent burstResult", () => {
    const battle = baseBattle({
      phase: "burstResult",
      lastGrade: "miss",
      phaseTicks: 3,
    });
    const choreo = computeBattleChoreography(battle, null, 20, partyIds, partyCommands);
    expect(choreo.fae.offsetX).toBeLessThan(-5);
    expect(choreo.fae.tintFlash).toBeGreaterThan(0.3);
    expect(Math.hypot(choreo.stageShake.x, choreo.stageShake.y)).toBeGreaterThan(0);
    expect(Math.hypot(choreo.stageShake.x, choreo.stageShake.y)).toBeLessThanOrEqual(3.5);
  });

  it("squashes critter wide on fizzle and expands aura with burst on soothed", () => {
    const fizzle = baseBattle({ phase: "fizzle", phaseTicks: 0 });
    const fizzleChoreo = computeBattleChoreography(fizzle, null, 0, partyIds, partyCommands);
    expect(fizzleChoreo.critter.scaleX).toBeCloseTo(1.18, 2);
    expect(fizzleChoreo.critter.scaleY).toBeCloseTo(0.8, 2);
    expect(fizzleChoreo.vfx.some((particle) => particle.texture === "puff")).toBe(true);

    const soothedStart = baseBattle({ phase: "soothed", phaseTicks: 6 });
    const soothedEnd = baseBattle({ phase: "soothed", phaseTicks: 30 });
    const startChoreo = computeBattleChoreography(
      soothedStart,
      null,
      10,
      partyIds,
      partyCommands,
    );
    const endChoreo = computeBattleChoreography(
      soothedEnd,
      null,
      34,
      partyIds,
      partyCommands,
    );
    expect(startChoreo.auraScaleBoost).toBeGreaterThan(1);
    expect(endChoreo.auraScaleBoost).toBeCloseTo(1.45, 4);
    expect(startChoreo.vfx.some((particle) => particle.texture === "heart")).toBe(true);
    expect(startChoreo.vfx.some((particle) => particle.texture === "sparkle")).toBe(true);
  });
});
