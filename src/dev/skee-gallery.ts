import {
  blankInput,
  createState,
  newSkee,
  skeePoints,
  skeeView,
  stepSkee,
  type Fixture,
  type SkeeGame,
  type SkeeThrow,
  type SkeeView,
  type World,
} from "../core";

// Skee-ball's gallery states (spec 8.2), each a real game state scored by the
// core: the arrow sweeping, the meter winding up (and wound too far), a ball
// up the lane, over the hump, in the 50 and in a corner, and the result.
export const skeeGalleryStates = [
  "skee-aiming",
  "skee-powering",
  "skee-over",
  "skee-rolling",
  "skee-hopping",
  "skee-fifty",
  "skee-corner",
  "skee-result",
] as const;

export function skeeGalleryView(world: World, fixture: Fixture, name: string): SkeeView | null {
  const skee = world.arcade.skee;
  const start = newSkee(skee);
  const state = { ...createState(world, fixture), arcade: start };
  // A ball rolled at `aim` and held `held` ticks, scored as the core scores it.
  const rolled = (aim: number, held: number): SkeeThrow => {
    const y = held * skee.powerStep;
    return { x: aim, y, points: skeePoints(skee, aim, y) };
  };
  const centre = rolled(skee.centre.x, Math.round(skee.centre.y / skee.powerStep));
  const corner = rolled(skee.corners.x, Math.round(skee.corners.y / skee.powerStep));
  const radius = (index: number): number => {
    const ring = skee.rings.at(index);
    if (ring === undefined) throw new Error(`skee-ball has no ring ${index}`);
    return ring.radius;
  };
  const outer = radius(-1);
  const low = rolled(skee.centre.x - 2 * skee.sweepStep,
    Math.round((skee.centre.y - outer + 20) / skee.powerStep));
  const view = (changes: Partial<SkeeGame>): SkeeView =>
    skeeView(world, { ...start, ...changes });
  switch (name) {
    case "skee-aiming":
      return view({ aim: -skee.board.width / 6 });
    case "skee-powering":
      // Wound up to the second ring's lower edge, on its way to the middle.
      return view({ phase: "powering", aim: skee.centre.x,
        held: Math.round((skee.centre.y - radius(1)) / skee.powerStep) });
    case "skee-over":
      return view({ phase: "powering", aim: skee.centre.x, held: skee.powerTicks - 3 });
    case "skee-rolling":
      return view({ phase: "rolling", aim: centre.x, phaseTicks: skee.rollTicks / 2,
        throws: [low, centre] });
    case "skee-hopping":
      return view({ phase: "hopping", aim: centre.x, phaseTicks: Math.round(skee.hopTicks / 2),
        throws: [low, centre] });
    case "skee-fifty":
      return view({ phase: "scored", aim: centre.x, phaseTicks: skee.scoreTicks / 2,
        throws: [low, centre] });
    case "skee-corner":
      return view({ phase: "scored", aim: corner.x, phaseTicks: skee.scoreTicks / 2,
        throws: [low, centre, corner] });
    case "skee-result": {
      // The last ball's last tick in its hole, played on by the core.
      const throws = [low, centre, corner, centre, rolled(skee.centre.x, skee.powerTicks)];
      const last: SkeeGame = { ...start, phase: "scored", aim: skee.centre.x,
        phaseTicks: skee.scoreTicks - 1, throws };
      const result = stepSkee(world, { ...state, arcade: last }, last, blankInput());
      if (result.arcade?.game !== "skee") throw new Error("the skee-ball game closed early");
      return skeeView(world, { ...result.arcade, revealed: result.arcade.message.length });
    }
    default:
      return null;
  }
}
