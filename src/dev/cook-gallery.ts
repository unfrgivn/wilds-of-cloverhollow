import {
  blankInput,
  cookView,
  createState,
  newCook,
  stepArcade,
  type ActionFrame,
  type CookDish,
  type CookView,
  type Fixture,
  type State,
  type World,
} from "../core";

// The clubhouse microwave's gallery states (spec 8.2), each a real game state
// the core cooked: ready to start, cooking at golden, stopped still frozen, and
// out golden and burnt, its line typed to the end.
export const cookGalleryStates = [
  "cook-ready",
  "cook-golden",
  "cook-frozen",
  "cook-result",
  "cook-burnt",
] as const;

export function cookGalleryView(world: World, fixture: Fixture, name: string): CookView | null {
  const held: ActionFrame = { ...blankInput(), confirm: true };
  const free = blankInput();
  const tick = (state: State, input: ActionFrame): State =>
    ({ ...state, ...stepArcade(world, state, input), previousInput: input });
  // Holds the button `ticks` ticks (the first a press); `release` lets go, and
  // waits out the ding to the result, typed to the end.
  const cooked = (dish: CookDish, ticks: number, release: boolean): CookView => {
    let state: State = { ...createState(world, fixture), arcade: newCook(dish) };
    for (let count = 0; count < ticks; count += 1) state = tick(state, held);
    if (release) {
      state = tick(state, free);
      for (let count = 0; count < 200 && state.arcade?.game === "cook" &&
        state.arcade.phase === "ding"; count += 1) state = tick(state, free);
      if (state.arcade?.game === "cook" && state.arcade.phase === "result")
        state = { ...state, arcade: { ...state.arcade, revealed: state.arcade.message.length } };
    }
    const game = state.arcade;
    if (game === null || game.game !== "cook") throw new Error(`${name} closed the microwave`);
    return cookView(world, game);
  };
  const perSecond = world.arcade.cook.ticksPerSecond;
  switch (name) {
    case "cook-ready":
      return cooked("nuggets", 0, false);
    case "cook-golden":
      return cooked("nuggets", 60 * perSecond, false);
    case "cook-frozen":
      return cooked("mac", 20 * perSecond, true);
    case "cook-result":
      return cooked("mac", 90 * perSecond, true);
    case "cook-burnt":
      return cooked("nuggets", 100 * perSecond, true);
    default:
      return null;
  }
}
