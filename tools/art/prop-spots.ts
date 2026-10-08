/*
 * Where to look at a prop's depth (spec 6.2): the reachable spot where it
 * hides the most of Fae, and the spot in front of it (hiding none of her)
 * where her picture overlaps it the most, squarely in front of its footprint
 * where there is one (so walking up from there meets its front, not its end).
 * Each holds 5 units either way (behind 5 units further south, in front 5
 * units further north), so a walk that stops a little short sees the same.
 * Used by the depth preview (tools/art/depth-preview.ts) and the kit recorder
 * (tools/sim/record-kits.ts).
 */
import {
  faeBox, propCovers, propState, type Area, type Point, type PropState, type World,
} from "../../src/core";
import { reachablePositions } from "../../src/content/area-checks";

// The share of Fae's body box, feet at `feet`, over the prop's picture,
// whatever the depth: how much a draw-order mistake there would show.
export function propOverlap(state: PropState, feet: Point): number {
  const { silhouette } = state;
  let hit = 0;
  let samples = 0;
  for (let y = feet.y - faeBox.height; y <= feet.y; y += 5)
    for (let x = feet.x - faeBox.width / 2; x <= feet.x + faeBox.width / 2; x += 5) {
      samples += 1;
      const column = silhouette.columns[Math.floor((x - silhouette.left) / silhouette.step)];
      if (column?.some(([top, bottom]) => y >= top && y <= bottom) === true) hit += 1;
    }
  return hit / samples;
}

export type PropSpots = {
  id: string;
  behind: { feet: Point; covered: number } | undefined;
  front: { feet: Point; overlap: number } | undefined;
};

// For every prop in the area, in its state under `ink`. `allowed` narrows the
// spots (the recorder keeps clear of critters, whose touch starts a battle).
export function propSpots(
  world: World,
  area: Area,
  ink: string,
  allowed: (feet: Point) => boolean = () => true,
): PropSpots[] {
  const reachable = reachablePositions(area, world.tunables.playerRadius).filter(allowed);
  return area.props.map((prop) => {
    const state = propState(world, ink, prop);
    const { left, step, columns } = state.silhouette;
    const right = left + columns.length * step;
    const top = Math.min(...columns.flat().map(([from]) => from));
    const near = reachable.filter((feet) => feet.x > left - faeBox.width / 2 &&
      feet.x < right + faeBox.width / 2 && feet.y > top);
    const xs = state.footprint.flat().map(([x]) => x);
    const inset = world.tunables.playerRadius;
    const square = (feet: Point): boolean => xs.length > 0 &&
      feet.x >= Math.min(...xs) + inset && feet.x <= Math.max(...xs) - inset;
    let behind: PropSpots["behind"];
    let front: (PropSpots["front"] & { square: boolean }) | undefined;
    const margin = 5;
    for (const feet of near) {
      const covered = propCovers(state, feet, faeBox);
      const still = (dy: number): number =>
        propCovers(state, { x: feet.x, y: feet.y + dy }, faeBox);
      if (covered > (behind?.covered ?? 0) && still(margin) > 0) behind = { feet, covered };
      const overlap = covered === 0 && still(-margin) === 0 ? propOverlap(state, feet) : 0;
      if (overlap === 0) continue;
      const candidate = { feet, overlap, square: square(feet) };
      if (front === undefined || (candidate.square && !front.square) ||
          (candidate.square === front.square && overlap > front.overlap))
        front = candidate;
    }
    return { id: prop.id, behind,
      front: front === undefined ? undefined : { feet: front.feet, overlap: front.overlap } };
  });
}
