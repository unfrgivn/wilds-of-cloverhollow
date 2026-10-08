import type {
  Npc,
  Direction,
  ActionFrame,
  Area,
  Box,
  Event,
  Fixture,
  FollowTunables,
  PartyContent,
  PartyMember,
  Point,
  Polygon,
  Spawn,
  State,
  World,
  Battle,
  BattleView,
  Critter,
  Grade,
  PresentCritter,
  SetPiece,
  Wild,
} from "./types";
import { createInkState, runInk, type InkFacts } from "./ink";
import { sceneryArea } from "./props";

// No `lantern`: it's optional, present only while pressed, so a blank frame,
// a recorded one, and a real key's frame all have the same shape, and a save's
// last input matches a new game's (spec 3.2, 10).
export const blankInput = (): ActionFrame => ({
  move: { x: 0, y: 0 },
  confirm: false,
  cancel: false,
  menu: false,
});

// Fae's feet-anchored body box (spec 5): what her followers hide behind.
export const faeBox: Box = { width: 50, height: 140 };
// Extra diagonal heels give tall chained members a visible, natural fallback.
const chainedHeelX = 36;
const chainedHeelUp = -40;
const chainedHeelDown = 36;

function partyContent(world: World, id: string): PartyContent {
  const content = world.party[id];
  if (content === undefined) throw new Error(`Unknown party member: ${id}`);
  return content;
}

// Where each member stands when the party is placed fresh (a new game, or a
// door): member 0 at Fae's heel, member i at member i-1's. The chain stops at
// the first member without a slot.
export function partySlots(
  area: Area,
  fae: Point,
  follow: FollowTunables,
  members: PartyContent[],
): { id: string; slot: Point | undefined }[] {
  const slots: { id: string; slot: Point | undefined }[] = [];
  const ahead = [{ point: fae, box: faeBox }];
  let leader = fae;
  for (const [index, member] of members.entries()) {
    const slot = visibleFollowerSlot(
      area,
      leader,
      leader,
      follow,
      member.box,
      ahead,
      index > 0,
    );
    slots.push({ id: member.id, slot });
    if (slot === undefined) break;
    ahead.push({ point: slot, box: member.box });
    leader = slot;
  }
  return slots;
}

function spawnParty(
  world: World,
  ink: string,
  room: Area,
  spawn: Spawn,
  ids: string[],
): PartyMember[] {
  const area = sceneryArea(world, ink, room);
  const fae = { x: spawn.x, y: spawn.y };
  const members = ids.map((id) => partyContent(world, id));
  const slots = partySlots(area, fae, world.tunables.follow, members);
  let leader = fae;
  return members.map((member, index) => {
    const slot = slots[index]?.slot;
    if (slot === undefined)
      throw new Error(`No ${member.id} slot at ${area.id} (${spawn.x}, ${spawn.y})`);
    const placed = {
      id: member.id,
      x: slot.x,
      y: slot.y,
      facing: spawn.facing,
      motion: { distance: 0, moving: false },
      stillTicks: 0,
      trail: [slot, leader],
    };
    leader = slot;
    return placed;
  });
}

export function createState(
  world: World,
  fixture: Fixture,
  seed = fixture.seed ?? 1,
): State {
  const area = world.areas[fixture.area];
  if (area === undefined)
    throw new Error(`Unknown fixture area: ${fixture.area}`);
  const spawn = area.spawns[fixture.spawn];
  if (spawn === undefined) throw new Error(`Unknown spawn: ${fixture.spawn}`);
  const ids =
    fixture.party ??
    Object.values(world.party)
      .filter((member) => member.start)
      .map((member) => member.id);
  const ink = createInkState(world.story, seed);
  const state: State = {
    tick: 0,
    area: area.id,
    player: { x: spawn.x, y: spawn.y },
    facing: spawn.facing,
    rng: seed >>> 0,
    previousInput: blankInput(),
    motion: { distance: 0, moving: false },
    transition: null,
    party: spawnParty(world, ink, area, spawn, ids),
    ink,
    dialogue: null,
    critters: Object.fromEntries(
      Object.values(world.areas).flatMap((each) => each.critters)
        .map((piece) => [piece.id, "chaos"]),
    ),
    wild: [],
    stickers: [],
    safeSpot: { area: area.id, spawn: fixture.spawn },
    battle: null,
    journalOpen: false,
    lantern: false,
    coins: 0,
    snacks: 2,
  };
  return { ...state, ...rollWild(world, state, area) };
}

/*
 * The recurring critters out in an area this visit (spec 6), rolled on every
 * arrival. Each den, in order, draws twice from the state's PRNG (is one out,
 * and which kind), so how many draws an arrival takes depends only on the
 * content, never on how the rolls came out. Until `after` is calm the area is
 * quiet and draws nothing.
 */
export function rollWild(world: World, state: State, area: Area): Pick<State, "wild" | "rng"> {
  const recurring = area.recurring;
  if (recurring === undefined ||
      (recurring.after !== undefined && inkFacts(world, state).calmed[recurring.after] !== true))
    return { wild: [], rng: state.rng };
  let random = state;
  const wild: Wild[] = [];
  recurring.dens.forEach((den, index) => {
    const [out, drawn] = nextRandom(random);
    const [pick, picked] = nextRandom(drawn);
    random = picked;
    const kind = den.kinds[Math.floor(pick * den.kinds.length)];
    if (out >= den.chance || kind === undefined) return;
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
    });
  });
  return { wild, rng: random.rng };
}

// One snack for `price` coins, if Fae can pay (spec 7, a `buy:` line).
export function purchaseSnack(state: State, price: number): State {
  return price < 0 || state.coins < price
    ? state
    : { ...state, coins: state.coins - price, snacks: state.snacks + 1 };
}

export function nextRandom(state: State): [number, State] {
  const next = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, { ...state, rng: next }];
}

function vertex(polygon: Polygon, index: number): [number, number] {
  const value = polygon[index];
  if (value === undefined) throw new Error("Polygon has no vertices");
  return value;
}

export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = vertex(polygon, index);
    const prior = vertex(polygon, previous);
    const crosses = current[1] > point.y !== prior[1] > point.y;
    if (
      crosses &&
      point.x <
        ((prior[0] - current[0]) * (point.y - current[1])) /
          (prior[1] - current[1]) +
          current[0]
    )
      inside = !inside;
  }
  return inside;
}

export function closestPointOnPolygon(
  point: Point,
  polygon: Polygon,
): { point: Point; distance: number } {
  let bestPoint = { x: vertex(polygon, 0)[0], y: vertex(polygon, 0)[1] };
  let best = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = vertex(polygon, index);
    const end = vertex(polygon, (index + 1) % polygon.length);
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = dx * dx + dy * dy;
    const projection =
      length === 0
        ? 0
        : ((point.x - start[0]) * dx + (point.y - start[1]) * dy) / length;
    const t = Math.max(0, Math.min(1, projection));
    const nearest = { x: start[0] + dx * t, y: start[1] + dy * t };
    const differenceX = point.x - nearest.x;
    const differenceY = point.y - nearest.y;
    const distance = Math.sqrt(
      differenceX * differenceX + differenceY * differenceY,
    );
    if (distance < best) {
      best = distance;
      bestPoint = nearest;
    }
  }
  return { point: bestPoint, distance: best };
}

export function distanceToPolygon(point: Point, polygon: Polygon): number {
  return closestPointOnPolygon(point, polygon).distance;
}

function pushFromPolygon(
  point: Point,
  polygon: Polygon,
  radius: number,
  keepInside: boolean,
): Point {
  const inside = pointInPolygon(point, polygon);
  const closest = closestPointOnPolygon(point, polygon);
  const dx = point.x - closest.point.x;
  const dy = point.y - closest.point.y;
  const distance = closest.distance;
  if (keepInside && inside && distance >= radius) return point;
  if (!keepInside && !inside && distance >= radius) return point;
  const safeDistance = Math.max(distance, 0.0001);
  const direction = keepInside ? (inside ? 1 : -1) : inside ? -1 : 1;
  const amount =
    !keepInside && inside
      ? radius + distance
      : keepInside && !inside
        ? radius + distance
        : radius - distance + 0.001;
  return {
    x: point.x + ((direction * dx) / safeDistance) * amount,
    y: point.y + ((direction * dy) / safeDistance) * amount,
  };
}

export function resolveCollision(
  point: Point,
  area: Area,
  radius: number,
): Point {
  let result = point;
  for (let pass = 0; pass < 8; pass += 1) {
    result = pushFromPolygon(result, area.walkable, radius, true);
    for (const blocker of area.blockers)
      result = pushFromPolygon(result, blocker, radius, false);
  }
  return result;
}

function distance(a: Point, b: Point): number {
  const x = b.x - a.x;
  const y = b.y - a.y;
  return Math.sqrt(x * x + y * y);
}

function moveDirection(move: Point): Direction | undefined {
  if (move.x === 0 && move.y === 0) return undefined;
  if (Math.abs(move.x) >= Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

function validResolved(point: Point, area: Area, radius: number): boolean {
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius - 0.01 &&
    area.blockers.every((blocker) =>
      !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius - 0.01);
}

/*
 * One step from `previous` toward `candidate` (spec 6). The solver pushes out of
 * each shape in turn; in a gap narrower than the collider those pushes fight,
 * and it can stop inside one. Then the step slides along one axis, or stays.
 * Where the solver succeeds (every area before props) nothing changes.
 */
export function resolveMove(previous: Point, candidate: Point, area: Area, radius: number): Point {
  const resolved = resolveCollision(candidate, area, radius);
  if (validResolved(resolved, area, radius)) return resolved;
  const alongX = resolveCollision({ x: candidate.x, y: previous.y }, area, radius);
  if (validResolved(alongX, area, radius)) return alongX;
  const alongY = resolveCollision({ x: previous.x, y: candidate.y }, area, radius);
  return validResolved(alongY, area, radius) ? alongY : previous;
}

function chooseRoamTarget(
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
// targets, or chases her within sight, giving up beyond its leash; one
// cooling down (after a battle or a run) heads home. Calm ones stand still.
function updateWild(
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
    const chasing = cooldownTicks === 0 && distance(previous, player) <= roam.sight &&
      distance(home, player) <= leash;
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
    };
  });
  return { wild, rng: randomState.rng };
}

// A recurring critter heads home and leaves Fae alone for a while: after a
// battle with it, or once she runs (spec 8).
function sendHome(world: World, area: Area, critter: Wild, back: boolean): Wild {
  const home = area.recurring?.dens[critter.den]?.point ?? { x: critter.x, y: critter.y };
  return {
    ...critter,
    ...(back ? { x: home.x, y: home.y } : {}),
    cooldownTicks: world.tunables.roam.cooldownTicks,
    target: { ...home },
  };
}

// Whether a set piece is out (spec 8): always, or while its `visibleWhile`
// story variable is true.
function setPieceOut(world: World, state: State, piece: SetPiece): boolean {
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

export function targetInteractable(
  world: World,
  state: State,
): Area["interactables"][number] | Area["glows"][number] | undefined {
  if (state.transition !== null || state.dialogue !== null) return undefined;
  const area = world.areas[state.area];
  if (area === undefined) return undefined;
  const facing = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[state.facing];
  const calmCritters = presentCritters(world, state)
    .filter((critter) => critter.mood === "calm")
    .map((critter) => ({
      id: `critter:${critter.key}`,
      knot: critter.kind.calmKnot,
      point: critter.point,
      prompt: critter.kind.calmPrompt,
    }));
  const people = area.npcs
    .filter((npc) => npcVisible(world, state, npc))
    .map((npc) => ({
      id: `npc:${npc.id}`,
      knot: npc.knot,
      point: npc.point,
      prompt: npc.prompt,
    }));
  const glows = state.lantern
    ? area.glows.filter((glow): glow is Area["glows"][number] & { knot: string } =>
      glow.knot !== undefined).map((glow) => ({ ...glow, id: `glow:${glow.id}` }))
    : [];
  return [...area.interactables, ...glows, ...calmCritters, ...people]
    .map((item) => {
      const dx = item.point.x - state.player.x;
      const dy = item.point.y - state.player.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dot = length === 0 ? 1 : (dx * facing.x + dy * facing.y) / length;
      return { item, length, dot };
    })
    .filter(
      (item) =>
        item.length <= world.tunables.interact.range && item.dot >= 0.34,
    )
    .sort((a, b) => a.length - b.length)[0]?.item;
}

export function npcVisible(
  world: World,
  state: State,
  npc: Area["npcs"][number],
): boolean {
  return (
    !state.party.some((member) => member.id === npc.id) &&
    (npc.visibleWhile === undefined ||
      world.storyVariable(state.ink, npc.visibleWhile) === true)
  );
}

function solidArea(world: World, state: State, area: Area): Area {
  const scenery = sceneryArea(world, state.ink, area);
  return {
    ...scenery,
    blockers: [
      ...scenery.blockers,
      ...area.npcs
        .filter((npc) => npcVisible(world, state, npc))
        .map((npc) => npc.footprint),
    ],
  };
}

function joinReady(world: World, state: State): State {
  if (
    state.dialogue !== null ||
    state.battle !== null ||
    state.transition !== null ||
    state.journalOpen
  )
    return state;
  const area = world.areas[state.area];
  if (area === undefined) return state;
  const existing = new Set(state.party.map((member) => member.id));
  let party = state.party.slice();
  for (const content of Object.values(world.party)) {
    if (
      existing.has(content.id) ||
      content.joins === null ||
      world.storyVariable(state.ink, content.joins) !== true
    )
      continue;
    // She steps out of the person standing here (if she's shown).
    const person = area.npcs.find(
      (npc) => npc.id === content.id && npcVisible(world, state, npc),
    );
    const last = party[party.length - 1];
    const leader = last === undefined
      ? { ...state.player }
      : { x: last.x, y: last.y };
    const ahead = [
      { point: state.player, box: faeBox },
      ...party.map((member) => ({
        point: { x: member.x, y: member.y },
        box: partyContent(world, member.id).box,
      })),
    ];
    const point = person?.point ??
      visibleFollowerSlot(
        sceneryArea(world, state.ink, area),
        leader,
        leader,
        world.tunables.follow,
        content.box,
        ahead,
        party.length > 0,
      );
    if (point === undefined) continue;
    party.push({
      id: content.id,
      x: point.x,
      y: point.y,
      facing: state.facing,
      motion: { distance: 0, moving: false },
      stillTicks: 0,
      trail: [point, leader],
    });
    existing.add(content.id);
  }
  return party.length === state.party.length ? state : { ...state, party };
}

// What the story's externals answer from (spec 7, 8): coins() from Fae's
// purse, and calmed(name) for a species once she owns its sticker (she has
// calmed one of them, anywhere) and for a set piece by its own mood.
export function inkFacts(world: World, state: State): InkFacts {
  const calmed: Record<string, boolean> = {};
  for (const kind of Object.values(world.critters))
    if (state.stickers.includes(kind.sticker.id)) calmed[kind.species] = true;
  for (const area of Object.values(world.areas))
    for (const piece of area.critters) calmed[piece.id] = state.critters[piece.id] === "calm";
  return { calmed, coins: state.coins };
}

// Which way a person in the area looks: toward Fae while she talks to them
// (along the larger axis of the gap between them), otherwise as authored.
export function npcFacing(state: State, npc: Npc): Direction {
  if (state.dialogue === null || state.dialogue.knot !== npc.knot)
    return npc.facing;
  const dx = state.player.x - npc.point.x;
  const dy = state.player.y - npc.point.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function battleMessage(
  battle: Battle,
  text: string,
  phase: Battle["phase"],
): Battle {
  return { ...battle, phase, message: text, revealed: 0, phaseTicks: 0 };
}

export function gradeAim(delta: number, great: number, good: number): Grade {
  const absolute = Math.abs(delta);
  return absolute <= great ? "great" : absolute <= good ? "good" : "miss";
}

// Soothe, then one command per party member in party order, then Snack and
// Run (spec 8). A friend's command rests for its content turns after use.
export function battleCommands(
  world: World,
  state: State,
): BattleView["commands"] {
  const battle = state.battle;
  if (battle === null) return [];
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return [];
  const friends = state.party.flatMap((member) => {
    const content = world.party[member.id];
    if (content === undefined) return [];
    const rest = battle.rest[content.command.id] ?? 0;
    return [
      {
        id: content.command.id,
        label: content.command.label,
        detail: rest > 0 ? content.command.resting : null,
        disabled: rest > 0,
      },
    ];
  });
  return [
    {
      id: "soothe",
      label: world.battle.commands.soothe.label,
      detail: null,
      disabled: false,
    },
    ...friends,
    {
      id: "snack",
      label: world.battle.commands.snack.label,
      detail: (world.battle.commands.snack.snackDetail ?? "").replace(
        "N",
        String(state.snacks),
      ),
      disabled: state.snacks === 0,
    },
    {
      id: "run",
      label: world.battle.commands.run.label,
      detail: null,
      disabled: false,
    },
  ];
}

// A turn passes: every resting friend is one turn closer to ready. Entries at
// zero are dropped, so "missing" is the only way to spell "ready".
function restTurn(rest: Battle["rest"]): Battle["rest"] {
  return Object.fromEntries(
    Object.entries(rest).flatMap(([id, turns]) =>
      turns > 1 ? [[id, turns - 1]] : [],
    ),
  );
}

// The numbers and lines the critter-side aim resolves with: a friend's
// command, or Soothe for anything else.
function critterSideCommand(
  critter: Critter,
  command: string | null,
): { numbers: { calm: number; great: number; good: number }; lines: Record<Grade, string> } {
  if (command !== null) {
    const numbers = critter.commands.friends[command];
    const lines = critter.lines.friends[command];
    if (numbers !== undefined && lines !== undefined) return { numbers, lines };
  }
  return { numbers: critter.commands.soothe, lines: critter.lines.soothe };
}

export function battleView(world: World, state: State): BattleView | null {
  const battle = state.battle;
  if (battle === null) return null;
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return null;
  return {
    critterId: critter.id,
    critterName: critter.name,
    battleHeight: critter.battleHeight,
    auraCentre: critter.auraCentre,
    bodyCentre: critter.bodyCentre,
    phase: battle.phase,
    message: battle.message,
    revealed: battle.revealed,
    commands: battleCommands(world, state),
    selected: battle.selected,
    energy: battle.energy,
    energyMax: critter.energyMax,
    calm: battle.calm,
    calmMax: critter.calmMax,
    aim:
      battle.aim === null
        ? null
        : {
            side: battle.aim.side,
            progress: battle.aimTick / battle.aim.ticks,
            target: battle.aim.targetTick / battle.aim.ticks,
          },
    lastGrade: battle.lastGrade,
    rewardSticker: battle.rewardSticker,
  };
}

function nextCommand(
  selected: number,
  delta: number,
  commands: ReturnType<typeof battleCommands>,
): number {
  let result = selected;
  for (let count = 0; count < commands.length; count += 1) {
    result = (result + delta + commands.length) % commands.length;
    if (!commands[result]?.disabled) return result;
  }
  return selected;
}

function startAim(
  battle: Battle,
  side: "critter" | "fae",
  ticks: number,
  targetTick: number,
  greatWindow: number,
  goodWindow: number,
): Battle {
  return {
    ...battle,
    phase: "aim",
    aim: { side, ticks, targetTick, greatWindow, goodWindow },
    aimTick: 0,
    phaseTicks: 0,
    lastGrade: null,
    message: "",
    revealed: 0,
  };
}

// The party while Fae is frozen (a battle, a dialogue, the journal): nobody
// walks, and the still ticks keep counting so Maddie sits.
function restingParty(party: PartyMember[]): PartyMember[] {
  return party.map((member) => ({
    ...member,
    stillTicks: member.stillTicks + 1,
    motion: { ...member.motion, moving: false },
  }));
}

// The party on a tick that interrupts walking (a door, a talk starting): the
// walk frames stop, the still count doesn't start yet.
function haltedParty(party: PartyMember[]): PartyMember[] {
  return party.map((member) => ({
    ...member,
    motion: { ...member.motion, moving: false },
  }));
}

function battleStep(world: World, state: State, input: ActionFrame): State {
  const battle = state.battle;
  if (battle === null) return state;
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return state;
  const confirm = input.confirm && !state.previousInput.confirm;
  const nextBase = {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    motion: { ...state.motion, moving: false },
    party: restingParty(state.party),
  };
  let next = { ...battle, phaseTicks: battle.phaseTicks + 1 };
  if (next.revealed < next.message.length)
    return {
      ...nextBase,
      battle: {
        ...next,
        revealed: confirm
          ? next.message.length
          : Math.min(
              next.message.length,
              next.revealed + world.tunables.interact.revealPerTick,
            ),
      },
    };
  if (
    [
      "intro",
      "result",
      "burst",
      "burstResult",
      "run",
      "soothed",
      "reward",
      "rest",
    ].includes(next.phase)
  ) {
    if (!confirm) return { ...nextBase, battle: next };
    if (next.phase === "intro")
      next = {
        ...next,
        phase: "command",
        message: critter.lines.command,
        revealed: 0,
        phaseTicks: 0,
      };
    else if (next.phase === "result")
      next =
        next.calm >= critter.calmMax
          ? battleMessage(next, critter.lines.soothed, "soothed")
          : battleMessage(next, critter.lines.burst, "burst");
    else if (next.phase === "burst")
      next = startAim(
        next,
        "fae",
        critter.burst.ticks,
        critter.burst.targetTick,
        critter.burst.greatWindow,
        critter.burst.goodWindow,
      );
    else if (next.phase === "burstResult")
      next =
        next.energy <= 0
          ? battleMessage(next, critter.lines.rest, "rest")
          : {
              ...next,
              phase: "command",
              message: critter.lines.command,
              revealed: 0,
              phaseTicks: 0,
              rest: next.rest,
            };
    else if (next.phase === "soothed") {
      // Every calm pays; the sticker comes once per species (spec 8).
      const fresh = !state.stickers.includes(critter.sticker.id);
      const line = (fresh ? world.battle.rewards.sticker : world.battle.rewards.coins)
        .replace("{sticker}", critter.sticker.name)
        .replace("{coins}", String(critter.coins));
      next = {
        ...battleMessage(next, line, "reward"),
        rewardSticker: fresh ? critter.sticker.id : null,
      };
    } else if (next.phase === "reward") {
      const den = next.den;
      return {
        ...nextBase,
        ...(den === null
          ? { critters: { ...state.critters, [next.critterId]: "calm" } }
          : { wild: state.wild.map((item) =>
              item.den === den ? { ...item, mood: "calm" } : item) }),
        coins: state.coins + critter.coins,
        stickers: next.rewardSticker === null
          ? state.stickers
          : [...state.stickers, next.rewardSticker],
        battle: null,
      };
    } else if (next.phase === "run") {
      const den = next.den;
      const area = world.areas[state.area];
      const away: Record<Direction, Direction> =
        { up: "down", down: "up", left: "right", right: "left" };
      return {
        ...nextBase,
        player: { ...next.entry },
        facing: away[state.facing],
        battle: null,
        ...(den === null || area === undefined
          ? {}
          : { wild: state.wild.map((item) =>
              item.den === den ? sendHome(world, area, item, true) : item) }),
      };
    }
    else if (next.phase === "rest")
      next = { ...next, phase: "rest", phaseTicks: next.phaseTicks };
    if (
      next.phase === "rest" &&
      battle.phase === "rest" &&
      state.transition === null
    )
      return {
        ...nextBase,
        battle: null,
        transition: { target: state.safeSpot, phase: "out", elapsed: 0 },
      };
    return { ...nextBase, battle: next };
  }
  if (next.phase === "command") {
    const commands = battleCommands(world, { ...state, battle: next });
    if (input.choose !== undefined) {
      const chosen = commands[input.choose];
      if (chosen !== undefined && !chosen.disabled)
        next = { ...next, selected: input.choose };
      else return { ...nextBase, battle: next };
    }
    const up = input.move.y < -0.5 && state.previousInput.move.y >= -0.5;
    const down = input.move.y > 0.5 && state.previousInput.move.y <= 0.5;
    if (up || down)
      return {
        ...nextBase,
        battle: {
          ...next,
          selected: nextCommand(next.selected, down ? 1 : -1, commands),
        },
      };
    if (!confirm && input.choose === undefined)
      return { ...nextBase, battle: next };
    const chosen = commands[next.selected];
    if (chosen === undefined || chosen.disabled)
      return { ...nextBase, battle: next };
    if (chosen.id === "run")
      return {
        ...nextBase,
        battle: battleMessage(next, critter.lines.run, "run"),
      };
    if (chosen.id === "snack") {
      const message = battleMessage(next, critter.lines.snack, "result");
      return {
        ...nextBase,
        snacks: state.snacks - 1,
        battle: {
          ...message,
          rest: restTurn(next.rest),
          energy: Math.min(
            critter.energyMax,
            next.energy + critter.commands.snack.energy,
          ),
          calm: Math.min(
            critter.calmMax,
            next.calm + critter.commands.snack.calm,
          ),
        },
      };
    }
    const timing = critter.timing;
    const friend = critter.commands.friends[chosen.id];
    return {
      ...nextBase,
      battle: startAim(
        {
          ...next,
          command: chosen.id,
          rest:
            friend === undefined
              ? restTurn(next.rest)
              : { ...restTurn(next.rest), [chosen.id]: friend.rest },
        },
        "critter",
        timing.aimTicks,
        timing.targetTick,
        timing.greatWindow,
        timing.goodWindow,
      ),
    };
  }
  if (next.phase === "aim" && next.aim !== null) {
    const aim = next.aim;
    const press = confirm;
    const tick = next.aimTick + 1;
    const result: Grade | null =
      press || tick >= aim.ticks
        ? press
          ? gradeAim(tick - aim.targetTick, aim.greatWindow, aim.goodWindow)
          : "miss"
        : null;
    if (result === null)
      return {
        ...nextBase,
        battle: {
          ...next,
          aimTick: tick,
          aim: { ...aim },
        },
      };
    if (aim.side === "critter") {
      const command = critterSideCommand(critter, next.command);
      const bonus =
        result === "great"
          ? command.numbers.great
          : result === "good"
            ? command.numbers.good
            : 0;
      const calm = Math.min(
        critter.calmMax,
        next.calm + command.numbers.calm + bonus,
      );
      return {
        ...nextBase,
        battle: battleMessage(
          {
            ...next,
            calm,
            lastGrade: result,
          },
          command.lines[result],
          "result",
        ),
      };
    }
    const random = nextRandom(nextBase);
    const base = random[0] < critter.burst.bigChance ? 2 : 1;
    const damage =
      result === "great" ? 0 : result === "good" ? Math.max(0, base - 1) : base;
    return {
      ...random[1],
      battle: battleMessage(
        { ...next, energy: next.energy - damage, lastGrade: result },
        critter.lines.burstResult[result],
        "burstResult",
      ),
    };
  }
  return { ...nextBase, battle: next };
}

// A line tagged `travel: <area>.<spawn>` sends Fae there when the
// conversation closes; the target carries forward through the lines after it.
function dialogueState(
  knot: string,
  result: ReturnType<typeof runInk>,
  carried?: { area: string; spawn: string },
): State["dialogue"] {
  const tag = result.line?.tags.find((item) => item.startsWith("travel:"));
  const [area, spawn, ...rest] = tag?.slice("travel:".length).trim().split(".") ?? [];
  const travel = area !== undefined && spawn !== undefined && rest.length === 0
    ? { area, spawn }
    : carried;
  return {
    knot,
    speaker: result.line?.speaker ?? null,
    text: result.line?.text ?? "",
    revealed: 0,
    choices: result.choices,
    selected: 0,
    ended: result.ended,
    ...(travel === undefined ? {} : { travel }),
  };
}

// A line tagged `buy: snack <price>` sells Fae a snack as it's shown (spec
// 7). The loader allows no other item or price format.
function applyBuyTag(state: State, tags: string[]): State {
  const price = tags.map((tag) => /^buy:\s*snack\s+(\d+)$/.exec(tag.trim())?.[1])
    .find((item) => item !== undefined);
  return price === undefined ? state : purchaseSnack(state, Number(price));
}

function closeDialogue(state: State): State {
  const dialogue = state.dialogue;
  if (dialogue === null) return state;
  return {
    ...state,
    dialogue: null,
    transition:
      dialogue.travel === undefined
        ? state.transition
        : { target: dialogue.travel, phase: "out", elapsed: 0 },
  };
}

/*
 * Dialogue state machine (spec section 7). Fae is frozen throughout; Maddie
 * keeps counting still ticks so she sits while Fae reads.
 *
 *   typing ──confirm──▶ shown (whole line at once)
 *   typing ──ticks────▶ shown (revealPerTick characters per tick)
 *   shown, choices    ──up/down──▶ move the selection (wraps)
 *   shown, choices    ──confirm / touch choose──▶ Ink choose ▶ next line
 *   shown, no choices ──confirm──▶ Ink next ▶ next line, or closed when ended
 */
function dialogueStep(world: World, state: State, input: ActionFrame): State {
  const dialogue = state.dialogue;
  if (dialogue === null) return state;
  const previous = state.previousInput;
  const confirm = input.confirm && !previous.confirm;
  const next: State = {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    party: restingParty(state.party),
  };
  if (dialogue.revealed < dialogue.text.length) {
    const revealed = confirm
      ? dialogue.text.length
      : Math.min(
          dialogue.text.length,
          dialogue.revealed + world.tunables.interact.revealPerTick,
        );
    return { ...next, dialogue: { ...dialogue, revealed } };
  }
  const count = dialogue.choices.length;
  if (count === 0) {
    if (!confirm) return next;
    if (dialogue.ended) return closeDialogue(next);
    const result = runInk(
      world.story,
      state.ink,
      { type: "next" },
      inkFacts(world, state),
    );
    const following = result.line === null && result.choices.length === 0
      ? null
      : dialogueState(dialogue.knot, result, dialogue.travel);
    const advanced = applyBuyTag({ ...next, ink: result.ink }, result.line?.tags ?? []);
    return following === null
      ? closeDialogue(advanced)
      : { ...advanced, dialogue: following };
  }
  const tapped =
    input.choose !== undefined && input.choose >= 0 && input.choose < count
      ? input.choose
      : undefined;
  const chosen = tapped ?? (confirm ? dialogue.selected : undefined);
  if (chosen !== undefined) {
    const result = runInk(
      world.story,
      state.ink,
      {
        type: "choose",
        index: chosen,
      },
      inkFacts(world, state),
    );
    const following = result.line === null && result.choices.length === 0
      ? null
      : dialogueState(dialogue.knot, result, dialogue.travel);
    const advanced = applyBuyTag({ ...next, ink: result.ink }, result.line?.tags ?? []);
    return following === null
      ? closeDialogue(advanced)
      : { ...advanced, dialogue: following };
  }
  const up = input.move.y < -0.5 && previous.move.y >= -0.5;
  const down = input.move.y > 0.5 && previous.move.y <= 0.5;
  if (!up && !down) return next;
  const selected = (dialogue.selected + (down ? 1 : -1) + count) % count;
  return { ...next, dialogue: { ...dialogue, selected } };
}

function segmentClear(area: Area, start: Point, end: Point): boolean {
  const length = distance(start, end);
  const samples = Math.max(1, Math.ceil(length / 5));
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
    if (
      !pointInPolygon(point, area.walkable) ||
      area.blockers.some((blocker) => pointInPolygon(point, blocker))
    )
      return false;
  }
  return true;
}

function validFollowerPoint(area: Area, point: Point, radius: number): boolean {
  return (
    pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    area.blockers.every(
      (blocker) =>
        !pointInPolygon(point, blocker) &&
        distanceToPolygon(point, blocker) >= radius,
    )
  );
}

// How much of the follower's body box its leader's box covers, when the
// follower's feet are north of the leader's (drawn behind). Beside or in
// front is zero.
export function hiddenFraction(
  follower: Point,
  followerBox: Box,
  leader: Point,
  leaderBox: Box,
): number {
  if (follower.y >= leader.y) return 0;
  const left = Math.max(
    follower.x - followerBox.width / 2,
    leader.x - leaderBox.width / 2,
  );
  const right = Math.min(
    follower.x + followerBox.width / 2,
    leader.x + leaderBox.width / 2,
  );
  const top = Math.max(
    follower.y - followerBox.height,
    leader.y - leaderBox.height,
  );
  const bottom = Math.min(follower.y, leader.y);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return (width * height) / (followerBox.width * followerBox.height);
}

export function visibleFollowerSlot(
  area: Area,
  leader: Point,
  start: Point,
  follow: FollowTunables,
  followerBox: Box,
  ahead: { point: Point; box: Box }[],
  chained = false,
): Point | undefined {
  const { heel, slot, radius } = follow;
  const sign = start.x - leader.x > 0 ? 1 : -1;
  const heelCandidates = [
    { x: leader.x + sign * heel, y: leader.y - 6 },
    { x: leader.x - sign * heel, y: leader.y - 6 },
    { x: leader.x + sign * heel, y: leader.y + 24 },
    { x: leader.x - sign * heel, y: leader.y + 24 },
  ];
  const chainedHeelCandidates = [
    { x: leader.x + sign * chainedHeelX, y: leader.y + chainedHeelUp },
    { x: leader.x - sign * chainedHeelX, y: leader.y + chainedHeelUp },
    { x: leader.x + sign * chainedHeelX, y: leader.y + chainedHeelDown },
    { x: leader.x - sign * chainedHeelX, y: leader.y + chainedHeelDown },
  ];
  const candidates = chained
    ? [
        ...heelCandidates,
        ...chainedHeelCandidates,
        { x: leader.x + sign * 72, y: leader.y - 56 },
        { x: leader.x - sign * 72, y: leader.y - 56 },
        { x: leader.x + sign * 72, y: leader.y + 56 },
        { x: leader.x - sign * 72, y: leader.y + 56 },
        { x: leader.x + sign * 96, y: leader.y - 80 },
        { x: leader.x - sign * 96, y: leader.y - 80 },
        { x: leader.x + sign * 96, y: leader.y + 80 },
        { x: leader.x - sign * 96, y: leader.y + 80 },
        { x: leader.x + sign * 108, y: leader.y - 100 },
        { x: leader.x - sign * 108, y: leader.y - 100 },
        { x: leader.x + sign * 108, y: leader.y + 100 },
        { x: leader.x - sign * 108, y: leader.y + 100 },
        { x: leader.x + sign * 120, y: leader.y - 30 },
        { x: leader.x - sign * 120, y: leader.y - 30 },
        { x: leader.x + sign * 120, y: leader.y + 30 },
        { x: leader.x - sign * 120, y: leader.y + 30 },
        { x: leader.x + sign * 150, y: leader.y - 150 },
        { x: leader.x - sign * 150, y: leader.y - 150 },
        { x: leader.x + sign * 150, y: leader.y + 150 },
        { x: leader.x - sign * 150, y: leader.y + 150 },
        { x: leader.x + sign * 180, y: leader.y - 60 },
        { x: leader.x - sign * 180, y: leader.y - 60 },
        { x: leader.x + sign * 180, y: leader.y + 60 },
        { x: leader.x - sign * 180, y: leader.y + 60 },
      ]
    : heelCandidates;
  const direction = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const facings: Spawn["facing"][] = ["up", "down", "left", "right"];
  for (const facing of facings) {
    const vector = direction[facing];
    candidates.push({
      x: leader.x - vector.x * slot,
      y: leader.y - vector.y * slot,
    });
  }
  return candidates.find((point) => {
    if (
      !validFollowerPoint(area, point, radius) ||
      !segmentClear(area, start, point) ||
      ahead.some((person) => distance(point, person.point) < radius * 2)
    )
      return false;
    return ahead.every((person) => {
      return (
        hiddenFraction(point, followerBox, person.point, person.box) <= 0.25 &&
        hiddenFraction(person.point, person.box, point, followerBox) <= 0.25
      );
    });
  });
}

function pathDistance(start: Point, points: Point[]): number {
  let total = 0;
  let previous = start;
  for (const point of points) {
    total += distance(previous, point);
    previous = point;
  }
  return total;
}

// Who a party member walks behind: Fae for member 0, the member ahead for the
// rest, with the leader's body box for the visibility check.
export function partyLeader(
  world: World,
  state: State,
  index: number,
): { point: Point; box: Box } {
  const ahead = index > 0 ? state.party[index - 1] : undefined;
  if (ahead === undefined) return { point: state.player, box: faeBox };
  return {
    point: { x: ahead.x, y: ahead.y },
    box: partyContent(world, ahead.id).box,
  };
}

/*
 * One follower's tick along its leader's breadcrumb trail (spec 5). The
 * leader is Fae (member 0) or the member ahead, already moved this tick.
 *
 *   leader moved      ─▶ drop a crumb every trailSpacing, cap at trailMax
 *   settled & hidden  ─▶ walk to a visible heel slot (still ticks keep counting)
 *   close & in sight  ─▶ stand still, keep only the newest crumb
 *   route too short   ─▶ stand still (hysteresis: stop vs distance)
 *   otherwise         ─▶ walk the route, faster when far behind
 */
function updateFollower(
  world: World,
  area: Area,
  member: PartyMember,
  memberBox: Box,
  leader: Point,
  leaderBox: Box,
  leaderMoved: boolean,
  ahead: { point: Point; box: Box }[],
): PartyMember {
  const tune = world.tunables.follow;
  const trail = member.trail.slice();
  const last = trail[trail.length - 1];
  if (
    leaderMoved &&
    (last === undefined || distance(last, leader) >= tune.trailSpacing)
  )
    trail.push({ ...leader });
  while (trail.length > tune.trailMax) trail.shift();
  const route = [...trail, leader];
  const direct = distance(member, leader);
  if (
    !leaderMoved &&
    member.stillTicks >= tune.settleDelayTicks &&
    ahead.some(
      (person) =>
        hiddenFraction(member, memberBox, person.point, person.box) > 0.25 ||
        hiddenFraction(person.point, person.box, member, memberBox) > 0.25,
    )
  ) {
    const slot = visibleFollowerSlot(
      area,
      leader,
      member,
      tune,
      memberBox,
      ahead,
      ahead.length > 1,
    );
    if (slot !== undefined && segmentClear(area, member, slot)) {
      const length = distance(member, slot);
      const amount = Math.min(world.tunables.walkSpeed / 60, length);
      const ratio = length === 0 ? 0 : amount / length;
      const position = resolveMove(
        member,
        {
          x: member.x + (slot.x - member.x) * ratio,
          y: member.y + (slot.y - member.y) * ratio,
        },
        area,
        tune.radius,
      );
      const dx = position.x - member.x;
      const dy = position.y - member.y;
      const facing =
        Math.abs(dx) >= Math.abs(dy)
          ? dx < 0
            ? "left"
            : "right"
          : dy < 0
            ? "up"
            : "down";
      const moved = distance(member, position);
      return {
        ...member,
        x: position.x,
        y: position.y,
        facing,
        stillTicks: member.stillTicks + 1,
        motion: {
          distance: member.motion.distance + moved,
          moving: moved > 0.0001,
        },
        trail,
      };
    }
  }
  if (direct <= tune.stop && segmentClear(area, member, leader)) {
    return {
      ...member,
      stillTicks: member.stillTicks + 1,
      motion: { ...member.motion, moving: false },
      trail: trail.slice(-1),
    };
  }
  const routeLength = pathDistance(member, route);
  const moving = member.motion.moving
    ? routeLength > tune.stop
    : routeLength > tune.distance;
  if (!moving) {
    return {
      ...member,
      stillTicks: member.stillTicks + 1,
      motion: { ...member.motion, moving: false },
      trail,
    };
  }
  let position = { x: member.x, y: member.y };
  let remaining =
    (world.tunables.walkSpeed / 60) *
    (routeLength > tune.distance + 40 ? tune.catchUp : 1);
  const targets = route.slice();
  while (remaining > 0 && targets.length > 0) {
    const target = targets[0];
    if (target === undefined) break;
    const length = distance(position, target);
    if (length <= remaining) {
      position = target;
      remaining -= length;
      targets.shift();
      continue;
    }
    const ratio = remaining / length;
    position = {
      x: position.x + (target.x - position.x) * ratio,
      y: position.y + (target.y - position.y) * ratio,
    };
    remaining = 0;
  }
  const resolved = resolveMove(member, position, area, tune.radius);
  const dx = resolved.x - member.x;
  const dy = resolved.y - member.y;
  let facing = member.facing;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0)
    facing = dx < 0 ? "left" : "right";
  else if (dy !== 0) facing = dy < 0 ? "up" : "down";
  const moved = Math.sqrt(dx * dx + dy * dy);
  // `route` ends with the leader's live position, which is a walking target
  // but not a breadcrumb: keep only the unconsumed breadcrumbs so the spacing
  // holds.
  const unvisited =
    targets[targets.length - 1] === leader ? targets.slice(0, -1) : targets;
  return {
    ...member,
    x: resolved.x,
    y: resolved.y,
    facing,
    stillTicks: leaderMoved ? 0 : member.stillTicks + 1,
    motion: {
      distance: member.motion.distance + moved,
      moving: moved > 0.0001,
    },
    trail: unvisited,
  };
}

// The whole party's tick, in party order: each member follows the one ahead
// as it stands after its own move this tick. Followers never collide with
// each other, nor with Fae.
function updateParty(
  world: World,
  area: Area,
  state: State,
  player: Point,
  playerMoved: boolean,
): PartyMember[] {
  const party: PartyMember[] = [];
  let leader = player;
  let leaderBox = faeBox;
  let leaderMoved = playerMoved;
  const ahead: { point: Point; box: Box }[] = [
    { point: player, box: faeBox },
  ];
  for (const member of state.party) {
    const content = partyContent(world, member.id);
    const next = updateFollower(
      world,
      area,
      member,
      content.box,
      leader,
      leaderBox,
      leaderMoved,
      [...ahead],
    );
    party.push(next);
    leader = { x: next.x, y: next.y };
    leaderBox = content.box;
    leaderMoved = next.motion.moving;
    ahead.push({ point: leader, box: leaderBox });
  }
  return party;
}

function stepTick(
  world: World,
  state: State,
  input: ActionFrame,
): { state: State; events: Event[] } {
  const area = world.areas[state.area];
  if (area === undefined) throw new Error(`Unknown state area: ${state.area}`);
  if (state.battle !== null)
    return { state: battleStep(world, state, input), events: [] };
  if (state.dialogue !== null)
    return { state: dialogueStep(world, state, input), events: [] };
  const menuEdge = input.menu && !state.previousInput.menu;
  const cancelEdge = input.cancel && !state.previousInput.cancel;
  const lanternEdge = input.lantern === true && state.previousInput.lantern !== true;
  if (state.journalOpen) {
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        journalOpen: cancelEdge || menuEdge ? false : true,
        previousInput: { ...input },
        party: restingParty(state.party),
        motion: { ...state.motion, moving: false },
      },
      events: [],
    };
  }
  if (lanternEdge && state.transition === null) {
    const hasLantern = world.storyVariable(state.ink, "has_lantern") === true;
    if (hasLantern) return {
      state: {
        ...state,
        tick: state.tick + 1,
        lantern: !state.lantern,
        previousInput: { ...input },
      },
      events: [],
    };
  }
  if (menuEdge && state.transition === null) {
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        journalOpen: true,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        party: restingParty(state.party),
      },
      events: [],
    };
  }
  if (state.transition !== null) {
    const transition = state.transition;
    const elapsed = transition.elapsed + 1;
    const held = moveDirection(input.move);
    const limit = world.tunables.doorFadeTicks;
    if (transition.phase === "out" && elapsed >= limit) {
      const targetArea = world.areas[transition.target.area];
      if (targetArea === undefined) throw new Error("Unknown transition area");
      const spawn = targetArea.spawns[transition.target.spawn];
      if (spawn === undefined) throw new Error("Unknown transition spawn");
      const arrived: State = {
        ...state,
        tick: state.tick + 1,
        area: targetArea.id,
        player: { x: spawn.x, y: spawn.y },
        facing: spawn.facing,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        transition: { target: transition.target, phase: "in", elapsed: 0 },
        party: spawnParty(
          world,
          state.ink,
          targetArea,
          spawn,
          state.party.map((member) => member.id),
        ),
        safeSpot: { area: targetArea.id, spawn: transition.target.spawn },
        backLink: held === undefined ? undefined : { area: state.area, direction: held },
      };
      // Every arrival rolls the area's critters fresh (a rest arrives too).
      return { state: { ...arrived, ...rollWild(world, arrived, targetArea) }, events: [] };
    }
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        transition:
          transition.phase === "in" && elapsed >= limit
            ? null
            : { ...transition, elapsed },
        backLink: state.backLink?.direction === held ? state.backLink : undefined,
      },
      events: [],
    };
  }
  if (input.confirm && !state.previousInput.confirm) {
    const target = targetInteractable(world, state);
    if (target !== undefined && target.knot !== undefined) {
      const result = runInk(
        world.story,
        state.ink,
        {
          type: "start",
          knot: target.knot,
        },
        inkFacts(world, state),
      );
      return {
        state: {
          ...state,
          tick: state.tick + 1,
          ink: result.ink,
          previousInput: { ...input },
          dialogue: dialogueState(target.knot, result),
          motion: { ...state.motion, moving: false },
          party: haltedParty(state.party),
        },
        events: [],
      };
    }
  }
  const length = Math.sqrt(
    input.move.x * input.move.x + input.move.y * input.move.y,
  );
  const scale = length > 1 ? 1 / length : 1;
  const speed = world.tunables.walkSpeed / 60;
  // People who are there are solid, for Fae and for her party alike.
  const solid = solidArea(world, state, area);
  const player = resolveMove(
    state.player,
    {
      x: state.player.x + input.move.x * scale * speed,
      y: state.player.y + input.move.y * scale * speed,
    },
    solid,
    world.tunables.playerRadius,
  );
  const displacementX = player.x - state.player.x;
  const displacementY = player.y - state.player.y;
  const displacement = Math.sqrt(
    displacementX * displacementX + displacementY * displacementY,
  );
  const moved = updateWild(world, state, area, player, true);
  // A touch is an outside-to-inside crossing of the critter's touch circle
  // (spec 8): by Fae or, for a recurring critter, by either of them.
  const wildTouch = moved.wild.find((next, index) => {
    const old = state.wild[index];
    const touch = world.critters[next.kind]?.touchRadius;
    return old !== undefined && touch !== undefined && next.mood === "chaos" &&
      next.cooldownTicks === 0 && distance(state.player, old) > touch &&
      distance(player, next) <= touch;
  });
  let facing = state.facing;
  if (Math.abs(input.move.x) >= Math.abs(input.move.y) && input.move.x !== 0)
    facing = input.move.x < 0 ? "left" : "right";
  else if (input.move.y !== 0) facing = input.move.y < 0 ? "up" : "down";
  const events: Event[] = [];
  for (const button of ["confirm", "cancel", "menu"] as const) {
    if (input[button] && !state.previousInput[button])
      events.push({ type: "button", button });
  }
  // The back-link rule (spec 6): after Fae arrives through a door, the way
  // straight back to where she came from stays shut while she keeps holding
  // the direction she arrived holding; letting go or turning opens it again.
  const backLink = state.backLink?.direction === moveDirection(input.move)
    ? state.backLink
    : undefined;
  const trigger = area.triggers.find(
    (item) =>
      !pointInPolygon(state.player, item.polygon) &&
      pointInPolygon(player, item.polygon) &&
      item.target.area !== backLink?.area,
  );
  // A door that needs a story variable (spec 6): while the variable isn't
  // true, crossing in plays its knot instead of leaving. Fae still steps into
  // the doorway, so the outside-to-inside rule plays it again only after she
  // steps out and back in.
  const locked =
    trigger?.requires !== undefined &&
    world.storyVariable(state.ink, trigger.requires.variable) !== true
      ? trigger.requires
      : undefined;
  const door = locked === undefined ? trigger : undefined;
  const knock =
    locked === undefined
      ? undefined
      : {
          knot: locked.knot,
          result: runInk(
            world.story,
            state.ink,
            { type: "start", knot: locked.knot },
            inkFacts(world, state),
          ),
        };
  const pieceTouch = presentCritters(world, state).find((item) =>
    item.wild === null && item.mood === "chaos" &&
    distance(state.player, item.point) > item.kind.touchRadius &&
    distance(player, item.point) <= item.kind.touchRadius);
  const critter = wildTouch === undefined
    ? pieceTouch?.kind
    : world.critters[wildTouch.kind];
  if (critter !== undefined) {
    const battle: Battle = {
      critterId: critter.id,
      den: wildTouch?.den ?? null,
      entry: { ...state.player },
      phase: "intro",
      message: critter.lines.intro,
      revealed: 0,
      selected: 0,
      command: null,
      energy: critter.energyMax,
      calm: 0,
      rest: {},
      aim: null,
      lastGrade: null,
      rewardSticker: null,
      aimTick: 0,
      phaseTicks: 0,
    };
    // A recurring critter met Fae where it stood; a set piece keeps her
    // on the tick before she reached it.
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        previousInput: { ...input },
        ...(wildTouch === undefined ? {} : { player }),
        wild: moved.wild.map((item) =>
          item === wildTouch ? sendHome(world, area, item, false) : item),
        rng: moved.rng,
        battle,
        motion: { ...state.motion, moving: false },
      },
      events,
    };
  }
  const party =
    trigger === undefined
      ? updateParty(world, solid, state, player, displacement > 0.0001)
      : haltedParty(state.party);
  const nextState: State = {
      ...state,
      tick: state.tick + 1,
      player,
      facing,
      previousInput: { ...input },
      motion: {
        distance: state.motion.distance + displacement,
        moving: trigger === undefined && displacement > 0.0001,
      },
      transition:
        door === undefined
          ? null
          : { target: door.target, phase: "out", elapsed: 0 },
      ink: knock === undefined ? state.ink : knock.result.ink,
      dialogue:
        knock === undefined
          ? state.dialogue
          : dialogueState(knock.knot, knock.result),
      party,
      wild: moved.wild,
      rng: moved.rng,
      backLink,
    };
  return { state: nextState, events };
}

export function step(
  world: World,
  state: State,
  input: ActionFrame,
): { state: State; events: Event[] } {
  const result = stepTick(world, state, input);
  return { ...result, state: joinReady(world, result.state) };
}

export function stableHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    if (item !== null && typeof item === "object") {
      // Undefined values are skipped, as JSON does, so a state and its saved
      // copy hash the same.
      const entries = Object.entries(item)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const body = entries
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(",");
      return `{${body}}`;
    }
    return JSON.stringify(item);
  };
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
