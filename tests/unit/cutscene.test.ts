import { describe, expect, it } from "vitest";
import {
  autosaveNeeded,
  blankInput,
  createState,
  CUTSCENE_EFFECT_TICKS,
  CUTSCENE_LETTERBOX_TICKS,
  CUTSCENE_SKIP_HOLD_TICKS,
  cutsceneView,
  findTriggeredCutscene,
  isCutsceneSeen,
  pointInPolygon,
  sceneryArea,
  setInkVariables,
  soundCues,
  stableHash,
  startCutscene,
  startDialogue,
  step,
  type CutsceneEffectKind,
  type CutscenePose,
  type CutsceneScript,
  type CutsceneStep,
  type State,
  type World,
} from "../../src/core";
import { parseSave, serializeSave } from "../../src/core/save";
import { loadContent, parseCutscene, type CutsceneValidationContext } from "../../src/content/load";
import { cutsceneCameraPoint } from "../../src/render/camera";
import {
  computeCutsceneBurstParticles,
  computeCutscenePoseTransform,
  computeLetterboxHeight,
  CUTSCENE_LETTERBOX_MAX_PX,
} from "../../src/render/cutscene-render";
import { computeOverworldCameraFrame } from "../../src/render/view-projections";

const content = loadContent();

function requireFixture(name: string) {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`Missing fixture: ${name}`);
  return fixture;
}

function withSyntheticCutscene(script: CutsceneScript): World {
  return {
    ...content.world,
    cutscenes: { ...content.world.cutscenes, [script.id]: script },
  };
}

function advanceDialogueToClose(world: World, initial: State, chooseIndex = 0): State {
  let state = initial;
  for (let guard = 0; guard < 200 && state.dialogue !== null; guard += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) {
      state = step(world, state, { ...blankInput(), confirm: true }).state;
      state = step(world, state, blankInput()).state;
      continue;
    }
    if (dialogue.choices.length > 0 && dialogue.selected !== chooseIndex) {
      const dir = chooseIndex > dialogue.selected ? 1 : -1;
      state = step(world, state, { ...blankInput(), move: { x: 0, y: dir } }).state;
      state = step(world, state, blankInput()).state;
      continue;
    }
    state = step(world, state, { ...blankInput(), confirm: true }).state;
    if (state.dialogue !== null) {
      state = step(world, state, blankInput()).state;
    }
  }
  return state;
}

function assertActorsWithinBounds(world: World, state: State, context: string): void {
  const rawArea = world.areas[state.area];
  if (rawArea === undefined) throw new Error(`Unknown area: ${state.area}`);
  const area = sceneryArea(world, state.ink, rawArea);
  expect(
    pointInPolygon(state.player, area.walkable),
    `${context}: fae outside walkable at (${state.player.x}, ${state.player.y})`,
  ).toBe(true);
  for (const blocker of area.blockers) {
    expect(
      pointInPolygon(state.player, blocker),
      `${context}: fae inside blocker at (${state.player.x}, ${state.player.y})`,
    ).toBe(false);
  }
  for (const member of state.party) {
    expect(
      pointInPolygon(member, area.walkable),
      `${context}: ${member.id} outside walkable at (${member.x}, ${member.y})`,
    ).toBe(true);
    for (const blocker of area.blockers) {
      expect(
        pointInPolygon(member, blocker),
        `${context}: ${member.id} inside blocker at (${member.x}, ${member.y})`,
      ).toBe(false);
    }
  }
}

describe("cutscene step semantics", () => {
  it("moveActor interpolates linearly with Math.sqrt, updates facing and distance", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const startX = start.player.x;
    const startY = start.player.y;
    const maddie = start.party[0];
    if (maddie === undefined) throw new Error("expected Maddie in plaza fixture");
    const gus = content.world.areas.plaza?.npcs.find((npc) => npc.id === "gus");
    if (gus === undefined) throw new Error("expected gus NPC in plaza");

    const script: CutsceneScript = {
      id: "test-move-actors",
      area: "plaza",
      steps: [
        {
          type: "moveActor",
          actor: "fae",
          to: { x: startX + 30, y: startY + 40 },
          speed: 10,
          facing: "left",
        },
        {
          type: "moveActor",
          actor: "party:0",
          to: { x: maddie.x + 20, y: maddie.y },
          speed: 10,
        },
        {
          type: "moveActor",
          actor: "party:maddie",
          to: { x: maddie.x + 20, y: maddie.y + 15 },
          speed: 15,
          facing: "up",
        },
        {
          type: "moveActor",
          actor: "npc:gus",
          to: { x: gus.point.x - 16, y: gus.point.y },
          speed: 8,
        },
        {
          type: "spawnTempActor",
          id: "runner",
          sprite: "hooded-kid",
          at: { x: 800, y: 500 },
          facing: "down",
        },
        {
          type: "moveActor",
          actor: "temp:runner",
          to: { x: 800, y: 530 },
          speed: 15,
        },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    // 3-4-5 triangle: dist = 50, speed = 10 -> 5 ticks of (dx=6, dy=8).
    for (let t = 1; t <= 4; t += 1) {
      state = step(world, state, blankInput()).state;
      expect(state.player.x).toBeCloseTo(startX + 6 * t, 6);
      expect(state.player.y).toBeCloseTo(startY + 8 * t, 6);
      expect(state.facing).toBe("down");
      expect(state.motion.moving).toBe(true);
      expect(state.motion.distance).toBeCloseTo(10 * t, 6);
    }
    // Tick 5: arrives at destination and applies explicit facing override.
    state = step(world, state, blankInput()).state;
    expect(state.player).toEqual({ x: startX + 30, y: startY + 40 });
    expect(state.facing).toBe("left");
    expect(state.motion.distance).toBeCloseTo(50, 6);
    expect(state.cutscene?.stepIndex).toBe(1);

    // Step 1: party:0 moves +20 on x at speed 10 (2 ticks), auto-facing right.
    state = step(world, state, blankInput()).state;
    expect(state.party[0]?.x).toBeCloseTo(maddie.x + 10, 6);
    expect(state.party[0]?.facing).toBe("right");
    expect(state.party[0]?.motion.distance).toBeCloseTo(10, 6);
    state = step(world, state, blankInput()).state;
    expect(state.party[0]?.x).toBeCloseTo(maddie.x + 20, 6);
    expect(state.party[0]?.facing).toBe("right");
    expect(state.party[0]?.motion.distance).toBeCloseTo(20, 6);

    // Step 2: party:maddie moves +15 on y at speed 15 (1 tick), explicit facing up.
    state = step(world, state, blankInput()).state;
    expect(state.party[0]?.y).toBeCloseTo(maddie.y + 15, 6);
    expect(state.party[0]?.facing).toBe("up");
    expect(state.party[0]?.motion.distance).toBeCloseTo(35, 6);

    // Step 3: npc:gus moves -16 on x at speed 8 (2 ticks).
    state = step(world, state, blankInput()).state;
    const gusMid = state.cutscene?.actorOverrides["npc:gus"];
    expect(gusMid?.x).toBeCloseTo(gus.point.x - 8, 6);
    expect(gusMid?.facing).toBe("left");
    expect(gusMid?.distance).toBeCloseTo(8, 6);
    state = step(world, state, blankInput()).state;
    const gusEnd = state.cutscene?.actorOverrides["npc:gus"];
    expect(gusEnd?.x).toBeCloseTo(gus.point.x - 16, 6);
    expect(gusEnd?.distance).toBeCloseTo(16, 6);

    // Step 4: spawnTempActor, Step 5: moveActor temp:runner (+30 y at speed 15 -> 2 ticks).
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.tempActors).toHaveLength(1);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.tempActors[0]?.y).toBeCloseTo(515, 6);
    expect(state.cutscene?.tempActors[0]?.distance).toBeCloseTo(15, 6);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.tempActors[0]?.y).toBeCloseTo(530, 6);
    expect(state.cutscene?.tempActors[0]?.facing).toBe("down");
    expect(state.cutscene?.tempActors[0]?.distance).toBeCloseTo(30, 6);
  });

  it("face updates facing for fae, party, npc, and temp actors", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-face",
      area: "plaza",
      steps: [
        {
          type: "spawnTempActor",
          id: "visitor",
          sprite: "hooded-kid",
          at: { x: 860, y: 500 },
          facing: "down",
        },
        { type: "face", actor: "fae", direction: "up" },
        { type: "face", actor: "party:0", direction: "left" },
        { type: "face", actor: "npc:gus", direction: "right" },
        { type: "face", actor: "temp:visitor", direction: "up" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);
    for (let i = 0; i < 5; i += 1) {
      state = step(world, state, blankInput()).state;
    }
    expect(state.facing).toBe("up");
    expect(state.party[0]?.facing).toBe("left");
    expect(state.cutscene?.actorOverrides["npc:gus"]?.facing).toBe("right");
    expect(state.cutscene?.tempActors[0]?.facing).toBe("up");
  });

  it("pose supports persistent poses, timed poses, and effect bursts", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-pose",
      area: "plaza",
      steps: [
        { type: "pose", actor: "fae", pose: "cheer", effect: "sparkle-burst" },
        { type: "wait", ticks: 2 },
        { type: "pose", actor: "fae", pose: "idle" },
        { type: "pose", actor: "party:0", pose: "hop", ticks: 3, effect: "pinecone-burst" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    // Tick 1: persistent cheer pose + sparkle-burst effect.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides.fae?.pose).toBe("cheer");
    expect(state.cutscene?.effects).toHaveLength(1);
    expect(state.cutscene?.effects[0]?.kind).toBe("sparkle-burst");
    expect(state.cutscene?.effects[0]?.duration).toBe(CUTSCENE_EFFECT_TICKS);

    // Ticks 2-3: wait(2) keeps persistent pose active and increments poseTicks.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides.fae?.pose).toBe("cheer");
    expect(state.cutscene?.actorOverrides.fae?.poseTicks).toBe(1);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides.fae?.pose).toBe("cheer");

    // Tick 4: pose idle clears fae's pose override.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides.fae).toBeUndefined();

    // Ticks 5-7: timed pose hop(3) + pinecone-burst active on ticks 5-6, cleared on tick 7.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides["party:maddie"]?.pose).toBe("hop");
    expect(state.cutscene?.effects.some((e) => e.kind === "pinecone-burst")).toBe(true);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides["party:maddie"]?.pose).toBe("hop");
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.actorOverrides["party:maddie"]?.pose).toBeUndefined();
    expect(state.cutscene?.stepIndex).toBe(4);
  });

  it("emote stays active for its duration window and expires afterward", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-emote",
      area: "plaza",
      steps: [
        { type: "emote", actor: "fae", kind: "heart", ticks: 3 },
        { type: "wait", ticks: 2 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.emotes).toEqual([
      { actor: "fae", kind: "heart", elapsed: 0, duration: 3 },
    ]);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.emotes).toEqual([
      { actor: "fae", kind: "heart", elapsed: 1, duration: 3 },
    ]);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.emotes).toEqual([
      { actor: "fae", kind: "heart", elapsed: 2, duration: 3 },
    ]);
    expect(state.cutscene?.stepIndex).toBe(1);

    // Next tick expires the emote since elapsed reaches duration (3).
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.emotes).toEqual([]);
  });

  it("wait holds cutscene progression for exact tick count", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-wait",
      area: "plaza",
      steps: [
        { type: "wait", ticks: 4 },
        { type: "setFlag", flag: "after_wait", value: true, scope: "cutscene" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);
    for (let t = 1; t <= 3; t += 1) {
      state = step(world, state, blankInput()).state;
      expect(state.cutscene?.stepIndex).toBe(0);
      expect(state.cutscene?.flags.after_wait).toBeUndefined();
    }
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.stepIndex).toBe(1);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.flags.after_wait).toBe(true);
  });

  it("cameraPan supports fixed points, fae, moving temp actor, zoom, and ticks: 0", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-camera",
      area: "plaza",
      steps: [
        { type: "cameraPan", to: { x: 400, y: 300 }, ticks: 0, zoom: 1.2 },
        { type: "cameraPan", to: { x: 500, y: 400 }, ticks: 4, zoom: 1.0 },
        {
          type: "spawnTempActor",
          id: "scout",
          sprite: "hooded-kid",
          at: { x: 700, y: 450 },
        },
        {
          type: "parallel",
          steps: [
            { type: "moveActor", actor: "temp:scout", to: { x: 740, y: 450 }, speed: 10 },
            { type: "cameraPan", to: "actor:temp:scout", ticks: 4, zoom: 1.1 },
          ],
        },
        { type: "cameraPan", to: "fae", ticks: 2, zoom: 1 },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    // Step 0: ticks: 0 snaps immediately.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.camera).toEqual({ x: 400, y: 300, zoom: 1.2 });
    expect(state.cutscene?.stepIndex).toBe(1);

    // Step 1: linear pan + zoom interpolation over 4 ticks.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.camera?.x).toBeCloseTo(425, 6);
    expect(state.cutscene?.camera?.y).toBeCloseTo(325, 6);
    expect(state.cutscene?.camera?.zoom).toBeCloseTo(1.15, 6);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.camera?.x).toBeCloseTo(450, 6);
    expect(state.cutscene?.camera?.y).toBeCloseTo(350, 6);
    expect(state.cutscene?.camera?.zoom).toBeCloseTo(1.1, 6);
    state = step(world, state, blankInput()).state;
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.camera).toEqual({ x: 500, y: 400, zoom: 1 });

    // Step 2: spawn scout, Step 3: parallel move + cameraPan tracking actor:temp:scout.
    state = step(world, state, blankInput()).state;
    for (let i = 0; i < 4; i += 1) {
      state = step(world, state, blankInput()).state;
    }
    expect(state.cutscene?.camera?.x).toBeCloseTo(740, 6);
    expect(state.cutscene?.camera?.y).toBeCloseTo(450, 6);
    expect(state.cutscene?.camera?.zoom).toBeCloseTo(1.1, 6);

    // Step 4: cameraPan back to "fae".
    state = step(world, state, blankInput()).state;
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.camera?.x).toBeCloseTo(state.player.x, 6);
    expect(state.cutscene?.camera?.y).toBeCloseTo(state.player.y, 6);
    expect(state.cutscene?.camera?.zoom).toBeCloseTo(1, 6);
  });

  it("sfx emits cues via soundCues on exact tick including multiple cues in parallel", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-sfx",
      area: "plaza",
      steps: [
        { type: "sfx", cue: "chime-yellow" },
        {
          type: "parallel",
          steps: [
            { type: "sfx", cue: "lantern-on" },
            { type: "sfx", cue: "flute-blue" },
          ],
        },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let prev = startCutscene(world, start, script.id);

    let next = step(world, prev, blankInput()).state;
    expect(soundCues(prev, next, world)).toEqual(["chime-yellow"]);

    prev = next;
    next = step(world, prev, blankInput()).state;
    expect(soundCues(prev, next, world)).toEqual(["lantern-on", "flute-blue"]);

    prev = next;
    next = step(world, prev, blankInput()).state;
    expect(soundCues(prev, next, world)).toEqual([]);
  });

  it("sayKnot pauses cleanly, plays real Ink knot, and resumes on exact close tick", () => {
    const start = createState(content.world, requireFixture("new-game"), 1);
    const script: CutsceneScript = {
      id: "test-say-top",
      area: "bedroom",
      steps: [
        { type: "sayKnot", knot: "window" },
        { type: "setFlag", flag: "resumed_top", value: true, scope: "cutscene" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    // Tick 1 opens "window" and sets dialogueWaiting.
    state = step(world, state, blankInput()).state;
    expect(state.dialogue?.knot).toBe("window");
    expect(state.cutscene?.dialogueWaiting).toBe(true);
    expect(state.cutscene?.stepIndex).toBe(0);

    // Advance dialogue with real ActionFrame inputs and pick choice index 1 ("later").
    state = advanceDialogueToClose(world, state, 1);

    // On the exact tick dialogue closes, cutscene has resumed to stepIndex 1!
    expect(state.dialogue).toBeNull();
    expect(world.storyVariable(state.ink, "plan")).toBe("later");
    expect(state.cutscene?.dialogueWaiting).toBe(false);
    expect(state.cutscene?.stepIndex).toBe(1);

    // Next tick executes the post-dialogue step immediately.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.flags.resumed_top).toBe(true);
  });

  it("sayKnot inside parallel pauses and resumes sibling steps cleanly", () => {
    const start = createState(content.world, requireFixture("bay"), 1);
    const script: CutsceneScript = {
      id: "test-say-parallel",
      area: "bay",
      steps: [
        {
          type: "parallel",
          steps: [
            { type: "face", actor: "fae", direction: "right" },
            { type: "sayKnot", knot: "sue" },
            { type: "wait", ticks: 2 },
          ],
        },
        { type: "setFlag", flag: "after_parallel_say", value: true, scope: "cutscene" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    // Tick 1: face runs, sayKnot opens "sue" and breaks parallel loop.
    state = step(world, state, blankInput()).state;
    expect(state.facing).toBe("right");
    expect(state.dialogue?.knot).toBe("sue");
    expect(state.cutscene?.dialogueWaiting).toBe(true);
    expect(state.cutscene?.stepIndex).toBe(0);

    // Complete Sue's conversation; sibling wait(2) still remains inside parallel.
    state = advanceDialogueToClose(world, state, 0);
    expect(state.dialogue).toBeNull();
    expect(world.storyVariable(state.ink, "sue_joined")).toBe(true);
    expect(state.party.some((m) => m.id === "sue")).toBe(true);
    expect(state.cutscene?.dialogueWaiting).toBe(false);
    expect(state.cutscene?.stepIndex).toBe(0);

    // Remaining 2 ticks finish wait(2), then stepIndex advances to 1.
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.stepIndex).toBe(0);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.stepIndex).toBe(1);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.flags.after_parallel_say).toBe(true);
  });

  it("parallel and nested parallel advance in lockstep until all children finish", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-nested-parallel",
      area: "plaza",
      steps: [
        {
          type: "parallel",
          steps: [
            { type: "wait", ticks: 2 },
            {
              type: "parallel",
              steps: [
                { type: "wait", ticks: 1 },
                { type: "wait", ticks: 4 },
              ],
            },
          ],
        },
        { type: "setFlag", flag: "nested_done", value: true, scope: "cutscene" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    for (let t = 1; t <= 3; t += 1) {
      state = step(world, state, blankInput()).state;
      expect(state.cutscene?.stepIndex).toBe(0);
    }
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.stepIndex).toBe(1);
    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.flags.nested_done).toBe(true);
  });

  it("setFlag handles both cutscene scope and ink scope", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    expect(content.world.storyVariable(start.ink, "read_notice")).toBe(false);
    const script: CutsceneScript = {
      id: "test-flags",
      area: "plaza",
      steps: [
        { type: "setFlag", flag: "local_only", value: true, scope: "cutscene" },
        { type: "setFlag", flag: "read_notice", value: true, scope: "ink" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);
    const initialInk = state.ink;

    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.flags.local_only).toBe(true);
    expect(state.ink).toBe(initialInk);

    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.flags.read_notice).toBe(true);
    expect(world.storyVariable(state.ink, "read_notice")).toBe(true);
  });

  it("spawnTempActor, despawnTempActor, and propState update cutscene state accurately", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    const script: CutsceneScript = {
      id: "test-temp-prop",
      area: "plaza",
      steps: [
        {
          type: "spawnTempActor",
          id: "hooded-kid",
          sprite: "hooded-kid",
          at: { x: 640, y: 420 },
          facing: "right",
          scale: 0.48,
          effect: "purple-fizz",
        },
        { type: "propState", propId: "fountain", state: "calm" },
        { type: "despawnTempActor", id: "hooded-kid", effect: "purple-puff" },
        { type: "wait", ticks: 1 },
      ],
    };
    const world = withSyntheticCutscene(script);
    let state = startCutscene(world, start, script.id);

    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.tempActors).toEqual([
      {
        id: "hooded-kid",
        sprite: "hooded-kid",
        x: 640,
        y: 420,
        facing: "right",
        scale: 0.48,
        moving: false,
        distance: 0,
      },
    ]);
    expect(state.cutscene?.effects[0]?.kind).toBe("purple-fizz");

    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.propOverrides.fountain).toBe("calm");

    state = step(world, state, blankInput()).state;
    expect(state.cutscene?.tempActors).toEqual([]);
    expect(state.cutscene?.effects.some((e) => e.kind === "purple-puff")).toBe(true);
  });
});

describe("cutscene determinism and hold-cancel skip", () => {
  it("produces identical per-tick stableHash across two identical runs", () => {
    const runPass = (): string[] => {
      let state = startCutscene(
        content.world,
        createState(content.world, requireFixture("plaza"), 1),
        "plaza-hood-sighting",
      );
      const hashes: string[] = [stableHash(state)];
      for (let i = 0; i < 600 && state.cutscene !== undefined; i += 1) {
        state = step(content.world, state, blankInput()).state;
        hashes.push(stableHash(state));
      }
      expect(state.cutscene).toBeUndefined();
      return hashes;
    };

    const first = runPass();
    const second = runPass();
    expect(first.length).toBeGreaterThan(50);
    expect(second).toEqual(first);
  });

  it("resets cancelHoldTicks when cancel is released after 29 ticks", () => {
    let state = startCutscene(
      content.world,
      createState(content.world, requireFixture("plaza"), 1),
      "plaza-hood-sighting",
    );
    const holdCancel = { ...blankInput(), cancel: true };
    for (let i = 0; i < CUTSCENE_SKIP_HOLD_TICKS - 1; i += 1) {
      state = step(content.world, state, holdCancel).state;
    }
    expect(state.cutscene).toBeDefined();
    expect(state.cutscene?.cancelHoldTicks).toBe(CUTSCENE_SKIP_HOLD_TICKS - 1);

    state = step(content.world, state, blankInput()).state;
    expect(state.cutscene).toBeDefined();
    expect(state.cutscene?.cancelHoldTicks).toBe(0);
    expect(isCutsceneSeen(state, "plaza-hood-sighting")).toBe(false);
  });

  it("fast-forwards plaza-hood-sighting and final Ink flags on 30-tick cancel hold", () => {
    let state = startCutscene(
      content.world,
      createState(content.world, requireFixture("plaza"), 1),
      "plaza-hood-sighting",
    );
    const holdCancel = { ...blankInput(), cancel: true };
    for (let i = 0; i < CUTSCENE_SKIP_HOLD_TICKS; i += 1) {
      state = step(content.world, state, holdCancel).state;
    }
    expect(state.cutscene).toBeUndefined();
    expect(isCutsceneSeen(state, "plaza-hood-sighting")).toBe(true);

    // Also verify fast-forward commits final Ink flags on a script with scope: "ink".
    const inkScript: CutsceneScript = {
      id: "test-skip-ink-flag",
      area: "plaza",
      steps: [
        { type: "wait", ticks: 60 },
        { type: "setFlag", flag: "read_notice", value: true, scope: "ink" },
      ],
    };
    const world = withSyntheticCutscene(inkScript);
    const inkStart = createState(world, requireFixture("plaza"), 1);
    let inkState = startCutscene(world, inkStart, inkScript.id);
    for (let i = 0; i < CUTSCENE_SKIP_HOLD_TICKS; i += 1) {
      inkState = step(world, inkState, holdCancel).state;
    }
    expect(inkState.cutscene).toBeUndefined();
    expect(isCutsceneSeen(inkState, inkScript.id)).toBe(true);
    expect(world.storyVariable(inkState.ink, "read_notice")).toBe(true);
  });

  it("fast-forwards sue-bay-intro to Sue's dialogue without skipping recruitment", () => {
    let state = startCutscene(
      content.world,
      createState(content.world, requireFixture("bay"), 1),
      "sue-bay-intro",
    );
    const holdCancel = { ...blankInput(), cancel: true };
    for (let i = 0; i < CUTSCENE_SKIP_HOLD_TICKS; i += 1) {
      state = step(content.world, state, holdCancel).state;
    }

    // Fast-forward moved Fae & Sue into position and opened Sue's Ink knot.
    expect(state.cutscene?.id).toBe("sue-bay-intro");
    expect(state.cutscene?.dialogueWaiting).toBe(true);
    expect(state.dialogue?.knot).toBe("sue");
    expect(state.player).toEqual({ x: 295, y: 545 });
    expect(state.cutscene?.actorOverrides["npc:sue"]?.x).toBe(390);
    expect(state.cutscene?.actorOverrides["npc:sue"]?.y).toBe(545);
    expect(state.cutscene?.cancelHoldTicks).toBe(0);

    // Finishing Sue's conversation still recruits Sue into state.party.
    state = advanceDialogueToClose(content.world, state, 0);
    expect(state.dialogue).toBeNull();
    expect(state.party.some((member) => member.id === "sue")).toBe(true);

    for (let i = 0; i < 200 && state.cutscene !== undefined; i += 1) {
      state = step(content.world, state, blankInput()).state;
    }
    expect(state.cutscene).toBeUndefined();
    expect(isCutsceneSeen(state, "sue-bay-intro")).toBe(true);
  });
});

describe("opt-in cutscene triggers", () => {
  it("triggers dawn-wakeup on bedroom tick 0->1 only when options.cutscenes is true", () => {
    const start = createState(content.world, requireFixture("new-game"), 1);

    const withoutOptIn = step(content.world, start, blankInput()).state;
    expect(withoutOptIn.cutscene).toBeUndefined();

    const withOptIn = step(content.world, start, blankInput(), { cutscenes: true }).state;
    expect(withOptIn.cutscene?.id).toBe("dawn-wakeup");

    // Once seen, never triggers again even on a fresh tick 0->1 transition.
    const seenPrev: State = { ...start, cutscenesSeen: ["dawn-wakeup"] };
    const seenNext: State = { ...seenPrev, tick: 1 };
    expect(findTriggeredCutscene(content.world, seenPrev, seenNext)).toBeUndefined();
  });

  it("triggers plaza-hood-sighting when notice_board closes with read_notice === true", () => {
    const start = createState(content.world, requireFixture("plaza"), 1);
    let state = startDialogue(content.world, start, "notice_board");
    expect(state.dialogue?.knot).toBe("notice_board");

    // Step through notice_board with cutscenes enabled.
    for (let guard = 0; guard < 120 && state.dialogue !== null; guard += 1) {
      state = step(content.world, state, { ...blankInput(), confirm: true }, { cutscenes: true })
        .state;
      if (state.dialogue !== null) {
        state = step(content.world, state, blankInput(), { cutscenes: true }).state;
      }
    }
    expect(state.dialogue).toBeNull();
    expect(content.world.storyVariable(state.ink, "read_notice")).toBe(true);
    expect(state.cutscene?.id).toBe("plaza-hood-sighting");
  });

  it("respects forbidsVariable on sue-bay-intro and jordan-pass-intro", () => {
    const bayStart = createState(content.world, requireFixture("bay"), 1);
    const bayNext: State = { ...bayStart, tick: 1 };
    expect(findTriggeredCutscene(content.world, bayStart, bayNext)?.id).toBe("sue-bay-intro");

    const bayJoined: State = {
      ...bayNext,
      ink: setInkVariables(bayNext.ink, { sue_joined: true }),
    };
    expect(findTriggeredCutscene(content.world, bayStart, bayJoined)).toBeUndefined();

    const passStart = createState(content.world, requireFixture("pass"), 1);
    const passNext: State = { ...passStart, tick: 1 };
    expect(findTriggeredCutscene(content.world, passStart, passNext)?.id).toBe("jordan-pass-intro");

    const passJoined: State = {
      ...passNext,
      ink: setInkVariables(passNext.ink, { jordan_joined: true }),
    };
    expect(findTriggeredCutscene(content.world, passStart, passJoined)).toBeUndefined();
  });
});

describe("all 4 authored cutscenes start-to-finish", () => {
  it("runs dawn-wakeup cleanly keeping Fae and party inside walkable bounds", () => {
    let state = startCutscene(
      content.world,
      createState(content.world, requireFixture("new-game"), 1),
      "dawn-wakeup",
    );
    let ticks = 0;
    while (state.cutscene !== undefined && ticks < 600) {
      state = step(content.world, state, blankInput()).state;
      ticks += 1;
      assertActorsWithinBounds(content.world, state, `dawn-wakeup tick ${ticks}`);
    }
    expect(state.cutscene).toBeUndefined();
    expect(isCutsceneSeen(state, "dawn-wakeup")).toBe(true);
  });

  it("runs plaza-hood-sighting with hooded-kid, purple VFX, SFX, and valid bounds", () => {
    let prev = startCutscene(
      content.world,
      createState(content.world, requireFixture("plaza"), 1),
      "plaza-hood-sighting",
    );
    let spawned = false;
    let despawned = false;
    let sawPurpleFizz = false;
    let sawPurplePuff = false;
    const cues = new Set<string>();

    let ticks = 0;
    while (prev.cutscene !== undefined && ticks < 800) {
      const next = step(content.world, prev, blankInput()).state;
      ticks += 1;
      assertActorsWithinBounds(content.world, next, `plaza-hood-sighting tick ${ticks}`);
      for (const cue of soundCues(prev, next, content.world)) cues.add(cue);
      const cs = next.cutscene;
      if (cs !== undefined) {
        if (cs.tempActors.some((actor) => actor.id === "hooded-kid")) spawned = true;
        else if (spawned) despawned = true;
        if (cs.effects.some((effect) => effect.kind === "purple-fizz")) sawPurpleFizz = true;
        if (cs.effects.some((effect) => effect.kind === "purple-puff")) sawPurplePuff = true;
      }
      prev = next;
    }

    expect(prev.cutscene).toBeUndefined();
    expect(isCutsceneSeen(prev, "plaza-hood-sighting")).toBe(true);
    expect(spawned).toBe(true);
    expect(despawned).toBe(true);
    expect(sawPurpleFizz).toBe(true);
    expect(sawPurplePuff).toBe(true);
    expect(cues.has("lantern-on")).toBe(true);
    expect(cues.has("flute-blue")).toBe(true);
    expect(cues.has("lantern-off")).toBe(true);
  });

  it("runs sue-bay-intro start-to-finish, keeps actors in bounds, and recruits sue", () => {
    let state = startCutscene(
      content.world,
      createState(content.world, requireFixture("bay"), 1),
      "sue-bay-intro",
    );
    let openedSue = false;
    let ticks = 0;
    while (state.cutscene !== undefined && ticks < 1000) {
      if (state.dialogue !== null) {
        if (state.dialogue.knot === "sue") openedSue = true;
        state = advanceDialogueToClose(content.world, state, 0);
        assertActorsWithinBounds(content.world, state, `sue-bay-intro after dialogue ${ticks}`);
        continue;
      }
      state = step(content.world, state, blankInput()).state;
      ticks += 1;
      assertActorsWithinBounds(content.world, state, `sue-bay-intro tick ${ticks}`);
    }
    expect(openedSue).toBe(true);
    expect(state.cutscene).toBeUndefined();
    expect(isCutsceneSeen(state, "sue-bay-intro")).toBe(true);
    expect(state.party.some((member) => member.id === "sue")).toBe(true);
  });

  it("runs jordan-pass-intro start-to-finish, keeps actors in bounds, and recruits jordan", () => {
    let state = startCutscene(
      content.world,
      createState(content.world, requireFixture("pass"), 1),
      "jordan-pass-intro",
    );
    let openedJordan = false;
    let ticks = 0;
    while (state.cutscene !== undefined && ticks < 1000) {
      if (state.dialogue !== null) {
        if (state.dialogue.knot === "jordan") openedJordan = true;
        state = advanceDialogueToClose(content.world, state, 0);
        assertActorsWithinBounds(content.world, state, `jordan-pass-intro after dialogue ${ticks}`);
        continue;
      }
      state = step(content.world, state, blankInput()).state;
      ticks += 1;
      assertActorsWithinBounds(content.world, state, `jordan-pass-intro tick ${ticks}`);
    }
    expect(openedJordan).toBe(true);
    expect(state.cutscene).toBeUndefined();
    expect(isCutsceneSeen(state, "jordan-pass-intro")).toBe(true);
    expect(state.party.some((member) => member.id === "jordan")).toBe(true);
  });
});

describe("cutscene save-safety and autosaveNeeded", () => {
  const fresh = createState(content.world, requireFixture("new-game"), 1);

  it("omits cutscene and cutscenesSeen on fresh createState", () => {
    expect("cutscene" in fresh).toBe(false);
    expect("cutscenesSeen" in fresh).toBe(false);
  });

  it("rejects mid-cutscene saves and round-trips post-cutscene v10 saves", () => {
    const mid = startCutscene(content.world, fresh, "dawn-wakeup");
    expect(mid.cutscene).toBeDefined();
    expect(parseSave(serializeSave(mid), fresh)).toBeNull();

    let done = mid;
    for (let i = 0; i < 600 && done.cutscene !== undefined; i += 1) {
      done = step(content.world, done, blankInput()).state;
    }
    expect(done.cutscene).toBeUndefined();
    expect(done.cutscenesSeen).toEqual(["dawn-wakeup"]);

    const serialized = serializeSave(done);
    const parsedJson: unknown = JSON.parse(serialized);
    expect(
      typeof parsedJson === "object" &&
        parsedJson !== null &&
        "version" in parsedJson &&
        parsedJson.version === 10,
    ).toBe(true);

    const restored = parseSave(serialized, fresh);
    expect(restored).not.toBeNull();
    expect(restored?.cutscenesSeen).toEqual(["dawn-wakeup"]);
    expect(stableHash(restored)).toBe(stableHash(done));
  });

  it("rejects invalid cutscenesSeen values in parseSave", () => {
    const invalidValues: unknown[] = [[123], ["BAD_ID"], "string"];
    for (const bad of invalidValues) {
      const payload = JSON.stringify({
        version: 10,
        state: { ...fresh, cutscenesSeen: bad },
      });
      expect(parseSave(payload, fresh)).toBeNull();
    }
  });

  it("suppresses autosaveNeeded during a cutscene and fires it on the completion tick", () => {
    let prev = startCutscene(content.world, fresh, "dawn-wakeup");
    let sawMidTick = false;
    let sawCompletionAutosave = false;
    for (let i = 0; i < 600 && prev.cutscene !== undefined; i += 1) {
      const next = step(content.world, prev, blankInput()).state;
      if (next.cutscene !== undefined) {
        sawMidTick = true;
        expect(autosaveNeeded(prev, next)).toBe(false);
      } else {
        expect(autosaveNeeded(prev, next)).toBe(true);
        sawCompletionAutosave = true;
      }
      prev = next;
    }
    expect(sawMidTick).toBe(true);
    expect(sawCompletionAutosave).toBe(true);
  });
});

describe("parseCutscene content validation", () => {
  const fresh = createState(content.world, requireFixture("new-game"), 1);
  const ctx: CutsceneValidationContext = {
    areas: content.world.areas,
    characters: content.world.characters,
    party: content.world.party,
    story: content.world.story,
    storyVariable: (name) => content.world.storyVariable(fresh.ink, name),
  };

  function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "sample-scene",
      area: "plaza",
      steps: [{ type: "wait", ticks: 5 }],
      ...overrides,
    };
  }

  it("accepts a valid cutscene payload", () => {
    const parsed = parseCutscene(validRaw(), "content/cutscenes/sample-scene.json", ctx);
    expect(parsed.id).toBe("sample-scene");
    expect(parsed.area).toBe("plaza");
    expect(parsed.steps).toEqual([{ type: "wait", ticks: 5 }]);
  });

  it("rejects invalid ID, filename mismatch, and unknown area", () => {
    expect(() =>
      parseCutscene(validRaw({ id: "Bad_ID" }), "content/cutscenes/Bad_ID.json", ctx),
    ).toThrow();
    expect(() =>
      parseCutscene(validRaw({ id: "other-id" }), "content/cutscenes/sample-scene.json", ctx),
    ).toThrow();
    expect(() =>
      parseCutscene(validRaw({ area: "no-such-area" }), "content/cutscenes/sample-scene.json", ctx),
    ).toThrow();
  });

  it("rejects unknown Ink knot, invalid SFX cue, and unknown temp sprite", () => {
    expect(() =>
      parseCutscene(
        validRaw({ steps: [{ type: "sayKnot", knot: "missing_knot_xyz" }] }),
        "content/cutscenes/sample-scene.json",
        ctx,
      ),
    ).toThrow();
    expect(() =>
      parseCutscene(
        validRaw({
          trigger: { kind: "after-knot", area: "plaza", knot: "missing_knot_xyz" },
        }),
        "content/cutscenes/sample-scene.json",
        ctx,
      ),
    ).toThrow();
    expect(() =>
      parseCutscene(
        validRaw({ steps: [{ type: "sfx", cue: "not-a-real-cue" }] }),
        "content/cutscenes/sample-scene.json",
        ctx,
      ),
    ).toThrow();
    expect(() =>
      parseCutscene(
        validRaw({
          steps: [
            {
              type: "spawnTempActor",
              id: "ghost",
              sprite: "unknown-sprite-id",
              at: { x: 500, y: 500 },
            },
          ],
        }),
        "content/cutscenes/sample-scene.json",
        ctx,
      ),
    ).toThrow();
  });

  it("rejects non-positive speed, negative ticks, and undeclared ink flags", () => {
    const badSteps: CutsceneStep[] | unknown[] = [
      { type: "moveActor", actor: "fae", to: { x: 500, y: 500 }, speed: 0 },
      { type: "moveActor", actor: "fae", to: { x: 500, y: 500 }, speed: -3 },
      { type: "wait", ticks: -1 },
      { type: "emote", actor: "fae", kind: "heart", ticks: -2 },
      { type: "cameraPan", to: "fae", ticks: -1 },
      { type: "pose", actor: "fae", pose: "hop", ticks: -1 },
      { type: "setFlag", flag: "undeclared_ink_flag_xyz", value: true, scope: "ink" },
    ];
    for (const badStep of badSteps) {
      expect(() =>
        parseCutscene(
          validRaw({ steps: [badStep] }),
          "content/cutscenes/sample-scene.json",
          ctx,
        ),
      ).toThrow();
    }
  });
});

describe("cutscene renderer pure math", () => {
  it("computeLetterboxHeight ramps smoothly to 24px and snaps under Reduced Motion", () => {
    expect(computeLetterboxHeight(null, 720, false)).toBe(0);

    const start = startCutscene(
      content.world,
      createState(content.world, requireFixture("new-game"), 1),
      "dawn-wakeup",
    );
    const atTick0 = cutsceneView(start);
    expect(computeLetterboxHeight(atTick0, 720, false)).toBe(0);
    expect(computeLetterboxHeight(atTick0, 720, true)).toBe(CUTSCENE_LETTERBOX_MAX_PX);

    let state = start;
    let prevHeight = 0;
    for (let t = 1; t <= CUTSCENE_LETTERBOX_TICKS; t += 1) {
      state = step(content.world, state, blankInput()).state;
      const height = computeLetterboxHeight(cutsceneView(state), 720, false);
      expect(height).toBeGreaterThanOrEqual(prevHeight);
      expect(height).toBeLessThanOrEqual(CUTSCENE_LETTERBOX_MAX_PX);
      prevHeight = height;
    }
    expect(prevHeight).toBe(CUTSCENE_LETTERBOX_MAX_PX);
    // Small viewport respects 12px minimum floor.
    expect(computeLetterboxHeight(cutsceneView(state), 100, false)).toBe(12);
  });

  it("computeCutscenePoseTransform handles all 8 poses in normal and Reduced Motion", () => {
    const poses: readonly CutscenePose[] = [
      "idle",
      "hop",
      "cheer",
      "shock",
      "toss",
      "taunt",
      "wave",
      "sit",
    ];
    for (const pose of poses) {
      for (const reducedMotion of [false, true]) {
        const transform = computeCutscenePoseTransform(pose, 5, reducedMotion);
        expect(Number.isFinite(transform.offsetX)).toBe(true);
        expect(Number.isFinite(transform.offsetY)).toBe(true);
        expect(Number.isFinite(transform.scaleX)).toBe(true);
        expect(Number.isFinite(transform.scaleY)).toBe(true);
        expect(Number.isFinite(transform.rotation)).toBe(true);
        expect(transform.scaleX).toBeGreaterThan(0);
        expect(transform.scaleY).toBeGreaterThan(0);
      }
    }
    expect(computeCutscenePoseTransform("idle", 10, false)).toEqual({
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
    expect(computeCutscenePoseTransform("hop", 5, false).offsetY).toBeLessThan(-4);
    expect(computeCutscenePoseTransform("hop", 5, true).offsetY).toBe(-2);
  });

  it("computeCutsceneBurstParticles emits finite particles for all 4 kinds and empties", () => {
    const kinds: readonly CutsceneEffectKind[] = [
      "purple-fizz",
      "purple-puff",
      "sparkle-burst",
      "pinecone-burst",
    ];
    for (const kind of kinds) {
      for (const reducedMotion of [false, true]) {
        const particles = computeCutsceneBurstParticles(
          { kind, x: 500, y: 400, elapsed: 6, duration: CUTSCENE_EFFECT_TICKS },
          reducedMotion,
        );
        expect(particles.length).toBeGreaterThan(0);
        for (const p of particles) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(Number.isFinite(p.scale)).toBe(true);
          expect(Number.isFinite(p.alpha)).toBe(true);
          expect(Number.isFinite(p.rotation)).toBe(true);
          expect(p.alpha).toBeGreaterThan(0);
        }
        const expired = computeCutsceneBurstParticles(
          {
            kind,
            x: 500,
            y: 400,
            elapsed: CUTSCENE_EFFECT_TICKS,
            duration: CUTSCENE_EFFECT_TICKS,
          },
          reducedMotion,
        );
        expect(expired).toEqual([]);
      }
    }
  });

  it("cutsceneCameraPoint clamps inside large areas and centers small areas", () => {
    const view = { width: 1280, height: 720 };
    const large = { width: 2400, height: 1400 };
    expect(cutsceneCameraPoint({ x: 50, y: 50 }, view, large)).toEqual({ x: 0, y: 0 });
    expect(cutsceneCameraPoint({ x: 2350, y: 1380 }, view, large)).toEqual({
      x: 2400 - 1280,
      y: 1400 - 720,
    });
    expect(cutsceneCameraPoint({ x: 1000, y: 700 }, view, large)).toEqual({
      x: 1000 - 640,
      y: 700 - 360,
    });

    const small = { width: 1000, height: 600 };
    expect(cutsceneCameraPoint({ x: 900, y: 500 }, view, small)).toEqual({
      x: (1000 - 1280) / 2,
      y: (600 - 720) / 2,
    });
  });

  it("computeOverworldCameraFrame tracks cutscene camera and locks zoom in Reduced Motion", () => {
    const plaza = content.world.areas.plaza;
    if (plaza === undefined) throw new Error("missing plaza area");
    const base = startCutscene(
      content.world,
      createState(content.world, requireFixture("plaza"), 1),
      "plaza-hood-sighting",
    );
    if (base.cutscene === undefined) throw new Error("cutscene did not start");

    const prevState: State = {
      ...base,
      cutscene: { ...base.cutscene, camera: { x: 800, y: 500, zoom: 1.0 } },
    };
    const currState: State = {
      ...base,
      tick: base.tick + 1,
      cutscene: { ...base.cutscene, camera: { x: 1000, y: 600, zoom: 1.2 } },
    };

    const normal = computeOverworldCameraFrame({
      area: plaza,
      state: currState,
      previousState: prevState,
      previousCamera: { x: 0, y: 0 },
      width: 1280,
      height: 720,
      viewWidth: 1280,
      viewHeight: 720,
      resolution: 1,
      doorFadeTicks: 15,
      paused: false,
      reducedMotion: false,
      alpha: 0.5,
    });
    const expectedMid = cutsceneCameraPoint(
      { x: 900, y: 550 },
      { width: 1280, height: 720 },
      plaza,
    );
    expect(normal.camera.x).toBeCloseTo(expectedMid.x, 6);
    expect(normal.camera.y).toBeCloseTo(expectedMid.y, 6);
    expect(normal.zoomScale).toBeCloseTo(1.1, 6);

    const reduced = computeOverworldCameraFrame({
      area: plaza,
      state: currState,
      previousState: prevState,
      previousCamera: { x: 0, y: 0 },
      width: 1280,
      height: 720,
      viewWidth: 1280,
      viewHeight: 720,
      resolution: 1,
      doorFadeTicks: 15,
      paused: false,
      reducedMotion: true,
      alpha: 0.5,
    });
    expect(reduced.zoomScale).toBe(1);
    expect(reduced.camera.x).toBeCloseTo(expectedMid.x, 6);
    expect(reduced.camera.y).toBeCloseTo(expectedMid.y, 6);
  });
});
