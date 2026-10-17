import {
  blankInput,
  createState,
  moleView,
  moleWindow,
  newMole,
  stepMole,
  type Fixture,
  type MoleGame,
  type MoleHole,
  type MoleView,
  type World,
} from "../core";

// Boop-a-Mole's gallery states (spec 8.2), each a real round's state: drawn by
// the core from the arcade fixture, a mole rising, up, booped, giggling as it
// ducks, the hammer squeaking on an empty hole, and the result.
export const moleGalleryStates = [
  "mole-ready",
  "mole-rising",
  "mole-up",
  "mole-booped",
  "mole-giggle",
  "mole-whiff",
  "mole-result",
] as const;

export function moleGalleryView(world: World, fixture: Fixture, name: string): MoleView | null {
  const mole = world.arcade.mole;
  const [round, drawn] = newMole(mole, createState(world, fixture));
  // The round's first mole from the near hole, the biggest, if it has one.
  const near = round.order.indexOf("down");
  const index = near < 0 ? 0 : near;
  const hole = round.order[index] ?? "middle";
  const other: MoleHole = hole === "left" ? "right" : "left";
  const playing: MoleGame = { ...round, phase: "playing", mole: index, booped: index };
  const view = (changes: Partial<MoleGame>): MoleView =>
    moleView(world, { ...playing, ...changes });
  switch (name) {
    case "mole-ready":
      return moleView(world, round);
    case "mole-rising":
      return view({ stage: "rising", stageTicks: Math.floor(mole.riseTicks / 2) });
    case "mole-up":
      return view({ stage: "up", stageTicks: 2 });
    case "mole-booped":
      return view({ stage: "booped", stageTicks: 2, booped: index + 1,
        hammer: { hole, ticks: 2, hit: true } });
    case "mole-giggle":
      return view({ stage: "giggling", stageTicks: Math.floor(mole.duckTicks / 4),
        booped: index + 1 });
    case "mole-whiff":
      return view({ stage: "up", stageTicks: Math.floor(moleWindow(mole, index) / 2),
        hammer: { hole: other, ticks: 1, hit: false } });
    case "mole-result": {
      // The last mole's last tick going down, played on by the core.
      const last: MoleGame = { ...playing, mole: round.order.length - 1, stage: "ducking",
        stageTicks: mole.duckTicks - 1, booped: 11 };
      const result = stepMole(world, { ...drawn, arcade: last }, last, blankInput());
      if (result.arcade?.game !== "mole") throw new Error("the round closed early");
      return moleView(world, { ...result.arcade, revealed: result.arcade.message.length });
    }
    default:
      return null;
  }
}
