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
  // Story set pieces (spec 8): one critter kind each, at its point, calm or
  // chaos for the whole game (`state.critters`).
  critters: SetPiece[];
  // Recurring critters (spec 6): rolled at the dens on every arrival.
  recurring?: Recurring;
  // People standing in the area (spec 6): drawn with their own atlas, talked
  // to like an interactable, and turned toward Fae while she talks to them.
  // Their footprint is an authored blocker.
  npcs: Npc[];
  // Scenery cut from the area's painting (spec 6): every object Fae can walk
  // behind or bump into. Resolved by the loader from the area's placements
  // and its catalogue (`content/props/<area>.json`), in world units.
  props: Prop[];
  // The area's prop atlases (Pixi spritesheet JSON URLs), loaded with it.
  atlases: string[];
  spawns: Record<string, Spawn>;
};
// One prop placed in an area (spec 6). Its state is `state` unless one of
// `rules` applies: the first whose Ink variable is true wins. A painted prop is
// also still painted on the ground plate, so it never moves or changes state.
export type Prop = {
  id: string;
  kind: string;
  x: number;
  y: number;
  flip: boolean;
  canopy: boolean;
  painted: boolean;
  state: string;
  rules: { state: string; while: string }[];
  states: Record<string, PropState>;
};
// A prop state, in world units: the frame and its multiply shadow decal, the
// ground footprint (solid), the front edge it sorts by, and its silhouette.
export type PropState = {
  frame: string;
  shadow: string | null;
  footprint: Polygon[];
  front: FrontEdge;
  silhouette: Silhouette;
};
// The front edge of a prop's footprint: its southmost y in every column,
// sampled every `step` units from `left` (spec 6).
export type FrontEdge = { left: number; step: number; ys: number[] };
// A prop's opaque runs, `[top, bottom]` in world y, per `step`-wide column
// from `left`.
export type Silhouette = { left: number; step: number; columns: [number, number][][] };
// A set piece's id is its critter kind's. `visibleWhile` (an Ink variable)
// puts it there only while it's true, as for people.
export type SetPiece = { id: string; point: Point; visibleWhile?: string };
// Nothing is out until `after` (a calmed() fact) is true. Each den rolls its
// critter (one of `kinds`) with `chance` (0..1], and it wanders `radius`.
export type Recurring = { after?: string; dens: Den[] };
export type Den = { point: Point; radius: number; kinds: string[]; chance: number };
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
  // The reward line: `sticker` when the species' sticker is new, `coins`
  // otherwise, with {sticker} and {coins} filled in (spec 8).
  rewards: { sticker: string; coins: string };
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
// A critter kind (spec 8). Kinds of one species (the fountain frog and the
// bay's frogs) share its sticker.
export type Critter = {
  id: string;
  species: string;
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
  // The critter kind; `den` is the recurring critter's den, or null for a set
  // piece (whose id is the kind's).
  critterId: string;
  den: number | null;
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
  // Set as the reward shows: the species' sticker if it's new, else null.
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
  // The set pieces' moods, for the whole game.
  critters: Record<string, Mood>;
  // This visit's recurring critters, rolled on arrival (spec 6).
  wild: Wild[];
  stickers: string[];
  safeSpot: { area: string; spawn: string };
  battle: Battle | null;
  journalOpen: boolean;
  lantern: boolean;
  coins: number;
  snacks: number;
  backLink?: { area: string; direction: Direction };
};
export type Mood = "chaos" | "calm";
// A critter out in Fae's area, set piece or recurring (`presentCritters`):
// `key` is a set piece's id or `wild:<den>`.
export type PresentCritter = {
  key: string;
  kind: Critter;
  point: Point;
  mood: Mood;
  wild: Wild | null;
};
// A recurring critter out this visit, from its den (spec 6). It stays calm,
// once calmed, only until Fae leaves.
export type Wild = {
  kind: string;
  den: number;
  mood: Mood;
  x: number;
  y: number;
  target: Point;
  pauseTicks: number;
  cooldownTicks: number;
  facing: Direction;
  moving: boolean;
};
export type Event = { type: "button"; button: "confirm" | "cancel" | "menu" };
