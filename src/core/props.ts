import type {
  Area, Box, FrontEdge, Point, Polygon, Prop, PropState, World,
} from "./types";

/*
 * Props (spec 6): scenery cut from an area's painting. Each one's ground
 * footprint is solid, and it sorts against characters column by column: in
 * each 5-unit column, whoever's feet are north of the footprint's front edge
 * is behind it there.
 *
 *     silhouette (drawn)          front edge, one y per column
 *   ┌───────────────────┐
 *   │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │        ────╮        ╭────   flat past the ends
 *   │ ▒▒ leg ▒▒▒▒▒ leg ▒│ ──▶       ╰─╮    ╭─╯       straight across a gap
 *   └───────────────────┘             ╰────╯          (between an arch's legs)
 */

// A prop's state now: the first rule whose Ink variable is true, else its own.
export function propStateName(world: World, ink: string, prop: Prop): string {
  for (const rule of prop.rules)
    if (world.storyVariable(ink, rule.while) === true && prop.states[rule.state] !== undefined)
      return rule.state;
  return prop.state;
}

export function propState(world: World, ink: string, prop: Prop): PropState {
  const state = prop.states[propStateName(world, ink, prop)];
  if (state === undefined) throw new Error(`${prop.id} has no state ${prop.state}`);
  return state;
}

// The area with its props' current footprints solid: what Fae, her party, and
// the critters walk around. An area without props is returned as it is.
export function sceneryArea(world: World, ink: string, area: Area): Area {
  if (area.props.length === 0) return area;
  return {
    ...area,
    blockers: [
      ...area.blockers,
      ...area.props.flatMap((prop) => propState(world, ink, prop).footprint),
    ],
  };
}

// Every footprint any state of any prop can have: what the authoring checks
// count as solid, since the story may change a state.
export function everyPropFootprint(area: Area): Polygon[] {
  return area.props.flatMap((prop) =>
    Object.values(prop.states).flatMap((state) => state.footprint));
}

// The southmost y of the polygons on the vertical line at x, if it meets them.
function southmost(polygons: Polygon[], x: number): number | undefined {
  let best: number | undefined;
  for (const polygon of polygons)
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      if (a === undefined || b === undefined) continue;
      const [ax, ay] = a;
      const [bx, by] = b;
      if ((x < ax && x < bx) || (x > ax && x > bx)) continue;
      const y = ax === bx ? Math.max(ay, by) : ay + ((x - ax) * (by - ay)) / (bx - ax);
      if (best === undefined || y > best) best = y;
    }
  return best;
}

/*
 * The front edge over `count` columns `step` wide from `left`: the
 * footprint's southmost y at each column's centre. Across a gap between
 * footprints it runs straight from one side to the other; past the ends it
 * stays flat. Without a footprint it's `home` everywhere.
 */
export function frontEdge(
  footprint: Polygon[],
  left: number,
  step: number,
  count: number,
  home: number,
): FrontEdge {
  const sampled = Array.from({ length: count }, (_, index) =>
    southmost(footprint, left + (index + 0.5) * step));
  const known = sampled.flatMap((y, index) => y === undefined ? [] : [index]);
  const ys = sampled.map((y, index) => {
    if (y !== undefined) return y;
    const before = known.filter((at) => at < index).at(-1);
    const after = known.find((at) => at > index);
    const low = before === undefined ? undefined : sampled[before];
    const high = after === undefined ? undefined : sampled[after];
    if (before !== undefined && after !== undefined && low !== undefined && high !== undefined)
      return low + ((high - low) * (index - before)) / (after - before);
    return low ?? high ?? home;
  });
  return { left, step, ys };
}

/*
 * Whether the prop draws over the point `at` of someone standing at `feet`:
 * its column there is opaque at that height and their feet are north of that
 * column's front edge. The renderer sorts the same way, strip by strip.
 */
export function propCoversPoint(state: PropState, feet: Point, at: Point): boolean {
  const { silhouette, front } = state;
  const index = Math.floor((at.x - silhouette.left) / silhouette.step);
  const edge = front.ys[index];
  const column = silhouette.columns[index];
  return edge !== undefined && column !== undefined && feet.y < edge &&
    column.some(([top, bottom]) => at.y >= top && at.y <= bottom);
}

// The share of a feet-anchored body box the prop draws over, sampled on a
// 5-unit grid like the hiding check.
export function propCovers(state: PropState, feet: Point, box: Box): number {
  let covered = 0;
  let samples = 0;
  for (let y = feet.y - box.height; y <= feet.y; y += 5)
    for (let x = feet.x - box.width / 2; x <= feet.x + box.width / 2; x += 5) {
      samples += 1;
      if (propCoversPoint(state, feet, { x, y })) covered += 1;
    }
  return samples === 0 ? 0 : covered / samples;
}
