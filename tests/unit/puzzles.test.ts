import { describe, expect, it } from "vitest";
import { loadContent, parseAreaPuzzles } from "../../src/content/load";
import {
  areaConnectionErrors,
  hiddenPositions,
  propBlockerErrors,
  propDrawingErrors,
} from "../../src/content/area-checks";
import {
  DASH_SPEED_MULTIPLIER,
  FLUTE_KNOT,
  blankInput,
  createState,
  distance,
  distanceToPolygon,
  isPressurePlateActive,
  isPuzzleSolved,
  isSteppingStoneGroupLit,
  mirrorOrientation,
  parseSave,
  pointInPolygon,
  pushablePosition,
  reflectDirection,
  rotateOrientation,
  serializeSave,
  setInkVariables,
  soundCues,
  stableHash,
  step,
  targetInteractable,
  targetPuzzleAction,
  tracePrismBeams,
  type ActionFrame,
  type Area,
  type Direction,
  type Point,
  type PrismOrientation,
  type State,
} from "../../src/core";

const { world, fixtures } = loadContent();
const none = blankInput();
const press = (partial: Partial<ActionFrame>): ActionFrame => ({ ...none, ...partial });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`Missing area ${id}`);
  return area;
}

function makeState(
  area: string,
  spawn: string,
  overrides?: {
    player?: Point;
    facing?: Direction;
    party?: string[];
    variables?: Record<string, boolean>;
    lantern?: boolean;
  },
): State {
  const base = createState(world, {
    area,
    spawn,
    seed: 7,
    ...(overrides?.party === undefined ? {} : { party: overrides.party }),
    ...(overrides?.variables === undefined ? {} : { variables: overrides.variables }),
  });
  return {
    ...base,
    ...(overrides?.player === undefined ? {} : { player: overrides.player }),
    ...(overrides?.facing === undefined ? {} : { facing: overrides.facing }),
    ...(overrides?.lantern === undefined ? {} : { lantern: overrides.lantern }),
  };
}

function walkTicks(state: State, move: Point, ticks: number, dash = false): State {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    current = step(
      world,
      current,
      dash ? press({ move, dash: true }) : press({ move }),
    ).state;
  }
  return current;
}

function tapNote(state: State, note: Direction): { state: State; cues: string[] } {
  const move: Point =
    note === "up"
      ? { x: 0, y: -1 }
      : note === "down"
        ? { x: 0, y: 1 }
        : note === "left"
          ? { x: -1, y: 0 }
          : { x: 1, y: 0 };
  const pressed = step(world, state, press({ move })).state;
  const cues = soundCues(state, pressed, world);
  const released = step(world, pressed, none).state;
  return { state: released, cues };
}

describe("Cozy Dash & blankInput determinism", () => {
  it("moves at 1.45x walkSpeed, slides safely around concave corners, and keeps party close",
    () => {
      const start = makeState("harness", "start", { party: ["maddie", "sue"] });
      const walked = walkTicks(start, { x: 1, y: 0 }, 20, false);
      const dashed = walkTicks(start, { x: 1, y: 0 }, 20, true);
      const walkDist = distance(start.player, walked.player);
      const dashDist = distance(start.player, dashed.player);
      expect(dashDist / walkDist).toBeCloseTo(DASH_SPEED_MULTIPLIER, 2);

      // Party companions keep up without drifting far behind during a sustained dash.
      const longDash = walkTicks(start, { x: 1, y: 0 }, 45, true);
      for (const member of longDash.party) {
        expect(distance(longDash.player, member)).toBeLessThan(210);
      }

      // Concave corner dash safety: never leaves walkable or enters blockers on any tick.
      const harness = areaFor("harness");
      const radius = world.tunables.playerRadius;
      let cur = makeState("harness", "start");
    const dirs: Point[] = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];
    for (const move of dirs) {
      for (let t = 0; t < 40; t += 1) {
        cur = step(world, cur, press({ move, dash: true })).state;
        expect(pointInPolygon(cur.player, harness.walkable)).toBe(true);
        expect(distanceToPolygon(cur.player, harness.walkable)).toBeGreaterThanOrEqual(
          radius - 0.01,
        );
        for (const blocker of harness.blockers) {
          expect(pointInPolygon(cur.player, blocker)).toBe(false);
          expect(distanceToPolygon(cur.player, blocker)).toBeGreaterThanOrEqual(radius - 0.01);
        }
      }
    }
  });

  it("keeps blankInput() free of optional dash and never allocates puzzle state lazily", () => {
    const frame = blankInput();
    expect("dash" in frame).toBe(false);
    const start = makeState("gym", "door");
    const after = walkTicks(start, { x: 0, y: 0 }, 10);
    expect(after.puzzleArea).toBeUndefined();
    expect(after.puzzles).toBeUndefined();
    const rerun = walkTicks(makeState("gym", "door"), { x: 0, y: 0 }, 10);
    expect(stableHash(after)).toBe(stableHash(rerun));
  });
});

describe("Pushables, snowball sliding, companion hold-switch & multi-plate solving", () => {
  it("pushes School Gym crate onto plate, clamps to blockers, and solves with lasso lever", () => {
    const gym = areaFor("gym");
    const crate = gym.puzzles?.pushables?.[0];
    const plate = gym.puzzles?.plates?.[0];
    if (crate === undefined || plate === undefined) throw new Error("gym puzzle defs missing");

    let state = makeState("gym", "door", {
      player: { x: 1005, y: 640 },
      facing: "left",
      variables: { has_lasso: true },
    });
    expect(isPressurePlateActive(gym, state, plate)).toBe(false);

    // Push crate west onto gym-plate at (910, 640).
    state = walkTicks(state, { x: -1, y: 0 }, 30);
    const cratePos = pushablePosition(gym, state, crate);
    expect(cratePos.x).toBeLessThan(930);
    expect(isPressurePlateActive(gym, state, plate)).toBe(true);
    expect(isPuzzleSolved(world, state, "gym-supply-puzzle")).toBe(false);

    // Push a fresh crate east into the gym blocker and confirm strict clamping.
    let clamped = makeState("gym", "door", {
      player: { x: 935, y: 640 },
      facing: "right",
    });
    clamped = walkTicks(clamped, { x: 1, y: 0 }, 40, true);
    const eastPos = pushablePosition(gym, clamped, crate);
    const r = crate.radius ?? 20;
    expect(pointInPolygon(eastPos, gym.walkable)).toBe(true);
    for (const blocker of gym.blockers) {
      expect(pointInPolygon(eastPos, blocker)).toBe(false);
      expect(distanceToPolygon(eastPos, blocker)).toBeGreaterThanOrEqual(r - 0.05);
    }

    // Now lasso the gym-lever at (610, 400) from (610, 520) facing up -> solves puzzle!
    const coinsBefore = state.coins;
    const beforeLasso: State = {
      ...state,
      player: { x: 610, y: 520 },
      facing: "up",
      previousInput: none,
    };
    const afterLasso = step(world, beforeLasso, press({ lasso: true })).state;
    const cues = soundCues(beforeLasso, afterLasso, world);
    expect(cues).toContain("lasso-twirl");
    expect(cues).toContain("sticker");
    expect(afterLasso.puzzleArea?.lasso?.kind).toBe("pull");
    expect(isPuzzleSolved(world, afterLasso, "gym-supply-puzzle")).toBe(true);
    expect(afterLasso.coins).toBe(coinsBefore + 10);
  });

  it("slides snowball onto plate, clamps against walls, and yanks crate/snowball via lasso", () => {
    const pass = areaFor("pass");
    const snowball = pass.puzzles?.pushables?.[0];
    const snowPlate = pass.puzzles?.plates?.find((item) => item.id === "pass-plate-snow");
    if (snowball === undefined || snowPlate === undefined) {
      throw new Error("pass puzzle defs missing");
    }

    // Push snowball east -> slides at 6u/tick and snaps cleanly onto pass-plate-snow (1240, 1005).
    let state = makeState("pass", "bus", {
      player: { x: 1126, y: 1005 },
      facing: "right",
      variables: { has_lasso: true },
    });
    state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    expect(state.puzzleArea?.pushables?.[snowball.id]?.sliding).toEqual({ dx: 1, dy: 0 });
    state = walkTicks(state, { x: 0, y: 0 }, 20);
    const landed = pushablePosition(pass, state, snowball);
    expect(landed).toEqual({ x: snowPlate.x, y: snowPlate.y });
    expect(state.puzzleArea?.pushables?.[snowball.id]?.sliding).toBeUndefined();
    expect(isPressurePlateActive(pass, state, snowPlate)).toBe(true);

    // Push snowball south into wall -> slides until wall, clamps legally, stops sliding.
    let south = makeState("pass", "bus", {
      player: { x: 1160, y: 970 },
      facing: "down",
    });
    south = step(world, south, press({ move: { x: 0, y: 1 } })).state;
    south = walkTicks(south, { x: 0, y: 0 }, 25);
    const southPos = pushablePosition(pass, south, snowball);
    expect(south.puzzleArea?.pushables?.[snowball.id]?.sliding).toBeUndefined();
    expect(pointInPolygon(southPos, pass.walkable)).toBe(true);
    expect(distanceToPolygon(southPos, pass.walkable)).toBeGreaterThanOrEqual(
      (snowball.radius ?? 18) - 0.05,
    );

    // Lasso pull snowball from east of pass-plate-snow -> slides east and snaps onto plate!
    let lassoPull = makeState("pass", "bus", {
      player: { x: 1290, y: 1005 },
      facing: "left",
      variables: { has_lasso: true },
    });
    lassoPull = step(world, lassoPull, press({ lasso: true })).state;
    expect(lassoPull.puzzleArea?.lasso?.kind).toBe("yank");
    lassoPull = walkTicks(lassoPull, { x: 0, y: 0 }, 20);
    expect(pushablePosition(pass, lassoPull, snowball)).toEqual({
      x: snowPlate.x,
      y: snowPlate.y,
    });

    // Lasso pull non-sliding crate in School Gym -> yanks ~52u toward Fae!
    const gym = areaFor("gym");
    const crate = gym.puzzles?.pushables?.[0];
    if (crate === undefined) throw new Error("gym crate missing");
    const yankStart = makeState("gym", "door", {
      player: { x: 840, y: 640 },
      facing: "right",
      variables: { has_lasso: true },
    });
    const yanked = step(world, yankStart, press({ lasso: true })).state;
    expect(yanked.puzzleArea?.lasso?.kind).toBe("yank");
    expect(pushablePosition(gym, yanked, crate).x).toBeLessThan(930);
    expect(pushablePosition(gym, yanked, crate).x).toBeGreaterThan(910);
  });

  it("holds Jordan on a co-op plate while Fae moves, solves Pass puzzle, and recalls him", () => {
    const pass = areaFor("pass");
    const jordanPlate = pass.puzzles?.plates?.find((item) => item.id === "pass-plate-jordan");
    const snowPlate = pass.puzzles?.plates?.find((item) => item.id === "pass-plate-snow");
    if (jordanPlate === undefined || snowPlate === undefined) {
      throw new Error("pass plates missing");
    }

    let state = makeState("pass", "bus", {
      player: { x: 1140, y: 965 },
      facing: "right",
      party: ["sue", "jordan", "maddie"],
      variables: { sue_joined: true, jordan_joined: true },
    });
    const holdTarget = targetPuzzleAction(world, state);
    expect(holdTarget?.kind).toBe("hold-plate");
    expect(holdTarget?.id).toBe("pass-plate-jordan");

    // Assign Jordan to hold the plate.
    const assigned = step(world, state, press({ confirm: true })).state;
    expect(soundCues(state, assigned, world)).toContain("choice-select");
    expect(assigned.puzzleArea?.heldPlates?.["pass-plate-jordan"]).toBe("jordan");
    expect(isPressurePlateActive(pass, assigned, jordanPlate)).toBe(true);

    // Move Fae south-west to push the snowball; Jordan stays planted while Sue/Maddie follow.
    state = step(world, assigned, none).state;
    state = walkTicks(state, { x: -1, y: 0 }, 25);
    const jordanAfterMove = state.party.find((member) => member.id === "jordan");
    const sueAfterMove = state.party.find((member) => member.id === "sue");
    expect(jordanAfterMove).toBeDefined();
    expect(jordanAfterMove?.x).toBe(jordanPlate.x);
    expect(jordanAfterMove?.y).toBe(jordanPlate.y);
    expect(jordanAfterMove?.facing).toBe("left");
    expect(sueAfterMove).toBeDefined();
    expect(distance(sueAfterMove!, state.player)).toBeLessThan(120);

    // Push snowball onto pass-plate-snow -> solves pass-snowball-coop (+15 coins)!
    const coinsBefore = state.coins;
    state = { ...state, player: { x: 1126, y: 1005 }, facing: "right", previousInput: none };
    state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    state = walkTicks(state, { x: 0, y: 0 }, 20);
    expect(isPressurePlateActive(pass, state, jordanPlate)).toBe(true);
    expect(isPressurePlateActive(pass, state, snowPlate)).toBe(true);
    expect(isPuzzleSolved(world, state, "pass-snowball-coop")).toBe(true);
    expect(state.coins).toBe(coinsBefore + 15);

    // Recall Jordan back to the party.
    const nearPlate: State = {
      ...state,
      player: { x: 1140, y: 965 },
      facing: "right",
      previousInput: none,
    };
    expect(targetPuzzleAction(world, nearPlate)?.kind).toBe("release-plate");
    const recalled = step(world, nearPlate, press({ confirm: true })).state;
    expect(soundCues(nearPlate, recalled, world)).toContain("choice-select");
    expect(recalled.puzzleArea?.heldPlates).toBeUndefined();
    const walking = walkTicks(step(world, recalled, none).state, { x: -1, y: 0 }, 35);
    const jordanWalking = walking.party.find((member) => member.id === "jordan");
    expect(jordanWalking?.x).toBeLessThan(jordanPlate.x - 10);
  });
});

describe("Prism beam reflection, crate blocking & Crystal Cavern puzzle", () => {
  it("rotates orientations clockwise and reflects beams symmetrically across all 4 angles", () => {
    const cycle: PrismOrientation[] = ["ne", "se", "sw", "nw"];
    expect(cycle.map(rotateOrientation)).toEqual(["se", "sw", "nw", "ne"]);

    expect(reflectDirection("down", "ne")).toBe("right");
    expect(reflectDirection("left", "ne")).toBe("up");
    expect(reflectDirection("up", "ne")).toBeNull();
    expect(reflectDirection("right", "ne")).toBeNull();

    expect(reflectDirection("up", "se")).toBe("right");
    expect(reflectDirection("left", "se")).toBe("down");
    expect(reflectDirection("down", "se")).toBeNull();
    expect(reflectDirection("right", "se")).toBeNull();

    expect(reflectDirection("up", "sw")).toBe("left");
    expect(reflectDirection("right", "sw")).toBe("down");
    expect(reflectDirection("down", "sw")).toBeNull();
    expect(reflectDirection("left", "sw")).toBeNull();

    expect(reflectDirection("down", "nw")).toBe("left");
    expect(reflectDirection("right", "nw")).toBe("up");
    expect(reflectDirection("up", "nw")).toBeNull();
    expect(reflectDirection("left", "nw")).toBeNull();
  });

  it("solves Crystal Cavern prism puzzle, mirrors cavern_bridge_lit, and opens spring crossing",
    () => {
      const cavern = areaFor("cavern");
      const m1 = cavern.puzzles?.mirrors?.find((item) => item.id === "cavern-mirror-1");
      const m2 = cavern.puzzles?.mirrors?.find((item) => item.id === "cavern-mirror-2");
      if (m1 === undefined || m2 === undefined) throw new Error("cavern mirrors missing");

      // Lantern OFF -> emitter inactive.
      let state = makeState("cavern", "entrance", {
        player: { x: 600, y: 875 },
        facing: "right",
        variables: { has_lantern: true, has_lasso: true },
        lantern: false,
      });
      expect(tracePrismBeams(cavern, state).activeEmitters).toEqual([]);

      // Lantern ON far away -> outside lanternRange (180).
      const far = { ...state, player: { x: 420, y: 425 }, lantern: true };
      expect(tracePrismBeams(cavern, far).activeEmitters).toEqual([]);

      // Rotate mirror 1 twice with confirm: se -> sw -> nw.
      state = { ...state, player: { x: 680, y: 875 }, facing: "right" };
      expect(targetPuzzleAction(world, state)?.kind).toBe("rotate-mirror");
      const rot1 = step(world, state, press({ confirm: true })).state;
      expect(soundCues(state, rot1, world)).toContain("choice-select");
      expect(mirrorOrientation(cavern, rot1, m1)).toBe("sw");
      const rot1Release = step(world, rot1, none).state;
      const rot2 = step(world, rot1Release, press({ confirm: true })).state;
      expect(mirrorOrientation(cavern, rot2, m1)).toBe("nw");

      // Rotate mirror 2 once from afar with Rainbow Lasso: ne -> se!
      const aimMirror2: State = {
        ...step(world, rot2, none).state,
        player: { x: 720, y: 850 },
        facing: "up",
        previousInput: none,
      };
      const lassoRot = step(world, aimMirror2, press({ lasso: true })).state;
      expect(lassoRot.puzzleArea?.lasso?.kind).toBe("rotate");
      expect(mirrorOrientation(cavern, lassoRot, m2)).toBe("se");
      expect(soundCues(aimMirror2, lassoRot, world)).toEqual(
        expect.arrayContaining(["lasso-twirl", "choice-select"]),
      );

      // Stand near emitter (580, 875) and turn lantern ON -> beam completes all 3 legs & solves!
      const nearEmitter: State = {
        ...walkTicks(lassoRot, { x: 0, y: 0 }, 15),
        player: { x: 600, y: 875 },
        lantern: false,
        previousInput: none,
      };
      const lit = step(world, nearEmitter, press({ lantern: true })).state;
      const beams = tracePrismBeams(cavern, lit);
      expect(beams.activeEmitters).toEqual(["cavern-emitter"]);
      expect(beams.segments).toHaveLength(3);
      expect(beams.energizedReceivers).toEqual(["cavern-receiver"]);
      expect(isPuzzleSolved(world, lit, "cavern-prism")).toBe(true);
      expect(world.storyVariable(lit.ink, "cavern_bridge_lit")).toBe(true);

      // Spring crossing is now open: Fae walks right across at y = 545!
      const atStream: State = {
        ...step(world, lit, none).state,
        player: { x: 740, y: 545 },
        facing: "right",
      };
      const crossed = walkTicks(atStream, { x: 1, y: 0 }, 80);
      expect(crossed.player.x).toBeGreaterThan(950);
    });

  it("blocks a prism beam when a pushable crate sits in its path", () => {
    const cavern = areaFor("cavern");
    const blockedArea: Area = {
      ...cavern,
      puzzles: {
        emitters: [{ id: "e1", x: 580, y: 875, direction: "right" }],
        receivers: [{ id: "r1", x: 780, y: 875, radius: 28 }],
        pushables: [{ id: "box", kind: "crate", x: 680, y: 875, radius: 20 }],
      },
    };
    const state = makeState("cavern", "entrance");
    const blocked = tracePrismBeams(blockedArea, state);
    expect(blocked.energizedReceivers).toEqual([]);
    expect(blocked.segments[0]?.to.x).toBeCloseTo(660, 1);

    const clearState: State = {
      ...state,
      puzzleArea: { pushables: { box: { x: 680, y: 800 } } },
    };
    const unblocked = tracePrismBeams(blockedArea, clearState);
    expect(unblocked.energizedReceivers).toEqual(["r1"]);
  });
});

describe("Rainbow Lasso swing, grapple post & open-air miss arc", () => {
  it("swings Fae and party cleanly across Cliffside Trail gap and pulls grapple post", () => {
    const trail = areaFor("trail");
    const stones = trail.puzzles?.steppingStones?.[0];
    if (stones === undefined) throw new Error("trail stepping stones missing");

    // Swing from landA (925, 240) to landB (1105, 255).
    let state = makeState("trail", "pass", {
      player: { x: 925, y: 240 },
      facing: "right",
      party: ["sue", "maddie"],
      variables: { has_lasso: true, sue_joined: true },
    });
    state = step(world, state, press({ lasso: true })).state;
    expect(state.puzzleArea?.lasso?.kind).toBe("swing");

    for (let tick = 0; tick < 16; tick += 1) {
      state = step(world, state, none).state;
      expect(pointInPolygon(state.player, trail.walkable)).toBe(true);
    }
    expect(state.puzzleArea?.lasso).toBeUndefined();
    expect(distance(state.player, { x: 1105, y: 255 })).toBeLessThan(12);
    for (const member of state.party) {
      expect(pointInPolygon(member, trail.walkable)).toBe(true);
      expect(distance(member, state.player)).toBeLessThan(180);
    }

    // Pull trail-grapple post from afar -> solves trail-crossing and lights stones permanently.
    const aimPost: State = {
      ...state,
      player: { x: 950, y: 330 },
      facing: "right",
      lantern: false,
      previousInput: none,
    };
    expect(isSteppingStoneGroupLit(world, aimPost, stones)).toBe(false);
    const pulled = step(world, aimPost, press({ lasso: true })).state;
    expect(isPuzzleSolved(world, pulled, "trail-crossing")).toBe(true);
    expect(pulled.coins).toBe(aimPost.coins + 12);
    expect(isSteppingStoneGroupLit(world, pulled, stones)).toBe(true);
  });

  it("plays a 12-tick open-air miss arc and cleans up cleanly", () => {
    const start = makeState("plaza", "fountain", {
      facing: "right",
      variables: { has_lasso: true },
    });
    let state = step(world, start, press({ lasso: true })).state;
    expect(state.puzzleArea?.lasso?.kind).toBe("miss");
    expect(soundCues(start, state, world)).toContain("lasso-twirl");
    state = walkTicks(state, { x: 0, y: 0 }, 12);
    expect(state.puzzleArea).toBeUndefined();
  });
});

describe("Blacklight Lantern invisible stepping stones & safety nudge", () => {
  it("blocks unlit trail gap, allows crossing while lit, and nudges clear when turned off", () => {
    const trail = areaFor("trail");
    const stones = trail.puzzles?.steppingStones?.[0];
    if (stones === undefined) throw new Error("trail stones missing");

    // Lantern OFF: cannot enter gapPolygon (995..1070, 295..365).
    const dark = makeState("trail", "pass", {
      player: { x: 960, y: 330 },
      facing: "right",
      variables: { has_lantern: true },
      lantern: false,
    });
    const blocked = walkTicks(dark, { x: 1, y: 0 }, 25);
    expect(blocked.player.x).toBeLessThan(995);

    // Turn lantern ON -> stones light up, Fae walks right onto the middle stone (1035, 330).
    let lit = step(world, dark, press({ lantern: true })).state;
    expect(isSteppingStoneGroupLit(world, lit, stones)).toBe(true);
    lit = walkTicks(step(world, lit, none).state, { x: 1, y: 0 }, 22);
    expect(pointInPolygon(lit.player, stones.gapPolygon)).toBe(true);
    expect(lit.puzzleArea?.steppedGroups).toContain("trail-stones");

    // Turn lantern OFF while inside temporary gap -> safely nudged out with playerRadius!
    const darkened = step(world, lit, press({ lantern: true })).state;
    expect(darkened.lantern).toBe(false);
    expect(pointInPolygon(darkened.player, stones.gapPolygon)).toBe(false);
    expect(distanceToPolygon(darkened.player, stones.gapPolygon)).toBeGreaterThanOrEqual(
      world.tunables.playerRadius - 0.05,
    );
  });
});

describe("Harmony Flute Wheel, Whispering Woods, Starlight Island & Misty Path 3-Tool Seal", () => {
  it("keeps FLUTE_KNOT dialogue away from bells and solves Whispering Woods vine bridge", () => {
    const woods = areaFor("woods");
    const vines = woods.puzzles?.bridges?.[0];
    if (vines === undefined) throw new Error("woods vines missing");

    // Away from woods-bell (at knothole 400, 635 -> distance 157 > 130): opens FLUTE_KNOT!
    const away = makeState("woods", "pass", {
      player: { x: 400, y: 635 },
      variables: { has_flute: true },
    });
    const fluteTalk = step(world, away, press({ flute: true })).state;
    expect(fluteTalk.dialogue?.knot).toBe(FLUTE_KNOT);
    expect(fluteTalk.puzzleArea?.fluteWheel).toBeUndefined();

    // Unbloomed vine bridge blocks crossing (220..315, 815..860).
    const beforeVines = makeState("woods", "pass", {
      player: { x: 268, y: 780 },
      facing: "down",
      variables: { has_flute: true },
    });
    const blockedVines = walkTicks(beforeVines, { x: 0, y: 1 }, 25);
    expect(blockedVines.player.y).toBeLessThan(815);

    // Near woods-bell (340, 780): open Harmony Flute Wheel via flute key.
    let state = makeState("woods", "pass", {
      player: { x: 340, y: 810 },
      facing: "up",
      variables: { has_flute: true },
    });
    expect(targetPuzzleAction(world, state)?.kind).toBe("play-bell");
    state = step(world, state, press({ flute: true })).state;
    expect(state.puzzleArea?.fluteWheel?.bellId).toBe("woods-bell");
    state = step(world, state, none).state;

    // Wrong 3-note chime -> status "wrong", resets after 24 ticks.
    for (const note of ["up", "up", "up"] as const) {
      state = tapNote(state, note).state;
    }
    expect(state.puzzleArea?.fluteWheel?.status).toBe("wrong");
    state = walkTicks(state, { x: 0, y: 0 }, 24);
    expect(state.puzzleArea?.fluteWheel?.status).toBe("listening");
    expect(state.puzzleArea?.fluteWheel?.entered).toEqual([]);

    // Right 3-note chime: up (Red), down (Green), right (Yellow) using touch choose + keys!
    const c1 = tapNote(state, "up");
    expect(c1.cues).toContain("flute-red");
    const c2 = tapNote(c1.state, "down");
    expect(c2.cues).toContain("flute-green");
    const touchRight = step(world, c2.state, press({ choose: 1 })).state;
    const cues3 = soundCues(c2.state, touchRight, world);
    expect(cues3).toContain("flute-yellow");
    expect(cues3).toContain("sticker");
    expect(touchRight.puzzleArea?.fluteWheel?.status).toBe("matched");
    expect(isPuzzleSolved(world, touchRight, "woods-vine-harmony")).toBe(true);
    expect(touchRight.coins).toBe(state.coins + 12);

    // Auto-closes after 24 ticks and vine bridge is now walkable!
    const closed = walkTicks(step(world, touchRight, none).state, { x: 0, y: 0 }, 24);
    expect(closed.puzzleArea?.fluteWheel).toBeUndefined();
    const walkedAcross = walkTicks(
      { ...closed, player: { x: 268, y: 785 }, facing: "down", previousInput: none },
      { x: 0, y: 1 },
      30,
    );
    expect(walkedAcross.player.y).toBeGreaterThan(860);
  });

  it("solves Starlight Island seashell bell and avoids double-awarding coins when Ink solved",
    () => {
      let state = makeState("island", "pier", {
        player: { x: 470, y: 545 },
        facing: "up",
        variables: { has_flute: true },
      });
      // Confirm opens wheel near seashell bell when no Ink interactable is targeted.
      expect(targetInteractable(world, state)).toBeUndefined();
      state = step(world, state, press({ confirm: true })).state;
      expect(state.puzzleArea?.fluteWheel?.bellId).toBe("island-seashell-bell");
      state = step(world, state, none).state;
      for (const note of ["up", "right", "left"] as const) {
        state = tapNote(state, note).state;
      }
      expect(isPuzzleSolved(world, state, "island-seashell-harmony")).toBe(true);
      expect(world.storyVariable(state.ink, "island_shells_solved")).toBe(true);
      expect(state.coins).toBe(20);

      // If Ink already solved island_shells_solved, playing bell awards 0 extra coins.
      let alreadyInk = makeState("island", "pier", {
        player: { x: 470, y: 545 },
        facing: "up",
        variables: { has_flute: true, island_shells_solved: true },
      });
      alreadyInk = step(world, alreadyInk, press({ flute: true })).state;
      alreadyInk = step(world, alreadyInk, none).state;
      for (const note of ["up", "right", "left"] as const) {
        alreadyInk = tapNote(alreadyInk, note).state;
      }
      expect(alreadyInk.coins).toBe(0);
    });

  it("completes the 3-Tool Enchanted Forest Seal Ritual in Misty Path and clears on area exit",
    () => {
      let state = makeState("mist", "field", {
        player: { x: 340, y: 575 },
        facing: "right",
        variables: { has_lantern: true, has_lasso: true, has_flute: true },
        lantern: false,
      });

      // 1) Blacklight Lantern stepping stones open mist-band and set found_mist_way.
      state = step(world, state, press({ lantern: true })).state;
      state = walkTicks(step(world, state, none).state, { x: 1, y: 0 }, 35);
      expect(state.player.x).toBeGreaterThan(420);
      expect(isPuzzleSolved(world, state, "mist-lantern-ritual")).toBe(true);
      expect(world.storyVariable(state.ink, "found_mist_way")).toBe(true);

      // 2) Rainbow Lasso pulls mist-gully-post and sets rope_bridge so gully opens!
      state = { ...state, player: { x: 760, y: 580 }, facing: "right", previousInput: none };
      state = step(world, state, press({ lasso: true })).state;
      expect(isPuzzleSolved(world, state, "mist-lasso-ritual")).toBe(true);
      expect(world.storyVariable(state.ink, "rope_bridge")).toBe(true);
      state = walkTicks(step(world, state, none).state, { x: 1, y: 0 }, 65);
      expect(state.player.x).toBeGreaterThan(950);

      // 3) Harmony Flute Wheel solves mist-seal-shrine + composite mist-forest-seal -> seal_open!
      state = { ...state, player: { x: 1275, y: 555 }, facing: "up", previousInput: none };
      state = step(world, state, press({ flute: true })).state;
      state = step(world, state, none).state;
      for (const note of ["up", "right", "left"] as const) {
        state = tapNote(state, note).state;
      }
      expect(isPuzzleSolved(world, state, "mist-flute-ritual")).toBe(true);
      expect(isPuzzleSolved(world, state, "mist-forest-seal")).toBe(true);
      expect(world.storyVariable(state.ink, "seal_open")).toBe(true);

      // Transition into Enchanted Forest -> clears transient puzzleArea, keeps persistent puzzles!
      state = walkTicks(state, { x: 0, y: 0 }, 24);
      state = { ...state, player: { x: 1300, y: 570 }, facing: "right", previousInput: none };
      for (let tick = 0; tick < 80 && state.area === "mist"; tick += 1) {
        const frame = state.transition === null ? press({ move: { x: 1, y: 0 } }) : none;
        state = step(world, state, frame).state;
      }
      expect(state.area).toBe("enchanted");
      expect(state.puzzleArea).toBeUndefined();
      expect(state.puzzles?.["mist-forest-seal"]).toBe(true);
    });
});

describe("Save v10 puzzle compatibility & content validation", () => {
  it("round-trips v10 saves with/without state.puzzles, strips puzzleArea, and rejects bad data",
    () => {
      const fresh = createState(world, fixtures["new-game"]!);
      expect(parseSave(serializeSave(fresh), fresh)).toEqual(fresh);

      const solved: State = {
        ...fresh,
        puzzles: { "cavern-prism": true, "woods-vine-harmony": true },
      };
      const restored = parseSave(serializeSave(solved), fresh);
      expect(restored).toEqual(solved);
      expect(stableHash(restored)).toBe(stableHash(solved));

      const withTransient: State = {
        ...solved,
        puzzleArea: { pulledLevers: ["gym-lever"] },
      };
      const cleaned = parseSave(serializeSave(withTransient), fresh);
      expect(cleaned?.puzzleArea).toBeUndefined();
      expect(cleaned?.puzzles).toEqual(solved.puzzles);

      // Reject malformed puzzles flags or non-object puzzleArea.
      for (const badPuzzles of [
        { "Bad_Key": true },
        { "cavern-prism": "yes" },
        ["cavern-prism"],
      ]) {
        const raw = JSON.stringify({ version: 10, state: { ...fresh, puzzles: badPuzzles } });
        expect(parseSave(raw, fresh)).toBeNull();
      }
      const badTransient = JSON.stringify({
        version: 10,
        state: { ...fresh, puzzleArea: ["broken"] },
      });
      expect(parseSave(badTransient, fresh)).toBeNull();
    });

  it("keeps all 7 signature puzzle areas clean on authoring checks and rejects invalid JSON",
    () => {
      expect(
        areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
      ).toEqual([]);
      for (const id of ["gym", "trail", "cavern", "woods", "pass", "island", "mist"]) {
        const area = areaFor(id);
        expect(area.puzzles, `${id}.puzzles`).toBeDefined();
        expect(propDrawingErrors(area), `${id} props`).toEqual([]);
        expect(propBlockerErrors(area), `${id} blockers`).toEqual([]);
        expect(hiddenPositions(area, world.tunables.playerRadius), `${id} hidden`).toEqual([]);
      }

      // Parser validation errors.
      expect(() => parseAreaPuzzles([], "test.json")).toThrow();
      expect(() =>
        parseAreaPuzzles(
          { pushables: [{ id: "a", kind: "banana", x: 1, y: 2 }] },
          "test.json",
        ),
      ).toThrow();
      expect(() =>
        parseAreaPuzzles(
          { grapples: [{ id: "s", kind: "swing", x: 1, y: 2 }] },
          "test.json",
        ),
      ).toThrow();
      expect(() =>
        parseAreaPuzzles(
          {
            plates: [
              { id: "dup", x: 1, y: 2 },
              { id: "dup", x: 3, y: 4 },
            ],
          },
          "test.json",
        ),
      ).toThrow();
      expect(() =>
        parseAreaPuzzles(
          { goals: [{ id: "empty" }] },
          "test.json",
        ),
      ).toThrow();
      expect(() =>
        parseAreaPuzzles(
          { goals: [{ id: "g", requirePlates: ["missing"] }] },
          "test.json",
        ),
      ).toThrow();
      expect(() =>
        parseAreaPuzzles(
          {
            bridges: [
              {
                id: "b",
                opensOn: "missing-goal",
                polygon: [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                ],
              },
            ],
          },
          "test.json",
        ),
      ).toThrow();
      expect(() =>
        parseAreaPuzzles(
          {
            steppingStones: [
              {
                id: "st",
                gapPolygon: [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                ],
                stones: [{ x: 5, y: 5 }],
                overridesCrossing: "unknown-crossing",
              },
            ],
          },
          "test.json",
          new Set(["real-crossing"]),
        ),
      ).toThrow();
    }, 60_000);
});

// Keep ink helper import tested explicitly for Ink->puzzle sync parity.
describe("Ink mirror & isPuzzleSolved parity", () => {
  it("recognizes Ink-solved goals via isPuzzleSolved without mutating state", () => {
    const start = makeState("cavern", "entrance");
    expect(isPuzzleSolved(world, start, "cavern-prism")).toBe(false);
    const viaInk: State = {
      ...start,
      ink: setInkVariables(start.ink, { cavern_bridge_lit: true }),
    };
    expect(isPuzzleSolved(world, viaInk, "cavern-prism")).toBe(true);
    expect(viaInk.puzzles).toBeUndefined();
  });
});
