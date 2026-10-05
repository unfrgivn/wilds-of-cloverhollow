export type Point = { x: number; y: number };
export type Polygon = [number, number][];
export type Direction = "up" | "down" | "left" | "right";
export type ActionFrame = {
  move: Point;
  confirm: boolean;
  cancel: boolean;
  menu: boolean;
};
export type Tunables = { walkSpeed: number; playerRadius: number };
export type Spawn = Point & { facing: Direction };
export type Area = {
  id: string;
  width: number;
  height: number;
  walkable: Polygon;
  blockers: Polygon[];
  spawns: Record<string, Spawn>;
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
};
export type Event = { type: "button"; button: "confirm" | "cancel" | "menu" };
