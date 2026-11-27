import { clawView, newClaw, stepClaw, type ClawGame, type ClawView } from "./claw";
import { cookView, newCook, stepCook, type CookGame, type CookView } from "./cook";
import { fishView, newFish, stepFish, type FishGame, type FishView } from "./fish";
import { moleView, newMole, stepMole, type MoleGame, type MoleView } from "./mole";
import { cometView, newComet, stepComet, type CometGame, type CometView } from "./comet";
import { newSkee, skeeView, stepSkee, type SkeeGame, type SkeeView } from "./skee";
import type { ActionFrame, ArcadeStep, State, World } from "./types";

// The arcade's games (spec 8.2): a line tagged `play: <game> <price>` opens one.
// The clubhouse microwave's cooking game and Bubblegum Bay's fishing spot open
// the same way.
export const arcadeGames = [
  "claw", "skee", "mole", "comet", "cook-nuggets", "cook-mac", "fish",
] as const;
export type ArcadeGameId = (typeof arcadeGames)[number];
export function isArcadeGameId(value: string): value is ArcadeGameId {
  return arcadeGames.some((game) => game === value);
}
export type ArcadeGame = ClawGame | SkeeGame | MoleGame | CometGame | CookGame | FishGame;
export type ArcadeView = ClawView | SkeeView | MoleView | CometView | CookView | FishView;

// Pays for a game and starts it. Boop-a-Mole draws its round's holes from
// the game's random generator as it opens.
export function openArcade(world: World, state: State, game: ArcadeGameId, price: number): State {
  const paid = { ...state, coins: state.coins - price };
  switch (game) {
    case "claw":
      return { ...paid, arcade: newClaw(world.arcade.claw) };
    case "skee":
      return { ...paid, arcade: newSkee(world.arcade.skee) };
    case "mole": {
      const [round, drawn] = newMole(world.arcade.mole, paid);
      return { ...drawn, arcade: round };
    }
    case "comet": {
      const [round, drawn] = newComet(world.arcade.comet, paid);
      return { ...drawn, arcade: round };
    }
    case "cook-nuggets":
      return { ...paid, arcade: newCook("nuggets") };
    case "cook-mac":
      return { ...paid, arcade: newCook("mac") };
    case "fish":
      return { ...paid, arcade: newFish(world.arcade.fish) };
  }
}

// One tick of the open game, if there is one.
export function stepArcade(
  world: World,
  state: State,
  input: ActionFrame,
  gentleTiming = false,
): ArcadeStep {
  const game = state.arcade;
  const snacks = state.snacks;
  if (game === null)
    return { arcade: null, prizes: state.prizes, tickets: state.tickets, snacks };
  switch (game.game) {
    case "claw":
      return { ...stepClaw(world, state, game, input, gentleTiming), snacks };
    case "skee":
      return { ...stepSkee(world, state, game, input, gentleTiming), snacks };
    case "mole":
      return { ...stepMole(world, state, game, input, gentleTiming), snacks };
    case "comet":
      return { ...stepComet(world, state, game, input, gentleTiming), snacks };
    case "cook":
      return stepCook(world, state, game, input, gentleTiming);
    case "fish":
      return stepFish(world, state, game, input, gentleTiming);
  }
}

export function arcadeView(
  world: World,
  state: State,
  gentleTiming = false,
): ArcadeView | null {
  const game = state.arcade;
  if (game === null) return null;
  switch (game.game) {
    case "claw":
      return clawView(world, state, game, gentleTiming);
    case "skee":
      return skeeView(world, game);
    case "mole":
      return moleView(world, game);
    case "comet":
      return cometView(world, game);
    case "cook":
      return cookView(world, game, gentleTiming);
    case "fish":
      return fishView(world, state, game, gentleTiming);
  }
}
