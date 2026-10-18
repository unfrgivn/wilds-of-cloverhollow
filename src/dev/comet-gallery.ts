import {
  blankInput,
  cometView,
  createState,
  openArcade,
  step,
  type ActionFrame,
  type CometGame,
  type CometView,
  type Fixture,
  type State,
  type World,
} from "../core";

// Comet Cruise's gallery states (spec 8.2), each a real run's: opened from the
// arcade fixture and stepped by the core. A star and a rock coming down, the
// rocket sliding a lane, a star just caught, a bump, and the result.
export const cometGalleryStates = [
  "comet-ready",
  "comet-coming",
  "comet-sliding",
  "comet-caught",
  "comet-bump",
  "comet-result",
] as const;

const right: ActionFrame = { ...blankInput(), move: { x: 1, y: 0 } };
const left: ActionFrame = { ...blankInput(), move: { x: -1, y: 0 } };

function game(state: State): CometGame {
  if (state.arcade?.game !== "comet") throw new Error("the run closed early");
  return state.arcade;
}

function stepping(world: World, state: State, inputs: ActionFrame[]): State {
  return inputs.reduce((current, input) => step(world, current, input).state, state);
}

// Steps with nothing pressed until the test passes (or the run ends).
function until(world: World, state: State, test: (game: CometGame) => boolean): State {
  let current = state;
  while (!test(game(current))) {
    if (game(current).phase === "result") throw new Error("the run ended first");
    current = step(world, current, blankInput()).state;
  }
  return current;
}

// Steers to a lane, a fresh press at a time.
function steer(world: World, state: State, lane: number): State {
  let current = state;
  while (game(current).lane !== lane)
    current = stepping(world, current, [game(current).lane < lane ? right : left, blankInput()]);
  return current;
}

export function cometGalleryView(world: World, fixture: Fixture, name: string): CometView | null {
  if (!name.startsWith("comet-")) return null;
  const comet = world.arcade.comet;
  const opened = openArcade(world, { ...createState(world, fixture), coins: 2 }, "comet", 2);
  const view = (state: State): CometView => cometView(world, game(state));
  const playing = stepping(world, opened, Array.from({ length: comet.readyTicks }, blankInput));
  const objects = game(opened).objects;
  // The first one of a kind, and the tick it reaches the rocket's row.
  const firstOf = (kind: "star" | "rock"): { lane: number; index: number } => {
    const index = objects.findIndex((item) => item.kind === kind);
    const item = objects[index];
    if (item === undefined) throw new Error(`a run has no ${kind}`);
    return { lane: item.lane, index };
  };
  // A star and a rock both on the screen, a good way down.
  const coming = (state: State): State => until(world, state, (current) => {
    const shown = cometView(world, current).objects.filter((item) =>
      item.flash === 0 && item.progress > 0.3 && item.progress < 0.95);
    return shown.some((item) => item.kind === "star") &&
      shown.some((item) => item.kind === "rock");
  });
  switch (name) {
    case "comet-ready":
      return view(stepping(world, opened, Array.from({ length: 20 }, blankInput)));
    case "comet-coming":
      return view(coming(playing));
    case "comet-sliding": {
      const at = game(coming(playing));
      const toward = at.lane === 2 ? left : right;
      return view(stepping(world, coming(playing), [toward, blankInput(), blankInput()]));
    }
    case "comet-caught": {
      const star = firstOf("star");
      const ready = steer(world, playing, star.lane);
      const caught = until(world, ready, (current) => current.caught > 0);
      return view(stepping(world, caught, [blankInput(), blankInput()]));
    }
    case "comet-bump": {
      const rock = firstOf("rock");
      // Wait out what comes first in the rocket's lane, then meet the rock.
      const near = until(world, playing, (current) =>
        current.elapsed >= rock.index * comet.gapTicks - comet.gapTicks);
      const bumped = until(world, steer(world, near, rock.lane), (current) => current.bumps > 0);
      return view(stepping(world, bumped, [blankInput(), blankInput()]));
    }
    case "comet-result": {
      // The whole run with the rocket left in the middle lane, the result
      // shown in full with a press.
      const done = until(world, playing, (current) => current.phase === "result");
      return view(stepping(world, done, [{ ...blankInput(), confirm: true }]));
    }
    default:
      return null;
  }
}
