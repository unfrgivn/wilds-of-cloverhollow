import { describe, expect, it } from "vitest";
import {
  blankInput,
  checkDraws,
  checkHint,
  createCheck,
  createState,
  echoNoteFromEdge,
  gentleCheckSpec,
  pickFromDraw,
  soundCues,
  step,
  stepCheck,
  viewCheck,
  type CheckState,
  type EchoNote,
  type EchoSpec,
  type Point,
  type State,
  type Wild,
} from "../../src/core";
import {
  loadContent,
  parseBattleContent,
  parseCritter,
  parsePartyMember,
} from "../../src/content/load";
import lambRaw from "../../content/critters/lamb.json";
import battleRaw from "../../content/battle.json";
import maddieRaw from "../../content/party/maddie.json";

const content = loadContent();
const { world } = content;

const sampleEcho: EchoSpec = {
  kind: "echo",
  notes: 3,
  demoTicks: 20,
  gapTicks: 6,
  inputTicks: 102,
};

function echoState(check: CheckState): Extract<CheckState, { kind: "echo" }> {
  if (check.kind !== "echo") throw new Error(`expected echo, got ${check.kind}`);
  return check;
}

function tickInput(echoNote: EchoNote | null = null): {
  confirmEdge: boolean;
  confirmHeld: boolean;
  lane: number;
  lean: 0;
  echoNote: EchoNote | null;
} {
  return { confirmEdge: false, confirmHeld: false, lane: 1, lean: 0, echoNote };
}

function startLambBattle(): State {
  const fixture = content.fixtures["hills-calm"];
  if (fixture === undefined) throw new Error("missing hills-calm fixture");
  let state = createState(world, fixture);
  const critter = world.critters.lamb;
  if (critter === undefined) throw new Error("missing critter lamb");
  const wild: Wild = {
    kind: "lamb",
    den: 0,
    mood: "chaos",
    x: state.player.x + 90,
    y: state.player.y,
    target: { x: state.player.x + 90, y: state.player.y },
    pauseTicks: 60,
    cooldownTicks: 0,
    facing: "left",
    moving: false,
    notice: 0,
  };
  state = { ...state, wild: [wild] };
  const right = { ...blankInput(), move: { x: 1, y: 0 } };
  for (let i = 0; i < 40 && state.battle === null; i += 1) {
    state = step(world, state, right).state;
  }
  if (state.battle === null) throw new Error("failed to enter lamb battle");
  return state;
}

function advanceToBurstCheck(start: State): State {
  let state = start;
  const press = { ...blankInput(), confirm: true };
  const idle = blankInput();
  for (let i = 0; i < 400; i += 1) {
    const battle = state.battle;
    if (battle === null) throw new Error("battle ended unexpectedly");
    if (battle.phase === "check" && battle.check?.side === "fae") return state;
    if (battle.phase === "check" && battle.check?.side === "critter") {
      state = step(world, state, idle).state;
      continue;
    }
    state = step(world, state, press).state;
    if (state.battle?.phase === "check" && state.battle.check?.side === "fae") return state;
    state = step(world, state, idle).state;
  }
  throw new Error("did not reach burst check");
}

describe("Echo Chimes battle check", () => {
  it("draws valid 0..3 notes, ignores demo input, and scores GREAT/GOOD/MISS", () => {
    expect(checkDraws(sampleEcho)).toBe(3);
    expect(pickFromDraw(sampleEcho, 0)).toBe(0);
    expect(pickFromDraw(sampleEcho, 0.25)).toBe(1);
    expect(pickFromDraw(sampleEcho, 0.5)).toBe(2);
    expect(pickFromDraw(sampleEcho, 0.9999)).toBe(3);

    expect(echoNoteFromEdge({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(0);
    expect(echoNoteFromEdge({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(1);
    expect(echoNoteFromEdge({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(2);
    expect(echoNoteFromEdge({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(3);
    // Held direction does not re-trigger; deterministic priority up > right > down > left.
    expect(echoNoteFromEdge({ x: 0, y: -1 }, { x: 0, y: -1 })).toBeNull();
    expect(echoNoteFromEdge({ x: 0, y: 0 }, { x: 1, y: -1 })).toBe(0);

    const picks: EchoNote[] = [2, 0, 3];
    let check = echoState(createCheck(sampleEcho, "fae", false, picks));
    const stride = sampleEcho.demoTicks + sampleEcho.gapTicks;
    const demoEnd = sampleEcho.notes * stride;

    // During demo, inputs are ignored and each note lights for demoTicks.
    for (let t = 1; t <= demoEnd; t += 1) {
      const stepped = stepCheck(check, tickInput(1));
      expect(stepped.grade).toBeNull();
      check = echoState(stepped.check);
      expect(check.entered).toBe(0);
      expect(checkHint(check, world.battle.hints)).toBe(world.battle.hints.echo);
      const view = viewCheck(check, null);
      expect(view.kind).toBe("echo");
      if (view.kind === "echo") {
        expect(view.phase).toBe("demo");
        expect(view.time).toBe(0);
      }
    }

    // First playback tick shows input phase, hint still visible until first note entered.
    check = echoState(stepCheck(check, tickInput(null)).check);
    expect(checkHint(check, world.battle.hints)).toBe(world.battle.hints.echo);
    expect(viewCheck(check, null)).toMatchObject({ kind: "echo", phase: "input", entered: 0 });

    // Enter all 3 notes accurately -> immediate GREAT.
    const s1 = stepCheck(check, tickInput(2));
    expect(s1.grade).toBeNull();
    expect(checkHint(s1.check, world.battle.hints)).toBeNull();
    const s2 = stepCheck(s1.check, tickInput(0));
    expect(s2.grade).toBeNull();
    const s3 = stepCheck(s2.check, tickInput(3));
    expect(s3.grade).toBe("great");
    expect(echoState(s3.check).results).toEqual(["hit", "hit", "hit"]);

    // GOOD: 2 of 3 hit.
    let good = echoState(createCheck(sampleEcho, "fae", false, [0, 1, 2]));
    for (let t = 0; t < demoEnd; t += 1) good = echoState(stepCheck(good, tickInput()).check);
    good = echoState(stepCheck(good, tickInput(0)).check);
    good = echoState(stepCheck(good, tickInput(3)).check);
    const goodEnd = stepCheck(good, tickInput(2));
    expect(goodEnd.grade).toBe("good");

    // MISS: timeout without entering notes.
    let miss = echoState(createCheck(sampleEcho, "fae", false, [0, 1, 2]));
    let missGrade = null;
    for (let t = 0; t < demoEnd + sampleEcho.inputTicks; t += 1) {
      const stepped = stepCheck(miss, tickInput());
      miss = echoState(stepped.check);
      missGrade = stepped.grade;
    }
    expect(missGrade).toBe("miss");
    expect(miss.results).toEqual(["miss", "miss", "miss"]);
  });

  it("softens Echo under Gentle Timing", () => {
    const gentle = gentleCheckSpec(sampleEcho);
    if (gentle.kind !== "echo") throw new Error("expected echo");
    expect(gentle.demoTicks).toBe(sampleEcho.demoTicks + 4);
    expect(gentle.inputTicks).toBe(sampleEcho.inputTicks + 36);
  });

  it("validates Echo specs and rejects invalid or Fae-side configs", () => {
    const withCheck = (check: unknown): unknown => ({
      ...structuredClone(lambRaw),
      burst: { bigChance: 0, check },
    });
    expect(() => parseCritter(withCheck({ ...sampleEcho, notes: 1 }), "l.json")).toThrow();
    expect(() => parseCritter(withCheck({ ...sampleEcho, demoTicks: 3 }), "l.json")).toThrow();
    expect(() => parseCritter(withCheck({ ...sampleEcho, gapTicks: 0 }), "l.json")).toThrow();
    expect(() => parseCritter(withCheck({ ...sampleEcho, inputTicks: 29 }), "l.json")).toThrow();

    const badBattle = {
      ...structuredClone(battleRaw),
      commands: {
        ...structuredClone(battleRaw.commands),
        soothe: { ...structuredClone(battleRaw.commands.soothe), check: sampleEcho },
      },
    };
    expect(() => parseBattleContent(badBattle, "battle.json")).toThrow();
    const badParty = {
      ...structuredClone(maddieRaw),
      command: { ...structuredClone(maddieRaw.command), check: sampleEcho },
    };
    expect(() => parsePartyMember(badParty, "maddie.json")).toThrow();
    const noHint = structuredClone(battleRaw);
    noHint.hints.echo = "";
    expect(() => parseBattleContent(noHint, "battle.json")).toThrow(/hints/);
  });

  it("plays end-to-end against Bouncy Lamb and emits exact chime cues without decay echoes", () => {
    let state = advanceToBurstCheck(startLambBattle());
    const check = state.battle?.check;
    expect(check?.kind).toBe("echo");
    if (check?.kind !== "echo") return;

    const chimeNames: readonly string[] = [
      "chime-red", "chime-yellow", "chime-green", "chime-blue",
    ];
    const expectedChimes = check.sequence.map((note) => chimeNames[note]);
    const startEnergy = state.battle?.energy ?? 0;
    const demoEnd = check.spec.notes * (check.spec.demoTicks + check.spec.gapTicks);

    // Step through demo and collect emitted chime cues.
    const demoCues: string[] = [];
    for (let t = 0; t < demoEnd; t += 1) {
      const next = step(world, state, blankInput()).state;
      demoCues.push(...soundCues(state, next, world).filter((cue) => cue.startsWith("chime-")));
      state = next;
    }
    expect(demoCues).toEqual(expectedChimes);

    // Echo back each note with a 16-tick pause between notes (testing activeTicks decay -> 1
    // does NOT emit a spurious second chime!).
    const dirs: readonly Point[] = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    const echoCues: string[] = [];
    for (const [index, note] of check.sequence.entries()) {
      const pressed = step(world, state, {
        ...blankInput(),
        move: dirs[note] ?? { x: 0, y: 0 },
      }).state;
      echoCues.push(...soundCues(state, pressed, world).filter((cue) => cue.startsWith("chime-")));
      state = pressed;
      if (index < check.sequence.length - 1) {
        for (let wait = 0; wait < 16 && state.battle?.phase === "check"; wait += 1) {
          const idle = step(world, state, blankInput()).state;
          echoCues.push(...soundCues(state, idle, world).filter((cue) => cue.startsWith("chime-")));
          state = idle;
        }
      }
    }
    expect(echoCues).toEqual(expectedChimes);
    expect(state.battle?.phase).toBe("burstResult");
    expect(state.battle?.lastGrade).toBe("great");
    expect(state.battle?.energy).toBe(startEnergy);
  });
});
