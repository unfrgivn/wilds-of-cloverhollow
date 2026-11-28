import { describe, expect, it } from "vitest";
import {
  activeBattleActor,
  battleCommands,
  battleTurnRoster,
  battleView,
  blankInput,
  createState,
  orderPartyContent,
  orderPartyIds,
  orderPartyMembers,
  spawnParty,
  step,
  syncParty,
  type Battle,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { battleLayout } from "../../src/render/battle-layout";
import { classifySnackTheater } from "../../src/render/battle-vfx";

const content = loadContent();
const world = content.world;
const none = blankInput();

function fixtureFor(name: string) {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`Missing fixture ${name}`);
  return fixture;
}

function pressConfirm(state: State): State {
  const down = step(world, state, { ...none, confirm: true }).state;
  return step(world, down, none).state;
}

function commandBattleState(party: string[], overrides: Partial<Battle> = {}): State {
  const base = createState(world, { area: "plaza", spawn: "fountain", seed: 1, party });
  const critter = world.critters["fountain-frog"];
  if (critter === undefined) throw new Error("Missing fountain-frog");
  const battle: Battle = {
    critterId: critter.id,
    den: null,
    entry: { ...base.player },
    phase: "command",
    message: critter.lines.command,
    revealed: critter.lines.command.length,
    selected: 0,
    command: null,
    energy: critter.energyMax,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    actorIndex: 0,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
  return { ...base, battle };
}

describe("party follower ordering (pets always at the end)", () => {
  it("orders standing friends before pets while preserving relative order in each group", () => {
    const orderedIds = orderPartyIds(world, [
      "maddie",
      "pond-pup",
      "jordan",
      "acorn-squirrel",
      "sue",
      "ribbon-bunny",
    ]);
    expect(orderedIds).toEqual([
      "jordan",
      "sue",
      "maddie",
      "pond-pup",
      "acorn-squirrel",
      "ribbon-bunny",
    ]);

    const orderedRoster = orderPartyContent(Object.values(world.party));
    expect(orderedRoster.map((member) => member.id)).toEqual([
      "sue",
      "jordan",
      "maddie",
      "pond-pup",
      "acorn-squirrel",
      "ribbon-bunny",
    ]);
  });

  it("orders spawnParty with standing friends ahead of pets", () => {
    const plaza = world.areas.plaza;
    const spawn = plaza?.spawns.fountain;
    if (plaza === undefined || spawn === undefined) throw new Error("Missing plaza fountain");
    const base = createState(world, fixtureFor("plaza"));
    const placed = spawnParty(world, base.ink, plaza, spawn, [
      "maddie",
      "sue",
      "pond-pup",
      "jordan",
    ]);
    expect(placed.map((member) => member.id)).toEqual(["sue", "jordan", "maddie", "pond-pup"]);
  });

  it("reorders legacy [maddie, sue] saves in syncParty and refreshes changed trails", () => {
    const state = createState(world, {
      area: "plaza",
      spawn: "fountain",
      seed: 1,
      party: ["sue", "maddie"],
    });
    const sue = state.party.find((member) => member.id === "sue");
    const maddie = state.party.find((member) => member.id === "maddie");
    if (sue === undefined || maddie === undefined) throw new Error("Missing sue or maddie");

    const legacy: State = {
      ...state,
      party: [
        { ...maddie, trail: [{ x: 1, y: 1 }] },
        { ...sue, trail: [{ x: 2, y: 2 }] },
      ],
    };
    const synced = syncParty(world, legacy);
    expect(synced.party.map((member) => member.id)).toEqual(["sue", "maddie"]);
    expect(orderPartyMembers(world, legacy.party).map((m) => m.id)).toEqual(["sue", "maddie"]);

    const [reorderedSue, reorderedMaddie] = synced.party;
    expect(reorderedSue?.trail).toEqual([
      { x: sue.x, y: sue.y },
      { x: state.player.x, y: state.player.y },
    ]);
    expect(reorderedMaddie?.trail).toEqual([
      { x: maddie.x, y: maddie.y },
      { x: sue.x, y: sue.y },
    ]);

    // Already ordered party returns the same state reference untouched.
    expect(syncParty(world, synced)).toBe(synced);
  });
});

describe("per-member battle turns and Recover", () => {
  it("rotates turns Fae -> Sue -> Maddie -> Fae with member-specific command menus", () => {
    let state = commandBattleState(["maddie", "sue"]);
    expect(battleTurnRoster(world, state)).toEqual([
      { id: "fae", name: "Fae" },
      { id: "sue", name: "Sue" },
      { id: "maddie", name: "Maddie" },
    ]);

    // Turn 1: Fae
    expect(activeBattleActor(world, state)).toEqual({ id: "fae", name: "Fae", index: 0 });
    expect(battleView(world, state)?.activeActor).toEqual({ id: "fae", name: "Fae" });
    expect(battleCommands(world, state).map((cmd) => cmd.id)).toEqual([
      "soothe",
      "recover",
      "snack",
      "run",
    ]);

    // Advance from burstResult -> nextTurn (Sue)
    const advanceToNextTurn = (current: State): State => {
      const atBurstResult: State = {
        ...current,
        battle: {
          ...current.battle!,
          phase: "burstResult",
          message: "",
          revealed: 0,
        },
      };
      return pressConfirm(atBurstResult);
    };

    state = advanceToNextTurn(state);
    expect(activeBattleActor(world, state)).toEqual({ id: "sue", name: "Sue", index: 1 });
    expect(battleCommands(world, state).map((cmd) => cmd.id)).toEqual([
      "cast",
      "recover",
      "snack",
      "run",
    ]);

    state = advanceToNextTurn(state);
    expect(activeBattleActor(world, state)).toEqual({ id: "maddie", name: "Maddie", index: 2 });
    expect(battleCommands(world, state).map((cmd) => cmd.id)).toEqual([
      "play",
      "recover",
      "snack",
      "run",
    ]);

    state = advanceToNextTurn(state);
    expect(activeBattleActor(world, state)).toEqual({ id: "fae", name: "Fae", index: 0 });
    expect(battleCommands(world, state).map((cmd) => cmd.id)).toEqual([
      "soothe",
      "recover",
      "snack",
      "run",
    ]);
  });

  it("Recover restores +1 energy (clamped), clears own rest, and ticks others", () => {
    const start = commandBattleState(["maddie", "sue"], {
      actorIndex: 1, // Sue
      selected: 1, // Recover
      energy: 3,
      rest: { cast: 2, play: 2 },
    });
    const after = pressConfirm(start);
    expect(after.battle?.phase).toBe("result");
    expect(after.battle?.command).toBe("recover");
    expect(after.battle?.energy).toBe(4);
    expect(after.battle?.rest).toEqual({ play: 1 });
    expect(after.battle?.message).toContain("Sue");
    expect(classifySnackTheater(after.battle!)).toBe("none");

    // Clamps energy at energyMax.
    const full = commandBattleState(["maddie"], {
      actorIndex: 0,
      selected: 1,
      energy: 5,
    });
    const afterFull = pressConfirm(full);
    expect(afterFull.battle?.energy).toBe(5);
    expect(afterFull.battle?.message).toContain("Fae");
  });

  it("auto-selects the first enabled command when the next move is resting", () => {
    const beforeNext = commandBattleState(["maddie", "sue"], {
      actorIndex: 0,
      phase: "burstResult",
      message: "",
      revealed: 0,
      rest: { cast: 1 },
    });
    const sueTurn = pressConfirm(beforeNext);
    expect(sueTurn.battle?.phase).toBe("command");
    expect(sueTurn.battle?.actorIndex).toBe(1);
    const commands = battleCommands(world, sueTurn);
    expect(commands[0]).toMatchObject({ id: "cast", disabled: true, detail: "reeling in" });
    expect(commands[1]).toMatchObject({ id: "recover", disabled: false });
    expect(sueTurn.battle?.selected).toBe(1);
  });
});

describe("battle layout lineup and proportions", () => {
  it("places all party members behind Fae in order without overlapping Fae", () => {
    for (const [width, height, viewWidth] of [
      [1280, 720, 1280],
      [874, 402, 1565.37],
    ] as const) {
      const layout = battleLayout(width, height, viewWidth, 720, 145, 156, 3);
      expect(layout.fae.x).toBeCloseTo(width * 0.27, 4);
      expect(layout.fae.baseline).toBeCloseTo(height * 0.59, 4);
      expect(layout.critter.x).toBeCloseTo(width * 0.5, 4);
      expect(layout.party).toHaveLength(3);

      // Every party member stands behind Fae in strictly decreasing x order, all on screen.
      let aheadX = layout.fae.x;
      for (const member of layout.party) {
        expect(member.y).toBe(layout.fae.baseline);
        expect(member.x).toBeLessThan(aheadX);
        expect(aheadX - member.x).toBeCloseTo(68 * layout.scale, 4);
        expect(member.x).toBeGreaterThan(0);
        aheadX = member.x;
      }
    }
  });
});
