import { calmedFact, presentCritters } from "./sim";
import type {
  Npc,
  NpcChatterTone,
  NpcCondition,
  NpcEmoteKind,
  NpcPartyBanter,
  NpcProfile,
  NpcStoryStage,
  NpcToolEvent,
  NpcToolTrigger,
  PartyMember,
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

export type NpcChatterBubble = {
  npcId: string;
  speakerName: string;
  text: string;
  tone: NpcChatterTone;
  emote: NpcEmoteKind | null;
  x: number;
  y: number;
  adult: boolean;
  progress: number;
  alpha: number;
};

export type PartyAttention =
  | "lantern-awe"
  | "celebrate"
  | "music-delight"
  | "party-chat"
  | "idle";

export type PartyLifeEntry = {
  id: string;
  x: number;
  y: number;
  attention: PartyAttention;
  emote: NpcEmoteKind | null;
};

export type ToolEventOutcome = {
  event: NpcToolEvent;
  bubble: NpcChatterBubble | null;
};

export type PartyBanterOutcome = {
  entry: NpcPartyBanter;
  tone: NpcChatterTone;
  participants: string[];
  speakerId: string;
  bubble: NpcChatterBubble;
};

export const ARRIVAL_GRACE_TICKS = 48;
export const JUST_CALMED_WINDOW = 150;
export const RECENT_FLUTE_WINDOW = 180;
export const CHAOS_NPC_RANGE = 270;
export const BANTER_SECOND_END = 240;
export const FADE_IN_TICKS = 14;
export const FADE_OUT_TICKS = 18;

const TOOL_CYCLE_TICKS = 180;
const TOOL_TURN0_END = 84;
const TOOL_TURN1_START = 96;
const TOOL_TURN1_END = 180;
const TOOL_SINGLE_LASSO_END = 108;
const PARTY_BANTER_CYCLE_TICKS = 360;
const PARTY_BANTER_TURN0_END = 95;
const PARTY_BANTER_TURN1_START = 120;
const PARTY_BANTER_TURN1_END = 215;
const PARTY_BANTER_SHARED_TURN0_END = 54;
const PARTY_BANTER_SHARED_TURN1_START = 66;
const PARTY_BANTER_SHARED_TURN1_END = 120;

export function reactionRippleTicks(distance: number): number {
  return Math.min(18, Math.floor(Math.max(0, distance) / 22));
}

export function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function envelopeAlpha(
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

export function chaosCrittersInArea(world: World, state: State): PresentCritter[] {
  return presentCritters(world, state).filter((critter) => critter.mood === "chaos");
}

export function isJustCalmed(state: State, memory: NpcLifeMemory): boolean {
  return (
    memory.lastCalmedTick !== null &&
    state.tick >= memory.lastCalmedTick &&
    state.tick - memory.lastCalmedTick < JUST_CALMED_WINDOW
  );
}

export function isRecentFlute(state: State, memory: NpcLifeMemory): boolean {
  const fluteTick = memory.lastFluteTick ?? null;
  return (
    fluteTick !== null &&
    state.tick >= fluteTick &&
    state.tick - fluteTick < RECENT_FLUTE_WINDOW
  );
}

export function matchesConditionAt(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  origin: Point,
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
    const near = chaos.some((critter) => dist(origin, critter.point) <= CHAOS_NPC_RANGE);
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

export function profileForNpc(world: World, npc: Npc): NpcProfile {
  return world.npcProfiles[npc.id] ?? {
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

export function makeNpcBubble(
  npc: Npc,
  profile: NpcProfile,
  text: string,
  tone: NpcChatterTone,
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

export function makePartyBubble(
  world: World,
  member: PartyMember,
  text: string,
  tone: NpcChatterTone,
  emote: NpcEmoteKind | null,
  progress: number,
  alpha: number,
): NpcChatterBubble {
  const content = world.party[member.id];
  return {
    npcId: member.id,
    speakerName: content?.name ?? member.id,
    text,
    tone,
    emote,
    x: member.x,
    y: member.y,
    adult: false,
    progress: clamp01(progress),
    alpha: clamp01(alpha),
  };
}

function emoteForTone(tone: NpcChatterTone): NpcEmoteKind {
  if (tone === "lantern") return "sparkle";
  if (tone === "music") return "note";
  if (tone === "worry") return "worry";
  if (tone === "warm") return "heart";
  return "note";
}

export function evaluateToolEventForTrigger(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  visibleNpcs: Npc[],
  memory: NpcLifeMemory,
  trigger: NpcToolTrigger,
): ToolEventOutcome | null {
  const lanternTick = memory.lanternOnTick ?? null;
  const fluteTick = memory.lastFluteTick ?? null;
  if (trigger === "lantern" && !state.lantern) return null;
  if (trigger === "flute" && !isRecentFlute(state, memory)) return null;
  if (trigger === "lasso" && (!situation.hasLasso || memory.areaTicks < ARRIVAL_GRACE_TICKS)) {
    return null;
  }

  const npcById = new Map<string, Npc>();
  for (const npc of visibleNpcs) npcById.set(npc.id, npc);
  const partyById = new Map<string, PartyMember>();
  for (const member of state.party) partyById.set(member.id, member);

  const candidates: { event: NpcToolEvent; minNpcGap: number }[] = [];
  for (const event of world.toolEvents) {
    if (event.area !== state.area || event.trigger !== trigger) continue;
    let validSpeakers = true;
    let anchorNpc: Npc | null = null;
    let minNpcGap = Infinity;
    for (const turn of event.turns) {
      const npc = npcById.get(turn.speaker);
      const member = partyById.get(turn.speaker);
      if (npc === undefined && member === undefined) {
        validSpeakers = false;
        break;
      }
      if (npc !== undefined) {
        const gap = dist(state.player, npc.point);
        if (gap < minNpcGap) {
          minNpcGap = gap;
          anchorNpc = npc;
        }
      }
    }
    if (!validSpeakers || anchorNpc === null || minNpcGap > event.radius) continue;
    const ripple = reactionRippleTicks(minNpcGap);
    if (trigger === "lantern" && lanternTick !== null) {
      if (state.tick < lanternTick || state.tick - lanternTick < ripple) continue;
    }
    if (trigger === "flute" && fluteTick !== null) {
      if (state.tick < fluteTick || state.tick - fluteTick < ripple) continue;
    }
    if (!matchesConditionAt(world, state, situation, anchorNpc.point, memory, event.when)) {
      continue;
    }
    candidates.push({ event, minNpcGap });
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.event.turns.length !== a.event.turns.length) {
      return b.event.turns.length - a.event.turns.length;
    }
    return a.minNpcGap - b.minNpcGap;
  });
  const chosen = candidates[0];
  if (chosen === undefined) return null;

  const { event, minNpcGap } = chosen;
  const ripple = reactionRippleTicks(minNpcGap);
  const startTick =
    trigger === "lantern"
      ? lanternTick !== null
        ? lanternTick + ripple
        : 0
      : trigger === "flute"
        ? fluteTick !== null
          ? fluteTick + ripple
          : 0
        : 0;
  const elapsed = Math.max(0, state.tick - startTick);
  const phase = elapsed % TOOL_CYCLE_TICKS;
  const emote = emoteForTone(event.tone);

  const buildSpeakerBubble = (
    turnIndex: number,
    progress: number,
    alpha: number,
  ): NpcChatterBubble | null => {
    const turn = event.turns[turnIndex];
    if (turn === undefined) return null;
    const npc = npcById.get(turn.speaker);
    if (npc !== undefined) {
      return makeNpcBubble(npc, profileForNpc(world, npc), turn.text, event.tone, emote,
        progress, alpha);
    }
    const member = partyById.get(turn.speaker);
    if (member !== undefined) {
      return makePartyBubble(world, member, turn.text, event.tone, emote, progress, alpha);
    }
    return null;
  };

  if (event.turns.length === 1) {
    if (trigger === "lantern") {
      const alpha = lanternTick !== null ? clamp01((elapsed + 1) / FADE_IN_TICKS) : 1;
      return { event, bubble: buildSpeakerBubble(0, (elapsed % 120) / 120, alpha) };
    }
    if (trigger === "flute") {
      const total = Math.max(1, RECENT_FLUTE_WINDOW - ripple);
      return {
        event,
        bubble: buildSpeakerBubble(0, elapsed / total, envelopeAlpha(elapsed, total)),
      };
    }
    if (phase < TOOL_SINGLE_LASSO_END) {
      return {
        event,
        bubble: buildSpeakerBubble(
          0,
          phase / TOOL_SINGLE_LASSO_END,
          envelopeAlpha(phase, TOOL_SINGLE_LASSO_END),
        ),
      };
    }
    return null;
  }

  if (phase < TOOL_TURN0_END) {
    return {
      event,
      bubble: buildSpeakerBubble(0, phase / TOOL_TURN0_END, envelopeAlpha(phase, TOOL_TURN0_END)),
    };
  }
  if (phase >= TOOL_TURN1_START && phase < TOOL_TURN1_END) {
    const local = phase - TOOL_TURN1_START;
    const duration = TOOL_TURN1_END - TOOL_TURN1_START;
    return {
      event,
      bubble: buildSpeakerBubble(1, local / duration, envelopeAlpha(local, duration)),
    };
  }
  return { event, bubble: null };
}

export function evaluatePartyBanter(
  world: World,
  state: State,
  situation: NpcWorldSituation,
  banterPhase: number | null,
  memory: NpcLifeMemory,
): PartyBanterOutcome | null {
  if (memory.areaTicks < ARRIVAL_GRACE_TICKS) return null;
  const partyById = new Map<string, PartyMember>();
  for (const member of state.party) partyById.set(member.id, member);

  const eligible: NpcPartyBanter[] = [];
  for (const entry of world.partyBanter) {
    if (entry.area !== state.area) continue;
    if (!entry.turns.every((turn) => partyById.has(turn.speaker))) continue;
    if (!matchesConditionAt(world, state, situation, state.player, memory, entry.when)) continue;
    eligible.push(entry);
  }
  if (eligible.length === 0) return null;

  const chosen =
    eligible[Math.floor(state.tick / PARTY_BANTER_CYCLE_TICKS) % eligible.length] ?? eligible[0];
  if (chosen === undefined) return null;

  let turnIndex: number | null = null;
  let local = 0;
  let duration = PARTY_BANTER_TURN0_END;
  if (banterPhase === null) {
    const phase = state.tick % PARTY_BANTER_CYCLE_TICKS;
    if (phase < PARTY_BANTER_TURN0_END) {
      turnIndex = 0;
      local = phase;
      duration = PARTY_BANTER_TURN0_END;
    } else if (
      chosen.turns.length > 1 &&
      phase >= PARTY_BANTER_TURN1_START &&
      phase < PARTY_BANTER_TURN1_END
    ) {
      turnIndex = 1;
      local = phase - PARTY_BANTER_TURN1_START;
      duration = PARTY_BANTER_TURN1_END - PARTY_BANTER_TURN1_START;
    }
  } else if (banterPhase >= BANTER_SECOND_END) {
    const shared = banterPhase - BANTER_SECOND_END;
    if (chosen.turns.length === 1) {
      if (shared < PARTY_BANTER_TURN0_END) {
        turnIndex = 0;
        local = shared;
        duration = PARTY_BANTER_TURN0_END;
      }
    } else if (shared < PARTY_BANTER_SHARED_TURN0_END) {
      turnIndex = 0;
      local = shared;
      duration = PARTY_BANTER_SHARED_TURN0_END;
    } else if (
      shared >= PARTY_BANTER_SHARED_TURN1_START &&
      shared < PARTY_BANTER_SHARED_TURN1_END
    ) {
      turnIndex = 1;
      local = shared - PARTY_BANTER_SHARED_TURN1_START;
      duration = PARTY_BANTER_SHARED_TURN1_END - PARTY_BANTER_SHARED_TURN1_START;
    }
  }
  if (turnIndex === null) return null;

  const turn = chosen.turns[turnIndex];
  if (turn === undefined) return null;
  const speaker = partyById.get(turn.speaker);
  if (speaker === undefined) return null;
  const tone: NpcChatterTone = chosen.tone ?? "banter";
  const fadeIn = Math.min(FADE_IN_TICKS, Math.floor(duration / 4));
  const fadeOut = Math.min(FADE_OUT_TICKS, Math.floor(duration / 4));
  const bubble = makePartyBubble(
    world,
    speaker,
    turn.text,
    tone,
    emoteForTone(tone),
    local / duration,
    envelopeAlpha(local, duration, fadeIn, fadeOut),
  );
  const participants = Array.from(new Set(chosen.turns.map((item) => item.speaker)));
  return { entry: chosen, tone, participants, speakerId: speaker.id, bubble };
}

export function evaluatePartyLife(
  world: World,
  state: State,
  memory: NpcLifeMemory,
  activePartyChat: PartyBanterOutcome | null,
): PartyLifeEntry[] {
  const overlaysClosed =
    state.dialogue === null &&
    state.battle === null &&
    state.arcade === null &&
    !state.journalOpen &&
    state.transition === null &&
    state.finale !== "credits";
  const justCalmedNow = isJustCalmed(state, memory);
  const recentFluteNow = isRecentFlute(state, memory);
  const lanternTick = memory.lanternOnTick ?? null;
  const fluteTick = memory.lastFluteTick ?? null;

  return state.party.map((member) => {
    const content = world.party[member.id];
    const standingFriend = content !== undefined && !content.sits && !content.flute;
    const fluteFriend = content !== undefined && content.flute;
    if (!overlaysClosed) {
      return { id: member.id, x: member.x, y: member.y, attention: "idle", emote: null };
    }
    const memberGap = dist(state.player, member);
    const ripple = reactionRippleTicks(memberGap);
    const lanternReady =
      lanternTick === null || (state.tick >= lanternTick && state.tick - lanternTick >= ripple);

    if (state.lantern && standingFriend && lanternReady) {
      return {
        id: member.id,
        x: member.x,
        y: member.y,
        attention: "lantern-awe",
        emote: "sparkle",
      };
    }

    if (
      justCalmedNow &&
      memory.lastCalmedTick !== null &&
      standingFriend &&
      state.tick - memory.lastCalmedTick >= ripple
    ) {
      return {
        id: member.id,
        x: member.x,
        y: member.y,
        attention: "celebrate",
        emote: "heart",
      };
    }

    if (
      recentFluteNow &&
      fluteTick !== null &&
      (standingFriend || fluteFriend) &&
      state.tick - fluteTick >= ripple
    ) {
      return {
        id: member.id,
        x: member.x,
        y: member.y,
        attention: "music-delight",
        emote: "note",
      };
    }

    if (activePartyChat !== null && activePartyChat.participants.includes(member.id)) {
      const isSpeaker = activePartyChat.speakerId === member.id;
      const listenerEmote: NpcEmoteKind = activePartyChat.tone === "music" ? "note" : "heart";
      return {
        id: member.id,
        x: member.x,
        y: member.y,
        attention: "party-chat",
        emote: isSpeaker ? "note" : listenerEmote,
      };
    }

    return { id: member.id, x: member.x, y: member.y, attention: "idle", emote: null };
  });
}
