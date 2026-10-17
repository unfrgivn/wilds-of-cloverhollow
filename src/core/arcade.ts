import { clawView, newClaw, stepClaw, type ClawGame, type ClawView } from "./claw";
import { newSkee, skeeView, stepSkee, type SkeeGame, type SkeeView } from "./skee";
import type { ActionFrame, ArcadeOwned, State, World } from "./types";

// The arcade's games (spec 8.2): a line tagged `play: <game> <price>` opens one.
export const arcadeGames = ["claw", "skee"] as const;
export type ArcadeGameId = (typeof arcadeGames)[number];
export function isArcadeGameId(value: string): value is ArcadeGameId {
  return arcadeGames.some((game) => game === value);
}
export type ArcadeGame = ClawGame | SkeeGame;
export type ArcadeView = ClawView | SkeeView;

// Pays for a game and starts it.
export function openArcade(world: World, state: State, game: ArcadeGameId, price: number): State {
  const arcade = game === "claw" ? newClaw(world.arcade.claw) : newSkee(world.arcade.skee);
  return { ...state, coins: state.coins - price, arcade };
}

// One tick of the open game, if there is one.
export function stepArcade(world: World, state: State, input: ActionFrame): ArcadeOwned {
  const game = state.arcade;
  if (game === null) return { arcade: null, prizes: state.prizes, tickets: state.tickets };
  return game.game === "claw" ? stepClaw(world, state, game, input)
    : stepSkee(world, state, game, input);
}

export function arcadeView(world: World, state: State): ArcadeView | null {
  const game = state.arcade;
  if (game === null) return null;
  return game.game === "claw" ? clawView(world, state, game) : skeeView(world, game);
}
