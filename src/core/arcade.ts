import { clawView, newClaw, stepClaw, type ClawGame, type ClawView } from "./claw";
import { cookView, newCook, stepCook, type CookGame, type CookView } from "./cook";
import { moleView, newMole, stepMole, type MoleGame, type MoleView } from "./mole";
import { newSkee, skeeView, stepSkee, type SkeeGame, type SkeeView } from "./skee";
import type { ActionFrame, ArcadeStep, State, World } from "./types";

// The arcade's games (spec 8.2): a line tagged `play: <game> <price>` opens one.
// The clubhouse microwave's cooking game opens the same way, with Mom's dino
// nuggets or her mac n cheese.
export const arcadeGames = ["claw", "skee", "mole", "cook-nuggets", "cook-mac"] as const;
export type ArcadeGameId = (typeof arcadeGames)[number];
export function isArcadeGameId(value: string): value is ArcadeGameId {
  return arcadeGames.some((game) => game === value);
}
export type ArcadeGame = ClawGame | SkeeGame | MoleGame | CookGame;
export type ArcadeView = ClawView | SkeeView | MoleView | CookView;

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
    case "cook-nuggets":
      return { ...paid, arcade: newCook("nuggets") };
    case "cook-mac":
      return { ...paid, arcade: newCook("mac") };
  }
}

// One tick of the open game, if there is one. Only cooking pays snacks.
export function stepArcade(world: World, state: State, input: ActionFrame): ArcadeStep {
  const game = state.arcade;
  const snacks = state.snacks;
  if (game === null)
    return { arcade: null, prizes: state.prizes, tickets: state.tickets, snacks };
  switch (game.game) {
    case "claw":
      return { ...stepClaw(world, state, game, input), snacks };
    case "skee":
      return { ...stepSkee(world, state, game, input), snacks };
    case "mole":
      return { ...stepMole(world, state, game, input), snacks };
    case "cook":
      return stepCook(world, state, game, input);
  }
}

export function arcadeView(world: World, state: State): ArcadeView | null {
  const game = state.arcade;
  if (game === null) return null;
  switch (game.game) {
    case "claw":
      return clawView(world, state, game);
    case "skee":
      return skeeView(world, game);
    case "mole":
      return moleView(world, game);
    case "cook":
      return cookView(world, game);
  }
}
