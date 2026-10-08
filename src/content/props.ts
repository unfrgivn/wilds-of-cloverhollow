import { frontEdge } from "../core/props";
import type { Area, Polygon, Prop, PropState, Silhouette } from "../core";

/*
 * Prop content (spec 6). A catalogue (`content/props/<area>.json`, written by
 * tools/art/kit.ts) describes an area's props relative to each one's home
 * point; the area places them (`props` in its JSON). The loader resolves every
 * placement into world units, so the core and the renderer never translate.
 */

type CatalogueState = {
  frame: string;
  shadow: string | null;
  footprint: Polygon[];
  silhouette: Silhouette;
};
type CatalogueProp = {
  canopy: boolean;
  painted: boolean;
  home: [number, number];
  states: Record<string, CatalogueState>;
};
export type PropCatalogue = { atlases: string[]; props: Record<string, CatalogueProp> };
export type PropPlacement = {
  id: string;
  prop: string;
  x: number;
  y: number;
  flip: boolean;
  state: string;
  rules: { state: string; while: string }[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const items = (value: unknown): unknown[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list: unknown[] = value;
  return list;
};
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isPoint = (value: unknown): value is [number, number] => {
  const list = items(value);
  return list !== undefined && list.length === 2 && list.every(isNumber);
};

function fail(file: string, name: string): never {
  throw new Error(`${file}: invalid ${name}`);
}

function polygons(value: unknown, file: string, name: string): Polygon[] {
  const list = items(value) ?? fail(file, name);
  return list.map((polygon, index) => {
    const points = items(polygon);
    if (points === undefined || points.length < 3 || !points.every(isPoint))
      fail(file, `${name}[${index}]`);
    return points.filter(isPoint);
  });
}

// "top bottom top bottom ..." per column: a column's opaque runs.
function silhouette(value: unknown, file: string, name: string): Silhouette {
  if (!record(value) || !isNumber(value.left) || !isNumber(value.step) || value.step <= 0)
    fail(file, name);
  const columns = (items(value.columns) ?? fail(file, `${name}.columns`)).map((column) => {
    if (typeof column !== "string") fail(file, `${name}.columns`);
    const numbers = column.trim() === "" ? [] : column.trim().split(/\s+/).map(Number);
    if (numbers.length % 2 !== 0 || !numbers.every(isNumber)) fail(file, `${name}.columns`);
    const runs: [number, number][] = [];
    for (let index = 0; index < numbers.length; index += 2)
      runs.push([numbers[index] ?? 0, numbers[index + 1] ?? 0]);
    return runs;
  });
  return { left: value.left, step: value.step, columns };
}

export function parsePropCatalogue(value: unknown, file: string): PropCatalogue {
  if (!record(value) || !record(value.props)) fail(file, "catalogue");
  const atlases = (items(value.atlases) ?? fail(file, "atlases")).map((atlas) =>
    typeof atlas === "string" ? atlas : fail(file, "atlases"));
  const props: Record<string, CatalogueProp> = {};
  for (const [id, raw] of Object.entries(value.props)) {
    if (!record(raw) || typeof raw.canopy !== "boolean" || typeof raw.painted !== "boolean" ||
        !isPoint(raw.home) || !record(raw.states)) fail(file, `props.${id}`);
    const states: Record<string, CatalogueState> = {};
    for (const [name, state] of Object.entries(raw.states)) {
      const at = `props.${id}.states.${name}`;
      if (!record(state) || typeof state.frame !== "string" ||
          !(state.shadow === null || typeof state.shadow === "string")) fail(file, at);
      states[name] = {
        frame: state.frame,
        shadow: state.shadow,
        footprint: polygons(state.footprint, file, `${at}.footprint`),
        silhouette: silhouette(state.silhouette, file, `${at}.silhouette`),
      };
    }
    if (states.default === undefined) fail(file, `props.${id}.states.default`);
    if (raw.painted && Object.keys(states).length > 1)
      throw new Error(`${file}: painted prop ${id} can't change state (it stays on the plate)`);
    props[id] = { canopy: raw.canopy, painted: raw.painted, home: raw.home, states };
  }
  return { atlases, props };
}

export function parsePropPlacements(value: unknown, file: string): PropPlacement[] {
  if (value === undefined) return [];
  return (items(value) ?? fail(file, "props")).map((raw, index) => {
    const at = `props[${index}]`;
    if (!record(raw) || typeof raw.id !== "string" || typeof raw.prop !== "string" ||
        !isNumber(raw.x) || !isNumber(raw.y)) fail(file, at);
    if (raw.flip !== undefined && typeof raw.flip !== "boolean") fail(file, `${at}.flip`);
    if (raw.state !== undefined && typeof raw.state !== "string") fail(file, `${at}.state`);
    const rules = (raw.rules === undefined ? [] : items(raw.rules) ?? fail(file, `${at}.rules`))
      .map((rule) => {
        if (!record(rule) || typeof rule.state !== "string" || typeof rule.while !== "string")
          fail(file, `${at}.rules`);
        return { state: rule.state, while: rule.while };
      });
    return {
      id: raw.id,
      prop: raw.prop,
      x: raw.x,
      y: raw.y,
      flip: raw.flip === true,
      state: typeof raw.state === "string" ? raw.state : "default",
      rules,
    };
  });
}

// A catalogue state placed in the world: footprint, silhouette, and the front
// edge over the silhouette's columns, mirrored first when flipped.
function placeState(state: CatalogueState, placement: PropPlacement): PropState {
  const sign = placement.flip ? -1 : 1;
  const footprint = state.footprint.map((polygon) =>
    polygon.map(([x, y]): [number, number] => [placement.x + sign * x, placement.y + y]));
  const { step } = state.silhouette;
  const count = state.silhouette.columns.length;
  const left = placement.x + (placement.flip
    ? -(state.silhouette.left + count * step)
    : state.silhouette.left);
  const columns = (placement.flip ? [...state.silhouette.columns].reverse()
    : state.silhouette.columns)
    .map((runs) => runs.map(([top, bottom]): [number, number] =>
      [placement.y + top, placement.y + bottom]));
  return {
    frame: state.frame,
    shadow: state.shadow,
    footprint,
    front: frontEdge(footprint, left, step, count, placement.y),
    silhouette: { left, step, columns },
  };
}

export function placeProps(
  placements: PropPlacement[],
  catalogue: PropCatalogue | undefined,
  file: string,
): Prop[] {
  const seen = new Set<string>();
  return placements.map((placement) => {
    if (seen.has(placement.id)) throw new Error(`${file}: duplicate prop id ${placement.id}`);
    seen.add(placement.id);
    const entry = catalogue?.props[placement.prop];
    if (entry === undefined) throw new Error(`${file}: unknown prop ${placement.prop}`);
    for (const name of [placement.state, ...placement.rules.map((rule) => rule.state)])
      if (entry.states[name] === undefined)
        throw new Error(`${file}: prop ${placement.id} has no state ${name}`);
    if (entry.painted && (placement.x !== entry.home[0] || placement.y !== entry.home[1] ||
        placement.flip || placement.rules.length > 0 || placement.state !== "default"))
      throw new Error(`${file}: painted prop ${placement.id} must stay at home as it is`);
    const states: Record<string, PropState> = {};
    for (const [name, state] of Object.entries(entry.states))
      states[name] = placeState(state, placement);
    return {
      id: placement.id,
      kind: placement.prop,
      x: placement.x,
      y: placement.y,
      flip: placement.flip,
      canopy: entry.canopy,
      painted: entry.painted,
      state: placement.state,
      rules: placement.rules,
      states,
    };
  });
}

// A prop rule must read a declared Ink variable (undefined means undeclared).
export function propRuleErrors(
  areas: Record<string, Area>,
  variable: (name: string) => unknown,
): string[] {
  return Object.values(areas).flatMap((area) => area.props.flatMap((prop) =>
    prop.rules.filter((rule) => variable(rule.while) === undefined).map((rule) =>
      `${area.id}: prop ${prop.id} reads undeclared Ink variable ${rule.while}`)));
}
