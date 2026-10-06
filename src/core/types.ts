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
  name: string;
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
  critters: { id: string; point: Point }[];
  // People standing in the area (spec 6): drawn with their own atlas, talked
  // to like an interactable, and turned toward Fae while she talks to them.
  // Their footprint is an authored blocker.
  npcs: Npc[];
  spawns: Record<string, Spawn>;
};
export type Npc = {
  id: string;
  point: Point;
  facing: Direction;
  knot: string;
  prompt: "Look" | "Talk";
};
export type GroundManifest = {
  paper: string;
  tiles: {
    file: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};
export type OccluderManifest = {
  cutouts: { id: string; file: string; x: number; y: number }[];
};
export type World = {
  tunables: Tunables;
  areas: Record<string, Area>;
  story: Record<string, unknown>;
  critters: Record<string, Critter>;
  battle: BattleContent;
  stickers: StickerCatalogue;
  characters: Record<string, CharacterContent>;
};
// An area person's atlas and idle timing: ticks per idle_down frame (Mom
// holds her smile, then blinks briefly; Oliver waves his rattle evenly).
export type CharacterContent = { atlas: string; idleTicks: number[] };
export type StickerCatalogue = {
  slots: number;
  catalogue: { id: string; name: string; critter: string; frame: string }[];
};
export type BattleContent = {
  commands: Record<
    CritterCommandId,
    { label: string; snackDetail: string | null }
  >;
};
export type Grade = "great" | "good" | "miss";
export type CritterCommandId = "soothe" | "play" | "snack" | "run";
export type Critter = {
  id: string;
  name: string;
  calmName: string;
  atlas: string;
  auraCentre: Point;
  bodyCentre: Point;
  figureHeight: number;
  overworldHeight: number;
  battleHeight: number;
  touchRadius: number;
  calmMax: number;
  energyMax: number;
  snacks: number;
  sticker: { id: string; name: string; frame: string };
  calmKnot: string;
  calmPrompt: "Look" | "Talk";
  commands: {
    soothe: { calm: number; great: number; good: number };
    play: { calm: number; great: number; good: number; rest: number };
    snack: { calm: number; energy: number };
  };
  timing: {
    aimTicks: number;
    targetTick: number;
    greatWindow: number;
    goodWindow: number;
  };
  burst: {
    ticks: number;
    targetTick: number;
    greatWindow: number;
    goodWindow: number;
    bigChance: number;
  };
  lines: {
    intro: string;
    command: string;
    soothe: Record<Grade, string>;
    play: Record<Grade, string>;
    snack: string;
    playResting: string;
    burst: string;
    burstResult: Record<Grade, string>;
    soothed: string;
    reward: string;
    rest: string;
    run: string;
  };
};
export type BattlePhase =
  | "intro"
  | "command"
  | "aim"
  | "result"
  | "burst"
  | "burstResult"
  | "soothed"
  | "reward"
  | "rest"
  | "run";
export type Battle = {
  critterId: string;
  entry: Point;
  phase: BattlePhase;
  message: string;
  revealed: number;
  selected: number;
  command: "soothe" | "play" | null;
  energy: number;
  calm: number;
  snacks: number;
  rest: number;
  aim: {
    side: "critter" | "fae";
    ticks: number;
    targetTick: number;
    greatWindow: number;
    goodWindow: number;
  } | null;
  lastGrade: Grade | null;
  rewardSticker: string | null;
  aimTick: number;
  phaseTicks: number;
};
export type BattleView = {
  critterId: string;
  critterName: string;
  battleHeight: number;
  auraCentre: Point;
  bodyCentre: Point;
  phase: BattlePhase;
  message: string;
  revealed: number;
  commands: {
    id: CritterCommandId;
    label: string;
    detail: string | null;
    disabled: boolean;
  }[];
  selected: number;
  energy: number;
  energyMax: number;
  calm: number;
  calmMax: number;
  aim: {
    side: "critter" | "fae";
    progress: number;
    target: number;
  } | null;
  lastGrade: Grade | null;
  rewardSticker: string | null;
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
  critters: Record<string, "chaos" | "calm">;
  stickers: string[];
  safeSpot: { area: string; spawn: string };
  battle: Battle | null;
  journalOpen: boolean;
};
export type Event = { type: "button"; button: "confirm" | "cancel" | "menu" };
