import {
  blankInput,
  createState,
  newTaco,
  stepArcade,
  tacoView,
  type ActionFrame,
  type Fixture,
  type State,
  type TacoTopping,
  type TacoView,
  type World,
} from "../core";

// Chef Mateo's Taco Truck gallery states (spec 8.2), each produced by stepping
// the real core simulation: mid-order serving (with two toppings stacked and
// the next step highlighted) and celebratory order-clear (with the star-lime
// garnish and ORDER UP! ribbon).
export const tacoGalleryStates = [
  "arcade-taco-serving",
  "arcade-taco-clear",
] as const;

const TOPPING_MOVE: Readonly<Record<TacoTopping, { x: number; y: number }>> = {
  beans: { x: 0, y: -1 },
  cheese: { x: 1, y: 0 },
  salsa: { x: 0, y: 1 },
  avocado: { x: -1, y: 0 },
};

export function tacoGalleryView(
  world: World,
  fixture: Fixture,
  name: string,
): TacoView | null {
  if (!tacoGalleryStates.some((state) => state === name)) return null;
  const free = blankInput();
  const confirm: ActionFrame = { ...blankInput(), confirm: true };
  const tick = (state: State, input: ActionFrame): State => {
    const stepped = stepArcade(world, state, input);
    return {
      ...state,
      arcade: stepped.arcade,
      prizes: stepped.prizes,
      tickets: stepped.tickets,
      snacks: stepped.snacks,
      ...(stepped.coins === undefined ? {} : { coins: stepped.coins }),
      previousInput: input,
    };
  };

  const base = createState(world, fixture, 23);
  const [round, drawn] = newTaco(world.arcade.taco, base);
  let state: State = { ...drawn, arcade: round };
  // Start the lunch rush.
  state = tick(state, confirm);
  state = tick(state, free);

  const stackNext = (): void => {
    const game = state.arcade;
    if (game?.game !== "taco" || game.phase !== "serving") {
      throw new Error("taco gallery expected serving phase");
    }
    const next = game.orders[game.orderIndex]?.recipe[game.stepIndex];
    if (next === undefined) throw new Error("taco gallery missing recipe step");
    state = tick(state, { ...blankInput(), move: TOPPING_MOVE[next] });
    state = tick(state, free);
  };

  // Stack 2 toppings on order 1 so both completed checkmarks and active highlight show.
  stackNext();
  stackNext();
  if (name === "arcade-taco-serving") {
    const game = state.arcade;
    if (game?.game !== "taco") throw new Error("taco serving gallery failed");
    return tacoView(world, game);
  }

  // Finish order 1 to enter the celebratory order-clear state.
  while (state.arcade?.game === "taco" && state.arcade.phase === "serving") {
    stackNext();
  }
  const game = state.arcade;
  if (game?.game !== "taco" || game.phase !== "order-clear") {
    throw new Error("taco clear gallery failed");
  }
  return tacoView(world, game);
}
