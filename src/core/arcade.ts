import { clawView, newClaw, stepClaw, type ClawGame, type ClawView } from "./claw";
import { moleView, newMole, stepMole, type MoleGame, type MoleView } from "./mole";
import { newSkee, skeeView, stepSkee, type SkeeGame, type SkeeView } from "./skee";
import type { ActionFrame, ArcadeOwned, State, World } from "./types";

// The arcade's games (spec 8.2): a line tagged `play: <game> <price>` opens one.
export const arcadeGames = ["claw", "skee", "mole"] as const;
export type ArcadeGameId = (typeof arcadeGames)[number];
export function isArcadeGameId(value: string): value is ArcadeGameId {
  return arcadeGames.some((game) => game === value);
}
export type ArcadeGame = ClawGame | SkeeGame | MoleGame;
export type ArcadeView = ClawView | SkeeView | MoleView;

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
  }
}

// One tick of the open game, if there is one.
export function stepArcade(world: World, state: State, input: ActionFrame): ArcadeOwned {
  const game = state.arcade;
  if (game === null) return { arcade: null, prizes: state.prizes, tickets: state.tickets };
  switch (game.game) {
    case "claw":
      return stepClaw(world, state, game, input);
    case "skee":
      return stepSkee(world, state, game, input);
    case "mole":
      return stepMole(world, state, game, input);
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
  }
}
