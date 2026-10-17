import { describe, expect, it } from "vitest";
import {
  arcadeView, heldDown, openClaw, stepArcade, topPlush,
  type ArcadeGame, type ClawGame,
} from "../../src/core/arcade";
import {
  blankInput, createState, step, type ActionFrame, type State,
} from "../../src/core";
import { loadContent, parseArcade, storyTagErrors } from "../../src/content/load";
import arcadeJson from "../../content/arcade.json";
import prizesJson from "../../content/prizes.json";
import { createInkState, runInk, type InkFacts } from "../../src/core/ink";
import { inkFacts } from "../../src/core/sim";
import { autosaveNeeded, soundCues } from "../../src/core";

const content = loadContent();
const world = content.world;
const claw = world.arcade.claw;
const fixture = content.fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture is missing");
const arcadeFixture = content.fixtures.arcade;
if (arcadeFixture === undefined) throw new Error("arcade fixture is missing");

const frame = (confirm = false): ActionFrame => ({ ...blankInput(), confirm });
const base = (): State => createState(world, fixture);
const game = (phase: ClawGame["phase"], changes: Partial<ClawGame> = {}): ClawGame => ({
  game: "claw", phase, phaseTicks: 0, x: claw.railLeft, z: claw.depthFront,
  target: null, outcome: null, message: "", revealed: 0, ...changes,
});
const withGame = (value: ClawGame, prizes: string[] = []): State => ({
  ...base(), arcade: value, prizes,
});
const tick = (state: State, input: ActionFrame): State => ({
  ...state, ...stepArcade(world, state, input), previousInput: input,
});
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const arcadeCopy = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(JSON.stringify(arcadeJson));
  if (!record(value)) throw new Error("arcade fixture is not an object");
  return value;
};
const clawCopy = (value: Record<string, unknown>): Record<string, unknown> => {
  const result = value.claw;
  if (!record(result)) throw new Error("claw fixture is not an object");
  return result;
};
const mutate = (change: (value: Record<string, unknown>) => void): unknown => {
  const value = arcadeCopy();
  change(clawCopy(value));
  return value;
};
const plushes = (value: Record<string, unknown>): Record<string, unknown>[] => {
  const list = value.heap;
  if (!Array.isArray(list)) throw new Error("plushes are not an array");
  return list.filter(record);
};
const plushAt = (value: Record<string, unknown>, index: number): Record<string, unknown> => {
  const plush = plushes(value)[index];
  if (plush === undefined) throw new Error("plush is missing");
  return plush;
};
const facts = (prizes: string[] = [], coins = 2): InkFacts => ({
  calmed: { "arcade-keeper": true }, coins, snacks: 0, prizes,
  plushesLeft: claw.heap.filter((item) => !prizes.includes(item.prize)).length,
});
const knot = (prizeList: string[], coins: number, calm = true):
  { lines: string[]; choices: string[] } => {
  const ink = createInkState(world.story, 1);
  const storyFacts: InkFacts = { ...facts(prizeList, coins), calmed: {} };
  if (calm) storyFacts.calmed["arcade-keeper"] = true;
  let result = runInk(world.story, ink, { type: "start", knot: "claw_machine" }, storyFacts);
  const lines: string[] = [];
  for (let count = 0; count < 12; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.choices.length > 0 || result.ended) break;
    result = runInk(world.story, result.ink, { type: "next" }, storyFacts);
  }
  return { lines, choices: result.choices };
};
const conversationState = (coins: number): State => {
  const started = runInk(world.story, createInkState(world.story, 1),
    { type: "start", knot: "claw_machine" }, facts([], coins));
  const line = started.line;
  if (line === null) throw new Error("claw knot did not start");
  return {
    ...createState(world, arcadeFixture), coins, ink: started.ink,
    critters: { ...base().critters, "arcade-keeper": "calm" },
    dialogue: { knot: "claw_machine", speaker: line.speaker, text: line.text,
      revealed: 0, choices: started.choices, selected: 0, ended: started.ended },
  };
};
const choosePlay = (initial: State): State => {
  let state = initial;
  for (let count = 0; count < 300; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue === null) return state;
    if (dialogue.revealed < dialogue.text.length)
      state = stepGame(state, frame(false));
    else {
      state = stepGame(state, frame(true));
      state = stepGame(state, frame(false));
    }
  }
  throw new Error(`conversation did not finish: ${state.dialogue?.text ?? "none"}`);
};
const stepGame = (state: State, input: ActionFrame): State =>
  step(world, state, input).state;
const isResult = (value: State["arcade"]): boolean => value?.phase === "result";
const playToResult = (
  initial: State,
  target: { x: number; z: number },
): { state: State; cues: string[]; stop: { x: number; z: number }; message: string } => {
  let state = initial;
  state = { ...state, previousInput: frame(false) };
  const cues: string[] = [];
  let stop: { x: number; z: number } | null = null;
  const move = (input: ActionFrame): void => {
    const next = stepGame(state, input);
    cues.push(...soundCues(state, next, world));
    state = next;
    if (stop === null && state.arcade?.phase === "dropping" && state.arcade !== null)
      stop = { x: state.arcade.x, z: state.arcade.z };
  };
  move(frame(false));
  move(frame(true));
  if (state.arcade?.phase !== "sliding")
    throw new Error(`did not start ${target.x},${target.z}: ${state.arcade?.phase ?? "closed"}`);
  const xTicks = Math.ceil((target.x - claw.railLeft) / claw.speed);
  for (let count = 0; count < xTicks; count += 1) move(frame(true));
  move(frame(false));
  move(frame(true));
  const zTicks = Math.ceil((target.z - claw.depthFront) / claw.speed);
  for (let count = 0; count < zTicks; count += 1) move(frame(true));
  move(frame(false));
  for (let count = 0; count < 1000; count += 1) {
    if (isResult(state.arcade)) break;
    move(frame(false));
  }
  const result = state.arcade;
  if (result === null || result.phase !== "result")
    throw new Error(
      `game did not finish in ${result?.phase ?? "closed"} for ${target.x},${target.z}`,
    );
  if (stop === null) throw new Error("game never reached the drop");
  const message = result.message;
  move(frame(true));
  move(frame(false));
  move(frame(true));
  return { state, cues, stop, message };
};

describe("claw machine movement", () => {
  it("requires a fresh edge, moves only while held, and does not move on release", () => {
    let state = withGame(game("ready"));
    state = { ...state, previousInput: frame(true) };
    expect(tick(state, frame(true)).arcade?.phase).toBe("ready");
    state = tick({ ...state, previousInput: frame(false) }, frame(true));
    expect(state.arcade).toMatchObject({ phase: "sliding", x: claw.railLeft });
    const start = state.arcade?.x ?? claw.railLeft;
    for (let count = 0; count < 3; count += 1) state = tick(state, frame(true));
    expect(state.arcade?.x).toBe(start + claw.speed * 3);
    const beforeRelease = state.arcade?.x;
    state = tick(state, frame(false));
    expect(state.arcade).toMatchObject({ phase: "aiming", x: beforeRelease });
  });

  it("uses the same fresh-edge and clamp rules while pushing", () => {
    let state = withGame(game("aiming"));
    state = tick(state, frame(true));
    expect(state.arcade).toMatchObject({ phase: "pushing", z: claw.depthFront });
    for (let count = 0; count < 2; count += 1) state = tick(state, frame(true));
    expect(state.arcade?.z).toBe(claw.depthFront + claw.speed * 2);
    const beforeRelease = state.arcade?.z;
    state = tick(state, frame(false));
    expect(state.arcade).toMatchObject({ phase: "dropping", z: beforeRelease });
    const atWall = withGame(game("pushing", { z: claw.depthBack - claw.speed }));
    expect(tick(atWall, frame(true)).arcade).toMatchObject({
      phase: "dropping", z: claw.depthBack,
    });
  });

  it("clamps at the rail end and advances to aiming", () => {
    const state = withGame(game("sliding", { x: claw.railRight - claw.speed }));
    expect(tick(state, frame(true)).arcade).toMatchObject({
      phase: "aiming", x: claw.railRight,
    });
  });
});

describe("claw timing and targets", () => {
  it("finds the target and stuck outcome at every heap plush", () => {
    const free = claw.heap.filter((item) => !heldDown(claw, base(), item.prize))
      .map((item) => item.prize);
    const derivedFree = claw.heap.filter((item) =>
      !claw.heap.some((other) => other.on.includes(item.prize)))
      .map((item) => item.prize);
    expect(free).toEqual(derivedFree);
    for (const plush of claw.heap) {
      const state = withGame(game("grabbing", {
        phaseTicks: claw.grabTicks - 1, x: plush.x, z: plush.z,
      }));
      const next = tick(state, frame());
      const target = topPlush(claw, state, plush.x, plush.z);
      expect(next.arcade?.target).toBe(target?.prize ?? null);
      expect(next.arcade?.outcome).toBe(target === null ? "empty"
        : heldDown(claw, state, target.prize) ? "stuck" : "grabbed");
    }
  });

  it("keeps timed phases for exactly their configured number of ticks", () => {
    const durations: { phase: ClawGame["phase"]; ticks: number }[] = [
      { phase: "dropping", ticks: claw.dropTicks },
      { phase: "grabbing", ticks: claw.grabTicks },
      { phase: "lifting", ticks: claw.liftTicks },
      { phase: "releasing", ticks: claw.releaseTicks },
    ];
    for (const duration of durations) {
      let state = withGame(game(duration.phase, { phaseTicks: 0 }));
      for (let count = 1; count < duration.ticks; count += 1) {
        state = tick(state, frame());
        expect(state.arcade?.phase).toBe(duration.phase);
        expect(state.arcade?.phaseTicks).toBe(count);
      }
      expect(tick(state, frame()).arcade?.phase).not.toBe(duration.phase);
    }
  });

  it("returns in the ceiling of the largest remaining distance", () => {
    const starts = [
      { x: claw.railRight, z: claw.depthBack },
      { x: claw.railRight - claw.speed * 3, z: claw.depthBack - claw.speed },
      { x: claw.railLeft + claw.speed, z: claw.depthFront + claw.speed * 7 },
    ];
    for (const start of starts) {
      let state = withGame(game("returning", start));
      const expected = Math.ceil(Math.max(
        start.x - claw.railLeft, start.z - claw.depthFront,
      ) / claw.speed);
      for (let count = 0; count < expected; count += 1) state = tick(state, frame());
      expect(state.arcade).toMatchObject({ phase: "releasing", x: claw.railLeft,
        z: claw.depthFront });
    }
  });

  it("selects the highest then nearest plush, excluding prizes", () => {
    const pup = claw.heap.find((item) => item.prize === "pup-plush");
    const bunny = claw.heap.find((item) => item.prize === "bunny-plush");
    if (pup === undefined || bunny === undefined) throw new Error("heap is incomplete");
    const high = topPlush(claw, base(), pup.x, pup.z);
    expect(high?.prize).toBe(pup.prize);
    const low = topPlush(claw, { ...base(), prizes: [pup.prize] }, bunny.x, bunny.z);
    expect(low?.prize).toBe(bunny.prize);
    expect(topPlush(claw, { ...base(), prizes: claw.heap.map((item) => item.prize) },
      claw.railLeft, claw.depthFront)).toBeNull();
  });

  it("uses inclusive reach and reports whether a target is held down", () => {
    const frog = claw.heap.find((item) => item.prize === "frog-plush");
    if (frog === undefined) throw new Error("frog is missing");
    expect(topPlush(claw, base(), frog.x + claw.reach, frog.z)?.prize)
      .toBe("frog-plush");
    expect(topPlush(claw, base(), frog.x + claw.reach + 1, frog.z)?.prize)
      .not.toBe("frog-plush");
    expect(heldDown(claw, base(), "frog-plush")).toBe(true);
    expect(heldDown(claw, base(), "cat-plush")).toBe(false);
  });

  it("finds higher and nearer ties by searching the content grid", () => {
    const squared = (a: { x: number; z: number }, x: number, z: number): number =>
      (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z);
    const inReach = (item: typeof claw.heap[number], x: number, z: number): boolean =>
      squared(item, x, z) <= claw.reach * claw.reach;
    let different: { x: number; z: number; expected: string } | null = null;
    let equal: { x: number; z: number; expected: string } | null = null;
    for (let x = claw.railLeft; x <= claw.railRight; x += claw.speed) {
      for (let z = claw.depthFront; z <= claw.depthBack; z += claw.speed) {
        const nearby = claw.heap.filter((item) => inReach(item, x, z));
        for (const first of nearby) for (const second of nearby) {
          if (first.prize === second.prize) continue;
          if (first.level !== second.level && different === null)
            different = { x, z, expected: first.level > second.level ? first.prize : second.prize };
          if (first.level === second.level && squared(first, x, z) !== squared(second, x, z) &&
            equal === null) {
            equal = { x, z, expected: squared(first, x, z) < squared(second, x, z)
              ? first.prize : second.prize };
          }
        }
      }
    }
    expect(different).not.toBeNull();
    if (different !== null)
      expect(topPlush(claw, base(), different.x, different.z)?.prize)
        .toBe(different.expected);
    if (equal === null) {
      expect(equal).toBeNull();
    } else {
      expect(topPlush(claw, base(), equal.x, equal.z)?.prize).toBe(equal.expected);
    }
  });
});

describe("claw result and view", () => {
  it("plays the heap in dependency order through real step frames", () => {
    let state: State = {
      ...createState(world, arcadeFixture), coins: 30,
      critters: { ...base().critters, "arcade-keeper": "calm" },
    };
    const order: string[] = [];
    const raccoon = claw.heap.find((item) => item.prize === "raccoon-plush");
    if (raccoon === undefined) throw new Error("raccoon is missing");
    const stuck = playToResult(
      openClaw(world, { ...state, coins: 30 }, 2), raccoon,
    );
    expect(stuck.message).toBe(claw.lines.stuck);
    expect(stuck.state.prizes).toEqual([]);
    state = stuck.state;
    let wonRaccoon = false;
    while (order.length < claw.heap.length) {
      const available = claw.heap.find((item) => !state.prizes.includes(item.prize) &&
        !heldDown(claw, state, item.prize));
      if (available === undefined) throw new Error("heap has no available plush");
      const opened = openClaw(world, state, 2);
      const played = playToResult(opened, available);
      if (Math.abs(played.stop.x - available.x) > claw.reach)
        throw new Error(`stop x ${played.stop.x} missed ${available.prize} at ${available.x}`);
      expect(Math.abs(played.stop.z - available.z)).toBeLessThanOrEqual(claw.reach);
      expect(played.state.prizes).toContain(available.prize);
      state = played.state;
      order.push(available.prize);
      if (available.prize === raccoon.prize) wonRaccoon = true;
    }
    expect(wonRaccoon).toBe(true);
    expect(order).toHaveLength(claw.heap.length);
    expect(state.prizes).toEqual(order);
    // Everything resting on the raccoon (the squirrel and the bluebird) is won first.
    const raccoonIndex = order.indexOf(raccoon.prize);
    const onRaccoon = claw.heap.filter((value) => value.on.includes(raccoon.prize));
    expect(onRaccoon.length).toBeGreaterThan(0);
    for (const item of onRaccoon)
      expect(order.indexOf(item.prize)).toBeLessThan(raccoonIndex);
  });

  it("plays grabbed, stuck, and empty games with exact arcade cues", () => {
    const cat = claw.heap.find((item) => item.prize === "cat-plush");
    const bunny = claw.heap.find((item) => item.prize === "bunny-plush");
    if (cat === undefined || bunny === undefined) throw new Error("heap is incomplete");
    const grabbed = playToResult(
      openClaw(world, { ...createState(world, arcadeFixture), coins: 2 }, 2), cat,
    );
    expect(grabbed.cues).toEqual([
      "claw-move", "claw-move", "claw-drop", "claw-grab", "prize-won",
    ]);
    const stuck = playToResult(
      openClaw(world, { ...createState(world, arcadeFixture), coins: 2 }, 2), bunny,
    );
    expect(stuck.cues).toEqual(["claw-move", "claw-move", "claw-drop", "claw-miss"]);
    expect(stuck.message).toBe(claw.lines.stuck);
    let emptySpot: { x: number; z: number } | null = null;
    for (let x = claw.railLeft; x <= claw.railRight && emptySpot === null;
      x += claw.speed) {
      for (let z = claw.depthFront; z <= claw.depthBack; z += claw.speed) {
        if (topPlush(claw, createState(world, arcadeFixture), x, z) === null) {
          emptySpot = { x, z };
          break;
        }
      }
    }
    expect(emptySpot).not.toBeNull();
    if (emptySpot === null) throw new Error("no empty floor spot exists");
    const empty = playToResult(
      openClaw(world, { ...createState(world, arcadeFixture), coins: 2 }, 2), emptySpot,
    );
    expect(empty.cues).toEqual(["claw-move", "claw-move", "claw-drop", "claw-miss"]);
    expect(empty.message).toBe(claw.lines.missed);
  });

  it("adds a grabbed catalogue prize once and reveals then closes", () => {
    const target = claw.heap.find((item) => item.prize === "frog-plush");
    if (target === undefined) throw new Error("frog is missing");
    let state = withGame(game("releasing", {
      phaseTicks: claw.releaseTicks - 1, target: target.prize, outcome: "grabbed",
    }));
    state = tick(state, frame());
    expect(state.arcade?.message).toBe("You won the Frog Plush!");
    expect(state.prizes).toEqual(["frog-plush"]);
    const first = tick(state, frame());
    expect(first.arcade?.revealed).toBe(world.tunables.interact.revealPerTick);
    let shown = first;
    while (shown.arcade !== null &&
      shown.arcade.revealed < shown.arcade.message.length)
      shown = tick(shown, frame());
    const closed = tick(shown, frame(true));
    expect(closed.arcade).toBeNull();
    const duplicate = tick(withGame(game("releasing", {
      phaseTicks: claw.releaseTicks - 1, target: target.prize, outcome: "grabbed",
    }), [target.prize]), frame());
    expect(duplicate.prizes).toEqual([target.prize]);
  });

  it("projects boundary values, hints, stop height, tug, and falling", () => {
    const ready = arcadeView(world, withGame(game("ready")));
    expect(ready?.hint).toBe(claw.lines.slide);
    expect(ready?.claw.open).toBe(true);
    const dropping = arcadeView(world, withGame(game("dropping", {
      phaseTicks: claw.dropTicks - 1, x: claw.heap[0]?.x ?? claw.railLeft,
      z: claw.heap[0]?.z ?? claw.depthFront,
    })));
    expect(dropping?.claw.drop).toBe((claw.dropTicks - 1) / claw.dropTicks);
    expect(dropping?.claw.stop).toBe(1);
    const held = arcadeView(world, withGame(game("releasing", {
      phaseTicks: claw.releaseTicks / 2, target: "frog-plush", outcome: "grabbed",
    })));
    const frog = held?.plushes.find((item) => item.id === "frog-plush");
    expect(frog).toMatchObject({ held: true, x: claw.railLeft, z: claw.depthFront,
      fall: .5, tug: false });
    const stuck = arcadeView(world, withGame(game("lifting", {
      target: "bunny-plush", outcome: "stuck" })));
    expect(stuck?.plushes.find((item) => item.id === "bunny-plush")?.tug).toBe(true);
    expect(arcadeView(world, withGame(game("aiming")))?.hint).toBe(claw.lines.push);
  });

  it("emits the exact cues for a real transition sequence", () => {
    const ready = withGame(game("ready"));
    const sliding = tick(ready, frame(true));
    expect(soundCues(ready, sliding, world)).toEqual(["claw-move"]);
    const pushing = withGame(game("pushing", { z: claw.depthBack - claw.speed }));
    const dropping = tick(pushing, frame(true));
    expect(soundCues(pushing, dropping, world))
      .toEqual(["claw-drop"]);
    const cat = claw.heap.find((item) => item.prize === "cat-plush");
    if (cat === undefined) throw new Error("cat is missing");
    const grabbing = withGame(game("grabbing", {
      phaseTicks: claw.grabTicks - 1, x: cat.x, z: cat.z,
    }));
    const lifting = tick(grabbing, frame());
    expect(soundCues(grabbing, lifting, world)).toEqual(["claw-grab"]);
  });
});

describe("claw content and Ink integration", () => {
  it("covers every claw-machine Ink line and choice branch", () => {
    const all = claw.heap.map((item) => item.prize);
    const notCalm = knot([], 2, false);
    expect(notCalm.lines).toEqual([
      "The machine is all fizzy with purple scribbles.",
      "I'd better calm Mr. Pip first.",
    ]);
    expect(notCalm.choices).toEqual([]);
    const empty = knot(all, 2);
    expect(empty.lines).toEqual(["The claw machine is empty. I won every plush!"]);
    expect(empty.choices).toEqual([]);
    const raccoon = knot(["raccoon-plush"], 2);
    expect(raccoon.lines).toContain("That smug raccoon plush is all mine now. Ha!");
    const onlyRaccoon = knot(all.filter((item) => item !== "raccoon-plush"), 2);
    expect(onlyRaccoon.lines).toContain("Just one plush left, and it's the very smug raccoon.");
    const defaultLines = knot(["frog-plush"], 2);
    expect(defaultLines.lines).toContain(
      "A claw machine full of plush critters, and one very smug raccoon.",
    );
    expect(knot([], 1).lines).toContain("I need 2 coins to play.");
    expect(knot([], 1).choices).toEqual([]);
    expect(knot([], 2).choices).toEqual(["Play for 2 coins", "Not now"]);
  });

  it("opens through the real conversation and charges two coins", () => {
    const state = choosePlay(conversationState(2));
    expect(state.arcade?.game).toBe("claw");
    expect(state.coins).toBe(0);
  });

  it("does not open or charge when the balance drops below two before close", () => {
    const initial = conversationState(2);
    const dialogue = initial.dialogue;
    if (dialogue === null) throw new Error("dialogue is missing");
    const reduced = { ...initial, coins: 1, dialogue: { ...dialogue,
      revealed: dialogue.text.length } };
    const state = choosePlay(reduced);
    expect(state.arcade).toBeNull();
    expect(state.coins).toBe(1);
  });

  it("validates the real content and every malformed loader case", () => {
    expect(() => parseArcade(arcadeJson, prizesJson)).not.toThrow();
    const cases: unknown[] = [
      mutate((value) => { value.speed = 1.5; }),
      mutate((value) => { value.railRight = 1001; }),
      mutate((value) => { value.depthBack = 461; }),
      mutate((value) => { plushAt(value, 0).prize = "unknown"; }),
      mutate((value) => { plushAt(value, 1).prize = plushAt(value, 0).prize; }),
      mutate((value) => { plushAt(value, 0).x = 1; }),
      mutate((value) => { plushAt(value, 0).z = 461; }),
    ];
    for (const value of cases) expect(() => parseArcade(value, prizesJson)).toThrow();
    expect(storyTagErrors(["play: claw 2"], world.areas)).toEqual([]);
    expect(storyTagErrors(["play: claw", "play: skee 2", "play: claw two"], world.areas))
      .toHaveLength(3);
  });

  it("rejects each invalid heap relationship with its field in the error", () => {
    const cases: { name: string; value: unknown; field: RegExp }[] = [
      {
        name: "level zero with support",
        value: mutate((value) => { plushAt(value, 0).on = ["cat-plush"]; }),
        field: /claw\.heap\[0\]\.on/,
      },
      {
        name: "level one without support",
        value: mutate((value) => { plushAt(value, 5).on = []; }),
        field: /claw\.heap\[5\]/,
      },
      {
        name: "support at the wrong level",
        value: mutate((value) => { plushAt(value, 5).on = ["cat-plush"]; }),
        field: /claw\.heap\[5\]/,
      },
      {
        name: "support more than three reaches away",
        value: mutate((value) => {
          const plush = plushAt(value, 5);
          plush.x = claw.railRight;
          plush.z = claw.depthBack;
        }),
        field: /claw\.heap\[5\]/,
      },
      {
        name: "plush in the chute",
        value: mutate((value) => {
          const plush = plushAt(value, 0);
          plush.x = claw.railLeft;
          plush.z = claw.depthFront;
        }),
        field: /claw\.heap\[0\]/,
      },
      {
        name: "won line without prize token",
        value: mutate((value) => {
          const lines = value.lines;
          if (!record(lines)) throw new Error("lines are missing");
          lines.won = "You won it!";
        }),
        field: /claw\.lines/,
      },
      {
        name: "non-string support entry",
        value: mutate((value) => { plushAt(value, 5).on = [4]; }),
        field: /claw\.heap\[5\]/,
      },
    ];
    for (const item of cases) {
      expect(() => parseArcade(item.value, prizesJson), item.name).toThrow(item.field);
    }
  });

  it("reports nine then eight remaining plushes through real Ink facts", () => {
    expect(inkFacts(world, base()).plushesLeft).toBe(9);
    const won = { ...base(), prizes: ["frog-plush"] };
    expect(inkFacts(world, won).plushesLeft).toBe(8);
    const ink = createInkState(world.story, 1);
    let result = runInk(world.story, ink, { type: "start", knot: "claw_machine" }, facts());
    for (let count = 0; count < 5 && result.choices.length === 0; count += 1)
      result = runInk(world.story, result.ink, { type: "next" }, facts());
    expect(result.choices).toEqual(["Play for 2 coins", "Not now"]);
  });

  it("freezes Fae and the journal while an arcade game is open", () => {
    const state = { ...withGame(game("ready")), previousInput: frame() };
    const next = step(world, state, { ...frame(), move: { x: 1, y: 0 }, menu: true,
      cancel: true });
    expect(next.state.player).toEqual(state.player);
    expect(next.state.journalOpen).toBe(false);
    expect(next.state.arcade).not.toBeNull();
    for (const [index, member] of state.party.entries())
      expect(next.state.party[index]?.stillTicks).toBe(member.stillTicks + 1);
  });

  it("autosaves only after the game closes", () => {
    const before = withGame(game("ready"));
    const after = tick(before, frame());
    expect(autosaveNeeded(before, after)).toBe(false);
    expect(autosaveNeeded(after, { ...after, arcade: null })).toBe(true);
  });
});
