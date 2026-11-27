import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  inkVariable,
  journalNotes,
  setInkVariables,
  startDialogue,
  step,
  type State,
} from "../../src/core";

const { world, fixtures } = loadContent();

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink =
    Object.keys(variables).length > 0 ? setInkVariables(base.ink, variables) : base.ink;
  return { ...base, ink, ...overrides };
}

function stickersFor(critterIds: readonly string[]): string[] {
  return critterIds.map((id) => {
    const kind = world.critters[id];
    if (kind === undefined) throw new Error(`Missing critter ${id}`);
    return kind.sticker.id;
  });
}

type PlayedDialogue = {
  state: State;
  lines: Array<{ speaker: string | null; text: string; sound?: string }>;
  choicesSeen: string[][];
};

function playDialogue(
  initial: State,
  knot: string,
  choices: readonly number[] = [],
): PlayedDialogue {
  let state = startDialogue(world, initial, knot);
  const lines: Array<{ speaker: string | null; text: string; sound?: string }> = [];
  const choicesSeen: string[][] = [];
  let choiceCursor = 0;

  const recordLine = (current: State): void => {
    if (current.dialogue === null) return;
    lines.push({
      speaker: current.dialogue.speaker,
      text: current.dialogue.text,
      ...(current.dialogue.sound === undefined ? {} : { sound: current.dialogue.sound }),
    });
  };

  recordLine(state);

  for (let guard = 0; guard < 40 && state.dialogue !== null; guard += 1) {
    // Finish revealing the current line immediately, then release confirm.
    if (state.dialogue.revealed < state.dialogue.text.length) {
      state = step(world, state, { ...blankInput(), confirm: true }).state;
      state = step(world, state, blankInput()).state;
    }
    if (state.dialogue === null) break;

    if (state.dialogue.choices.length > 0) {
      choicesSeen.push([...state.dialogue.choices]);
      const pick = choices[choiceCursor];
      if (pick === undefined) break;
      choiceCursor += 1;
      state = step(world, state, { ...blankInput(), choose: pick }).state;
      state = step(world, state, blankInput()).state;
      recordLine(state);
      continue;
    }

    state = step(world, state, { ...blankInput(), confirm: true }).state;
    state = step(world, state, blankInput()).state;
    recordLine(state);
  }

  return { state, lines, choicesSeen };
}

describe("Milestone 94: Nurse Holly's Clinic Care", () => {
  it("keeps the pre-hall-pass path identical", () => {
    const fib = playDialogue(stateIn("school"), "nurse", [0]);
    expect(fib.lines.map((line) => line.text)).toEqual([
      "Hi Fae! Is everything all right?",
      "Hmm. Your tummy sounds happy to me. Fibbing isn't very kind, Fae.",
    ]);
    expect(inkVariable(world.story, fib.state.ink, "hall_pass")).toBe(false);

    const help = playDialogue(fib.state, "nurse", [1]);
    expect(help.lines.map((line) => line.text)).toEqual([
      "Hi Fae! Is everything all right?",
      "Oh, you're a star! Could you take this note to the front office?",
      "Here's a hall pass, so nobody stops you on the way.",
    ]);
    expect(inkVariable(world.story, help.state.ink, "hall_pass")).toBe(true);
    expect(inkVariable(world.story, help.state.ink, "raccoon_waiting")).toBe(true);
  });

  it("offers a free +2 snack refill when hall_pass is true and snacks < 2", () => {
    const lowSnacks = stateIn("school", { snacks: 0 }, { hall_pass: true });

    const accepted = playDialogue(lowSnacks, "nurse", [0]);
    expect(accepted.choicesSeen).toEqual([
      ["Take a cozy apple juice & cracker pack (free)", "I'm feeling great, thanks!"],
    ]);
    expect(accepted.state.snacks).toBe(2);
    expect(accepted.lines.every((line) => line.speaker === "Nurse Holly")).toBe(true);
    expect(accepted.lines.some((line) => line.sound === "chime-green")).toBe(true);
    expect(accepted.lines.at(-1)?.text).toContain("apple-juice snacks");

    // Also works when snacks === 1 and when declined.
    const oneSnack = stateIn("school", { snacks: 1 }, { hall_pass: true });
    const declined = playDialogue(oneSnack, "nurse", [1]);
    expect(declined.state.snacks).toBe(1);
    expect(declined.lines.at(-1)?.text).toContain("Drink plenty of water");
  });

  it("shows stocked-backpack check-in when snacks >= 2 and reacts to story milestones", () => {
    const base = stateIn("school", { snacks: 2 }, { hall_pass: true });
    const defaultCheck = playDialogue(base, "nurse");
    expect(defaultCheck.choicesSeen).toEqual([]);
    expect(defaultCheck.lines.map((line) => line.text)).toEqual([
      "Thanks again for delivering that note, Fae! " +
        "My clinic door is always open if you need a breather.",
      "Your backpack's already stocked with snacks! Come see me anytime you run low, Fae.",
    ]);
    expect(defaultCheck.lines.some((line) => line.text.includes("Milo"))).toBe(false);

    const busyDay = playDialogue(
      stateIn("school", { snacks: 2 }, { hall_pass: true, has_flute: true }),
      "nurse",
    );
    expect(busyDay.lines[0]?.text).toContain("busy day across the school halls");

    const artOpen = playDialogue(
      stateIn("school", { snacks: 2 }, { hall_pass: true, art_open: true }),
      "nurse",
    );
    expect(artOpen.lines[0]?.text).toContain("busy day across the school halls");

    const schoolBase = stateIn("school");
    const principalCalmed = playDialogue(
      stateIn(
        "school",
        {
          snacks: 2,
          stickers: stickersFor(["principal"]),
          critters: { ...schoolBase.critters, principal: "calm" },
        },
        { hall_pass: true, has_flute: true },
      ),
      "nurse",
    );
    expect(principalCalmed.lines[0]?.text).toContain("Mr. Bell");
    expect(principalCalmed.lines[0]?.text).toContain("megaphone");

    const miloRevealed = playDialogue(
      stateIn(
        "school",
        {
          snacks: 2,
          stickers: stickersFor(["principal"]),
          critters: { ...schoolBase.critters, principal: "calm" },
        },
        { hall_pass: true, milo_revealed: true },
      ),
      "nurse",
    );
    expect(miloRevealed.lines[0]?.text).toContain("Milo");
  });
});

describe("Milestone 94: Bubblegum Bay Boat Rental (bay-boats)", () => {
  it("registers bay-boats at (1350, 650) in bay.json", () => {
    const bay = world.areas.bay;
    if (bay === undefined) throw new Error("Missing bay area");
    const boats = bay.interactables.find((item) => item.id === "bay-boats");
    expect(boats).toEqual({
      id: "bay-boats",
      knot: "bay_boats",
      point: { x: 1350, y: 650 },
      prompt: "Look",
    });
  });

  it("awards +10 coins and a Journal note on the first sunny cove cruise once", () => {
    const start = stateIn("bay", { coins: 5 });

    // Declining keeps state untouched.
    const stayed = playDialogue(start, "bay_boats", [1]);
    expect(stayed.state.coins).toBe(5);
    expect(inkVariable(world.story, stayed.state.ink, "bay_boat_charm")).toBe(false);
    const stayedNotes = journalNotes(world, stayed.state);
    expect(stayedNotes.some((note) => note.includes("Sea-Glass Clover"))).toBe(false);

    // First cruise with Maddie alone -> +10 coins, chime-blue, bay_boat_charm = true, Journal note.
    const first = playDialogue(start, "bay_boats", [0]);
    expect(first.state.coins).toBe(15);
    expect(inkVariable(world.story, first.state.ink, "bay_boat_charm")).toBe(true);
    expect(first.lines.some((line) => line.sound === "chime-blue")).toBe(true);
    expect(first.lines.some((line) => line.text.includes("Maddie"))).toBe(true);
    expect(journalNotes(world, first.state)).toContain(
      "I took a pastel rowboat out across Bubblegum Bay and found a shimmering Sea-Glass Clover!",
    );

    // Revisit cruise with Sue, Jordan, and Pond Pup -> reactive banter and NO extra coins.
    const crewState: State = {
      ...first.state,
      ink: setInkVariables(first.state.ink, {
        sue_joined: true,
        jordan_joined: true,
        pup_with_me: true,
      }),
    };
    const revisit = playDialogue(crewState, "bay_boats", [0]);
    expect(revisit.state.coins).toBe(15);
    expect(revisit.lines.some((line) => line.speaker === "Sue")).toBe(true);
    expect(revisit.lines.some((line) => line.speaker === "Jordan")).toBe(true);
    expect(revisit.lines.some((line) => line.text.includes("Pond Pup"))).toBe(true);
    expect(revisit.lines.at(-1)?.text).toContain("minnows");
  });
});

describe("Milestone 94: Pinecone Pass Wildlife Sanctuary (pass-sanctuary)", () => {
  const allSanctuarySpecies = [
    "hamster",
    "penguin",
    "owl",
    "squirrel",
    "lamb",
    "hedgehog",
    "bat",
    "crystal-mole",
  ] as const;

  it("registers pass-sanctuary at (1400, 640) in pass.json", () => {
    const pass = world.areas.pass;
    if (pass === undefined) throw new Error("Missing pass area");
    const board = pass.interactables.find((item) => item.id === "pass-sanctuary");
    expect(board).toEqual({
      id: "pass-sanctuary",
      knot: "pass_sanctuary",
      point: { x: 1400, y: 640 },
      prompt: "Look",
    });
  });

  it("tallies calmed mountain & woodland critters dynamically and awards the basket at 3+", () => {
    // 0 of 8 -> shows progress hint, no gift.
    const none = playDialogue(stateIn("pass", { coins: 4, snacks: 1 }), "pass_sanctuary");
    expect(none.lines.some((line) => line.text.includes("0 of 8"))).toBe(true);
    expect(none.lines.at(-1)?.text).toContain("Calm 3 mountain or woodland critters");
    expect(none.state.coins).toBe(4);
    expect(none.state.snacks).toBe(1);
    expect(inkVariable(world.story, none.state.ink, "sanctuary_gift")).toBe(false);

    // 2 of 8 -> still under 3, no gift.
    const two = playDialogue(
      stateIn("pass", { coins: 4, snacks: 1, stickers: stickersFor(["hamster", "penguin"]) }),
      "pass_sanctuary",
    );
    expect(two.lines.some((line) => line.text.includes("2 of 8"))).toBe(true);
    expect(two.state.coins).toBe(4);
    expect(two.state.snacks).toBe(1);
    expect(inkVariable(world.story, two.state.ink, "sanctuary_gift")).toBe(false);

    // 3 of 8 -> Sanctuary Ranger Basket: +12 coins, +2 snacks, chime-yellow, Journal note!
    const threeStart = stateIn("pass", {
      coins: 4,
      snacks: 1,
      stickers: stickersFor(["hamster", "penguin", "owl"]),
    });
    const three = playDialogue(threeStart, "pass_sanctuary");
    expect(three.lines.some((line) => line.text.includes("3 of 8"))).toBe(true);
    expect(three.state.coins).toBe(16);
    expect(three.state.snacks).toBe(3);
    expect(three.lines.some((line) => line.sound === "chime-yellow")).toBe(true);
    expect(inkVariable(world.story, three.state.ink, "sanctuary_gift")).toBe(true);
    expect(journalNotes(world, three.state)).toContain(
      "The Pinecone Pass Wildlife Sanctuary rangers left me a cozy thank-you basket " +
        "for helping calm the valley's mountain and woodland critters!",
    );

    // Revisit after receiving basket -> no double rewards.
    const revisitThree = playDialogue(three.state, "pass_sanctuary");
    expect(revisitThree.state.coins).toBe(16);
    expect(revisitThree.state.snacks).toBe(3);
    expect(revisitThree.lines.some((line) => line.text.includes("fresh snowy pawprints"))).toBe(
      true,
    );

    // 8 of 8 -> full valley celebration line!
    const allEightState: State = {
      ...three.state,
      stickers: stickersFor(allSanctuarySpecies),
    };
    const fullCelebration = playDialogue(allEightState, "pass_sanctuary");
    expect(fullCelebration.lines.some((line) => line.text.includes("8 of 8"))).toBe(true);
    expect(
      fullCelebration.lines.some((line) =>
        line.text.includes("All eight mountain and woodland friends"),
      ),
    ).toBe(true);
  });
});
