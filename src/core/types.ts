import type { StorySound } from "./sound";
import type { SurfaceMap } from "./surfaces";
import type { ArcadeGame, ArcadeGameId } from "./arcade";
import type { MoleHole } from "./mole";

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
  pointer?: { x: number; y: number };
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
    // Milestone 51: in sight this long, a critter notices Fae and gives
    // chase; its "!" shows `alertTicks` more.
    noticeTicks: number;
    alertTicks: number;
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
  // Not there at all (an added prop's default, before the story puts it in
  // the scene; spec 6.2): no frame, no footprint, and an empty silhouette, so
  // it covers nobody.
  hidden: boolean;
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
  lands: { id: string; name: string; busStop: boolean; revealVariable?: string }[];
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
  levels: import("./levels").LevelContent;
};
export type ArcadeContent = {
  // The prize atlas (Pixi spritesheet JSON), one frame per prize.
  atlas: string;
  claw: ClawContent;
  skee: SkeeContent;
  mole: MoleContent;
  comet: CometContent;
  cook: CookContent;
  counter: CounterContent;
  prizes: { id: string; name: string; frame: string }[];
};
// Skee-ball (spec 8.2), on a target board `width` wide (x from -width/2 to
// width/2) and `height` tall (y from 0, just past the hump, up to the top).
// The rings are circles round `centre`, smallest first; the corner holes sit
// at (-x, y) and (x, y); `floor` is what a ball scores anywhere else.
export type SkeeContent = {
  balls: number;
  board: { width: number; height: number };
  // Board units the arrow moves each tick while aiming, and the ball travels
  // up the board for each tick the press is held, up to `powerTicks`.
  sweepStep: number;
  powerStep: number;
  powerTicks: number;
  rollTicks: number;
  hopTicks: number;
  scoreTicks: number;
  centre: { x: number; y: number };
  rings: { points: number; radius: number }[];
  corners: { points: number; x: number; y: number; radius: number };
  floor: number;
  pointsPerTicket: number;
  lines: { aim: string; power: string; result: string };
};
// Boop-a-Mole (spec 8.2): `moles` a round, one at a time, from holes drawn
// when it opens. After `readyTicks`, each mole rises over `riseTicks`, stays
// up from `upFirst` ticks (the first mole) down to `upLast` (the last), and
// ducks over `duckTicks`; booped, it winces and giggles for `boopTicks` first.
// `gapTicks` pass between moles; the hammer shows for `hammerTicks`.
export type MoleContent = {
  moles: number;
  readyTicks: number;
  riseTicks: number;
  upFirst: number;
  upLast: number;
  duckTicks: number;
  boopTicks: number;
  gapTicks: number;
  hammerTicks: number;
  ticketsPerBoop: number;
  lines: { ready: string; boop: string; result: string };
};
// Comet Cruise (spec 8.2): a fixed seeded field of falling stars and rocks.
export type CometContent = {
  stars: number;
  rocks: number;
  readyTicks: number;
  gapTicks: number;
  travelFirst: number;
  travelLast: number;
  passTicks: number;
  flashTicks: number;
  moveTicks: number;
  wobbleTicks: number;
  ticketsPerStar: number;
  lines: { ready: string; play: string; result: string };
};
// The ticket counter's prizes and what each costs in tickets.
export type CounterContent = { prizes: { prize: string; price: number }[] };
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
// The painted skee-ball close-up (`public/assets/arcade/skee-lane.json`, spec
// 8.2), in the image's pixels: the lane's playing surface at its foot (`near`)
// and where it meets the hump (`far`), the flat target board's face, and the
// blank marquee plate.
export type SkeeCalibration = {
  image: string;
  size: { w: number; h: number };
  lane: {
    near: { y: number; left: number; right: number };
    far: { y: number; left: number; right: number };
  };
  board: { x: number; y: number; w: number; h: number };
  plate: { x: number; y: number; w: number; h: number };
};
// The painted Boop-a-Mole cabinet (`public/assets/arcade/mole-cabinet.json`,
// spec 8.2), in the image's pixels: the blank marquee plate, and each hole's
// opening, the ellipse where its dark inside meets the rim.
// The clubhouse microwave's cooking game (spec 8.2). A dish's `time` is its
// box's, in microwave seconds, each `ticksPerSecond` ticks long. Let go before
// `frozen` and it's still frozen (the next hold cooks on); within `golden`
// seconds of `time` it's golden; from `burnt` on it's burnt; at `stop` the
// microwave stops itself. What each pays (`snacks`), and what each says.
export type CookDish = "nuggets" | "mac";
export type CookZone = "under" | "golden" | "over" | "burnt";
export type CookContent = {
  ticksPerSecond: number;
  golden: number;
  dishes: Record<CookDish,
    { label: string; time: number; frozen: number; burnt: number; stop: number }>;
  snacks: Record<CookZone, number>;
  dingTicks: number;
  lines: { start: string; frozen: string } & Record<CookZone, string>;
};
// The microwave's close-up (public/assets/arcade/microwave.json), in its
// image's pixels: the door's glass, the turntable's rim inside it, the timer's
// display, the start button, and the fridge's front under it.
export type CookCalibration = {
  image: string;
  size: { w: number; h: number };
  glass: { x: number; y: number; w: number; h: number; r: number };
  plate: { cx: number; cy: number; rx: number; ry: number };
  display: { x: number; y: number; w: number; h: number };
  button: { cx: number; cy: number; r: number };
  front: { x: number; y: number; w: number; h: number };
};
export type MoleCalibration = {
  image: string;
  size: { w: number; h: number };
  plate: { x: number; y: number; w: number; h: number };
  holes: Record<MoleHole, { cx: number; cy: number; rx: number; ry: number }>;
};
export type CometCalibration = {
  image: string;
  size: { w: number; h: number };
  marquee: { x: number; y: number; w: number; h: number };
  screen: { x: number; y: number; w: number; h: number };
  field: { x: number; y: number; w: number; h: number };
  deck: { x: number; y: number; w: number; h: number };
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
  befriended?: string;
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
  hints: { charge: string; chain: string; catch: string; lean: string; trace: string };
  commands: {
    soothe: { label: string; check: CheckSpec };
    snack: { label: string; snackDetail: string };
    run: { label: string };
  };
  // What a critter can feel (Milestone 42): each feeling's label and the
  // command id that answers it, and the calm an answered feeling adds.
  feelings: Record<FeelingId, { label: string; answer: string }>;
  feelingBonus: number;
  // Who got the jump on a recurring critter (Milestone 51): the calm Fae
  // starts with when she surprised it, and the intro lines, with {name}.
  firstTouch: { surprise: number; lines: { surprised: string; caught: string } };
  // Once Fae has calmed `calms` of a species, a recurring one calms on touch
  // with `line` (Milestone 51), its {name} filled in.
  oldFriends: { calms: number; line: string };
  // The reward line: `sticker` when the species' sticker is new, `coins`
  // otherwise, with {sticker} and {coins} filled in (spec 8).
  rewards: { sticker: string; coins: string };
};
// The closed set of feelings (spec 8); each has an icon drawn in code.
export type FeelingId = "zoomy" | "curious" | "bored" | "grumpy" | "hungry";
export type Grade = "great" | "good" | "miss";
export type BattleTalk = {
  knot: string;
  turn: number;
  speaker: string | null;
  text: string;
  revealed: number;
  choices: string[];
  selected: number;
  ended: boolean;
  grade: Grade | null;
};
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
export type TracePoint = { x: number; y: number };
export type TracePath = { id: string; points: TracePoint[] };
export type TraceSpec = {
  kind: "trace";
  dryTicks: number;
  brushSpeed: number;
  reachRadius: number;
  paths: TracePath[];
};
export type CheckSpec = RingSpec | ChargeSpec | ChainSpec | CatchSpec | LeanSpec | TraceSpec;
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
    }
  | {
      kind: "trace";
      side: CheckSide;
      tick: number;
      spec: TraceSpec;
      path: TracePath;
      checkpoint: number;
      brush: TracePoint;
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
  level: number;
  species: string;
  name: string;
  calmName: string;
  atlas: string;
  auraCentre: Point;
  bodyCentre: Point;
  figureHeight: number;
  toyScale: number;
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
  // A mini-boss's wind-up (Milestone 50), or null: from turn `start`, then
  // every `every` turns, it puffs up for `bubbles` turns, feeling that many
  // things at once; its lines start it, carry it on, and end it popped.
  windUp: WindUp | null;
  talk: {
    label: string;
    // The battle's line while Talk is the only command (the kid stops
    // scribbling and listens).
    prompt: string;
    talkAt: number;
    knots: [string, string, string];
    calm: Record<Grade, number>;
  } | null;
  canRun: boolean;
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
export type WindUp = {
  start: number;
  every: number;
  bubbles: number;
  lines: { start: string; puffing: string; fizzle: string };
};
export type BattlePhase =
  | "intro"
  | "command"
  | "check"
  | "result"
  | "talk"
  | "burst"
  | "burstResult"
  // A wind-up popped all over: the critter lets go of nothing (Milestone 50).
  | "fizzle"
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
  // The turn, from 1 (Milestone 50); 0 while a critter that caught Fae
  // bursts first (Milestone 51).
  turn: number;
  // A mini-boss puffed up (Milestone 50): the feelings it shows at once,
  // which are popped, and the turns left before it lets go (this one too).
  // `feelings` wait meanwhile.
  windUp: { feelings: FeelingId[]; popped: boolean[]; left: number } | null;
  talkMode?: boolean;
  talk?: BattleTalk | null;
  talkTurns?: number;
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
    }
  | {
      kind: "trace";
      side: CheckSide;
      brush: TracePoint;
      path: TracePath;
      checkpoint: number;
      results: BeatResult[];
      dry: number;
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
  // show: off, during a wind-up, or outside the command menu and its result.
  feelings: {
    now: { id: FeelingId; label: string } | null;
    next: FeelingId | null;
    // Only once the lantern has peeked.
    later: FeelingId | null;
    answered: boolean;
  } | null;
  // A wind-up's bubbles (Milestone 50), in the command menu and its result;
  // else null. `puff` counts its turns so far (1 on the first), 0 outside
  // one, for the critter to swell by.
  windUp: { bubbles: { id: FeelingId; label: string; popped: boolean }[] } | null;
  puff: number;
  lastGrade: Grade | null;
  rewardSticker: string | null;
  talk: BattleTalk | null;
};
// `party` overrides who starts in the party (test fixtures); the default is
// every roster member with `start: true`, in roster order.
export type Fixture = {
  area: string; spawn: string; seed?: number; party?: string[];
  variables?: Record<string, boolean>;
};
// One friend in the party: member 0 follows Fae, member i follows member i-1,
// each along its own breadcrumb trail of its leader's recent positions.
export type PartyMember = {
  id: string;
  xp: number;
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
  xp: number;
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
    ending?: true;
    credits?: true;
  } | null;
  // The set pieces' moods, for the whole game.
  critters: Record<string, Mood>;
  // This visit's recurring critters, rolled on arrival (spec 6).
  wild: Wild[];
  // How many of each species Fae has calmed (Milestone 51), by species.
  calms: Record<string, number>;
  stickers: string[];
  safeSpot: { area: string; spawn: string };
  battle: Battle | null;
  arcade: ArcadeGame | null;
  prizes: string[];
  tickets: number;
  journalOpen: boolean;
  lantern: boolean;
  coins: number;
  snacks: number;
  finale: "morning" | "credits" | null;
  backLink?: { area: string; direction: Direction };
};
// What a tick of an arcade game changes: the game itself and what it pays out.
export type ArcadeOwned = Pick<State, "arcade" | "prizes" | "tickets">;
// A tick of any of them: the cooking game pays snacks too.
export type ArcadeStep = ArcadeOwned & Pick<State, "snacks">;
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
  // Ticks Fae has been in its sight, from 0 (Milestone 51): it chases from
  // `roam.noticeTicks`, and counts on to `noticeTicks + alertTicks`.
  notice: number;
};
// Who got the jump on a recurring critter as it met Fae (Milestone 51).
export type FirstTouch = "surprised" | "caught" | "even";
// A recurring critter's mark over its head (Milestone 51): "?" while it
// hasn't noticed Fae in its sight, "!" just after it has.
export type WildMark = { key: string; kind: string; point: Point; mark: "?" | "!" };
export type Event =
  | { type: "button"; button: "confirm" | "cancel" | "menu" }
  | { type: "level-up"; member: string; from: number; to: number;
      deltas: { power: number; magic: number; life: number; guard: number } }
  | { type: "ending-save"; state: State };
