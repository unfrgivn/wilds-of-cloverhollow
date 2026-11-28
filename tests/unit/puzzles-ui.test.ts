import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  step,
  type ActionFrame,
  type Direction,
  type Point,
  type State,
} from "../../src/core";
import {
  combineInputFrames,
  gamepadFrame,
  GamepadLatch,
  type StandardGamepad,
} from "../../src/platform/gamepad";
import { keyboardFrame } from "../../src/platform/keyboard";
import { TouchInput } from "../../src/platform/touch";
import { NEUTRAL_POSE } from "../../src/render/motion";
import { computeFaePose } from "../../src/render/overworld-render";
import { computePromptScreenView } from "../../src/render/view-projections";
import { buildFluteWheelView } from "../../src/ui/flute-wheel";

const { world } = loadContent();
const none = blankInput();
const press = (partial: Partial<ActionFrame>): ActionFrame => ({ ...none, ...partial });

function pad(
  buttons: readonly number[] = [],
  axes: readonly number[] = [0, 0],
  mapping = "standard",
): StandardGamepad {
  return {
    mapping,
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: buttons.includes(index),
      value: buttons.includes(index) ? 1 : 0,
    })),
  };
}

function makeState(
  area: string,
  spawn: string,
  overrides?: {
    player?: Point;
    facing?: Direction;
    party?: string[];
    variables?: Record<string, boolean>;
  },
): State {
  const base = createState(world, {
    area,
    spawn,
    seed: 11,
    ...(overrides?.party === undefined ? {} : { party: overrides.party }),
    ...(overrides?.variables === undefined ? {} : { variables: overrides.variables }),
  });
  return {
    ...base,
    ...(overrides?.player === undefined ? {} : { player: overrides.player }),
    ...(overrides?.facing === undefined ? {} : { facing: overrides.facing }),
  };
}

describe("Cozy Dash & Tool Input Bindings (Keyboard, Gamepad, Touch)", () => {
  it("maps ShiftLeft and ShiftRight to dash: true and omits dash when unpressed", () => {
    const idle = keyboardFrame(new Set());
    expect("dash" in idle).toBe(false);
    expect(idle.dash).toBeUndefined();

    const left = keyboardFrame(new Set(["ShiftLeft", "ArrowRight"]));
    expect(left.dash).toBe(true);
    expect(left.move).toEqual({ x: 1, y: 0 });

    const right = keyboardFrame(new Set(["ShiftRight"]));
    expect(right.dash).toBe(true);
  });

  it("maps gamepad B (1) and R2 (7) to dash, merges via combineInputFrames, and latches", () => {
    const empty = gamepadFrame([pad()]);
    expect("dash" in empty).toBe(false);

    const byB = gamepadFrame([pad([1])]);
    expect(byB.dash).toBe(true);
    expect(byB.cancel).toBe(true);

    const byR2 = gamepadFrame([pad([7])]);
    expect(byR2.dash).toBe(true);
    expect(byR2.cancel).toBe(false);

    const mergedOff = combineInputFrames(blankInput(), blankInput(), blankInput());
    expect("dash" in mergedOff).toBe(false);

    const mergedFromKb = combineInputFrames({ ...blankInput(), dash: true }, blankInput(), none);
    expect(mergedFromKb.dash).toBe(true);

    const mergedFromPad = combineInputFrames(none, none, byR2);
    expect(mergedFromPad.dash).toBe(true);

    const latch = new GamepadLatch();
    latch.update(byR2);
    latch.update(blankInput());
    const latched = latch.frame();
    expect(latched.dash).toBe(true);
    const cleared = latch.frame();
    expect("dash" in cleared).toBe(false);
  });

  it("toggles TouchInput dash state cleanly and omits dash when off", () => {
    const touch = new TouchInput();
    expect(touch.isDashOn()).toBe(false);
    expect("dash" in touch.frame()).toBe(false);

    expect(touch.toggleDash()).toBe(true);
    expect(touch.isDashOn()).toBe(true);
    expect(touch.frame().dash).toBe(true);
    expect(touch.sample().dash).toBe(true);

    touch.setDash(false);
    expect(touch.isDashOn()).toBe(false);
    expect("dash" in touch.frame()).toBe(false);

    touch.tapButton("lasso");
    expect(touch.sample().lasso).toBe(true);
    expect("lasso" in touch.frame()).toBe(false);
  });
});

describe("Harmony Flute Wheel UI projection", () => {
  it("projects closed, listening, entered notes, wrong, matched, and overlay-hidden states", () => {
    let state = makeState("woods", "pass", {
      player: { x: 340, y: 810 },
      facing: "up",
      variables: { has_flute: true },
    });
    expect(buildFluteWheelView(world, state).visible).toBe(false);

    state = step(world, state, press({ flute: true })).state;
    const open = buildFluteWheelView(world, state);
    expect(open.visible).toBe(true);
    expect(open.bellId).toBe("woods-bell");
    expect(open.sequence).toEqual(["up", "down", "right"]);
    expect(open.hintLabel).toBe("Red · Green · Yellow");
    expect(open.entered).toEqual([]);
    expect(open.status).toBe("listening");

    // Journal/dialogue/finale hide the wheel projection even if wheel state exists.
    expect(buildFluteWheelView(world, { ...state, journalOpen: true }).visible).toBe(false);
    expect(buildFluteWheelView(world, { ...state, finale: "credits" }).visible).toBe(false);

    // Enter wrong 3-note melody via touch choices.
    state = step(world, state, none).state;
    state = step(world, state, press({ choose: 0 })).state;
    const oneNote = buildFluteWheelView(world, state);
    expect(oneNote.entered).toEqual(["up"]);
    expect(oneNote.lastNote).toBe("up");
    expect(oneNote.noteSeq).toBe(1);

    state = step(world, state, none).state;
    state = step(world, state, press({ choose: 0 })).state;
    state = step(world, state, none).state;
    state = step(world, state, press({ choose: 0 })).state;
    const wrong = buildFluteWheelView(world, state);
    expect(wrong.status).toBe("wrong");
    expect(wrong.entered).toEqual(["up", "up", "up"]);

    // Wait 24 ticks for reset, then enter right melody: up (0), down (2), right (1).
    for (let i = 0; i < 24; i += 1) state = step(world, state, none).state;
    for (const choice of [0, 2, 1]) {
      state = step(world, state, press({ choose: choice })).state;
      state = step(world, state, none).state;
    }
    const matched = buildFluteWheelView(world, state);
    expect(matched.visible).toBe(true);
    expect(matched.status).toBe("matched");
    expect(matched.entered).toEqual(["up", "down", "right"]);
  });
});

describe("Puzzle prompt screen projection & Cozy Dash Fae pose", () => {
  it("projects Rotate, Hold, Call Back, and Play prompts when no Ink interactable targets", () => {
    const cam: Point = { x: 0, y: 0 };

    // Rotate mirror in Crystal Cavern.
    const nearMirror = makeState("cavern", "entrance", {
      player: { x: 680, y: 875 },
      facing: "right",
    });
    const mirrorPrompt = computePromptScreenView(world, nearMirror, cam, 960, 720, 960, 720);
    expect(mirrorPrompt.visible).toBe(true);
    expect(mirrorPrompt.label).toBe("ROTATE");

    // Hold and Call Back companion plate in Frosty Pass.
    const nearPlate = makeState("pass", "bus", {
      player: { x: 1140, y: 965 },
      facing: "right",
      party: ["sue", "jordan", "maddie"],
      variables: { sue_joined: true, jordan_joined: true },
    });
    const holdPrompt = computePromptScreenView(world, nearPlate, cam, 960, 720, 960, 720);
    expect(holdPrompt.visible).toBe(true);
    expect(holdPrompt.label).toBe("HOLD");

    const held = step(world, nearPlate, press({ confirm: true })).state;
    const releasePrompt = computePromptScreenView(world, held, cam, 960, 720, 960, 720);
    expect(releasePrompt.visible).toBe(true);
    expect(releasePrompt.label).toBe("CALL BACK");

    // Play resonance bell in Whispering Woods.
    const nearBell = makeState("woods", "pass", {
      player: { x: 340, y: 810 },
      facing: "up",
      variables: { has_flute: true },
    });
    const playPrompt = computePromptScreenView(world, nearBell, cam, 960, 720, 960, 720);
    expect(playPrompt.visible).toBe(true);
    expect(playPrompt.label).toBe("PLAY");
  });

  it("gives Fae a bouncy forward-leaning skip pose while dashing and obeys Reduced Motion", () => {
    const base = makeState("plaza", "fountain", { facing: "right" });
    const walking: State = {
      ...base,
      motion: { moving: true, distance: 18 },
      previousInput: press({ move: { x: 1, y: 0 } }),
    };
    const dashingRight: State = {
      ...base,
      facing: "right",
      motion: { moving: true, distance: 18 },
      previousInput: press({ move: { x: 1, y: 0 }, dash: true }),
    };
    const dashingLeft: State = {
      ...dashingRight,
      facing: "left",
    };

    const walk = computeFaePose(walking, true, 72, walking.player, null, null);
    const dashR = computeFaePose(dashingRight, true, 72, dashingRight.player, null, null);
    const dashL = computeFaePose(dashingLeft, true, 72, dashingLeft.player, null, null);
    const reduced = computeFaePose(dashingRight, false, 72, dashingRight.player, null, null);

    expect(dashR.rotation).toBeGreaterThan(0);
    expect(dashL.rotation).toBeLessThan(0);
    expect(dashR.rotation).toBeCloseTo(-dashL.rotation, 6);
    expect(Math.abs(dashR.offsetY)).toBeGreaterThan(Math.abs(walk.offsetY));
    expect(reduced).toEqual(NEUTRAL_POSE);
  });
});
