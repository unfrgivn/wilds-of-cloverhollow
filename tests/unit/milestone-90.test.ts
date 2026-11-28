import { describe, expect, it } from "vitest";
import {
  battleView,
  createState,
  type Battle,
  type BattleView,
  type State,
} from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { newClaw } from "../../src/core/claw";
import { loadContent } from "../../src/content/load";
import { storyTimeOfDay } from "../../src/render/time-of-day";
import { evaluateBattlePortraits } from "../../src/ui/battle-portraits";
import type { AtlasImage } from "../../src/ui/atlas";

const { world, fixtures } = loadContent();

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, ink, ...overrides };
}

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "command",
    message: "How can Fae calm the frog?",
    revealed: 26,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["zoomy", "curious"],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

const partyCommands: Record<string, string | null> = Object.fromEntries(
  Object.entries(world.party).map(([id, member]) => [id, member.command?.id ?? null]),
);

const stubImage = (id: string): AtlasImage => ({
  src: `assets/${id}.png`,
  frame: { x: 0, y: 0, w: 64, h: 64 },
  atlas: { w: 256, h: 256 },
});

describe("Milestone 90: storyTimeOfDay lighting arc", () => {
  it("returns crisp morning light in early bedroom and kitchen before stickers or lantern", () => {
    const bedroom = storyTimeOfDay(world, stateIn("new-game", { area: "bedroom", stickers: [] }));
    expect(bedroom.phase).toBe("morning");
    expect(bedroom.alpha).toBeCloseTo(0.04, 5);
    expect(bedroom.sunAlpha).toBeCloseTo(0.1, 5);

    const kitchen = storyTimeOfDay(world, stateIn("kitchen", { stickers: [] }));
    expect(kitchen.phase).toBe("morning");

    const afterSticker = storyTimeOfDay(
      world,
      stateIn("new-game", { area: "bedroom", stickers: ["frog"] }),
    );
    expect(afterSticker.phase).toBe("day");
    expect(afterSticker.alpha).toBe(0);
    expect(afterSticker.sunAlpha).toBe(0);
  });

  it("stays neutral day on harness, battles, arcades, active lantern, and early outdoors", () => {
    const neutralStates: State[] = [
      stateIn("harness"),
      stateIn("plaza"),
      stateIn("woods"),
      stateIn("clubhouse", {}, { has_lantern: true }),
      stateIn("school", {}, { has_lantern: true }),
      stateIn("plaza", { lantern: true }, { has_lantern: true }),
      stateIn("plaza", { battle: makeBattle() }, { has_lantern: true }),
      stateIn(
        "arcade",
        { arcade: newClaw(world.arcade.claw) },
        { has_lantern: true },
      ),
    ];
    for (const candidate of neutralStates) {
      const grade = storyTimeOfDay(world, candidate);
      expect(grade.phase).toBe("day");
      expect(grade.alpha).toBe(0);
      expect(grade.sunAlpha).toBe(0);
    }
  });

  it("shifts outdoor adventure areas into golden-hour once has_lantern is earned", () => {
    for (const area of ["plaza", "park", "bay", "pass", "trail", "woods", "hills", "field"]) {
      const grade = storyTimeOfDay(world, stateIn("plaza", { area }, { has_lantern: true }));
      expect(grade.phase, area).toBe("golden-hour");
      expect(grade.alpha).toBeGreaterThan(0);
      expect(grade.alpha).toBeLessThanOrEqual(0.1);
      expect(grade.sunAlpha).toBeGreaterThan(0);
      expect(grade.sunAlpha).toBeLessThanOrEqual(0.2);
    }
  });

  it("applies enchanted-twilight in mist / fizzy forest and golden-meadow once calmed", () => {
    const mist = storyTimeOfDay(world, stateIn("plaza", { area: "mist" }, { has_lantern: true }));
    expect(mist.phase).toBe("enchanted-twilight");
    expect(mist.alpha).toBeCloseTo(0.08, 5);

    const fizzyForest = storyTimeOfDay(
      world,
      stateIn("plaza", { area: "enchanted" }, { has_lantern: true }),
    );
    expect(fizzyForest.phase).toBe("enchanted-twilight");

    const calmForest = storyTimeOfDay(
      world,
      stateIn("plaza", { area: "enchanted" }, { has_lantern: true, forest_fizzy: false }),
    );
    expect(calmForest.phase).toBe("golden-meadow");
    expect(calmForest.alpha).toBeCloseTo(0.06, 5);
    expect(calmForest.sunAlpha).toBeCloseTo(0.14, 5);
  });

  it("applies warm sunrise light during the Morning Wake-Up finale", () => {
    const morningFinale = storyTimeOfDay(
      world,
      stateIn("new-game", { area: "bedroom", finale: "morning" }),
    );
    expect(morningFinale.phase).toBe("sunrise");
    expect(morningFinale.alpha).toBeCloseTo(0.085, 5);
    expect(morningFinale.sunAlpha).toBeCloseTo(0.16, 5);

    const creditsFinale = storyTimeOfDay(
      world,
      stateIn("new-game", { area: "bedroom", finale: "credits" }),
    );
    expect(creditsFinale.phase).toBe("sunrise");
  });
});

describe("Milestone 90: evaluateBattlePortraits", () => {
  const fullPartyIds = ["maddie", "sue", "jordan", "pond-pup", "acorn-squirrel", "ribbon-bunny"];

  function viewFor(battle: Battle, partyIds: string[] = ["maddie", "sue", "jordan"]): BattleView {
    const base = stateIn("plaza-party", { battle });
    const party = partyIds.map((id) => ({
      id,
      xp: 0,
      x: 500,
      y: 500,
      facing: "down" as const,
      motion: { distance: 0, moving: false },
      stillTicks: 0,
      trail: [],
    }));
    const computed = battleView(world, { ...base, party });
    if (computed === null) throw new Error("Expected BattleView");
    return computed;
  }

  it("includes only Fae and fighting party members (excluding flute friends)", () => {
    const battle = makeBattle({ selected: 0 });
    const items = evaluateBattlePortraits({
      battle,
      view: viewFor(battle),
      partyIds: fullPartyIds,
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(items.map((item) => item.id)).toEqual(["fae", "maddie", "sue", "jordan"]);
    expect(items.map((item) => item.name)).toEqual(["Fae", "Maddie", "Sue", "Jordan"]);
    expect(items.every((item) => item.image !== null)).toBe(true);
  });

  it("marks the highlighted command actor eager and others cozy during command selection", () => {
    const soothe = makeBattle({ selected: 0 });
    const sootheItems = evaluateBattlePortraits({
      battle: soothe,
      view: viewFor(soothe),
      partyIds: ["maddie", "sue", "jordan"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(sootheItems.map((i) => `${i.id}:${i.mood}:${i.active}`)).toEqual([
      "fae:eager:true",
      "maddie:cozy:false",
      "sue:cozy:false",
      "jordan:cozy:false",
    ]);

    const play = makeBattle({ actorIndex: 1, selected: 0 });
    const playItems = evaluateBattlePortraits({
      battle: play,
      view: viewFor(play),
      partyIds: ["maddie", "sue", "jordan"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(playItems.map((i) => `${i.id}:${i.mood}`)).toEqual([
      "fae:cozy",
      "maddie:eager",
      "sue:cozy",
      "jordan:cozy",
    ]);

    const cast = makeBattle({ actorIndex: 2, selected: 0 });
    const castItems = evaluateBattlePortraits({
      battle: cast,
      view: viewFor(cast),
      partyIds: ["maddie", "sue", "jordan"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(castItems.map((i) => `${i.id}:${i.mood}`)).toEqual([
      "fae:cozy",
      "maddie:cozy",
      "sue:eager",
      "jordan:cozy",
    ]);

    const juggle = makeBattle({ actorIndex: 3, selected: 0 });
    const juggleItems = evaluateBattlePortraits({
      battle: juggle,
      view: viewFor(juggle),
      partyIds: ["maddie", "sue", "jordan"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(juggleItems.map((i) => `${i.id}:${i.mood}`)).toEqual([
      "fae:cozy",
      "maddie:cozy",
      "sue:cozy",
      "jordan:eager",
    ]);
  });

  it("switches to cheering on GREAT results and soothed/reward phases", () => {
    const greatResult = makeBattle({ phase: "result", command: "play", lastGrade: "great" });
    const greatItems = evaluateBattlePortraits({
      battle: greatResult,
      view: viewFor(greatResult),
      partyIds: ["maddie", "sue"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(greatItems.every((item) => item.mood === "cheering")).toBe(true);

    const soothed = makeBattle({ phase: "soothed", energy: 1 });
    const soothedItems = evaluateBattlePortraits({
      battle: soothed,
      view: viewFor(soothed),
      partyIds: ["maddie", "sue"],
      partyCommands,
      energy: 1,
      resolveImage: stubImage,
    });
    expect(soothedItems.every((item) => item.mood === "cheering")).toBe(true);
  });

  it("switches to flustered on damaging burst hits and at low energy (<= 1)", () => {
    const burstMiss = makeBattle({ phase: "burstResult", lastGrade: "miss", energy: 4 });
    const burstItems = evaluateBattlePortraits({
      battle: burstMiss,
      view: viewFor(burstMiss),
      partyIds: ["maddie", "sue"],
      partyCommands,
      energy: 4,
      resolveImage: stubImage,
    });
    expect(burstItems.every((item) => item.mood === "flustered")).toBe(true);

    const lowEnergy = makeBattle({ phase: "command", energy: 1 });
    const lowItems = evaluateBattlePortraits({
      battle: lowEnergy,
      view: viewFor(lowEnergy),
      partyIds: ["maddie", "sue"],
      partyCommands,
      energy: 1,
      resolveImage: stubImage,
    });
    expect(lowItems.every((item) => item.mood === "flustered")).toBe(true);
  });

  it("switches to radiant when Together! is ready or actively unleashing", () => {
    const ready = makeBattle({ phase: "command", sparkle: 3 });
    const readyView = viewFor(ready);
    expect(readyView.sparkle?.ready).toBe(true);
    const readyItems = evaluateBattlePortraits({
      battle: ready,
      view: readyView,
      partyIds: ["maddie", "sue"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(readyItems.every((item) => item.mood === "radiant")).toBe(true);

    const activeTogether = makeBattle({ phase: "check", command: "together" });
    const activeItems = evaluateBattlePortraits({
      battle: activeTogether,
      view: viewFor(activeTogether),
      partyIds: ["maddie", "sue"],
      partyCommands,
      energy: 5,
      resolveImage: stubImage,
    });
    expect(activeItems.every((item) => item.mood === "radiant" && item.active)).toBe(true);
  });
});
