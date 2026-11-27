import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  arcadeView,
  blankInput,
  createState,
  fishAimPower,
  fishCatalogSummary,
  fishView,
  fishWavePosition,
  newFish,
  openArcade,
  parseSave,
  pickFishCatch,
  runInk,
  serializeSave,
  soundCues,
  step,
  stepArcade,
  type ActionFrame,
  type FishGame,
  type State,
} from "../../src/core";
import { loadContent, parseFishCalibration } from "../../src/content/load";
import { fishCell, layoutFish } from "../../src/ui/fish-layout";

const content = loadContent();
const world = content.world;
const fish = world.arcade.fish;
const bayFixture = content.fixtures.bay;
if (bayFixture === undefined) throw new Error("bay fixture is missing");
const fixture = bayFixture;

const free: ActionFrame = blankInput();
const holdConfirm: ActionFrame = { ...blankInput(), confirm: true };
const holdCancel: ActionFrame = { ...blankInput(), cancel: true };

const calibrationFile = "public/assets/arcade/fishing-dock.json";
const calibration = parseFishCalibration(
  JSON.parse(readFileSync(calibrationFile, "utf8")),
  calibrationFile,
);

function startFishing(seed = 7, caughtFish?: Record<string, number>): State {
  const base = createState(world, fixture, seed);
  return {
    ...openArcade(world, base, "fish", 0),
    ...(caughtFish === undefined ? {} : { caughtFish }),
  };
}

function tick(state: State, input: ActionFrame, gentleTiming = false): State {
  return step(world, state, input, { gentleTiming }).state;
}

function gameOf(state: State): FishGame {
  const open = state.arcade;
  if (open === null || open.game !== "fish") throw new Error("fishing is not open");
  return open;
}

function castAndWaitToBite(initial: State, aimTicks: number): { state: State; nibbles: number } {
  let state = initial;
  for (let i = 0; i < aimTicks; i += 1) state = tick(state, free);
  state = tick(state, holdConfirm);
  state = tick(state, free);
  let nibbles = 0;
  for (let i = 0; i < 400 && state.arcade?.game === "fish" &&
    state.arcade.phase !== "bite"; i += 1) {
    const prev = state;
    state = tick(state, free);
    if (prev.arcade?.game === "fish" && state.arcade?.game === "fish" &&
        state.arcade.nibblesLeft < prev.arcade.nibblesLeft) {
      nibbles += 1;
    }
  }
  return { state, nibbles };
}

describe("Bubblegum Bay fishing core", () => {
  it("sweeps aim power smoothly from 0 to 1 and back over aimPeriod", () => {
    expect(fishAimPower(0, fish.aimPeriod)).toBe(0);
    expect(fishAimPower(fish.aimPeriod / 2, fish.aimPeriod)).toBe(1);
    expect(fishAimPower(fish.aimPeriod, fish.aimPeriod)).toBe(0);
    let state = startFishing();
    for (let i = 0; i < fish.aimPeriod / 2; i += 1) state = tick(state, free);
    expect(gameOf(state).power).toBeCloseTo(1, 5);
  });

  it("casts over castTicks, ripples through nibbles, and enters bite", () => {
    let state = startFishing(11);
    for (let i = 0; i < 20; i += 1) state = tick(state, free);
    state = tick(state, holdConfirm);
    expect(gameOf(state).phase).toBe("casting");
    for (let i = 1; i < fish.castTicks; i += 1) {
      state = tick(state, free);
      expect(gameOf(state).phase).toBe("casting");
    }
    state = tick(state, free);
    expect(gameOf(state).phase).toBe("waiting");
    const waited = castAndWaitToBite(startFishing(11), 20);
    expect(gameOf(waited.state).phase).toBe("bite");
    expect(waited.nibbles).toBeGreaterThanOrEqual(1);
    expect(waited.nibbles).toBeLessThanOrEqual(2);
  });

  it("handles early pull during waiting and bite timeout under normal & gentle timing", () => {
    let early = startFishing(5);
    early = tick(early, holdConfirm);
    for (let i = 0; i < fish.castTicks + 2; i += 1) early = tick(early, free);
    expect(gameOf(early).phase).toBe("waiting");
    early = tick(early, holdConfirm);
    expect(gameOf(early).phase).toBe("result");
    expect(gameOf(early).caught).toBeNull();
    expect(gameOf(early).message).toBe(fish.lines.early);

    const normalBite = castAndWaitToBite(startFishing(19), 24).state;
    let normal = normalBite;
    for (let i = 0; i < fish.biteTicks - 1; i += 1) {
      normal = tick(normal, free, false);
      expect(gameOf(normal).phase).toBe("bite");
    }
    normal = tick(normal, free, false);
    expect(gameOf(normal).phase).toBe("result");
    expect(gameOf(normal).caught).toBeNull();
    expect(gameOf(normal).message).toBe(fish.lines.missed);

    let gentle = normalBite;
    for (let i = 0; i < fish.biteTicks + 19; i += 1) {
      gentle = tick(gentle, free, true);
      expect(gameOf(gentle).phase).toBe("bite");
    }
    gentle = tick(gentle, free, true);
    expect(gameOf(gentle).phase).toBe("result");
  });

  it("widens the reel zone and halves drain under Gentle Timing", () => {
    const atBite = castAndWaitToBite(startFishing(23), 30).state;
    const hooked = tick(atBite, holdConfirm);
    expect(gameOf(hooked).phase).toBe("reeling");
    const normalView = arcadeView(world, hooked, false);
    const gentleView = arcadeView(world, hooked, true);
    if (normalView?.game !== "fish" || gentleView?.game !== "fish")
      throw new Error("expected fish view");
    expect(gentleView.zoneHalf).toBeCloseTo(normalView.zoneHalf + 0.08, 6);

    const far: State = {
      ...hooked,
      arcade: { ...gameOf(hooked), hookPos: 0.02, hookVel: 0, fishPos: 0.85, reelProgress: 0.5 },
    };
    const normalDrain = stepArcade(world, far, free, false);
    const gentleDrain = stepArcade(world, far, free, true);
    if (normalDrain.arcade?.game !== "fish" || gentleDrain.arcade?.game !== "fish")
      throw new Error("expected reeling fish");
    expect(0.5 - normalDrain.arcade.reelProgress).toBeCloseTo(fish.reelDrain, 6);
    expect(0.5 - gentleDrain.arcade.reelProgress).toBeCloseTo(fish.reelDrain * 0.5, 6);
  });

  it("reels in a catch, awards coins, snacks, caughtFish, isNew, and emits all 5 cues", () => {
    const cues: string[] = [];
    let state = startFishing(17);
    const record = (input: ActionFrame): void => {
      const next = tick(state, input);
      cues.push(...soundCues(state, next, world));
      state = next;
    };
    for (let i = 0; i < 36; i += 1) record(free);
    record(holdConfirm);
    record(free);
    for (let i = 0; i < 400 && state.arcade?.game === "fish" &&
      state.arcade.phase !== "bite"; i += 1) record(free);
    expect(gameOf(state).phase).toBe("bite");
    record(holdConfirm);
    record(free);
    expect(gameOf(state).phase).toBe("reeling");
    for (let i = 0; i < 400 && state.arcade?.game === "fish" &&
      state.arcade.phase === "reeling"; i += 1) {
      const g = gameOf(state);
      const wantUp = g.hookPos + g.hookVel * 3 < g.fishPos;
      record(wantUp ? holdConfirm : free);
    }
    const caughtGame = gameOf(state);
    expect(caughtGame.phase).toBe("result");
    expect(caughtGame.caught).not.toBeNull();
    expect(caughtGame.isNew).toBe(true);
    const spec = fish.catches.find((item) => item.id === caughtGame.caught);
    if (spec === undefined) throw new Error("missing caught spec");
    expect(state.coins).toBe(spec.coins);
    expect(state.snacks).toBe(2 + spec.snacks);
    expect(state.caughtFish?.[spec.id]).toBe(1);
    expect(cues).toContain("fish-cast");
    expect(cues).toContain("fish-nibble");
    expect(cues).toContain("fish-bite");
    expect(cues).toContain("fish-reel");
    expect(cues).toContain("fish-catch");

    // Confirm reveals full text, then second confirm closes back to dock.
    record(holdConfirm);
    record(free);
    expect(gameOf(state).revealed).toBe(caughtGame.message.length);
    record(holdConfirm);
    record(free);
    expect(state.arcade).toBeNull();
  });

  it("can reach all 6 Bubblegum Bay species across power levels", () => {
    const found = new Set<string>();
    for (let power = 0; power <= 1.001; power += 0.2) {
      for (let roll = 0; roll < 1; roll += 0.01) {
        found.add(pickFishCatch(fish.catches, Math.min(1, power), roll).id);
      }
    }
    expect([...found].sort()).toEqual(fish.catches.map((item) => item.id).sort());
    // Low power only yields minPower === 0 catches.
    for (let roll = 0; roll < 1; roll += 0.05) {
      expect(pickFishCatch(fish.catches, 0.1, roll).minPower).toBe(0);
    }
    // Wave stays bounded in 0.14..0.86.
    for (let t = 0; t < 500; t += 1) {
      const y = fishWavePosition(0.019, 421, t);
      expect(y).toBeGreaterThanOrEqual(0.14);
      expect(y).toBeLessThanOrEqual(0.86);
    }
  });

  it("lets cancel pack up the rod cleanly during aim and waiting", () => {
    let aim = startFishing(3);
    aim = tick(aim, free);
    aim = tick(aim, holdCancel);
    expect(aim.arcade).toBeNull();

    let wait = startFishing(3);
    wait = tick(wait, holdConfirm);
    for (let i = 0; i < fish.castTicks + 2; i += 1) wait = tick(wait, free);
    expect(gameOf(wait).phase).toBe("waiting");
    wait = tick(wait, holdCancel);
    expect(wait.arcade).toBeNull();
  });

  it("preserves caughtFish across save round-trip (version 10) and loads old saves", () => {
    const template = createState(world, fixture);
    const saved: State = { ...template, caughtFish: { minnow: 2, starfish: 1 } };
    const encoded = serializeSave(saved);
    const parsedJson: unknown = JSON.parse(encoded);
    expect(parsedJson).toMatchObject({ version: 10 });
    const loaded = parseSave(encoded, template);
    expect(loaded?.caughtFish).toEqual({ minnow: 2, starfish: 1 });
    expect(fishCatalogSummary(world, saved)).toEqual({ caught: 2, total: 6, trophy: true });

    // Save without caughtFish loads cleanly.
    const oldEncoded = serializeSave(template);
    const oldLoaded = parseSave(oldEncoded, template);
    expect(oldLoaded).not.toBeNull();
    expect(oldLoaded?.caughtFish).toBeUndefined();
    expect(fishCatalogSummary(world, template)).toEqual({ caught: 0, total: 6, trophy: false });
  });

  it("preserves dock_end bottle quest before offering fishing after sue_joined", () => {
    const withLasso = createState(world, {
      ...fixture,
      variables: { has_lasso: true, sue_joined: true },
    });
    const bottle = runInk(world.story, withLasso.ink, { type: "start", knot: "dock_end" });
    expect(bottle.line?.text).toContain("bottle");

    const withSue = createState(world, {
      ...fixture,
      variables: { sue_joined: true },
    });
    const spot = runInk(world.story, withSue.ink, { type: "start", knot: "dock_end" });
    expect(spot.choices).toEqual(["Go fishing with Sue!", "Just enjoy the view"]);
    const goFish = runInk(world.story, spot.ink, { type: "choose", index: 0 });
    expect(goFish.line?.tags).toContain("play: fish 0");
  });

  it("lays out cleanly inside 667x375, 874x402, 1180x820, and 1280x720 viewports", () => {
    const atlas: unknown = JSON.parse(
      readFileSync("public/assets/arcade/fish-catches.json", "utf8"),
    );
    const frames = typeof atlas === "object" && atlas !== null && "frames" in atlas &&
      typeof atlas.frames === "object" && atlas.frames !== null ? atlas.frames : {};
    for (const item of fish.catches) {
      const entry: unknown = Object.entries(frames).find(([name]) => name === item.frame)?.[1];
      expect(entry, item.frame).toMatchObject({ frame: { w: fishCell.w, h: fishCell.h } });
    }
    const base = startFishing(17, { minnow: 1 });
    const view = fishView(world, base, {
      ...newFish(fish),
      phase: "result",
      caught: "starfish",
      isNew: true,
      message: fish.catches[5]?.line ?? "",
      revealed: 99,
    });
    const viewports = [
      { width: 667, height: 375, touch: true },
      { width: 874, height: 402, touch: true },
      { width: 1180, height: 820, touch: true },
      { width: 1280, height: 720, touch: false },
    ];
    for (const vp of viewports) {
      const availW = vp.width - (vp.touch ? 226 : 40);
      const availH = vp.height - 56;
      const scale = Math.min(availW / calibration.size.w, availH / calibration.size.h);
      const layout = layoutFish(view, calibration, scale);
      expect(layout.width).toBeLessThanOrEqual(availW + 1);
      expect(layout.height).toBeLessThanOrEqual(availH + 1);
      const parts = [
        layout.water, layout.front, layout.book, layout.escape,
        layout.powerGauge, layout.reelMeter, layout.catchCard, layout.biteBadge,
      ];
      for (const part of parts) {
        expect(part.x).toBeGreaterThanOrEqual(0);
        expect(part.y).toBeGreaterThanOrEqual(0);
        expect(part.x + part.width).toBeLessThanOrEqual(layout.width + 1);
        expect(part.y + part.height).toBeLessThanOrEqual(layout.height + 1);
      }
      // Catch book stays above catch card, and catch card stays above bottom dock dialogue zone.
      expect(layout.book.y + layout.book.height).toBeLessThan(layout.catchCard.y);
      expect(layout.catchCard.y + layout.catchCard.height)
        .toBeLessThan(Math.round(calibration.dockY * scale));
    }
  });
});
