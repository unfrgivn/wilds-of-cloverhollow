import {
  arcadeView,
  blankInput,
  createState,
  openClaw,
  stepArcade,
  type ArcadeView,
  type ClawGame,
  type Fixture,
  type HeapPlush,
  type World,
} from "../core";

// The claw machine's gallery states (spec 8.2), each built from a real game
// state in the arcade so the gallery can't drift from the rules: the claw
// over the pup (the top of the heap), a tug at the frog under the bunny, and
// the pup won.
export const clawGalleryStates = [
  "arcade-ready",
  "arcade-aiming",
  "arcade-pushing",
  "arcade-grabbing",
  "arcade-lifting",
  "arcade-tug",
  "arcade-releasing",
  "arcade-result",
] as const;

export function clawGalleryView(world: World, fixture: Fixture, name: string): ArcadeView | null {
  const claw = world.arcade.claw;
  const plush = (prize: string): HeapPlush => {
    const found = claw.heap.find((item) => item.prize === prize);
    if (found === undefined) throw new Error(`the heap has no ${prize}`);
    return found;
  };
  const pup = plush("pup-plush");
  const frog = plush("frog-plush");
  const opened = openClaw(world, { ...createState(world, fixture), coins: 2 }, 2);
  const game = opened.arcade;
  if (game === null) throw new Error("the claw machine didn't open");
  const view = (changes: Partial<ClawGame>): ArcadeView | null =>
    arcadeView(world, { ...opened, arcade: { ...game, ...changes } });
  const overPup = { x: pup.x, z: pup.z };
  switch (name) {
    case "arcade-ready":
      return view({});
    case "arcade-aiming":
      return view({ phase: "aiming", x: pup.x });
    case "arcade-pushing":
      return view({ phase: "pushing", x: pup.x, z: Math.round((claw.depthFront + pup.z) / 2) });
    case "arcade-grabbing":
      return view({ phase: "grabbing", ...overPup });
    case "arcade-lifting":
      return view({ phase: "lifting", ...overPup, phaseTicks: claw.liftTicks / 2,
        target: pup.prize, outcome: "grabbed" });
    case "arcade-tug":
      // The claw has just closed on the frog, with the bunny resting on it,
      // and starts to pull.
      return view({ phase: "lifting", x: frog.x, z: frog.z,
        phaseTicks: claw.liftTicks / 10, target: frog.prize, outcome: "stuck" });
    case "arcade-releasing":
      return view({ phase: "releasing", phaseTicks: claw.releaseTicks / 2,
        target: pup.prize, outcome: "grabbed" });
    case "arcade-result": {
      // The last tick of the drop into the chute, played by the core.
      const releasing: ClawGame = { ...game, phase: "releasing",
        phaseTicks: claw.releaseTicks - 1, target: pup.prize, outcome: "grabbed" };
      const result = stepArcade(world, { ...opened, arcade: releasing }, blankInput());
      const shown = result.arcade === null ? null
        : { ...result.arcade, revealed: result.arcade.message.length };
      return arcadeView(world, { ...opened, prizes: result.prizes, arcade: shown });
    }
    default:
      return null;
  }
}
