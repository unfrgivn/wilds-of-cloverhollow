import {
  CLUBHOUSE_VISITORS,
  type Area,
  type Critter,
  type Direction,
  type Npc,
  type PartyAttention,
  type PartyContent,
  type PartyMember,
  type Point,
  type PresentCritter,
  type State,
  type Tunables,
  type World,
} from "../core";
import { assetUrl } from "../platform/assets";
import type { AmbientFlyer } from "../content/ambient";
import { facingToward, selectPartyOverworldPose } from "./animation";
import type { RestSpot } from "./companions";
import {
  companionIdlePose,
  composePose,
  dashPose,
  fairyHover,
  idleBreathing,
  NEUTRAL_POSE,
  roamerHop,
  sitSquash,
  walkPose,
  type MotionPose,
} from "./motion";
import { PET_REACTION_DURATION } from "./overworld-vfx-math";

export {
  computeBackdropTransform,
  computeCompanionEmoteSpecs,
  computeGlowTransform,
  computeLanternBlend,
  computeLanternMote,
  computeOverworldEmoteInputs,
  evaluateStarGemGlints,
  facingBackVector,
  LANTERN_MOTE_COUNT,
  LANTERN_MOTE_TINTS,
  PET_REACTION_DURATION,
  PET_SPARKLE_TINTS,
  spawnFootstepPuffs,
  spawnNpcFootstepPuff,
  SURFACE_PUFFS,
  type BackdropTransform,
  type CompanionEmoteSpec,
  type FootstepPuff,
  type StarGemGlint,
} from "./overworld-vfx-math";

export const INDOOR_AREAS = new Set([
  "bedroom",
  "kitchen",
  "school",
  "east-hall",
  "classroom",
  "gym",
  "music",
  "art-room",
  "arcade",
  "lodge",
  "clubhouse",
  "cafe",
  "market",
  "parlor",
  "sue-cottage",
  "jordan-cabin",
  "milo-house",
  "rosie-cottage",
]);

export const ADULT_NPCS = new Set([
  "mom",
  "dad",
  "teacher",
  "nurse",
  "coach",
  "music-teacher",
  "fern",
  "chef",
  "barnaby",
  "bree",
  "buster",
  "bay-keeper",
  "pass-keeper",
  "pippin",
  "penny",
]);

export type EntityAtlas = { alias: string; src: string };

export type ShadowTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
};

export type FlyerGlowTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  tint: number;
};

export type FlyerVisual = {
  shadow: ShadowTransform | null;
  glow: FlyerGlowTransform | null;
};

function flyerPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return ((hash >>> 0) / 0x100000000) * Math.PI * 2;
}

export function computeFlyerVisual(
  flyer: Pick<AmbientFlyer, "id" | "animation" | "size">,
  position: Point,
  tick: number,
  reducedMotion: boolean,
): FlyerVisual {
  if (flyer.animation.startsWith("butterfly")) {
    return {
      shadow: {
        x: position.x,
        y: position.y + 18,
        width: flyer.size * 0.72,
        height: flyer.size * 0.28,
        alpha: 0.16,
      },
      glow: null,
    };
  }
  if (flyer.animation === "fairy_light") {
    const phase = flyerPhase(flyer.id);
    const alpha = reducedMotion
      ? 0.44
      : 0.34 + 0.24 * (0.5 + 0.5 * Math.sin(tick * 0.08 + phase));
    return {
      shadow: null,
      glow: {
        x: position.x,
        y: position.y,
        width: flyer.size * 2.6,
        height: flyer.size * 2.6,
        alpha,
        tint: 0xffe484,
      },
    };
  }
  return { shadow: null, glow: null };
}

export function liftShadowScale(offsetY: number): number {
  const lift = Math.max(0, -offsetY);
  return Math.max(0.76, 1 - lift * 0.02);
}

export function warmFlashTint(flash: number): number {
  if (flash <= 0.005) return 0xffffff;
  const t = Math.min(1, Math.max(0, flash));
  const r = 255;
  const g = Math.round(255 - (255 - 0xb4) * t);
  const b = Math.round(255 - (255 - 0xa2) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Unique per-area NPC and critter spritesheets, excluding party members
 * (which stay resident across areas). Loaded with the area and evicted on the
 * same current + previous residency window as AreaView textures (spec 4).
 */
export function areaEntityAtlases(world: World, area: Area): EntityAtlas[] {
  const seen = new Set<string>();
  const result: EntityAtlas[] = [];
  const add = (alias: string, atlas: string): void => {
    if (seen.has(alias)) return;
    seen.add(alias);
    result.push({ alias, src: assetUrl(atlas) });
  };
  for (const npc of area.npcs) {
    if (world.party[npc.id] !== undefined) continue;
    if (npc.visibleWhenCalmed !== undefined) {
      const critter = world.critters[npc.visibleWhenCalmed];
      if (critter !== undefined) add(critter.atlas, critter.atlas);
      continue;
    }
    const character = world.characters[npc.id];
    if (character !== undefined) add(`${npc.id}-sheet`, character.atlas);
  }
  if (area.id === "clubhouse") {
    for (const visitor of CLUBHOUSE_VISITORS) {
      if (world.party[visitor.id] !== undefined) continue;
      const character = world.characters[visitor.id];
      if (character !== undefined) add(`${visitor.id}-sheet`, character.atlas);
    }
  }
  const critterIds = [
    ...area.critters.map((piece) => piece.id),
    ...(area.recurring?.dens ?? []).flatMap((den) => den.kinds),
  ];
  for (const id of critterIds) {
    const critter = world.critters[id];
    if (critter !== undefined) add(critter.atlas, critter.atlas);
  }
  return result;
}

export function computeFaePose(
  state: State,
  livingMotion: boolean,
  walkCycleUnits: number,
  playerPos: Point,
  activeRest: { spot: RestSpot; elapsed: number } | null,
  activePet: { id: string; elapsed: number } | null,
): MotionPose {
  const dashing = state.previousInput.dash === true && state.motion.moving;
  let pose: MotionPose = !livingMotion
    ? NEUTRAL_POSE
    : state.motion.moving
      ? dashing
        ? dashPose(state.motion.distance, walkCycleUnits, state.facing)
        : walkPose(state.motion.distance, walkCycleUnits, true)
      : activeRest !== null
        ? {
            offsetX: 0,
            offsetY: 2,
            scaleX: 1 - Math.sin(activeRest.elapsed * 0.055) * 0.008,
            scaleY: 1 + Math.sin(activeRest.elapsed * 0.055) * 0.012,
            rotation: Math.sin(activeRest.elapsed * 0.04) * 0.018,
          }
        : idleBreathing(state.tick, 0);
  if (livingMotion && activePet !== null && activePet.elapsed < 22 && !state.motion.moving) {
    const petMember = state.party.find((item) => item.id === activePet.id);
    const nodDir = petMember !== undefined && petMember.x < playerPos.x ? -1 : 1;
    const nod = Math.sin((activePet.elapsed / 22) * Math.PI) * 0.05 * nodDir;
    pose = { ...pose, rotation: pose.rotation + nod };
  }
  return pose;
}

export type PartyFollowerTransform = {
  animation: string;
  frame: number;
  mirror: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  zIndex: number;
  shadow: ShadowTransform;
};

export type PartyFollowerTransformOptions = {
  activeRest?: boolean;
  partyAttention?: PartyAttention | null;
  dialogueTags?: readonly string[];
  paperFlipPose?: MotionPose;
  worldStory?: Record<string, unknown>;
  hasAnimation?: (animation: string) => boolean;
};

export function computePartyFollowerFacing(
  member: PartyMember,
  content: PartyContent,
  state: State,
  partner: Point | null,
  follow: Tunables["follow"],
  activePet: { id: string; elapsed: number } | null,
): Direction {
  const beingPetted = activePet !== null && activePet.id === member.id;
  const settled =
    !content.sits && !member.motion.moving && member.stillTicks >= follow.settleDelayTicks;
  return beingPetted && !member.motion.moving
    ? facingToward(member, state.player)
    : settled
      ? partner !== null
        ? facingToward(member, partner)
        : state.facing
      : member.facing;
}

export function computePartyFollowerTransform(
  member: PartyMember,
  content: PartyContent,
  state: State,
  index: number,
  pos: Point,
  partner: Point | null,
  shadowAlpha: number,
  livingMotion: boolean,
  follow: Tunables["follow"],
  activePet: { id: string; elapsed: number } | null,
  frameCountFor: (animation: string) => number,
  options?: PartyFollowerTransformOptions,
): PartyFollowerTransform {
  const beingPetted = activePet !== null && activePet.id === member.id;
  const facing = computePartyFollowerFacing(member, content, state, partner, follow, activePet);
  const side = facing === "right" ? "left" : facing;
  let mirror = facing === "right";
  const resting = !member.motion.moving &&
    (!content.sits || member.stillTicks >= follow.sitDelayTicks);
  let animation = resting ? `idle_${side}` : `walk_${side}`;
  const frameCount = frameCountFor(animation);
  let frame = member.motion.moving && frameCount > 0
    ? Math.floor((member.motion.distance / content.walkCycleUnits) * frameCount) % frameCount
    : 0;

  const expressive = selectPartyOverworldPose({
    world: { story: options?.worldStory ?? {} },
    state,
    member,
    facing,
    activeRest: options?.activeRest ?? false,
    beingPetted,
    partyAttention: options?.partyAttention ?? null,
    ...(options?.dialogueTags !== undefined ? { dialogueTags: options.dialogueTags } : {}),
  });
  if (expressive !== null && (options?.hasAnimation?.(expressive.animation) ?? true)) {
    animation = expressive.animation;
    frame = expressive.frame;
    mirror = expressive.mirror;
  }

  let pose: MotionPose = NEUTRAL_POSE;
  if (livingMotion) {
    const isSideBounder = member.id === "acorn-squirrel" &&
      (member.facing === "left" || member.facing === "right");
    if (member.motion.moving) {
      pose = walkPose(member.motion.distance, content.walkCycleUnits, true, isSideBounder);
    } else {
      pose = companionIdlePose(member.id, member.stillTicks, state.tick, index);
      if (content.sits) {
        pose = composePose(pose, sitSquash(member.stillTicks, follow.sitDelayTicks));
      }
    }
    if (beingPetted) {
      const e = activePet.elapsed;
      const decay = Math.max(0, 1 - e / PET_REACTION_DURATION);
      const hop = Math.abs(Math.sin(e / 4.2));
      pose = composePose(pose, {
        offsetX: 0,
        offsetY: -hop * 14 * (0.45 + 0.55 * decay),
        scaleX: 1 + (0.08 * (1 - hop) - 0.06 * hop) * decay,
        scaleY: 1 + (0.08 * hop - 0.06 * (1 - hop)) * decay,
        rotation: Math.sin(e / 3.8) * 0.12 * decay,
      });
    }
  }
  if (options?.paperFlipPose !== undefined) {
    pose = composePose(pose, options.paperFlipPose);
  }
  const baseScale = content.scale ?? 0.5;
  const shadowScale = liftShadowScale(pose.offsetY);
  const shadowWidth = content.box.width * 0.92 * shadowScale;
  return {
    animation,
    frame,
    mirror,
    x: pos.x + pose.offsetX,
    y: pos.y + pose.offsetY,
    scaleX: (mirror ? -baseScale : baseScale) * pose.scaleX,
    scaleY: baseScale * pose.scaleY,
    rotation: pose.rotation,
    zIndex: pos.y,
    shadow: {
      x: pos.x,
      y: pos.y,
      width: shadowWidth,
      height: shadowWidth * 0.38,
      alpha: shadowAlpha * shadowScale,
    },
  };
}

export function resolveNpcTextureFrame(
  animations: Record<string, string[]> | undefined,
  facing: Direction,
  idleTicks: readonly number[],
  tick: number,
): { animation: string; mirror: boolean; frameName: string | undefined } {
  const wanted = `idle_${facing}`;
  const mirror =
    facing === "right" &&
    animations?.[wanted] === undefined &&
    animations?.idle_left !== undefined;
  const animation = mirror
    ? "idle_left"
    : animations?.[wanted] !== undefined
      ? wanted
      : "idle_down";
  const names = animations?.[animation] ?? [];
  let index = 0;
  if (animation === "idle_down" && names.length === idleTicks.length && idleTicks.length > 0) {
    const cycle = idleTicks.reduce((sum, ticks) => sum + ticks, 0);
    let left = tick % cycle;
    while (left >= (idleTicks[index] ?? cycle)) {
      left -= idleTicks[index] ?? cycle;
      index += 1;
    }
  }
  return { animation, mirror, frameName: names[index] ?? names[0] };
}

export function computeNpcOverworldHeight(npc: Npc, critter: Critter | undefined): number {
  if (critter !== undefined) return critter.overworldHeight;
  if (npc.id === "oliver" || npc.id.startsWith("fairy-")) return 72;
  return ADULT_NPCS.has(npc.id) ? 132 : 114;
}

export function computeNpcPose(
  npcId: string,
  npcIndex: number,
  tick: number,
  livingMotion: boolean,
): MotionPose {
  if (!livingMotion || npcId === "bus-stop") return NEUTRAL_POSE;
  if (npcId.startsWith("fairy-")) return fairyHover(tick, npcIndex);
  return idleBreathing(tick, (npcIndex + 1) * 0.9);
}

export function computeNpcShadow(
  npcId: string,
  point: Point,
  pose: MotionPose,
  shadowAlpha: number,
  adultOverride?: boolean,
): ShadowTransform {
  if (npcId.startsWith("fairy-")) {
    const altScale = liftShadowScale(pose.offsetY);
    return {
      x: point.x,
      y: point.y + 8,
      width: 28 * altScale,
      height: 12 * altScale,
      alpha: 0.24 * altScale,
    };
  }
  const isAdult = adultOverride ?? ADULT_NPCS.has(npcId);
  const width = npcId === "oliver" ? 34 : isAdult ? 52 : 48;
  const hopScale = liftShadowScale(pose.offsetY);
  return {
    x: point.x,
    y: point.y,
    width: width * hopScale,
    height: width * 0.38 * hopScale,
    alpha: shadowAlpha * hopScale,
  };
}

export function computeRoamerBobAndFacing(
  critter: PresentCritter,
  state: State,
  index: number,
  point: Point,
  noticeTicks: number,
  livingMotion: boolean,
): { calm: boolean; frame: "calm_idle_01" | "chaos_idle_01"; flipX: boolean; pose: MotionPose } {
  const calm = critter.mood === "calm";
  const frame = calm ? "calm_idle_01" : "chaos_idle_01";
  const roamer = critter.wild;
  const talking = calm && state.dialogue !== null && state.dialogue.knot === critter.kind.calmKnot;
  const flipX = talking
    ? state.player.x > point.x
    : roamer !== null && roamer.facing === "right";
  const pose = !livingMotion
    ? NEUTRAL_POSE
    : roamer !== null
      ? roamerHop(
          state.tick,
          roamer.moving,
          roamer.notice >= noticeTicks,
          roamer.notice,
          noticeTicks,
          roamer.facing,
        )
      : idleBreathing(state.tick, (index + 1) * 1.1, calm ? 0.012 : 0.02);
  return { calm, frame, flipX, pose };
}

export function computeCritterShadow(
  point: Point,
  overworldHeight: number,
  offsetY: number,
  shadowAlpha: number,
): ShadowTransform {
  const baseWidth = Math.min(76, Math.max(36, overworldHeight * 0.56));
  const hopScale = liftShadowScale(offsetY);
  return {
    x: point.x,
    y: point.y,
    width: baseWidth * hopScale,
    height: baseWidth * 0.38 * hopScale,
    alpha: shadowAlpha * hopScale,
  };
}
