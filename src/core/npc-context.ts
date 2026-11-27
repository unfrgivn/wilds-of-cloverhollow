import { starGemsFound } from "./journal";
import {
  ARRIVAL_GRACE_TICKS,
  BANTER_SECOND_END,
  CHAOS_NPC_RANGE,
  JUST_CALMED_WINDOW,
  RECENT_FLUTE_WINDOW,
  chaosCrittersInArea,
  clamp01,
  dist,
  envelopeAlpha,
  evaluatePartyBanter,
  evaluatePartyLife,
  evaluateToolEventForTrigger,
  isJustCalmed,
  isRecentFlute,
  makeNpcBubble,
  matchesConditionAt,
  profileForNpc,
  reactionRippleTicks,
  type NpcChatterBubble,
  type NpcLifeMemory,
  type NpcWorldSituation,
  type PartyAttention,
  type PartyBanterOutcome,
  type PartyLifeEntry,
} from "./npc-events";
import { npcLivePoint } from "./npc-stroll";
import {
  bossesCalmedCount,
  calmedFact,
  npcFacing,
  npcVisible,
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
  NpcToolEvent,
  Point,
  PresentCritter,
  State,
  World,
} from "./types";

export {
  reactionRippleTicks,
  type NpcChatterBubble,
  type NpcLifeMemory,
  type NpcWorldSituation,
  type PartyAttention,
  type PartyLifeEntry,
};

export type NpcLifeEntry = {
  id: string;
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
  attention: NpcAttention;
  personality: NpcPersonality;
  adult: boolean;
  emote: NpcEmoteKind | null;
  attentionStrength: number;
  focusTarget: Point | null;
};

export type NpcLifeSnapshot = {
  situation: NpcWorldSituation;
  npcs: NpcLifeEntry[];
  party: PartyLifeEntry[];
  chatter: NpcChatterBubble | null;
  activeToolEventId: string | null;
};

const IDLE_LOOK_GRACE_TICKS = 60;
const LANTERN_RANGE = 235;
const CELEBRATE_RANGE = 340;
const FLUTE_RANGE = 340;
const SOCIAL_LISTENER_RANGE = 360;
const CHAOS_CHATTER_RANGE = 280;
const JUST_CALMED_RANGE = 320;
const PARTY_CHATTER_RANGE = 210;
const BANTER_RANGE = 400;
const AMBIENT_CHATTER_RANGE = 185;
const FINALE_CELEBRATION_RANGE = 240;
const BANTER_CYCLE_TICKS = 360;
const BANTER_SPEAK_TICKS = 105;
const BANTER_SECOND_START = 135;
const AMBIENT_CYCLE_TICKS = 240;
const AMBIENT_ON_TICKS = 120;
const WORRY_ON_TICKS = 150;
const PARTY_ON_TICKS = 140;

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

export function matchesNpcCondition(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  npc: Npc,
  memory: NpcLifeMemory,
  condition: NpcCondition | undefined,
): boolean {
  return matchesConditionAt(
    world,
    state,
    situation,
    npcLivePoint(state, npc),
    memory,
    condition,
  );
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
    const firstLive = npcLivePoint(state, first);
    const secondLive = npcLivePoint(state, second);
    const mid = {
      x: (firstLive.x + secondLive.x) / 2,
      y: (firstLive.y + secondLive.y) / 2,
    };
    const range = Math.min(
      dist(state.player, mid),
      dist(state.player, firstLive),
      dist(state.player, secondLive),
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

type ChatterEvaluation = {
  chatter: NpcChatterBubble | null;
  activeToolEvent: NpcToolEvent | null;
  activePartyBanter: PartyBanterOutcome | null;
};

function evaluateChatter(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  visibleNpcs: Npc[],
  chaos: PresentCritter[],
  banter: ActiveBanter | null,
  memory: NpcLifeMemory,
): ChatterEvaluation {
  const empty: ChatterEvaluation = {
    chatter: null,
    activeToolEvent: null,
    activePartyBanter: null,
  };
  if (
    state.area === "harness" ||
    state.dialogue !== null ||
    state.battle !== null ||
    state.arcade !== null ||
    state.journalOpen ||
    state.transition !== null ||
    state.finale === "credits"
  )
    return empty;
  const justCalmedNow = isJustCalmed(state, memory);
  const recentFluteNow = isRecentFlute(state, memory);
  if (
    memory.areaTicks < ARRIVAL_GRACE_TICKS &&
    !state.lantern &&
    !justCalmedNow &&
    !recentFluteNow
  )
    return empty;

  const byNearest = visibleNpcs
    .map((npc) => {
      const live = npcLivePoint(state, npc);
      return {
        npc,
        live,
        profile: profileForNpc(world, npc),
        gap: dist(state.player, live),
      };
    })
    .sort((a, b) => a.gap - b.gap);

  // 1a. Interactive Lantern tool micro-event (high priority, bypasses arrival grace).
  if (state.lantern) {
    const lanternEvent = evaluateToolEventForTrigger(
      world, state, situation, visibleNpcs, memory, "lantern",
    );
    if (lanternEvent !== null) {
      return {
        chatter: lanternEvent.bubble,
        activeToolEvent: lanternEvent.event,
        activePartyBanter: null,
      };
    }
  }

  // 1b. Immediate lantern reaction for nearest NPC within 235u (staggered ripple when ticked).
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
        return {
          chatter: makeNpcBubble(
            item.npc, item.live, item.profile, rule.text, "lantern", rule.emote ?? "sparkle",
            (state.tick % 120) / 120, 1,
          ),
          activeToolEvent: null,
          activePartyBanter: null,
        };
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
        return {
          chatter: makeNpcBubble(
            item.npc, item.live, item.profile, rule.text, "warm", rule.emote ?? "heart",
            elapsed / JUST_CALMED_WINDOW,
            envelopeAlpha(elapsed, JUST_CALMED_WINDOW),
          ),
          activeToolEvent: null,
          activePartyBanter: null,
        };
      }
    }
  }

  // 3a. Interactive Flute tool micro-event (bypasses arrival grace).
  if (recentFluteNow) {
    const fluteEvent = evaluateToolEventForTrigger(
      world, state, situation, visibleNpcs, memory, "flute",
    );
    if (fluteEvent !== null) {
      return {
        chatter: fluteEvent.bubble,
        activeToolEvent: fluteEvent.event,
        activePartyBanter: null,
      };
    }
  }

  // 3b. Immediate musical delight reaction for nearest NPC within 340u.
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
        return {
          chatter: makeNpcBubble(
            item.npc, item.live, item.profile, rule.text, "music", rule.emote ?? "note",
            elapsed / RECENT_FLUTE_WINDOW,
            envelopeAlpha(elapsed, RECENT_FLUTE_WINDOW),
          ),
          activeToolEvent: null,
          activePartyBanter: null,
        };
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
          (critter) => dist(item.live, critter.point) <= CHAOS_NPC_RANGE,
        );
        if (!nearChaos) continue;
        const rule = bestMatchingRule(
          world, state, situation, item.npc, item.profile, memory,
          (candidate) => candidate.when?.chaosNearby === true,
        );
        if (rule !== undefined) {
          return {
            chatter: makeNpcBubble(
              item.npc, item.live, item.profile, rule.text, "worry", rule.emote ?? "worry",
              phase / WORRY_ON_TICKS,
              envelopeAlpha(phase, WORRY_ON_TICKS),
            ),
            activeToolEvent: null,
            activePartyBanter: null,
          };
        }
      }
    }
  }

  // 5. Interactive Lasso tool micro-event (after arrival grace).
  if (situation.hasLasso && memory.areaTicks >= ARRIVAL_GRACE_TICKS) {
    const lassoEvent = evaluateToolEventForTrigger(
      world, state, situation, visibleNpcs, memory, "lasso",
    );
    if (lassoEvent !== null) {
      return {
        chatter: lassoEvent.bubble,
        activeToolEvent: lassoEvent.event,
        activePartyBanter: null,
      };
    }
  }

  // 6. Companion recognition rule for nearest NPC within 210u.
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
          return {
            chatter: makeNpcBubble(
              item.npc, item.live, item.profile, rule.text, "warm", rule.emote ?? "heart",
              phase / PARTY_ON_TICKS,
              envelopeAlpha(phase, PARTY_ON_TICKS),
            ),
            activeToolEvent: null,
            activePartyBanter: null,
          };
        }
      }
    }
  }

  // 7. Active social banter pair turn (360-tick cycle).
  if (banter !== null && banter.phase < BANTER_SECOND_END) {
    if (banter.speakerIndex === null) return empty;
    const speaker = banter.speakerIndex === 0 ? banter.first : banter.second;
    const speakerLive = npcLivePoint(state, speaker);
    const profile = profileForNpc(world, speaker);
    const text = banter.pair.lines[banter.speakerIndex];
    const local = banter.speakerIndex === 0
      ? banter.phase
      : banter.phase - BANTER_SECOND_START;
    return {
      chatter: makeNpcBubble(
        speaker, speakerLive, profile, text, "banter", "note",
        local / BANTER_SPEAK_TICKS,
        envelopeAlpha(local, BANTER_SPEAK_TICKS),
      ),
      activeToolEvent: null,
      activePartyBanter: null,
    };
  }

  // 8. Traveling party companion banter (staggered cleanly around area NPC banter).
  const partyBanter = evaluatePartyBanter(
    world, state, situation, banter === null ? null : banter.phase, memory,
  );
  if (partyBanter !== null) {
    return {
      chatter: partyBanter.bubble,
      activeToolEvent: null,
      activePartyBanter: partyBanter,
    };
  }

  // 9. Nearest NPC's highest-priority matching ambient story/treats/bosses rule within 185u.
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
        return {
          chatter: makeNpcBubble(
            item.npc, item.live, item.profile, rule.text, tone, rule.emote ?? null,
            phase / AMBIENT_ON_TICKS,
            envelopeAlpha(phase, AMBIENT_ON_TICKS),
          ),
          activeToolEvent: null,
          activePartyBanter: null,
        };
      }
    }
  }

  return empty;
}

export function evaluateNpcLife(
  world: World,
  state: State,
  memory: NpcLifeMemory,
): NpcLifeSnapshot {
  const situation = npcWorldSituation(world, state);
  const area = world.areas[state.area];
  if (state.area === "harness" || area === undefined) {
    return { situation, npcs: [], party: [], chatter: null, activeToolEventId: null };
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

  const chatterResult = evaluateChatter(
    world, state, situation, visibleNpcs, chaos, banter, memory,
  );
  const activeTool = chatterResult.activeToolEvent;
  const toolSpeakerIds = new Set<string>(
    activeTool === null ? [] : activeTool.turns.map((turn) => turn.speaker),
  );

  const npcs: NpcLifeEntry[] = visibleNpcs.map((npc) => {
    const profile = profileForNpc(world, npc);
    const live = npcLivePoint(state, npc);
    const playerGap = dist(state.player, live);
    const ripple = reactionRippleTicks(playerGap);
    const inDialogue = state.dialogue !== null && state.dialogue.knot === npc.knot;
    const inActiveTool = activeTool !== null && toolSpeakerIds.has(npc.id);
    const makeEntry = (
      facing: Direction,
      attention: NpcAttention,
      emote: NpcEmoteKind | null,
      attentionStrength: number,
      focusTarget: Point | null,
    ): NpcLifeEntry => ({
      id: npc.id,
      x: live.x,
      y: live.y,
      facing,
      moving: live.moving,
      attention,
      personality: profile.personality,
      adult: profile.adult,
      emote,
      attentionStrength,
      focusTarget,
    });

    if (inDialogue) {
      return makeEntry(
        npcFacing(state, npc),
        "dialogue",
        null,
        1,
        { x: state.player.x, y: state.player.y },
      );
    }

    const lanternReady =
      lanternTick === null || (state.tick >= lanternTick && state.tick - lanternTick >= ripple);
    if (
      state.lantern &&
      ((playerGap <= LANTERN_RANGE && lanternReady) ||
        (inActiveTool && activeTool.trigger === "lantern"))
    ) {
      const range = inActiveTool && activeTool !== null
        ? Math.max(LANTERN_RANGE, activeTool.radius)
        : LANTERN_RANGE;
      return makeEntry(
        facingToward(live, state.player, live.facing),
        "lantern-awe",
        "sparkle",
        clamp01(1 - playerGap / (range + 25)),
        { x: state.player.x, y: state.player.y },
      );
    }

    if (
      justCalmedNow &&
      memory.lastCalmedTick !== null &&
      playerGap <= CELEBRATE_RANGE &&
      state.tick - memory.lastCalmedTick >= ripple
    ) {
      return makeEntry(
        facingToward(live, state.player, live.facing),
        "celebrate",
        celebrationEmoteFor(profile.personality),
        clamp01(1 - playerGap / (CELEBRATE_RANGE + 30)),
        { x: state.player.x, y: state.player.y },
      );
    }

    if (
      recentFluteNow &&
      ((fluteTick !== null && playerGap <= FLUTE_RANGE && state.tick - fluteTick >= ripple) ||
        (inActiveTool && activeTool.trigger === "flute"))
    ) {
      const range = inActiveTool && activeTool !== null
        ? Math.max(FLUTE_RANGE, activeTool.radius)
        : FLUTE_RANGE;
      return makeEntry(
        facingToward(live, state.player, live.facing),
        "music-delight",
        "note",
        clamp01(1 - playerGap / (range + 30)),
        { x: state.player.x, y: state.player.y },
      );
    }

    const grace = npc.id === "mom" ? IDLE_LOOK_GRACE_TICKS : ARRIVAL_GRACE_TICKS;
    if (memory.areaTicks < grace) {
      return makeEntry(live.facing, "idle", null, 0, null);
    }

    const nearChaos = nearestCritterTo(chaos, live);
    if (nearChaos !== null) {
      const chaosGap = dist(live, nearChaos.point);
      if (chaosGap <= CHAOS_NPC_RANGE) {
        return makeEntry(
          facingToward(live, nearChaos.point, live.facing),
          "chaos-worry",
          "worry",
          clamp01(1 - chaosGap / (CHAOS_NPC_RANGE + 20)),
          { x: nearChaos.point.x, y: nearChaos.point.y },
        );
      }
    }

    if (inActiveTool && activeTool !== null && activeTool.trigger === "lasso") {
      return makeEntry(
        facingToward(live, state.player, live.facing),
        "player-greet",
        "heart",
        clamp01(1 - playerGap / (activeTool.radius + 30)),
        { x: state.player.x, y: state.player.y },
      );
    }

    const hasFavCompanion = profile.favoriteParty.some((id) => situation.partyIds.includes(id));
    if (hasFavCompanion && playerGap <= profile.greetRange + 35) {
      return makeEntry(
        facingToward(live, state.player, live.facing),
        "companion-greet",
        "heart",
        clamp01(1 - playerGap / (profile.greetRange + 55)),
        { x: state.player.x, y: state.player.y },
      );
    }

    const festiveFinale =
      situation.storyStage === "forest_calm" && playerGap <= FINALE_CELEBRATION_RANGE;
    const festiveEmote = celebrationEmoteFor(profile.personality);

    if (playerGap <= profile.greetRange) {
      return makeEntry(
        facingToward(live, state.player, live.facing),
        "player-greet",
        state.dialogue === null ? (festiveFinale ? festiveEmote : "wave") : null,
        clamp01(1 - playerGap / (profile.greetRange + 25)),
        { x: state.player.x, y: state.player.y },
      );
    }

    if (banter !== null && banter.phase < BANTER_SECOND_END &&
        (banter.first.id === npc.id || banter.second.id === npc.id)) {
      const partner = banter.first.id === npc.id ? banter.second : banter.first;
      const partnerLive = npcLivePoint(state, partner);
      const isSpeaker =
        (banter.speakerIndex === 0 && banter.first.id === npc.id) ||
        (banter.speakerIndex === 1 && banter.second.id === npc.id);
      const listenerEmote: NpcEmoteKind | null =
        banter.speakerIndex !== null && playerGap <= SOCIAL_LISTENER_RANGE
          ? profile.personality === "artist" || profile.personality === "shepherd"
            ? "note"
            : "heart"
          : null;
      return makeEntry(
        facingToward(live, partnerLive, live.facing),
        "social-chat",
        isSpeaker ? "note" : listenerEmote,
        isSpeaker ? 0.85 : 0.55,
        { x: partnerLive.x, y: partnerLive.y },
      );
    }

    const facing = live.moving
      ? live.facing
      : memory.areaTicks >= IDLE_LOOK_GRACE_TICKS
        ? idleLookDirection(npc, state.tick, profile.lookAroundTicks)
        : live.facing;
    return makeEntry(
      facing,
      "idle",
      state.dialogue === null && festiveFinale ? festiveEmote : null,
      festiveFinale ? 0.35 : 0,
      null,
    );
  });

  const party = evaluatePartyLife(world, state, memory, chatterResult.activePartyBanter);

  return {
    situation,
    npcs,
    party,
    chatter: chatterResult.chatter,
    activeToolEventId: activeTool?.id ?? null,
  };
}
