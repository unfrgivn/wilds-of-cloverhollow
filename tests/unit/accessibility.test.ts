import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createCheck,
  createState,
  gentleCheckSpec,
  landStickerProgress,
  mapBusRoutes,
  stableHash,
  step,
  type CheckSpec,
  type State,
  type World,
} from "../../src/core";
import {
  readGamePreferences,
  writeGamePreferences,
} from "../../src/platform/game-settings";

function allWorldSpecs(world: World): { label: string; spec: CheckSpec }[] {
  const specs: { label: string; spec: CheckSpec }[] = [
    { label: "soothe", spec: world.battle.commands.soothe.check },
  ];
  for (const member of Object.values(world.party)) {
    if (member.command !== null)
      specs.push({ label: `party:${member.id}`, spec: member.command.check });
  }
  for (const critter of Object.values(world.critters)) {
    specs.push({ label: `critter:${critter.id}:check`, spec: critter.burst.check });
    if (critter.burst.big !== undefined)
      specs.push({ label: `critter:${critter.id}:big`, spec: critter.burst.big });
  }
  return specs;
}

function enterFrogSootheCheck(
  world: World,
  start: State,
  gentleTiming: boolean,
): State {
  const options = gentleTiming ? { gentleTiming: true } : undefined;
  let state = start;
  const run = (move: { x: number; y: number }, confirm: boolean, ticks: number): void => {
    for (let index = 0; index < ticks; index += 1) {
      state = step(world, state, { ...blankInput(), move, confirm }, options).state;
    }
  };
  run({ x: 0, y: 1 }, false, 25);
  run({ x: -1, y: 0 }, false, 15);
  run({ x: 0, y: 1 }, false, 50);
  run({ x: -1, y: 0 }, false, 35);
  expect(state.battle).not.toBeNull();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (state.battle?.phase === "check") return state;
    run({ x: 0, y: 0 }, true, 1);
    run({ x: 0, y: 0 }, false, 1);
  }
  throw new Error("Never reached soothe check against fountain-frog");
}

describe("gentleCheckSpec", () => {
  it("widens windows and softens checks across every spec in the game world", () => {
    const { world } = loadContent();
    const specs = allWorldSpecs(world);
    expect(specs.length).toBeGreaterThan(20);
    const seen = new Set<CheckSpec["kind"]>();

    for (const { label, spec } of specs) {
      seen.add(spec.kind);
      const gentle = gentleCheckSpec(spec);
      expect(gentle.kind, label).toBe(spec.kind);

      if (spec.kind === "ring" && gentle.kind === "ring") {
        expect(gentle.greatWindow, label).toBeGreaterThan(spec.greatWindow);
        expect(gentle.goodWindow, label).toBeGreaterThanOrEqual(spec.goodWindow);
        expect(gentle.greatWindow, label).toBeLessThanOrEqual(gentle.goodWindow);
        expect(gentle.targetTick - gentle.goodWindow, label).toBeGreaterThanOrEqual(1);
        expect(gentle.targetTick + gentle.goodWindow, label).toBeLessThan(gentle.ticks);
      } else if (spec.kind === "charge" && gentle.kind === "charge") {
        expect(gentle.greatWindow, label).toBeGreaterThan(spec.greatWindow);
        expect(gentle.goodWindow, label).toBeGreaterThanOrEqual(spec.goodWindow);
        expect(gentle.greatWindow, label).toBeLessThanOrEqual(gentle.goodWindow);
        expect(gentle.targetTick - gentle.goodWindow, label).toBeGreaterThanOrEqual(1);
        expect(gentle.targetTick + gentle.goodWindow, label).toBeLessThan(gentle.maxTicks);
      } else if (spec.kind === "chain" && gentle.kind === "chain") {
        expect(gentle.hitWindow, label).toBeGreaterThanOrEqual(spec.hitWindow);
        for (let index = 1; index < gentle.arrivals.length; index += 1) {
          const prev = gentle.arrivals[index - 1] ?? 0;
          const curr = gentle.arrivals[index] ?? 0;
          expect(curr - prev, label).toBeGreaterThanOrEqual(2 * gentle.hitWindow + 2);
        }
      } else if (spec.kind === "catch" && gentle.kind === "catch") {
        expect(gentle.travelTicks, label).toBeGreaterThan(spec.travelTicks);
        expect(gentle.arrivals[0] ?? 0, label).toBeGreaterThanOrEqual(gentle.travelTicks);
        for (let index = 1; index < gentle.arrivals.length; index += 1) {
          const origGap = (spec.arrivals[index] ?? 0) - (spec.arrivals[index - 1] ?? 0);
          const gentleGap = (gentle.arrivals[index] ?? 0) - (gentle.arrivals[index - 1] ?? 0);
          expect(gentleGap, label).toBe(origGap + 4);
        }
      } else if (spec.kind === "lean" && gentle.kind === "lean") {
        expect(gentle.steer, label).toBe(spec.steer + 1);
        expect(gentle.spring, label).toBe(spec.spring + 1);
        gentle.forces.forEach((force, index) => {
          const original = spec.forces[index] ?? 1;
          expect(force, label).toBe(Math.max(1, original - 1));
          expect(force, label).toBeGreaterThanOrEqual(1);
          expect(force, label).toBeLessThan(gentle.steer);
        });
      } else if (spec.kind === "trace" && gentle.kind === "trace") {
        expect(gentle.reachRadius, label).toBeGreaterThan(spec.reachRadius);
        expect(gentle.brushSpeed, label).toBeGreaterThan(spec.brushSpeed);
        expect(gentle.dryTicks, label).toBeGreaterThan(spec.dryTicks);
      } else if (spec.kind === "peekaboo" && gentle.kind === "peekaboo") {
        expect(gentle.warningTicks, label).toBeGreaterThanOrEqual(spec.warningTicks);
        expect(gentle.graceTicks, label).toBeGreaterThanOrEqual(spec.graceTicks);
        expect(gentle.goal, label).toBeLessThanOrEqual(spec.goal);
        expect(gentle.goal, label).toBeGreaterThanOrEqual(1);
      } else if (spec.kind === "echo" && gentle.kind === "echo") {
        expect(gentle.demoTicks, label).toBeGreaterThan(spec.demoTicks);
        expect(gentle.inputTicks, label).toBeGreaterThan(spec.inputTicks);
      }
    }
    expect(seen).toEqual(
      new Set(["ring", "charge", "chain", "catch", "lean", "trace", "peekaboo", "echo"]),
    );
  });

  it("applies gentle spec when createCheck is called with gentle=true", () => {
    const { world } = loadContent();
    const soothe = world.battle.commands.soothe.check;
    const normal = createCheck(soothe, "critter");
    const gentle = createCheck(soothe, "critter", false, [], true);
    expect(normal.kind).toBe("ring");
    expect(gentle.kind).toBe("ring");
    if (normal.kind === "ring" && gentle.kind === "ring") {
      expect(gentle.spec.greatWindow).toBeGreaterThan(normal.spec.greatWindow);
      expect(gentle.spec.goodWindow).toBeGreaterThan(normal.spec.goodWindow);
    }
  });
});

describe("step with gentleTiming", () => {
  it("grades an off-center soothe press as good under gentleTiming and miss normally", () => {
    const { world, fixtures } = loadContent();
    const plaza = fixtures.plaza;
    if (plaza === undefined) throw new Error("Missing plaza fixture");

    const base = createState(world, plaza, 1);
    const normalAtCheck = enterFrogSootheCheck(world, base, false);
    const gentleAtCheck = enterFrogSootheCheck(world, base, true);
    const check = normalAtCheck.battle?.check;
    expect(check?.kind).toBe("ring");
    if (check?.kind !== "ring") throw new Error("Expected ring check");

    // 14 ticks past targetTick (39 + 14 = 53): outside standard goodWindow (11),
    // inside gentle goodWindow (17).
    const pressTick = check.spec.targetTick + 14;
    const resolveAt = (start: State, gentleTiming: boolean): State => {
      let current = start;
      const options = gentleTiming ? { gentleTiming: true } : undefined;
      for (let tick = 1; tick < pressTick; tick += 1)
        current = step(world, current, blankInput(), options).state;
      return step(world, current, { ...blankInput(), confirm: true }, options).state;
    };

    const normalResult = resolveAt(normalAtCheck, false);
    const gentleResult = resolveAt(gentleAtCheck, true);
    expect(normalResult.battle?.lastGrade).toBe("miss");
    expect(gentleResult.battle?.lastGrade).toBe("good");
  });

  it("keeps hashes identical when gentleTiming is omitted or false", () => {
    const { world, fixtures } = loadContent();
    const plaza = fixtures.plaza;
    if (plaza === undefined) throw new Error("Missing plaza fixture");

    let omitted = createState(world, plaza, 1);
    let explicitFalse = createState(world, plaza, 1);
    const frames = [
      { ...blankInput(), move: { x: 0, y: 1 } },
      { ...blankInput(), move: { x: -1, y: 0 } },
      { ...blankInput(), confirm: true },
    ];
    for (const frame of frames) {
      omitted = step(world, omitted, frame).state;
      explicitFalse = step(world, explicitFalse, frame, { gentleTiming: false }).state;
    }
    expect(stableHash(omitted)).toBe(stableHash(explicitFalse));
  });
});

describe("game preferences serialization", () => {
  it("defaults safely on null or malformed values and round-trips cleanly", () => {
    const defaults = {
      gentleTiming: false,
      keyHints: false,
      textSpeed: "cozy" as const,
      reducedMotion: false,
    };
    expect(readGamePreferences(null)).toEqual(defaults);
    expect(readGamePreferences("not-json")).toEqual(defaults);
    expect(readGamePreferences("true")).toEqual(defaults);
    expect(readGamePreferences('{"gentleTiming":true}')).toEqual({
      ...defaults,
      gentleTiming: true,
    });
    const encoded = writeGamePreferences({
      gentleTiming: true,
      keyHints: true,
      textSpeed: "brisk",
      reducedMotion: true,
    });
    expect(readGamePreferences(encoded)).toEqual({
      gentleTiming: true,
      keyHints: true,
      textSpeed: "brisk",
      reducedMotion: true,
    });
  });
});

describe("world map land progress and bus routes", () => {
  it("counts owned and total discoverable stickers per land from world data", () => {
    const { world, fixtures } = loadContent();
    const plaza = fixtures.plaza;
    if (plaza === undefined) throw new Error("Missing plaza fixture");
    const emptyState = createState(world, plaza, 1);
    const initial = landStickerProgress(world, emptyState);

    expect(Object.keys(initial)).toEqual(world.lands.map((land) => land.id));
    expect(initial.cloverhollow).toEqual({ owned: 0, total: 10 });
    expect(initial.bay).toEqual({ owned: 0, total: 4 });
    expect(initial.pass).toEqual({ owned: 0, total: 5 });
    expect(initial.trail).toEqual({ owned: 0, total: 5 });
    expect(initial.forest).toEqual({ owned: 0, total: 3 });
    expect(initial.enchanted).toEqual({ owned: 0, total: 1 });
    expect(initial.hills).toEqual({ owned: 0, total: 7 });

    const withFrogAndKid = landStickerProgress(world, {
      stickers: ["fountain-frog", "hooded-kid"],
    });
    expect(withFrogAndKid.cloverhollow).toEqual({ owned: 1, total: 10 });
    expect(withFrogAndKid.bay).toEqual({ owned: 1, total: 4 });
    expect(withFrogAndKid.enchanted).toEqual({ owned: 1, total: 1 });
  });

  it("gates the three bus routes on visited_bay/sue_joined and visited_pass/rode_bus", () => {
    const { world } = loadContent();
    const none = mapBusRoutes(world.lands, () => false);
    expect(none).toEqual([
      { from: "cloverhollow", to: "bay", open: false },
      { from: "cloverhollow", to: "pass", open: false },
      { from: "bay", to: "pass", open: false },
    ]);

    const bayOnly = mapBusRoutes(
      world.lands,
      (name) => name === "visited_bay",
    );
    expect(bayOnly).toEqual([
      { from: "cloverhollow", to: "bay", open: true },
      { from: "cloverhollow", to: "pass", open: false },
      { from: "bay", to: "pass", open: false },
    ]);

    const passOnly = mapBusRoutes(
      world.lands,
      (name) => name === "visited_pass",
    );
    expect(passOnly).toEqual([
      { from: "cloverhollow", to: "bay", open: false },
      { from: "cloverhollow", to: "pass", open: true },
      { from: "bay", to: "pass", open: false },
    ]);

    const allOpen = mapBusRoutes(
      world.lands,
      (name) => name === "sue_joined" || name === "rode_bus",
    );
    expect(allOpen).toEqual([
      { from: "cloverhollow", to: "bay", open: true },
      { from: "cloverhollow", to: "pass", open: true },
      { from: "bay", to: "pass", open: true },
    ]);
  });
});
