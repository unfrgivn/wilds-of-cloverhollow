import type {
  Area,
  Critter,
  Point,
  PresentCritter,
  SetPiece,
  State,
  Wild,
  World,
} from "./types";
import { nextNotice, noticed } from "./encounter";
import { distance, resolveCollision, resolveMove } from "./geometry";
import type { InkFacts } from "./ink";
import { sceneryArea } from "./props";
import { nextRandom } from "./random";

export { nextNotice, noticed };

export function calmedCritters(world: World, state: State): Record<string, boolean> {
  const calmed: Record<string, boolean> = {};
  for (const kind of Object.values(world.critters))
    if (state.stickers.includes(kind.sticker.id) || (state.calms[kind.species] ?? 0) > 0)
      calmed[kind.species] = true;
  for (const area of Object.values(world.areas))
    for (const piece of area.critters) {
      const pieceCalm = state.critters[piece.id] === "calm";
      calmed[piece.id] = calmed[piece.id] === true || pieceCalm;
      if (pieceCalm) {
        const kind = world.critters[piece.id];
        if (kind !== undefined) calmed[kind.species] = true;
      }
    }
  return calmed;
}

// What the story's externals answer from (spec 7, 8): coins() from Fae's
// purse, and calmed(name) for a species once she owns its sticker (she has
// calmed one of them, anywhere) and for a set piece by its own mood.
export function inkFacts(world: World, state: State): InkFacts {
  return {
    calmed: calmedCritters(world, state),
    coins: state.coins,
    snacks: state.snacks,
    prizes: state.prizes,
    tickets: state.tickets,
    plushesLeft: world.arcade.claw.heap.filter((plush) => !state.prizes.includes(plush.prize))
      .length,
  };
}

/*
 * The recurring critters out in an area this visit (spec 6), rolled on every
 * arrival. Each den, in order, draws twice from the state's PRNG (is one out,
 * and which kind), so how many draws an arrival takes depends only on the
 * content, never on how the rolls came out. Until `after` is calm the area is
 * quiet and draws nothing; a den's own `after` keeps that den quiet alone.
 */
export function rollWild(world: World, state: State, area: Area): Pick<State, "wild" | "rng"> {
  const recurring = area.recurring;
  if (recurring === undefined) return { wild: [], rng: state.rng };
  const calmed = calmedCritters(world, state);
  if (recurring.after !== undefined && calmed[recurring.after] !== true)
    return { wild: [], rng: state.rng };
  let random = state;
  const wild: Wild[] = [];
  recurring.dens.forEach((den, index) => {
    if (den.after !== undefined && calmed[den.after] !== true) return;
    const [out, drawn] = nextRandom(random);
    const [pick, picked] = nextRandom(drawn);
    random = picked;
    const kind = den.kinds[Math.floor(pick * den.kinds.length)];
    const touch = Math.max(...den.kinds.map((id) => world.critters[id]?.touchRadius ?? 70));
    const clear = world.tunables.roam.sight + touch;
    if (out >= den.chance || kind === undefined || distance(state.player, den.point) <= clear)
      return;
    wild.push({
      kind,
      den: index,
      mood: "chaos",
      x: den.point.x,
      y: den.point.y,
      target: { ...den.point },
      pauseTicks: 0,
      cooldownTicks: 0,
      facing: "down",
      moving: false,
      notice: 0,
    });
  });
  return { wild, rng: random.rng };
}

export function chooseRoamTarget(
  world: World,
  state: State,
  area: Area,
  home: Point,
  radius: number,
): { target: Point; state: State } {
  const first = nextRandom(state);
  const second = nextRandom(first[1]);
  const third = nextRandom(second[1]);
  const rawX = first[0] * 2 - 1;
  const rawY = second[0] * 2 - 1;
  const length = Math.sqrt(rawX * rawX + rawY * rawY);
  const unitX = length === 0 ? 1 : rawX / length;
  const unitY = length === 0 ? 0 : rawY / length;
  const targetRadius = third[0] * radius;
  const candidate = {
    x: home.x + unitX * targetRadius,
    y: home.y + unitY * targetRadius,
  };
  const resolved = resolveCollision(candidate, area, world.tunables.follow.radius);
  const gap = distance(home, resolved);
  const target = gap <= radius
    ? resolved
    : {
        x: home.x + (resolved.x - home.x) * radius / gap,
        y: home.y + (resolved.y - home.y) * radius / gap,
      };
  return { target, state: third[1] };
}

// This visit's recurring critters for one tick (spec 8): while Fae is free,
// each chaos one wanders inside its den, pausing between seeded random
// targets, or chases her once it has noticed her in its sight (Milestone 51),
// giving up beyond its leash; one cooling down (after a battle or a run)
// heads home. Calm ones stand still.
export function stepWild(
  world: World,
  state: State,
  area: Area,
  player: Point,
  active: boolean,
): Pick<State, "wild" | "rng"> {
  let randomState = state;
  const roam = world.tunables.roam;
  const scenery = sceneryArea(world, state.ink, area);
  const wild = state.wild.map((previous): Wild => {
    const den = area.recurring?.dens[previous.den];
    const cooldownTicks = Math.max(0, previous.cooldownTicks - 1);
    if (den === undefined || !active || previous.mood === "calm")
      return { ...previous, cooldownTicks, moving: false };
    const home = den.point;
    const leash = den.radius + roam.sight * 2;
    const inSight = cooldownTicks === 0 && distance(previous, player) <= roam.sight &&
      distance(home, player) <= leash;
    const notice = nextNotice(previous, inSight, roam);
    const chasing = noticed({ ...previous, notice }, roam);
    let target = previous.target;
    let pauseTicks = previous.pauseTicks;
    if (chasing) target = player;
    else if (cooldownTicks > 0) target = home;
    else if (pauseTicks > 0) pauseTicks -= 1;
    else if (distance(previous, target) <= 0.5) {
      const picked = chooseRoamTarget(world, randomState, scenery, home, den.radius);
      target = picked.target;
      randomState = picked.state;
      pauseTicks = roam.pauseTicks;
    }
    const speed = chasing ? roam.chaseSpeed : roam.wanderSpeed;
    const gap = distance(previous, target);
    const amount = Math.min(speed, gap);
    const candidate = gap === 0
      ? { x: previous.x, y: previous.y }
      : {
          x: previous.x + (target.x - previous.x) * amount / gap,
          y: previous.y + (target.y - previous.y) * amount / gap,
        };
    const position = resolveMove(previous, candidate, scenery, world.tunables.follow.radius);
    const dx = position.x - previous.x;
    const dy = position.y - previous.y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const facing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? "left" : dx > 0 ? "right" : previous.facing)
      : (dy < 0 ? "up" : "down");
    return {
      ...previous,
      x: position.x,
      y: position.y,
      target,
      pauseTicks,
      cooldownTicks,
      facing,
      moving: moved > 0.0001,
      notice,
    };
  });
  return { wild, rng: randomState.rng };
}

// A recurring critter heads home and leaves Fae alone for a while: after a
// battle with it, or once she runs (spec 8).
export function sendHome(world: World, area: Area, critter: Wild, back: boolean): Wild {
  const home = area.recurring?.dens[critter.den]?.point ?? { x: critter.x, y: critter.y };
  return {
    ...critter,
    ...(back ? { x: home.x, y: home.y } : {}),
    cooldownTicks: world.tunables.roam.cooldownTicks,
    target: { ...home },
    notice: 0,
  };
}

// Whether a set piece is out (spec 8): always, or while its `visibleWhile`
// story variable is true.
export function setPieceOut(world: World, state: State, piece: SetPiece): boolean {
  return piece.visibleWhile === undefined ||
    world.storyVariable(state.ink, piece.visibleWhile) === true;
}

// Every critter out in Fae's area (spec 8): its set pieces that are out, then
// this visit's recurring critters. `key` names one in targets and render
// info: a set piece's id, or `wild:<den>`.
export function presentCritters(world: World, state: State): PresentCritter[] {
  const area = world.areas[state.area];
  if (area === undefined) return [];
  const pieces = area.critters.flatMap((piece): PresentCritter[] => {
    const kind = world.critters[piece.id];
    return kind === undefined || !setPieceOut(world, state, piece)
      ? []
      : [{ key: piece.id, kind, point: piece.point,
          mood: state.critters[piece.id] ?? "chaos", wild: null }];
  });
  const wild = state.wild.flatMap((critter): PresentCritter[] => {
    const kind = world.critters[critter.kind];
    return kind === undefined
      ? []
      : [{ key: `wild:${critter.den}`, kind, point: { x: critter.x, y: critter.y },
          mood: critter.mood, wild: critter }];
  });
  return [...pieces, ...wild];
}

// The critter Fae is battling, as it stands in the area.
export function battleFoe(world: World, state: State): PresentCritter | undefined {
  const battle = state.battle;
  if (battle === null) return undefined;
  const key = battle.den === null ? battle.critterId : `wild:${battle.den}`;
  return presentCritters(world, state).find((critter) => critter.key === key);
}

// A touch is an outside-to-inside crossing of a critter's touch circle
// (spec 8): by Fae or, for a recurring critter, by either of them.
export function touchingCritter(
  world: World,
  state: State,
  movedWild: readonly Wild[],
  player: Point,
): { critter: Critter; wildTouch: Wild | undefined } | undefined {
  const wildTouch = movedWild.find((next, index) => {
    const old = state.wild[index];
    const touch = world.critters[next.kind]?.touchRadius;
    return old !== undefined && touch !== undefined && next.mood === "chaos" &&
      next.cooldownTicks === 0 && distance(state.player, old) > touch &&
      distance(player, next) <= touch;
  });
  if (wildTouch !== undefined) {
    const critter = world.critters[wildTouch.kind];
    if (critter !== undefined) return { critter, wildTouch };
  }
  const pieceTouch = presentCritters(world, state).find((item) =>
    item.wild === null && item.mood === "chaos" &&
    distance(state.player, item.point) > item.kind.touchRadius &&
    distance(player, item.point) <= item.kind.touchRadius);
  return pieceTouch === undefined ? undefined : { critter: pieceTouch.kind, wildTouch: undefined };
}
