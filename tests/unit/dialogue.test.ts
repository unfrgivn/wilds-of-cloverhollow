import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, step, type ActionFrame, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

const content = loadContent();
const world = content.world;
const maybeNewGame = content.fixtures["new-game"];
if (maybeNewGame === undefined) throw new Error("new-game fixture missing");
const newGame = maybeNewGame;
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const confirm: ActionFrame = { ...none, confirm: true };
const down: ActionFrame = { ...none, move: { x: 0, y: 1 } };
const up: ActionFrame = { ...none, move: { x: 0, y: -1 } };

const firstLine = "Morning sun... and something sparkly over the plaza.";
const secondLine = "The fountain is fizzing pink bubbles. That's not normal.";

function atWindow(): State {
  return { ...createState(world, newGame), player: { x: 610, y: 345 }, facing: "up" };
}

function run(state: State, frames: ActionFrame[]): State {
  return frames.reduce((current, frame) => step(world, current, frame).state, state);
}

function open(state: State): State {
  const next = step(world, state, confirm).state;
  if (next.dialogue === null) throw new Error("dialogue did not open");
  return next;
}

// Release, then press: one fresh confirm edge.
function press(state: State, frame: ActionFrame = confirm): State {
  return run(state, [none, frame]);
}

function shown(state: State): boolean {
  return state.dialogue !== null && state.dialogue.revealed >= state.dialogue.text.length;
}

describe("dialogue state machine", () => {
  it("types a line out, and confirm shows the rest at once without advancing", () => {
    let state = open(atWindow());
    expect(state.dialogue?.text).toBe(firstLine);
    expect(state.dialogue?.revealed).toBe(0);
    state = run(state, [none]);
    expect(state.dialogue?.revealed).toBe(world.tunables.interact.revealPerTick);
    state = run(state, [confirm]);
    expect(state.dialogue?.text).toBe(firstLine);
    expect(shown(state)).toBe(true);
    state = run(state, [confirm]);
    expect(state.dialogue?.text, "a held confirm is not a new press").toBe(firstLine);
    state = run(state, [none, confirm]);
    expect(state.dialogue?.text).toBe(secondLine);
    expect(state.dialogue?.revealed).toBe(0);
  });

  it("ignores choices until the line is shown, then selects with wrapping edges", () => {
    let state = press(press(open(atWindow())));
    expect(state.dialogue?.text).toBe(secondLine);
    expect(state.dialogue?.choices).toEqual([
      "Go see right now!",
      "School first, then investigate.",
    ]);
    state = run(state, [down, none, { ...none, choose: 1 }]);
    expect(state.dialogue?.text, "touch choose while typing").toBe(secondLine);
    expect(state.dialogue?.selected, "down while typing").toBe(0);
    state = press(state);
    expect(shown(state)).toBe(true);
    state = run(state, [down]);
    expect(state.dialogue?.selected).toBe(1);
    state = run(state, [down]);
    expect(state.dialogue?.selected, "a held direction does not repeat").toBe(1);
    state = run(state, [none, down]);
    expect(state.dialogue?.selected, "down wraps to the top").toBe(0);
    state = run(state, [none, up]);
    expect(state.dialogue?.selected, "up wraps to the bottom").toBe(1);
    state = run(state, [none, { ...none, choose: 0 }]);
    expect(state.dialogue?.text, "touch picks its own index, not the selection")
      .toBe("Adventure first. School can wait five minutes!");
  });

  it("closes after the last line, freezes Fae while open, and lets her walk after", () => {
    let state = press(press(press(open(atWindow()))));
    state = press(run(state, [none, down]));
    expect(state.dialogue?.text).toBe("Backpack, socks, teeth. Then I'll investigate.");
    expect(state.dialogue?.ended).toBe(true);
    const frozen = state.player;
    state = run(state, [{ ...none, move: { x: 1, y: 0 } }, { ...none, move: { x: 1, y: 0 } }]);
    expect(state.player).toEqual(frozen);
    const buttons = step(world, state, { ...none, cancel: true, menu: true });
    expect(buttons.events, "cancel and menu are ignored in dialogue").toEqual([]);
    expect(buttons.state.dialogue?.text).toBe("Backpack, socks, teeth. Then I'll investigate.");
    state = press(state);
    expect(shown(state)).toBe(true);
    state = press(state);
    expect(state.dialogue).toBeNull();
    state = run(state, [confirm]);
    expect(state.dialogue, "the closing press does not reopen it").toBeNull();
    state = run(state, [{ ...none, move: { x: 1, y: 0 } }]);
    expect(state.player.x).toBeGreaterThan(frozen.x);
  });

  it("keeps Maddie settling while Fae reads", () => {
    let state = open(atWindow());
    const before = state.party[0]?.stillTicks ?? NaN;
    state = run(state, Array.from({ length: 10 }, () => none));
    expect(state.party[0]?.stillTicks).toBe(before + 10);
    expect(state.party[0]?.motion.moving).toBe(false);
  });

  it("remembers the plan when Fae looks out of the window again", () => {
    let state = press(press(press(open(atWindow()))));
    state = press(press(run(state, [{ ...none, choose: 0 }])));
    expect(state.dialogue).toBeNull();
    state = open(run(state, [none]));
    expect(state.dialogue?.text)
      .toBe("The fountain is still fizzing. I'm going to go look!");
    expect(state.dialogue?.choices).toEqual([]);
    state = press(press(state));
    expect(state.dialogue).toBeNull();
  });

  it("replays the morning script line by line and ends closed", () => {
    const path = "tests/sim/scripts/new-game/morning.json";
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    let state = createState(world, newGame);
    const lines: string[] = [];
    for (const segment of script) {
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        state = step(world, state, segment.frame).state;
        const text = state.dialogue?.text;
        if (text !== undefined && lines.at(-1) !== text) lines.push(text);
      }
    }
    expect(lines).toEqual([
      firstLine,
      secondLine,
      "Backpack, socks, teeth. Then I'll investigate.",
      "My journal, right under my pillow where it belongs.",
      "Note to self: fizzing fountain. Check after school.",
    ]);
    expect(state.dialogue).toBeNull();
  });
});
