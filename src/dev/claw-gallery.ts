import {
  blankInput,
  clawView,
  createState,
  newClaw,
  stepClaw,
  type ClawGame,
  type ClawView,
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

export function clawGalleryView(world: World, fixture: Fixture, name: string): ClawView | null {
  const claw = world.arcade.claw;
  const plush = (prize: string): HeapPlush => {
    const found = claw.heap.find((item) => item.prize === prize);
    if (found === undefined) throw new Error(`the heap has no ${prize}`);
    return found;
  };
  const pup = plush("pup-plush");
  const frog = plush("frog-plush");
  const game = newClaw(claw);
  const opened = { ...createState(world, fixture), arcade: game };
  const view = (changes: Partial<ClawGame>): ClawView => {
    const changed = { ...game, ...changes };
    return clawView(world, { ...opened, arcade: changed }, changed);
  };
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
      const result = stepClaw(world, { ...opened, arcade: releasing }, releasing, blankInput());
      if (result.arcade?.game !== "claw") throw new Error("the claw game closed early");
      const shown = { ...result.arcade, revealed: result.arcade.message.length };
      return clawView(world, { ...opened, prizes: result.prizes, arcade: shown }, shown);
    }
    default:
      return null;
  }
}
