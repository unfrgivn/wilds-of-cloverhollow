import { describe, expect, it } from "vitest";
import {
  battleCommands, battleView, createState, step, type State, type World,
} from "../../src/core";
import { createInkState, runInk } from "../../src/core/ink";
import {
  loadContent, parseCritter, storyTagErrors, talkErrors, storyTags,
} from "../../src/content/load";

const content = loadContent();
const blank = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const knots = ["kid_talk_1", "kid_talk_2", "kid_talk_3"] as const;
const prompt = "The kid stops scribbling... and listens.";

function talkWorld(): World {
  const source = content.world.critters["arcade-keeper"];
  if (source === undefined) throw new Error("arcade keeper missing");
  return { ...content.world, critters: { ...content.world.critters, [source.id]: {
    ...source, canRun: false,
    talk: {
      label: "Talk", prompt, talkAt: 100, knots: [...knots],
      calm: { great: 30, good: 20, miss: 20 },
    },
  } } };
}

function battleState(world: World, calm: number, turn = 4): State {
  const fixture = content.fixtures.plaza;
  if (fixture === undefined) throw new Error("plaza fixture missing");
  return { ...createState(world, fixture), battle: {
    critterId: "arcade-keeper", den: null, entry: { x: 500, y: 500 }, phase: "command",
    message: "", revealed: 0, selected: 0, command: null, energy: 6, calm, rest: {}, check: null,
    lastGrade: null, rewardSticker: null, feelings: [], answered: false, lanternPeek: false,
    turn, windUp: null, phaseTicks: 0, talkMode: calm >= 100, talk: null, talkTurns: 0,
  } };
}

function press(world: World, state: State, choose?: number): State {
  return step(world, state, {
    ...blank, ...(choose === undefined ? { confirm: true } : { choose }),
  }).state;
}

describe("Talk in battle", () => {
  it("starts on a late battle turn and counts Talk turns independently", () => {
    const world = talkWorld();
    expect(battleCommands(world, battleState(world, 99)).map((item) => item.id))
      .not.toEqual(["talk"]);
    const opened = press(world, battleState(world, 100));
    expect(opened.battle?.talk?.knot).toBe("kid_talk_1");
    expect(opened.battle?.talkTurns).toBe(1);
    expect(battleView(world, opened)?.talk?.choices).toHaveLength(3);
  });

  it("says the critter is listening once Talk is all that's left", () => {
    const world = talkWorld();
    const critter = world.critters["arcade-keeper"];
    if (critter === undefined) throw new Error("arcade keeper missing");
    const at = battleState(world, 100);
    if (at.battle === null) throw new Error("no battle");
    // The intro, fully shown, then confirm: the turn's menu opens with Talk.
    const intro = { ...at, battle: { ...at.battle, phase: "intro" as const,
      message: critter.lines.intro, revealed: critter.lines.intro.length } };
    const opened = press(world, intro).battle;
    expect(opened?.phase).toBe("command");
    expect(opened?.message).toBe(prompt);
    expect(battleCommands(world, { ...intro, battle: opened ?? null }).map((item) => item.label))
      .toEqual(["Talk"]);
  });

  it("uses real Ink choices and preserves PRNG in Talk mode", () => {
    const world = talkWorld();
    let state = press(world, battleState(world, 100));
    const rng = state.rng;
    state = step(world, state, blank).state;
    state = step(world, state, { ...blank, confirm: true }).state;
    expect(state.battle?.talk?.revealed).toBe(state.battle?.talk?.text.length);
    state = step(world, state, { ...blank, choose: 0 }).state;
    expect(state.battle?.lastGrade).toBe("great");
    expect(state.battle?.calm).toBe(130);
    expect(state.rng).toBe(rng);
    expect(battleCommands(world, state).map((item) => item.id)).toEqual(["talk"]);
  });

  it("wraps the Talk choices, grades a good answer, and keeps Run when allowed", () => {
    const world = talkWorld();
    let state = press(world, battleState(world, 100));
    state = step(world, state, blank).state;
    state = step(world, state, { ...blank, confirm: true }).state;
    state = step(world, state, { ...blank, move: { x: 0, y: 1 } }).state;
    expect(state.battle?.talk?.selected).toBe(1);
    state = step(world, state, { ...blank, confirm: true }).state;
    expect(state.battle?.lastGrade).toBe("good");
    const allowed = { ...world, critters: {
      ...world.critters,
      "arcade-keeper": { ...world.critters["arcade-keeper"]!, canRun: true },
    } };
    expect(battleCommands(allowed, battleState(allowed, 0)).map((item) => item.id))
      .toContain("run");
  });

  it("walks every real Talk choice and finds exactly one grade", () => {
    const ink = createInkState(content.world.story, 1);
    for (const knot of knots) {
      const opening = runInk(content.world.story, ink, { type: "start", knot });
      expect(opening.choices).toHaveLength(3);
      for (const index of opening.choices.keys()) {
        const answer = runInk(content.world.story, opening.ink, { type: "choose", index });
        expect(answer.line?.tags.filter(
          (tag) => /^grade:\s*(great|good|miss)$/.test(tag),
        )).toHaveLength(1);
      }
    }
  });

  it("validates Talk content and grade tags", () => {
    const source = content.world.critters["arcade-keeper"];
    if (source === undefined) throw new Error("arcade keeper missing");
    const talk = {
      label: "Talk", prompt, talkAt: 100, knots: [...knots],
      calm: { great: 30, good: 20, miss: 20 },
    };
    const raw = { ...source, talk };
    expect(talkErrors(
      content.world.story, createInkState(content.world.story, 1),
      [parseCritter(raw, "talk.json")],
    )).toEqual([]);
    const unknown = {
      ...raw, talk: { ...talk, knots: ["nope", ...knots.slice(1)] },
    };
    expect(talkErrors(
      content.world.story, createInkState(content.world.story, 1),
      [parseCritter(unknown, "talk.json")],
    ).some((item) => item.includes("unknown talk knot nope"))).toBe(true);
    expect(storyTagErrors(["grade: nope"], {}, {})).toEqual([
      "invalid grade tag \"grade: nope\"",
    ]);
    expect(storyTags(content.world.story).filter((tag) => tag.startsWith("grade:")).length)
      .toBe(9);
    expect(() => parseCritter(
      { ...raw, talk: { ...talk, talkAt: 0 } }, "talk.json",
    )).toThrow(/talk\.talkAt/);
    expect(() => parseCritter(
      { ...raw, talk: { ...talk, prompt: "" } }, "talk.json",
    )).toThrow(/talk\.prompt/);
    expect(parseCritter(
      { ...raw, talk: { ...talk, calm: { great: 30, good: 20, miss: 1 } } }, "talk.json",
    ).talk?.calm.miss).toBe(1);
    expect(() => parseCritter(
      { ...raw, talk: { ...talk, calm: { great: 10, good: 20, miss: 20 } } }, "talk.json",
    )).toThrow(/talk\.calm order/);
  });
});
