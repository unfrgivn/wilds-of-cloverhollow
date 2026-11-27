import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  battleView,
  createState,
  inkVariable,
  journalNotes,
  soundCues,
  step,
  targetInteractable,
  type Battle,
  type Fixture,
  type State,
} from "../../src/core";
import { voiceForSpeaker } from "../../src/platform/voices";
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";

const content = loadContent();
const { world } = content;
const blank = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };

function fixtureOf(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`missing fixture ${name}`);
  return fixture;
}

function press(state: State, key: "confirm" | "cancel" = "confirm"): State {
  const down = step(world, state, { ...blank, [key]: true }).state;
  return step(world, down, blank).state;
}

function runDialogue(start: State, choice = 0): {
  state: State;
  lines: string[];
  choices: string[];
  cues: string[];
} {
  let state = press(start);
  const lines: string[] = [];
  let seenChoices: string[] = [];
  const cues: string[] = [];
  for (let count = 0; count < 80 && state.dialogue !== null; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) {
      const next = press(state);
      cues.push(...soundCues(state, next, world));
      state = next;
      continue;
    }
    if (lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    if (dialogue.choices.length > 0 && seenChoices.length === 0) {
      seenChoices = [...dialogue.choices];
    }
    const next = dialogue.choices.length === 0
      ? press(state)
      : step(world, state, { ...blank, choose: choice }).state;
    cues.push(...soundCues(state, next, world));
    state = next;
  }
  expect(state.dialogue).toBeNull();
  return { state, lines, choices: seenChoices, cues };
}

function battleState(
  critterId: string,
  overrides: Partial<State> = {},
  battleOverrides: Partial<Battle> = {},
): State {
  const critter = world.critters[critterId];
  if (critter === undefined) throw new Error(`missing critter ${critterId}`);
  const base = createState(world, fixtureOf("plaza"));
  const battle: Battle = {
    critterId,
    den: null,
    entry: base.player,
    phase: "command",
    message: critter.lines.command,
    revealed: critter.lines.command.length,
    selected: 0,
    command: null,
    energy: 2,
    calm: 0,
    rest: { play: 2 },
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...battleOverrides,
  };
  return { ...base, ...overrides, battle };
}

describe("Buster character atlas, portrait, voice, and world placement", () => {
  it("registers Buster with 4-frame atlas on disk, adult portrait, and baritone voice", () => {
    const buster = world.characters.buster;
    expect(buster).toEqual({
      atlas: "assets/characters/buster/buster.json",
      idleTicks: [180, 10],
      scale: 0.48,
    });
    expect(existsSync("public/assets/characters/buster/buster.webp")).toBe(true);
    expect(existsSync("public/assets/characters/buster/buster.json")).toBe(true);
    const atlasRaw: unknown = JSON.parse(
      readFileSync("public/assets/characters/buster/buster.json", "utf8"),
    );
    expect(atlasRaw).toMatchObject({
      animations: {
        idle_down: ["down_idle_01", "down_idle_02"],
        idle_left: ["left_idle_01"],
        idle_right: ["right_idle_01"],
      },
      meta: {
        image: "buster.webp",
        size: { w: 1792, h: 448 },
        baseline: 439,
      },
    });

    expect(speakerAccent("Buster")).toBe("town");
    expect(speakerAccent("Bay keeper")).toBe("town");
    expect(speakerAccent("Pass keeper")).toBe("town");
    expect(speakerPortraitSource(world, "Buster")).toEqual({
      atlas: "assets/characters/buster/buster.json",
      frame: "down_idle_01",
      cropMode: "adult",
    });
    expect(speakerPortraitSource(world, "Bay keeper")).toEqual({
      atlas: "assets/characters/bay-keeper/bay-keeper.json",
      frame: "down_idle_01",
      cropMode: "adult",
    });
    expect(speakerPortraitSource(world, "Pass keeper")).toEqual({
      atlas: "assets/characters/pass-keeper/pass-keeper.json",
      frame: "down_idle_01",
      cropMode: "adult",
    });

    const busterVoice = voiceForSpeaker("Buster");
    expect(busterVoice.wave).toBe("triangle");
    expect(busterVoice.notes[0]).toBeLessThan(260);
    expect(busterVoice).not.toEqual(voiceForSpeaker("Dad"));
    expect(voiceForSpeaker("Bay keeper")).not.toEqual(voiceForSpeaker("Pass keeper"));
  });

  it("places Buster in plaza and living shopkeeper NPCs in Bubblegum Bay and Pinecone Pass", () => {
    const plaza = world.areas.plaza;
    const bay = world.areas.bay;
    const pass = world.areas.pass;
    if (plaza === undefined || bay === undefined || pass === undefined) {
      throw new Error("missing expected areas");
    }

    expect(plaza.npcs.find((npc) => npc.id === "buster")).toMatchObject({
      knot: "buster",
      prompt: "Talk",
      facing: "down",
      point: { x: 515, y: 780 },
    });
    expect(bay.interactables.find((item) => item.id === "bay-souvenirs")).toBeUndefined();
    expect(bay.npcs.find((npc) => npc.id === "bay-keeper")).toMatchObject({
      knot: "bay_souvenirs",
      prompt: "Talk",
      facing: "down",
      point: { x: 785, y: 455 },
    });
    expect(pass.interactables.find((item) => item.id === "pass-souvenirs")).toBeUndefined();
    expect(pass.npcs.find((npc) => npc.id === "pass-keeper")).toMatchObject({
      knot: "pass_souvenirs",
      prompt: "Talk",
      facing: "down",
      point: { x: 1190, y: 910 },
    });

    const atBuster: State = {
      ...createState(world, fixtureOf("plaza")),
      player: { x: 515, y: 835 },
      facing: "up",
    };
    expect(targetInteractable(world, atBuster)?.id).toBe("npc:buster");

    const atBayKeeper: State = {
      ...createState(world, fixtureOf("bay")),
      player: { x: 785, y: 505 },
      facing: "up",
    };
    expect(targetInteractable(world, atBayKeeper)?.id).toBe("npc:bay-keeper");

    const atPassKeeper: State = {
      ...createState(world, fixtureOf("pass")),
      player: { x: 1190, y: 955 },
      facing: "up",
    };
    expect(targetInteractable(world, atPassKeeper)?.id).toBe("npc:pass-keeper");
  });
});

describe("Buster's Star-Line Stamp Card errand and regional souvenir stands", () => {
  it("runs the full stamp card loop, souvenir treat purchases, rewards, journal, and chest", () => {
    const startPlaza: State = {
      ...createState(world, fixtureOf("plaza")),
      player: { x: 515, y: 835 },
      facing: "up",
      coins: 20,
      snacks: 1,
    };
    expect(inkVariable(world.story, startPlaza.ink, "buster_quest")).toBe(false);

    // 1. Meet Buster and receive the Star-Line Stamp Card.
    const intro = runDialogue(startPlaza);
    expect(intro.lines.some((line) => line.includes("Star-Line Stamp Card"))).toBe(true);
    expect(inkVariable(world.story, intro.state.ink, "buster_quest")).toBe(true);
    expect(inkVariable(world.story, intro.state.ink, "buster_reward")).toBe(false);
    expect(journalNotes(world, intro.state)[0]).toContain("Star-Line Stamp Card");

    // 2. Revisit before either stamp -> reminder with both stamps remaining.
    const beforeStamps = runDialogue(intro.state);
    expect(beforeStamps.lines.some((line) => line.includes("two empty star squares"))).toBe(true);

    // 3. Visit Bubblegum Bay shopkeeper when short on coins -> still stamps card free!
    const atBayShort: State = {
      ...beforeStamps.state,
      area: "bay",
      player: { x: 785, y: 505 },
      facing: "up",
      coins: 5,
    };
    const bayShort = runDialogue(atBayShort);
    expect(inkVariable(world.story, bayShort.state.ink, "stamp_bay")).toBe(true);
    expect(bayShort.lines.some((line) => line.includes("wave stamp"))).toBe(true);
    expect(bayShort.lines.some((line) => line.includes("9 coins"))).toBe(true);
    expect(bayShort.state.coins).toBe(5);
    expect(bayShort.state.treats).toBeUndefined();

    // 4. Buy Sea-Salt Taffy at Bubblegum Bay stand with 20 coins.
    const bayBuy = runDialogue({ ...bayShort.state, coins: 20 }, 0);
    expect(bayBuy.choices).toEqual(["Buy Sea-Salt Taffy (9 coins)", "Not now"]);
    expect(bayBuy.state.coins).toBe(11);
    expect(bayBuy.state.treats).toEqual({ "sea-salt-taffy": 1 });
    expect(bayBuy.cues).toContain("item");

    // 5. Check Buster mid-errand progress & journal after Bay stamp only.
    const midBuster = runDialogue({
      ...bayBuy.state,
      area: "plaza",
      player: { x: 515, y: 835 },
      facing: "up",
    });
    expect(midBuster.lines.some((line) => line.includes("Bubblegum Bay wave stamp"))).toBe(true);
    expect(journalNotes(world, midBuster.state)[0]).toContain("Pinecone Pass");

    // 6. Visit Pinecone Pass shopkeeper when short on coins -> still stamps card free!
    const atPassShort: State = {
      ...midBuster.state,
      area: "pass",
      player: { x: 1190, y: 955 },
      facing: "up",
      coins: 10,
    };
    const passShort = runDialogue(atPassShort);
    expect(inkVariable(world.story, passShort.state.ink, "stamp_pass")).toBe(true);
    expect(passShort.lines.some((line) => line.includes("pine stamp"))).toBe(true);
    expect(passShort.lines.some((line) => line.includes("11 coins"))).toBe(true);
    expect(passShort.state.coins).toBe(10);

    // 7. Buy Maple Pine Brittle at Pinecone Pass stand with 11 coins.
    const passBuy = runDialogue({ ...passShort.state, coins: 11 }, 0);
    expect(passBuy.choices).toEqual(["Buy Maple Pine Brittle (11 coins)", "Not now"]);
    expect(passBuy.state.coins).toBe(0);
    expect(passBuy.state.treats).toEqual({
      "sea-salt-taffy": 1,
      "maple-brittle": 1,
    });
    expect(passBuy.cues).toContain("item");
    expect(journalNotes(world, passBuy.state)[0]).toContain("Both stamps");

    // 8. Return to Buster -> claim +25 coins, +2 snacks, and Golden Star-Line Whistle!
    const complete = runDialogue({
      ...passBuy.state,
      area: "plaza",
      player: { x: 515, y: 835 },
      facing: "up",
    });
    expect(inkVariable(world.story, complete.state.ink, "buster_reward")).toBe(true);
    expect(complete.state.coins).toBe(25);
    expect(complete.state.snacks).toBe(3);
    expect(complete.lines.some((line) => line.includes("Golden Star-Line Whistle"))).toBe(true);
    expect(journalNotes(world, complete.state)[0]).toContain("Golden Star-Line Whistle");

    // 9. Post-reward revisit gives celebratory banter without double-gifting.
    const revisit = runDialogue(complete.state);
    expect(revisit.state.coins).toBe(25);
    expect(revisit.state.snacks).toBe(3);
    expect(revisit.lines.some((line) => line.includes("Star-Line Explorer"))).toBe(true);

    // 10. Clubhouse keepsake chest displays Buster's Golden Star-Line Whistle.
    const chestCheck: State = {
      ...complete.state,
      area: "clubhouse",
      player: { x: 410, y: 480 },
      facing: "up",
      ink: complete.state.ink.replace(
        "\"buster_reward\":true",
        "\"buster_reward\":true,\"has_chest\":true",
      ),
    };
    expect(targetInteractable(world, chestCheck)?.id).toBe("chest");
    const chestTalk = runDialogue(chestCheck);
    expect(chestTalk.lines.some((line) => line.includes("Buster's Golden Star-Line Whistle"))).toBe(
      true,
    );
  });

  it("applies Favourite Treat battle bonuses for Sea-Salt Taffy and Maple Pine Brittle", () => {
    const coastal = battleState(
      "crab",
      { snacks: 0, treats: { "sea-salt-taffy": 1 }, stickers: ["sandy-crab"] },
      { selected: 2, energy: 1, calm: 10 },
    );
    const coastalTray = press(coastal);
    expect(battleView(world, coastalTray)?.treatTray?.items[0]).toMatchObject({
      id: "sea-salt-taffy",
      favourite: true,
    });
    const coastalUsed = step(world, coastalTray, { ...blank, choose: 0 }).state;
    expect(coastalUsed.battle?.energy).toBe(3);
    expect(coastalUsed.battle?.calm).toBe(60);
    expect(coastalUsed.battle?.message).toContain("Sea-Salt Taffy! Their seaside favourite!");

    const mountain = battleState(
      "crystal-mole",
      { snacks: 0, treats: { "maple-brittle": 1 }, stickers: ["gem-mole"] },
      { selected: 2, energy: 1, calm: 10 },
    );
    const mountainTray = press(mountain);
    expect(battleView(world, mountainTray)?.treatTray?.items[0]).toMatchObject({
      id: "maple-brittle",
      favourite: true,
    });
    const mountainUsed = step(world, mountainTray, { ...blank, choose: 0 }).state;
    expect(mountainUsed.battle?.energy).toBe(4);
    expect(mountainUsed.battle?.calm).toBe(65);
    expect(mountainUsed.battle?.message).toContain("Maple Pine Brittle! Their mountain favourite!");
  });
});
