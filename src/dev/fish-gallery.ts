import {
  blankInput,
  createState,
  fishView,
  newFish,
  stepArcade,
  type ActionFrame,
  type FishView,
  type Fixture,
  type State,
  type World,
} from "../core";

// Bubblegum Bay fishing gallery states (spec 8.2), each produced by stepping
// the real core simulation: aiming the cast power gauge, reeling a hooked fish
// in the watercolor meter, and celebrating a new catch reveal medallion.
export const fishGalleryStates = [
  "arcade-fish-aim",
  "arcade-fish-reeling",
  "arcade-fish-catch",
] as const;

export function fishGalleryView(
  world: World,
  fixture: Fixture,
  name: string,
): FishView | null {
  if (!fishGalleryStates.some((state) => state === name)) return null;
  const free = blankInput();
  const press: ActionFrame = { ...blankInput(), confirm: true };
  const tick = (state: State, input: ActionFrame): State => {
    const stepped = stepArcade(world, state, input);
    return {
      ...state,
      arcade: stepped.arcade,
      prizes: stepped.prizes,
      tickets: stepped.tickets,
      snacks: stepped.snacks,
      ...(stepped.coins === undefined ? {} : { coins: stepped.coins }),
      ...(stepped.rng === undefined ? {} : { rng: stepped.rng }),
      ...(stepped.caughtFish === undefined ? {} : { caughtFish: stepped.caughtFish }),
      previousInput: input,
    };
  };

  let state: State = {
    ...createState(world, fixture, 17),
    caughtFish: { minnow: 1, perch: 1 },
    arcade: newFish(world.arcade.fish),
  };

  // Sweep up to high power (~0.84) for aim / deep cast.
  for (let i = 0; i < 36; i += 1) state = tick(state, free);
  if (name === "arcade-fish-aim") {
    const game = state.arcade;
    if (game === null || game.game !== "fish") throw new Error("fish aim failed");
    return fishView(world, state, game);
  }

  // Cast out and wait through nibbles until the bite triggers.
  state = tick(state, press);
  for (let i = 0; i < 400 && state.arcade?.game === "fish" &&
    state.arcade.phase !== "bite"; i += 1) {
    state = tick(state, free);
  }
  // Hook on bite.
  state = tick(state, press);
  state = tick(state, free);

  // Reel cleanly by tracking fishPos with real confirm holds.
  for (let i = 0; i < 400 && state.arcade?.game === "fish" &&
    state.arcade.phase === "reeling"; i += 1) {
    const g = state.arcade;
    if (name === "arcade-fish-reeling" && g.reelProgress >= 0.65 &&
      Math.abs(g.hookPos - g.fishPos) <= world.arcade.fish.zoneHalf * 0.7) {
      return fishView(world, state, g);
    }
    const wantUp = g.hookPos + g.hookVel * 3 < g.fishPos;
    state = tick(state, wantUp ? press : free);
  }

  const game = state.arcade;
  if (game === null || game.game !== "fish") throw new Error(`${name} closed fishing`);
  if (name === "arcade-fish-catch" && game.phase === "result") {
    return fishView(world, state, { ...game, revealed: game.message.length });
  }
  return fishView(world, state, game);
}
