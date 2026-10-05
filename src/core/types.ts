export type Point = { x: number; y: number };
export type Polygon = [number, number][];
export type Direction = "up" | "down" | "left" | "right";
export type ActionFrame = {
  move: Point;
  confirm: boolean;
  cancel: boolean;
  menu: boolean;
};
export type Tunables = {
  walkSpeed: number;
  playerRadius: number;
  walkCycleUnits: number;
  doorFadeTicks: number;
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
  spawns: Record<string, Spawn>;
};
export type GroundManifest = {
  paper: string;
  tiles: { file: string; x: number; y: number; width: number; height: number }[];
};
export type OccluderManifest = {
  cutouts: { id: string; file: string; x: number; y: number }[];
};
export type World = { tunables: Tunables; areas: Record<string, Area> };
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
};
export type Event = { type: "button"; button: "confirm" | "cancel" | "menu" };
