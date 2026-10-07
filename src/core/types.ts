export type Point = { x: number; y: number };
export type Polygon = [number, number][];
export type Direction = "up" | "down" | "left" | "right";
export type ActionFrame = {
  move: Point;
  confirm: boolean;
  cancel: boolean;
  menu: boolean;
  lantern?: boolean;
  choose?: number;
};
export type FollowTunables = {
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
};
export type Tunables = {
  walkSpeed: number;
  playerRadius: number;
  walkCycleUnits: number;
  doorFadeTicks: number;
  follow: FollowTunables;
  interact: { range: number; revealPerTick: number };
  roam: {
    wanderSpeed: number;
    chaseSpeed: number;
    sight: number;
    cooldownTicks: number;
    pauseTicks: number;
  };
};
// A feet-anchored body box (spec 5): `width` centred on the feet, `height`
// rising from them. Visibility between a follower and its leader is measured
// with these.
export type Box = { width: number; height: number };
export type Spawn = Point & { facing: Direction };
export type Area = {
  id: string;
  name: string;
  land?: string;
  width: number;
  height: number;
  walkable: Polygon;
  blockers: Polygon[];
  ground?: string;
  // What the lantern shows (spec 6); `flip` mirrors the decal left to right.
  glows: {
    id: string;
    frame: string;
    point: Point;
    knot?: string;
    prompt?: "Look";
    flip?: boolean;
  }[];
  // A canopy (a palm's crown, say) fades while Fae stands behind it instead of
  // hiding her (spec 6).
  occluders: { id: string; polygon: Polygon; baseline: number; canopy?: boolean }[];
  triggers: {
    id: string;
    polygon: Polygon;
    target: { area: string; spawn: string };
    requires?: { variable: string; knot: string };
  }[];
  interactables: {
    id: string;
    knot: string;
    point: Point;
    prompt: "Look" | "Talk";
  }[];
  critters: { id: string; point: Point; roam?: { radius: number } }[];
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
  footprint: Polygon;
  knot: string;
  prompt: "Look" | "Talk";
  visibleWhile?: string;
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
  // The lands of the painted map (content/lands.json); `busStop` when the bus
  // line stops there.
  lands: { id: string; name: string; busStop: boolean }[];
  story: Record<string, unknown>;
  critters: Record<string, Critter>;
  battle: BattleContent;
  stickers: StickerCatalogue;
  characters: Record<string, CharacterContent>;
  // The roster of friends who can follow Fae (spec 5), in roster order.
  party: Record<string, PartyContent>;
  // Reads a story variable from an Ink state (createStoryReader over `story`).
  storyVariable: (ink: string, name: string) => unknown;
};
// A friend who walks behind Fae and brings one battle command (spec 5, 8).
export type PartyContent = {
  id: string;
  name: string;
  atlas: string;
  box: Box;
  walkCycleUnits: number;
  // Sits down after sitDelayTicks still (Maddie); otherwise idles standing.
  sits: boolean;
  // In the party at a new game.
  start: boolean;
  // Ink variable which adds this friend during play, or null for starters.
  joins: string | null;
  command: { id: string; label: string; resting: string };
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
    SharedCommandId,
    { label: string; snackDetail: string | null }
  >;
};
export type Grade = "great" | "good" | "miss";
// The commands every battle has; the party's commands come from its roster.
export type SharedCommandId = "soothe" | "snack" | "run";
export type FriendCommand = {
  calm: number;
  great: number;
  good: number;
  rest: number;
};
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
  coins: number;
  sticker: { id: string; name: string; frame: string };
  calmKnot: string;
  calmPrompt: "Look" | "Talk";
  commands: {
    soothe: { calm: number; great: number; good: number };
    snack: { calm: number; energy: number };
    // Keyed by a party member's command id (spec 8).
    friends: Record<string, FriendCommand>;
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
    friends: Record<string, Record<Grade, string>>;
    snack: string;
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
  // "soothe" or a friend's command id; null until one is chosen.
  command: string | null;
  energy: number;
  calm: number;
  // Turns each friend's command still rests, by command id; missing = 0.
  rest: Record<string, number>;
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
    id: string;
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
// `party` overrides who starts in the party (test fixtures); the default is
// every roster member with `start: true`, in roster order.
export type Fixture = { area: string; spawn: string; seed?: number; party?: string[] };
// One friend in the party: member 0 follows Fae, member i follows member i-1,
// each along its own breadcrumb trail of its leader's recent positions.
export type PartyMember = {
  id: string;
  x: number;
  y: number;
  facing: Direction;
  motion: { distance: number; moving: boolean };
  stillTicks: number;
  trail: Point[];
};
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
  party: PartyMember[];
  ink: string;
  dialogue: {
    knot: string;
    speaker: string | null;
    text: string;
    revealed: number;
    choices: string[];
    selected: number;
    ended: boolean;
    travel?: { area: string; spawn: string };
  } | null;
  critters: Record<string, "chaos" | "calm">;
  roamers: Record<string, Roamer>;
  stickers: string[];
  safeSpot: { area: string; spawn: string };
  battle: Battle | null;
  journalOpen: boolean;
  lantern: boolean;
  coins: number;
  snacks: number;
  backLink?: { area: string; direction: Direction };
};
export type Roamer = {
  x: number;
  y: number;
  home: Point;
  target: Point;
  pauseTicks: number;
  cooldownTicks: number;
  facing: Direction;
  moving: boolean;
};
export type Event = { type: "button"; button: "confirm" | "cancel" | "menu" };
