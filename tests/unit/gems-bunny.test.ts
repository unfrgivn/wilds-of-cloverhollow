import { describe, expect, it } from "vitest";
import battleJson from "../../content/battle.json";
import {
  STAR_GEM_VARIABLES,
  battleView,
  blankInput,
  createState,
  journalNotes,
  runInk,
  soundCues,
  starGemsFound,
  startDialogue,
  step,
  type Battle,
  type State,
} from "../../src/core";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { loadContent, parseBattleContent } from "../../src/content/load";
import { inkFacts } from "../../src/core/sim";

const { world, fixtures } = loadContent();

function withVars(base: State, flags: Record<string, boolean>): State {
  const saved: unknown = JSON.parse(base.ink);
  if (
    typeof saved !== "object" || saved === null || !("variablesState" in saved) ||
    typeof saved.variablesState !== "object" || saved.variablesState === null
  )
    throw new Error("missing ink variablesState");
  const variables: Record<string, unknown> = { ...saved.variablesState };
  for (const [key, value] of Object.entries(flags)) {
    if (world.storyVariable(base.ink, key) === undefined)
      throw new Error(`unknown ink variable ${key}`);
    variables[key] = value;
  }
  return { ...base, ink: JSON.stringify({ ...saved, variablesState: variables }) };
}

function playKnot(
  initial: State,
  knot: string,
  choices: number[] = [],
): { state: State; lines: string[]; choiceSets: string[][]; sounds: string[] } {
  let state = startDialogue(world, initial, knot);
  const lines: string[] = [];
  const choiceSets: string[][] = [];
  const sounds: string[] = [];
  const queue = [...choices];
  let lastText = "";
  for (let tick = 0; tick < 800 && state.dialogue !== null; tick += 1) {
    const d = state.dialogue;
    if (d.text !== lastText && d.text.length > 0) {
      lines.push(d.text);
      lastText = d.text;
    }
    if (d.sound !== undefined && sounds.at(-1) !== d.sound) sounds.push(d.sound);
    if (d.revealed < d.text.length) {
      state = step(world, state, { ...blankInput(), confirm: tick % 2 === 1 }).state;
      continue;
    }
    if (d.choices.length > 0) {
      choiceSets.push([...d.choices]);
      const pick = queue.shift();
      if (pick === undefined) break;
      const before = state;
      state = step(world, state, { ...blankInput(), choose: pick }).state;
      if (state.dialogue?.text === before.dialogue?.text) lastText = "";
      continue;
    }
    state = step(world, state, { ...blankInput(), confirm: tick % 2 === 1 }).state;
  }
  return { state, lines, choiceSets, sounds };
}

function commandBattle(
  fixtureName: string,
  critterId: string,
  overrides: Partial<Battle> = {},
  flags: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`missing fixture ${fixtureName}`);
  const base = withVars(createState(world, fixture), flags);
  const critter = world.critters[critterId];
  if (critter === undefined) throw new Error(`missing critter ${critterId}`);
  const battle: Battle = {
    critterId,
    den: null,
    entry: base.player,
    phase: "command",
    calm: 0,
    energy: critter.energyMax,
    selected: 0,
    command: null,
    turn: 1,
    rest: {},
    message: critter.lines.command,
    revealed: critter.lines.command.length,
    check: null,
    feelings: [critter.feelings[0] ?? "zoomy", critter.feelings[0] ?? "zoomy"],
    answered: false,
    lanternPeek: false,
    windUp: null,
    lastGrade: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
  return { ...base, battle };
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`expected object for ${label}`);
  return Object.fromEntries(Object.entries(value));
}

describe("Ribbon Bunny: 3rd flute friend", () => {
  it("registers ribbon-bunny last in world.party and fits 6-member spawns in all 23 areas", () => {
    expect(Object.keys(world.party)).toEqual([
      "maddie", "sue", "jordan", "pond-pup", "acorn-squirrel", "ribbon-bunny",
    ]);
    expect(world.party["ribbon-bunny"]).toMatchObject({
      id: "ribbon-bunny",
      name: "Ribbon Bunny",
      atlas: "assets/characters/ribbon-bunny/ribbon-bunny.json",
      box: { width: 40, height: 56 },
      walkCycleUnits: 72,
      sits: true,
      start: false,
      joins: "bunny_with_me",
      befriended: "bunny_friend",
      flute: true,
      critter: "bunny",
      command: null,
    });
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
  });

  it("befriends Ribbon Bunny in either order, hints with no snacks, and calls via flute", () => {
    const fresh = createState(world, fixtures["new-game"]!);
    const withFlute = withVars({ ...fresh, snacks: 2 }, { has_flute: true });

    // First talk tells her tale without bonding choices.
    const first = playKnot(withFlute, "bunny_calm");
    expect(first.lines[0]).toContain("hopping in circles");
    expect(world.storyVariable(first.state.ink, "bunny_friend")).toBe(false);

    // Order A: smooth ribbon first, then share snack.
    const orderA = playKnot(first.state, "bunny_calm", [0, 0]);
    expect(world.storyVariable(orderA.state.ink, "bunny_petted")).toBe(true);
    expect(world.storyVariable(orderA.state.ink, "bunny_fed")).toBe(true);
    expect(world.storyVariable(orderA.state.ink, "bunny_friend")).toBe(true);
    expect(orderA.state.snacks).toBe(1);

    // Revisit greets Fae as an old friend.
    const revisit = playKnot(orderA.state, "bunny_calm");
    expect(revisit.lines[0]).toContain("old friends");

    // Order B: share snack first, then smooth ribbon.
    const orderB = playKnot(first.state, "bunny_calm", [1, 0]);
    expect(world.storyVariable(orderB.state.ink, "bunny_friend")).toBe(true);

    // Zero snacks hints where to get them without marking fed.
    const noSnacks = playKnot({ ...first.state, snacks: 0 }, "bunny_calm", [1]);
    expect(noSnacks.lines.some((line) => line.includes("bakery"))).toBe(true);
    expect(world.storyVariable(noSnacks.state.ink, "bunny_fed")).toBe(false);

    // Flute choices remain 100% unchanged when bunny_friend is false.
    const pupAndSquirrel = withVars(fresh, {
      has_flute: true, pup_friend: true, squirrel_friend: true,
    });
    const withoutBunny = playKnot(pupAndSquirrel, "flute", [2]);
    expect(withoutBunny.choiceSets[0]).toEqual([
      "Call the Pond Pup", "Call the Acorn Squirrel", "Just play",
    ]);

    // Flute calls and sends Ribbon Bunny home cleanly.
    const callBunny = playKnot(orderA.state, "flute", [0]);
    expect(callBunny.choiceSets[0]).toEqual(["Call Ribbon Bunny", "Just play"]);
    expect(world.storyVariable(callBunny.state.ink, "bunny_with_me")).toBe(true);
    expect(callBunny.state.party.map((member) => member.id)).toContain("ribbon-bunny");

    const sendHome = playKnot(callBunny.state, "flute", [0]);
    expect(sendHome.choiceSets[0]).toEqual(["Send Ribbon Bunny home", "Just play"]);
    expect(world.storyVariable(sendHome.state.ink, "bunny_with_me")).toBe(false);
    expect(sendHome.state.party.map((member) => member.id)).not.toContain("ribbon-bunny");
  });

  it("assists in battle with +15 calm and +1 Together star, alone or combined", () => {
    const soloBunny = commandBattle(
      "plaza-party",
      "fountain-frog",
      { calm: 20, sparkle: 1 },
      { has_flute: true, bunny_friend: true },
    );
    expect(battleView(world, soloBunny)?.fluteAssist).toEqual({
      available: true,
      label: "Ribbon Bunny",
      kind: "bunny",
    });
    const called = step(world, soloBunny, { ...blankInput(), flute: true }).state;
    expect(called.battle?.calm).toBe(35);
    expect(called.battle?.sparkle).toBe(2);
    expect(called.battle?.fluteUsed).toBe(true);
    expect(called.battle?.message).toBe(world.battle.fluteAssist.lines.bunny);
    expect(soundCues(soloBunny, called, world)).toContain("flute");
    expect(battleView(world, called)?.fluteAssist?.available).toBe(false);

    // Clamps sparkle charge to chargeMax.
    const atCap = commandBattle(
      "plaza-party",
      "fountain-frog",
      { calm: 10, sparkle: world.battle.together.chargeMax },
      { has_flute: true, bunny_friend: true },
    );
    const calledCap = step(world, atCap, { ...blankInput(), flute: true }).state;
    expect(calledCap.battle?.sparkle).toBe(world.battle.together.chargeMax);

    // Combined with Pup & Squirrel: +40 calm, +1 energy, +1 soften, +1 sparkle.
    const allThree = commandBattle(
      "plaza-party",
      "gull",
      { calm: 10, energy: 4, sparkle: 0 },
      { has_flute: true, pup_friend: true, squirrel_friend: true, bunny_friend: true },
    );
    expect(battleView(world, allThree)?.fluteAssist).toEqual({
      available: true,
      label: "Flute Friends",
      kind: "all",
    });
    const calledAll = step(world, allThree, { ...blankInput(), flute: true }).state;
    expect(calledAll.battle?.calm).toBe(50);
    expect(calledAll.battle?.energy).toBe(5);
    expect(calledAll.battle?.burstSoften).toBe(1);
    expect(calledAll.battle?.sparkle).toBe(1);
    expect(calledAll.battle?.message).toBe(world.battle.fluteAssist.lines.all);

    // Pup + Bunny and Squirrel + Bunny combos.
    const pupBunny = commandBattle(
      "plaza-party", "gull", { calm: 10 },
      { has_flute: true, pup_friend: true, bunny_friend: true },
    );
    expect(battleView(world, pupBunny)?.fluteAssist?.kind).toBe("pupBunny");
    expect(step(world, pupBunny, { ...blankInput(), flute: true }).state.battle?.message)
      .toBe(world.battle.fluteAssist.lines.pupBunny);

    const sqBunny = commandBattle(
      "plaza-party", "gull", { calm: 10, energy: 4 },
      { has_flute: true, squirrel_friend: true, bunny_friend: true },
    );
    expect(battleView(world, sqBunny)?.fluteAssist?.kind).toBe("squirrelBunny");
    expect(step(world, sqBunny, { ...blankInput(), flute: true }).state.battle?.message)
      .toBe(world.battle.fluteAssist.lines.squirrelBunny);
  });

  it("validates Ribbon Bunny fields in parseBattleContent", () => {
    const base = asObject(battleJson, "battle.json");
    const assist = asObject(base.fluteAssist, "fluteAssist");
    const lines = asObject(assist.lines, "fluteAssist.lines");
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, bunnyCalm: 0 },
    }, "b.json")).toThrow(/fluteAssist\.bunnyCalm/);
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, bunnyTogether: 0 },
    }, "b.json")).toThrow(/fluteAssist\.bunnyTogether/);
    expect(() => parseBattleContent({
      ...base, fluteAssist: { ...assist, lines: { ...lines, all: "" } },
    }, "b.json")).toThrow(/fluteAssist\.lines\.all/);
  });
});

describe("Collectible Star Gems across all 7 regions", () => {
  it("gates and awards all 7 Star Gems with coins, chimes, and pure starGemsFound count", () => {
    const fresh = createState(world, fixtures["new-game"]!);
    expect(starGemsFound(world, fresh)).toEqual({ found: 0, total: 7 });
    expect(STAR_GEM_VARIABLES).toHaveLength(7);

    // 1. Meadow Park glow (blacklight lantern)
    expect(world.areas.park?.glows.some((g) => g.id === "park-gem-glow" && g.knot === "park_gem"))
      .toBe(true);
    const parkRes = playKnot(fresh, "park_gem");
    expect(world.storyVariable(parkRes.state.ink, "gem_park")).toBe(true);
    expect(parkRes.state.coins).toBe(5);
    expect(parkRes.sounds).toContain("chime-blue");

    // 2. Bubblegum Bay tide pool (Pond Pup)
    const bayLocked = playKnot(fresh, "bay_gem");
    expect(world.storyVariable(bayLocked.state.ink, "gem_bay")).toBe(false);
    const bayUnlocked = playKnot(withVars(fresh, { pup_with_me: true }), "bay_gem", [0]);
    expect(world.storyVariable(bayUnlocked.state.ink, "gem_bay")).toBe(true);
    expect(bayUnlocked.state.coins).toBe(5);
    expect(bayUnlocked.sounds).toContain("chime-blue");

    // 3. Cliffside Trail burrow (Ribbon Bunny)
    const trailLocked = playKnot(fresh, "trail_gem");
    expect(world.storyVariable(trailLocked.state.ink, "gem_trail")).toBe(false);
    const trailUnlocked = playKnot(withVars(fresh, { bunny_with_me: true }), "trail_gem", [0]);
    expect(world.storyVariable(trailUnlocked.state.ink, "gem_trail")).toBe(true);
    expect(trailUnlocked.state.coins).toBe(5);
    expect(trailUnlocked.sounds).toContain("chime-yellow");

    // 4. Pinecone Pass snow pine branch (Coach Ash's lasso)
    const passLocked = playKnot(fresh, "pass_gem");
    expect(world.storyVariable(passLocked.state.ink, "gem_pass")).toBe(false);
    const passUnlocked = playKnot(withVars(fresh, { has_lasso: true }), "pass_gem", [0]);
    expect(world.storyVariable(passUnlocked.state.ink, "gem_pass")).toBe(true);
    expect(passUnlocked.state.coins).toBe(5);
    expect(passUnlocked.sounds).toContain("chime-blue");

    // 5. Crystal Cavern glow (blacklight lantern)
    expect(
      world.areas.cavern?.glows.some((g) => g.id === "cavern-gem-glow" && g.knot === "cavern_gem"),
    ).toBe(true);
    const cavernRes = playKnot(fresh, "cavern_gem");
    expect(world.storyVariable(cavernRes.state.ink, "gem_cavern")).toBe(true);
    expect(cavernRes.state.coins).toBe(5);
    expect(cavernRes.sounds).toContain("chime-red");

    // 6. Whispering Woods mossy tree hollow (Acorn Squirrel)
    const woodsLocked = playKnot(fresh, "woods_gem");
    expect(world.storyVariable(woodsLocked.state.ink, "gem_woods")).toBe(false);
    const woodsUnlocked = playKnot(withVars(fresh, { squirrel_with_me: true }), "woods_gem", [0]);
    expect(world.storyVariable(woodsUnlocked.state.ink, "gem_woods")).toBe(true);
    expect(woodsUnlocked.state.coins).toBe(5);
    expect(woodsUnlocked.sounds).toContain("chime-yellow");

    // 7. Clover Hills meadow burrow (Ribbon Bunny)
    const hillsLocked = playKnot(fresh, "hills_gem");
    expect(world.storyVariable(hillsLocked.state.ink, "gem_hills")).toBe(false);
    const hillsUnlocked = playKnot(withVars(fresh, { bunny_with_me: true }), "hills_gem", [0]);
    expect(world.storyVariable(hillsUnlocked.state.ink, "gem_hills")).toBe(true);
    expect(hillsUnlocked.state.coins).toBe(5);
    expect(hillsUnlocked.sounds).toContain("chime-green");

    // Zero Milo mentions across all 7 Star Gem knots & Ribbon Bunny bonding.
    const allLines = [
      ...parkRes.lines, ...bayUnlocked.lines, ...trailUnlocked.lines,
      ...passUnlocked.lines, ...cavernRes.lines, ...woodsUnlocked.lines, ...hillsUnlocked.lines,
    ];
    for (const line of allLines) expect(line).not.toMatch(/milo/i);
  });

  it("awards Barnaby's 3-gem and 7-gem rewards, club_chest geode, and journal notes", () => {
    const fresh = createState(world, fixtures["new-game"]!);

    // 1 gem: praises progress without reward.
    const oneGem = withVars(fresh, { gem_park: true });
    expect(starGemsFound(world, oneGem)).toEqual({ found: 1, total: 7 });
    const talk1 = playKnot(oneGem, "barnaby");
    expect(talk1.lines.some((line) => line.includes("1 of 7 Star Gems"))).toBe(true);
    expect(talk1.state.coins).toBe(0);
    expect(journalNotes(world, oneGem).some((note) => note.includes("1 of Cloverhollow's 7")))
      .toBe(true);

    // 3 gems: +15 coins and chime-yellow.
    const threeGems = withVars(fresh, { gem_park: true, gem_bay: true, gem_trail: true });
    expect(starGemsFound(world, threeGems)).toEqual({ found: 3, total: 7 });
    const talk3 = playKnot(threeGems, "barnaby");
    expect(world.storyVariable(talk3.state.ink, "gem_reward_3")).toBe(true);
    expect(talk3.state.coins).toBe(15);
    expect(talk3.sounds).toContain("chime-yellow");

    // All 7 gems: +50 coins, +2 snacks, chime-red, Rainbow Star Geode in club_chest & journal.
    const allGems = withVars(fresh, {
      gem_park: true, gem_bay: true, gem_trail: true, gem_pass: true,
      gem_cavern: true, gem_woods: true, gem_hills: true, has_chest: true, bunny_friend: true,
    });
    expect(starGemsFound(world, allGems)).toEqual({ found: 7, total: 7 });
    const talk7 = playKnot(allGems, "barnaby");
    expect(world.storyVariable(talk7.state.ink, "gem_reward_all")).toBe(true);
    expect(talk7.state.coins).toBe(50);
    expect(talk7.state.snacks).toBe(fresh.snacks + 2);
    expect(talk7.sounds).toContain("chime-red");

    const chest = playKnot(talk7.state, "club_chest");
    expect(chest.lines.some((line) => line.includes("Rainbow Star Geode"))).toBe(true);

    const notes = journalNotes(world, talk7.state);
    expect(notes.some((note) => note.includes("Rainbow Star Geode"))).toBe(true);
    expect(notes.some((note) => note.includes("Ribbon Bunny is my friend"))).toBe(true);

    // Ensure runInk directly confirms zero stray errors.
    const check = runInk(world.story, talk7.state.ink, { type: "start", knot: "journal" },
      inkFacts(world, talk7.state));
    expect(check.line?.text).toContain("Rainbow Star Geode");
  });
});
