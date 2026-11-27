import type {
  Area,
  Box,
  FollowTunables,
  PartyContent,
  PartyMember,
  Point,
  Spawn,
  State,
  Wild,
  World,
} from "./types";
import { distance, distanceToPolygon, pointInPolygon, resolveMove } from "./geometry";
import { levelForXp } from "./levels";
import { npcLivePoint } from "./npc-stroll";
import { sceneryArea } from "./props";

// Fae's feet-anchored body box (spec 5): what her followers hide behind.
export const faeBox: Box = { width: 50, height: 140 };
// Extra diagonal heels give tall chained members a visible, natural fallback.
const chainedHeelX = 36;
const chainedHeelUp = -40;
const chainedHeelDown = 36;

export function partyContent(world: World, id: string): PartyContent {
  const content = world.party[id];
  if (content === undefined) throw new Error(`Unknown party member: ${id}`);
  return content;
}

// The party in a battle: everyone with a battle command. Flute friends sit
// battles out (spec 5): they give no command, aren't drawn, and don't count
// toward feelings.
export function battleParty(world: World, party: readonly PartyMember[]): PartyMember[] {
  return party.filter((member) => (world.party[member.id]?.command ?? null) !== null);
}

export function partyCommand(world: World, id: string): PartyContent["command"] {
  return world.party[id]?.command ?? null;
}

export function isSpeciesCalmed(
  world: World,
  state: State,
  species: string,
): boolean {
  const critter = world.critters[species];
  const resolved = critter?.species ?? species;
  return (
    (state.calms[resolved] ?? 0) > 0 ||
    (state.calms[species] ?? 0) > 0 ||
    state.critters[species] === "calm" ||
    (critter !== undefined && state.stickers.includes(critter.sticker.id)) ||
    Object.entries(state.critters).some(
      ([id, mood]) => mood === "calm" && world.critters[id]?.species === resolved,
    )
  );
}

export const BOSS_SET_PIECES = [
  "arcade-keeper",
  "lodge-keeper",
  "lifeguard",
  "art-teacher",
  "principal",
  "taco-chef",
  "moon-owl",
  "gull",
  "hooded-kid",
] as const;

export function calmedFact(world: World, state: State, name: string): boolean {
  if (state.critters[name] === "calm") return true;
  for (const kind of Object.values(world.critters)) {
    if (kind.species === name && state.stickers.includes(kind.sticker.id)) return true;
  }
  return false;
}

export function bossesCalmedCount(world: World, state: State): number {
  let count = 0;
  for (const id of BOSS_SET_PIECES) {
    if (calmedFact(world, state, id)) count += 1;
  }
  return count;
}

export function npcVisible(
  world: World,
  state: State,
  npc: Area["npcs"][number],
): boolean {
  return (
    !state.party.some((member) => member.id === npc.id) &&
    (npc.visibleWhile === undefined ||
      world.storyVariable(state.ink, npc.visibleWhile) === true) &&
    (npc.hiddenWhile === undefined ||
      world.storyVariable(state.ink, npc.hiddenWhile) !== true) &&
    (npc.visibleWhenCalmed === undefined ||
      isSpeciesCalmed(world, state, npc.visibleWhenCalmed)) &&
    (npc.visibleAfterCalm === undefined ||
      calmedFact(world, state, npc.visibleAfterCalm)) &&
    (npc.hiddenAfterCalm === undefined ||
      !calmedFact(world, state, npc.hiddenAfterCalm))
  );
}

// The party while Fae is frozen (a battle, a dialogue, the journal): nobody
// walks, and the still ticks keep counting so Maddie sits.
export function restingParty(party: PartyMember[]): PartyMember[] {
  return party.map((member) => ({
    ...member,
    stillTicks: member.stillTicks + 1,
    motion: { ...member.motion, moving: false },
  }));
}

// The party on a tick that interrupts walking (a door, a talk starting): the
// walk frames stop, the still count doesn't start yet.
export function haltedParty(party: PartyMember[]): PartyMember[] {
  return party.map((member) => ({
    ...member,
    motion: { ...member.motion, moving: false },
  }));
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
  if (chained) {
    // Extra fallback offsets for 6-member chains in narrow corridors (e.g. mist.field),
    // tried only after every existing candidate so 1-to-5 placements stay identical.
    for (const dx of [96, 120, 144, 168, 210]) {
      for (const dy of [-16, 16, -36, 36]) {
        candidates.push(
          { x: leader.x + sign * dx, y: leader.y + dy },
          { x: leader.x - sign * dx, y: leader.y + dy },
        );
      }
    }
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

export function spawnParty(
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
      xp: 0,
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
export function stepParty(
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

export function syncParty(world: World, state: State): State {
  if (
    state.finale !== null ||
    state.dialogue !== null ||
    state.battle !== null ||
    state.transition !== null ||
    state.journalOpen
  )
    return state;
  const area = world.areas[state.area];
  if (area === undefined) return state;
  // A flute friend goes home once its variable isn't true (sent home by the
  // flute); everyone else, once with Fae, stays.
  const staying = state.party.filter((member) => {
    const content = world.party[member.id];
    return content === undefined || !content.flute || content.joins === null ||
      world.storyVariable(state.ink, content.joins) === true;
  });
  const existing = new Set(staying.map((member) => member.id));
  let party = staying.slice();
  let wild = state.wild;
  for (const content of Object.values(world.party)) {
    if (
      existing.has(content.id) ||
      content.joins === null ||
      world.storyVariable(state.ink, content.joins) !== true
    )
      continue;
    // She steps out of the person standing here (if she's shown). A flute
    // friend called while a calm one of its kind is out here is that one: the
    // nearest steps out of the area into the party (spec 5).
    const person = area.npcs.find(
      (npc) => npc.id === content.id && npcVisible(world, state, npc),
    );
    const near = (item: Wild): number => distance(state.player, item);
    const critter = content.critter === null ? undefined : wild
      .filter((item) => item.kind === content.critter && item.mood === "calm")
      .sort((a, b) => near(a) - near(b))[0];
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
    const personPoint = person === undefined ? undefined : npcLivePoint(state, person);
    const point = critter ?? (personPoint === undefined
      ? undefined
      : { x: personPoint.x, y: personPoint.y }) ??
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
    if (critter !== undefined) wild = wild.filter((item) => item !== critter);
    party.push({
      id: content.id,
      xp: state.xp === 0 ? 0 : world.levels.thresholds[Math.max(0,
        Math.min(98, levelForXp(world.levels, state.xp) - 1))] ?? 0,
      x: point.x,
      y: point.y,
      facing: state.facing,
      motion: { distance: 0, moving: false },
      stillTicks: 0,
      trail: [point, leader],
    });
    existing.add(content.id);
  }
  return party.length === state.party.length && staying.length === state.party.length
    ? state
    : { ...state, party, wild };
}
