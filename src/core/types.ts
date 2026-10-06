export type Point = { x: number; y: number };
export type Polygon = [number, number][];
export type Direction = "up" | "down" | "left" | "right";
export type ActionFrame = {
  move: Point;
  confirm: boolean;
  cancel: boolean;
  menu: boolean;
  choose?: number;
};
export type Tunables = {
  walkSpeed: number;
  playerRadius: number;
  walkCycleUnits: number;
  doorFadeTicks: number;
  follow: {
    distance: number;
    stop: number;
    trailSpacing: number;
    trailMax: number;
    catchUp: number;
    radius: number;
    slot: number;
    heel: number;
    sitDelayTicks: number;
    settleDelayTicks: number;
    walkCycleUnits: number;
  };
  interact: { range: number; revealPerTick: number };
};
export type Spawn = Point & { facing: Direction };
export type Area = {
  id: string;
  width: number;
  height: number;
  walkable: Polygon;
  blockers: Polygon[];
  ground?: string;
  occluders: { id: string; polygon: Polygon; baseline: number }[];
  triggers: {
    id: string;
    polygon: Polygon;
    target: { area: string; spawn: string };
  }[];
  interactables: {
    id: string;
    knot: string;
    point: Point;
    prompt: "Look" | "Talk";
  }[];
  spawns: Record<string, Spawn>;
};
export type GroundManifest = {
  paper: string;
  tiles: { file: string; x: number; y: number; width: number; height: number }[];
};
export type OccluderManifest = {
  cutouts: { id: string; file: string; x: number; y: number }[];
};
export type World = {
  tunables: Tunables;
  areas: Record<string, Area>;
  story: Record<string, unknown>;
};
export type Fixture = { area: string; spawn: string; seed?: number };
export type State = {
  tick: number;
  area: string;
  player: Point;
  facing: Direction;
  rng: number;
  previousInput: ActionFrame;
  motion: { distance: number; moving: boolean };
  transition: {
    target: { area: string; spawn: string };
    phase: "out" | "in";
    elapsed: number;
  } | null;
  maddie: {
    x: number;
    y: number;
    facing: Direction;
    motion: { distance: number; moving: boolean };
    stillTicks: number;
  };
  trail: Point[];
  ink: string;
  dialogue: {
    knot: string;
    speaker: string | null;
    text: string;
    revealed: number;
    choices: string[];
    selected: number;
    ended: boolean;
  } | null;
};
export type Event = { type: "button"; button: "confirm" | "cancel" | "menu" };
