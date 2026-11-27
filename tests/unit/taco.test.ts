import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, parseTacoCalibration } from "../../src/content/load";
import {
  arcadeView,
  blankInput,
  createState,
  newTaco,
  openArcade,
  soundCues,
  startDialogue,
  step,
  tacoDirectionTopping,
  tacoShiftTicks,
  type ActionFrame,
  type State,
  type TacoTopping,
} from "../../src/core";
import { classifyTacoPopup } from "../../src/ui/arcade-popups";
import { atlasImagePath, parseAtlasJson } from "../../src/ui/atlas";
import type { Box } from "../../src/ui/dom";
import { layoutTaco } from "../../src/ui/taco-layout";

const { world, fixtures } = loadContent();
const rawFixture = fixtures["hills-calm"] ?? fixtures.hills ?? fixtures["new-game"];
if (rawFixture === undefined) throw new Error("Missing hills fixture");
const hillsFixture = rawFixture;

const TOPPING_MOVE: Readonly<Record<TacoTopping, { x: number; y: number }>> = {
  beans: { x: 0, y: -1 },
  cheese: { x: 1, y: 0 },
  salsa: { x: 0, y: 1 },
  avocado: { x: -1, y: 0 },
};

const confirmFrame: ActionFrame = { ...blankInput(), confirm: true };
const cancelFrame: ActionFrame = { ...blankInput(), cancel: true };

function openTaco(seed = 42, gentleTiming = false): State {
  const base = createState(world, hillsFixture, seed);
  return openArcade(world, base, "taco", 0, gentleTiming);
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe("Chef Mateo's Taco Truck Kitchen (core & layout)", () => {
  it("generates deterministic orders with distinct customers and no 3 identical toppings", () => {
    const baseA = createState(world, hillsFixture, 99);
    const baseB = createState(world, hillsFixture, 99);
    const [roundA, afterA] = newTaco(world.arcade.taco, baseA);
    const [roundB, afterB] = newTaco(world.arcade.taco, baseB);
    expect(roundA).toEqual(roundB);
    expect(afterA.rng).toBe(afterB.rng);
    expect(roundA.orders).toHaveLength(3);
    expect(roundA.orders.map((order) => order.recipe.length)).toEqual([3, 4, 5]);
    expect(new Set(roundA.orders.map((order) => order.customer)).size).toBe(3);
    expect(roundA.timeLeft).toBe(1080);

    for (let seed = 1; seed <= 40; seed += 1) {
      const [round] = newTaco(world.arcade.taco, createState(world, hillsFixture, seed));
      expect(new Set(round.orders.map((order) => order.customer)).size).toBe(3);
      for (const order of round.orders) {
        for (let i = 2; i < order.recipe.length; i += 1) {
          const triple =
            order.recipe[i] === order.recipe[i - 1] &&
            order.recipe[i] === order.recipe[i - 2];
          expect(triple).toBe(false);
        }
      }
    }
  });

  it("widens timer to 1620 ticks and caps order sizes at 4 under Gentle Timing", () => {
    const base = createState(world, hillsFixture, 17);
    const [gentle] = newTaco(world.arcade.taco, base, true);
    expect(gentle.timeLeft).toBe(1620);
    expect(tacoShiftTicks(world.arcade.taco, true)).toBe(1620);
    expect(gentle.orders.map((order) => order.recipe.length)).toEqual([3, 4, 4]);

    // Also applies cleanly when starting from ready with step(..., { gentleTiming: true }).
    let state = openTaco(17, false);
    state = step(world, state, confirmFrame, { gentleTiming: true }).state;
    expect(state.arcade?.game).toBe("taco");
    if (state.arcade?.game === "taco") {
      expect(state.arcade.phase).toBe("serving");
      expect(state.arcade.timeLeft).toBe(1620);
      expect(state.arcade.orders.map((order) => order.recipe.length)).toEqual([3, 4, 4]);
    }
  });

  it("maps directional edges cleanly and exits ready on Cancel", () => {
    const free = blankInput();
    expect(tacoDirectionTopping({ ...free, move: { x: 0, y: -1 } }, free)).toBe("beans");
    expect(tacoDirectionTopping({ ...free, move: { x: 1, y: 0 } }, free)).toBe("cheese");
    expect(tacoDirectionTopping({ ...free, move: { x: 0, y: 1 } }, free)).toBe("salsa");
    expect(tacoDirectionTopping({ ...free, move: { x: -1, y: 0 } }, free)).toBe("avocado");
    // Holding the same direction does not double-fire.
    const upFrame: ActionFrame = { ...free, move: { x: 0, y: -1 } };
    expect(tacoDirectionTopping(upFrame, upFrame)).toBeNull();

    const opened = openTaco(5);
    const left = step(world, opened, cancelFrame).state;
    expect(left.arcade).toBeNull();
  });

  it("handles wrong topping oops without resetting progress and plays a spotless 3/3 shift", () => {
    // 1. Test gentle wrong-topping oops preserves stepIndex and emits mole-whiff.
    let oopsState = openTaco(12);
    oopsState = step(world, oopsState, confirmFrame).state;
    oopsState = step(world, oopsState, blankInput()).state;
    if (oopsState.arcade?.game !== "taco") throw new Error("expected taco");
    const firstOrder = oopsState.arcade.orders[0];
    if (firstOrder === undefined) throw new Error("missing order 0");
    const step0 = firstOrder.recipe[0];
    const step1 = firstOrder.recipe[1];
    if (step0 === undefined || step1 === undefined) throw new Error("missing recipe steps");

    const beforeRight = oopsState;
    oopsState = step(world, oopsState, { ...blankInput(), move: TOPPING_MOVE[step0] }).state;
    expect(soundCues(beforeRight, oopsState, world)).toContain("mole-boop");
    expect(oopsState.arcade?.game === "taco" ? oopsState.arcade.stepIndex : -1).toBe(1);
    expect(oopsState.arcade?.game === "taco" ? oopsState.arcade.score : -1).toBe(10);

    // Release direction, then intentionally pick a wrong topping.
    oopsState = step(world, oopsState, blankInput()).state;
    const wrongTopping: TacoTopping = step1 === "beans" ? "cheese" : "beans";
    const beforeWrong = oopsState;
    oopsState = step(world, oopsState, { ...blankInput(), move: TOPPING_MOVE[wrongTopping] }).state;
    expect(soundCues(beforeWrong, oopsState, world)).toContain("mole-whiff");
    if (oopsState.arcade?.game !== "taco") throw new Error("expected taco");
    expect(oopsState.arcade.stepIndex).toBe(1);
    expect(oopsState.arcade.mistakes).toBe(1);
    expect(oopsState.arcade.oopsTicks).toBe(world.arcade.taco.oopsTicks);

    // 2. Play a spotless 3/3 shift and verify +20 coins, +2 snacks, cook-ding, and prize-won.
    let state = openTaco(31);
    const coinsBefore = state.coins;
    const snacksBefore = state.snacks;
    const cuesSeen: string[] = [];

    const advance = (input: ActionFrame): void => {
      const prev = state;
      state = step(world, state, input).state;
      cuesSeen.push(...soundCues(prev, state, world));
    };

    advance(confirmFrame);
    advance(blankInput());

    for (let guard = 0; guard < 400 && state.arcade?.game === "taco"; guard += 1) {
      const g = state.arcade;
      if (g.phase === "serving") {
        const next = g.orders[g.orderIndex]?.recipe[g.stepIndex];
        if (next === undefined) throw new Error("missing step");
        advance({ ...blankInput(), move: TOPPING_MOVE[next] });
        advance(blankInput());
      } else if (g.phase === "order-clear") {
        advance(blankInput());
      } else {
        break;
      }
    }

    expect(state.arcade?.game).toBe("taco");
    if (state.arcade?.game === "taco") {
      expect(state.arcade.phase).toBe("result");
      expect(state.arcade.served).toBe(3);
      expect(state.arcade.mistakes).toBe(0);
      expect(state.arcade.message).toContain("SPOTLESS TACO SHIFT!");
      expect(state.arcade.message).toContain("Coins +20");
      expect(state.arcade.message).toContain("Snacks +2");
    }
    expect(state.coins).toBe(coinsBefore + 20);
    expect(state.snacks).toBe(snacksBefore + 2);
    expect(cuesSeen).toContain("mole-boop");
    expect(cuesSeen).toContain("cook-ding");
    expect(cuesSeen).toContain("prize-won");
    expect(cuesSeen).toContain("coin");
    expect(cuesSeen).toContain("item");

    // Confirm reveals full text, second confirm closes cleanly.
    advance(confirmFrame);
    advance(blankInput());
    advance(confirmFrame);
    expect(state.arcade).toBeNull();
  });

  it("pays partial coins and snacks on timeout", () => {
    let state = openTaco(7);
    const coinsBefore = state.coins;
    const snacksBefore = state.snacks;
    state = step(world, state, confirmFrame).state;
    state = step(world, state, blankInput()).state;

    // Serve 1 full order, then let the shift timer expire.
    while (state.arcade?.game === "taco" && state.arcade.phase === "serving") {
      const next = state.arcade.orders[state.arcade.orderIndex]?.recipe[state.arcade.stepIndex];
      if (next === undefined) break;
      state = step(world, state, { ...blankInput(), move: TOPPING_MOVE[next] }).state;
      state = step(world, state, blankInput()).state;
    }
    while (state.arcade?.game === "taco" && state.arcade.phase !== "result") {
      state = step(world, state, blankInput()).state;
    }
    expect(state.coins).toBe(coinsBefore + 5);
    expect(state.snacks).toBe(snacksBefore);
    if (state.arcade?.game === "taco") {
      expect(state.arcade.message).toContain("1 order(s) complete!");
      expect(state.arcade.message).toContain("Coins +5");
    }

    // Zero orders served -> timeUp line and 0 coins.
    let zero = openTaco(7);
    const zeroCoins = zero.coins;
    zero = step(world, zero, confirmFrame).state;
    zero = step(world, zero, blankInput()).state;
    while (zero.arcade?.game === "taco" && zero.arcade.phase !== "result") {
      zero = step(world, zero, blankInput()).state;
    }
    expect(zero.coins).toBe(zeroCoins);
    if (zero.arcade?.game === "taco") {
      expect(zero.arcade.message).toBe(world.arcade.taco.lines.timeUp);
    }
  });

  it("preserves Chef Mateo choice 0 and opens taco on choice 1", () => {
    const base = {
      ...createState(world, hillsFixture, 1),
      coins: 20,
    };
    let state = startDialogue(world, base, "taco_chef_calm.mateo_shop");
    // Reveal full line so choices are active.
    for (let i = 0; i < 60 && state.dialogue !== null && state.dialogue.choices.length === 0; i++) {
      state = step(world, state, confirmFrame).state;
      state = step(world, state, blankInput()).state;
    }
    expect(state.dialogue?.choices).toEqual([
      "Buy a crispy taco snack for 4 coins",
      "Help run the Taco Truck kitchen!",
      "Just saying hi!",
    ]);

    // Pick choice 1 -> opens Taco Truck kitchen!
    state = step(world, state, { ...blankInput(), choose: 1 }).state;
    for (let i = 0; i < 20 && state.dialogue !== null; i += 1) {
      state = step(world, state, confirmFrame).state;
      state = step(world, state, blankInput()).state;
    }
    expect(state.arcade?.game).toBe("taco");
    expect(state.coins).toBe(20);
  });

  it("validates taco-truck.json calibration, taco-ingredients atlas, popups, and responsive layout",
    () => {
      const calPath = "public/assets/arcade/taco-truck.json";
      const calibration = parseTacoCalibration(JSON.parse(readFileSync(calPath, "utf8")), calPath);
      expect(existsSync(`public/assets/arcade/${calibration.image}`)).toBe(true);

      const atlasPath = "public/assets/arcade/taco-ingredients.json";
      const atlas = parseAtlasJson(JSON.parse(readFileSync(atlasPath, "utf8")), atlasPath);
      expect(existsSync(atlasImagePath(atlasPath, atlas))).toBe(true);
      for (const frame of ["shell", "beans", "cheese", "salsa", "avocado", "lime"]) {
        expect(atlas.frames[frame]).toBeDefined();
      }

      // Popup classifier stays silent on initial open, pops on stack/order-clear/spotless.
      expect(classifyTacoPopup(null, null, 0, "serving", false)).toBeNull();
      expect(classifyTacoPopup(0, "serving", 10, "serving", false)).toEqual({
        kind: "boop",
        text: "+10",
      });
      expect(classifyTacoPopup(30, "serving", 65, "order-clear", false)).toEqual({
        kind: "star",
        text: "ORDER UP! ★",
      });
      expect(classifyTacoPopup(195, "order-clear", 195, "result", true)).toEqual({
        kind: "rare",
        text: "★ SPOTLESS!",
      });

      // Responsive layout fits 667x375, 874x402, 1180x820, and 1280x720 with zero overlap.
      let state = openTaco(15);
      state = step(world, state, confirmFrame).state;
      const view = arcadeView(world, state);
      if (view === null || view.game !== "taco") throw new Error("expected taco view");

      const viewports = [
        { width: 667, height: 375 },
        { width: 874, height: 402 },
        { width: 1180, height: 820 },
        { width: 1280, height: 720 },
      ];
      for (const vp of viewports) {
        const availW = vp.width - 40;
        const availH = vp.height - 56;
        const scale = Math.min(availW / calibration.size.w, availH / calibration.size.h);
        const layout = layoutTaco(view, calibration, scale);
        const stageBox: Box = { x: 0, y: 0, width: layout.width, height: layout.height };
        expect(layout.width).toBeLessThanOrEqual(availW + 1);
        expect(layout.height).toBeLessThanOrEqual(availH + 1);

        const parts = [
          layout.ticket,
          layout.hud,
          layout.escape,
          layout.orderBanner,
          layout.shell,
          layout.front,
          ...layout.bowls.map((item) => item.box),
        ];
        for (const part of parts) {
          expect(part.x).toBeGreaterThanOrEqual(stageBox.x);
          expect(part.y).toBeGreaterThanOrEqual(stageBox.y);
          expect(part.x + part.width).toBeLessThanOrEqual(stageBox.width);
          expect(part.y + part.height).toBeLessThanOrEqual(stageBox.height);
        }
        // Pairwise non-overlap across every UI region!
        for (let i = 0; i < parts.length; i += 1) {
          for (let j = i + 1; j < parts.length; j += 1) {
            const a = parts[i];
            const b = parts[j];
            if (a !== undefined && b !== undefined) {
              expect(overlaps(a, b)).toBe(false);
            }
          }
        }
      }
    });
});
