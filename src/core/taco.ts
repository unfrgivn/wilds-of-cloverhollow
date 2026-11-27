import { nextRandom } from "./random";
import type { ActionFrame, ArcadeStep, State, TacoContent, World } from "./types";

// Chef Mateo's Taco Truck Kitchen (spec 8.2): a cozy 3-order lunch shift in
// Clover Hills. Match each hanging order ticket's toppings in order using the
// four directional inputs (or clicking/tapping the painted topping bowls):
//
//   up -> beans | right -> cheese | down -> salsa | left -> avocado
//
//   ready ──confirm──▶ serving ──last topping──▶ order-clear ──clearTicks──▶ next / result
//   ready ──cancel───▶ closed
//   serving ──timeLeft=0──▶ result ──press, press──▶ closed
export const tacoToppings = ["beans", "cheese", "salsa", "avocado"] as const;
export type TacoTopping = (typeof tacoToppings)[number];
export type TacoPhase = "ready" | "serving" | "order-clear" | "result";

export type TacoOrder = {
  customer: string;
  recipe: TacoTopping[];
};

export type TacoGame = {
  game: "taco";
  phase: TacoPhase;
  phaseTicks: number;
  timeLeft: number;
  orders: TacoOrder[];
  orderIndex: number;
  stepIndex: number;
  served: number;
  mistakes: number;
  oopsTicks: number;
  lastTopping: TacoTopping | null;
  score: number;
  message: string;
  revealed: number;
};

export type TacoView = {
  game: "taco";
  phase: TacoPhase;
  phaseTicks: number;
  timeLeft: number;
  timeMax: number;
  orders: TacoOrder[];
  orderIndex: number;
  currentOrder: TacoOrder | null;
  stepIndex: number;
  served: number;
  totalOrders: number;
  mistakes: number;
  oopsTicks: number;
  lastTopping: TacoTopping | null;
  score: number;
  toppings: Record<TacoTopping, string>;
  hint: string;
  canCancel: boolean;
  message: string;
  revealed: number;
};

export const GENTLE_TACO_TIME_SCALE = 1.5;
export const GENTLE_TACO_MAX_SIZE = 4;

export function tacoShiftTicks(taco: TacoContent, gentleTiming = false): number {
  return gentleTiming ? Math.round(taco.shiftTicks * GENTLE_TACO_TIME_SCALE) : taco.shiftTicks;
}

export function tacoOrderSize(
  taco: TacoContent,
  index: number,
  gentleTiming = false,
): number {
  const base = taco.orderSizes[index] ?? taco.orderSizes.at(-1) ?? 3;
  return gentleTiming ? Math.min(GENTLE_TACO_MAX_SIZE, base) : base;
}

// A fresh directional edge maps directly to its painted topping bowl, matching
// Boop-a-Mole's edge rule so holding a key never double-fires.
export function tacoDirectionTopping(
  input: ActionFrame,
  previous: ActionFrame,
): TacoTopping | null {
  if (input.move.y < 0 && !(previous.move.y < 0)) return "beans";
  if (input.move.x > 0 && !(previous.move.x > 0)) return "cheese";
  if (input.move.y > 0 && !(previous.move.y > 0)) return "salsa";
  if (input.move.x < 0 && !(previous.move.x < 0)) return "avocado";
  return null;
}

// Draws 3 distinct customers and deterministic recipes (never 3 identical
// toppings in a row) from the game's pure PRNG.
export function newTaco(
  taco: TacoContent,
  state: State,
  gentleTiming = false,
): [TacoGame, State] {
  let current = state;
  const remaining = [...taco.customers];
  const orders: TacoOrder[] = [];
  for (let orderIndex = 0; orderIndex < taco.orders; orderIndex += 1) {
    const [custRoll, afterCust] = nextRandom(current);
    current = afterCust;
    const pool = remaining.length > 0 ? remaining : taco.customers;
    const pick = Math.min(pool.length - 1, Math.floor(custRoll * pool.length));
    const customer = pool[pick] ?? taco.customers[0] ?? "Sue";
    if (remaining.length > 0) remaining.splice(pick, 1);

    const size = tacoOrderSize(taco, orderIndex, gentleTiming);
    const recipe: TacoTopping[] = [];
    for (let step = 0; step < size; step += 1) {
      const [topRoll, afterTop] = nextRandom(current);
      current = afterTop;
      const last = recipe.at(-1);
      const prev = recipe.at(-2);
      const choices = last !== undefined && last === prev
        ? tacoToppings.filter((item) => item !== last)
        : tacoToppings;
      const chosen = choices[Math.min(choices.length - 1, Math.floor(topRoll * choices.length))] ??
        "beans";
      recipe.push(chosen);
    }
    orders.push({ customer, recipe });
  }
  return [{
    game: "taco",
    phase: "ready",
    phaseTicks: 0,
    timeLeft: tacoShiftTicks(taco, gentleTiming),
    orders,
    orderIndex: 0,
    stepIndex: 0,
    served: 0,
    mistakes: 0,
    oopsTicks: 0,
    lastTopping: null,
    score: 0,
    message: "",
    revealed: 0,
  }, current];
}

function finishShift(taco: TacoContent, state: State, game: TacoGame): ArcadeStep {
  const spotless = game.served >= game.orders.length && game.mistakes === 0;
  const coinsEarned = game.served * taco.coinsPerOrder + (spotless ? taco.coinsPerOrder : 0);
  const snacksEarned = spotless
    ? taco.snacksSpotless
    : game.served >= 2
      ? taco.snacksTwoOrders
      : 0;
  const message = spotless
    ? taco.lines.spotless
      .replace("{coins}", String(coinsEarned))
      .replace("{snacks}", String(snacksEarned))
    : game.served >= 2 && snacksEarned > 0
      ? taco.lines.great
        .replace("{orders}", String(game.served))
        .replace("{coins}", String(coinsEarned))
        .replace("{snacks}", String(snacksEarned))
      : game.served >= 1
        ? taco.lines.good
          .replace("{orders}", String(game.served))
          .replace("{coins}", String(coinsEarned))
        : taco.lines.timeUp;
  return {
    arcade: {
      ...game,
      phase: "result",
      phaseTicks: 0,
      oopsTicks: 0,
      message,
      revealed: 0,
    },
    prizes: state.prizes,
    tickets: state.tickets,
    snacks: state.snacks + snacksEarned,
    ...(coinsEarned > 0 ? { coins: state.coins + coinsEarned } : {}),
  };
}

export function stepTaco(
  world: World,
  state: State,
  game: TacoGame,
  input: ActionFrame,
  gentleTiming = false,
): ArcadeStep {
  const taco = world.arcade.taco;
  const pressConfirm = input.confirm && !state.previousInput.confirm;
  const pressCancel = input.cancel && !state.previousInput.cancel;
  const kept = { prizes: state.prizes, tickets: state.tickets, snacks: state.snacks };

  switch (game.phase) {
    case "ready": {
      if (pressCancel) return { arcade: null, ...kept };
      if (pressConfirm) {
        const orders = gentleTiming
          ? game.orders.map((order) => ({
              ...order,
              recipe: order.recipe.slice(0, GENTLE_TACO_MAX_SIZE),
            }))
          : game.orders;
        const timeLeft = gentleTiming
          ? Math.max(game.timeLeft, tacoShiftTicks(taco, true))
          : game.timeLeft;
        return {
          arcade: {
            ...game,
            orders,
            timeLeft,
            phase: "serving",
            phaseTicks: 0,
          },
          ...kept,
        };
      }
      return { arcade: { ...game, phaseTicks: game.phaseTicks + 1 }, ...kept };
    }
    case "serving": {
      const nextTime = Math.max(0, game.timeLeft - 1);
      const nextOops = Math.max(0, game.oopsTicks - 1);
      const picked = tacoDirectionTopping(input, state.previousInput);
      const order = game.orders[game.orderIndex];
      if (picked !== null && order !== undefined) {
        const expected = order.recipe[game.stepIndex];
        if (picked === expected) {
          const nextStep = game.stepIndex + 1;
          if (nextStep >= order.recipe.length) {
            return {
              arcade: {
                ...game,
                phase: "order-clear",
                phaseTicks: 0,
                timeLeft: nextTime,
                stepIndex: nextStep,
                served: game.served + 1,
                oopsTicks: 0,
                lastTopping: picked,
                score: game.score + 35,
              },
              ...kept,
            };
          }
          const stacked: TacoGame = {
            ...game,
            phaseTicks: game.phaseTicks + 1,
            timeLeft: nextTime,
            stepIndex: nextStep,
            oopsTicks: 0,
            lastTopping: picked,
            score: game.score + 10,
          };
          return nextTime <= 0
            ? finishShift(taco, state, stacked)
            : { arcade: stacked, ...kept };
        }
        const missed: TacoGame = {
          ...game,
          phaseTicks: game.phaseTicks + 1,
          timeLeft: nextTime,
          mistakes: game.mistakes + 1,
          oopsTicks: taco.oopsTicks,
        };
        return nextTime <= 0
          ? finishShift(taco, state, missed)
          : { arcade: missed, ...kept };
      }
      if (nextTime <= 0) {
        return finishShift(taco, state, { ...game, timeLeft: 0, oopsTicks: 0 });
      }
      return {
        arcade: {
          ...game,
          phaseTicks: game.phaseTicks + 1,
          timeLeft: nextTime,
          oopsTicks: nextOops,
        },
        ...kept,
      };
    }
    case "order-clear": {
      const nextTicks = game.phaseTicks + 1;
      if (nextTicks >= taco.clearTicks) {
        if (game.orderIndex + 1 < game.orders.length) {
          if (game.timeLeft <= 0) return finishShift(taco, state, game);
          return {
            arcade: {
              ...game,
              phase: "serving",
              phaseTicks: 0,
              orderIndex: game.orderIndex + 1,
              stepIndex: 0,
              oopsTicks: 0,
              lastTopping: null,
            },
            ...kept,
          };
        }
        return finishShift(taco, state, game);
      }
      return { arcade: { ...game, phaseTicks: nextTicks }, ...kept };
    }
    case "result": {
      const dismiss = pressConfirm || pressCancel;
      if (game.revealed < game.message.length) {
        const revealed = dismiss
          ? game.message.length
          : Math.min(game.message.length, game.revealed + world.tunables.interact.revealPerTick);
        return { arcade: { ...game, revealed }, ...kept };
      }
      return { arcade: dismiss ? null : game, ...kept };
    }
  }
}

export function tacoView(
  world: World,
  game: TacoGame,
  gentleTiming = false,
): TacoView {
  const taco = world.arcade.taco;
  const currentOrder = game.orders[game.orderIndex] ?? null;
  const customer = currentOrder?.customer ?? "";
  const hint = game.phase === "ready"
    ? taco.lines.ready
    : game.phase === "serving"
      ? (game.oopsTicks > 0 ? taco.lines.oops : taco.lines.serving)
      : game.phase === "order-clear"
        ? taco.lines.orderUp.replace("{customer}", customer)
        : "";
  return {
    game: "taco",
    phase: game.phase,
    phaseTicks: game.phaseTicks,
    timeLeft: game.timeLeft,
    timeMax: Math.max(game.timeLeft, tacoShiftTicks(taco, gentleTiming)),
    orders: game.orders,
    orderIndex: game.orderIndex,
    currentOrder,
    stepIndex: game.stepIndex,
    served: game.served,
    totalOrders: game.orders.length,
    mistakes: game.mistakes,
    oopsTicks: game.oopsTicks,
    lastTopping: game.lastTopping,
    score: game.score,
    toppings: taco.toppings,
    hint,
    canCancel: game.phase === "ready",
    message: game.message,
    revealed: game.revealed,
  };
}
