import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  journalNotes,
  presentCritters,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { createInkState, inkVariable, runInk } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Contract for the school raccoon (Milestone 15, a battle since Milestone 28).
// Once Nurse Holly hands Fae a hall pass, a fizzy raccoon waits by the plaza's
// school path. Calmed, it says what it overheard: a kid in a purple hood
// whispering the tree house's password. Then it scampers off.

const content = loadContent();
const world = content.world;
const story = world.story;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

// Plays a knot from `ink`, picking `choice` at the first choice, and returns
// the lines shown and the story state after.
function play(ink: string, knot: string, choice?: number): { lines: string[]; ink: string } {
  const lines: string[] = [];
  let result = runInk(story, ink, { type: "start", knot });
  for (let count = 0; count < 20; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.choices.length > 0) {
      if (choice === undefined) break;
      result = runInk(story, result.ink, { type: "choose", index: choice });
      continue;
    }
    if (result.ended) break;
    result = runInk(story, result.ink, { type: "next" });
  }
  return { lines, ink: result.ink };
}

function plaza(ink: string): State {
  const fixture = content.fixtures.plaza;
  if (fixture === undefined) throw new Error("plaza fixture missing");
  return { ...createState(world, fixture), ink };
}

const fresh = createInkState(story, 1);
const withPass = play(fresh, "nurse", 1).ink;

describe("the school raccoon", () => {
  it("waits by the school path only once Fae has the hall pass", () => {
    const keys = (ink: string): string[] =>
      presentCritters(world, plaza(ink)).map((critter) => critter.key);
    expect(inkVariable(story, fresh, "raccoon_waiting")).toBe(false);
    expect(keys(fresh)).not.toContain("school-raccoon");
    expect(inkVariable(story, withPass, "raccoon_waiting")).toBe(true);
    expect(keys(withPass)).toContain("school-raccoon");
    const raccoon = world.critters["school-raccoon"];
    expect(raccoon).toMatchObject({ species: "raccoon", calmKnot: "school_raccoon",
      sticker: { id: "ringtail-raccoon" } });
  });

  it("is a battle: walking into it calls it, and calming it pays and gives its sticker", () => {
    // From the school path's spawn, up and right toward it.
    let state: State = { ...plaza(withPass), player: { x: 330, y: 930 }, facing: "up" };
    for (let tick = 0; tick < 120 && state.battle === null; tick += 1)
      state = step(world, state, press({ move: { x: 1, y: -1 } })).state;
    expect(state.battle).toMatchObject({ critterId: "school-raccoon", den: null });
    const battle = state.battle;
    if (battle === null) throw new Error("no battle");
    const raccoon = world.critters["school-raccoon"];
    if (raccoon === undefined) throw new Error("no school raccoon");
    state = { ...state, battle: { ...battle, phase: "soothed", message: raccoon.lines.soothed,
      revealed: raccoon.lines.soothed.length, calm: raccoon.calmMax } };
    for (let count = 0; count < 20 && state.battle !== null; count += 1) {
      state = step(world, state, press({ confirm: true })).state;
      state = step(world, state, blankInput()).state;
    }
    expect(state.critters["school-raccoon"]).toBe("calm");
    expect(state.stickers).toEqual(["ringtail-raccoon"]);
    expect(state.coins).toBe(8);
  });

  it("tells the password it overheard once calm, then scampers off", () => {
    let state: State = { ...plaza(withPass), player: { x: 400, y: 905 }, facing: "up",
      critters: { ...plaza(withPass).critters, "school-raccoon": "calm" } };
    expect(targetInteractable(world, state)?.id).toBe("critter:school-raccoon");
    const talk = play(withPass, "school_raccoon");
    expect(talk.lines).toEqual([
      "Chitter-chitter! Thanks, Fae. My head feels all clear now.",
      "A kid in a purple hood gave me a fizzy cracker. Then I couldn't stop chattering!",
      "I heard that kid whisper a secret word at the tree house in the park: \"Fizzlesticks!\"",
      "A secret password for a tree house club? I have to see this!",
      "The raccoon waves its striped tail and scampers off.",
    ]);
    expect(inkVariable(story, talk.ink, "knows_password")).toBe(true);
    expect(inkVariable(story, talk.ink, "raccoon_waiting")).toBe(false);
    state = { ...state, ink: talk.ink };
    expect(presentCritters(world, state).map((critter) => critter.key))
      .not.toContain("school-raccoon");
  });

  it("the tree house opens with the password and holds a school name tag", () => {
    expect(play(fresh, "tree_house").lines).toEqual([
      "A tree house with a round door and a little sign: CLUB MEMBERS ONLY.",
      "I wonder what the password is.",
    ]);
    const told = play(withPass, "school_raccoon").ink;
    const opened = play(told, "tree_house");
    expect(opened.lines.at(-1))
      .toBe("There's a name tag sewn inside the hood. It's from Cloverhollow School!");
    expect(inkVariable(story, opened.ink, "club_open")).toBe(true);
    expect(play(opened.ink, "tree_house").lines)
      .toEqual(["The club is empty. That purple hood belongs to someone at my school..."]);
  });

  it("the journal notes the password, then the hood", () => {
    const told = play(withPass, "school_raccoon").ink;
    const password = "The hooded kid's club password is \"Fizzlesticks\". " +
      "A club... like the tree house in the park?";
    expect(journalNotes(world, plaza(told))[0]).toBe(password);
    const opened = play(told, "tree_house").ink;
    const notes = journalNotes(world, plaza(opened));
    expect(notes[0])
      .toBe("The purple hood in the tree house has a Cloverhollow School name tag. Whose is it?");
    expect(notes.join(" ")).not.toContain("Fizzlesticks");
  });
});
