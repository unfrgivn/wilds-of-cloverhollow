import type { StorySound } from "./sound";
import type { SurfaceMap } from "./surfaces";
import type { ArcadeGame, ArcadeGameId } from "./arcade";

export type Point = { x: number; y: number };
export type Polygon = [number, number][];
export type Direction = "up" | "down" | "left" | "right";
export type ActionFrame = {
  move: Point;
  confirm: boolean;
  cancel: boolean;
  menu: boolean;
  lantern?: boolean;
  flute?: boolean;
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
export type Crossing = { id: string; polygon: Polygon; opens: string };
export type Area = {
  id: string;
  name: string;
  land?: string;
  width: number;
  height: number;
  walkable: Polygon;
  blockers: Polygon[];
  crossings?: Crossing[];
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
    prompt: "Look" | "Play" | "Talk";
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
  // A canopy (a palm's crown, say) fades while Fae stands behind it instead of
  // hiding her (spec 6).
  canopy: boolean;
  painted: boolean;
  state: string;
  rules: { state: string; while: string }[];
  states: Record<string, PropState>;
};
// A prop state, in world units: the frame and its multiply shadow decal, the
// ground footprint (solid), the front edge it sorts by, and its silhouette.
export type PropState = {
  flat: boolean;
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
export type World = {
  tunables: Tunables;
  areas: Record<string, Area>;
  surfaces: Record<string, SurfaceMap>;
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
  arcade: ArcadeContent;
};
export type ArcadeContent = {
  // The prize atlas (Pixi spritesheet JSON), one frame per prize.
  atlas: string;
  claw: ClawContent;
  prizes: { id: string; name: string; frame: string }[];
};
// The claw machine (spec 8.2), in floor units: x runs left to right across the
// box, z from the front glass to the back wall.
export type ClawContent = {
  box: { width: number; depth: number };
  railLeft: number;
  railRight: number;
  depthFront: number;
  depthBack: number;
  reach: number;
  speed: number;
  dropTicks: number;
  grabTicks: number;
  liftTicks: number;
  releaseTicks: number;
  heap: HeapPlush[];
  lines: {
    slide: string;
    push: string;
    won: string;
    missed: string;
    stuck: string;
    prizeTitle: string;
  };
};
// A plush in the heap: where it sits on the floor, how high in the pile
// (0 on the floor), and the plushes it rests on, one level down.
export type HeapPlush = { prize: string; x: number; z: number; level: number; on: string[] };
// The painted claw machine's front (`public/assets/arcade/claw-machine.json`,
// spec 8.2), measured in the image's pixels: the window's opening, the box
// floor's front and back edges, where the ceiling meets the front glass and
// the back wall, the prize chute's mouth (four corners), and the blank plate.
export type ClawCalibration = {
  image: string;
  size: { w: number; h: number };
  glass: { x: number; y: number; w: number; h: number; radius: number };
  floor: {
    front: { y: number; left: number; right: number };
    back: { y: number; left: number; right: number };
  };
  ceiling: { front: { y: number }; back: { y: number } };
  chute: { mouth: [number, number][] };
  plate: { x: number; y: number; w: number; h: number };
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
  // A flute friend (an animal Fae calls with her flute): it leaves again when
  // its joins variable isn't true, and it sits battles out (spec 5).
  flute: boolean;
  // The recurring critter kind a flute friend is: called while a calm one is
  // out in Fae's area, it's that one who comes (null for everyone else).
  critter: string | null;
  // Its battle command, or null for a flute friend.
  command: { id: string; label: string; resting: string; check: CheckSpec } | null;
};
// An area person's atlas and idle timing: ticks per idle_down frame (Mom
// holds her smile, then blinks briefly; Oliver waves his rattle evenly).
export type CharacterContent = { atlas: string; idleTicks: number[] };
export type StickerCatalogue = {
  slots: number;
  catalogue: { id: string; name: string; critter: string; frame: string }[];
};
export type BattleContent = {
  // The sprite atlas of the toys a catch throws (Milestone 41).
  toyAtlas: string;
  hints: { charge: string; chain: string; catch: string; lean: string };
  commands: {
    soothe: { label: string; check: CheckSpec };
    snack: { label: string; snackDetail: string };
    run: { label: string };
  };
  // What a critter can feel (Milestone 42): each feeling's label and the
  // command id that answers it, and the calm an answered feeling adds.
  feelings: Record<FeelingId, { label: string; answer: string }>;
  feelingBonus: number;
  // The reward line: `sticker` when the species' sticker is new, `coins`
  // otherwise, with {sticker} and {coins} filled in (spec 8).
  rewards: { sticker: string; coins: string };
};
// The closed set of feelings (spec 8); each has an icon drawn in code.
export type FeelingId = "zoomy" | "curious" | "bored" | "grumpy" | "hungry";
export type Grade = "great" | "good" | "miss";
// How a battle check plays (spec 8): a friend's command and Soothe name one,
// and each critter names its burst's.
export type RingSpec = {
  kind: "ring";
  ticks: number;
  targetTick: number;
  greatWindow: number;
  goodWindow: number;
};
export type ChargeSpec = {
  kind: "charge";
  waitTicks: number;
  maxTicks: number;
  targetTick: number;
  greatWindow: number;
  goodWindow: number;
};
export type ChainLook = "pinecone" | "bubble" | "dust";
export type ChainSpec = {
  kind: "chain";
  travelTicks: number;
  hitWindow: number;
  arrivals: number[];
  look: ChainLook;
};
// A burst's toys to catch (Milestone 41): toy j lands at `arrivals[j]` in a
// lane drawn when the burst starts; `toys` are frames of the toy atlas, used
// in turn.
export type CatchSpec = {
  kind: "catch";
  travelTicks: number;
  arrivals: number[];
  toys: string[];
};
// A burst's gusts to lean into (Milestone 48): puff j blows from `starts[j]`
// for `puffTicks`, pushing Fae's balance toward her back by a force drawn
// from `forces` when the burst starts. Leaning moves it `steer` a tick; with
// no gust and no lean it settles back `spring` a tick. The balance runs from
// -100 to 100; reaching either end in a puff loses that puff.
export type LeanSpec = {
  kind: "lean";
  puffTicks: number;
  starts: number[];
  forces: number[];
  steer: number;
  spring: number;
};
export type CheckSpec = RingSpec | ChargeSpec | ChainSpec | CatchSpec | LeanSpec;
// "critter": Fae's side acts on the critter; "fae": the critter's burst.
export type CheckSide = "critter" | "fae";
export type BeatResult = "pending" | "hit" | "miss";
// A check in play: a copy of its spec, its tick, and its own progress. `big`
// is the burst's roll (always false on Fae's side).
export type CheckState =
  | { kind: "ring"; side: CheckSide; tick: number; spec: RingSpec; big: boolean }
  | {
      kind: "charge";
      side: CheckSide;
      tick: number;
      spec: ChargeSpec;
      held: number;
      big: boolean;
    }
  | {
      kind: "chain";
      side: CheckSide;
      tick: number;
      spec: ChainSpec;
      results: BeatResult[];
      big: boolean;
    }
  // `lanes` (0 high, 1 middle, 2 low) per toy; `catcher` the lane Fae's
  // catch is in this tick.
  | {
      kind: "catch";
      side: CheckSide;
      tick: number;
      spec: CatchSpec;
      lanes: number[];
      catcher: number;
      results: BeatResult[];
      big: boolean;
    }
  // `strengths` per puff (drawn); `balance` -100 (blown over backward) to
  // 100 (leaned over forward), 0 standing straight.
  | {
      kind: "lean";
      side: CheckSide;
      tick: number;
      spec: LeanSpec;
      strengths: number[];
      balance: number;
      results: BeatResult[];
      big: boolean;
    };
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
  // What this kind can feel in battle (Milestone 42).
  feelings: FeelingId[];
  commands: {
    soothe: { calm: number; great: number; good: number };
    snack: { calm: number; energy: number };
    // Keyed by a party member's command id (spec 8).
    friends: Record<string, FriendCommand>;
  };
  burst: {
    bigChance: number;
    check: CheckSpec;
    big?: CheckSpec;
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
  | "check"
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
  check: CheckState | null;
  lastGrade: Grade | null;
  // What the critter feels this turn, next turn, and the turn after
  // (Milestone 42): null where nothing it can feel has an answer; empty while
  // feelings are off (a party of one).
  feelings: (FeelingId | null)[];
  // The command chosen this turn answers this turn's feeling.
  answered: boolean;
  // The lantern has shown the turn-after feeling, for the rest of the battle.
  lanternPeek: boolean;
  // Set as the reward shows: the species' sticker if it's new, else null.
  rewardSticker: string | null;
  phaseTicks: number;
};
export type BattleCheckView =
  | { kind: "ring"; side: CheckSide; progress: number; target: number }
  | {
      kind: "charge";
      side: CheckSide;
      actor: number | null;
      waiting: boolean;
      fill: number;
      great: [number, number];
      good: [number, number];
    }
  | {
      kind: "chain";
      side: CheckSide;
      actor: number | null;
      look: ChainLook;
      beats: { appeared: boolean; progress: number; result: BeatResult }[];
    }
  | {
      kind: "catch";
      side: CheckSide;
      catcher: number;
      toys: {
        appeared: boolean;
        progress: number;
        lane: number;
        frame: string;
        result: BeatResult;
      }[];
    }
  // `balance` -1 (blown over backward) to 1 (leaned over forward); `puffs` in
  // order: blowing now, how far through its time (0..1), how hard it pushes
  // next to Fae's lean (0..1), and how it went.
  | {
      kind: "lean";
      side: CheckSide;
      balance: number;
      puffs: { blowing: boolean; progress: number; force: number; result: BeatResult }[];
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
    // The feeling this command answers this turn, if any (its badge).
    feeling: FeelingId | null;
  }[];
  selected: number;
  energy: number;
  energyMax: number;
  calm: number;
  calmMax: number;
  check: BattleCheckView | null;
  hint: string | null;
  // The critter's feelings to show (spec 8.1), or null when there's none to
  // show: off, or outside the command menu and its result.
  feelings: {
    now: { id: FeelingId; label: string } | null;
    next: FeelingId | null;
    // Only once the lantern has peeked.
    later: FeelingId | null;
    answered: boolean;
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
    sound?: StorySound;
    travel?: { area: string; spawn: string };
    play?: { game: ArcadeGameId; price: number };
  } | null;
  // The set pieces' moods, for the whole game.
  critters: Record<string, Mood>;
  // This visit's recurring critters, rolled on arrival (spec 6).
  wild: Wild[];
  stickers: string[];
  safeSpot: { area: string; spawn: string };
  battle: Battle | null;
  arcade: ArcadeGame | null;
  prizes: string[];
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
