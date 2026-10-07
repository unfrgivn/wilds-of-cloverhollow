import { describe, expect, it } from "vitest";
import { loadContent, storyTagErrors, storyTags } from "../../src/content/load";
import {
  battleCommands,
  createState,
  parseSave,
  serializeSave,
  step,
  targetInteractable,
  type Battle,
  type Fixture,
  type State,
} from "../../src/core";

const content = loadContent();
function plazaFixture(): Fixture {
  const fixture = content.fixtures.plaza;
  if (fixture === undefined) throw new Error("plaza fixture missing");
  return fixture;
}
const fixture = plazaFixture();
const blank = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };

// A confirm edge: Z down for a tick, then up.
function press(state: State): State {
  const pressed = step(content.world, state, { ...blank, confirm: true }).state;
  return step(content.world, pressed, blank).state;
}

// Fae on the cobbles below the bakery's window, facing it, with `coins`.
function atBakery(coins: number): State {
  const state = { ...createState(content.world, fixture), coins,
    player: { x: 1180, y: 465 }, facing: "up" as const };
  expect(targetInteractable(content.world, state)?.id).toBe("bakery");
  return state;
}

// Reads the open conversation to the end, picking `choice` at a choice.
function talk(start: State, choice: number): { state: State; lines: string[] } {
  let state = press(start);
  const lines: string[] = [];
  for (let count = 0; count < 50 && state.dialogue !== null; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) {
      state = press(state);
      continue;
    }
    if (lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    state = dialogue.choices.length === 0
      ? press(state)
      : step(content.world, state, { ...blank, choose: choice }).state;
  }
  expect(state.dialogue).toBeNull();
  return { state, lines };
}

function rewardState(critterId: string, coins: number): State {
  const critter = content.world.critters[critterId];
  if (critter === undefined) throw new Error(`${critterId} missing`);
  const battle: Battle = {
    critterId, entry: { x: 1100, y: 830 }, phase: "reward", message: critter.lines.reward,
    revealed: critter.lines.reward.length, selected: 0, command: null, energy: 5,
    calm: critter.calmMax, rest: {}, aim: null, lastGrade: null,
    rewardSticker: critter.sticker.id, aimTick: 0, phaseTicks: 0,
  };
  return { ...createState(content.world, fixture), coins, battle };
}

describe("coins and shops", () => {
  it("pays a calmed critter's coins as the battle ends: 8, and 25 for the gull", () => {
    const frog = press(rewardState("frog", 3));
    expect(frog).toMatchObject({ battle: null, coins: 11 });
    expect(frog.critters.frog).toBe("calm");
    expect(press(rewardState("gull", 0)).coins).toBe(25);
  });

  it("sells a snack for 5 coins, as often as Fae can pay", () => {
    const first = talk(atBakery(10), 0);
    expect(first.lines).toEqual([
      "The bakery smells like warm cinnamon buns.",
      "A fresh snack, wrapped up just for you!",
    ]);
    expect(first.state).toMatchObject({ coins: 5, snacks: 3 });
    // The shop's choices are sticky: the next visit sells another, and the
    // baker doesn't say she's short right after she spent her last 5 coins.
    const second = talk({ ...first.state, player: { x: 1180, y: 465 }, facing: "up" }, 0);
    expect(second.state).toMatchObject({ coins: 0, snacks: 4 });
    expect(second.lines).not.toContain("You need 5 coins for a snack. Keep exploring!");
  });

  it("offers nothing when Fae is short, and Not now keeps her coins", () => {
    const short = talk(atBakery(4), 0);
    expect(short.lines).toEqual([
      "The bakery smells like warm cinnamon buns.",
      "You need 5 coins for a snack. Keep exploring!",
    ]);
    expect(short.state).toMatchObject({ coins: 4, snacks: 2 });
    const browsing = talk(atBakery(7), 1);
    expect(browsing.lines.at(-1)).toBe("No rush! Come back when you're hungry.");
    expect(browsing.state).toMatchObject({ coins: 7, snacks: 2 });
  });

  it("uses Fae's snack supply and disables Snack at zero", () => {
    const state = { ...createState(content.world, fixture), snacks: 1 };
    const battle: Battle = {
      critterId: "frog", entry: state.player, phase: "command", message: "",
      revealed: 0, selected: 2, command: null, energy: 5, calm: 0, rest: {},
      aim: null, lastGrade: null, rewardSticker: null, aimTick: 0, phaseTicks: 0,
    };
    const used = press({ ...state, battle });
    expect(used.snacks).toBe(0);
    const snack = battleCommands(content.world, used).find((item) => item.id === "snack");
    expect(snack).toMatchObject({ disabled: true, detail: "×0" });
  });

  it("writes version 4 and refuses version 3 saves", () => {
    const state = createState(content.world, fixture);
    expect(JSON.parse(serializeSave(state)).version).toBe(4);
    expect(parseSave(JSON.stringify({ version: 3, state }), state)).toBeNull();
  });

  it("reads the story's tags and rejects bad shop items and travel targets", () => {
    const tags = storyTags(content.world.story);
    expect(tags).toEqual(expect.arrayContaining(["buy: snack 5", "travel: pass.bus"]));
    expect(storyTagErrors(tags, content.world.areas)).toEqual([]);
    expect(storyTagErrors(
      ["buy: cake 5", "buy: snack nope", "travel: pass.nowhere", "travel: moon.bus"],
      content.world.areas,
    )).toHaveLength(4);
  });
});
