import {
  effectiveAreaNpcs,
  npcLivePoint,
  npcVisible,
  presentCritters,
  type Battle,
  type Direction,
  type PartyAttention,
  type PartyMember,
  type Point,
  type State,
  type World,
} from "../core";
import { maddieIdlePhase } from "./companions";

export type AnimationSelection = {
  animation: string;
  frame: number;
  mirror: boolean;
};

export const CHARACTER_POSE_ATLASES: Readonly<Record<string, string>> = {
  fae: "assets/characters/fae/fae-poses.json",
  maddie: "assets/characters/maddie/maddie-poses.json",
  sue: "assets/characters/sue/sue-poses.json",
  jordan: "assets/characters/jordan/jordan-poses.json",
};

export type DialoguePoseKind = "cheer" | "shock" | "sit" | "talk";

export type FaePoseName =
  | "pose_cheer"
  | "pose_shock"
  | "pose_sit"
  | "pose_talk"
  | "pose_tool_lantern"
  | "pose_tool_lasso"
  | "pose_tool_flute";

export type MaddiePoseName = "pose_groom" | "pose_stretch" | "pose_nap" | "pose_cheer";

export type FriendPoseName = "pose_cheer" | "pose_shock" | "pose_sit";

export type CharacterPoseName = FaePoseName | MaddiePoseName | FriendPoseName;

export type DialoguePoseDirective = {
  target: string | null;
  pose: DialoguePoseKind;
};

const VALID_POSE_TARGETS: ReadonlySet<string> = new Set([
  "fae",
  "maddie",
  "sue",
  "jordan",
  "party",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDialoguePoseKind(value: string): value is DialoguePoseKind {
  return value === "cheer" || value === "shock" || value === "sit" || value === "talk";
}

export function facingToward(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
}

export function dialoguePartner(world: World, state: State): Point | null {
  if (state.dialogue === null) return null;
  const knot = state.dialogue.knot;
  const area = world.areas[state.area];
  const npc =
    area === undefined
      ? undefined
      : effectiveAreaNpcs(world, state, area).find(
          (item) => npcVisible(world, state, item) && item.knot === knot,
        );
  if (npc !== undefined) {
    const live = npcLivePoint(state, npc);
    return { x: live.x, y: live.y };
  }
  const calm = presentCritters(world, state)
    .filter((item) => item.mood === "calm" && item.kind.calmKnot === knot)
    .sort((a, b) =>
      (a.point.x - state.player.x) ** 2 + (a.point.y - state.player.y) ** 2 -
      ((b.point.x - state.player.x) ** 2 + (b.point.y - state.player.y) ** 2))[0];
  return calm?.point ?? null;
}

export function dialogueFacing(world: World, state: State): Direction | null {
  const partner = dialoguePartner(world, state);
  return partner === null ? null : facingToward(state.player, partner);
}

export function selectFaeAnimation(
  facing: Direction,
  motion: State["motion"],
  frameCount: number,
  walkCycleUnits: number,
): AnimationSelection {
  const side = facing === "right" ? "left" : facing;
  const mirror = facing === "right";
  if (!motion.moving) {
    return { animation: `idle_${side}`, frame: 0, mirror };
  }
  const progress = motion.distance / walkCycleUnits;
  const frame = Math.floor(progress * frameCount) % frameCount;
  return { animation: `walk_${side}`, frame, mirror };
}

export function parsePoseTags(tags: readonly string[]): DialoguePoseDirective[] {
  const directives: DialoguePoseDirective[] = [];
  for (const raw of tags) {
    const match = /^pose\s*:\s*(.+)$/i.exec(raw.trim());
    const body = match?.[1]?.trim().toLowerCase();
    if (body === undefined || body.length === 0) continue;
    const tokens = body.split(/\s+/);
    if (tokens.length === 1) {
      const pose = tokens[0];
      if (pose !== undefined && isDialoguePoseKind(pose)) {
        directives.push({ target: null, pose });
      }
    } else if (tokens.length === 2) {
      const target = tokens[0];
      const pose = tokens[1];
      if (
        target !== undefined &&
        pose !== undefined &&
        VALID_POSE_TARGETS.has(target) &&
        isDialoguePoseKind(pose)
      ) {
        directives.push({ target, pose });
      }
    }
  }
  return directives;
}

export function extractInkOutputTags(inkJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(inkJson);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];
  let stream: unknown;
  if (isRecord(parsed.flows) && isRecord(parsed.flows.DEFAULT_FLOW)) {
    stream = parsed.flows.DEFAULT_FLOW.outputStream;
  }
  if (!Array.isArray(stream)) {
    stream = parsed.outputStream;
  }
  if (!Array.isArray(stream)) return [];

  const tags: string[] = [];
  let inTag = false;
  let buffer = "";
  for (const item of stream) {
    if (item === "#") {
      inTag = true;
      buffer = "";
    } else if (item === "/#") {
      if (inTag) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) tags.push(trimmed);
      }
      inTag = false;
      buffer = "";
    } else if (inTag && typeof item === "string" && item.startsWith("^")) {
      buffer += item.slice(1);
    }
  }
  return tags;
}

const storyKnotLineCache = new WeakMap<
  Record<string, unknown>,
  Map<string, Map<string, string[]>>
>();

function recordLineTags(
  lines: Map<string, string[]>,
  lineText: string,
  lineTags: readonly string[],
): void {
  const trimmed = lineText.trim();
  if (trimmed.length === 0 || lineTags.length === 0) return;
  const existing = lines.get(trimmed);
  if (existing === undefined) {
    lines.set(trimmed, [...lineTags]);
    return;
  }
  for (const tag of lineTags) {
    if (!existing.includes(tag)) existing.push(tag);
  }
}

function hasNestedContainers(record: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("#")) continue;
    if (Array.isArray(value) || isRecord(value)) return true;
  }
  return false;
}

function indexKnotContainer(node: unknown, lines: Map<string, string[]>): void {
  if (Array.isArray(node)) {
    let evalDepth = 0;
    let inTag = false;
    let tagBuffer = "";
    let lineText = "";
    let lineTags: string[] = [];
    const flush = (): void => {
      recordLineTags(lines, lineText, lineTags);
      lineText = "";
      lineTags = [];
    };
    for (const item of node) {
      if (typeof item === "string") {
        if (item === "ev") {
          evalDepth += 1;
          continue;
        }
        if (item === "/ev") {
          evalDepth = Math.max(0, evalDepth - 1);
          continue;
        }
        if (evalDepth > 0) continue;
        if (item === "#") {
          inTag = true;
          tagBuffer = "";
          continue;
        }
        if (item === "/#") {
          if (inTag) {
            const trimmed = tagBuffer.trim();
            if (trimmed.length > 0) lineTags.push(trimmed);
          }
          inTag = false;
          tagBuffer = "";
          continue;
        }
        if (item === "\n") {
          flush();
          continue;
        }
        if (item.startsWith("^")) {
          if (inTag) tagBuffer += item.slice(1);
          else lineText += item.slice(1);
        }
      } else if (Array.isArray(item)) {
        flush();
        indexKnotContainer(item, lines);
      } else if (isRecord(item) && hasNestedContainers(item)) {
        flush();
        indexKnotContainer(item, lines);
      }
    }
    flush();
    return;
  }
  if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("#")) continue;
      if (Array.isArray(value) || isRecord(value)) {
        indexKnotContainer(value, lines);
      }
    }
  }
}

function resolveStoryKnotContainer(
  story: Record<string, unknown>,
  knot: string,
): unknown {
  const root = story.root;
  if (!Array.isArray(root) || root.length === 0) return undefined;
  const named = root[root.length - 1];
  if (!isRecord(named)) return undefined;
  if (Object.hasOwn(named, knot)) return named[knot];
  if (!knot.includes(".")) return undefined;
  let current: unknown = named;
  for (const segment of knot.split(".")) {
    if (Array.isArray(current)) {
      const tail = current[current.length - 1];
      current = isRecord(tail) && Object.hasOwn(tail, segment) ? tail[segment] : undefined;
    } else if (isRecord(current) && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function extractStoryKnotLineTags(
  story: Record<string, unknown>,
  knot: string,
  text: string,
): string[] {
  const trimmedText = text.trim();
  if (knot.length === 0 || trimmedText.length === 0) return [];
  let knotCache = storyKnotLineCache.get(story);
  if (knotCache === undefined) {
    knotCache = new Map();
    storyKnotLineCache.set(story, knotCache);
  }
  let knotLines = knotCache.get(knot);
  if (knotLines === undefined) {
    knotLines = new Map();
    const container = resolveStoryKnotContainer(story, knot);
    if (container !== undefined) {
      indexKnotContainer(container, knotLines);
    }
    knotCache.set(knot, knotLines);
  }
  return knotLines.get(trimmedText)?.slice() ?? [];
}

export function extractDialogueTags(
  world: Pick<World, "story">,
  state: Pick<State, "ink" | "dialogue">,
): string[] {
  if (state.dialogue === null) return [];
  const outputTags = extractInkOutputTags(state.ink);
  if (parsePoseTags(outputTags).length > 0) return outputTags;
  const knotTags = extractStoryKnotLineTags(
    world.story,
    state.dialogue.knot,
    state.dialogue.text,
  );
  if (knotTags.length === 0) return outputTags;
  const merged = outputTags.slice();
  for (const tag of knotTags) {
    if (!merged.includes(tag)) merged.push(tag);
  }
  return merged;
}

function faePoseFromDialogueKind(
  pose: DialoguePoseKind,
  facing: Direction,
): AnimationSelection {
  if (pose === "cheer") return { animation: "pose_cheer", frame: 0, mirror: false };
  if (pose === "shock") return { animation: "pose_shock", frame: 0, mirror: false };
  if (pose === "sit") return { animation: "pose_sit", frame: 0, mirror: facing === "right" };
  return { animation: "pose_talk", frame: 0, mirror: facing === "right" };
}

export function selectFaeOverworldPose(params: {
  world: Pick<World, "story" | "toolEvents">;
  state: State;
  facing: Direction;
  walkFrameCount: number;
  walkCycleUnits: number;
  activeRest: boolean;
  activePet: boolean;
  activeToolEventId?: string | null;
  dialogueTags?: readonly string[];
}): AnimationSelection {
  const {
    world,
    state,
    facing,
    walkFrameCount,
    walkCycleUnits,
    activeRest,
    activePet,
    activeToolEventId,
    dialogueTags,
  } = params;
  if (state.area === "harness" || state.motion.moving) {
    return selectFaeAnimation(facing, state.motion, walkFrameCount, walkCycleUnits);
  }

  if (state.dialogue !== null) {
    const tags = dialogueTags ?? extractDialogueTags(world, state);
    const directives = parsePoseTags(tags);
    const speakerLower = (state.dialogue.speaker ?? "").trim().toLowerCase();
    const match =
      directives.find((directive) => directive.target === "fae") ??
      directives.find((directive) => directive.target === "party") ??
      (speakerLower === "fae" || speakerLower === ""
        ? directives.find((directive) => directive.target === null)
        : undefined);
    if (match !== undefined) {
      return faePoseFromDialogueKind(match.pose, facing);
    }
  }

  const activeEvent =
    activeToolEventId !== undefined && activeToolEventId !== null
      ? world.toolEvents.find((event) => event.id === activeToolEventId)
      : undefined;

  const isFlute =
    (state.dialogue !== null &&
      (state.dialogue.knot === "flute" ||
        state.dialogue.sound === "flute" ||
        state.dialogue.sound?.startsWith("flute-") === true)) ||
    activeEvent?.trigger === "flute";
  if (isFlute) {
    return { animation: "pose_tool_flute", frame: 0, mirror: facing === "right" };
  }

  const isLasso =
    activeEvent?.trigger === "lasso" ||
    (state.dialogue !== null &&
      state.dialogue.speaker === "Fae" &&
      /\blasso\b/i.test(state.dialogue.text) &&
      /\b(twirls?|loops?|pulls?|throws?|reels?|snags?)\b/i.test(state.dialogue.text));
  if (isLasso) {
    return { animation: "pose_tool_lasso", frame: 0, mirror: facing === "right" };
  }

  const isLantern =
    (state.lantern && state.battle === null) || activeEvent?.trigger === "lantern";
  if (isLantern) {
    return { animation: "pose_tool_lantern", frame: 0, mirror: facing === "right" };
  }

  if (activeRest) {
    return { animation: "pose_sit", frame: 0, mirror: facing === "right" };
  }

  if (activePet) {
    return { animation: "pose_cheer", frame: 0, mirror: false };
  }

  if (
    state.dialogue !== null &&
    state.dialogue.speaker === "Fae" &&
    state.dialogue.revealed > 0 &&
    state.dialogue.revealed < state.dialogue.text.length
  ) {
    return { animation: "pose_talk", frame: 0, mirror: facing === "right" };
  }

  return selectFaeAnimation(facing, state.motion, walkFrameCount, walkCycleUnits);
}

export function selectPartyOverworldPose(params: {
  world: Pick<World, "story">;
  state: State;
  member: PartyMember;
  facing: Direction;
  activeRest: boolean;
  beingPetted: boolean;
  partyAttention?: PartyAttention | null;
  dialogueTags?: readonly string[];
}): { animation: CharacterPoseName; frame: 0; mirror: boolean } | null {
  const {
    world,
    state,
    member,
    facing,
    activeRest,
    beingPetted,
    partyAttention,
    dialogueTags,
  } = params;
  if (
    state.area === "harness" ||
    member.motion.moving ||
    !(member.id in CHARACTER_POSE_ATLASES)
  ) {
    return null;
  }

  const isMaddie = member.id === "maddie";
  const isFriend = member.id === "sue" || member.id === "jordan";

  if (state.dialogue !== null) {
    const tags = dialogueTags ?? extractDialogueTags(world, state);
    const directives = parsePoseTags(tags);
    const speakerLower = (state.dialogue.speaker ?? "").trim().toLowerCase();
    const match =
      directives.find((directive) => directive.target === member.id) ??
      directives.find((directive) => directive.target === "party") ??
      (speakerLower === member.id
        ? directives.find((directive) => directive.target === null)
        : undefined);
    if (match !== undefined) {
      if (isMaddie && match.pose === "cheer") {
        return { animation: "pose_cheer", frame: 0, mirror: facing === "right" };
      }
      if (isFriend) {
        if (match.pose === "cheer") {
          return { animation: "pose_cheer", frame: 0, mirror: false };
        }
        if (match.pose === "shock") {
          return { animation: "pose_shock", frame: 0, mirror: false };
        }
        if (match.pose === "sit") {
          return { animation: "pose_sit", frame: 0, mirror: facing === "right" };
        }
      }
    }
  }

  if (beingPetted && isMaddie) {
    return { animation: "pose_cheer", frame: 0, mirror: facing === "right" };
  }

  if (partyAttention === "celebrate") {
    if (isMaddie) {
      return { animation: "pose_cheer", frame: 0, mirror: facing === "right" };
    }
    if (isFriend) {
      return { animation: "pose_cheer", frame: 0, mirror: false };
    }
  }

  if (activeRest && isFriend) {
    return { animation: "pose_sit", frame: 0, mirror: facing === "right" };
  }

  if (isMaddie && state.dialogue === null && state.battle === null) {
    const phase = maddieIdlePhase(member.stillTicks);
    if (phase === "stretch") {
      return { animation: "pose_stretch", frame: 0, mirror: facing === "right" };
    }
    if (phase === "groom") {
      return { animation: "pose_groom", frame: 0, mirror: facing === "right" };
    }
    if (phase === "nap") {
      return { animation: "pose_nap", frame: 0, mirror: facing === "right" };
    }
  }

  return null;
}

export function selectBattleActorPose(
  actorId: string,
  battle: Battle,
): { animation: CharacterPoseName; mirror: boolean } | null {
  if (battle.phase !== "soothed" && battle.phase !== "reward") return null;
  if (actorId === "fae" || actorId === "sue" || actorId === "jordan") {
    return { animation: "pose_cheer", mirror: false };
  }
  if (actorId === "maddie") {
    return { animation: "pose_cheer", mirror: true };
  }
  return null;
}
