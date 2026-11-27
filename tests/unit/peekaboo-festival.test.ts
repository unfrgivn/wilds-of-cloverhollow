import { describe, expect, it } from "vitest";
import {
  loadContent,
  parseBattleContent,
  parseCritter,
  parsePartyMember,
} from "../../src/content/load";
import {
  battleCommands,
  battleView,
  blankInput,
  checkDraws,
  checkHint,
  createCheck,
  createState,
  gentleCheckSpec,
  inkFacts,
  journalNotes,
  peekabooStatus,
  runInk,
  soundCues,
  step,
  stepCheck,
  viewCheck,
  type CheckInput,
  type PeekabooSpec,
  type PeekabooState,
  type State,
} from "../../src/core";
import owlJson from "../../content/critters/moon-owl.json";
import battleJson from "../../content/battle.json";
import maddieJson from "../../content/party/maddie.json";

const baseInput = (confirmHeld = false): CheckInput => ({
  confirmEdge: false,
  confirmHeld,
  lane: 1,
  lean: 0,
});

const sampleSpec: PeekabooSpec = {
  kind: "peekaboo",
  ticks: 60,
  goal: 24,
  warningTicks: 8,
  graceTicks: 3,
  peeks: [
    { start: 18, end: 30 },
    { start: 42, end: 52 },
  ],
};

function asPeekaboo(check: ReturnType<typeof createCheck>): PeekabooState {
  if (check.kind !== "peekaboo") throw new Error("expected peekaboo check");
  return check;
}

describe("Milestone 81: Peekaboo check rules", () => {
  it("tracks safe hold, warning telegraph, grace buffer, spotting penalty, and early great", () => {
    expect(checkDraws(sampleSpec)).toBe(0);
    let check = asPeekaboo(createCheck(sampleSpec, "fae"));
    expect(peekabooStatus(check)).toBe("safe");
    expect(check.spotted).toEqual([0, 0]);
    expect(check.peeksCleared).toBe(0);

    // Ticks 1..9: safe holding increments progress.
    for (let i = 0; i < 9; i += 1) {
      const stepped = stepCheck(check, baseInput(true));
      check = asPeekaboo(stepped.check);
      expect(stepped.grade).toBeNull();
    }
    expect(check.tick).toBe(9);
    expect(check.progress).toBe(9);
    expect(peekabooStatus(check)).toBe("safe");

    // Tick 10 enters warningTicks (18 - 8 = 10): still safe to hold confirm.
    check = asPeekaboo(stepCheck(check, baseInput(true)).check);
    expect(check.tick).toBe(10);
    expect(peekabooStatus(check)).toBe("warning");
    expect(check.progress).toBe(10);

    // Advance through warning to tick 17 without holding, then hold inside graceTicks (18..20).
    for (let i = 0; i < 7; i += 1) check = asPeekaboo(stepCheck(check, baseInput(false)).check);
    expect(check.tick).toBe(17);
    expect(peekabooStatus(check)).toBe("warning");

    // Ticks 18..20 are within graceTicks (start + 3 = 21): holding neither spots nor progresses.
    for (let i = 0; i < 3; i += 1) check = asPeekaboo(stepCheck(check, baseInput(true)).check);
    expect(check.tick).toBe(20);
    expect(peekabooStatus(check)).toBe("watching");
    expect(check.spotted).toEqual([0, 0]);
    expect(check.progress).toBe(10);

    // Release for the rest of peek 0 (ticks 21..30) -> clears peek 0 at tick 30.
    for (let i = 0; i < 10; i += 1) check = asPeekaboo(stepCheck(check, baseInput(false)).check);
    expect(check.tick).toBe(30);
    expect(peekabooStatus(check)).toBe("safe");
    expect(check.peeksCleared).toBe(1);
    expect(viewCheck(check, null)).toMatchObject({
      kind: "peekaboo",
      status: "safe",
      peeks: ["cleared", "pending"],
    });

    // Hold safely to reach goal (24) before tick 60 -> early great!
    let grade: string | null = null;
    while (grade === null) {
      const nextTick = check.tick + 1;
      const inPeek = sampleSpec.peeks.some((p) => nextTick >= p.start && nextTick < p.end);
      const stepped = stepCheck(check, baseInput(!inPeek));
      check = asPeekaboo(stepped.check);
      grade = stepped.grade;
    }
    expect(grade).toBe("great");
    expect(check.progress).toBe(24);
    expect(check.tick).toBeLessThan(sampleSpec.ticks);
  });

  it("applies -8 progress penalty once per spotted peek and grades good / miss on timeout", () => {
    let check = asPeekaboo(createCheck(sampleSpec, "fae"));
    // Build 17 progress before peek 0 (ticks 1..17).
    for (let i = 0; i < 17; i += 1) check = asPeekaboo(stepCheck(check, baseInput(true)).check);
    expect(check.progress).toBe(17);

    // Hold through peek 0 past graceTicks (ticks 18..24): spotted once, -8 progress -> 9.
    for (let i = 0; i < 7; i += 1) check = asPeekaboo(stepCheck(check, baseInput(true)).check);
    expect(check.spotted).toEqual([1, 0]);
    expect(check.progress).toBe(9);

    // Freeze cleanly for peek 1, reach >= ceil(24 * 0.55) = 14 progress -> timeout grades "good".
    let grade: string | null = null;
    while (grade === null) {
      const nextTick = check.tick + 1;
      const hold = nextTick >= 30 && nextTick < 38;
      const stepped = stepCheck(check, baseInput(hold));
      check = asPeekaboo(stepped.check);
      grade = stepped.grade;
    }
    expect(check.tick).toBe(sampleSpec.ticks);
    expect(check.peeksCleared).toBe(1);
    expect(check.progress).toBeGreaterThanOrEqual(Math.ceil(sampleSpec.goal * 0.55));
    expect(grade).toBe("good");

    // Getting spotted twice results in "miss" even with high progress.
    let missCheck = asPeekaboo(createCheck(sampleSpec, "fae"));
    let missGrade: string | null = null;
    while (missGrade === null) {
      const stepped = stepCheck(missCheck, baseInput(true));
      missCheck = asPeekaboo(stepped.check);
      missGrade = stepped.grade;
    }
    expect(missCheck.spotted).toEqual([1, 1]);
    expect(missGrade).toBe("miss");
  });

  it("softens Peekaboo under Gentle Timing, shows early hint, and emits battle-beat", () => {
    const { world, fixtures } = loadContent();
    const moonOwl = world.critters["moon-owl"];
    if (moonOwl === undefined || moonOwl.burst.check.kind !== "peekaboo")
      throw new Error("moon-owl peekaboo check missing");

    const gentle = gentleCheckSpec(moonOwl.burst.check);
    expect(gentle.kind).toBe("peekaboo");
    if (gentle.kind === "peekaboo") {
      expect(gentle.warningTicks).toBe(Math.min(28, moonOwl.burst.check.warningTicks + 6));
      expect(gentle.graceTicks).toBe(Math.min(10, moonOwl.burst.check.graceTicks + 5));
      expect(gentle.goal).toBe(Math.round(moonOwl.burst.check.goal * 0.78));
    }

    const fresh = asPeekaboo(createCheck(moonOwl.burst.check, "fae"));
    expect(checkHint(fresh, world.battle.hints)).toBe(world.battle.hints.peekaboo);
    const moved = asPeekaboo(stepCheck(fresh, baseInput(true)).check);
    expect(checkHint(moved, world.battle.hints)).toBeNull();
    let waited = fresh;
    for (let i = 0; i < 28; i += 1) waited = asPeekaboo(stepCheck(waited, baseInput(false)).check);
    expect(checkHint(waited, world.battle.hints)).toBeNull();

    // Clearing a peek increments peeksCleared and triggers "battle-beat" via soundCues.
    const base = createState(world, fixtures.woods!);
    const beforeCheck: PeekabooState = {
      ...fresh,
      tick: 63,
      peeksCleared: 0,
    };
    const afterCheck: PeekabooState = {
      ...beforeCheck,
      tick: 64,
      peeksCleared: 1,
    };
    const battleBase = {
      critterId: "moon-owl",
      den: null,
      entry: base.player,
      phase: "check" as const,
      message: "",
      revealed: 0,
      selected: 0,
      command: null,
      energy: 6,
      calm: 0,
      rest: {},
      lastGrade: null,
      feelings: [],
      answered: false,
      lanternPeek: false,
      turn: 1,
      windUp: null,
      rewardSticker: null,
      phaseTicks: 63,
    };
    const cues = soundCues(
      { ...base, battle: { ...battleBase, check: beforeCheck } },
      { ...base, battle: { ...battleBase, check: afterCheck } },
      world,
    );
    expect(cues).toContain("battle-beat");
  });

  it("rejects invalid Peekaboo specs and disallows Peekaboo on Soothe or friend commands", () => {
    const withBurst = (check: Record<string, unknown>): Record<string, unknown> => ({
      ...owlJson,
      burst: { bigChance: 0, check },
    });
    expect(() =>
      parseCritter(
        withBurst({ kind: "peekaboo", ticks: 181, goal: 20, warningTicks: 10, graceTicks: 2,
          peeks: [{ start: 30, end: 50 }] }),
        "bad.json",
      ),
    ).toThrow(/ticks/);
    expect(() =>
      parseCritter(
        withBurst({ kind: "peekaboo", ticks: 100, goal: 20, warningTicks: 10, graceTicks: 2,
          peeks: [] }),
        "bad.json",
      ),
    ).toThrow(/peeks/);
    expect(() =>
      parseCritter(
        withBurst({ kind: "peekaboo", ticks: 100, goal: 20, warningTicks: 10, graceTicks: 2,
          peeks: [{ start: 40, end: 60 }, { start: 55, end: 75 }] }),
        "bad.json",
      ),
    ).toThrow(/peeks/);
    expect(() =>
      parseCritter(
        withBurst({ kind: "peekaboo", ticks: 60, goal: 50, warningTicks: 10, graceTicks: 2,
          peeks: [{ start: 20, end: 40 }] }),
        "bad.json",
      ),
    ).toThrow(/goal/);

    const validPeekaboo = owlJson.burst.check;
    expect(() =>
      parseBattleContent(
        {
          ...battleJson,
          commands: {
            ...battleJson.commands,
            soothe: { ...battleJson.commands.soothe, check: validPeekaboo },
          },
        },
        "battle.json",
      ),
    ).toThrow(/commands\.soothe\.check\.kind/);
    expect(() =>
      parsePartyMember(
        {
          ...maddieJson,
          command: { ...maddieJson.command, check: validPeekaboo },
        },
        "maddie.json",
      ),
    ).toThrow(/command\.check\.kind/);
  });
});

describe("Milestone 81: Starry Owl & Chef Mateo story, battles, keepsakes & 24 slots", () => {
  const { world, fixtures } = loadContent();

  function runKnotAll(
    state: State,
    knot: string,
    choices: number[] = [],
  ): { lines: string[]; tags: string[]; ink: string; choicesSeen: string[][] } {
    const queue = [...choices];
    const lines: string[] = [];
    const tags: string[] = [];
    const choicesSeen: string[][] = [];
    let currentInk = state.ink;
    let res = runInk(world.story, currentInk, { type: "start", knot }, inkFacts(world, state));
    for (let i = 0; i < 40; i += 1) {
      currentInk = res.ink;
      if (res.line !== null) {
        lines.push(res.line.text);
        tags.push(...res.line.tags);
      }
      if (res.choices.length > 0) {
        choicesSeen.push(res.choices);
        const pick = queue.shift();
        if (pick === undefined) break;
        res = runInk(
          world.story,
          currentInk,
          { type: "choose", index: pick },
          inkFacts(world, { ...state, ink: currentInk }),
        );
        continue;
      }
      if (res.ended) break;
      res = runInk(
        world.story,
        currentInk,
        { type: "next" },
        inkFacts(world, { ...state, ink: currentInk }),
      );
    }
    return { lines, tags, ink: currentInk, choicesSeen };
  }

  it("gates moon_perch on clubhouse_claimed, summons Starey Owl, awards keepsake & notes", () => {
    const base = createState(world, fixtures["new-game"]!);
    const beforeClaim = runKnotAll(base, "moon_perch");
    expect(world.storyVariable(beforeClaim.ink, "moon_owl_out")).toBe(false);
    expect(beforeClaim.lines.join(" ")).toContain("mossy bark");

    const claimed = createState(world, {
      ...fixtures.woods!,
      variables: { clubhouse_claimed: true },
    });
    const summon = runKnotAll(claimed, "moon_perch");
    expect(world.storyVariable(summon.ink, "moon_owl_out")).toBe(true);
    expect(summon.tags).toContain("sound: chime-blue");
    expect(
      journalNotes(world, { ...claimed, ink: summon.ink }).some((line) =>
        line.includes("Starey Owl"),
      ),
    ).toBe(true);

    const calmedState: State = {
      ...claimed,
      ink: summon.ink,
      critters: { ...claimed.critters, "moon-owl": "calm" },
      stickers: [...claimed.stickers, "starry-owl"],
    };
    const calmTalk = runKnotAll(calmedState, "moon_owl_calm");
    expect(calmTalk.lines.join(" ")).toContain("Moon Feather");
    expect(calmTalk.lines.join(" ").toLowerCase()).not.toContain("milo");

    const chestState = createState(world, {
      ...fixtures.clubhouse!,
      variables: { has_chest: true, clubhouse_claimed: true },
    });
    const chest = runKnotAll(
      { ...chestState, critters: { ...chestState.critters, "moon-owl": "calm" } },
      "club_chest",
    );
    expect(chest.lines.join(" ")).toContain("Moon Feather");
    expect(
      journalNotes(world, calmedState).some((line) => line.includes("Starry Owl")),
    ).toBe(true);
  });

  it("summons Chef Mateo, supports Run + 3-knot Talk, snacks gift, 4-coin shop & badge", () => {
    const base = createState(world, fixtures.hills!);
    const summon = runKnotAll(base, "taco_flyer");
    expect(world.storyVariable(summon.ink, "taco_chef_out")).toBe(true);
    expect(
      journalNotes(world, { ...base, ink: summon.ink }).some((line) =>
        line.includes("Chef Mateo"),
      ),
    ).toBe(true);

    const chef = world.critters["taco-chef"];
    if (chef === undefined || chef.talk === null) throw new Error("taco-chef talk missing");
    expect(chef.canRun).toBe(true);
    expect(chef.talk.talkAt).toBe(85);
    expect(chef.talk.knots).toEqual(["mateo_talk_1", "mateo_talk_2", "mateo_talk_3"]);

    // Verify battle commands show Run before talkAt and Talk-only at calm >= talkAt.
    const battleState: State = {
      ...base,
      ink: summon.ink,
      battle: {
        critterId: "taco-chef",
        den: null,
        entry: base.player,
        phase: "command",
        message: chef.lines.command,
        revealed: chef.lines.command.length,
        selected: 0,
        command: null,
        energy: chef.energyMax,
        calm: 40,
        rest: {},
        check: null,
        lastGrade: null,
        feelings: ["hungry", "zoomy", "grumpy"],
        answered: false,
        lanternPeek: false,
        turn: 1,
        windUp: null,
        talkMode: false,
        talk: null,
        talkTurns: 0,
        rewardSticker: null,
        phaseTicks: 10,
      },
    };
    expect(battleCommands(world, battleState).some((cmd) => cmd.id === "run")).toBe(true);

    // At calm 85, Talk command replaces normal commands.
    let talkState: State = {
      ...battleState,
      battle: { ...battleState.battle!, calm: 85, talkMode: true },
    };
    expect(battleCommands(world, talkState).map((cmd) => cmd.id)).toEqual(["talk"]);

    // Play through all 3 Talk knots using best answers (choice 0) and verify calm fills & rewards.
    for (let round = 0; round < 3; round += 1) {
      // Reveal prompt if needed, then confirm on Talk command to start knot.
      for (let tick = 0; tick < 10 && talkState.battle?.phase !== "talk"; tick += 1) {
        talkState = step(world, talkState, { ...blankInput(), confirm: true }).state;
        talkState = step(world, talkState, blankInput()).state;
      }
      expect(talkState.battle?.phase).toBe("talk");
      // Reveal question text.
      talkState = step(world, talkState, { ...blankInput(), confirm: true }).state;
      talkState = step(world, talkState, blankInput()).state;
      expect(battleView(world, talkState)?.talk?.choices.length).toBe(3);
      // Choose option 0 (great).
      talkState = step(world, talkState, { ...blankInput(), confirm: true }).state;
      talkState = step(world, talkState, blankInput()).state;
      // Reveal & advance reply.
      for (let tick = 0; tick < 20 && talkState.battle?.phase === "talk"; tick += 1) {
        talkState = step(world, talkState, { ...blankInput(), confirm: true }).state;
        talkState = step(world, talkState, blankInput()).state;
      }
      if (round < 2) {
        expect(talkState.battle?.calm).toBeLessThan(chef.calmMax);
      }
    }
    expect(talkState.battle?.phase).toBe("soothed");
    // Advance soothed -> reward -> overworld.
    for (let tick = 0; tick < 30 && talkState.battle !== null; tick += 1) {
      talkState = step(world, talkState, { ...blankInput(), confirm: true }).state;
      talkState = step(world, talkState, blankInput()).state;
    }
    expect(talkState.battle).toBeNull();
    expect(talkState.stickers).toContain("taco-chef");
    expect(talkState.coins).toBe(base.coins + 25);
    expect(talkState.xp).toBe(base.xp + 210);

    // Calm talk gifts 2 snacks and offers 4-coin crispy taco shop.
    const richCalmed: State = { ...talkState, coins: 20 };
    const calmFirst = runKnotAll(richCalmed, "taco_chef_calm", [0]);
    expect(world.storyVariable(calmFirst.ink, "mateo_snacks_given")).toBe(true);
    expect(calmFirst.tags).toContain("gift: snack 2");
    expect(calmFirst.tags).toContain("buy: snack 4");
    expect(calmFirst.choicesSeen[0]).toEqual([
      "Buy a crispy taco snack for 4 coins",
      "Just saying hi!",
    ]);

    const chestState = createState(world, {
      ...fixtures.clubhouse!,
      variables: { has_chest: true },
    });
    const chest = runKnotAll(
      { ...chestState, critters: { ...chestState.critters, "taco-chef": "calm" } },
      "club_chest",
    );
    expect(chest.lines.join(" ")).toContain("Golden Taco Badge");
  });

  it("expands the sticker album to 24 slots, wires favourite treats, and never names Milo", () => {
    expect(world.stickers.slots).toBe(24);
    expect(world.stickers.catalogue).toHaveLength(24);
    expect(world.stickers.catalogue.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["starry-owl", "taco-chef"]),
    );
    const treatsFor = (species: string): string[] =>
      world.treats.filter((treat) => treat.favourites.includes(species)).map((treat) => treat.id);
    expect(treatsFor("moon-owl")).toEqual([
      "orchard-apple",
      "cocoa-sundae",
      "sunberry-nectar",
    ]);
    expect(treatsFor("taco-chef")).toEqual(["fish-cracker", "berry-cone"]);

    // Verify ZERO Milo mentions in all M81 knots and critter lines.
    const base = createState(world, {
      ...fixtures.woods!,
      variables: { clubhouse_claimed: true },
    });
    const knots = [
      "moon_perch",
      "moon_owl_calm",
      "taco_flyer",
      "mateo_talk_1",
      "mateo_talk_2",
      "mateo_talk_3",
      "taco_chef_calm",
    ];
    for (const knot of knots) {
      const opening = runKnotAll(base, knot);
      expect(opening.lines.join(" ").toLowerCase(), knot).not.toContain("milo");
      for (let choice = 0; choice < (opening.choicesSeen[0]?.length ?? 0); choice += 1) {
        const branch = runKnotAll(base, knot, [choice]);
        expect(branch.lines.join(" ").toLowerCase(), `${knot}#${choice}`).not.toContain("milo");
      }
    }
    for (const id of ["moon-owl", "taco-chef"] as const) {
      expect(JSON.stringify(world.critters[id]).toLowerCase(), id).not.toContain("milo");
    }
  });
});
