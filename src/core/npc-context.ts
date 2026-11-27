import { starGemsFound } from "./journal";
import {
  bossesCalmedCount,
  calmedFact,
  npcFacing,
  npcVisible,
  presentCritters,
  totalTreatCount,
} from "./sim";
import type {
  Direction,
  Npc,
  NpcAmbientRule,
  NpcAttention,
  NpcBanterPair,
  NpcCondition,
  NpcEmoteKind,
  NpcPersonality,
  NpcProfile,
  NpcStoryStage,
  Point,
  PresentCritter,
  State,
  World,
} from "./types";

export type NpcWorldSituation = {
  areaId: string;
  areaChaosCount: number;
  areaAllCalm: boolean;
  nearestChaos: { id: string; x: number; y: number } | null;
  lanternOn: boolean;
  hasLantern: boolean;
  hasFlute: boolean;
  hasLasso: boolean;
  partyIds: string[];
  storyStage: NpcStoryStage;
  stickersOwned: number;
  gemsFound: number;
  bossesCalmedCount: number;
  carryingTreats: boolean;
};

export type NpcLifeMemory = {
  areaTicks: number;
  lastCalmedTick: number | null;
  lastTalkNpcId: string | null;
  lastTalkTick: number | null;
  lastFluteTick?: number | null;
  lanternOnTick?: number | null;
};

export type NpcLifeEntry = {
  id: string;
  x: number;
  y: number;
  facing: Direction;
  attention: NpcAttention;
  personality: NpcPersonality;
  adult: boolean;
  emote: NpcEmoteKind | null;
  attentionStrength: number;
  focusTarget: Point | null;
};

export type NpcChatterBubble = {
  npcId: string;
  speakerName: string;
  text: string;
  tone: "normal" | "lantern" | "worry" | "warm" | "banter" | "music";
  emote: NpcEmoteKind | null;
  x: number;
  y: number;
  adult: boolean;
  progress: number;
  alpha: number;
};

export type NpcLifeSnapshot = {
  situation: NpcWorldSituation;
  npcs: NpcLifeEntry[];
  chatter: NpcChatterBubble | null;
};

const ARRIVAL_GRACE_TICKS = 48;
const IDLE_LOOK_GRACE_TICKS = 60;
const JUST_CALMED_WINDOW = 150;
const RECENT_FLUTE_WINDOW = 180;
const LANTERN_RANGE = 235;
const CELEBRATE_RANGE = 340;
const FLUTE_RANGE = 340;
const SOCIAL_LISTENER_RANGE = 360;
const CHAOS_NPC_RANGE = 270;
const CHAOS_CHATTER_RANGE = 280;
const JUST_CALMED_RANGE = 320;
const PARTY_CHATTER_RANGE = 210;
const BANTER_RANGE = 400;
const AMBIENT_CHATTER_RANGE = 185;
const FINALE_CELEBRATION_RANGE = 240;
const BANTER_CYCLE_TICKS = 360;
const BANTER_SPEAK_TICKS = 105;
const BANTER_SECOND_START = 135;
const BANTER_SECOND_END = 240;
const AMBIENT_CYCLE_TICKS = 240;
const AMBIENT_ON_TICKS = 120;
const WORRY_ON_TICKS = 150;
const PARTY_ON_TICKS = 140;
const FADE_IN_TICKS = 14;
const FADE_OUT_TICKS = 18;

export function reactionRippleTicks(distance: number): number {
  return Math.min(18, Math.floor(Math.max(0, distance) / 22));
}

function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function envelopeAlpha(
  elapsed: number,
  duration: number,
  fadeIn = FADE_IN_TICKS,
  fadeOut = FADE_OUT_TICKS,
): number {
  if (elapsed < 0 || elapsed >= duration) return 0;
  if (elapsed < fadeIn) return clamp01((elapsed + 1) / fadeIn);
  const remaining = duration - elapsed;
  if (remaining <= fadeOut) return clamp01(remaining / fadeOut);
  return 1;
}

function facingToward(from: Point, to: Point, fallback: Direction): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function hashIdBucket(id: string, bucket: number): number {
  let hash = Math.imul(bucket + 1, 2654435761) >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

function idleLookDirection(npc: Npc, tick: number, lookAroundTicks: number): Direction {
  const period = Math.max(30, lookAroundTicks);
  const bucket = Math.floor(tick / period);
  const roll = hashIdBucket(npc.id, bucket) % 10;
  if (roll < 6) return npc.facing;
  if (npc.facing === "down" || npc.facing === "up") {
    return roll < 8 ? "left" : "right";
  }
  return roll < 8 ? "down" : npc.facing === "left" ? "right" : "left";
}

function deriveStoryStage(world: World, state: State): NpcStoryStage {
  const isSet = (name: string): boolean => world.storyVariable(state.ink, name) === true;
  if (isSet("awake")) return "awake";
  if (world.storyVariable(state.ink, "forest_fizzy") === false ||
      calmedFact(world, state, "hooded-kid"))
    return "forest_calm";
  if (isSet("seal_open")) return "finale_ready";
  if (isSet("recess")) return "recess";
  if (isSet("clubhouse_claimed")) return "clubhouse";
  if (isSet("sue_joined") || isSet("rode_bus")) return "bay_pass";
  if (isSet("hall_pass") || isSet("saw_hood")) return "school_mystery";
  if (calmedFact(world, state, "fountain-frog")) return "park_trail";
  if (isSet("read_notice")) return "fountain_chaos";
  return "morning";
}

function chaosCrittersInArea(world: World, state: State): PresentCritter[] {
  return presentCritters(world, state).filter((critter) => critter.mood === "chaos");
}

function nearestCritterTo(critters: PresentCritter[], origin: Point): PresentCritter | null {
  let best: PresentCritter | null = null;
  let bestDist = Infinity;
  for (const critter of critters) {
    const gap = dist(origin, critter.point);
    if (gap < bestDist) {
      bestDist = gap;
      best = critter;
    }
  }
  return best;
}

export function npcWorldSituation(world: World, state: State): NpcWorldSituation {
  const chaos = chaosCrittersInArea(world, state);
  const nearest = nearestCritterTo(chaos, state.player);
  return {
    areaId: state.area,
    areaChaosCount: chaos.length,
    areaAllCalm: chaos.length === 0,
    nearestChaos: nearest === null
      ? null
      : { id: nearest.key, x: nearest.point.x, y: nearest.point.y },
    lanternOn: state.lantern,
    hasLantern: world.storyVariable(state.ink, "has_lantern") === true,
    hasFlute: world.storyVariable(state.ink, "has_flute") === true,
    hasLasso: world.storyVariable(state.ink, "has_lasso") === true,
    partyIds: state.party.map((member) => member.id),
    storyStage: deriveStoryStage(world, state),
    stickersOwned: state.stickers.length,
    gemsFound: starGemsFound(world, state).found,
    bossesCalmedCount: bossesCalmedCount(world, state),
    carryingTreats: totalTreatCount(state.treats) > 0,
  };
}

function isJustCalmed(state: State, memory: NpcLifeMemory): boolean {
  return (
    memory.lastCalmedTick !== null &&
    state.tick >= memory.lastCalmedTick &&
    state.tick - memory.lastCalmedTick < JUST_CALMED_WINDOW
  );
}

function isRecentFlute(state: State, memory: NpcLifeMemory): boolean {
  const fluteTick = memory.lastFluteTick ?? null;
  return (
    fluteTick !== null &&
    state.tick >= fluteTick &&
    state.tick - fluteTick < RECENT_FLUTE_WINDOW
  );
}

export function matchesNpcCondition(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  npc: Npc,
  memory: NpcLifeMemory,
  condition: NpcCondition | undefined,
): boolean {
  if (condition === undefined) return true;
  if (condition.variable !== undefined &&
      world.storyVariable(state.ink, condition.variable) !== true)
    return false;
  if (condition.notVariable !== undefined &&
      world.storyVariable(state.ink, condition.notVariable) === true)
    return false;
  if (condition.calmed !== undefined && !calmedFact(world, state, condition.calmed))
    return false;
  if (condition.notCalmed !== undefined && calmedFact(world, state, condition.notCalmed))
    return false;
  if (condition.withParty !== undefined && !situation.partyIds.includes(condition.withParty))
    return false;
  if (condition.lanternOn !== undefined && situation.lanternOn !== condition.lanternOn)
    return false;
  if (condition.areaCalm !== undefined && situation.areaAllCalm !== condition.areaCalm)
    return false;
  if (condition.chaosNearby !== undefined) {
    const chaos = chaosCrittersInArea(world, state);
    const near = chaos.some((critter) => dist(npc.point, critter.point) <= CHAOS_NPC_RANGE);
    if (near !== condition.chaosNearby) return false;
  }
  if (condition.justCalmed !== undefined && isJustCalmed(state, memory) !== condition.justCalmed)
    return false;
  if (condition.recentFlute !== undefined &&
      isRecentFlute(state, memory) !== condition.recentFlute)
    return false;
  if (condition.hasTreats !== undefined && situation.carryingTreats !== condition.hasTreats)
    return false;
  if (condition.minStickers !== undefined && situation.stickersOwned < condition.minStickers)
    return false;
  if (condition.minGems !== undefined && situation.gemsFound < condition.minGems)
    return false;
  if (condition.minBossesCalmed !== undefined &&
      situation.bossesCalmedCount < condition.minBossesCalmed)
    return false;
  if (condition.storyStage !== undefined && situation.storyStage !== condition.storyStage)
    return false;
  return true;
}

function fallbackProfile(npc: Npc): NpcProfile {
  return {
    id: npc.id,
    name: npc.id,
    adult: true,
    personality: "cozy",
    greetRange: 145,
    lookAroundTicks: 180,
    favoriteParty: [],
    rules: [],
  };
}

function profileFor(world: World, npc: Npc): NpcProfile {
  return world.npcProfiles[npc.id] ?? fallbackProfile(npc);
}

type ActiveBanter = {
  pair: NpcBanterPair;
  first: Npc;
  second: Npc;
  phase: number;
  speakerIndex: 0 | 1 | null;
};

function selectActiveBanter(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  visibleNpcs: Npc[],
  memory: NpcLifeMemory,
): ActiveBanter | null {
  const byId = new Map<string, Npc>();
  for (const npc of visibleNpcs) byId.set(npc.id, npc);
  const eligible: { pair: NpcBanterPair; first: Npc; second: Npc; range: number }[] = [];
  for (const pair of world.npcBanter) {
    if (pair.area !== state.area) continue;
    const first = byId.get(pair.speakers[0]);
    const second = byId.get(pair.speakers[1]);
    if (first === undefined || second === undefined) continue;
    if (!matchesNpcCondition(world, state, situation, first, memory, pair.when)) continue;
    const mid = {
      x: (first.point.x + second.point.x) / 2,
      y: (first.point.y + second.point.y) / 2,
    };
    const range = Math.min(
      dist(state.player, mid),
      dist(state.player, first.point),
      dist(state.player, second.point),
    );
    if (range <= BANTER_RANGE) eligible.push({ pair, first, second, range });
  }
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.range - b.range);
  const closest = eligible[0];
  if (closest === undefined) return null;
  const chosen = closest.range <= 220
    ? closest
    : eligible[Math.floor(state.tick / BANTER_CYCLE_TICKS) % eligible.length] ?? closest;
  const phase = state.tick % BANTER_CYCLE_TICKS;
  const speakerIndex: 0 | 1 | null = phase < BANTER_SPEAK_TICKS
    ? 0
    : phase >= BANTER_SECOND_START && phase < BANTER_SECOND_END
      ? 1
      : null;
  return { pair: chosen.pair, first: chosen.first, second: chosen.second, phase, speakerIndex };
}

function bestMatchingRule(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  npc: Npc,
  profile: NpcProfile,
  memory: NpcLifeMemory,
  predicate: (rule: NpcAmbientRule) => boolean,
): NpcAmbientRule | undefined {
  let best: NpcAmbientRule | undefined;
  for (const rule of profile.rules) {
    if (!predicate(rule)) continue;
    if (!matchesNpcCondition(world, state, situation, npc, memory, rule.when)) continue;
    if (best === undefined || rule.priority > best.priority) best = rule;
  }
  return best;
}

function celebrationEmoteFor(personality: NpcPersonality): NpcEmoteKind {
  return (
    personality === "kid-bouncy" ||
    personality === "scholar" ||
    personality === "mystic" ||
    personality === "fairy"
  )
    ? "sparkle"
    : "heart";
}

function makeBubble(
  npc: Npc,
  profile: NpcProfile,
  text: string,
  tone: NpcChatterBubble["tone"],
  emote: NpcEmoteKind | null,
  progress: number,
  alpha: number,
): NpcChatterBubble {
  return {
    npcId: npc.id,
    speakerName: profile.name,
    text,
    tone,
    emote,
    x: npc.point.x,
    y: npc.point.y,
    adult: profile.adult,
    progress: clamp01(progress),
    alpha: clamp01(alpha),
  };
}

function evaluateChatter(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  visibleNpcs: Npc[],
  chaos: PresentCritter[],
  banter: ActiveBanter | null,
  memory: NpcLifeMemory,
): NpcChatterBubble | null {
  if (
    state.area === "harness" ||
    state.dialogue !== null ||
    state.battle !== null ||
    state.arcade !== null ||
    state.journalOpen ||
    state.transition !== null ||
    state.finale === "credits"
  )
    return null;
  const justCalmedNow = isJustCalmed(state, memory);
  const recentFluteNow = isRecentFlute(state, memory);
  if (
    memory.areaTicks < ARRIVAL_GRACE_TICKS &&
    !state.lantern &&
    !justCalmedNow &&
    !recentFluteNow
  )
    return null;

  const byNearest = visibleNpcs
    .map((npc) => ({ npc, profile: profileFor(world, npc), gap: dist(state.player, npc.point) }))
    .sort((a, b) => a.gap - b.gap);

  // 1. Immediate lantern reaction for nearest NPC within 235u (staggered ripple when ticked).
  const lanternTick = memory.lanternOnTick ?? null;
  if (state.lantern) {
    for (const item of byNearest) {
      if (item.gap > LANTERN_RANGE) break;
      if (
        lanternTick !== null &&
        (state.tick < lanternTick || state.tick - lanternTick < reactionRippleTicks(item.gap))
      )
        continue;
      const rule = bestMatchingRule(
        world, state, situation, item.npc, item.profile, memory,
        (candidate) => candidate.when?.lanternOn === true,
      );
      if (rule !== undefined) {
        return makeBubble(
          item.npc, item.profile, rule.text, "lantern", rule.emote ?? "sparkle",
          (state.tick % 120) / 120, 1,
        );
      }
    }
  }

  // 2. Immediate just-calmed reaction for nearest NPC within 320u.
  if (justCalmedNow && memory.lastCalmedTick !== null) {
    const elapsed = state.tick - memory.lastCalmedTick;
    for (const item of byNearest) {
      if (item.gap > JUST_CALMED_RANGE) break;
      if (elapsed < reactionRippleTicks(item.gap)) continue;
      const rule = bestMatchingRule(
        world, state, situation, item.npc, item.profile, memory,
        (candidate) => candidate.when?.justCalmed === true,
      );
      if (rule !== undefined) {
        return makeBubble(
          item.npc, item.profile, rule.text, "warm", rule.emote ?? "heart",
          elapsed / JUST_CALMED_WINDOW,
          envelopeAlpha(elapsed, JUST_CALMED_WINDOW),
        );
      }
    }
  }

  // 3. Immediate musical delight reaction for nearest NPC within 340u.
  const fluteTick = memory.lastFluteTick ?? null;
  if (recentFluteNow && fluteTick !== null) {
    const elapsed = state.tick - fluteTick;
    for (const item of byNearest) {
      if (item.gap > FLUTE_RANGE) break;
      if (elapsed < reactionRippleTicks(item.gap)) continue;
      const rule = bestMatchingRule(
        world, state, situation, item.npc, item.profile, memory,
        (candidate) => candidate.when?.recentFlute === true,
      );
      if (rule !== undefined) {
        return makeBubble(
          item.npc, item.profile, rule.text, "music", rule.emote ?? "note",
          elapsed / RECENT_FLUTE_WINDOW,
          envelopeAlpha(elapsed, RECENT_FLUTE_WINDOW),
        );
      }
    }
  }

  // 4. Chaos-nearby worry rule for nearest NPC within 280u.
  if (chaos.length > 0) {
    const phase = state.tick % AMBIENT_CYCLE_TICKS;
    if (phase < WORRY_ON_TICKS) {
      for (const item of byNearest) {
        if (item.gap > CHAOS_CHATTER_RANGE) break;
        const nearChaos = chaos.some(
          (critter) => dist(item.npc.point, critter.point) <= CHAOS_NPC_RANGE,
        );
        if (!nearChaos) continue;
        const rule = bestMatchingRule(
          world, state, situation, item.npc, item.profile, memory,
          (candidate) => candidate.when?.chaosNearby === true,
        );
        if (rule !== undefined) {
          return makeBubble(
            item.npc, item.profile, rule.text, "worry", rule.emote ?? "worry",
            phase / WORRY_ON_TICKS,
            envelopeAlpha(phase, WORRY_ON_TICKS),
          );
        }
      }
    }
  }

  // 4. Companion recognition rule for nearest NPC within 210u.
  {
    const phase = state.tick % AMBIENT_CYCLE_TICKS;
    if (phase < PARTY_ON_TICKS) {
      for (const item of byNearest) {
        if (item.gap > PARTY_CHATTER_RANGE) break;
        const rule = bestMatchingRule(
          world, state, situation, item.npc, item.profile, memory,
          (candidate) => candidate.when?.withParty !== undefined,
        );
        if (rule !== undefined) {
          return makeBubble(
            item.npc, item.profile, rule.text, "warm", rule.emote ?? "heart",
            phase / PARTY_ON_TICKS,
            envelopeAlpha(phase, PARTY_ON_TICKS),
          );
        }
      }
    }
  }

  // 5. Active social banter pair turn (360-tick cycle).
  if (banter !== null && banter.phase < BANTER_SECOND_END) {
    if (banter.speakerIndex === null) return null;
    const speaker = banter.speakerIndex === 0 ? banter.first : banter.second;
    const profile = profileFor(world, speaker);
    const text = banter.pair.lines[banter.speakerIndex];
    const local = banter.speakerIndex === 0
      ? banter.phase
      : banter.phase - BANTER_SECOND_START;
    return makeBubble(
      speaker, profile, text, "banter", "note",
      local / BANTER_SPEAK_TICKS,
      envelopeAlpha(local, BANTER_SPEAK_TICKS),
    );
  }

  // 7. Nearest NPC's highest-priority matching ambient story/treats/bosses rule within 185u.
  const phase = state.tick % AMBIENT_CYCLE_TICKS;
  if (phase < AMBIENT_ON_TICKS) {
    for (const item of byNearest) {
      if (item.gap > AMBIENT_CHATTER_RANGE) break;
      const rule = bestMatchingRule(
        world, state, situation, item.npc, item.profile, memory,
        (candidate) =>
          candidate.when?.lanternOn !== true &&
          candidate.when?.justCalmed !== true &&
          candidate.when?.recentFlute !== true &&
          candidate.when?.chaosNearby !== true,
      );
      if (rule !== undefined) {
        const isFinaleRule =
          rule.when?.notVariable === "forest_fizzy" || rule.when?.calmed === "hooded-kid";
        const tone: NpcChatterBubble["tone"] =
          rule.when?.hasTreats === true ||
          rule.when?.minBossesCalmed !== undefined ||
          isFinaleRule
            ? "warm"
            : "normal";
        return makeBubble(
          item.npc, item.profile, rule.text, tone, rule.emote ?? null,
          phase / AMBIENT_ON_TICKS,
          envelopeAlpha(phase, AMBIENT_ON_TICKS),
        );
      }
    }
  }

  return null;
}

export function evaluateNpcLife(
  world: World,
  state: State,
  memory: NpcLifeMemory,
): NpcLifeSnapshot {
  const situation = npcWorldSituation(world, state);
  const area = world.areas[state.area];
  if (state.area === "harness" || area === undefined) {
    return { situation, npcs: [], chatter: null };
  }
  const visibleNpcs = area.npcs.filter(
    (npc) =>
      npc.id !== "bus-stop" &&
      !npc.id.startsWith("sanctuary-") &&
      npcVisible(world, state, npc),
  );
  const chaos = chaosCrittersInArea(world, state);
  const justCalmedNow = isJustCalmed(state, memory);
  const recentFluteNow = isRecentFlute(state, memory);
  const lanternTick = memory.lanternOnTick ?? null;
  const fluteTick = memory.lastFluteTick ?? null;
  const banter = memory.areaTicks >= ARRIVAL_GRACE_TICKS
    ? selectActiveBanter(world, state, situation, visibleNpcs, memory)
    : null;

  const npcs: NpcLifeEntry[] = visibleNpcs.map((npc) => {
    const profile = profileFor(world, npc);
    const playerGap = dist(state.player, npc.point);
    const ripple = reactionRippleTicks(playerGap);
    const inDialogue = state.dialogue !== null && state.dialogue.knot === npc.knot;

    if (inDialogue) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: npcFacing(state, npc),
        attention: "dialogue",
        personality: profile.personality,
        adult: profile.adult,
        emote: null,
        attentionStrength: 1,
        focusTarget: { x: state.player.x, y: state.player.y },
      };
    }

    const lanternReady =
      lanternTick === null || (state.tick >= lanternTick && state.tick - lanternTick >= ripple);
    if (state.lantern && playerGap <= LANTERN_RANGE && lanternReady) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: facingToward(npc.point, state.player, npc.facing),
        attention: "lantern-awe",
        personality: profile.personality,
        adult: profile.adult,
        emote: "sparkle",
        attentionStrength: clamp01(1 - playerGap / (LANTERN_RANGE + 25)),
        focusTarget: { x: state.player.x, y: state.player.y },
      };
    }

    if (
      justCalmedNow &&
      memory.lastCalmedTick !== null &&
      playerGap <= CELEBRATE_RANGE &&
      state.tick - memory.lastCalmedTick >= ripple
    ) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: facingToward(npc.point, state.player, npc.facing),
        attention: "celebrate",
        personality: profile.personality,
        adult: profile.adult,
        emote: celebrationEmoteFor(profile.personality),
        attentionStrength: clamp01(1 - playerGap / (CELEBRATE_RANGE + 30)),
        focusTarget: { x: state.player.x, y: state.player.y },
      };
    }

    if (
      recentFluteNow &&
      fluteTick !== null &&
      playerGap <= FLUTE_RANGE &&
      state.tick - fluteTick >= ripple
    ) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: facingToward(npc.point, state.player, npc.facing),
        attention: "music-delight",
        personality: profile.personality,
        adult: profile.adult,
        emote: "note",
        attentionStrength: clamp01(1 - playerGap / (FLUTE_RANGE + 30)),
        focusTarget: { x: state.player.x, y: state.player.y },
      };
    }

    const grace = npc.id === "mom" ? IDLE_LOOK_GRACE_TICKS : ARRIVAL_GRACE_TICKS;
    if (memory.areaTicks < grace) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: npc.facing,
        attention: "idle",
        personality: profile.personality,
        adult: profile.adult,
        emote: null,
        attentionStrength: 0,
        focusTarget: null,
      };
    }

    const nearChaos = nearestCritterTo(chaos, npc.point);
    if (nearChaos !== null) {
      const chaosGap = dist(npc.point, nearChaos.point);
      if (chaosGap <= CHAOS_NPC_RANGE) {
        return {
          id: npc.id,
          x: npc.point.x,
          y: npc.point.y,
          facing: facingToward(npc.point, nearChaos.point, npc.facing),
          attention: "chaos-worry",
          personality: profile.personality,
          adult: profile.adult,
          emote: "worry",
          attentionStrength: clamp01(1 - chaosGap / (CHAOS_NPC_RANGE + 20)),
          focusTarget: { x: nearChaos.point.x, y: nearChaos.point.y },
        };
      }
    }

    const hasFavCompanion = profile.favoriteParty.some((id) => situation.partyIds.includes(id));
    if (hasFavCompanion && playerGap <= profile.greetRange + 35) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: facingToward(npc.point, state.player, npc.facing),
        attention: "companion-greet",
        personality: profile.personality,
        adult: profile.adult,
        emote: "heart",
        attentionStrength: clamp01(1 - playerGap / (profile.greetRange + 55)),
        focusTarget: { x: state.player.x, y: state.player.y },
      };
    }

    const festiveFinale =
      situation.storyStage === "forest_calm" && playerGap <= FINALE_CELEBRATION_RANGE;
    const festiveEmote = celebrationEmoteFor(profile.personality);

    if (playerGap <= profile.greetRange) {
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: facingToward(npc.point, state.player, npc.facing),
        attention: "player-greet",
        personality: profile.personality,
        adult: profile.adult,
        emote: state.dialogue === null ? (festiveFinale ? festiveEmote : "wave") : null,
        attentionStrength: clamp01(1 - playerGap / (profile.greetRange + 25)),
        focusTarget: { x: state.player.x, y: state.player.y },
      };
    }

    if (banter !== null && banter.phase < BANTER_SECOND_END &&
        (banter.first.id === npc.id || banter.second.id === npc.id)) {
      const partner = banter.first.id === npc.id ? banter.second : banter.first;
      const isSpeaker =
        (banter.speakerIndex === 0 && banter.first.id === npc.id) ||
        (banter.speakerIndex === 1 && banter.second.id === npc.id);
      const listenerEmote: NpcEmoteKind | null =
        banter.speakerIndex !== null && playerGap <= SOCIAL_LISTENER_RANGE
          ? profile.personality === "artist" || profile.personality === "shepherd"
            ? "note"
            : "heart"
          : null;
      return {
        id: npc.id,
        x: npc.point.x,
        y: npc.point.y,
        facing: facingToward(npc.point, partner.point, npc.facing),
        attention: "social-chat",
        personality: profile.personality,
        adult: profile.adult,
        emote: isSpeaker ? "note" : listenerEmote,
        attentionStrength: isSpeaker ? 0.85 : 0.55,
        focusTarget: { x: partner.point.x, y: partner.point.y },
      };
    }

    const facing = memory.areaTicks >= IDLE_LOOK_GRACE_TICKS
      ? idleLookDirection(npc, state.tick, profile.lookAroundTicks)
      : npc.facing;
    return {
      id: npc.id,
      x: npc.point.x,
      y: npc.point.y,
      facing,
      attention: "idle",
      personality: profile.personality,
      adult: profile.adult,
      emote: state.dialogue === null && festiveFinale ? festiveEmote : null,
      attentionStrength: festiveFinale ? 0.35 : 0,
      focusTarget: null,
    };
  });

  const chatter = evaluateChatter(world, state, situation, visibleNpcs, chaos, banter, memory);
  return { situation, npcs, chatter };
}
