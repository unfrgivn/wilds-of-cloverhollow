import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createInkState,
  createState,
  runInk,
  type Battle,
  type BattlePhase,
  type Direction,
  type PartyAttention,
  type PartyMember,
  type State,
} from "../../src/core";
import {
  CHARACTER_POSE_ATLASES,
  extractDialogueTags,
  extractInkOutputTags,
  extractStoryKnotLineTags,
  parsePoseTags,
  selectBattleActorPose,
  selectFaeOverworldPose,
  selectPartyOverworldPose,
} from "../../src/render/animation";
import {
  MADDIE_GROOM_START,
  MADDIE_IDLE_CYCLE_TICKS,
  MADDIE_NAP_START,
  MADDIE_STRETCH_START,
  maddieIdlePhase,
  type RestSpot,
} from "../../src/render/companions";
import {
  isHorizontalFacing,
  NEUTRAL_POSE,
  PAPER_FLIP_TICKS,
  paperFlipPose,
  stepPaperFlip,
} from "../../src/render/motion";
import {
  computeFaePose,
  computePartyFollowerTransform,
} from "../../src/render/overworld-render";

const { world, fixtures } = loadContent();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makePlazaState(overrides?: Partial<State>): State {
  const fixture = fixtures["new-game"];
  const plaza = world.areas.plaza;
  if (fixture === undefined || plaza === undefined) throw new Error("Missing plaza fixture");
  const spawn = Object.keys(plaza.spawns)[0];
  if (spawn === undefined) throw new Error("Missing plaza spawn");
  return { ...createState(world, { ...fixture, area: "plaza", spawn }), ...overrides };
}

function makeMember(id: string, overrides?: Partial<PartyMember>): PartyMember {
  return {
    id,
    xp: 0,
    x: 500,
    y: 500,
    facing: "left",
    motion: { distance: 0, moving: false },
    stillTicks: 0,
    trail: [],
    ...overrides,
  };
}

function makeBattle(phase: BattlePhase): Battle {
  return {
    critterId: "silly-slime",
    den: null,
    entry: { x: 500, y: 500 },
    phase,
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 3,
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
  };
}

function faePose(
  state: State,
  opts?: {
    facing?: Direction;
    activeRest?: boolean;
    activePet?: boolean;
    activeToolEventId?: string | null;
    dialogueTags?: readonly string[];
  },
) {
  return selectFaeOverworldPose({
    world,
    state,
    facing: opts?.facing ?? "left",
    walkFrameCount: 6,
    walkCycleUnits: 120,
    activeRest: opts?.activeRest ?? false,
    activePet: opts?.activePet ?? false,
    ...(opts?.activeToolEventId !== undefined ? { activeToolEventId: opts.activeToolEventId } : {}),
    ...(opts?.dialogueTags !== undefined ? { dialogueTags: opts.dialogueTags } : {}),
  });
}

function partyPose(
  state: State,
  member: PartyMember,
  opts?: {
    facing?: Direction;
    activeRest?: boolean;
    beingPetted?: boolean;
    partyAttention?: PartyAttention | null;
    dialogueTags?: readonly string[];
  },
) {
  return selectPartyOverworldPose({
    world,
    state,
    member,
    facing: opts?.facing ?? "left",
    activeRest: opts?.activeRest ?? false,
    beingPetted: opts?.beingPetted ?? false,
    ...(opts?.partyAttention !== undefined ? { partyAttention: opts.partyAttention } : {}),
    ...(opts?.dialogueTags !== undefined ? { dialogueTags: opts.dialogueTags } : {}),
  });
}

function compileInkStory(source: string): Record<string, unknown> {
  const compiler = new Compiler(source);
  compiler.Compile();
  const errors = compiler.errors ?? [];
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const runtime = compiler.runtimeStory;
  if (runtime === null) throw new Error("Ink compiler produced no story");
  const json = runtime.ToJson();
  if (typeof json !== "string") throw new Error("Ink story failed to serialize");
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) throw new Error("Compiled Ink story was not an object");
  return parsed;
}

describe("E2: maddieIdlePhase", () => {
  it("stays alert below 120 ticks and handles non-finite/negative edge cases", () => {
    expect(MADDIE_STRETCH_START).toBe(120);
    expect(MADDIE_GROOM_START).toBe(180);
    expect(MADDIE_NAP_START).toBe(240);
    expect(MADDIE_IDLE_CYCLE_TICKS).toBe(420);

    for (const ticks of [NaN, Infinity, -Infinity, -120, -1, 0, 1, 60, 119, 119.9]) {
      expect(maddieIdlePhase(ticks)).toBe("alert");
    }
  });

  it("progresses through stretch -> groom -> nap and repeats every 420 ticks", () => {
    expect(maddieIdlePhase(120)).toBe("stretch");
    expect(maddieIdlePhase(150.7)).toBe("stretch");
    expect(maddieIdlePhase(179)).toBe("stretch");

    expect(maddieIdlePhase(180)).toBe("groom");
    expect(maddieIdlePhase(210)).toBe("groom");
    expect(maddieIdlePhase(239)).toBe("groom");

    expect(maddieIdlePhase(240)).toBe("nap");
    expect(maddieIdlePhase(360)).toBe("nap");
    expect(maddieIdlePhase(539)).toBe("nap");

    expect(maddieIdlePhase(540)).toBe("stretch");
    expect(maddieIdlePhase(599)).toBe("stretch");
    expect(maddieIdlePhase(600)).toBe("groom");
    expect(maddieIdlePhase(659)).toBe("groom");
    expect(maddieIdlePhase(660)).toBe("nap");
    expect(maddieIdlePhase(959)).toBe("nap");
    expect(maddieIdlePhase(960)).toBe("stretch");
  });
});

describe("E2: Ink # pose: tag parsing and extraction", () => {
  it("parses valid untargeted and targeted pose tags and ignores invalid ones", () => {
    expect(
      parsePoseTags([
        "speaker: Fae",
        "pose: cheer",
        "POSE:   SHOCK ",
        "pose: sit",
        "pose: talk",
        "pose: fae cheer",
        "pose: maddie cheer",
        "pose: sue shock",
        "pose: jordan sit",
        "pose: party cheer",
        "pose:",
        "pose: dance",
        "pose: unknown cheer",
        "pose: fae cheer extra",
        "sound: flute",
      ]),
    ).toEqual([
      { target: null, pose: "cheer" },
      { target: null, pose: "shock" },
      { target: null, pose: "sit" },
      { target: null, pose: "talk" },
      { target: "fae", pose: "cheer" },
      { target: "maddie", pose: "cheer" },
      { target: "sue", pose: "shock" },
      { target: "jordan", pose: "sit" },
      { target: "party", pose: "cheer" },
    ]);
  });

  it("safely parses malformed JSON and root outputStream in extractInkOutputTags", () => {
    expect(extractInkOutputTags("")).toEqual([]);
    expect(extractInkOutputTags("{not-json")).toEqual([]);
    expect(extractInkOutputTags("null")).toEqual([]);
    expect(extractInkOutputTags("[]")).toEqual([]);
    expect(
      extractInkOutputTags(
        JSON.stringify({
          outputStream: ["^Hi! ", "#", "^speaker: Fae", "/#", "#", "^pose: ", "^cheer", "/#"],
        }),
      ),
    ).toEqual(["speaker: Fae", "pose: cheer"]);
  });

  it("extracts real compiled Ink # pose: tags across knots and blank-conditional lines", () => {
    const story = compileInkStory(`
VAR flag = false

=== basic_poses ===
Yay, we found it! # speaker: Fae # pose: cheer
Whoa, a sparkle! # speaker: Fae # pose: shock
Let's take a breather. # speaker: Fae # pose: sit
Listen closely! # speaker: Fae # pose: talk
-> END

=== party_poses ===
Everyone look out! # speaker: Sue # pose: sue shock # pose: jordan sit # pose: maddie cheer
We did it together! # speaker: Fae # pose: party cheer
-> END

=== conditional_blank ===
Best day ever! # speaker: Fae # pose: cheer
{flag: secret line | }
And tomorrow will be even brighter.
-> END
`);
    const initialInk = createInkState(story, 7);

    const expectedBasic: { text: string; pose: string }[] = [
      { text: "Yay, we found it!", pose: "pose: cheer" },
      { text: "Whoa, a sparkle!", pose: "pose: shock" },
      { text: "Let's take a breather.", pose: "pose: sit" },
      { text: "Listen closely!", pose: "pose: talk" },
    ];
    let ink = initialInk;
    for (let i = 0; i < expectedBasic.length; i += 1) {
      const stepRes = runInk(
        story,
        ink,
        i === 0 ? { type: "start", knot: "basic_poses" } : { type: "next" },
      );
      ink = stepRes.ink;
      const line = stepRes.line;
      expect(line).not.toBeNull();
      if (line === null) continue;
      expect(line.text).toBe(expectedBasic[i]?.text);
      const tags = extractDialogueTags(
        { story },
        {
          ink,
          dialogue: {
            knot: "basic_poses",
            speaker: line.speaker,
            text: line.text,
            revealed: line.text.length,
            choices: stepRes.choices,
            selected: 0,
            ended: stepRes.ended,
          },
        },
      );
      expect(tags).toContain(expectedBasic[i]?.pose);
    }

    const p1 = runInk(story, initialInk, { type: "start", knot: "party_poses" });
    expect(p1.line).not.toBeNull();
    const p1Tags = extractDialogueTags(
      { story },
      {
        ink: p1.ink,
        dialogue: {
          knot: "party_poses",
          speaker: p1.line?.speaker ?? null,
          text: p1.line?.text ?? "",
          revealed: 10,
          choices: [],
          selected: 0,
          ended: p1.ended,
        },
      },
    );
    expect(parsePoseTags(p1Tags)).toEqual([
      { target: "sue", pose: "shock" },
      { target: "jordan", pose: "sit" },
      { target: "maddie", pose: "cheer" },
    ]);

    const p2 = runInk(story, p1.ink, { type: "next" });
    expect(p2.line).not.toBeNull();
    const p2Tags = extractDialogueTags(
      { story },
      {
        ink: p2.ink,
        dialogue: {
          knot: "party_poses",
          speaker: p2.line?.speaker ?? null,
          text: p2.line?.text ?? "",
          revealed: 10,
          choices: [],
          selected: 0,
          ended: p2.ended,
        },
      },
    );
    expect(parsePoseTags(p2Tags)).toEqual([{ target: "party", pose: "cheer" }]);

    // Blank conditional clears outputStream in runInk; knot-line fallback recovers # pose:
    const blankRes = runInk(story, initialInk, { type: "start", knot: "conditional_blank" });
    expect(blankRes.line?.text).toBe("Best day ever!");
    expect(extractInkOutputTags(blankRes.ink)).toEqual([]);
    expect(
      extractStoryKnotLineTags(story, "conditional_blank", blankRes.line?.text ?? ""),
    ).toContain("pose: cheer");
    const recovered = extractDialogueTags(
      { story },
      {
        ink: blankRes.ink,
        dialogue: {
          knot: "conditional_blank",
          speaker: blankRes.line?.speaker ?? null,
          text: blankRes.line?.text ?? "",
          revealed: 14,
          choices: [],
          selected: 0,
          ended: blankRes.ended,
        },
      },
    );
    expect(parsePoseTags(recovered)).toEqual([{ target: null, pose: "cheer" }]);
  });
});

describe("E2: selectFaeOverworldPose", () => {
  const fluteEvent = world.toolEvents.find((event) => event.trigger === "flute");
  const lassoEvent = world.toolEvents.find((event) => event.trigger === "lasso");
  const lanternEvent = world.toolEvents.find((event) => event.trigger === "lantern");

  it("keeps walking on walk_* even with lantern, rest, or dialogue active", () => {
    const state = makePlazaState({ lantern: true, motion: { distance: 20, moving: true } });
    expect(faePose(state, { facing: "right", activeRest: true, activePet: true })).toEqual({
      animation: "walk_left",
      frame: 1,
      mirror: true,
    });
  });

  it("keeps harness area on standard idle_* / walk_* poses", () => {
    const state = makePlazaState({ area: "harness", lantern: true });
    expect(
      faePose(state, {
        facing: "down",
        activeRest: true,
        activePet: true,
        dialogueTags: ["pose: cheer"],
      }),
    ).toEqual({ animation: "idle_down", frame: 0, mirror: false });
  });

  it("selects lantern, flute, and lasso tool poses with left-facing mirror rules", () => {
    const lanternState = makePlazaState({ lantern: true });
    expect(faePose(lanternState, { facing: "right" })).toEqual({
      animation: "pose_tool_lantern",
      frame: 0,
      mirror: true,
    });
    expect(faePose(lanternState, { facing: "left" })).toEqual({
      animation: "pose_tool_lantern",
      frame: 0,
      mirror: false,
    });

    const fluteKnotState = makePlazaState({
      dialogue: {
        knot: "flute",
        speaker: "Fae",
        text: "A sweet melody drifts across the grass.",
        revealed: 12,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    expect(faePose(fluteKnotState, { facing: "right" })).toEqual({
      animation: "pose_tool_flute",
      frame: 0,
      mirror: true,
    });

    const fluteSoundState = makePlazaState({
      dialogue: {
        knot: "meadow_chat",
        speaker: "Fae",
        text: "Listen!",
        revealed: 7,
        choices: [],
        selected: 0,
        ended: false,
        sound: "flute-blue",
      },
    });
    expect(faePose(fluteSoundState, { facing: "left" })).toEqual({
      animation: "pose_tool_flute",
      frame: 0,
      mirror: false,
    });

    const lassoLineState = makePlazaState({
      dialogue: {
        knot: "plaza_fountain",
        speaker: "Fae",
        text: "Fae twirls the starlight lasso and reels the shiny charm right in!",
        revealed: 60,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    expect(faePose(lassoLineState, { facing: "right" })).toEqual({
      animation: "pose_tool_lasso",
      frame: 0,
      mirror: true,
    });

    const plainState = makePlazaState();
    if (fluteEvent !== undefined) {
      expect(faePose(plainState, { activeToolEventId: fluteEvent.id })).toEqual({
        animation: "pose_tool_flute",
        frame: 0,
        mirror: false,
      });
    }
    if (lassoEvent !== undefined) {
      expect(faePose(plainState, { activeToolEventId: lassoEvent.id })).toEqual({
        animation: "pose_tool_lasso",
        frame: 0,
        mirror: false,
      });
    }
    if (lanternEvent !== undefined) {
      expect(faePose(plainState, { activeToolEventId: lanternEvent.id })).toEqual({
        animation: "pose_tool_lantern",
        frame: 0,
        mirror: false,
      });
    }
  });

  it("selects cozy rest sit, companion pet cheer, dialogue pose tags, and talk reveal", () => {
    const baseState = makePlazaState();

    expect(faePose(baseState, { facing: "right", activeRest: true })).toEqual({
      animation: "pose_sit",
      frame: 0,
      mirror: true,
    });
    expect(faePose(baseState, { facing: "right", activePet: true })).toEqual({
      animation: "pose_cheer",
      frame: 0,
      mirror: false,
    });

    const text = "Cloverhollow feels extra sparkly today!";
    const talkingState = makePlazaState({
      dialogue: {
        knot: "plaza_chat",
        speaker: "Fae",
        text,
        revealed: 10,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    expect(faePose(talkingState, { facing: "right", dialogueTags: ["pose: cheer"] })).toEqual({
      animation: "pose_cheer",
      frame: 0,
      mirror: false,
    });
    expect(faePose(talkingState, { facing: "right", dialogueTags: ["pose: shock"] })).toEqual({
      animation: "pose_shock",
      frame: 0,
      mirror: false,
    });
    expect(faePose(talkingState, { facing: "right", dialogueTags: ["pose: sit"] })).toEqual({
      animation: "pose_sit",
      frame: 0,
      mirror: true,
    });
    expect(faePose(talkingState, { facing: "left", dialogueTags: ["pose: talk"] })).toEqual({
      animation: "pose_talk",
      frame: 0,
      mirror: false,
    });

    // Active speaking reveal (no explicit pose tag)
    expect(faePose(talkingState, { facing: "right", dialogueTags: [] })).toEqual({
      animation: "pose_talk",
      frame: 0,
      mirror: true,
    });

    // Once reveal finishes, Fae settles back to idle_*
    const finishedTalking = makePlazaState({
      dialogue: {
        knot: "plaza_chat",
        speaker: "Fae",
        text,
        revealed: text.length,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    expect(faePose(finishedTalking, { facing: "right", dialogueTags: [] })).toEqual({
      animation: "idle_left",
      frame: 0,
      mirror: true,
    });
  });

  it("uses gentle breathing on computeFaePose while resting instead of squashing pose_sit", () => {
    const state = makePlazaState();
    const restSpot: RestSpot = {
      id: "plaza-sw-bench",
      area: "plaza",
      x: 690,
      y: 640,
      radius: 64,
      seatX: 690,
      seatY: 632,
      facing: "down",
    };
    const pose = computeFaePose(
      state,
      true,
      120,
      state.player,
      { spot: restSpot, elapsed: 0 },
      null,
    );
    expect(pose.offsetY).toBe(2);
    expect(pose.scaleX).toBeCloseTo(1, 5);
    expect(pose.scaleY).toBeCloseTo(1, 5);
    expect(pose.rotation).toBeCloseTo(0, 5);
  });
});

describe("E2: selectPartyOverworldPose", () => {
  it("drives Maddie long-idle phases and wakes to pose_cheer on pet or celebration", () => {
    const state = makePlazaState();
    expect(partyPose(state, makeMember("maddie", { stillTicks: 90 }))).toBeNull();

    expect(
      partyPose(state, makeMember("maddie", { stillTicks: 140 }), { facing: "right" }),
    ).toEqual({ animation: "pose_stretch", frame: 0, mirror: true });

    expect(
      partyPose(state, makeMember("maddie", { stillTicks: 200 }), { facing: "left" }),
    ).toEqual({ animation: "pose_groom", frame: 0, mirror: false });

    expect(
      partyPose(state, makeMember("maddie", { stillTicks: 300 }), { facing: "right" }),
    ).toEqual({ animation: "pose_nap", frame: 0, mirror: true });

    expect(
      partyPose(state, makeMember("maddie", { stillTicks: 300 }), {
        facing: "right",
        beingPetted: true,
      }),
    ).toEqual({ animation: "pose_cheer", frame: 0, mirror: true });

    expect(
      partyPose(state, makeMember("maddie", { stillTicks: 300 }), {
        facing: "left",
        partyAttention: "celebrate",
      }),
    ).toEqual({ animation: "pose_cheer", frame: 0, mirror: false });
  });

  it("drives Sue & Jordan resting, celebrations, and targeted/party dialogue poses", () => {
    const state = makePlazaState();
    const sue = makeMember("sue");
    const jordan = makeMember("jordan");

    expect(partyPose(state, sue, { facing: "right", activeRest: true })).toEqual({
      animation: "pose_sit",
      frame: 0,
      mirror: true,
    });
    expect(partyPose(state, jordan, { facing: "left", activeRest: true })).toEqual({
      animation: "pose_sit",
      frame: 0,
      mirror: false,
    });
    expect(partyPose(state, sue, { facing: "right", partyAttention: "celebrate" })).toEqual({
      animation: "pose_cheer",
      frame: 0,
      mirror: false,
    });

    const dialogueState = makePlazaState({
      dialogue: {
        knot: "plaza_event",
        speaker: "Fae",
        text: "Look at that!",
        revealed: 13,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    const pairTags = ["pose: sue shock", "pose: jordan sit"];
    expect(partyPose(dialogueState, sue, { facing: "right", dialogueTags: pairTags })).toEqual({
      animation: "pose_shock",
      frame: 0,
      mirror: false,
    });
    expect(partyPose(dialogueState, jordan, { facing: "right", dialogueTags: pairTags })).toEqual({
      animation: "pose_sit",
      frame: 0,
      mirror: true,
    });
    expect(
      partyPose(dialogueState, jordan, { facing: "right", dialogueTags: ["pose: party cheer"] }),
    ).toEqual({ animation: "pose_cheer", frame: 0, mirror: false });
  });

  it("returns null for flute friends, moving members, or harness area", () => {
    const state = makePlazaState();
    for (const friendId of ["pond-pup", "acorn-squirrel", "ribbon-bunny"]) {
      expect(
        partyPose(state, makeMember(friendId, { stillTicks: 300 }), {
          activeRest: true,
          beingPetted: true,
          partyAttention: "celebrate",
        }),
      ).toBeNull();
    }

    expect(
      partyPose(
        state,
        makeMember("maddie", { stillTicks: 300, motion: { distance: 12, moving: true } }),
      ),
    ).toBeNull();

    expect(
      partyPose(makePlazaState({ area: "harness" }), makeMember("maddie", { stillTicks: 300 }), {
        beingPetted: true,
      }),
    ).toBeNull();
  });

  it("wires expressive poses and paper-flip pose into computePartyFollowerTransform", () => {
    const state = makePlazaState();
    const maddieContent = world.party.maddie;
    if (maddieContent === undefined) throw new Error("Missing maddie party content");
    const maddie = makeMember("maddie", { facing: "right", stillTicks: 260 });
    const transform = computePartyFollowerTransform(
      maddie,
      maddieContent,
      state,
      0,
      { x: maddie.x, y: maddie.y },
      null,
      0.3,
      true,
      world.tunables.follow,
      null,
      () => 1,
      { paperFlipPose: paperFlipPose(4, true), worldStory: world.story },
    );
    expect(transform.animation).toBe("pose_nap");
    expect(transform.frame).toBe(0);
    expect(transform.mirror).toBe(true);
    expect(Math.abs(transform.scaleX)).toBeLessThan(0.2);
  });
});

describe("E2: selectBattleActorPose", () => {
  it("returns pose_cheer during soothed and reward phases with exact mirror flags", () => {
    const victoryPhases: readonly BattlePhase[] = ["soothed", "reward"];
    for (const phase of victoryPhases) {
      const battle = makeBattle(phase);
      expect(selectBattleActorPose("fae", battle)).toEqual({
        animation: "pose_cheer",
        mirror: false,
      });
      expect(selectBattleActorPose("sue", battle)).toEqual({
        animation: "pose_cheer",
        mirror: false,
      });
      expect(selectBattleActorPose("jordan", battle)).toEqual({
        animation: "pose_cheer",
        mirror: false,
      });
      expect(selectBattleActorPose("maddie", battle)).toEqual({
        animation: "pose_cheer",
        mirror: true,
      });
      expect(selectBattleActorPose("pond-pup", battle)).toBeNull();
    }
  });

  it("returns null during non-victory battle phases", () => {
    const nonVictory: readonly BattlePhase[] = [
      "intro",
      "command",
      "check",
      "result",
      "talk",
      "burst",
      "burstResult",
      "fizzle",
      "rest",
      "run",
    ];
    for (const phase of nonVictory) {
      const battle = makeBattle(phase);
      for (const actorId of ["fae", "maddie", "sue", "jordan"]) {
        expect(selectBattleActorPose(actorId, battle)).toBeNull();
      }
    }
  });
});

describe("E2: Paper-Flip turn motion (stepPaperFlip & paperFlipPose)", () => {
  it("starts a flip only on horizontal reversal, never on spawn or vertical turns", () => {
    expect(PAPER_FLIP_TICKS).toBe(8);
    expect(isHorizontalFacing("left")).toBe(true);
    expect(isHorizontalFacing("right")).toBe(true);
    expect(isHorizontalFacing("up")).toBe(false);
    expect(isHorizontalFacing("down")).toBe(false);

    const spawnDown = stepPaperFlip(undefined, "down", 10);
    expect(spawnDown).toEqual({ facing: null, startTick: null });
    // First horizontal facing after a vertical spawn establishes direction without flipping
    const firstRight = stepPaperFlip(spawnDown, "right", 11);
    expect(firstRight).toEqual({ facing: "right", startTick: null });
    const spawnLeft = stepPaperFlip(undefined, "left", 10);
    expect(spawnLeft).toEqual({ facing: "left", startTick: null });
    const spawnRight = stepPaperFlip(undefined, "right", 10);
    expect(spawnRight).toEqual({ facing: "right", startTick: null });

    expect(stepPaperFlip(spawnLeft, "left", 11)).toEqual({ facing: "left", startTick: null });
    expect(stepPaperFlip(spawnLeft, "up", 12)).toEqual({ facing: "left", startTick: null });
    expect(stepPaperFlip(spawnLeft, "down", 13)).toEqual({ facing: "left", startTick: null });

    // Reversing left -> down -> right triggers flip at tick 14
    const turnedRight = stepPaperFlip(stepPaperFlip(spawnLeft, "down", 13), "right", 14);
    expect(turnedRight).toEqual({ facing: "right", startTick: 14 });
    expect(stepPaperFlip(turnedRight, "up", 16)).toEqual({ facing: "right", startTick: 14 });

    const turnedLeft = stepPaperFlip(turnedRight, "left", 20);
    expect(turnedLeft).toEqual({ facing: "left", startTick: 20 });

    // Rewind clears stale startTick
    expect(stepPaperFlip(turnedLeft, "left", 5)).toEqual({ facing: "left", startTick: null });
  });

  it("dips to 0.16 at midpoint, settles with overshoot, and stays neutral when disabled", () => {
    const mid = paperFlipPose(4, true);
    expect(mid.scaleX).toBeCloseTo(0.16, 5);
    expect(mid.scaleY).toBeCloseTo(1.038, 5);
    expect(mid.offsetY).toBeCloseTo(-1.6, 5);
    expect(mid.offsetX).toBe(0);
    expect(mid.rotation).toBe(0);

    for (let elapsed = 0; elapsed < PAPER_FLIP_TICKS; elapsed += 0.5) {
      const pose = paperFlipPose(elapsed, true);
      expect(pose.scaleX).toBeGreaterThanOrEqual(0.16 - 1e-9);
      expect(pose.scaleY).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(pose.offsetY).toBeLessThanOrEqual(0);
    }

    const settle = paperFlipPose(7, true);
    expect(settle.scaleX).toBeGreaterThan(1);
    expect(settle.scaleX).toBeLessThan(1.05);

    expect(paperFlipPose(-1, true)).toEqual(NEUTRAL_POSE);
    expect(paperFlipPose(8, true)).toEqual(NEUTRAL_POSE);
    expect(paperFlipPose(12, true)).toEqual(NEUTRAL_POSE);
    expect(paperFlipPose(NaN, true)).toEqual(NEUTRAL_POSE);
    expect(paperFlipPose(4, true, 0)).toEqual(NEUTRAL_POSE);
    for (let tick = 0; tick < PAPER_FLIP_TICKS; tick += 1) {
      expect(paperFlipPose(tick, false)).toEqual(NEUTRAL_POSE);
    }
  });
});

describe("E2: on-disk companion pose atlases", () => {
  it("loads all 4 pose JSON sheets with every expected animation and frame", () => {
    const expectedAnimations: Readonly<Record<string, readonly string[]>> = {
      fae: [
        "pose_cheer",
        "pose_shock",
        "pose_sit",
        "pose_talk",
        "pose_tool_lantern",
        "pose_tool_lasso",
        "pose_tool_flute",
      ],
      maddie: ["pose_groom", "pose_stretch", "pose_nap", "pose_cheer"],
      sue: ["pose_cheer", "pose_shock", "pose_sit"],
      jordan: ["pose_cheer", "pose_shock", "pose_sit"],
    };

    expect(Object.keys(CHARACTER_POSE_ATLASES).sort()).toEqual(
      Object.keys(expectedAnimations).sort(),
    );

    for (const [id, expected] of Object.entries(expectedAnimations)) {
      const relPath = CHARACTER_POSE_ATLASES[id];
      expect(relPath).toBeDefined();
      if (relPath === undefined) continue;
      const parsed: unknown = JSON.parse(readFileSync(join("public", relPath), "utf8"));
      expect(isRecord(parsed)).toBe(true);
      if (!isRecord(parsed)) continue;
      expect(isRecord(parsed.frames)).toBe(true);
      expect(isRecord(parsed.animations)).toBe(true);
      if (!isRecord(parsed.frames) || !isRecord(parsed.animations)) continue;

      for (const animName of expected) {
        const frameList = parsed.animations[animName];
        expect(Array.isArray(frameList)).toBe(true);
        if (!Array.isArray(frameList)) continue;
        expect(frameList.length).toBeGreaterThanOrEqual(1);
        const firstFrame = frameList[0];
        expect(typeof firstFrame).toBe("string");
        if (typeof firstFrame === "string") {
          expect(Object.hasOwn(parsed.frames, firstFrame)).toBe(true);
        }
      }
    }
  });
});
